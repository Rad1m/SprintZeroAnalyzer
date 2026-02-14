<script lang="ts">
	import type { SplitTime } from '$lib/types.js';

	interface Props {
		splits: SplitTime[];
		computedSplits?: SplitTime[] | null;
		compact?: boolean;
	}

	let { splits, computedSplits = null, compact = false }: Props = $props();

	// Prefer pre-computed (from .falcata meta), fall back to IMU-computed
	const activeSplits = $derived(splits.length > 0 ? splits : (computedSplits ?? []));
	const isComputed = $derived(splits.length === 0 && (computedSplits?.length ?? 0) > 0);
</script>

{#if activeSplits.length > 0}
	<div class:card={!compact} class:compact>
		{#if !compact}
			<h3 class="card-title">Splits{isComputed ? ' (IMU)' : ''}</h3>
		{/if}
		<div class="splits-scroll">
			<table class="splits-table">
				<thead>
					<tr>
						<th>Dist</th>
						<th>Time</th>
						<th>Split</th>
						<th>Velocity</th>
					</tr>
				</thead>
				<tbody>
					{#each activeSplits as s, i}
						{@const segTime = i === 0 ? s.time : s.time - activeSplits[i - 1].time}
						<tr>
							<td class="split-dist">{s.distanceMark}m</td>
							<td class="split-time">{s.time.toFixed(3)}</td>
							<td class="split-seg">{segTime.toFixed(3)}</td>
							<td class="split-vel">{s.segmentVelocity.toFixed(1)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}

<style>
	.compact .splits-table {
		font-size: 0.7rem;
	}
	.compact .splits-table th,
	.compact .splits-table td {
		padding: 0.2rem 0.35rem;
	}
	.compact .splits-scroll {
		overflow: auto;
	}
	.compact {
		padding: 0.5rem;
		overflow: hidden;
		height: 100%;
		display: flex;
		flex-direction: column;
	}
</style>
