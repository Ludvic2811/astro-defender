@echo off
chcp 65001 >nul
setlocal
title Astro Defender - Crear ZIP para llevar
cd /d "%~dp0"

echo.
echo  ============================================================
echo    CREAR ZIP DEL PROYECTO
echo  ============================================================
echo.
echo  Se incluye TODO lo necesario para que el juego funcione
echo  en otra computadora SIN internet.
echo.
echo  Solo se omite la cache de Terraform (895 MB que se
echo  regeneran solos y no sirven en otra computadora).
echo.

set "TEMPDIR=%TEMP%\AstroDefender-zip"
set "ZIP=%USERPROFILE%\Desktop\AstroDefender.zip"

if exist "%TEMPDIR%" rmdir /s /q "%TEMPDIR%"
if exist "%ZIP%" del /f /q "%ZIP%"

echo  [1/3] Reuniendo archivos...
robocopy "%CD%" "%TEMPDIR%" /E /NFL /NDL /NJH /NJS /NC /NS ^
  /XD .terraform .git __pycache__ ^
  /XF *.log terraform.tfvars backend.hcl *.tfstate *.tfstate.*
if errorlevel 8 goto errorCopia

echo  [2/3] Comprimiendo ^(puede tardar un minuto^)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Compress-Archive -Path '%TEMPDIR%\*' -DestinationPath '%ZIP%' -CompressionLevel Optimal -Force"
if errorlevel 1 goto errorZip

echo  [3/3] Limpiando archivos temporales...
rmdir /s /q "%TEMPDIR%"

for %%F in ("%ZIP%") do set TAM=%%~zF
set /a TAMMB=%TAM%/1048576

echo.
echo  ============================================================
echo    ZIP CREADO
echo  ============================================================
echo.
echo    Archivo:  %ZIP%
echo    Tamano:   %TAMMB% MB aprox.
echo.
echo  Esta en tu Escritorio. Copialo a una USB, mandalo por
echo  correo o subelo a Drive.
echo.
echo  ------------------------------------------------------------
echo   EN LA OTRA COMPUTADORA:
echo.
echo     1. Clic derecho en el ZIP y elige "Extraer todo..."
echo        (IMPORTANTE: extraerlo, no solo abrirlo)
echo.
echo     2. Entra a la carpeta y doble clic en INICIAR-JUEGO.bat
echo.
echo     3. Si Windows muestra un aviso azul de proteccion,
echo        haz clic en "Mas informacion" y luego en
echo        "Ejecutar de todas formas".
echo.
echo   Requisito unico: tener Node.js instalado
echo   (https://nodejs.org, version LTS)
echo  ------------------------------------------------------------
echo.
pause
exit /b 0

:errorCopia
echo.
echo  [ERROR] No se pudieron reunir los archivos.
pause
exit /b 1

:errorZip
echo.
echo  [ERROR] No se pudo crear el ZIP.
echo  Revisa que haya espacio libre en el disco.
pause
exit /b 1
