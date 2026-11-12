@echo off
echo === Crewdesk setup ===
cd /d %~dp0backend
if not exist .venv python -m venv .venv
call .venv\Scripts\activate
pip install -r requirements.txt
if not exist .env copy .env.example .env
echo.
echo Edit backend\.env and put your MySQL password in DATABASE_URL, then run seed (optional) and start.bat
cd /d %~dp0frontend
call npm install
echo Setup finished.
pause
