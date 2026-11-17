#!/usr/bin/env bash
set -euo pipefail
port="${PORT:-3000}"
while [ $# -gt 0 ]; do
  if [ "$1" = "--port" ]; then port="$2"; shift 2; else shift; fi
done
exec "${POWERINSIGHTS_DOTNET:-dotnet}" run --project backend/PowerInsights.Api.csproj --no-build --urls "http://0.0.0.0:$port"
