/** Mirrors Rust types from rust/src/types.rs */

export interface AccelerationSample {
	timestamp: number;
	x: number;
	y: number;
	z: number;
}

export interface GyroscopeSample {
	timestamp: number;
	x: number;
	y: number;
	z: number;
}

export interface SplitTime {
	distanceMark: number;
	time: number;
	segmentVelocity: number;
}

export interface SprintMeta {
	reactionTime: number | null;
	isFalseStart: boolean;
	peakPropulsiveG: number | null;
	avgPropulsiveG: number | null;
	maxGForce: number | null;
	avgCadence: number | null;
	stepCount: number | null;
	avgStrideLength: number | null;
	maxVelocity: number | null;
	timeToMaxVelocity: number | null;
	armDriveFocus: number | null;
	peakArmVelocity: number | null;
	gpsStatus: string;
	splits: SplitTime[];
}

export interface ParsedSprint {
	index: number;
	date: string;
	distance: number;
	accel: AccelerationSample[];
	gyro: GyroscopeSample[];
	meta: SprintMeta;
}

export interface PlotData {
	t: number[];
	rolling: (number | null)[];
	rawMag: number[];
	sprintLevel: number;
	threshold: number;
	fwdTime: number;
	bwdTime: number;
	finalTime: number;
}

export interface GyroData {
	t: number[];
	x: number[];
	y: number[];
	z: number[];
	dominantAxis: string;
}

export interface PiecewiseFitResult {
	bp1: number;
	bp2: number;
	y0: number;
	s1: number;
	s2: number;
	s3: number;
	sprintLevel: number;
	confidence: string;
}

export interface VelocityData {
	t: number[];
	velocity: number[];
	distance: number[];
	maxVelocity: number;
	timeToMaxVelocity: number;
	scaleFactor: number;
	computedSplits: SplitTime[];
}

export interface SprintAnalysisResult {
	index: number;
	date: string;
	distance: number;
	fwdDur: number;
	bwdDur: number;
	finalDur: number;
	gap: number;
	decision: string;
	meta: SprintMeta;
	plotData: PlotData;
	gyroData: GyroData | null;
	piecewiseFit: PiecewiseFitResult | null;
	velocityData: VelocityData | null;
}
