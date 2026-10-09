@echo off
chcp 65001 >nul
rem 用 Windows 內建的 .NET Framework 4.8 編譯器建置播放器，不需要安裝任何東西
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
"%CSC%" /nologo /target:winexe /optimize+ /codepage:65001 /platform:x64 /win32icon:"%~dp0app.ico" /resource:"%~dp0app.ico",app.ico /out:"%~dp0..\ASCII桌布播放器.exe" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll "%~dp0Player.cs"
if errorlevel 1 (echo 建置失敗 & exit /b 1)
echo 建置完成：%~dp0..\ASCII桌布播放器.exe
