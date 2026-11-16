@echo off
chcp 65001 >nul
setlocal
title Astro Defender - Preparar copia para llevar
cd /d "%~dp0\.."

echo.
echo  ============================================================
echo    PREPARAR COPIA DEL PROYECTO
echo    Copia limpia, sin archivos temporales pesados.
echo  ============================================================
echo.
echo  Ejemplos de destino:
echo     E:\AstroDefender              ^(una memoria USB^)
echo     C:\Users\%USERNAME%\Desktop\AstroDefender-entrega
echo.

set "DESTINO=%~1"
if "%DESTINO%"=="" set /p DESTINO="  Escribe la carpeta destino: "
if "%DESTINO%"=="" (
  echo  [ERROR] No escribiste ningun destino.
  pause
  exit /b 1
)

echo.
echo  Copiando a: %DESTINO%
echo  ^(se omiten node_modules, .terraform, .git y archivos .log^)
echo.

robocopy "%CD%" "%DESTINO%" /E /NFL /NDL /NJH /NJS /NC /NS ^
  /XD node_modules .terraform .git __pycache__ resultados ^
  /XF *.log terraform.tfvars backend.hcl *.tfstate *.tfstate.*

if errorlevel 8 (
  echo.
  echo  [ERROR] No se pudo copiar. Revisa que el destino exista
  echo  y que tengas permiso de escritura.
  echo.
  pause
  exit /b 1
)

echo.
echo  ============================================================
echo    COPIA TERMINADA
echo  ============================================================
echo.
echo  En la otra computadora:
echo    1. Instala Node.js desde https://nodejs.org ^(version LTS^)
echo    2. Abre la carpeta copiada
echo    3. Doble clic en  INICIAR-JUEGO.bat
echo.
echo  La primera vez tarda ~1 minuto instalando dependencias
echo  ^(necesita internet solo esa vez^).
echo.
pause
exit /b 0
