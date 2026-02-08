/**
 * Sprint End Detection — BIDIRECTIONAL
 *
 * Port of detection.py for use in the web analyzer.
 *
 * FORWARD (from sprint phase):
 *   Find where acceleration rolling mean first drops significantly below
 *   the sustained sprint level.
 *
 * BACKWARD (from recording end):
 *   Work backward through standing/walking/decel to find where acceleration
 *   was still at sprint level.
 *
 * When both agree → high confidence.
 * When they disagree → the gap is the uncertainty zone.
 */

// Agreement threshold: if forward and backward are within this many seconds,
// they "agree" and we average them.
const AGREEMENT_THRESHOLD = 1.5;

const MIN_TIMES = { 60: 3, 70: 4, 100: 5, 200: 15, 290: 25, 400: 40 };

// =============================================================================
// Data loading
// =============================================================================

function decodeCurve(encodedData) {
  return JSON.parse(atob(encodedData));
}

function loadSprintData(sprint) {
  const result = {};
  if (sprint.accelerationCurve) {
    const raw = decodeCurve(sprint.accelerationCurve);
    const accel = raw
      .map((d) => ({
        timestamp: d.timestamp,
        accel_x: d.x,
        accel_y: d.y,
        accel_z: d.z,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    for (const row of accel) {
      row.mag = Math.sqrt(
        row.accel_x ** 2 + row.accel_y ** 2 + row.accel_z ** 2
      );
    }
    result.accel = accel;
  }
  if (sprint.gyroscopeCurve) {
    const raw = decodeCurve(sprint.gyroscopeCurve);
    const gyro = raw
      .map((d) => ({
        timestamp: d.timestamp,
        gyro_x: d.x,
        gyro_y: d.y,
        gyro_z: d.z,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    result.gyro = gyro;
  }
  return result;
}

function getSprintsWithCurves(data) {
  const sprints = [];
  for (const session of data.sessions) {
    const sessionDate = session.date.slice(0, 10);
    for (const sprint of session.sprints || []) {
      if (sprint.accelerationCurve && sprint.gyroscopeCurve) {
        sprints.push({
          date: sessionDate,
          distance: sprint.distance || 0,
          sprint,
        });
      }
    }
  }
  return sprints;
}

// =============================================================================
// Common: rolling mean + sprint level
// =============================================================================

function computeRollingMean(accel, windowSeconds = 1.0) {
  const n = accel.length;
  const t0 = accel[0].timestamp;
  const tEnd = accel[n - 1].timestamp;
  const rate = n / (tEnd - t0);
  const window = Math.max(10, Math.round(windowSeconds * rate));
  const minPeriods = 5;

  const mag = accel.map((d) => d.mag);
  const rolling = new Array(n);

  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - window + 1);
    const count = i - start + 1;
    if (count < minPeriods) {
      rolling[i] = null;
    } else {
      let sum = 0;
      for (let j = start; j <= i; j++) {
        sum += mag[j];
      }
      rolling[i] = sum / count;
    }
  }

  return { rolling, rate };
}

function findSprintLevel(timestamps, rolling) {
  const t0 = timestamps[0];
  const duration = timestamps[timestamps.length - 1] - t0;
  const midStart = t0 + duration * 0.2;
  const midEnd = t0 + duration * 0.7;

  const midValues = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (
      timestamps[i] >= midStart &&
      timestamps[i] <= midEnd &&
      rolling[i] !== null
    ) {
      midValues.push(rolling[i]);
    }
  }

  if (midValues.length < 10) return 5.0;
  return median(midValues);
}

function findSprintStart(timestamps, rolling) {
  for (let i = 0; i < rolling.length; i++) {
    if (rolling[i] !== null && rolling[i] > 2.0) {
      return { time: timestamps[i], index: i };
    }
  }
  return { time: timestamps[0], index: 0 };
}

// =============================================================================
// FORWARD detection
// =============================================================================

function detectForward(timestamps, rolling, sprintLevel, minSprintTime = 5.0) {
  const threshold = sprintLevel * 0.9;
  const searchStart = timestamps[0] + minSprintTime;
  const n = timestamps.length;
  const rate = n / (timestamps[n - 1] - timestamps[0]);
  const sustainSamples = Math.max(5, Math.round(0.5 * rate));

  for (let i = 0; i < n; i++) {
    if (timestamps[i] < searchStart) continue;
    if (rolling[i] === null) continue;
    if (rolling[i] < threshold) {
      let sustained = true;
      const endCheck = Math.min(i + sustainSamples, n);
      for (let j = i; j < endCheck; j++) {
        if (rolling[j] !== null && rolling[j] >= threshold) {
          sustained = false;
          break;
        }
      }
      if (sustained) {
        return { time: timestamps[i], threshold };
      }
    }
  }

  return { time: timestamps[n - 1], threshold };
}

// =============================================================================
// BACKWARD detection
// =============================================================================

function detectBackward(timestamps, rolling, sprintLevel) {
  const threshold = sprintLevel * 0.9;
  for (let i = timestamps.length - 1; i >= 0; i--) {
    if (rolling[i] === null) continue;
    if (rolling[i] >= threshold) {
      return { time: timestamps[i], threshold };
    }
  }
  return { time: timestamps[0], threshold };
}

// =============================================================================
// DECISION: combine forward + backward
// =============================================================================

function decide(forwardTime, backwardTime, _sprintStart) {
  const gap = Math.abs(forwardTime - backwardTime);
  if (gap <= AGREEMENT_THRESHOLD) {
    const final = (forwardTime + backwardTime) / 2;
    return { final, decision: 'agree', gap };
  }
  if (forwardTime < backwardTime) {
    return { final: backwardTime, decision: 'trust_backward', gap };
  }
  return { final: forwardTime, decision: 'trust_forward', gap };
}

// =============================================================================
// Utilities
// =============================================================================

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function decodeSplits(encoded) {
  if (!encoded) return [];
  try {
    return JSON.parse(atob(encoded));
  } catch {
    return [];
  }
}

function variance(arr) {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
}

// =============================================================================
// High-level: analyze file data
// =============================================================================

export function analyzeData(data) {
  const sprints = getSprintsWithCurves(data).filter((s) => s.distance >= 60);

  const results = [];
  for (let i = 0; i < sprints.length; i++) {
    const sprintInfo = sprints[i];
    const sprint = sprintInfo.sprint;
    const dist = sprintInfo.distance;
    const date = sprintInfo.date;

    const loaded = loadSprintData(sprint);
    const accel = loaded.accel;
    if (!accel || accel.length < 100) continue;

    const timestamps = accel.map((d) => d.timestamp);
    const { rolling, rate } = computeRollingMean(accel);
    const sprintLevel = findSprintLevel(timestamps, rolling);
    const { time: sprintStart } = findSprintStart(timestamps, rolling);

    const minTime = MIN_TIMES[dist] ?? 5;

    const fwd = detectForward(timestamps, rolling, sprintLevel, minTime);
    const bwd = detectBackward(timestamps, rolling, sprintLevel);
    const { final: finalTime, decision, gap } = decide(
      fwd.time,
      bwd.time,
      sprintStart
    );

    const fwdDur = fwd.time - sprintStart;
    const bwdDur = bwd.time - sprintStart;
    const finalDur = finalTime - sprintStart;

    // Relative-time arrays for plotting
    const tRel = timestamps.map((t) => t - sprintStart);
    const rawMag = accel.map((d) => d.mag);

    // Gyroscope data
    const gyro = loaded.gyro;
    let gyroData = null;
    if (gyro && gyro.length > 100) {
      const gT = gyro.map((d) => d.timestamp - sprintStart);
      const gX = gyro.map((d) => d.gyro_x);
      const gY = gyro.map((d) => d.gyro_y);
      const gZ = gyro.map((d) => d.gyro_z);
      const vx = variance(gX), vy = variance(gY), vz = variance(gZ);
      const dominantAxis = vx >= vy && vx >= vz ? 'x' : vy >= vz ? 'y' : 'z';
      gyroData = { t: gT, x: gX, y: gY, z: gZ, dominantAxis };
    }

    // Sprint metadata from backup
    const meta = {
      reactionTime: sprint.reactionTime ?? null,
      isFalseStart: sprint.isFalseStart ?? false,
      peakPropulsiveG: sprint.peakPropulsiveG ?? null,
      avgPropulsiveG: sprint.avgPropulsiveG ?? null,
      maxGForce: sprint.maxGForce ?? null,
      avgCadence: sprint.avgCadence ?? null,
      stepCount: sprint.stepCount ?? null,
      avgStrideLength: sprint.avgStrideLength ?? null,
      maxVelocity: sprint.maxVelocity ?? null,
      timeToMaxVelocity: sprint.timeToMaxVelocity ?? null,
      armDriveFocus: sprint.armDriveFocus ?? null,
      peakArmVelocity: sprint.peakArmVelocity ?? null,
      gpsStatus: sprint.gpsVerificationStatus ?? 'notApplicable',
      splits: decodeSplits(sprint.splitTimesData),
    };

    results.push({
      index: i + 1,
      date,
      distance: dist,
      fwdDur,
      bwdDur,
      finalDur,
      gap,
      decision,
      meta,
      plotData: {
        t: tRel,
        rolling,
        rawMag,
        sprintLevel,
        threshold: fwd.threshold,
        fwdTime: fwdDur,
        bwdTime: bwdDur,
        finalTime: finalDur,
      },
      gyroData,
    });
  }

  return results;
}
