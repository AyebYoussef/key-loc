@echo off
chcp 65001 > nul
echo ========================================================
echo        KeyLocator - Lancement Global (V1)
echo ========================================================

echo.
echo [1/2] Lancement du Backend FastAPI (port 8000)...
start "KeyLocator - Backend FastAPI" cmd /k "cd backend && venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo.
echo [2/2] Lancement du Frontend Angular (port 4200)...
start "KeyLocator - Frontend Angular" cmd /k "cd frontend && npm start"

echo.
echo ========================================================
echo Les services sont en cours de démarrage :
echo   - Backend API  : http://localhost:8000/docs
echo   - Application  : http://localhost:4200 (PC ou Mobile)
echo   - Accès Mobile : ouvrir http://localhost:4200 (ou http://^<IP_PC^>:4200 en Wi-Fi)
echo ========================================================
pause

