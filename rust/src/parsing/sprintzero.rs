use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde::Deserialize;
use crate::types::{AccelerationSample, GyroscopeSample, ParsedSprint, SplitTime, SprintMeta};

/// Top-level .sprintzero JSON structure
#[derive(Deserialize)]
struct SprintZeroFile {
    sessions: Vec<Session>,
}

#[derive(Deserialize)]
struct Session {
    date: String,
    sprints: Option<Vec<Sprint>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Sprint {
    distance: Option<u32>,
    acceleration_curve: Option<String>,
    gyroscope_curve: Option<String>,
    reaction_time: Option<f64>,
    is_false_start: Option<bool>,
    peak_propulsive_g: Option<f64>,
    avg_propulsive_g: Option<f64>,
    max_g_force: Option<f64>,
    avg_cadence: Option<f64>,
    step_count: Option<u32>,
    avg_stride_length: Option<f64>,
    max_velocity: Option<f64>,
    time_to_max_velocity: Option<f64>,
    arm_drive_focus: Option<f64>,
    peak_arm_velocity: Option<f64>,
    gps_verification_status: Option<String>,
    split_times_data: Option<String>,
}

/// Raw sensor sample as stored in base64-encoded JSON
#[derive(Deserialize)]
struct RawSample {
    timestamp: f64,
    x: f64,
    y: f64,
    z: f64,
}

fn decode_accel(encoded: &str) -> Result<Vec<AccelerationSample>, String> {
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|e| format!("Base64 decode error: {e}"))?;
    let samples: Vec<RawSample> = serde_json::from_slice(&bytes)
        .map_err(|e| format!("JSON parse error in curve: {e}"))?;
    let mut result: Vec<AccelerationSample> = samples.into_iter()
        .map(AccelerationSample::from)
        .collect();
    result.sort_by(|a, b| a.timestamp.partial_cmp(&b.timestamp).unwrap_or(std::cmp::Ordering::Equal));
    Ok(result)
}

fn decode_gyro(encoded: &str) -> Result<Vec<GyroscopeSample>, String> {
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|e| format!("Base64 decode error: {e}"))?;
    let samples: Vec<RawSample> = serde_json::from_slice(&bytes)
        .map_err(|e| format!("JSON parse error in curve: {e}"))?;
    let mut result: Vec<GyroscopeSample> = samples.into_iter()
        .map(GyroscopeSample::from)
        .collect();
    result.sort_by(|a, b| a.timestamp.partial_cmp(&b.timestamp).unwrap_or(std::cmp::Ordering::Equal));
    Ok(result)
}

impl From<RawSample> for AccelerationSample {
    fn from(s: RawSample) -> Self {
        Self { timestamp: s.timestamp, x: s.x, y: s.y, z: s.z }
    }
}

impl From<RawSample> for GyroscopeSample {
    fn from(s: RawSample) -> Self {
        Self { timestamp: s.timestamp, x: s.x, y: s.y, z: s.z }
    }
}

fn decode_splits(encoded: &str) -> Vec<SplitTime> {
    let bytes = match STANDARD.decode(encoded) {
        Ok(b) => b,
        Err(_) => return Vec::new(),
    };
    serde_json::from_slice(&bytes).unwrap_or_default()
}

pub fn parse(json_str: &str) -> Result<Vec<ParsedSprint>, String> {
    let file: SprintZeroFile = serde_json::from_str(json_str)
        .map_err(|e| format!("Invalid .sprintzero JSON: {e}"))?;

    let mut results = Vec::new();
    let mut index = 0usize;

    for session in &file.sessions {
        let session_date = if session.date.len() >= 10 {
            session.date[..10].to_string()
        } else {
            session.date.clone()
        };

        let sprints = match &session.sprints {
            Some(s) => s,
            None => continue,
        };

        for sprint in sprints {
            let distance = sprint.distance.unwrap_or(0);
            if distance < 60 {
                continue;
            }

            let accel_encoded = match &sprint.acceleration_curve {
                Some(s) => s,
                None => continue,
            };
            let gyro_encoded = match &sprint.gyroscope_curve {
                Some(s) => s,
                None => continue,
            };

            let accel = decode_accel(accel_encoded)?;
            let gyro = decode_gyro(gyro_encoded)?;

            if accel.len() < 100 {
                continue;
            }

            index += 1;

            let splits = sprint.split_times_data
                .as_deref()
                .map(decode_splits)
                .unwrap_or_default();

            let meta = SprintMeta {
                reaction_time: sprint.reaction_time,
                is_false_start: sprint.is_false_start.unwrap_or(false),
                peak_propulsive_g: sprint.peak_propulsive_g,
                avg_propulsive_g: sprint.avg_propulsive_g,
                max_g_force: sprint.max_g_force,
                avg_cadence: sprint.avg_cadence,
                step_count: sprint.step_count,
                avg_stride_length: sprint.avg_stride_length,
                max_velocity: sprint.max_velocity,
                time_to_max_velocity: sprint.time_to_max_velocity,
                arm_drive_focus: sprint.arm_drive_focus,
                peak_arm_velocity: sprint.peak_arm_velocity,
                gps_status: sprint.gps_verification_status.clone()
                    .unwrap_or_else(|| "notApplicable".to_string()),
                splits,
            };

            results.push(ParsedSprint {
                index,
                date: session_date.clone(),
                distance,
                accel,
                gyro,
                meta,
            });
        }
    }

    Ok(results)
}
