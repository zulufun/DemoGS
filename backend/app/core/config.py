"""Application settings from environment variables"""

from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import List


class Settings(BaseSettings):
    """Configuration from .env file"""
    
    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
        json_schema_extra={
            "properties": {
                "CORS_ORIGINS": {"type": "string"}
            }
        }
    )
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@postgres:5432/demo"
    
    # JWT
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days
    
    # CORS (stored as string, parsed by validator)
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174"
    
    # Admin bootstrap
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "changeme"
    ADMIN_EMAIL: str = "admin@example.com"
    
    # Elasticsearch
    ELASTICSEARCH_URL: str = "http://elasticsearch:9200"
    ELASTICSEARCH_USERNAME: str = "elastic"
    ELASTICSEARCH_PASSWORD: str = "changeme"

    # Vertiv Environment Alert
    VERTIV_BASE_URL: str = "http://192.168.1.253"
    VERTIV_USERNAME: str = "admin"
    VERTIV_PASSWORD: str = "Vertiv@123"
    VERTIV_STATUS_PATH: str = "/"
    VERTIV_VERIFY_SSL: bool = False
    VERTIV_REQUEST_TIMEOUT_SECONDS: int = 15
    
    def get_cors_origins(self) -> List[str]:
        """Parse CORS origins from comma-separated string"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
