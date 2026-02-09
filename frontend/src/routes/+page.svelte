<script lang="ts">
	import { onMount } from 'svelte';
	import { initWasm, ping, parseAndAnalyze } from '$lib/wasm.js';
	import { appState, getSelectedResult } from '$lib/state.svelte.js';
	import FileUpload from '../components/FileUpload.svelte';
	import SprintTable from '../components/SprintTable.svelte';
	import SprintDetail from '../components/SprintDetail.svelte';

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

	function handleSelect(index: number) {
		appState.selectedIndex = index;
	}
</script>

<header class="header">
	<h1>SprintZero Analyzer</h1>
	<p>Bidirectional sprint end detection</p>
</header>

<FileUpload onfile={handleFile} fileName={appState.fileName} />

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
