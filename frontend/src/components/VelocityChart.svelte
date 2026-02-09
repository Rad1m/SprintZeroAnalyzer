<script lang="ts">
	import type { SprintAnalysisResult } from '$lib/types.js';
	import { renderVelocityChart } from '$lib/charts/velocity.js';

	interface Props {
		result: SprintAnalysisResult;
	}

	let { result }: Props = $props();

	let el: HTMLElement;

	$effect(() => {
		if (el && result) {
			renderVelocityChart(el, result);
		}
	});
</script>

<div class="chart-box" bind:this={el}></div>
