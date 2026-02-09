<script lang="ts">
	import type { SprintAnalysisResult } from '$lib/types.js';
	import HeroCard from './HeroCard.svelte';
	import MetricsCards from './MetricsCards.svelte';
	import SplitsTable from './SplitsTable.svelte';
	import AccelChart from './AccelChart.svelte';
	import VelocityChart from './VelocityChart.svelte';
	import GyroChart from './GyroChart.svelte';

	interface Props {
		result: SprintAnalysisResult;
	}

	let { result }: Props = $props();
</script>

<HeroCard {result} />
<MetricsCards meta={result.meta} velocityData={result.velocityData} />
<SplitsTable splits={result.meta.splits} computedSplits={result.velocityData?.computedSplits ?? null} />
<AccelChart {result} />
{#if result.velocityData}
	<VelocityChart {result} />
{/if}
<GyroChart {result} />
