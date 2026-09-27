@echo off
cd /d "%~dp0"
echo Pool Shed is at http://127.0.0.1:8080/
echo Leave this window open.
python -m http.server 8080
pause
