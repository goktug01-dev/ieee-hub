@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
title IEEE IKCU Hub - yerel demo

rem ---- Node.js ----
where node >nul 2>nul
if errorlevel 1 goto nonode

rem ---- Java: sistemde yoksa proje klasorune tasinabilir surum indirilir ----
where java >nul 2>nul
if not errorlevel 1 goto deps
if exist ".tools\jre\bin\java.exe" goto setjava
echo Java bulunamadi. Tasinabilir Java indiriliyor - yaklasik 50 MB, yalnizca ilk seferde...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; New-Item -ItemType Directory -Force .tools | Out-Null; Invoke-WebRequest -UseBasicParsing 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse' -OutFile .tools\jre.zip; Expand-Archive .tools\jre.zip .tools\jre-tmp -Force; $d = Get-ChildItem .tools\jre-tmp -Directory | Select-Object -First 1; Move-Item $d.FullName .tools\jre; Remove-Item .tools\jre-tmp, .tools\jre.zip -Recurse -Force"
if errorlevel 1 goto nojava
:setjava
set "JAVA_HOME=%CD%\.tools\jre"
set "PATH=%CD%\.tools\jre\bin;%PATH%"

:deps
if exist node_modules goto run
echo Bagimliliklar kuruluyor - ilk seferde birkac dakika surebilir...
call npm.cmd install
if errorlevel 1 goto fail

:run
echo.
echo Emulatorler ayri bir pencerede aciliyor. O pencereyi KAPATMAYIN.
start "Hub - Firebase emulatorleri" cmd /k "npm.cmd run emulators"

set /a tries=0
:wait
set /a tries+=1
if %tries% gtr 60 goto fail
timeout /t 2 /nobreak >nul
curl -s -o nul http://127.0.0.1:9099/ >nul 2>nul
if errorlevel 1 goto wait
curl -s -o nul http://127.0.0.1:8080/ >nul 2>nul
if errorlevel 1 goto wait

echo.
echo Hazir! Tarayici aciliyor: http://localhost:5173
echo Giris ekranindaki "Demo hesaplari" ile tek tikla girebilirsiniz. Sifre: demo1234
echo Kapatmak icin bu pencerede Ctrl+C, sonra emulator penceresini kapatin.
echo.
call npm.cmd run dev -- --open
goto end

:nonode
echo Node.js bulunamadi. https://nodejs.org adresinden LTS surumunu kurup tekrar deneyin.
pause
exit /b 1

:nojava
echo Java indirilemedi. Internet baglantinizi kontrol edin veya Java 21 kurun: winget install EclipseAdoptium.Temurin.21.JRE
pause
exit /b 1

:fail
echo Bir sorun olustu. Yukaridaki hata mesajini TechOps ile paylasin.
pause
exit /b 1

:end
endlocal
