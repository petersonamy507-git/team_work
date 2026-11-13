@echo off
rem Crewdesk (development mode, live reload). For the fastest app use start-fast.bat.
rem Ports: change here if 8010/5180 are used by something else on your PC.
set API_PORT=8010
set WEB_PORT=5180
rem stop any Crewdesk servers that are still running, so two copies never share a port
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%API_PORT% .*LISTENING" /c:":%WEB_PORT% .*LISTENING"') do taskkill /F /T /PID %%p >nul 2>&1
echo Starting Crewdesk: API on http://127.0.0.1:%API_PORT% and app on http://localhost:%WEB_PORT%
start "Crewdesk API" cmd /k "cd /d %~dp0backend && .venv\Scripts\activate && uvicorn app.main:app --reload --host 127.0.0.1 --port %API_PORT%"
start "Crewdesk Web" cmd /k "cd /d %~dp0frontend && set CREWDESK_API=http://127.0.0.1:%API_PORT%&& set CREWDESK_WEB_PORT=%WEB_PORT%&& npm run dev"
timeout /t 5 >nul
start http://localhost:%WEB_PORT%
