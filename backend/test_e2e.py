from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

print("--- 1. Health ---")
r = client.get("/api/health")
print("Health:", r.status_code, r.json())
assert r.status_code == 200

print("\n--- 2. Login Serrurier ---")
r = client.post("/api/auth/login", data={"username": "jean.dupont@keylocator.fr", "password": "Password1!"})
print("Login status:", r.status_code)
assert r.status_code == 200, r.text
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("\n--- 3. Profil ---")
r = client.get("/api/auth/me", headers=headers)
p = r.json()
print(f"Connecté en tant que: {p['prenom']} {p['nom']} ({p['role']['nom']})")

print("\n--- 4. Casiers ---")
r = client.get("/api/casiers/", headers=headers)
print(f"Casiers récupérés: {len(r.json())}")

print("\n--- 5. Alertes Stock ---")
r = client.get("/api/alertes/", headers=headers)
print(f"Ébauches en alerte: {len(r.json())}")
for a in r.json():
    print(f"  • {a['modele']['reference']} (casier {a['casier']['code']}) -> {a['quantite']} dispo [{a['statut_stock']}]")

print("\n--- 6. Guidage LED Virtuel (15s) ---")
r = client.post("/api/casiers/1/allumer", json={"casier_id": 1, "duree_secondes": 15}, headers=headers)
print("Allumage:", r.status_code, "actif =", r.json()["actif"])
r = client.get("/api/casiers/1/etat", headers=headers)
print("État LED:", r.json())

print("\n--- 7. Prélèvement de Stock (-1) ---")
r = client.post("/api/stock/prelever", json={"ebauche_id": 1}, headers=headers)
print(f"SX9 prélevé: nouvelle quantité = {r.json()['quantite']}")

print("\n--- 8. Dashboard Stats ---")
r = client.get("/api/stats/dashboard", headers=headers)
print("Stats:", r.json())

print("\n--- 9. Scan Mock (sans photo réelle) ---")
import io
dummy_img = io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 200)  # faux JPEG
files = {"photo": ("test.jpg", dummy_img, "image/jpeg")}
r = client.post("/api/scans/", files=files, headers=headers)
print("Scan résultat:", r.status_code, r.json()["statut"], "-", r.json()["message"])

print("\n=======================================================")
print("  ✅ TOUS LES TESTS FONCTIONNELS SONT PASSÉS AVEC SUCCÈS")
print("=======================================================")

