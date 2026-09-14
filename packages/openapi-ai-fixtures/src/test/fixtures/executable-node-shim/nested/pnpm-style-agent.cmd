@SETLOCAL
@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe" "%~dp0\..\fixture-agent.mjs" %*
) ELSE (
  node "%~dp0\..\fixture-agent.mjs" %*
)
