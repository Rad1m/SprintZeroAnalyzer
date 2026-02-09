use serde::{Deserialize, Serialize};

/// Raw acceleration sample from sensor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccelerationSample {
    pub timestamp: f64,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// Raw gyroscope sample from sensor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GyroscopeSample {
    pub timestamp: f64,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// A parsed sprint with decoded sensor curves and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSprint {
    pub index: usize,
    pub date: String,
    pub distance: u32,
    pub accel: Vec<AccelerationSample>,
    pub gyro: Vec<GyroscopeSample>,
    pub meta: SprintMeta,
}

/// Pre-computed metadata from .sprintzero file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SprintMeta {
    pub reaction_time: Option<f64>,
    pub is_false_start: bool,
    pub peak_propulsive_g: Option<f64>,
    pub avg_propulsive_g: Option<f64>,
    pub max_g_force: Option<f64>,
    pub avg_cadence: Option<f64>,
    pub step_count: Option<u32>,
    pub avg_stride_length: Option<f64>,
    pub max_velocity: Option<f64>,
    pub time_to_max_velocity: Option<f64>,
    pub arm_drive_focus: Option<f64>,
    pub peak_arm_velocity: Option<f64>,
    pub gps_status: String,
    pub splits: Vec<SplitTime>,
}

/// Split time at a distance mark
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitTime {
    pub distance_mark: f64,
    pub time: f64,
    pub segment_velocity: f64,
}

/// Detection result from bidirectional algorithm
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectionResult {
    pub fwd_dur: f64,
    pub bwd_dur: f64,
    pub final_dur: f64,
    pub gap: f64,
    pub decision: String,
    pub sprint_level: f64,
    pub threshold: f64,
}

/// Plot data for the acceleration chart
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlotData {
    pub t: Vec<f64>,
    pub rolling: Vec<Option<f64>>,
    pub raw_mag: Vec<f64>,
    pub sprint_level: f64,
    pub threshold: f64,
    pub fwd_time: f64,
    pub bwd_time: f64,
    pub final_time: f64,
}

/// Gyroscope plot data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GyroData {
    pub t: Vec<f64>,
    pub x: Vec<f64>,
    pub y: Vec<f64>,
    pub z: Vec<f64>,
    pub dominant_axis: String,
}

/// Piecewise linear fit result (3-phase: accel → fly → decel)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PiecewiseFitResult {
    /// End of acceleration phase / start of fly (relative to sprint start)
    pub bp1: f64,
    /// End of fly / start of deceleration = sprint end (relative to sprint start)
    pub bp2: f64,
    /// Fit parameters: y0 (intercept), s1 (accel slope), s2 (fly slope), s3 (decel slope)
    pub y0: f64,
    pub s1: f64,
    pub s2: f64,
    pub s3: f64,
    /// Average acceleration during fly phase
    pub sprint_level: f64,
    /// Confidence: "high", "medium", or "low"
    pub confidence: String,
}

/// Velocity/distance profile data for charts
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VelocityData {
    /// Time points (relative to sprint start)
    pub t: Vec<f64>,
    /// Velocity in m/s at each time point
    pub velocity: Vec<f64>,
    /// Cumulative distance in meters at each time point
    pub distance: Vec<f64>,
    /// Maximum velocity in m/s
    pub max_velocity: f64,
    /// Time to maximum velocity (relative to sprint start)
    pub time_to_max_velocity: f64,
    /// Scale factor applied (known_distance / integrated_distance)
    pub scale_factor: f64,
    /// Computed 10m split times (from IMU integration)
    pub computed_splits: Vec<SplitTime>,
}

/// Full analysis result for a single sprint
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SprintAnalysisResult {
    pub index: usize,
    pub date: String,
    pub distance: u32,
    pub fwd_dur: f64,
    pub bwd_dur: f64,
    pub final_dur: f64,
    pub gap: f64,
    pub decision: String,
    pub meta: SprintMeta,
    pub plot_data: PlotData,
    pub gyro_data: Option<GyroData>,
    pub piecewise_fit: Option<PiecewiseFitResult>,
    pub velocity_data: Option<VelocityData>,
}
