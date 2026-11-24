"""
Configuration centrale — lit les variables d'environnement via pydantic-settings.
"""
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # Base de données
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "keylocator"
    DB_USER: str = "root"
    DB_PASSWORD: str = ""

    # JWT
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # LED & IoT
    LED_MODE: str = "simulated"          # simulated | mqtt
    LED_DUREE_SECONDES: int = 10
    ESP8266_IP: str | None = None        # Optionnel : IP de l'ESP8266 (ex: 192.168.1.50) pour push direct

    # YOLO & Reconnaissance
    YOLO_MODE: str = "mock"                   # mock | real
    YOLO_MODEL_PATH: str = "ml/best.pt"
    YOLO_CONFIDENCE_THRESHOLD: float = 0.6
    BLUR_THRESHOLD: float = 40.0

    @property
    def YOLO_SEUIL_CONFIANCE(self) -> float:
        """Alias rétrocompatible vers YOLO_CONFIDENCE_THRESHOLD."""
        return self.YOLO_CONFIDENCE_THRESHOLD

    # Dataset & Photos de référence ML
    UPLOAD_DIR: str = "uploads"
    ML_DATASET_MIN_PHOTOS: int = 30
    MAX_PHOTO_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 Mo par photo

    # Serveur
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            f"?charset=utf8mb4"
        )


settings = Settings()

