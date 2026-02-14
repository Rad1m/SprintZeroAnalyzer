<script lang="ts">
	import { onMount } from 'svelte';
	import { initWasm, ping, parseAndAnalyze, analyzeSprint } from '$lib/wasm.js';
	import { appState, getSelectedResult } from '$lib/state.svelte.js';
	import { fetchSessions } from '$lib/firestore-api.js';
	import FileUpload from '../components/FileUpload.svelte';
	import FirestoreButton from '../components/FirestoreButton.svelte';
	import SprintTable from '../components/SprintTable.svelte';
	import SprintDetail from '../components/SprintDetail.svelte';
	import type { SprintAnalysisResult } from '$lib/types.js';

	onMount(async () => {
		try {
			await initWasm();
			appState.wasmReady = true;
			appState.status = ping();
		} catch (e) {
			appState.status = `WASM init failed: ${e}`;
		}
	});

	function handleFile(file: File) {
		appState.status = `Reading ${file.name}...`;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const text = e.target?.result as string;
				appState.status = `Analyzing ${file.name}...`;

				const results = parseAndAnalyze(text);

				if (results.length === 0) {
					appState.status = `No sprints with sensor data found in ${file.name}`;
					appState.results = [];
					appState.selectedIndex = -1;
					appState.fileName = '';
					return;
				}

				appState.results = results;
				appState.fileName = file.name;
				appState.selectedIndex = 0;
				appState.status = `${file.name} — ${results.length} sprint(s)`;
			} catch (err) {
				appState.status = `Error: ${err instanceof Error ? err.message : err}`;
				appState.results = [];
				appState.selectedIndex = -1;
				appState.fileName = '';
			}
		};
		reader.onerror = () => { appState.status = 'Error reading file'; };
		reader.readAsText(file);
	}

	async function handleFirestore() {
		appState.isLoading = true;
		appState.status = 'Fetching from Firestore...';

		try {
			const sprints = await fetchSessions();

			appState.status = `Analyzing ${sprints.length} sprint(s)...`;

			const results: SprintAnalysisResult[] = [];
			for (const sprint of sprints) {
				const result = analyzeSprint(JSON.stringify(sprint)) as SprintAnalysisResult;
				results.push(result);
			}

			if (results.length === 0) {
				appState.status = 'No analyzable sprints found in Firestore';
				appState.results = [];
				appState.selectedIndex = -1;
				appState.fileName = '';
				return;
			}

			appState.results = results;
			appState.fileName = 'Firestore';
			appState.selectedIndex = 0;
			appState.status = `Firestore — ${results.length} sprint(s)`;
		} catch (err) {
			appState.status = `Firestore error: ${err instanceof Error ? err.message : err}`;
		} finally {
			appState.isLoading = false;
		}
	}

	function handleSelect(index: number) {
		appState.selectedIndex = index;
	}
</script>

<header class="header">
	<h1>SprintZero Analyzer</h1>
	<p>Bidirectional sprint end detection</p>
</header>

<div class="load-section">
	<FileUpload onfile={handleFile} fileName={appState.fileName} />
	{#if !appState.fileName}
		<FirestoreButton
			onclick={handleFirestore}
			loading={appState.isLoading}
			disabled={!appState.wasmReady}
		/>
	{/if}
</div>

<SprintTable
	results={appState.results}
	selectedIndex={appState.selectedIndex}
	onselect={handleSelect}
/>

{#if getSelectedResult()}
	<div class="dashboard-wrapper">
		<SprintDetail result={getSelectedResult()!} />
	</div>
{/if}

<div class="status-bar">{appState.status}</div>

<style>
	.load-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.load-section :global(.upload-zone),
	.load-section :global(.file-info) {
		width: 100%;
	}
</style>
