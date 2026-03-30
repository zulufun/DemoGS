"""Vertiv Environment Alert live telemetry routes."""

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, status
from requests.auth import HTTPBasicAuth
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import Profile
from security import decode_token, get_bearer_token

router = APIRouter()

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


def _normalize_base_url(base_url: str) -> str:
    return base_url.rstrip("/")


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


def _pick_measurements_from_json(payload: Any) -> Dict[str, Optional[float]]:
    state = {"temperature": None, "humidity": None}

    def walk(node: Any):
        if state["temperature"] is not None and state["humidity"] is not None:
            return

        if isinstance(node, dict):
            for key, value in node.items():
                key_norm = str(key).strip().lower()
                parsed = _to_number(value)

                if parsed is not None and state["temperature"] is None:
                    if any(word in key_norm for word in _TEMP_KEYWORDS):
                        state["temperature"] = parsed

                if parsed is not None and state["humidity"] is None:
                    if any(word in key_norm for word in _HUMIDITY_KEYWORDS):
                        state["humidity"] = parsed

                walk(value)

        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)
    return state


def _pick_measurements_from_text(text: str) -> Dict[str, Optional[float]]:
    normalized = " ".join(text.split())

    temperature_match = re.search(
        r"(?i)(temperature|temp)[^\d\-]{0,24}(-?\d+(?:\.\d+)?)\s*(?:°?\s*[CF])?",
        normalized,
    )
    humidity_match = re.search(
        r"(?i)(humidity|humid|relative humidity|rh)[^\d]{0,24}(\d+(?:\.\d+)?)\s*%",
        normalized,
    )

    return {
        "temperature": float(temperature_match.group(2)) if temperature_match else None,
        "humidity": float(humidity_match.group(2)) if humidity_match else None,
    }


def _extract_measurements(response: requests.Response) -> Dict[str, Optional[float]]:
    try:
        json_payload = response.json()
    except ValueError:
        json_payload = None

    if json_payload is not None:
        measured = _pick_measurements_from_json(json_payload)
        if measured["temperature"] is not None or measured["humidity"] is not None:
            return measured

    return _pick_measurements_from_text(response.text)


def _build_candidate_paths(requested_path: Optional[str]) -> List[str]:
    candidates: List[str] = []

    if requested_path:
        candidates.append(requested_path)

    if settings.VERTIV_STATUS_PATH:
        candidates.append(settings.VERTIV_STATUS_PATH)

    candidates.extend(_DEFAULT_PATHS)

    normalized: List[str] = []
    seen = set()
    for path in candidates:
        path_value = (path or "/").strip()
        if not path_value:
            continue
        if not path_value.startswith("/"):
            path_value = f"/{path_value}"
        if path_value not in seen:
            seen.add(path_value)
            normalized.append(path_value)

    return normalized


def get_current_user(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user_id = payload.get("sub")
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


@router.get("/live/temperature-humidity")
async def get_temperature_humidity(
    base_url: Optional[str] = None,
    path: Optional[str] = Query(default=None, description="Optional endpoint path override"),
    username: Optional[str] = None,
    password: Optional[str] = None,
    verify_ssl: Optional[bool] = None,
    timeout_seconds: Optional[int] = Query(default=None, ge=3, le=60),
    _current_user: Profile = Depends(get_current_user),
):
    """Read latest temperature and humidity from Vertiv Environment Alert endpoint."""
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

    auth = None
    if resolved_username and resolved_password:
        auth = HTTPBasicAuth(resolved_username, resolved_password)

    attempts: List[Dict[str, Any]] = []

    for candidate_path in _build_candidate_paths(path):
        endpoint = f"{resolved_base_url}{candidate_path}"

        try:
            response = requests.get(
                endpoint,
                auth=auth,
                timeout=resolved_timeout,
                verify=resolved_verify_ssl,
            )
        except requests.RequestException as exc:
            attempts.append(
                {
                    "endpoint": endpoint,
                    "ok": False,
                    "error": str(exc),
                }
            )
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

        measured = _extract_measurements(response)
        if measured["temperature"] is None and measured["humidity"] is None:
            attempts.append(
                {
                    "endpoint": endpoint,
                    "ok": False,
                    "status_code": response.status_code,
                    "error": "No temperature/humidity data found",
                }
            )
            continue

        return {
            "source": {
                "base_url": resolved_base_url,
                "endpoint": endpoint,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "status_code": response.status_code,
            },
            "measurements": {
                "temperature": {
                    "value": measured["temperature"],
                    "unit": "C",
                },
                "humidity": {
                    "value": measured["humidity"],
                    "unit": "%",
                },
            },
            "attempts": attempts,
        }

    attempted_endpoints = ", ".join(attempt["endpoint"] for attempt in attempts) or "none"
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=(
            "Cannot read temperature/humidity from Vertiv endpoint. "
            f"Tried: {attempted_endpoints}"
        ),
    )
