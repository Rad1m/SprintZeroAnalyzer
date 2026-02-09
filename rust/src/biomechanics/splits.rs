/// Split time calculator — 10m interval interpolation from a distance curve.
///
/// Ported from SplitCalculator.swift.

/// A single split time at a distance mark.
pub struct ComputedSplit {
    /// Distance mark in meters (10, 20, 30, ...)
    pub distance_mark: f64,
    /// Time from sprint start in seconds
    pub time: f64,
    /// Average velocity for this segment in m/s
    pub segment_velocity: f64,
}

const SPLIT_INTERVAL: f64 = 10.0;

/// Calculate split times from a distance curve.
///
/// `distance_curve` is a slice of (relative_time, cumulative_distance) pairs.
/// `target_distance` is the sprint distance in meters.
pub fn calculate_splits(
    distance_curve: &[(f64, f64)],
    target_distance: u32,
) -> Vec<ComputedSplit> {
    if distance_curve.is_empty() || target_distance == 0 {
        return vec![];
    }

    let mut splits = Vec::new();
    let mut prev_split_time = 0.0;
    let mut mark = SPLIT_INTERVAL;

    while mark <= target_distance as f64 {
        if let Some(time) = interpolate_time(mark, distance_curve) {
            let segment_time = time - prev_split_time;
            let segment_velocity = if segment_time > 0.0 {
                SPLIT_INTERVAL / segment_time
            } else {
                0.0
            };

            splits.push(ComputedSplit {
                distance_mark: mark,
                time,
                segment_velocity,
            });

            prev_split_time = time;
        }
        mark += SPLIT_INTERVAL;
    }

    // Handle edge case: final distance slightly short (within 2%)
    if let Some(&(_, last_dist)) = distance_curve.last() {
        let target = target_distance as f64;
        if last_dist > target * 0.98
            && last_dist < target
            && splits.last().map_or(true, |s| (s.distance_mark - target).abs() > 0.01)
        {
            if let Some(time) = extrapolate_time(target, distance_curve) {
                let remaining = target - splits.last().map_or(0.0, |s| s.distance_mark);
                let segment_time = time - prev_split_time;
                let segment_velocity = if segment_time > 0.0 {
                    remaining / segment_time
                } else {
                    0.0
                };

                splits.push(ComputedSplit {
                    distance_mark: target,
                    time,
                    segment_velocity,
                });
            }
        }
    }

    splits
}

/// Linear interpolation to find time at a given distance.
fn interpolate_time(target_distance: f64, curve: &[(f64, f64)]) -> Option<f64> {
    for i in 0..curve.len().saturating_sub(1) {
        let (t1, d1) = curve[i];
        let (t2, d2) = curve[i + 1];

        if d1 <= target_distance && target_distance <= d2 {
            if (d2 - d1).abs() < 1e-12 {
                return Some(t1);
            }
            let ratio = (target_distance - d1) / (d2 - d1);
            return Some(t1 + ratio * (t2 - t1));
        }
    }
    None
}

/// Extrapolate time beyond the curve using final velocity.
fn extrapolate_time(target_distance: f64, curve: &[(f64, f64)]) -> Option<f64> {
    if curve.len() < 2 {
        return None;
    }

    let (t_last, d_last) = curve[curve.len() - 1];
    let (t_prev, d_prev) = curve[curve.len() - 2];

    let dt = t_last - t_prev;
    let dd = d_last - d_prev;

    if dt <= 0.0 || dd <= 0.0 {
        return None;
    }

    let velocity = dd / dt;
    let extra_dist = target_distance - d_last;
    Some(t_last + extra_dist / velocity)
}
