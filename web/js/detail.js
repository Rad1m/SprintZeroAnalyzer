/**
 * Sprint detail panel: hero card, metrics, splits table.
 */

// =============================================================================
// Formatting helpers
// =============================================================================

function fmt(seconds) {
  if (seconds == null) return '--';
  const total = Math.floor(seconds);
  const ms = Math.round((seconds - total) * 1000);
  if (total < 60) {
    return `${total}.${String(ms).padStart(3, '0')}`;
  }
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function fmtFixed(val, digits = 2) {
  if (val == null) return '--';
  return val.toFixed(digits);
}

function armDriveGrade(score) {
  if (score == null) return null;
  if (score >= 0.85) return { label: 'Optimal', color: '#3fb950' };
  if (score >= 0.65) return { label: 'Efficient', color: '#3fb950' };
  if (score >= 0.45) return { label: 'Loose', color: '#d29922' };
  return { label: 'Unstable', color: '#f85149' };
}

function gpsLabel(status) {
  switch (status) {
    case 'verified': return { text: 'GPS Verified', color: '#3fb950' };
    case 'mismatch': return { text: 'GPS Mismatch', color: '#d29922' };
    case 'unavailable': return { text: 'No GPS', color: '#484f58' };
    default: return null;
  }
}

// =============================================================================
// Render functions
// =============================================================================

export function renderDetail(result) {
  const section = document.getElementById('detail-section');
  section.classList.add('visible');

  renderHero(result);
  renderMetrics(result);
  renderSplits(result.meta.splits);
}

export function clearDetail() {
  document.getElementById('detail-section').classList.remove('visible');
}

// -- Hero card ---------------------------------------------------------------

function renderHero(result) {
  const el = document.getElementById('hero-card');
  const m = result.meta;

  const gpsBadge = gpsLabel(m.gpsStatus);
  const badgeHtml = gpsBadge
    ? `<span class="hero-badge" style="color:${gpsBadge.color}">${gpsBadge.text}</span>`
    : '';

  const falseStartHtml = m.isFalseStart
    ? '<span class="false-start-badge">FALSE START</span>'
    : '';

  el.innerHTML =
    `<div class="hero-time">${fmt(result.finalDur)}</div>` +
    `<div class="hero-distance">${result.distance}m</div>` +
    `<div class="hero-badges">${falseStartHtml}${badgeHtml}</div>`;
}

// -- Metrics card ------------------------------------------------------------

function renderMetrics(result) {
  const el = document.getElementById('metrics-card');
  const m = result.meta;

  const rows = [];

  // Reaction time
  if (m.reactionTime != null) {
    const rtColor = m.isFalseStart ? '#f85149' : '#c9d1d9';
    rows.push(metricRow('Reaction Time', fmtFixed(m.reactionTime, 3) + 's', rtColor));
  }

  // Drive Force
  if (m.peakPropulsiveG != null) {
    rows.push(metricRow('Drive Force', fmtFixed(m.peakPropulsiveG, 1) + 'G'));
  }

  // Impact Intensity
  if (m.maxGForce != null) {
    rows.push(metricRow('Impact Intensity', fmtFixed(m.maxGForce, 1) + 'G'));
  }

  // Cadence
  if (m.avgCadence != null) {
    rows.push(metricRow('Cadence', m.avgCadence + ' spm'));
  }

  // Step Count
  if (m.stepCount != null) {
    rows.push(metricRow('Total Steps', String(m.stepCount)));
  }

  // Stride Length
  if (m.avgStrideLength != null) {
    rows.push(metricRow('Stride Length', fmtFixed(m.avgStrideLength, 2) + 'm'));
  }

  // Max Velocity
  if (m.maxVelocity != null) {
    const kmh = (m.maxVelocity * 3.6).toFixed(1);
    rows.push(metricRow('Max Velocity', fmtFixed(m.maxVelocity, 1) + ' m/s', null, kmh + ' km/h'));
  }

  // Time to Max Velocity
  if (m.timeToMaxVelocity != null) {
    rows.push(metricRow('Time to Max', fmtFixed(m.timeToMaxVelocity, 2) + 's'));
  }

  // Arm Drive Focus
  if (m.armDriveFocus != null) {
    const grade = armDriveGrade(m.armDriveFocus);
    const pct = (m.armDriveFocus * 100).toFixed(0) + '%';
    rows.push(metricRow('Arm Drive Focus', pct, null,
      `<span class="metric-badge" style="background:${grade.color}">${grade.label}</span>`));
  }

  // Peak Arm Velocity
  if (m.peakArmVelocity != null) {
    rows.push(metricRow('Peak Arm Velocity', fmtFixed(m.peakArmVelocity, 1) + ' rad/s'));
  }

  el.innerHTML = rows.join('<div class="metric-divider"></div>');
}

function metricRow(label, value, valueColor, extra) {
  const style = valueColor ? ` style="color:${valueColor}"` : '';
  const extraHtml = extra ? `<span class="metric-extra">${extra}</span>` : '';
  return (
    `<div class="metric-row">` +
    `<span class="metric-label">${label}</span>` +
    `<span class="metric-value"${style}>${value}</span>` +
    extraHtml +
    `</div>`
  );
}

// -- Splits table ------------------------------------------------------------

function renderSplits(splits) {
  const container = document.getElementById('splits-card');
  if (!splits || splits.length === 0) {
    container.classList.remove('visible');
    return;
  }
  container.classList.add('visible');

  const thead =
    '<thead><tr>' +
    '<th>Dist</th><th>Time</th><th>Split</th><th>Velocity</th>' +
    '</tr></thead>';

  let tbody = '<tbody>';
  for (let i = 0; i < splits.length; i++) {
    const s = splits[i];
    const segTime = i === 0 ? s.time : s.time - splits[i - 1].time;
    tbody +=
      `<tr>` +
      `<td class="split-dist">${s.distanceMark}m</td>` +
      `<td class="split-time">${s.time.toFixed(3)}</td>` +
      `<td class="split-seg">${segTime.toFixed(3)}</td>` +
      `<td class="split-vel">${s.segmentVelocity.toFixed(1)}</td>` +
      `</tr>`;
  }
  tbody += '</tbody>';

  container.innerHTML =
    `<h3 class="card-title">Splits</h3>` +
    `<div class="splits-scroll"><table class="splits-table">${thead}${tbody}</table></div>`;
}
