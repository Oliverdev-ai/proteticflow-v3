@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "MISSING_HOST_ENV="
if not defined SystemRoot set "MISSING_HOST_ENV=!MISSING_HOST_ENV! SystemRoot"
if not defined WINDIR set "MISSING_HOST_ENV=!MISSING_HOST_ENV! WINDIR"
if not defined ComSpec set "MISSING_HOST_ENV=!MISSING_HOST_ENV! ComSpec"

if defined MISSING_HOST_ENV (
  echo session-check: fail ^(codex-host-env^)
  echo Variaveis criticas ausentes no shell do Codex:!MISSING_HOST_ENV!
  echo next: PowerShell: . .\scripts\codex-env-bootstrap.ps1
  echo next: Command Prompt: call scripts\codex-env-bootstrap.cmd
  echo next: rode novamente: cmd /c scripts\session-check.cmd
  exit /b 3
)

echo shell: ok
echo cwd: %CD%

git rev-parse --is-inside-work-tree 1>nul 2>nul
if errorlevel 1 (
  echo session-check: fail ^(git^)
  echo CWD nao esta dentro de um repositorio Git valido.
  echo next: abra o workspace correto e rode: pnpm session:check
  exit /b 1
)

set "BRANCH_NAME="
for /f "delims=" %%B in ('git branch --show-current 2^>nul') do if not defined BRANCH_NAME set "BRANCH_NAME=%%B"
if not defined BRANCH_NAME (
  echo session-check: fail ^(git-status^)
  echo Nao foi possivel ler o status da branch.
  echo next: rode: git branch --show-current
  exit /b 1
)

set "UPSTREAM_NAME="
for /f "delims=" %%U in ('git rev-parse --abbrev-ref --symbolic-full-name @{upstream} 2^>nul') do if not defined UPSTREAM_NAME set "UPSTREAM_NAME=%%U"

set "PORCELAIN_FIRST="
for /f "delims=" %%S in ('git status --porcelain 2^>nul') do if not defined PORCELAIN_FIRST set "PORCELAIN_FIRST=%%S"

set "WORKTREE_STATUS=clean"
if defined PORCELAIN_FIRST set "WORKTREE_STATUS=dirty"

echo git: ok
if defined UPSTREAM_NAME (
  echo branch: ## !BRANCH_NAME!...!UPSTREAM_NAME!
) else (
  echo branch: ## !BRANCH_NAME!
)
echo status: !WORKTREE_STATUS!

set "TMP_LOG=%TEMP%\codex-session-check-%RANDOM%-%RANDOM%.log"
node -e "require('crypto').randomBytes(1)" 1>nul 2>"!TMP_LOG!"
set "NODE_EXIT=%ERRORLEVEL%"

if not "%NODE_EXIT%"=="0" (
  set "HAS_CSPRNG=1"
  set "HAS_CODEX=1"
  set "HAS_8009001D=1"

  findstr /i /c:"ncrypto::CSPRNG(nullptr, 0)" "!TMP_LOG!" >nul && set "HAS_CSPRNG=0"
  findstr /i /c:"OpenAI.Codex" "!TMP_LOG!" >nul && set "HAS_CODEX=0"
  findstr /i /c:"8009001d" "!TMP_LOG!" >nul && set "HAS_8009001D=0"

  if "!HAS_CSPRNG!"=="0" goto host_runtime_fail
  if "!HAS_CODEX!"=="0" goto host_runtime_fail
  if "!HAS_8009001D!"=="0" goto host_runtime_fail

  echo session-check: fail ^(node-crypto^)
  echo Node respondeu, mas crypto.randomBytes falhou no ambiente atual.
  echo next: rode: node -e "require('crypto').randomBytes^(1^)"
  del /q "!TMP_LOG!" >nul 2>&1
  exit /b 1
)

del /q "!TMP_LOG!" >nul 2>&1
echo crypto.randomBytes: ok
echo shell-ok
exit /b 0

:host_runtime_fail
echo session-check: fail (codex-host-runtime)
echo Falha no runtime Node/Crypto do Codex antes de executar codigo do projeto. Nao e problema do repo.
echo next: rode em terminal externo: node -e "require('crypto').randomBytes(1)"
echo next: troque o shell do Codex para Command Prompt ou Git Bash e repita: pnpm session:check
echo next: se persistir, reinicie/atualize o app Codex
del /q "!TMP_LOG!" >nul 2>&1
exit /b 2
