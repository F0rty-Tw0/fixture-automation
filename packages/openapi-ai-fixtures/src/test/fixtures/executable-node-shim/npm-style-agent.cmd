@ECHO off
SETLOCAL
SET "_prog=%~dp0\node.exe"
endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & set PATHEXT=%PATHEXT:;.JS;=;% & "%_prog%"  "%dp0%\fixture-agent.mjs" %*
