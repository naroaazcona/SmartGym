@echo off
setlocal EnableExtensions EnableDelayedExpansion
rem --- No cambies el orden de estas 3 líneas ---
rem Obtener ESC real para ANSI en CMD (método robusto)
for /f "delims=" %%A in ('echo prompt $E^| cmd') do set "ESC=%%A"
set "RESET=%ESC%[0m"

rem Colores
set "RED=%ESC%[91m"
set "GREEN=%ESC%[92m"
set "YELLOW=%ESC%[93m"
set "BLUE=%ESC%[94m"
set "MAGENTA=%ESC%[95m"
set "CYAN=%ESC%[96m"
set "WHITE=%ESC%[97m"

rem (Opcional) UTF-8 para emojis/tildes: ponlo al final para no interferir con ESC
chcp 65001 >nul

cls
echo %GREEN%================================
echo       🏋️‍♂️ INICIANDO SMARTGYM
echo ================================%RESET%
echo.

echo %YELLOW%🔧 Limpiando contenedores anteriores...%RESET%
docker-compose down --remove-orphans >nul 2>&1

echo %BLUE%🚀 Iniciando servicios en segundo plano...%RESET%
docker-compose up -d >nul 2>&1

echo %CYAN%⏳ Comprobando servicios (hasta 30s)...%RESET%

rem ---- Definir servicios: Nombre|URL|Color ----
set "SVC1=Frontend|http://localhost:8080|%BLUE%"
set "SVC2=API Gateway|http://localhost:3000/health|%YELLOW%"
set "SVC3=Auth Service|http://localhost:3001/health|%RED%"
set "SVC4=Gym Service|http://localhost:3002/health|%GREEN%"
set "SVC5=Training|http://localhost:5000/health|%MAGENTA%"

rem ---- Inicializar estados ----
for /L %%i in (1,1,5) do set "OK%%i="

set "RETRIES=30"
:wait_loop
set "PENDING="
for /L %%i in (1,1,5) do (
  if not defined OK%%i (
    for /f "tokens=1-3 delims=|" %%A in ("!SVC%%i!") do (
      set "NAME=%%A"
      set "URL=%%B"
      rem Pedir solo el código HTTP. Si URL está vacía, evitar llamar a curl.
      if defined URL (
        for /f "usebackq delims=" %%H in (`curl -s -o NUL -w "%%{http_code}" "%%B" 2^>NUL`) do set "CODE=%%H"
        call :is_ok "!CODE!" && set "OK%%i=1"
      )
    )
  )
)
for /L %%i in (1,1,5) do if not defined OK%%i set "PENDING=1"

if defined PENDING (
  set /a RETRIES-=1
  if %RETRIES% gtr 0 (
    timeout /t 1 /nobreak >nul
    goto :wait_loop
  )
)

echo.
echo %MAGENTA%📊 ESTADO DE LOS SERVICIOS:%RESET%
echo %MAGENTA%================================%RESET%
for /L %%i in (1,1,5) do (
  for /f "tokens=1-3 delims=|" %%A in ("!SVC%%i!") do (
    if defined OK%%i (
      echo %GREEN%✅ %%A%RESET%  %%B
    ) else (
      echo %RED%❌ %%A%RESET%  %%B
    )
  )
)

echo.
echo %WHITE%================================%RESET%
echo %CYAN%📋 Comandos útiles:%RESET%
echo %YELLOW%Ver logs en tiempo real:%RESET%  docker-compose logs -f
echo %YELLOW%Ver logs de un servicio:%RESET%  docker-compose logs -f auth-service
echo %RED%Detener todos:%RESET%               docker-compose down
echo %GREEN%Reiniciar un servicio:%RESET%     docker-compose restart auth-service
echo %WHITE%================================%RESET%

endlocal
goto :eof

:is_ok
rem Devuelve 0 (éxito) si 200 <= código < 500
setlocal EnableDelayedExpansion
set "X=%~1"
for /f "delims=." %%d in ("!X!") do set "X=%%d"
if not defined X exit /b 1
if %X% lss 200 exit /b 1
if %X% geq 500 exit /b 1
exit /b 0
