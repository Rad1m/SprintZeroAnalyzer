# SprintZero Analyzer

Terminal UI for analyzing sprint end times from Apple Watch sensor data using bidirectional detection.

```
┌──────────────────────────────────────────────────────────┐
│  SprintZero Analyzer                            (Header) │
├────────────────┬─────────────────────────────────────────┤
│                │                                         │
│  File Browser  │  Results DataTable                      │
│  (.sprintzero  │  #  Date  Dist  Fwd  Bwd  Gap  Final   │
│   files)       │                                         │
│                ├─────────────────────────────────────────┤
│                │                                         │
│                │  Acceleration Plot (terminal chart)     │
│                │  Rolling mean + detection markers       │
│                │                                         │
├────────────────┴─────────────────────────────────────────┤
│  q Quit │ ↑↓ Navigate │ Enter Select          (Footer)  │
└──────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
cd /Users/radim/Programming/SprintZeroAnalyzer
uv run python app.py
```

Navigate to a `.sprintzero` backup file in the left panel. Select it to run detection. Click a row in the results table to view the acceleration plot for that sprint.

## How It Works

The analyzer reads `.sprintzero` backup files exported from the SprintZero iOS app. Each file contains session data with embedded accelerometer and gyroscope curves (base64-encoded JSON).

### Bidirectional Detection

Sprint end time is detected by running two independent scans on the acceleration rolling mean (1-second window):

**Forward scan** — Starting after a minimum sprint duration (distance-dependent), finds the first point where the rolling mean drops below 90% of the sprint level *and stays below for at least 0.5 seconds*. This sustained-drop requirement prevents false triggers from momentary dips.

**Backward scan** — Starting from the end of the recording (where the runner has stopped), scans backward to find the last point where the rolling mean was still at or above 90% of the sprint level.

**Decision logic:**

| Condition | Action | Confidence |
|---|---|---|
| Forward and backward agree within 1.5s | Average both | High |
| Forward < backward (forward triggered early) | Trust backward | Medium |
| Forward > backward (backward fell short) | Trust forward | Medium |

### Sprint Level

The "sprint level" is the median acceleration magnitude across the middle 60% of the recording (skipping the start ramp-up and end deceleration). The 90% threshold of this level defines the boundary between sprinting and decelerating.

### Minimum Sprint Times

Sprints shorter than a distance-dependent minimum are ignored during forward detection to avoid triggering on the acceleration phase itself:

| Distance | Min Time |
|---|---|
| 60m | 3s |
| 70m | 4s |
| 100m | 5s |
| 200m | 15s |
| 290m | 25s |
| 400m | 40s |

## Results Table

| Column | Description |
|---|---|
| # | Sprint index within the file |
| Date | Session date |
| Dist | Sprint distance in meters |
| Fwd (s) | Forward detection time (seconds from sprint start) |
| Bwd (s) | Backward detection time |
| Gap | Absolute difference between forward and backward |
| Decision | `agree`, `trust_forward`, or `trust_backward` |
| Final (s) | Final sprint end time used |

## Plot

The terminal chart shows the acceleration rolling mean over time for the selected sprint:

- **Line** — Rolling mean of acceleration magnitude (g)
- **Magenta horizontal** — 90% threshold
- **Red vertical** — Forward detection point
- **Green vertical** — Backward detection point
- **White vertical** — Final decision time

## Project Structure

```
SprintZeroAnalyzer/
├── pyproject.toml     # Dependencies and project metadata
├── app.py             # Textual TUI application
├── detection.py       # Bidirectional sprint end detection logic
└── .python-version    # Python 3.11
```

## Dependencies

Managed with [uv](https://docs.astral.sh/uv/). Install and lock with `uv sync`.

- **textual** — Terminal UI framework
- **textual-plotext** — Plotext integration for Textual
- **plotext** — Terminal plotting
- **numpy** — Numerical computation
- **pandas** — Data manipulation and rolling window
