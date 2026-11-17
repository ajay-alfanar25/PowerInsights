#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
(cd frontend && npm ci && npm run build)
mkdir -p backend/wwwroot
cp -R frontend/dist/powerinsights/browser/. backend/wwwroot/
dotnet run --project backend/PowerInsights.Api.csproj --urls http://127.0.0.1:5080
