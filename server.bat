@echo off
cd /d "%~dp0"
python server.py 2>nul || py server.py
pause