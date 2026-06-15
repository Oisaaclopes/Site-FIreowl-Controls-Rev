@echo off
setlocal

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado. Abrindo a versao local estatica.
  start "" "%~dp0index.html"
  exit /b 0
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm nao foi encontrado. Abrindo a versao local estatica.
  start "" "%~dp0index.html"
  exit /b 0
)

if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

echo Abrindo Fireowl Controls em http://127.0.0.1:3000
start "" http://127.0.0.1:3000
call npm run dev
