/// Kalman filter for fusing IMU acceleration with GPS Doppler speed,
/// plus RTS (Rauch-Tung-Striebel) backward smoother.
///
/// Ported from VelocityKalmanFilter.swift.

/// Snapshot of forward-pass filter state at each step.
struct FilterSnapshot {
    velocity: f64,
    covariance: f64,
    predicted_velocity: f64,
    predicted_covariance: f64,
}

/// Kalman filter state.
struct KalmanState {
    velocity: f64,
    error_covariance: f64,
    last_prediction_time: Option<f64>,
}

/// Configuration for the Kalman filter.
pub struct KalmanConfig {
    pub process_noise: f64,
    pub measurement_noise: f64,
}

impl Default for KalmanConfig {
    fn default() -> Self {
        Self {
            process_noise: 0.15,
            measurement_noise: 0.4,
        }
    }
}

impl KalmanConfig {
    /// GPS-optimized: trust GPS more
    pub fn gps_optimized() -> Self {
        Self {
            process_noise: 0.2,
            measurement_noise: 0.3,
        }
    }
}

impl KalmanState {
    fn new() -> Self {
        Self {
            velocity: 0.0,
            error_covariance: 1.0,
            last_prediction_time: None,
        }
    }

    fn predict(&mut self, forward_accel: f64, timestamp: f64, process_noise: f64) {
        let dt = if let Some(last) = self.last_prediction_time {
            let d = timestamp - last;
            if d <= 0.001 || d >= 0.5 {
                self.last_prediction_time = Some(timestamp);
                return;
            }
            d
        } else {
            0.01 // First sample: nominal 100Hz
        };

        self.last_prediction_time = Some(timestamp);
        self.velocity += forward_accel * dt;
        self.error_covariance += process_noise;
    }

    fn update_adaptive(&mut self, measured_velocity: f64, measurement_noise: f64) {
        let effective_r = measurement_noise.max(0.01);
        let kalman_gain = self.error_covariance / (self.error_covariance + effective_r);
        self.velocity += kalman_gain * (measured_velocity - self.velocity);
        self.error_covariance *= 1.0 - kalman_gain;
    }
}

/// GPS speed sample for Kalman fusion.
pub struct GpsSpeedSample {
    pub timestamp: f64,
    pub speed: f64,
    /// speedAccuracy^2 (variance)
    pub noise: f64,
}

/// Process acceleration + GPS speed through forward Kalman + RTS backward smoother.
///
/// Returns smoothed velocity at each acceleration sample timestamp.
pub fn process_batch_smoothed(
    accel_samples: &[(f64, f64)], // (timestamp, forward_accel_mps2)
    gps_speeds: &[GpsSpeedSample],
    config: &KalmanConfig,
) -> Vec<(f64, f64)> {
    if accel_samples.is_empty() {
        return vec![];
    }

    let mut state = KalmanState::new();
    let mut snapshots = Vec::with_capacity(accel_samples.len());
    let mut gps_idx = 0;

    // Forward pass
    for &(timestamp, forward_accel) in accel_samples {
        state.predict(forward_accel, timestamp, config.process_noise);

        let predicted_v = state.velocity;
        let predicted_p = state.error_covariance;

        // Apply GPS updates at or before this timestamp
        while gps_idx < gps_speeds.len() && gps_speeds[gps_idx].timestamp <= timestamp {
            state.update_adaptive(gps_speeds[gps_idx].speed, gps_speeds[gps_idx].noise);
            gps_idx += 1;
        }

        snapshots.push(FilterSnapshot {
            velocity: state.velocity,
            covariance: state.error_covariance,
            predicted_velocity: predicted_v,
            predicted_covariance: predicted_p,
        });
    }

    // RTS backward pass
    let n = snapshots.len();
    let mut smoothed = vec![0.0; n];
    smoothed[n - 1] = snapshots[n - 1].velocity;

    for k in (0..n - 1).rev() {
        let filtered = &snapshots[k];
        let next_predicted = &snapshots[k + 1];

        let smoother_gain = if next_predicted.predicted_covariance > 1e-12 {
            filtered.covariance / next_predicted.predicted_covariance
        } else {
            0.0
        };

        smoothed[k] = filtered.velocity
            + smoother_gain * (smoothed[k + 1] - next_predicted.predicted_velocity);

        // Clamp non-negative
        smoothed[k] = smoothed[k].max(0.0);
    }

    accel_samples
        .iter()
        .zip(smoothed.iter())
        .map(|(&(t, _), &v)| (t, v))
        .collect()
}
