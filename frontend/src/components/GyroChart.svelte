<script lang="ts">
	import type { SprintAnalysisResult } from '$lib/types.js';
	import { renderGyroChart } from '$lib/charts/gyro.js';

	interface Props {
		result: SprintAnalysisResult;
	}

	let { result }: Props = $props();

	let el: HTMLElement;

	$effect(() => {
		if (el && result) {
			renderGyroChart(el, result);
		}
	});
</script>

<div class="chart-box" bind:this={el}></div>
