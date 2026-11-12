@echo off
cd /d %~dp0backend
call .venv\Scripts\activate
python seed.py
pause
