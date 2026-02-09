import type { SprintAnalysisResult } from '../types.js';

declare const Plotly: any;

const BASE_LAYOUT = {
	paper_bgcolor: '#0d1117',
	plot_bgcolor: '#161b22',
	font: { color: '#e5e5e5', family: 'JetBrains Mono, monospace', size: 12 },
	margin: { t: 40, r: 60, b: 50, l: 60 },
	xaxis: {
		title: 'Time (s)',
		gridcolor: '#21262d',
		zerolinecolor: '#30363d',
		color: '#8b949e'
	},
	yaxis: {
		gridcolor: '#21262d',
		zerolinecolor: '#30363d',
		color: '#8b949e'
	},
	hovermode: 'x unified' as const
};

const PLOTLY_CONFIG = {
	responsive: true,
	displayModeBar: true,
	modeBarButtonsToRemove: ['lasso2d', 'select2d']
};

export function renderVelocityChart(el: HTMLElement, result: SprintAnalysisResult): void {
	const vd = result.velocityData;
	if (!vd) {
		Plotly.purge(el);
		return;
	}

	// Velocity curve trace
	const velocityTrace = {
		type: 'scattergl',
		x: vd.t,
		y: vd.velocity,
		mode: 'lines',
		line: { color: '#0A84FF', width: 2 },
		name: 'Velocity',
		yaxis: 'y',
		hovertemplate: '%{y:.2f} m/s<extra></extra>'
	};

	// Distance curve on secondary y-axis
	const distanceTrace = {
		type: 'scattergl',
		x: vd.t,
		y: vd.distance,
		mode: 'lines',
		line: { color: 'rgba(57, 255, 20, 0.4)', width: 1.5 },
		name: 'Distance',
		yaxis: 'y2',
		hovertemplate: '%{y:.1f} m<extra></extra>'
	};

	// Split markers — scatter at each 10m split time
	const splitTimes: number[] = [];
	const splitVelocities: number[] = [];
	const splitLabels: string[] = [];

	for (const split of vd.computedSplits) {
		splitTimes.push(split.time);
		splitVelocities.push(split.segmentVelocity);
		splitLabels.push(`${split.distanceMark}m`);
	}

	const splitTrace = {
		type: 'scatter',
		x: splitTimes,
		y: splitVelocities,
		mode: 'markers+text',
		marker: { color: '#FFD60A', size: 8, symbol: 'diamond' },
		text: splitLabels,
		textposition: 'top center',
		textfont: { color: '#FFD60A', size: 9 },
		name: 'Splits',
		yaxis: 'y',
		hovertemplate: '%{text}: %{y:.2f} m/s<extra></extra>'
	};

	const traces: any[] = [velocityTrace, distanceTrace, splitTrace];

	// Annotations for max velocity
	const annotations: any[] = [
		{
			x: vd.timeToMaxVelocity,
			y: vd.maxVelocity,
			text: `Vmax: ${vd.maxVelocity.toFixed(1)} m/s`,
			showarrow: true,
			arrowhead: 2,
			arrowcolor: '#FF9F0A',
			font: { color: '#FF9F0A', size: 11 },
			bgcolor: 'rgba(13, 17, 23, 0.8)',
			bordercolor: '#FF9F0A',
			borderwidth: 1,
			ax: 40,
			ay: -30
		}
	];

	// Vertical line at sprint end
	const shapes: any[] = [
		{
			type: 'line',
			x0: result.finalDur,
			x1: result.finalDur,
			y0: 0,
			y1: vd.maxVelocity * 1.15,
			line: { color: '#ffffff', width: 2, dash: 'dash' }
		}
	];

	const title = `Velocity \u2014 Vmax: ${vd.maxVelocity.toFixed(1)} m/s @ ${vd.timeToMaxVelocity.toFixed(2)}s \u2014 Scale: ${vd.scaleFactor.toFixed(2)}`;

	const layout = {
		...BASE_LAYOUT,
		title: { text: title, font: { color: '#f0f0f0', size: 14 } },
		yaxis: {
			...BASE_LAYOUT.yaxis,
			title: 'Velocity (m/s)',
			rangemode: 'tozero'
		},
		yaxis2: {
			title: 'Distance (m)',
			overlaying: 'y',
			side: 'right',
			gridcolor: 'rgba(0,0,0,0)',
			zerolinecolor: '#30363d',
			color: '#39FF14',
			rangemode: 'tozero'
		},
		showlegend: true,
		legend: { x: 0, xanchor: 'left', y: 1, bgcolor: 'rgba(0,0,0,0)', font: { size: 10 } },
		shapes,
		annotations
	};

	Plotly.react(el, traces, layout, PLOTLY_CONFIG);
}
