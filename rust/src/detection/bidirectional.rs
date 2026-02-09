use crate::types::{AccelerationSample, GyroscopeSample, ParsedSprint, SprintAnalysisResult, PlotData, GyroData, VelocityData, SplitTime};
use crate::biomechanics::{velocity, splits};
use super::piecewise_linear;

const AGREEMENT_THRESHOLD: f64 = 1.5;

fn min_sprint_time(distance: u32) -> f64 {
    match distance {
        d if d <= 60 => 3.0,
        d if d <= 70 => 4.0,
        d if d <= 100 => 5.0,
        d if d <= 200 => 15.0,
        d if d <= 290 => 25.0,
        _ => 40.0,
    }
}

fn magnitude(s: &AccelerationSample) -> f64 {
    (s.x * s.x + s.y * s.y + s.z * s.z).sqrt()
}

fn compute_rolling_mean(accel: &[AccelerationSample], window_seconds: f64) -> (Vec<Option<f64>>, f64) {
    let n = accel.len();
    let t0 = accel[0].timestamp;
    let t_end = accel[n - 1].timestamp;
    let rate = n as f64 / (t_end - t0);
    let window = (window_seconds * rate).round().max(10.0) as usize;
    let min_periods = 5usize;

    let mag: Vec<f64> = accel.iter().map(magnitude).collect();
    let mut rolling = vec![None; n];

    for i in 0..n {
        let start = if i >= window - 1 { i - window + 1 } else { 0 };
        let count = i - start + 1;
        if count < min_periods {
            rolling[i] = None;
        } else {
            let sum: f64 = mag[start..=i].iter().sum();
            rolling[i] = Some(sum / count as f64);
        }
    }

    (rolling, rate)
}

fn median(arr: &[f64]) -> f64 {
    let mut sorted = arr.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let mid = sorted.len() / 2;
    if sorted.len() % 2 == 0 {
        (sorted[mid - 1] + sorted[mid]) / 2.0
    } else {
        sorted[mid]
    }
}

fn find_sprint_level(timestamps: &[f64], rolling: &[Option<f64>]) -> f64 {
    let t0 = timestamps[0];
    let duration = timestamps[timestamps.len() - 1] - t0;
    let mid_start = t0 + duration * 0.2;
    let mid_end = t0 + duration * 0.7;

    let mid_values: Vec<f64> = timestamps.iter()
        .zip(rolling.iter())
        .filter_map(|(&t, &r)| {
            if t >= mid_start && t <= mid_end {
                r
            } else {
                None
            }
        })
        .collect();

    if mid_values.len() < 10 {
        return 5.0;
    }
    median(&mid_values)
}

fn find_sprint_start(timestamps: &[f64], rolling: &[Option<f64>]) -> f64 {
    for (i, &r) in rolling.iter().enumerate() {
        if let Some(val) = r {
            if val > 2.0 {
                return timestamps[i];
            }
        }
    }
    timestamps[0]
}

struct DetectionPoint {
    time: f64,
    threshold: f64,
}

fn detect_forward(timestamps: &[f64], rolling: &[Option<f64>], sprint_level: f64, min_sprint_time: f64, rate: f64) -> DetectionPoint {
    let threshold = sprint_level * 0.9;
    let search_start = timestamps[0] + min_sprint_time;
    let n = timestamps.len();
    let sustain_samples = (0.5 * rate).round().max(5.0) as usize;

    for i in 0..n {
        if timestamps[i] < search_start { continue; }
        if let Some(val) = rolling[i] {
            if val < threshold {
                let mut sustained = true;
                let end_check = (i + sustain_samples).min(n);
                for j in i..end_check {
                    if let Some(v) = rolling[j] {
                        if v >= threshold {
                            sustained = false;
                            break;
                        }
                    }
                }
                if sustained {
                    return DetectionPoint { time: timestamps[i], threshold };
                }
            }
        }
    }

    DetectionPoint { time: timestamps[n - 1], threshold }
}

fn detect_backward(timestamps: &[f64], rolling: &[Option<f64>], sprint_level: f64) -> DetectionPoint {
    let threshold = sprint_level * 0.9;
    for i in (0..timestamps.len()).rev() {
        if let Some(val) = rolling[i] {
            if val >= threshold {
                return DetectionPoint { time: timestamps[i], threshold };
            }
        }
    }
    DetectionPoint { time: timestamps[0], threshold }
}

fn decide(fwd_time: f64, bwd_time: f64) -> (f64, String, f64) {
    let gap = (fwd_time - bwd_time).abs();
    if gap <= AGREEMENT_THRESHOLD {
        let final_time = (fwd_time + bwd_time) / 2.0;
        (final_time, "agree".to_string(), gap)
    } else if fwd_time < bwd_time {
        (bwd_time, "trust_backward".to_string(), gap)
    } else {
        (fwd_time, "trust_forward".to_string(), gap)
    }
}

fn variance(arr: &[f64]) -> f64 {
    let n = arr.len() as f64;
    let mean = arr.iter().sum::<f64>() / n;
    arr.iter().map(|&v| (v - mean) * (v - mean)).sum::<f64>() / n
}

fn build_gyro_data(gyro: &[GyroscopeSample], sprint_start: f64) -> Option<GyroData> {
    if gyro.len() < 100 {
        return None;
    }

    let t: Vec<f64> = gyro.iter().map(|s| s.timestamp - sprint_start).collect();
    let x: Vec<f64> = gyro.iter().map(|s| s.x).collect();
    let y: Vec<f64> = gyro.iter().map(|s| s.y).collect();
    let z: Vec<f64> = gyro.iter().map(|s| s.z).collect();

    let vx = variance(&x);
    let vy = variance(&y);
    let vz = variance(&z);

    let dominant_axis = if vx >= vy && vx >= vz {
        "x"
    } else if vy >= vz {
        "y"
    } else {
        "z"
    }.to_string();

    Some(GyroData { t, x, y, z, dominant_axis })
}

pub fn analyze(sprint: &ParsedSprint) -> Result<SprintAnalysisResult, String> {
    let accel = &sprint.accel;
    if accel.len() < 100 {
        return Err("Too few acceleration samples".to_string());
    }

    let timestamps: Vec<f64> = accel.iter().map(|s| s.timestamp).collect();
    let (rolling, rate) = compute_rolling_mean(accel, 1.0);
    let sprint_level = find_sprint_level(&timestamps, &rolling);
    let sprint_start = find_sprint_start(&timestamps, &rolling);
    let min_time = min_sprint_time(sprint.distance);

    let fwd = detect_forward(&timestamps, &rolling, sprint_level, min_time, rate);
    let bwd = detect_backward(&timestamps, &rolling, sprint_level);
    let (final_time, decision, gap) = decide(fwd.time, bwd.time);

    let fwd_dur = fwd.time - sprint_start;
    let bwd_dur = bwd.time - sprint_start;
    let final_dur = final_time - sprint_start;

    // Relative-time arrays for plotting
    let t_rel: Vec<f64> = timestamps.iter().map(|&t| t - sprint_start).collect();
    let raw_mag: Vec<f64> = accel.iter().map(magnitude).collect();

    let plot_data = PlotData {
        t: t_rel,
        rolling,
        raw_mag,
        sprint_level,
        threshold: fwd.threshold,
        fwd_time: fwd_dur,
        bwd_time: bwd_dur,
        final_time: final_dur,
    };

    let gyro_data = build_gyro_data(&sprint.gyro, sprint_start);

    // Run piecewise linear fit on the same rolling mean data
    let piecewise_fit = piecewise_linear::fit_piecewise(
        &plot_data.t,
        &plot_data.rolling,
        rate,
        sprint.distance,
    );

    // Velocity / distance calculation via IMU integration
    let velocity_data = velocity::calculate_velocity(
        accel,
        sprint_start,
        final_time,
        sprint.distance,
    ).map(|vr| {
        // Compute splits from distance curve
        let computed_splits = splits::calculate_splits(&vr.distance_curve, sprint.distance)
            .into_iter()
            .map(|s| SplitTime {
                distance_mark: s.distance_mark,
                time: s.time,
                segment_velocity: s.segment_velocity,
            })
            .collect();

        // Subsample curves for efficient JSON transfer (~10Hz instead of 100Hz)
        let step = (vr.velocity_curve.len() / 500).max(1);
        let t: Vec<f64> = vr.velocity_curve.iter().step_by(step).map(|&(t, _)| t).collect();
        let vel: Vec<f64> = vr.velocity_curve.iter().step_by(step).map(|&(_, v)| v).collect();
        let dist: Vec<f64> = vr.distance_curve.iter().step_by(step).map(|&(_, d)| d).collect();

        VelocityData {
            t,
            velocity: vel,
            distance: dist,
            max_velocity: vr.max_velocity,
            time_to_max_velocity: vr.time_to_max_velocity,
            scale_factor: vr.scale_factor,
            computed_splits,
        }
    });

    Ok(SprintAnalysisResult {
        index: sprint.index,
        date: sprint.date.clone(),
        distance: sprint.distance,
        fwd_dur,
        bwd_dur,
        final_dur,
        gap,
        decision,
        meta: sprint.meta.clone(),
        plot_data,
        gyro_data,
        piecewise_fit,
        velocity_data,
    })
}
