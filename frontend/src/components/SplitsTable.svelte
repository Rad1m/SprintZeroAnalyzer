<script lang="ts">
	import type { SplitTime } from '$lib/types.js';

	interface Props {
		splits: SplitTime[];
		computedSplits?: SplitTime[] | null;
	}

	let { splits, computedSplits = null }: Props = $props();

	// Prefer pre-computed (from .sprintzero meta), fall back to IMU-computed
	const activeSplits = $derived(splits.length > 0 ? splits : (computedSplits ?? []));
	const isComputed = $derived(splits.length === 0 && (computedSplits?.length ?? 0) > 0);
</script>

{#if activeSplits.length > 0}
	<div class="card">
		<h3 class="card-title">Splits{isComputed ? ' (IMU)' : ''}</h3>
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
