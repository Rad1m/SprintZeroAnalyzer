/**
 * CompactCurvePayload decoder — TypeScript port of Python firestore_loader.py.
 *
 * Binary format (v3):
 *   [0]     version (uint8)
 *   [1..2]  accelCount (uint16 LE)
 *   [3..4]  gyroCount (uint16 LE)
 *   [5..6]  smoothedCount (uint16 LE)  (v3+)
 *   [7..8]  cycleCount (uint16 LE)     (v3+)
 *   [9..]   samples: each is 4 x float32 LE (timestamp, x, y, z) = 16 bytes
 *           then cycleCount x float32 LE amplitudes
 *
 * The blob is raw-deflate compressed (Apple COMPRESSION_ZLIB = raw deflate, wbits=-15).
 */

import { inflateRaw } from 'pako';
import type { AccelerationSample, GyroscopeSample } from './types.js';

export interface DecodedCurves {
	accel: AccelerationSample[];
	gyro: GyroscopeSample[];
}

export function decodeCompactCurvePayload(compressed: Uint8Array): DecodedCurves {
	const data = inflateRaw(compressed);
	if (data.length < 9) {
		throw new Error(`Payload too short: ${data.length} bytes`);
	}

	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

	const version = data[0];
	if (version < 1 || version > 3) {
		throw new Error(`Unknown CompactCurvePayload version: ${version}`);
	}

	const accelCount = view.getUint16(1, true);
	const gyroCount = view.getUint16(3, true);

	let offset: number;
	if (version >= 3) {
		// smoothedCount and cycleCount exist but we skip them for ParsedSprint
		offset = 9;
	} else {
		offset = 5;
	}

	function readSamples(count: number): { timestamp: number; x: number; y: number; z: number }[] {
		const samples: { timestamp: number; x: number; y: number; z: number }[] = [];
		for (let i = 0; i < count; i++) {
			samples.push({
				timestamp: view.getFloat32(offset, true),
				x: view.getFloat32(offset + 4, true),
				y: view.getFloat32(offset + 8, true),
				z: view.getFloat32(offset + 12, true),
			});
			offset += 16;
		}
		return samples;
	}

	const accel = readSamples(accelCount);
	const gyro = readSamples(gyroCount);

	return { accel, gyro };
}
