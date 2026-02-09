/// Signal processing filters for sprint analysis.
///
/// Ported from VelocityCalculator.swift (high-pass) and PropulsiveForceCalculator.swift (low-pass).

use std::f64::consts::PI;

/// First-order RC high-pass filter to remove low-frequency drift.
///
/// Filter equation: y[n] = α × (y[n-1] + x[n] - x[n-1])
/// where α = RC / (RC + dt)
pub fn high_pass_rc(values: &[f64], timestamps: &[f64], cutoff_hz: f64) -> Vec<f64> {
    if values.len() <= 1 || values.len() != timestamps.len() {
        return values.to_vec();
    }

    let rc = 1.0 / (2.0 * PI * cutoff_hz);
    let mut filtered = Vec::with_capacity(values.len());
    filtered.push(0.0); // Start at zero (no initial drift)

    let mut prev_filtered = 0.0;
    let mut prev_raw = values[0];

    for i in 1..values.len() {
        let dt = timestamps[i] - timestamps[i - 1];
        if dt <= 0.0 {
            filtered.push(prev_filtered);
            continue;
        }

        let alpha = rc / (rc + dt);
        let current_raw = values[i];
        let current_filtered = alpha * (prev_filtered + current_raw - prev_raw);

        filtered.push(current_filtered);
        prev_filtered = current_filtered;
        prev_raw = current_raw;
    }

    filtered
}

/// 2nd-order Butterworth low-pass filter with zero-phase (forward-backward) filtering.
///
/// Uses bilinear transform for coefficient calculation and Direct Form II Transposed
/// for numerical stability. Forward-backward pass eliminates phase distortion.
pub fn butterworth_low_pass(signal: &[f64], cutoff_hz: f64, sample_rate: f64) -> Vec<f64> {
    if signal.is_empty() {
        return vec![];
    }
    if sample_rate <= 0.0 || cutoff_hz <= 0.0 || cutoff_hz >= sample_rate / 2.0 {
        return signal.to_vec();
    }

    // Pre-warp frequency for bilinear transform
    let omega = (PI * cutoff_hz / sample_rate).tan();
    let omega2 = omega * omega;

    // 2nd-order Butterworth coefficients
    let sqrt2 = 2.0_f64.sqrt();
    let k = 1.0 + sqrt2 * omega + omega2;

    let b0 = omega2 / k;
    let b1 = 2.0 * omega2 / k;
    let b2 = omega2 / k;
    let a1 = 2.0 * (omega2 - 1.0) / k;
    let a2 = (1.0 - sqrt2 * omega + omega2) / k;

    // Forward pass
    let mut output = vec![0.0; signal.len()];
    let mut z1 = 0.0;
    let mut z2 = 0.0;

    for i in 0..signal.len() {
        let x = signal[i];
        let y = b0 * x + z1;
        z1 = b1 * x - a1 * y + z2;
        z2 = b2 * x - a2 * y;
        output[i] = y;
    }

    // Backward pass for zero-phase filtering
    z1 = 0.0;
    z2 = 0.0;

    for i in (0..signal.len()).rev() {
        let x = output[i];
        let y = b0 * x + z1;
        z1 = b1 * x - a1 * y + z2;
        z2 = b2 * x - a2 * y;
        output[i] = y;
    }

    output
}

/// Integrate signal using trapezoidal rule.
///
/// For each interval: integral += (y[i] + y[i-1]) / 2 × dt
pub fn integrate_trapezoidal(values: &[f64], timestamps: &[f64]) -> Vec<f64> {
    if values.len() <= 1 || values.len() != timestamps.len() {
        return vec![0.0; values.len()];
    }

    let mut integral = Vec::with_capacity(values.len());
    integral.push(0.0);
    let mut cumulative = 0.0;

    for i in 1..values.len() {
        let dt = timestamps[i] - timestamps[i - 1];
        if dt > 0.0 {
            let area = (values[i - 1] + values[i]) / 2.0 * dt;
            cumulative += area;
        }
        integral.push(cumulative);
    }

    integral
}
