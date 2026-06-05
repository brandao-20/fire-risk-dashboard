@echo off
title FireRisk Portugal Dashboard
cd /d "%~dp0"
if not exist node_modules (
  echo A instalar dependencias...
  npm install
)
echo A iniciar dashboard em http://localhost:3000
npm start
pause
