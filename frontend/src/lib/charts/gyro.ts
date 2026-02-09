import type { SprintAnalysisResult } from '../types.js';

declare const Plotly: any;

const BASE_LAYOUT = {
	paper_bgcolor: '#0d1117',
	plot_bgcolor: '#161b22',
	font: { color: '#e5e5e5', family: 'JetBrains Mono, monospace', size: 12 },
	margin: { t: 40, r: 20, b: 50, l: 60 },
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

export function renderGyroChart(el: HTMLElement, result: SprintAnalysisResult): void {
	const gd = result.gyroData;
	if (!gd) {
		Plotly.purge(el);
		return;
	}

	const dominant = gd.dominantAxis;
	const opacity = (axis: string) => (axis === dominant ? 1.0 : 0.3);

	const traces = [
		{
			type: 'scattergl',
			x: gd.t,
			y: gd.x,
			mode: 'lines',
			line: { color: `rgba(255, 59, 48, ${opacity('x')})`, width: 1.2 },
			name: 'X',
			hovertemplate: '%{y:.2f}<extra>X</extra>'
		},
		{
			type: 'scattergl',
			x: gd.t,
			y: gd.y,
			mode: 'lines',
			line: { color: `rgba(57, 255, 20, ${opacity('y')})`, width: 1.2 },
			name: 'Y',
			hovertemplate: '%{y:.2f}<extra>Y</extra>'
		},
		{
			type: 'scattergl',
			x: gd.t,
			y: gd.z,
			mode: 'lines',
			line: { color: `rgba(10, 132, 255, ${opacity('z')})`, width: 1.2 },
			name: 'Z',
			hovertemplate: '%{y:.2f}<extra>Z</extra>'
		}
	];

	const shapes = [
		{
			type: 'line',
			x0: result.finalDur,
			x1: result.finalDur,
			y0: -15,
			y1: 15,
			line: { color: '#484f58', width: 1.5, dash: 'dash' }
		}
	];

	const layout = {
		...BASE_LAYOUT,
		title: {
			text: `Gyroscope \u2014 dominant axis: ${dominant.toUpperCase()}`,
			font: { color: '#f0f0f0', size: 14 }
		},
		yaxis: { ...BASE_LAYOUT.yaxis, title: 'Rotation (rad/s)' },
		showlegend: true,
		legend: { x: 1, xanchor: 'right', y: 1, bgcolor: 'rgba(0,0,0,0)', font: { size: 10 } },
		shapes
	};

	Plotly.react(el, traces, layout, PLOTLY_CONFIG);
}
