/**
 * Plotly.js chart setup and updates.
 * Three charts: acceleration (with detection), gyroscope.
 */

const BASE_LAYOUT = {
  paper_bgcolor: '#0d1117',
  plot_bgcolor: '#161b22',
  font: { color: '#c9d1d9', family: 'JetBrains Mono, monospace', size: 12 },
  margin: { t: 40, r: 20, b: 50, l: 60 },
  xaxis: {
    title: 'Time (s)',
    gridcolor: '#21262d',
    zerolinecolor: '#30363d',
    color: '#8b949e',
  },
  yaxis: {
    gridcolor: '#21262d',
    zerolinecolor: '#30363d',
    color: '#8b949e',
  },
  hovermode: 'x unified',
};

const PLOTLY_CONFIG = {
  responsive: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d'],
};

let accelDiv = null;
let gyroDiv = null;
let accelInit = false;
let gyroInit = false;

export function initCharts() {
  accelDiv = document.getElementById('accel-chart');
  gyroDiv = document.getElementById('gyro-chart');
}

// =============================================================================
// Acceleration + Detection chart
// =============================================================================

export function renderAccelChart(result) {
  const pd = result.plotData;

  // Raw magnitude trace (faded)
  const rawTrace = {
    type: 'scattergl',
    x: pd.t,
    y: pd.rawMag,
    mode: 'lines',
    line: { color: 'rgba(210, 153, 34, 0.25)', width: 1 },
    name: 'Raw',
    hoverinfo: 'skip',
  };

  // Rolling mean trace
  const tValid = [];
  const rValid = [];
  for (let i = 0; i < pd.t.length; i++) {
    if (pd.rolling[i] !== null) {
      tValid.push(pd.t[i]);
      rValid.push(pd.rolling[i]);
    }
  }

  const rollingTrace = {
    type: 'scattergl',
    x: tValid,
    y: rValid,
    mode: 'lines',
    line: { color: '#58a6ff', width: 1.5 },
    name: 'Rolling mean',
    hovertemplate: '%{y:.2f} g<extra></extra>',
  };

  const yTop = pd.sprintLevel * 1.4;
  const shapes = [
    {
      type: 'line',
      x0: pd.t[0], x1: pd.t[pd.t.length - 1],
      y0: pd.threshold, y1: pd.threshold,
      line: { color: '#f778ba', width: 1.5, dash: 'dash' },
    },
    {
      type: 'line',
      x0: pd.fwdTime, x1: pd.fwdTime,
      y0: 0, y1: yTop,
      line: { color: '#f85149', width: 2 },
    },
    {
      type: 'line',
      x0: pd.bwdTime, x1: pd.bwdTime,
      y0: 0, y1: yTop,
      line: { color: '#3fb950', width: 2 },
    },
    {
      type: 'line',
      x0: pd.finalTime, x1: pd.finalTime,
      y0: 0, y1: yTop,
      line: { color: '#ffffff', width: 2.5 },
    },
  ];

  const annotations = [
    { x: pd.fwdTime, y: pd.sprintLevel * 1.25, text: 'FWD', showarrow: false, font: { color: '#f85149', size: 11 } },
    { x: pd.bwdTime, y: pd.sprintLevel * 1.2, text: 'BWD', showarrow: false, font: { color: '#3fb950', size: 11 } },
    { x: pd.finalTime, y: pd.sprintLevel * 1.35, text: 'FINAL', showarrow: false, font: { color: '#ffffff', size: 12 } },
  ];

  const title = `Acceleration — ${result.distance}m — Final: ${result.finalDur.toFixed(2)}s`;

  const layout = {
    ...BASE_LAYOUT,
    title: { text: title, font: { color: '#e6edf3', size: 14 } },
    yaxis: { ...BASE_LAYOUT.yaxis, title: 'Accel (g)' },
    showlegend: true,
    legend: { x: 1, xanchor: 'right', y: 1, bgcolor: 'rgba(0,0,0,0)', font: { size: 10 } },
    shapes,
    annotations,
  };

  if (accelInit) {
    Plotly.react(accelDiv, [rawTrace, rollingTrace], layout, PLOTLY_CONFIG);
  } else {
    Plotly.newPlot(accelDiv, [rawTrace, rollingTrace], layout, PLOTLY_CONFIG);
    accelInit = true;
  }
}

// =============================================================================
// Gyroscope chart (3-axis)
// =============================================================================

export function renderGyroChart(result) {
  const gd = result.gyroData;
  if (!gd) {
    if (gyroInit) { Plotly.purge(gyroDiv); gyroInit = false; }
    return;
  }

  const dominant = gd.dominantAxis;
  const opacity = (axis) => axis === dominant ? 1.0 : 0.3;

  const traces = [
    {
      type: 'scattergl',
      x: gd.t, y: gd.x,
      mode: 'lines',
      line: { color: `rgba(248, 81, 73, ${opacity('x')})`, width: 1.2 },
      name: 'X',
      hovertemplate: '%{y:.2f}<extra>X</extra>',
    },
    {
      type: 'scattergl',
      x: gd.t, y: gd.y,
      mode: 'lines',
      line: { color: `rgba(63, 185, 80, ${opacity('y')})`, width: 1.2 },
      name: 'Y',
      hovertemplate: '%{y:.2f}<extra>Y</extra>',
    },
    {
      type: 'scattergl',
      x: gd.t, y: gd.z,
      mode: 'lines',
      line: { color: `rgba(88, 166, 255, ${opacity('z')})`, width: 1.2 },
      name: 'Z',
      hovertemplate: '%{y:.2f}<extra>Z</extra>',
    },
  ];

  // Sprint end marker
  const shapes = [
    {
      type: 'line',
      x0: result.finalDur, x1: result.finalDur,
      y0: -15, y1: 15,
      line: { color: '#484f58', width: 1.5, dash: 'dash' },
    },
  ];

  const layout = {
    ...BASE_LAYOUT,
    title: { text: `Gyroscope — dominant axis: ${dominant.toUpperCase()}`, font: { color: '#e6edf3', size: 14 } },
    yaxis: { ...BASE_LAYOUT.yaxis, title: 'Rotation (rad/s)' },
    showlegend: true,
    legend: { x: 1, xanchor: 'right', y: 1, bgcolor: 'rgba(0,0,0,0)', font: { size: 10 } },
    shapes,
  };

  if (gyroInit) {
    Plotly.react(gyroDiv, traces, layout, PLOTLY_CONFIG);
  } else {
    Plotly.newPlot(gyroDiv, traces, layout, PLOTLY_CONFIG);
    gyroInit = true;
  }
}

// =============================================================================
// Clear
// =============================================================================

export function clearCharts() {
  if (accelDiv && accelInit) { Plotly.purge(accelDiv); accelInit = false; }
  if (gyroDiv && gyroInit) { Plotly.purge(gyroDiv); gyroInit = false; }
}
