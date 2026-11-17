# PowerInsights

Dynamic Angular application with ASP.NET Core (.NET 10) APIs and a persistent SQLite database, seeded from the latest corrected Saudi HVDC/STATCOM reports. Includes 12 HVDC and 61 STATCOM/SVC records (54 current STATCOM projects and 7 legacy SVCs). Other technology tabs are excluded.

The Dashboard keeps the earlier dashboard's layout, colors, backgrounds, year/type stacked chart, Planned section, and cost/reference panels. The extra inner left/right margins are removed. Other tabs retain the analyst report's original layout. No iframe or static HTML report is loaded by the app.

## Quick start — Docker

Install Docker with Compose, then from this folder run:

```sh
docker compose up --build -d
```

Open **http://localhost:8080**. SQLite is created and seeded on first startup in the persistent `powerinsights-data` volume. Subsequent starts preserve edits. `docker compose down` preserves data; do not add `-v` unless intentionally discarding it.

## Quick start — without Docker

Install Node.js 24 LTS and .NET 10 SDK.

- Windows PowerShell: `./start.ps1`
- macOS/Linux: `./start.sh`

Open **http://localhost:5080**. Both scripts build Angular and serve it from ASP.NET Core. The database defaults to `backend/App_Data/powerinsights.db`.

For separate development servers:

```sh
# Terminal 1, from project root
dotnet run --project backend --urls http://127.0.0.1:5080

# Terminal 2
cd frontend
npm ci
npm start
```

Open http://localhost:4200. Angular proxies `/api` to port 5080.

## Editing and synchronization

Open **General Specs**, choose HVDC or STATCOM, filter/search, and click a project. Edit project identification, status, all general specifications, components, additional details, locations, scope and existing source mappings. Project rows on the Dashboard also open the editor. Use **Add project** to create a new HVDC or STATCOM record with every specification field available for that technology.

- **Save changes** writes to SQLite, increments the record revision, records before/after history, reloads the shared API dataset and redraws the active tab. Other tabs and exports use the refreshed dataset.
- **Cancel** discards unsaved edits. Network or validation failures leave edits in the dialog.
- Concurrent stale saves return HTTP 409 instead of overwriting newer work. Close, refresh and reopen to reconcile.
- Refresh reloads changes made in another browser. There is no background polling or push synchronization.
- Editing a spec clears its previous source mapping unless that mapping was explicitly changed. Historical source material is retained.
- Award/analysis year and numeric HVDC analysis capacity are separate from qualified source text. Imported interpretations are retained; when source date/capacity text changes the numeric interpretation is recalculated if unambiguous, otherwise left unavailable. An explicitly edited analysis value takes priority.
- Source lists/mappings and locations are edited as JSON in the dialog. Existing source IDs refer to imported source records; this release does not add source records or delete projects.

## Costs

Recorded USD costs always take priority. Missing costs use the agreed reference rates only when the voltage and equivalent MVAr are available. Equivalent MVAr is positive plus absolute negative rating, multiplied by an explicit unit count once. Ambiguous ratings remain unavailable, unless a verified equivalent total is entered.

- 13.8 kV: USD 5,333,333.333333333 / 20 = **USD 266,666.66666666665 per equivalent MVAr**. One ±10 MVAr unit costs USD 5.333m; two cost USD 10.667m.
- 33 kV: USD 36,990,827 / 600. Named NARI exceptions use USD 9,333,333.333333333 / 120.
- 132 kV: USD 37,573,333 / 600.
- Eight existing E-STATCOM package projects: USD 8m each, from USD 64m / 8.
- Legacy SVC rate references are retained. Unsupported voltages remain unavailable.

Calculations use unrounded decimal rates. Displayed amounts are rounded. Dashboard totals show pricing coverage and exclude unavailable values. The cost reference sheet is not modified.

## Functionality retained

All grid, Dashboard, STATCOM, HVDC and General Specs tabs; light/dark themes; project and status filters; search; year ranges; OEM/EPC chart filters; type and voltage filters; sorting; year/type percentages; cost summaries and reference table; Planned register; source details; HVDC connection view; filtered Excel downloads; General Specs CSV; and browser Print/PDF.

Charts and dashboard markup are ported from the report as reusable render modules to preserve the established appearance. Angular owns application startup, API state, edit forms and save/error handling. These modules receive the current shared dataset rather than embedding their own copy. D3 is bundled locally; the running app does not need a CDN.

## API

- `GET /api/health`
- `GET /api/data` — shared project dataset and references
- `GET /api/projects/{id}`
- `POST /api/projects` — create an HVDC or STATCOM record and assign its next technology ID
- `PUT /api/projects/{id}` — full editable record including its current `revision`
- `GET /api/projects/{id}/history` — latest 50 revisions with timestamps

SQL commands are parameterized. Project updates and audit entries are transactional. SQLite uses WAL mode and initializes only when the database is empty. The original project document structure is stored as validated JSON inside relational project, metadata and history tables to retain all imported specification fields and provenance.

## Deployment and backups

This is a local/private-network app, with no login or role management. Default run scripts and Compose bind to loopback. For shared use, deploy behind your organization's authenticated HTTPS reverse proxy. ASP.NET Core serves the compiled Angular assets and APIs on the same origin.

Set `DatabasePath` to an absolute writable path to relocate SQLite. Back up the database with SQLite's online backup API, or stop the app and copy the database together with any WAL files. Seed JSON is only an initial import, not the live database.

Sites/Cloudflare hosting cannot run this .NET process; the supplied Docker image is intended for a server or container host that supports .NET. No public deployment has been created.

## Validation

```sh
cd frontend
npm ci
npm run build
cd ..
dotnet build backend
dotnet run --project tests/PowerInsights.Tests -- "$PWD/backend"
```

Automated checks cover all imported records, corrected one/two-unit costs, equivalent MVAr, cost display synchronization, recorded-cost precedence, unsupported/ambiguous values, E-STATCOM allocation, HVDC derived fields, SQLite persistence, audit history, stale revision protection and required-name validation. Tests create a separate temporary database and do not alter the application database.

Browser QA verified project editing, saving, cost propagation to the Dashboard, restoration of test inputs, and the original Dashboard sections. Docker launch was not tested here because Docker is unavailable; Angular and .NET builds were run directly.
