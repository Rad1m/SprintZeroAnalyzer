"""
Sprint End Detection — BIDIRECTIONAL

Extracted from DetectFromEnd.py for use in the TUI analyzer.

FORWARD (from sprint phase):
  Find where acceleration rolling mean first drops significantly below
  the sustained sprint level.

BACKWARD (from recording end):
  Work backward through standing/walking/decel to find where acceleration
  was still at sprint level.

When both agree → high confidence.
When they disagree → the gap is the uncertainty zone.
"""

import json
import base64
import numpy as np
import pandas as pd
from pathlib import Path

# Agreement threshold: if forward and backward are within this many seconds,
# they "agree" and we average them.
AGREEMENT_THRESHOLD = 1.5  # seconds

MIN_TIMES = {60: 3, 70: 4, 100: 5, 200: 15, 290: 25, 400: 40}


# =============================================================================
# Data loading
# =============================================================================

def decode_curve(encoded_data):
    return json.loads(base64.b64decode(encoded_data))


def load_sprint_data(sprint):
    result = {}
    if 'accelerationCurve' in sprint:
        accel = pd.DataFrame(decode_curve(sprint['accelerationCurve']))
        accel = accel.rename(columns={'x': 'accel_x', 'y': 'accel_y', 'z': 'accel_z'})
        accel = accel.sort_values('timestamp').reset_index(drop=True)
        accel['mag'] = np.sqrt(accel['accel_x']**2 + accel['accel_y']**2 + accel['accel_z']**2)
        result['accel'] = accel
    if 'gyroscopeCurve' in sprint:
        gyro = pd.DataFrame(decode_curve(sprint['gyroscopeCurve']))
        gyro = gyro.rename(columns={'x': 'gyro_x', 'y': 'gyro_y', 'z': 'gyro_z'})
        gyro = gyro.sort_values('timestamp').reset_index(drop=True)
        result['gyro'] = gyro
    return result


def get_sprints_with_curves(data):
    sprints = []
    for session in data['sessions']:
        session_date = session['date'][:10]
        for sprint in session.get('sprints', []):
            if sprint.get('accelerationCurve') and sprint.get('gyroscopeCurve'):
                sprints.append({
                    'date': session_date,
                    'distance': sprint.get('distance', 0),
                    'sprint': sprint,
                })
    return sprints


# =============================================================================
# Common: rolling mean + sprint level
# =============================================================================

def compute_rolling_mean(accel_df, window_seconds=1.0):
    t = accel_df['timestamp'].values
    mag = accel_df['mag'].values
    rate = len(accel_df) / (t[-1] - t[0])
    window = max(10, int(window_seconds * rate))
    rolling = pd.Series(mag).rolling(window=window, min_periods=5).mean().values
    return rolling, rate


def find_sprint_level(t, rolling):
    duration = t[-1] - t[0]
    mid_start = t[0] + duration * 0.2
    mid_end = t[0] + duration * 0.7
    mid_mask = (t >= mid_start) & (t <= mid_end) & ~np.isnan(rolling)
    if mid_mask.sum() < 10:
        return 5.0
    return np.median(rolling[mid_mask])


def find_sprint_start(t, rolling):
    for i in range(len(rolling)):
        if not np.isnan(rolling[i]) and rolling[i] > 2.0:
            return t[i], i
    return t[0], 0


# =============================================================================
# FORWARD detection
# =============================================================================

def detect_forward(t, rolling, sprint_level, min_sprint_time=5.0):
    threshold = sprint_level * 0.90
    search_start = t[0] + min_sprint_time
    rate = len(t) / (t[-1] - t[0])
    sustain_samples = max(5, int(0.5 * rate))

    for i in range(len(t)):
        if t[i] < search_start:
            continue
        if np.isnan(rolling[i]):
            continue
        if rolling[i] < threshold:
            sustained = True
            end_check = min(i + sustain_samples, len(t))
            for j in range(i, end_check):
                if not np.isnan(rolling[j]) and rolling[j] >= threshold:
                    sustained = False
                    break
            if sustained:
                return t[i], threshold

    return t[-1], threshold


# =============================================================================
# BACKWARD detection
# =============================================================================

def detect_backward(t, rolling, sprint_level):
    threshold = sprint_level * 0.90
    for i in range(len(t) - 1, -1, -1):
        if np.isnan(rolling[i]):
            continue
        if rolling[i] >= threshold:
            return t[i], threshold
    return t[0], threshold


# =============================================================================
# DECISION: combine forward + backward
# =============================================================================

def decide(forward_time, backward_time, sprint_start):
    gap = abs(forward_time - backward_time)
    if gap <= AGREEMENT_THRESHOLD:
        final = (forward_time + backward_time) / 2
        return final, 'agree', gap
    if forward_time < backward_time:
        return backward_time, 'trust_backward', gap
    return forward_time, 'trust_forward', gap


# =============================================================================
# High-level: analyze a file
# =============================================================================

def _analyze_sprint(accel_df, distance, date, index):
    """Run bidirectional detection on a single sprint's acceleration DataFrame.

    Returns a result dict or None if insufficient data.
    """
    if accel_df is None or len(accel_df) < 100:
        return None

    t = accel_df['timestamp'].values
    rolling, rate = compute_rolling_mean(accel_df)
    sprint_level = find_sprint_level(t, rolling)
    sprint_start, _ = find_sprint_start(t, rolling)

    min_time = MIN_TIMES.get(distance, 5)

    fwd_time, fwd_thresh = detect_forward(t, rolling, sprint_level, min_sprint_time=min_time)
    bwd_time, _ = detect_backward(t, rolling, sprint_level)
    final_time, decision, gap = decide(fwd_time, bwd_time, sprint_start)

    fwd_dur = fwd_time - sprint_start
    bwd_dur = bwd_time - sprint_start
    final_dur = final_time - sprint_start

    return {
        'index': index,
        'date': date,
        'distance': distance,
        'fwd_dur': fwd_dur,
        'bwd_dur': bwd_dur,
        'final_dur': final_dur,
        'gap': gap,
        'decision': decision,
        'plot_data': {
            't': t - sprint_start,
            'rolling': rolling,
            'sprint_level': sprint_level,
            'threshold': fwd_thresh,
            'fwd_time': fwd_dur,
            'bwd_time': bwd_dur,
            'final_time': final_dur,
        },
    }


def analyze_file(path):
    """
    Analyze a .falcata file. Returns a list of result dicts, each containing:
      - index, date, distance, fwd_dur, bwd_dur, final_dur, gap, decision
      - plot_data: dict with t, rolling, sprint_level, threshold, sprint_start,
                   fwd_time, bwd_time, final_time (for charting)
    """
    with open(path, 'r') as f:
        data = json.load(f)

    sprints = get_sprints_with_curves(data)
    sprints = [s for s in sprints if s['distance'] >= 60]

    results = []
    for i, sprint_info in enumerate(sprints):
        sprint = sprint_info['sprint']
        loaded = load_sprint_data(sprint)
        r = _analyze_sprint(loaded.get('accel'), sprint_info['distance'], sprint_info['date'], i + 1)
        if r is not None:
            results.append(r)

    return results


def analyze_firestore_sessions(sessions):
    """Analyze sprints from Firestore session documents.

    Args:
        sessions: list of Firestore session dicts (from firestore_loader.fetch_sessions).

    Returns same format as analyze_file().
    """
    from firestore_loader import session_to_sprints

    results = []
    idx = 1
    for session in sessions:
        for sprint_info in session_to_sprints(session):
            if sprint_info['distance'] < 60:
                continue
            accel_df = sprint_info['loaded'].get('accel')
            r = _analyze_sprint(accel_df, sprint_info['distance'], sprint_info['date'], idx)
            if r is not None:
                results.append(r)
                idx += 1

    return results
