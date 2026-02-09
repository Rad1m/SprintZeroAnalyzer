<script lang="ts">
	import type { SprintAnalysisResult } from '$lib/types.js';

	interface Props {
		result: SprintAnalysisResult;
	}

	let { result }: Props = $props();

	function fmt(seconds: number): string {
		const total = Math.floor(seconds);
		const ms = Math.round((seconds - total) * 1000);
		if (total < 60) {
			return `${total}.${String(ms).padStart(3, '0')}`;
		}
		const min = Math.floor(total / 60);
		const sec = total % 60;
		return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
	}

	function gpsLabel(status: string): { text: string; color: string } | null {
		switch (status) {
			case 'verified': return { text: 'GPS Verified', color: '#39FF14' };
			case 'mismatch': return { text: 'GPS Mismatch', color: '#FF9F0A' };
			case 'unavailable': return { text: 'No GPS', color: '#484f58' };
			default: return null;
		}
	}

	const gpsBadge = $derived(gpsLabel(result.meta.gpsStatus));
</script>

<div class="card hero-card">
	<div class="hero-time">{fmt(result.finalDur)}</div>
	<div class="hero-distance">{result.distance}m</div>
	<div class="hero-badges">
		{#if result.meta.isFalseStart}
			<span class="false-start-badge">FALSE START</span>
		{/if}
		{#if gpsBadge}
			<span class="hero-badge" style:color={gpsBadge.color}>{gpsBadge.text}</span>
		{/if}
		{#if result.piecewiseFit}
			<span class="hero-badge" style:color="#FF9F0A">
				Fit: {fmt(result.piecewiseFit.bp2)} ({result.piecewiseFit.confidence})
			</span>
		{/if}
	</div>
</div>
