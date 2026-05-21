@echo off
setlocal

if not defined SystemRoot set "SystemRoot=C:\WINDOWS"
if not defined WINDIR set "WINDIR=C:\WINDOWS"
if not defined ComSpec set "ComSpec=C:\WINDOWS\System32\cmd.exe"

if not defined USERPROFILE if defined HOMEDRIVE if defined HOMEPATH set "USERPROFILE=%HOMEDRIVE%%HOMEPATH%"
if not defined USERPROFILE if defined SystemDrive if defined USERNAME set "USERPROFILE=%SystemDrive%\Users\%USERNAME%"
if not defined USERPROFILE if defined USERNAME set "USERPROFILE=C:\Users\%USERNAME%"
if not defined APPDATA set "APPDATA=%USERPROFILE%\AppData\Roaming"
if not defined LOCALAPPDATA set "LOCALAPPDATA=%USERPROFILE%\AppData\Local"

if not defined HOMEDRIVE set "HOMEDRIVE=%USERPROFILE:~0,2%"
if not defined HOMEPATH set "HOMEPATH=%USERPROFILE:~2%"

echo codex-env-bootstrap: done
echo SystemRoot=%SystemRoot%
echo WINDIR=%WINDIR%
echo ComSpec=%ComSpec%
echo APPDATA=%APPDATA%
echo LOCALAPPDATA=%LOCALAPPDATA%

endlocal & (
  set "SystemRoot=%SystemRoot%"
  set "WINDIR=%WINDIR%"
  set "ComSpec=%ComSpec%"
  set "USERPROFILE=%USERPROFILE%"
  set "APPDATA=%APPDATA%"
  set "LOCALAPPDATA=%LOCALAPPDATA%"
  set "HOMEDRIVE=%HOMEDRIVE%"
  set "HOMEPATH=%HOMEPATH%"
)
