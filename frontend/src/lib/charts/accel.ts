import type { SprintAnalysisResult, PiecewiseFitResult } from '../types.js';

declare const Plotly: any;

export interface AccelChartOptions {
	compact?: boolean;
	showFit?: boolean;
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

/** Build the 3-phase piecewise linear fit trace */
function buildFitTrace(fit: PiecewiseFitResult, tMax: number): { x: number[]; y: number[] } {
	const { bp1, bp2, y0, s1, s2, s3 } = fit;
	const flyStart = y0 + s1 * bp1;
	const flyEnd = flyStart + s2 * (bp2 - bp1);

	// 4 key points: start, bp1, bp2, end of data
	const x = [0, bp1, bp2, tMax];
	const y = [
		y0,                                   // t=0
		flyStart,                             // t=bp1
		flyEnd,                               // t=bp2
		flyEnd + s3 * (tMax - bp2)            // t=tMax
	];

	return { x, y };
}

export function renderAccelChart(el: HTMLElement, result: SprintAnalysisResult, options?: AccelChartOptions): void {
	const compact = options?.compact ?? false;
	const showFit = options?.showFit ?? true;
	const pd = result.plotData;

	const rawTrace = {
		type: 'scattergl',
		x: pd.t,
		y: pd.rawMag,
		mode: 'lines',
		line: { color: 'rgba(255, 214, 10, 0.25)', width: 1 },
		name: 'Raw',
		hoverinfo: 'skip'
	};

	const tValid: number[] = [];
	const rValid: number[] = [];
	for (let i = 0; i < pd.t.length; i++) {
		if (pd.rolling[i] !== null) {
			tValid.push(pd.t[i]);
			rValid.push(pd.rolling[i]!);
		}
	}

	const rollingTrace = {
		type: 'scattergl',
		x: tValid,
		y: rValid,
		mode: 'lines',
		line: { color: '#0A84FF', width: 1.5 },
		name: 'Rolling mean',
		hovertemplate: '%{y:.2f} g<extra></extra>'
	};

	const traces: any[] = [rawTrace, rollingTrace];

	const yTop = pd.sprintLevel * 1.4;
	const shapes: any[] = [
		{
			type: 'line',
			x0: pd.t[0], x1: pd.t[pd.t.length - 1],
			y0: pd.threshold, y1: pd.threshold,
			line: { color: '#BF5AF2', width: 1.5, dash: 'dash' }
		},
		{
			type: 'line',
			x0: pd.fwdTime, x1: pd.fwdTime,
			y0: 0, y1: yTop,
			line: { color: '#FF3B30', width: 2 }
		},
		{
			type: 'line',
			x0: pd.bwdTime, x1: pd.bwdTime,
			y0: 0, y1: yTop,
			line: { color: '#39FF14', width: 2 }
		},
		{
			type: 'line',
			x0: pd.finalTime, x1: pd.finalTime,
			y0: 0, y1: yTop,
			line: { color: '#ffffff', width: 2.5 }
		}
	];

	const annotations: any[] = [
		{ x: pd.fwdTime, y: pd.sprintLevel * 1.25, text: 'FWD', showarrow: false, font: { color: '#FF3B30', size: 11 } },
		{ x: pd.bwdTime, y: pd.sprintLevel * 1.2, text: 'BWD', showarrow: false, font: { color: '#39FF14', size: 11 } },
		{ x: pd.finalTime, y: pd.sprintLevel * 1.35, text: 'FINAL', showarrow: false, font: { color: '#ffffff', size: 12 } }
	];

	// Add piecewise fit overlay if available
	const fit = result.piecewiseFit;
	if (fit && showFit) {
		const tMax = pd.t[pd.t.length - 1];
		const fitData = buildFitTrace(fit, tMax);

		traces.push({
			type: 'scatter',
			x: fitData.x,
			y: fitData.y,
			mode: 'lines',
			line: { color: '#FF9F0A', width: 2.5, dash: 'dot' },
			name: '3-phase fit',
			hovertemplate: '%{y:.2f} g<extra>Fit</extra>'
		});

		// Vertical line at bp2 (piecewise sprint end)
		shapes.push({
			type: 'line',
			x0: fit.bp2, x1: fit.bp2,
			y0: 0, y1: yTop,
			line: { color: '#FF9F0A', width: 2, dash: 'dashdot' }
		});

		// bp1 marker (accel → fly transition)
		shapes.push({
			type: 'line',
			x0: fit.bp1, x1: fit.bp1,
			y0: 0, y1: yTop,
			line: { color: '#FF9F0A', width: 1, dash: 'dot' }
		});

		annotations.push(
			{ x: fit.bp1, y: yTop * 0.95, text: 'BP1', showarrow: false, font: { color: '#FF9F0A', size: 10 } },
			{ x: fit.bp2, y: yTop * 0.9, text: `FIT: ${fit.bp2.toFixed(2)}s`, showarrow: false, font: { color: '#FF9F0A', size: 11 } }
		);
	}

	const base = compact ? COMPACT_LAYOUT : BASE_LAYOUT;

	const layout: any = {
		...base,
		yaxis: { ...base.yaxis },
		shapes,
	};

	if (compact) {
		layout.showlegend = false;
		layout.annotations = [];
	} else {
		const title = `Acceleration \u2014 ${result.distance}m \u2014 Final: ${result.finalDur.toFixed(2)}s`;
		layout.title = { text: title, font: { color: '#f0f0f0', size: 14 } };
		layout.yaxis.title = 'Accel (g)';
		layout.showlegend = true;
		layout.legend = { x: 1, xanchor: 'right', y: 1, bgcolor: 'rgba(0,0,0,0)', font: { size: 10 } };
		layout.annotations = annotations;
	}

	const config = compact
		? { responsive: true, displayModeBar: false }
		: PLOTLY_CONFIG;

	Plotly.react(el, traces, layout, config);
}
