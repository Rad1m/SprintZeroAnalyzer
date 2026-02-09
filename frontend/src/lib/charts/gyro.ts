import type { SprintAnalysisResult } from '../types.js';

declare const Plotly: any;

export interface GyroChartOptions {
	compact?: boolean;
}

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

const COMPACT_LAYOUT = {
	...BASE_LAYOUT,
	font: { ...BASE_LAYOUT.font, size: 9 },
	margin: { t: 8, r: 8, b: 20, l: 30 },
	xaxis: { ...BASE_LAYOUT.xaxis, title: undefined },
	yaxis: { ...BASE_LAYOUT.yaxis, title: undefined },
};

const PLOTLY_CONFIG = {
	responsive: true,
	displayModeBar: true,
	modeBarButtonsToRemove: ['lasso2d', 'select2d']
};

export function renderGyroChart(el: HTMLElement, result: SprintAnalysisResult, options?: GyroChartOptions): void {
	const compact = options?.compact ?? false;
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

	const base = compact ? COMPACT_LAYOUT : BASE_LAYOUT;

	const layout: any = {
		...base,
		yaxis: { ...base.yaxis },
		shapes
	};

	if (compact) {
		layout.showlegend = false;
	} else {
		layout.title = {
			text: `Gyroscope \u2014 dominant axis: ${dominant.toUpperCase()}`,
			font: { color: '#f0f0f0', size: 14 }
		};
		layout.yaxis.title = 'Rotation (rad/s)';
		layout.showlegend = true;
		layout.legend = { x: 1, xanchor: 'right', y: 1, bgcolor: 'rgba(0,0,0,0)', font: { size: 10 } };
	}

	const config = compact
		? { responsive: true, displayModeBar: false }
		: PLOTLY_CONFIG;

	Plotly.react(el, traces, layout, config);
}
