@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Astro Defender - Servidor local
cd /d "%~dp0"

echo.
echo  ============================================================
echo    ASTRO DEFENDER: INVASION GALACTICA
echo    Iniciando el juego en esta computadora...
echo  ============================================================
echo.

REM ---------- 1. Verificar que Node.js este instalado ----------
where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] No se encontro Node.js en esta computadora.
  echo.
  echo  Instalalo desde:  https://nodejs.org
  echo  Elige la version "LTS", acepta todo y vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODEVER=%%v
echo  [OK] Node.js !NODEVER! detectado.

REM ---------- 2. Instalar dependencias la primera vez ----------
if not exist "server\node_modules" (
  echo  [...] Instalando dependencias del servidor ^(solo la primera vez^)...
  call npm install --prefix server --silent --no-audit --no-fund
  if errorlevel 1 goto errorNpm
)
if not exist "lobby\node_modules" (
  echo  [...] Instalando dependencias del lobby ^(solo la primera vez^)...
  call npm install --prefix lobby --silent --no-audit --no-fund
  if errorlevel 1 goto errorNpm
)
echo  [OK] Dependencias listas.

REM ---------- 3. Liberar los puertos si quedaron ocupados ----------
for %%P in (7777 8080 9100) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /r /c:":%%P .*LISTENING"') do (
    taskkill /F /PID %%A >nul 2>nul
  )
)

REM ---------- 4. Arrancar los dos servidores ----------
start "Astro Defender - Servidor de juego" /min cmd /c "node server\src\index.js"
start "Astro Defender - Lobby web" /min cmd /c "node lobby\src\index.js"
echo  [...] Arrancando servidores...

REM Esperar a que el lobby responda (maximo ~15 s)
set READY=0
for /l %%i in (1,1,30) do (
  if !READY!==0 (
    timeout /t 1 /nobreak >nul
    curl -s -o nul http://localhost:8080/healthz 2>nul && set READY=1
  )
)

REM ---------- 5. Mostrar las direcciones y abrir el navegador ----------
echo.
echo  ============================================================
echo    EL JUEGO YA ESTA CORRIENDO
echo  ============================================================
echo.
echo    En esta computadora:   http://localhost:8080
echo.
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=1" %%j in ("%%i") do (
    echo    Desde otro dispositivo en la misma red Wi-Fi:
    echo       http://%%j:8080
  )
)
echo.
echo    Para el modo COOPERATIVO: cada jugador abre la direccion
echo    y elige "Partida rapida" o "Crear sala privada".
echo.
echo  ------------------------------------------------------------
echo    Para DETENER el juego: cierra esta ventana o presiona una
echo    tecla. Se cerraran los servidores automaticamente.
echo  ------------------------------------------------------------
echo.

start "" http://localhost:8080
pause >nul

REM ---------- 6. Apagar los servidores al salir ----------
echo.
echo  Deteniendo los servidores...
for %%P in (7777 8080 9100) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /r /c:":%%P .*LISTENING"') do (
    taskkill /F /PID %%A >nul 2>nul
  )
)
echo  Listo. Hasta la proxima, piloto.
timeout /t 2 /nobreak >nul
exit /b 0

:errorNpm
echo.
echo  [ERROR] Fallo la instalacion de dependencias.
echo  Revisa que haya conexion a internet y vuelve a intentarlo.
echo.
pause
exit /b 1
