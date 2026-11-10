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

    # LED
    LED_MODE: str = "simulated"          # simulated | mqtt
    LED_DUREE_SECONDES: int = 15

    # YOLO
    YOLO_MODE: str = "mock"              # mock | inference
    YOLO_MODEL_PATH: str = "yolo/weights/best.pt"
    YOLO_SEUIL_CONFIANCE: float = 0.6

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

