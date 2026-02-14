/**
 * Firestore REST API client for fetching debug_sessions.
 *
 * Uses the public REST API with the iOS API key — no Firebase SDK needed.
 * Requires Firestore security rules to allow read on debug_sessions.
 */

import { PUBLIC_FIREBASE_API_KEY, PUBLIC_FIREBASE_PROJECT_ID } from '$env/static/public';
import { decodeCompactCurvePayload } from './compact-curve.js';
import type { ParsedSprint, SprintMeta } from './types.js';

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// ---------- Firestore REST response types ----------

interface FirestoreValue {
	stringValue?: string;
	integerValue?: string;   // Firestore REST returns integers as strings
	doubleValue?: number;
	booleanValue?: boolean;
	timestampValue?: string;
	bytesValue?: string;     // base64-encoded
	nullValue?: null;
	mapValue?: { fields: Record<string, FirestoreValue> };
	arrayValue?: { values?: FirestoreValue[] };
}

interface FirestoreDocument {
	name: string;
	fields: Record<string, FirestoreValue>;
	createTime: string;
	updateTime: string;
}

interface FirestoreListResponse {
	documents?: FirestoreDocument[];
	nextPageToken?: string;
}

// ---------- Value extractors ----------

function getString(v: FirestoreValue | undefined): string {
	return v?.stringValue ?? '';
}

function getNumber(v: FirestoreValue | undefined): number {
	if (v?.doubleValue !== undefined) return v.doubleValue;
	if (v?.integerValue !== undefined) return Number(v.integerValue);
	return 0;
}

function getTimestamp(v: FirestoreValue | undefined): string {
	if (v?.timestampValue) {
		return v.timestampValue.split('T')[0]; // "2025-01-30"
	}
	return 'unknown';
}

function getBytes(v: FirestoreValue | undefined): Uint8Array | null {
	if (!v?.bytesValue) return null;
	const binary = atob(v.bytesValue);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function getMap(v: FirestoreValue | undefined): Record<string, FirestoreValue> {
	return v?.mapValue?.fields ?? {};
}

function getArray(v: FirestoreValue | undefined): FirestoreValue[] {
	return v?.arrayValue?.values ?? [];
}

// ---------- Public API ----------

export async function fetchSessions(): Promise<ParsedSprint[]> {
	const url = `${BASE_URL}/debug_sessions?key=${PUBLIC_FIREBASE_API_KEY}&orderBy=sessionDate desc&pageSize=50`;

	const response = await fetch(url);
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Firestore API error ${response.status}: ${text}`);
	}

	const data: FirestoreListResponse = await response.json();
	if (!data.documents || data.documents.length === 0) {
		throw new Error('No debug sessions found in Firestore');
	}

	const allSprints: ParsedSprint[] = [];
	let globalIndex = 0;

	for (const doc of data.documents) {
		const fields = doc.fields;
		const dateStr = getTimestamp(fields.sessionDate);
		const curvesMap = getMap(fields.curves);
		const sprintsArray = getArray(fields.sprints);

		for (const sprintVal of sprintsArray) {
			const sprintFields = getMap(sprintVal);
			const sprintId = getString(sprintFields.id);
			const distance = getNumber(sprintFields.distance);

			// Look up the curve blob for this sprint
			const curveValue = curvesMap[sprintId];
			const curveBytes = getBytes(curveValue);

			if (!curveBytes) {
				// Skip sprints without curve data — can't analyze without sensor data
				continue;
			}

			const { accel, gyro } = decodeCompactCurvePayload(curveBytes);

			if (accel.length === 0) continue;

			const meta: SprintMeta = {
				reactionTime: getNumber(sprintFields.reactionTime) || null,
				isFalseStart: false,
				peakPropulsiveG: null,
				avgPropulsiveG: null,
				maxGForce: getNumber(sprintFields.maxGForce) || null,
				avgCadence: getNumber(sprintFields.avgCadence) || null,
				stepCount: getNumber(sprintFields.stepCount) || null,
				avgStrideLength: getNumber(sprintFields.avgStrideLength) || null,
				maxVelocity: getNumber(sprintFields.maxVelocity) || null,
				timeToMaxVelocity: null,
				armDriveFocus: null,
				peakArmVelocity: null,
				gpsStatus: 'none',
				splits: [],
			};

			const sprint: ParsedSprint = {
				index: globalIndex++,
				date: dateStr,
				distance,
				accel,
				gyro,
				meta,
			};

			allSprints.push(sprint);
		}
	}

	if (allSprints.length === 0) {
		throw new Error('No sprints with curve data found in Firestore sessions');
	}

	return allSprints;
}
