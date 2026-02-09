/// Velocity calculation from acceleration data using numerical integration.
///
/// Ported from VelocityCalculator.swift.
///
/// Algorithm:
/// 1. Compute acceleration magnitude, convert G → m/s²
/// 2. High-pass filter (0.1Hz) to remove drift
/// 3. Trapezoidal integration → velocity
/// 4. Trapezoidal integration → distance
/// 5. Scale factor = known_distance / integrated_distance
/// 6. Apply correction to velocity and distance curves

use crate::types::AccelerationSample;
use crate::signal::filters;

const GRAVITY_MPS2: f64 = 9.81;
const DRIFT_FILTER_CUTOFF_HZ: f64 = 0.1;
const MIN_DURATION: f64 = 2.0;
const MIN_SAMPLE_COUNT: usize = 20;
const SCALE_FACTOR_LOWER: f64 = 0.33;
const SCALE_FACTOR_UPPER: f64 = 3.0;

/// Result of velocity / distance calculation.
pub struct VelocityResult {
    /// Velocity curve: (relative_time, velocity_mps)
    pub velocity_curve: Vec<(f64, f64)>,
    /// Distance curve: (relative_time, distance_m)
    pub distance_curve: Vec<(f64, f64)>,
    /// Maximum velocity in m/s
    pub max_velocity: f64,
    /// Time to maximum velocity (relative to sprint start)
    pub time_to_max_velocity: f64,
    /// Scale factor applied
    pub scale_factor: f64,
}

/// Calculate velocity and distance curves from acceleration samples.
///
/// `sprint_start` is the absolute timestamp of sprint start (for making times relative).
/// `sprint_end` is the absolute timestamp of sprint end.
/// `distance` is the known sprint distance in meters.
pub fn calculate_velocity(
    accel: &[AccelerationSample],
    sprint_start: f64,
    sprint_end: f64,
    distance: u32,
) -> Option<VelocityResult> {
    let duration = sprint_end - sprint_start;
    if duration < MIN_DURATION || accel.len() < MIN_SAMPLE_COUNT || distance == 0 {
        return None;
    }

    // Filter to samples within the sprint window (with a small buffer)
    let buffer = 0.5; // 0.5s buffer on each side
    let start = sprint_start - buffer;
    let end = sprint_end + buffer;

    let sprint_samples: Vec<&AccelerationSample> = accel
        .iter()
        .filter(|s| s.timestamp >= start && s.timestamp <= end)
        .collect();

    if sprint_samples.len() < MIN_SAMPLE_COUNT {
        return None;
    }

    let timestamps: Vec<f64> = sprint_samples.iter().map(|s| s.timestamp).collect();
    let magnitudes_mps2: Vec<f64> = sprint_samples
        .iter()
        .map(|s| {
            let mag = (s.x * s.x + s.y * s.y + s.z * s.z).sqrt();
            mag * GRAVITY_MPS2
        })
        .collect();

    // High-pass filter to remove drift
    let filtered = filters::high_pass_rc(&magnitudes_mps2, &timestamps, DRIFT_FILTER_CUTOFF_HZ);

    // Integrate acceleration → velocity
    let raw_velocity = filters::integrate_trapezoidal(&filtered, &timestamps);

    // Integrate velocity → distance
    let raw_distance = filters::integrate_trapezoidal(&raw_velocity, &timestamps);

    // Find the sample closest to sprint_end for distance at end
    let end_idx = timestamps
        .iter()
        .position(|&t| t >= sprint_end)
        .unwrap_or(timestamps.len() - 1);

    let integrated_distance = raw_distance[end_idx];
    if integrated_distance < 0.1 {
        return None;
    }

    let scale_factor = distance as f64 / integrated_distance;
    if scale_factor < SCALE_FACTOR_LOWER || scale_factor > SCALE_FACTOR_UPPER {
        return None;
    }

    // Apply scaling and make times relative to sprint_start
    let velocity_curve: Vec<(f64, f64)> = timestamps
        .iter()
        .zip(raw_velocity.iter())
        .map(|(&t, &v)| (t - sprint_start, v * scale_factor))
        .collect();

    let distance_curve: Vec<(f64, f64)> = timestamps
        .iter()
        .zip(raw_distance.iter())
        .map(|(&t, &d)| (t - sprint_start, d * scale_factor))
        .collect();

    // Find max velocity
    let mut max_v = 0.0_f64;
    let mut max_v_time = 0.0;
    for &(t, v) in &velocity_curve {
        if v > max_v {
            max_v = v;
            max_v_time = t;
        }
    }

    Some(VelocityResult {
        velocity_curve,
        distance_curve,
        max_velocity: max_v,
        time_to_max_velocity: max_v_time,
        scale_factor,
    })
}
