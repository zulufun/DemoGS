"""Vertiv Environment Alert live telemetry endpoints."""

from datetime import datetime, timezone
import re
from typing import Any, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, status
from requests.auth import HTTPBasicAuth

from app.core import settings, get_bearer_token, decode_token

router = APIRouter()
_LAST_VERTIV_SNAPSHOT: Optional[dict[str, Any]] = None

_DEFAULT_PATHS = [
    "/status.xml",
    "/status",
    "/getData.json",
    "/data.json",
    "/",
]
_TEMP_KEYWORDS = ("temperature", "temp")
_HUMIDITY_KEYWORDS = ("humidity", "humid", "relative_humidity", "rh")
_NUMBER_RE = re.compile(r"-?\d+(?:\.\d+)?")
_API_PATH_RE = re.compile(r"[\"'](/[^\"'\s]{2,120})[\"']")
_API_HINTS = ("api", "sensor", "status", "data", "measure", "temp", "humid", "env")
_TEMPERATURE_UNITS = {"CELSIUS", "FAHRENHEIT", "KELVIN", "TEMPERATURE", "TEMPERATURE_DIFFERENTIAL"}
_HUMIDITY_UNITS = {"PERCENT_RELATIVE_HUMIDITY"}
_HUMIDITY_HINTS = ("humid", "humidity", "do am", "độ ẩm", "rh")
_TEMPERATURE_HINTS = ("temp", "temperature", "nhiet", "nhiệt")


def _normalize_base_url(base_url: str) -> str:
    return base_url.rstrip("/")


def _normalize_label(path_parts: list[str], raw_key: str) -> str:
    parts = [part.strip() for part in path_parts if part.strip()]
    key = raw_key.strip()
    if key:
        parts.append(key)
    if not parts:
        return "sensor"
    return " / ".join(parts)


def _to_number(value: Any) -> Optional[float]:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = _NUMBER_RE.search(value)
        if match:
            try:
                return float(match.group(0))
            except ValueError:
                return None
    return None


def _detect_sensor_type(key: str) -> Optional[str]:
    key_norm = key.lower()
    if any(word in key_norm for word in _TEMP_KEYWORDS):
        return "temperature"
    if any(word in key_norm for word in _HUMIDITY_KEYWORDS):
        return "humidity"
    return None


def _sensor_unit(sensor_type: str) -> str:
    return "C" if sensor_type == "temperature" else "%"


def _extract_from_json(payload: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: set[tuple[str, str, float]] = set()

    def walk(node: Any, path_parts: list[str]):
        if isinstance(node, dict):
            for key, value in node.items():
                key_str = str(key)
                sensor_type = _detect_sensor_type(key_str)
                numeric_value = _to_number(value)

                if sensor_type and numeric_value is not None:
                    label = _normalize_label(path_parts, key_str)
                    dedupe_key = (label, sensor_type, numeric_value)
                    if dedupe_key not in seen:
                        seen.add(dedupe_key)
                        rows.append(
                            {
                                "name": label,
                                "type": sensor_type,
                                "value": numeric_value,
                                "unit": _sensor_unit(sensor_type),
                                "raw": str(value),
                            }
                        )

                next_path = path_parts + [key_str]
                walk(value, next_path)

        elif isinstance(node, list):
            for idx, item in enumerate(node):
                walk(item, path_parts + [f"item_{idx + 1}"])

    walk(payload, [])
    return rows


def _extract_from_text(text: str) -> list[dict[str, Any]]:
    collapsed = " ".join(text.split())
    rows: list[dict[str, Any]] = []

    temperature_matches = re.finditer(
        r"(?i)([a-z0-9_\-\s]{0,40}(?:temperature|temp)[a-z0-9_\-\s]{0,40})[^\d\-]{0,12}(-?\d+(?:\.\d+)?)\s*(?:°\s*[CF]|\s+[CF])",
        collapsed,
    )
    humidity_matches = re.finditer(
        r"(?i)([a-z0-9_\-\s]{0,40}(?:humidity|humid|relative humidity|rh)[a-z0-9_\-\s]{0,40})[^\d]{0,12}(\d+(?:\.\d+)?)\s*%",
        collapsed,
    )

    for match in temperature_matches:
        rows.append(
            {
                "name": " ".join(match.group(1).split()) or "temperature",
                "type": "temperature",
                "value": float(match.group(2)),
                "unit": "C",
                "raw": match.group(0),
            }
        )

    for match in humidity_matches:
        rows.append(
            {
                "name": " ".join(match.group(1).split()) or "humidity",
                "type": "humidity",
                "value": float(match.group(2)),
                "unit": "%",
                "raw": match.group(0),
            }
        )

    unique_rows: list[dict[str, Any]] = []
    seen: set[tuple[str, str, float]] = set()
    for row in rows:
        dedupe_key = (row["name"], row["type"], row["value"])
        if dedupe_key not in seen:
            seen.add(dedupe_key)
            unique_rows.append(row)

    return unique_rows


def _extract_measurements(response: requests.Response) -> list[dict[str, Any]]:
    try:
        json_payload = response.json()
    except ValueError:
        json_payload = None

    if json_payload is not None:
        rows = _extract_from_json(json_payload)
        if rows:
            return rows

    return _extract_from_text(response.text)


def _build_candidate_paths(requested_path: Optional[str]) -> list[str]:
    candidates: list[str] = []

    if requested_path:
        candidates.append(requested_path)

    if settings.VERTIV_STATUS_PATH:
        candidates.append(settings.VERTIV_STATUS_PATH)

    candidates.extend(_DEFAULT_PATHS)

    normalized: list[str] = []
    seen = set()
    for path in candidates:
        value = (path or "/").strip()
        if not value:
            continue
        if not value.startswith("/"):
            value = f"/{value}"
        if value not in seen:
            seen.add(value)
            normalized.append(value)

    return normalized


def _discover_paths_from_webapp(
    base_url: str,
    auth: Optional[HTTPBasicAuth],
    timeout_seconds: int,
    verify_ssl: bool,
) -> list[str]:
    """Read app.min.js and extract likely internal API paths."""
    try:
        js_response = requests.get(
            f"{base_url}/app.min.js",
            auth=auth,
            timeout=timeout_seconds,
            verify=verify_ssl,
        )
        if js_response.status_code >= 400:
            return []
    except requests.RequestException:
        return []

    found_paths = _API_PATH_RE.findall(js_response.text)
    candidates: list[str] = []
    seen = set()

    for path in found_paths:
        lower = path.lower()
        if not any(hint in lower for hint in _API_HINTS):
            continue
        if any(lower.endswith(ext) for ext in (".css", ".js", ".png", ".jpg", ".svg", ".ico")):
            continue
        if path not in seen:
            seen.add(path)
            candidates.append(path)

    return candidates[:80]


def _login_vertiv_rest_session(
    base_url: str,
    username: str,
    password: str,
    timeout_seconds: int,
    verify_ssl: bool,
) -> tuple[requests.Session, list[dict[str, Any]]]:
    session = requests.Session()
    attempts: list[dict[str, Any]] = []
    auth_endpoint = f"{base_url}/rest/v1/authentication"

    response = session.post(
        auth_endpoint,
        data={"username": username, "password": password},
        headers={
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout=timeout_seconds,
        verify=verify_ssl,
    )
    attempts.append(
        {
            "endpoint": auth_endpoint,
            "ok": response.status_code < 400,
            "status_code": response.status_code,
            "error": None if response.status_code < 400 else "HTTP error",
        }
    )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Vertiv authentication failed with status {response.status_code}",
        )

    return session, attempts


def _extract_measurements_from_points(points_payload: Any) -> list[dict[str, Any]]:
    if isinstance(points_payload, dict):
        points = points_payload.get("results", [])
    elif isinstance(points_payload, list):
        points = points_payload
    else:
        points = []

    rows: list[dict[str, Any]] = []
    seen: set[tuple[str, str, float]] = set()

    for point in points:
        if not isinstance(point, dict):
            continue

        name = str(point.get("name") or "")
        point_path = str(point.get("pointPath") or name)
        units_raw = str(point.get("units") or "")
        units_normalized = units_raw.upper()
        live_value_raw = point.get("liveValue")
        live_value = _to_number(live_value_raw)

        if live_value is None:
            continue

        searchable = f"{name} {point_path}".lower()

        sensor_type: Optional[str] = None
        if units_normalized in _TEMPERATURE_UNITS or any(hint in searchable for hint in _TEMPERATURE_HINTS):
            sensor_type = "temperature"
        elif units_normalized in _HUMIDITY_UNITS:
            sensor_type = "humidity"
        elif units_normalized == "PERCENT" and any(hint in searchable for hint in _HUMIDITY_HINTS):
            sensor_type = "humidity"

        if sensor_type is None:
            continue

        device_name = ""
        if isinstance(point.get("device"), dict):
            device_name = str(point["device"].get("name") or "")

        display_unit = "C"
        if sensor_type == "humidity":
            display_unit = "%"
        elif units_normalized == "FAHRENHEIT":
            display_unit = "F"
        elif units_normalized == "KELVIN":
            display_unit = "K"

        dedupe_key = (point_path, sensor_type, live_value)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        rows.append(
            {
                "id": str(point.get("id") or ""),
                "name": name or point_path,
                "point_path": point_path,
                "device": device_name,
                "type": sensor_type,
                "value": live_value,
                "unit": display_unit,
                "status": str(point.get("status") or ""),
                "raw": str(live_value_raw),
            }
        )

    return sorted(rows, key=lambda item: (item["type"], item["device"].lower(), item["name"].lower()))


def _build_snapshot_payload(
    base_url: str,
    endpoint: str,
    status_code: int,
    sensors: list[dict[str, Any]],
    attempts: list[dict[str, Any]],
) -> dict[str, Any]:
    temperature_rows = [item for item in sensors if item["type"] == "temperature"]
    humidity_rows = [item for item in sensors if item["type"] == "humidity"]

    temperature_avg = (
        round(sum(item["value"] for item in temperature_rows) / len(temperature_rows), 2)
        if temperature_rows
        else None
    )
    humidity_avg = (
        round(sum(item["value"] for item in humidity_rows) / len(humidity_rows), 2)
        if humidity_rows
        else None
    )

    return {
        "source": {
            "base_url": base_url,
            "endpoint": endpoint,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "status_code": status_code,
            "cached": False,
        },
        "summary": {
            "total_sensors": len(sensors),
            "temperature_count": len(temperature_rows),
            "humidity_count": len(humidity_rows),
            "temperature_avg": temperature_avg,
            "humidity_avg": humidity_avg,
        },
        "measurements": {
            "temperature": {"value": temperature_rows[0]["value"] if temperature_rows else None, "unit": "C"},
            "humidity": {"value": humidity_rows[0]["value"] if humidity_rows else None, "unit": "%"},
        },
        "sensors": sensors,
        "attempts": attempts,
    }


def _cached_snapshot_or_none(attempts: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    global _LAST_VERTIV_SNAPSHOT
    if not _LAST_VERTIV_SNAPSHOT:
        return None

    snapshot = dict(_LAST_VERTIV_SNAPSHOT)
    source = dict(snapshot.get("source", {}))
    source["cached"] = True
    source["fallback_fetched_at"] = datetime.now(timezone.utc).isoformat()
    snapshot["source"] = source

    cached_attempts = list(snapshot.get("attempts", []))
    snapshot["attempts"] = [*attempts, *cached_attempts]
    return snapshot


@router.get("/live/temperature-humidity")
async def get_temperature_humidity(
    base_url: Optional[str] = None,
    path: Optional[str] = Query(default=None, description="Optional endpoint path override"),
    username: Optional[str] = None,
    password: Optional[str] = None,
    verify_ssl: Optional[bool] = None,
    timeout_seconds: Optional[int] = Query(default=None, ge=3, le=60),
    token: str = Depends(get_bearer_token),
):
    """Read latest temperature and humidity values from Vertiv endpoints."""
    global _LAST_VERTIV_SNAPSHOT
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    resolved_base_url = _normalize_base_url(base_url or settings.VERTIV_BASE_URL)
    resolved_username = username or settings.VERTIV_USERNAME
    resolved_password = password or settings.VERTIV_PASSWORD
    resolved_verify_ssl = settings.VERTIV_VERIFY_SSL if verify_ssl is None else verify_ssl
    resolved_timeout = timeout_seconds or settings.VERTIV_REQUEST_TIMEOUT_SECONDS

    if not resolved_base_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing VERTIV_BASE_URL configuration.",
        )

    if not resolved_username or not resolved_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Vertiv username/password for REST authentication.",
        )

    attempts: list[dict[str, Any]] = []

    try:
        rest_session, rest_attempts = _login_vertiv_rest_session(
            base_url=resolved_base_url,
            username=resolved_username,
            password=resolved_password,
            timeout_seconds=resolved_timeout,
            verify_ssl=resolved_verify_ssl,
        )
        attempts.extend(rest_attempts)

        points_endpoint = f"{resolved_base_url}/rest/v1/points"
        points_response = rest_session.get(
            points_endpoint,
            timeout=max(resolved_timeout, 40),
            verify=resolved_verify_ssl,
        )
        attempts.append(
            {
                "endpoint": points_endpoint,
                "ok": points_response.status_code < 400,
                "status_code": points_response.status_code,
                "error": None if points_response.status_code < 400 else "HTTP error",
            }
        )

        points_response.raise_for_status()
        points_payload = points_response.json()
        sensors = _extract_measurements_from_points(points_payload)

        if sensors:
            snapshot = _build_snapshot_payload(
                base_url=resolved_base_url,
                endpoint=points_endpoint,
                status_code=points_response.status_code,
                sensors=sensors,
                attempts=attempts,
            )
            _LAST_VERTIV_SNAPSHOT = snapshot
            return snapshot
    except (requests.RequestException, ValueError) as exc:
        attempts.append(
            {
                "endpoint": f"{resolved_base_url}/rest/v1/points",
                "ok": False,
                "error": str(exc),
            }
        )

    auth = None
    if resolved_username and resolved_password:
        auth = HTTPBasicAuth(resolved_username, resolved_password)

    base_candidates = _build_candidate_paths(path)
    auto_discovered = _discover_paths_from_webapp(
        base_url=resolved_base_url,
        auth=auth,
        timeout_seconds=resolved_timeout,
        verify_ssl=resolved_verify_ssl,
    )

    for candidate_path in [*base_candidates, *auto_discovered]:
        endpoint = f"{resolved_base_url}{candidate_path}"

        try:
            response = requests.get(
                endpoint,
                auth=auth,
                timeout=resolved_timeout,
                verify=resolved_verify_ssl,
            )
        except requests.RequestException as exc:
            attempts.append({"endpoint": endpoint, "ok": False, "error": str(exc)})
            continue

        if response.status_code >= 400:
            attempts.append(
                {
                    "endpoint": endpoint,
                    "ok": False,
                    "status_code": response.status_code,
                    "error": "HTTP error",
                }
            )
            continue

        sensors = _extract_measurements(response)
        if not sensors:
            attempts.append(
                {
                    "endpoint": endpoint,
                    "ok": False,
                    "status_code": response.status_code,
                    "error": "No temperature/humidity data found",
                }
            )
            continue

        temperature_rows = [item for item in sensors if item["type"] == "temperature"]
        humidity_rows = [item for item in sensors if item["type"] == "humidity"]

        temperature_avg = (
            round(sum(item["value"] for item in temperature_rows) / len(temperature_rows), 2)
            if temperature_rows
            else None
        )
        humidity_avg = (
            round(sum(item["value"] for item in humidity_rows) / len(humidity_rows), 2)
            if humidity_rows
            else None
        )

        sorted_sensors = sorted(sensors, key=lambda item: (item["type"], item["name"].lower()))

        snapshot = _build_snapshot_payload(
            base_url=resolved_base_url,
            endpoint=endpoint,
            status_code=response.status_code,
            sensors=sorted_sensors,
            attempts=attempts,
        )
        _LAST_VERTIV_SNAPSHOT = snapshot
        return snapshot

    cached_snapshot = _cached_snapshot_or_none(attempts)
    if cached_snapshot is not None:
        return cached_snapshot

    attempted_endpoints = ", ".join(item["endpoint"] for item in attempts) or "none"
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=(
            "Cannot read temperature/humidity from Vertiv endpoint. "
            f"Tried: {attempted_endpoints}"
        ),
    )
