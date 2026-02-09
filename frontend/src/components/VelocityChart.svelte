<script lang="ts">
	import type { SprintAnalysisResult } from '$lib/types.js';
	import { renderVelocityChart } from '$lib/charts/velocity.js';

	interface Props {
		result: SprintAnalysisResult;
		compact?: boolean;
	}

	let { result, compact = false }: Props = $props();

	let el: HTMLElement;

	$effect(() => {
		if (el && result) {
			renderVelocityChart(el, result, { compact });
		}
	});
</script>

<div class="chart-container" class:compact bind:this={el}></div>

<style>
	.chart-container {
		width: 100%;
		height: 100%;
	}
	.chart-container.compact {
		position: absolute;
		inset: 0;
	}
	.chart-container:not(.compact) {
		min-height: 350px;
	}
</style>
