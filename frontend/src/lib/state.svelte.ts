import type { SprintAnalysisResult } from './types.js';

/** Global reactive state */

export const appState = $state({
	/** Name of the currently loaded file */
	fileName: '',
	/** Analysis results for all sprints in the file */
	results: [] as SprintAnalysisResult[],
	/** Index of the currently selected sprint */
	selectedIndex: -1,
	/** Status bar text */
	status: 'Drop a .sprintzero file to begin',
	/** Whether WASM is initialized */
	wasmReady: false,
});

/** The currently selected sprint result */
export function getSelectedResult(): SprintAnalysisResult | null {
	return appState.selectedIndex >= 0 && appState.selectedIndex < appState.results.length
		? appState.results[appState.selectedIndex]
		: null;
}
