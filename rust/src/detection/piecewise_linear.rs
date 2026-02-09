use crate::types::PiecewiseFitResult;

// Configuration constants (matching Swift SimpleSprintEndDetector)
const COARSE_STEP: f64 = 0.5;
const FINE_STEP: f64 = 0.1;
const MIN_ACCEL_PHASE: f64 = 0.5;
const MAX_ACCEL_PHASE: f64 = 8.0;
const MIN_FLY_PHASE: f64 = 3.0;
const MIN_DECEL_PHASE: f64 = 1.0;
const MIN_DECEL_DROP_FRACTION: f64 = 0.08;
const MIN_DECEL_WINDOW_SECONDS: f64 = 1.0;
const DOWNSAMPLE_RATE: f64 = 10.0;

fn min_sprint_time(distance: u32) -> f64 {
    match distance {
        d if d <= 70 => 4.0,
        d if d <= 100 => 5.0,
        d if d <= 200 => 15.0,
        _ => 40.0,
    }
}

/// Fit a 3-phase continuous piecewise linear model to the rolling mean.
///
/// Uses the rolling mean already computed by the bidirectional detector.
/// `t_rel` and `rolling` are relative to sprint start.
pub fn fit_piecewise(
    t_rel: &[f64],
    rolling: &[Option<f64>],
    sample_rate: f64,
    distance: u32,
) -> Option<PiecewiseFitResult> {
    // Subsample to ~10Hz
    let step = (sample_rate / DOWNSAMPLE_RATE).round().max(1.0) as usize;
    let mut t_sub = Vec::new();
    let mut r_sub = Vec::new();
    for i in (0..t_rel.len()).step_by(step) {
        if let Some(val) = rolling[i] {
            t_sub.push(t_rel[i]);
            r_sub.push(val);
        }
    }

    if t_sub.len() < 20 {
        return None;
    }

    let duration = *t_sub.last()?;
    let min_sprint = min_sprint_time(distance);

    if duration <= min_sprint + MIN_DECEL_PHASE {
        return None;
    }

    // Precompute ||b||^2
    let b_norm_sq: f64 = r_sub.iter().map(|r| r * r).sum();

    let bp1_max = MAX_ACCEL_PHASE.min(duration - MIN_FLY_PHASE - MIN_DECEL_PHASE);
    let bp2_max = duration - MIN_DECEL_PHASE;

    if MIN_ACCEL_PHASE >= bp1_max || min_sprint >= bp2_max {
        return None;
    }

    // Coarse grid search
    let (best_bp1, best_bp2) = grid_search(
        &t_sub, &r_sub, b_norm_sq,
        MIN_ACCEL_PHASE, bp1_max,
        min_sprint, bp2_max,
        COARSE_STEP,
    )?;

    // Fine grid refinement around best
    let fine_bp1_min = MIN_ACCEL_PHASE.max(best_bp1 - 1.0);
    let fine_bp1_max = bp1_max.min(best_bp1 + 1.0);
    let fine_bp2_min = min_sprint.max(best_bp2 - 1.0);
    let fine_bp2_max = bp2_max.min(best_bp2 + 1.0);

    let (final_bp1, final_bp2) = grid_search(
        &t_sub, &r_sub, b_norm_sq,
        fine_bp1_min, fine_bp1_max,
        fine_bp2_min, fine_bp2_max,
        FINE_STEP,
    ).unwrap_or((best_bp1, best_bp2));

    // Get final parameters
    let (y0, s1, s2, s3) = solve_fit(&t_sub, &r_sub, final_bp1, final_bp2)?;

    // Sprint level = average of fly phase endpoints
    let fly_start = y0 + s1 * final_bp1;
    let fly_end = fly_start + s2 * (final_bp2 - final_bp1);
    let sprint_level = (fly_start + fly_end) / 2.0;

    let confidence = if s3 <= -0.1 { "high" } else { "medium" }.to_string();

    Some(PiecewiseFitResult {
        bp1: final_bp1,
        bp2: final_bp2,
        y0,
        s1,
        s2,
        s3,
        sprint_level,
        confidence,
    })
}

/// Grid search over (bp1, bp2) pairs, returning the best that satisfies constraints.
fn grid_search(
    t_sub: &[f64],
    r_sub: &[f64],
    b_norm_sq: f64,
    bp1_min: f64,
    bp1_max: f64,
    bp2_min_base: f64,
    bp2_max: f64,
    step: f64,
) -> Option<(f64, f64)> {
    let mut best_residual = f64::INFINITY;
    let mut best_bp1 = bp1_min;
    let mut best_bp2 = bp2_min_base;

    let mut best_drop_residual = f64::INFINITY;
    let mut best_drop_bp1 = bp1_min;
    let mut best_drop_bp2 = bp2_min_base;

    let mut bp1 = bp1_min;
    while bp1 <= bp1_max {
        let bp2_min = bp2_min_base.max(bp1 + MIN_FLY_PHASE);
        let mut bp2 = bp2_min;
        while bp2 <= bp2_max {
            if let Some((residual, s1, _s2, s3)) = evaluate_fit(t_sub, r_sub, bp1, bp2, b_norm_sq) {
                if s1 >= 0.0 && s3 <= 0.0 {
                    if residual < best_residual {
                        best_residual = residual;
                        best_bp1 = bp1;
                        best_bp2 = bp2;
                    }
                    if residual < best_drop_residual
                        && meets_decel_drop(t_sub, r_sub, bp1, bp2)
                    {
                        best_drop_residual = residual;
                        best_drop_bp1 = bp1;
                        best_drop_bp2 = bp2;
                    }
                }
            }
            bp2 += step;
        }
        bp1 += step;
    }

    if best_residual == f64::INFINITY {
        return None;
    }

    // Prefer fits that meet the deceleration drop criterion
    if best_drop_residual < f64::INFINITY {
        Some((best_drop_bp1, best_drop_bp2))
    } else {
        Some((best_bp1, best_bp2))
    }
}

/// Check that the post-bp2 region actually drops by at least 8% from fly level.
fn meets_decel_drop(t_sub: &[f64], r_sub: &[f64], bp1: f64, bp2: f64) -> bool {
    let end_time = match t_sub.last() {
        Some(&t) => t,
        None => return false,
    };

    let fly_mean = mean_in_range(t_sub, r_sub, bp1, bp2, 3);
    let decel_window_end = end_time.min(bp2 + MIN_DECEL_WINDOW_SECONDS);
    let decel_mean = mean_in_range(t_sub, r_sub, bp2, decel_window_end, 3);

    match (fly_mean, decel_mean) {
        (Some(fm), Some(dm)) => dm <= fm * (1.0 - MIN_DECEL_DROP_FRACTION),
        _ => false,
    }
}

fn mean_in_range(t_sub: &[f64], r_sub: &[f64], from: f64, to: f64, min_samples: usize) -> Option<f64> {
    if from >= to {
        return None;
    }
    let mut sum = 0.0;
    let mut count = 0usize;
    for i in 0..t_sub.len() {
        if t_sub[i] >= from && t_sub[i] <= to {
            sum += r_sub[i];
            count += 1;
        }
    }
    if count >= min_samples {
        Some(sum / count as f64)
    } else {
        None
    }
}

/// Evaluate the fit for given breakpoints. Returns (residual, s1, s2, s3).
fn evaluate_fit(
    t_sub: &[f64],
    r_sub: &[f64],
    bp1: f64,
    bp2: f64,
    b_norm_sq: f64,
) -> Option<(f64, f64, f64, f64)> {
    let (y0, s1, s2, s3) = solve_fit(t_sub, r_sub, bp1, bp2)?;

    // Compute A^T b for residual
    let atb = compute_atb(t_sub, r_sub, bp1, bp2);
    let x = [y0, s1, s2, s3];
    let x_dot_atb: f64 = x.iter().zip(atb.iter()).map(|(a, b)| a * b).sum();
    let residual = b_norm_sq - x_dot_atb;

    Some((residual, s1, s2, s3))
}

/// Solve 4x4 normal equations for the piecewise fit.
///
/// Design matrix row:
///   seg1 (t <= bp1):       [1, t,   0,         0       ]
///   seg2 (bp1 < t <= bp2): [1, bp1, t - bp1,   0       ]
///   seg3 (t > bp2):        [1, bp1, bp2 - bp1, t - bp2 ]
fn solve_fit(t_sub: &[f64], r_sub: &[f64], bp1: f64, bp2: f64) -> Option<(f64, f64, f64, f64)> {
    let n = t_sub.len();
    let fly_len = bp2 - bp1;

    // Build normal equations: (A^T A) x = A^T b
    let mut ata = [[0.0f64; 4]; 4];
    let mut atb = [0.0f64; 4];

    for i in 0..n {
        let t = t_sub[i];
        let r = r_sub[i];

        let row: [f64; 4] = if t <= bp1 {
            [1.0, t, 0.0, 0.0]
        } else if t <= bp2 {
            [1.0, bp1, t - bp1, 0.0]
        } else {
            [1.0, bp1, fly_len, t - bp2]
        };

        for j in 0..4 {
            atb[j] += row[j] * r;
            for k in j..4 {
                ata[j][k] += row[j] * row[k];
            }
        }
    }

    // Fill symmetric lower triangle
    for j in 0..4 {
        for k in 0..j {
            ata[j][k] = ata[k][j];
        }
    }

    solve_4x4(ata, atb)
}

fn compute_atb(t_sub: &[f64], r_sub: &[f64], bp1: f64, bp2: f64) -> [f64; 4] {
    let fly_len = bp2 - bp1;
    let mut atb = [0.0f64; 4];

    for i in 0..t_sub.len() {
        let t = t_sub[i];
        let r = r_sub[i];

        let row: [f64; 4] = if t <= bp1 {
            [1.0, t, 0.0, 0.0]
        } else if t <= bp2 {
            [1.0, bp1, t - bp1, 0.0]
        } else {
            [1.0, bp1, fly_len, t - bp2]
        };

        for j in 0..4 {
            atb[j] += row[j] * r;
        }
    }
    atb
}

/// Gaussian elimination with partial pivoting for a 4x4 system.
fn solve_4x4(matrix: [[f64; 4]; 4], rhs: [f64; 4]) -> Option<(f64, f64, f64, f64)> {
    let mut a = matrix;
    let mut b = rhs;

    // Forward elimination with partial pivoting
    for col in 0..4 {
        // Find pivot
        let mut max_val = a[col][col].abs();
        let mut max_row = col;
        for row in (col + 1)..4 {
            if a[row][col].abs() > max_val {
                max_val = a[row][col].abs();
                max_row = row;
            }
        }

        if max_val < 1e-12 {
            return None;
        }

        if max_row != col {
            a.swap(col, max_row);
            b.swap(col, max_row);
        }

        for row in (col + 1)..4 {
            let factor = a[row][col] / a[col][col];
            for k in col..4 {
                a[row][k] -= factor * a[col][k];
            }
            b[row] -= factor * b[col];
        }
    }

    // Back substitution
    let mut x = [0.0f64; 4];
    for i in (0..4).rev() {
        let mut sum = b[i];
        for j in (i + 1)..4 {
            sum -= a[i][j] * x[j];
        }
        if a[i][i].abs() < 1e-12 {
            return None;
        }
        x[i] = sum / a[i][i];
    }

    Some((x[0], x[1], x[2], x[3]))
}
