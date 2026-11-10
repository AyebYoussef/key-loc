"""
Session SQLAlchemy — connexion MySQL via PyMySQL.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,       # vérifie la connexion avant chaque requête
    pool_recycle=3600,        # recycle les connexions après 1h
    echo=settings.DEBUG,      # log SQL si DEBUG=true
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dépendance FastAPI : fournit une session DB et la ferme après la requête."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

