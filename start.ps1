$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Push-Location frontend
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Angular build failed' }
Pop-Location
New-Item -ItemType Directory -Force backend/wwwroot | Out-Null
Copy-Item frontend/dist/powerinsights/browser/* backend/wwwroot -Recurse -Force
dotnet run --project backend/PowerInsights.Api.csproj --urls http://127.0.0.1:5080
