<script lang="ts">
	import type { SprintAnalysisResult } from '$lib/types.js';

	interface Props {
		results: SprintAnalysisResult[];
		selectedIndex: number;
		onselect: (index: number) => void;
	}

	let { results, selectedIndex, onselect }: Props = $props();

	function decisionColor(decision: string): string {
		if (decision === 'agree') return '#39FF14';
		return '#FF9F0A';
	}
</script>

{#if results.length > 0}
	<div class="table-container">
		<table class="results-table">
			<thead>
				<tr>
					<th>#</th>
					<th>Date</th>
					<th>Dist</th>
					<th>Fwd (s)</th>
					<th>Bwd (s)</th>
					<th>Gap</th>
					<th>Decision</th>
					<th>Final (s)</th>
				</tr>
			</thead>
			<tbody>
				{#each results as r, i}
					<tr
						class:selected={i === selectedIndex}
						onclick={() => onselect(i)}
					>
						<td>{r.index}</td>
						<td>{r.date}</td>
						<td>{r.distance}</td>
						<td>{r.fwdDur.toFixed(2)}</td>
						<td>{r.bwdDur.toFixed(2)}</td>
						<td>{r.gap.toFixed(2)}</td>
						<td style:color={decisionColor(r.decision)}>{r.decision}</td>
						<td>{r.finalDur.toFixed(2)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
