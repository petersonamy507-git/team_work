@echo off
rem Ports: change here if 8000/5173 are used by something else on your PC.
set API_PORT=8010
set WEB_PORT=5180
echo Starting Crewdesk: API on http://localhost:%API_PORT% and app on http://localhost:%WEB_PORT%
start "Crewdesk API" cmd /k "cd /d %~dp0backend && .venv\Scripts\activate && uvicorn app.main:app --reload --port %API_PORT%"
start "Crewdesk Web" cmd /k "cd /d %~dp0frontend && set CREWDESK_API=http://localhost:%API_PORT%&& set CREWDESK_WEB_PORT=%WEB_PORT%&& npm run dev"
timeout /t 5 >nul
start http://localhost:%WEB_PORT%
