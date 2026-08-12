param([string]$FlowiseHome = $env:FLOWISE_HOME)
$ErrorActionPreference = "Stop"
if (-not $FlowiseHome) { $FlowiseHome = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\agent编排")) }
if (-not (Test-Path -LiteralPath (Join-Path $FlowiseHome "package.json"))) { throw "Flowise 工程不存在：$FlowiseHome" }
$env:HOST = "127.0.0.1"
$env:PORT = "3200"
$env:CORS_ORIGINS = "http://127.0.0.1:3000"
$env:IFRAME_ORIGINS = "http://127.0.0.1:3000"
$env:DISABLE_FLOWISE_TELEMETRY = "true"
$env:DATABASE_PATH = Join-Path $FlowiseHome ".flowise"
$env:BLOB_STORAGE_PATH = Join-Path $FlowiseHome ".flowise\storage"
$env:LOG_SANITIZE_HEADER_FIELDS = "authorization,x-api-key"
$env:LOG_SANITIZE_BODY_FIELDS = "apiKey,password,credential"
Set-Location -LiteralPath $FlowiseHome
pnpm exec flowise start
