<script lang="ts">
	import type { SprintMeta, VelocityData } from '$lib/types.js';

	interface Props {
		meta: SprintMeta;
		velocityData?: VelocityData | null;
	}

	let { meta, velocityData = null }: Props = $props();

	function fmtFixed(val: number | null, digits = 2): string {
		if (val == null) return '--';
		return val.toFixed(digits);
	}

	function armDriveGrade(score: number | null): { label: string; color: string } | null {
		if (score == null) return null;
		if (score >= 0.85) return { label: 'Optimal', color: '#39FF14' };
		if (score >= 0.65) return { label: 'Efficient', color: '#39FF14' };
		if (score >= 0.45) return { label: 'Loose', color: '#FF9F0A' };
		return { label: 'Unstable', color: '#FF3B30' };
	}

	interface MetricRow {
		label: string;
		value: string;
		color?: string;
		extra?: string;
		badge?: { label: string; color: string };
	}

	const rows = $derived.by(() => {
		const m = meta;
		const r: MetricRow[] = [];

		if (m.reactionTime != null) {
			r.push({
				label: 'Reaction Time',
				value: fmtFixed(m.reactionTime, 3) + 's',
				color: m.isFalseStart ? '#FF3B30' : undefined
			});
		}
		if (m.peakPropulsiveG != null) {
			r.push({ label: 'Drive Force', value: fmtFixed(m.peakPropulsiveG, 1) + 'G' });
		}
		if (m.maxGForce != null) {
			r.push({ label: 'Impact Intensity', value: fmtFixed(m.maxGForce, 1) + 'G' });
		}
		if (m.avgCadence != null) {
			r.push({ label: 'Cadence', value: m.avgCadence + ' spm' });
		}
		if (m.stepCount != null) {
			r.push({ label: 'Total Steps', value: String(m.stepCount) });
		}
		if (m.avgStrideLength != null) {
			r.push({ label: 'Stride Length', value: fmtFixed(m.avgStrideLength, 2) + 'm' });
		}
		// Prefer metadata velocity, fall back to computed
		const maxV = m.maxVelocity ?? velocityData?.maxVelocity ?? null;
		const ttmv = m.timeToMaxVelocity ?? velocityData?.timeToMaxVelocity ?? null;
		const isComputed = m.maxVelocity == null && velocityData?.maxVelocity != null;

		if (maxV != null) {
			const kmh = (maxV * 3.6).toFixed(1);
			r.push({
				label: isComputed ? 'Max Velocity (IMU)' : 'Max Velocity',
				value: fmtFixed(maxV, 1) + ' m/s',
				extra: kmh + ' km/h'
			});
		}
		if (ttmv != null) {
			r.push({ label: 'Time to Max', value: fmtFixed(ttmv, 2) + 's' });
		}
		if (m.armDriveFocus != null) {
			const grade = armDriveGrade(m.armDriveFocus)!;
			r.push({
				label: 'Arm Drive Focus',
				value: (m.armDriveFocus * 100).toFixed(0) + '%',
				badge: grade
			});
		}
		if (m.peakArmVelocity != null) {
			r.push({ label: 'Peak Arm Velocity', value: fmtFixed(m.peakArmVelocity, 1) + ' rad/s' });
		}

		return r;
	});
</script>

{#if rows.length > 0}
	<div class="card metrics-card">
		{#each rows as row, i}
			{#if i > 0}
				<div class="metric-divider"></div>
			{/if}
			<div class="metric-row">
				<span class="metric-label">{row.label}</span>
				<span class="metric-value" style:color={row.color}>{row.value}</span>
				{#if row.extra}
					<span class="metric-extra">{row.extra}</span>
				{/if}
				{#if row.badge}
					<span class="metric-badge" style:background={row.badge.color}>{row.badge.label}</span>
				{/if}
			</div>
		{/each}
	</div>
{/if}
