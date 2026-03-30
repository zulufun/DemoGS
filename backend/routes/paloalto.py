"""Palo Alto logs routes"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import requests
import base64
from database import get_db
from config import settings
from security import decode_token, get_bearer_token
from models import Profile

router = APIRouter()


def get_current_user(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Extract and validate current user from JWT token"""
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


def _get_es_auth_header() -> dict:
    """Get Elasticsearch Basic auth header"""
    credentials = f"{settings.ELASTICSEARCH_USERNAME}:{settings.ELASTICSEARCH_PASSWORD}"
    encoded = base64.b64encode(credentials.encode()).decode()
    return {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/json"
    }


@router.get("/logs/count")
def get_logs_count(current_user: Profile = Depends(get_current_user)):
    """Get count of Palo Alto logs in Elasticsearch"""
    try:
        url = f"{settings.ELASTICSEARCH_URL}/paloalto-logs-*/_count"
        response = requests.get(
            url,
            headers=_get_es_auth_header(),
            timeout=10
        )
        
        if response.status_code != 200:
            raise Exception(f"Elasticsearch error: {response.status_code}")
        
        data = response.json()
        count = data.get("count", 0)
        
        return {
            "status": "success",
            "index_pattern": "paloalto-logs-*",
            "total_logs": count,
            "message": f"Tổng cộng {count:,} sự kiện từ Palo Alto firewall"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error querying Elasticsearch: {str(e)}"
        )


@router.get("/logs/by-server")
def get_logs_by_server(current_user: Profile = Depends(get_current_user)):
    """Get log count by server/location"""
    try:
        url = f"{settings.ELASTICSEARCH_URL}/paloalto-logs-*/_search"
        body = {
            "size": 0,
            "aggs": {
                "by_server": {
                    "terms": {
                        "field": "server_name.keyword",
                        "size": 100
                    }
                }
            }
        }
        
        response = requests.post(
            url,
            json=body,
            headers=_get_es_auth_header(),
            timeout=10
        )
        
        if response.status_code != 200:
            raise Exception(f"Elasticsearch error: {response.status_code}")
        
        data = response.json()
        buckets = data.get("aggregations", {}).get("by_server", {}).get("buckets", [])
        
        return {
            "status": "success",
            "servers": [
                {"name": bucket["key"], "count": bucket["doc_count"]}
                for bucket in buckets
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error querying Elasticsearch: {str(e)}"
        )


@router.get("/logs/by-action")
def get_logs_by_action(current_user: Profile = Depends(get_current_user)):
    """Get log count by action"""
    try:
        url = f"{settings.ELASTICSEARCH_URL}/paloalto-logs-*/_search"
        body = {
            "size": 0,
            "aggs": {
                "by_action": {
                    "terms": {
                        "field": "action.keyword",
                        "size": 50
                    }
                }
            }
        }
        
        response = requests.post(
            url,
            json=body,
            headers=_get_es_auth_header(),
            timeout=10
        )
        
        if response.status_code != 200:
            raise Exception(f"Elasticsearch error: {response.status_code}")
        
        data = response.json()
        buckets = data.get("aggregations", {}).get("by_action", {}).get("buckets", [])
        
        return {
            "status": "success",
            "actions": [
                {"action": bucket["key"], "count": bucket["doc_count"]}
                for bucket in buckets
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error querying Elasticsearch: {str(e)}"
        )
