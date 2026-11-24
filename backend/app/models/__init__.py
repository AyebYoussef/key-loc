# Imports centralisés des modèles pour que SQLAlchemy les enregistre tous
from app.models.utilisateur import Role, Utilisateur
from app.models.modele import Fabricant, ModeleCle, Equivalence
from app.models.casier import Casier, Ebauche, EbauchePhoto, MouvementStock, EtatLed, Scan

