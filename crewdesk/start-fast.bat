@echo off
rem Crewdesk (fast mode): builds the optimised app once and serves it, with no live reload.
rem Use this for daily use or when opening Crewdesk through a tunnel; use start.bat while editing code.
set API_PORT=8010
set WEB_PORT=5180
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%API_PORT% .*LISTENING" /c:":%WEB_PORT% .*LISTENING"') do taskkill /F /T /PID %%p >nul 2>&1
echo Building the Crewdesk app...
cd /d %~dp0frontend && call npm run build
echo Starting Crewdesk: API on http://127.0.0.1:%API_PORT% and app on http://localhost:%WEB_PORT%
start "Crewdesk API" cmd /k "cd /d %~dp0backend && .venv\Scripts\activate && uvicorn app.main:app --host 127.0.0.1 --port %API_PORT%"
start "Crewdesk Web" cmd /k "cd /d %~dp0frontend && set CREWDESK_API=http://127.0.0.1:%API_PORT%&& set CREWDESK_WEB_PORT=%WEB_PORT%&& npm run preview"
timeout /t 4 >nul
start http://localhost:%WEB_PORT%
