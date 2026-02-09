<script lang="ts">
	import type { SprintAnalysisResult } from '$lib/types.js';
	import HeroCard from './HeroCard.svelte';
	import MetricsCards from './MetricsCards.svelte';
	import SplitsTable from './SplitsTable.svelte';
	import AccelChart from './AccelChart.svelte';
	import VelocityChart from './VelocityChart.svelte';
	import GyroChart from './GyroChart.svelte';
	import DashboardCard from './DashboardCard.svelte';
	import DashboardModal from './DashboardModal.svelte';

	type PanelId = 'hero' | 'metrics' | 'splits' | 'accel' | 'velocity' | 'gyro';

	interface Props {
		result: SprintAnalysisResult;
	}

	let { result }: Props = $props();

	let expandedPanel: PanelId | null = $state(null);

	const hasVelocity = $derived(!!result.velocityData);
	const hasGyro = $derived(!!result.gyroData);

	function open(panel: PanelId) {
		expandedPanel = panel;
	}

	function close() {
		expandedPanel = null;
	}
</script>

<div class="dashboard-grid" class:no-velocity={!hasVelocity}>
	<DashboardCard label="Summary" onclick={() => open('hero')}>
		<HeroCard {result} compact />
	</DashboardCard>

	<DashboardCard label="Metrics" onclick={() => open('metrics')}>
		<MetricsCards meta={result.meta} velocityData={result.velocityData} compact />
	</DashboardCard>

	<DashboardCard label="Splits" onclick={() => open('splits')}>
		<SplitsTable splits={result.meta.splits} computedSplits={result.velocityData?.computedSplits ?? null} compact />
	</DashboardCard>

	<DashboardCard label="Acceleration" onclick={() => open('accel')}>
		<AccelChart {result} compact />
	</DashboardCard>

	{#if hasVelocity}
		<DashboardCard label="Velocity" onclick={() => open('velocity')}>
			<VelocityChart {result} compact />
		</DashboardCard>
	{/if}

	{#if hasGyro}
		<DashboardCard label="Gyroscope" wide={!hasVelocity} onclick={() => open('gyro')}>
			<GyroChart {result} compact />
		</DashboardCard>
	{/if}
</div>

<DashboardModal open={expandedPanel !== null} onclose={close}>
	{#if expandedPanel === 'hero'}
		<HeroCard {result} />
	{:else if expandedPanel === 'metrics'}
		<MetricsCards meta={result.meta} velocityData={result.velocityData} />
	{:else if expandedPanel === 'splits'}
		<SplitsTable splits={result.meta.splits} computedSplits={result.velocityData?.computedSplits ?? null} />
	{:else if expandedPanel === 'accel'}
		<AccelChart {result} />
	{:else if expandedPanel === 'velocity'}
		<VelocityChart {result} />
	{:else if expandedPanel === 'gyro'}
		<GyroChart {result} />
	{/if}
</DashboardModal>

<style>
	.dashboard-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: 1fr 2fr;
		gap: 0.5rem;
		flex: 1;
		min-height: 0;
	}
</style>
