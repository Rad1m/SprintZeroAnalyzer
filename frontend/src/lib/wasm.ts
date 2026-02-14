import init, {
	ping as wasmPing,
	parse_falcata as wasmParse,
	analyze_sprint as wasmAnalyze,
	parse_and_analyze as wasmParseAndAnalyze
} from 'falcata-wasm';
import type { SprintAnalysisResult } from './types.js';

let initialized = false;

export async function initWasm(): Promise<void> {
	if (initialized) return;
	await init();
	initialized = true;
}

export function ping(): string {
	return wasmPing();
}

export function parseFalcata(jsonStr: string): unknown {
	return wasmParse(jsonStr);
}

export function analyzeSprint(sprintJson: string): unknown {
	return wasmAnalyze(sprintJson);
}

export function parseAndAnalyze(jsonStr: string): SprintAnalysisResult[] {
	return wasmParseAndAnalyze(jsonStr) as SprintAnalysisResult[];
}
