"""
Firestore data loader for SprintZero Analyzer.

Fetches sprint sessions from the `debug_sessions` Firestore collection
and decodes CompactCurvePayload binary blobs into acceleration/gyroscope DataFrames.

Authentication:
  Uses Application Default Credentials (run `gcloud auth application-default login`).
  Project ID is read from the shared Secrets.xcconfig.
"""

import struct
import zlib
from pathlib import Path

import numpy as np
import pandas as pd
from google.cloud import firestore

# Path to shared secrets (sibling repo)
_XCCONFIG_PATH = Path(__file__).parent / "../SprintZeroProject/Falcata/Falcata/Secrets.xcconfig"


def _parse_xcconfig(path: Path) -> dict[str, str]:
    """Parse key-value pairs from an xcconfig file."""
    result = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("//"):
            continue
        if "=" in line:
            key, _, value = line.partition("=")
            result[key.strip()] = value.strip()
    return result


# =============================================================================
# CompactCurvePayload decoder (matches Swift binary format v3)
# =============================================================================

def decode_compact_curve_payload(compressed_data: bytes) -> dict:
    """Decompress zlib + parse the v3 binary layout.

    Returns dict with keys: acceleration, gyroscope, smoothed_acceleration, cycle_amplitudes.
    Each curve entry is a list of dicts: {timestamp, x, y, z}.
    """
    data = zlib.decompress(compressed_data, -15)  # raw deflate (Apple Compression framework)
    if len(data) < 9:
        raise ValueError(f"Payload too short: {len(data)} bytes")

    version = data[0]
    if version not in (1, 2, 3):
        raise ValueError(f"Unknown CompactCurvePayload version: {version}")

    accel_count = struct.unpack_from("<H", data, 1)[0]
    gyro_count = struct.unpack_from("<H", data, 3)[0]

    if version >= 3:
        smoothed_count = struct.unpack_from("<H", data, 5)[0]
        cycle_count = struct.unpack_from("<H", data, 7)[0]
        offset = 9
    else:
        smoothed_count = 0
        cycle_count = 0
        offset = 5

    def read_samples(count):
        nonlocal offset
        samples = np.frombuffer(data, dtype="<f4", count=count * 4, offset=offset).reshape(count, 4)
        offset += count * 16
        return samples

    accel_raw = read_samples(accel_count)
    gyro_raw = read_samples(gyro_count)
    smoothed_raw = read_samples(smoothed_count) if smoothed_count > 0 else np.empty((0, 4))
    cycle_amplitudes = list(np.frombuffer(data, dtype="<f4", count=cycle_count, offset=offset))
    offset += cycle_count * 4

    def to_records(arr):
        return [{"timestamp": float(r[0]), "x": float(r[1]), "y": float(r[2]), "z": float(r[3])} for r in arr]

    return {
        "acceleration": to_records(accel_raw),
        "gyroscope": to_records(gyro_raw),
        "smoothed_acceleration": to_records(smoothed_raw),
        "cycle_amplitudes": cycle_amplitudes,
    }


def curve_payload_to_dataframes(compressed_data: bytes) -> dict:
    """Decode CompactCurvePayload and return pandas DataFrames ready for the analyzer."""
    decoded = decode_compact_curve_payload(compressed_data)

    result = {}
    if decoded["acceleration"]:
        accel = pd.DataFrame(decoded["acceleration"])
        accel = accel.rename(columns={"x": "accel_x", "y": "accel_y", "z": "accel_z"})
        accel = accel.sort_values("timestamp").reset_index(drop=True)
        accel["mag"] = np.sqrt(accel["accel_x"] ** 2 + accel["accel_y"] ** 2 + accel["accel_z"] ** 2)
        result["accel"] = accel

    if decoded["gyroscope"]:
        gyro = pd.DataFrame(decoded["gyroscope"])
        gyro = gyro.rename(columns={"x": "gyro_x", "y": "gyro_y", "z": "gyro_z"})
        gyro = gyro.sort_values("timestamp").reset_index(drop=True)
        result["gyro"] = gyro

    if decoded["smoothed_acceleration"]:
        smoothed = pd.DataFrame(decoded["smoothed_acceleration"])
        smoothed = smoothed.rename(columns={"x": "accel_x", "y": "accel_y", "z": "accel_z"})
        smoothed = smoothed.sort_values("timestamp").reset_index(drop=True)
        smoothed["mag"] = np.sqrt(smoothed["accel_x"] ** 2 + smoothed["accel_y"] ** 2 + smoothed["accel_z"] ** 2)
        result["smoothed"] = smoothed

    result["cycle_amplitudes"] = decoded["cycle_amplitudes"]
    return result


# =============================================================================
# Firestore client
# =============================================================================

_db = None


def get_db() -> firestore.Client:
    """Get or create the Firestore client.

    Reads project ID from Secrets.xcconfig and uses Application Default Credentials.
    Run `gcloud auth application-default login` to authenticate.
    """
    global _db
    if _db is not None:
        return _db

    config = _parse_xcconfig(_XCCONFIG_PATH.resolve())
    project_id = config.get("FIREBASE_PROJECT_ID")
    if not project_id:
        raise RuntimeError(f"FIREBASE_PROJECT_ID not found in {_XCCONFIG_PATH.resolve()}")

    _db = firestore.Client(project=project_id)
    return _db


def fetch_sessions(limit: int = 100) -> list[dict]:
    """Fetch debug sessions from Firestore, newest first.

    Returns list of dicts, each with the raw Firestore document fields.
    """
    db = get_db()
    query = (
        db.collection("debug_sessions")
        .order_by("sessionDate", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )
    return [doc.to_dict() | {"_id": doc.id} for doc in query.stream()]


def session_to_sprints(session: dict) -> list[dict]:
    """Convert a Firestore session document into a list of sprint dicts
    compatible with the analyzer.

    Each returned dict has: date, distance, accel (DataFrame), gyro (DataFrame).
    """
    curves = session.get("curves", {})
    sprint_metas = session.get("sprints", [])
    session_date = session.get("sessionDate")

    if session_date is not None:
        date_str = session_date.strftime("%Y-%m-%d")
    else:
        date_str = "unknown"

    results = []
    for meta in sprint_metas:
        sprint_id = meta.get("id", "")
        distance = meta.get("distance", 0)
        curve_blob = curves.get(sprint_id)

        sprint_info = {
            "date": date_str,
            "distance": distance,
            "meta": meta,
            "loaded": {},
        }

        if curve_blob is not None:
            raw = curve_blob if isinstance(curve_blob, bytes) else bytes(curve_blob)
            sprint_info["loaded"] = curve_payload_to_dataframes(raw)

        results.append(sprint_info)

    return results
