<script lang="ts">
	import { onMount } from 'svelte';
	import type { SprintAnalysisResult } from '$lib/types.js';
	import { renderAccelChart } from '$lib/charts/accel.js';

	interface Props {
		result: SprintAnalysisResult;
	}

	let { result }: Props = $props();

	let el: HTMLElement;

	$effect(() => {
		if (el && result) {
			renderAccelChart(el, result);
		}
	});
</script>

<div class="chart-box" bind:this={el}></div>
