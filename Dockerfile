FROM node:24-bookworm-slim AS ui
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY backend/ ./
RUN dotnet publish PowerInsights.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /app ./
COPY --from=ui /src/frontend/dist/powerinsights/browser ./wwwroot/
RUN mkdir -p /data && chown -R app:app /data /app
USER app
ENV ASPNETCORE_URLS=http://+:8080 DatabasePath=/data/powerinsights.db
EXPOSE 8080
ENTRYPOINT ["dotnet","PowerInsights.Api.dll"]
