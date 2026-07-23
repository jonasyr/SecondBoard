# Calibration Ingest Server

Receives chess.com Game Review data captured by the SecondBoard Calibration
Capture browser extension (see `../extension/README.md`) and stores it in a
local SQLite file. Designed to run on a home LAN only — never expose this
to the public internet.

## Deploy with Docker Compose

1. Pick a long random shared secret, e.g. `openssl rand -hex 32`.
2. From this directory:

   ```bash
   INGEST_SHARED_TOKEN=<your-secret> docker compose up -d --build
   ```

3. The server listens on port `8787`. Data persists in the `calibration-data`
   Docker volume across restarts.
4. Give the extension's options page (on the contributor's machine) this
   server's LAN IP (e.g. `http://192.168.1.50:8787/ingest`) and the same
   shared secret.

## Endpoints

- `POST /ingest` — header `x-ingest-token: <shared-secret>`, JSON body is
  the captured `analyzeGame` payload. Upserts by `gameId`.
- `GET /export` — header `x-ingest-token: <shared-secret>`, optional
  `?since=<ISO-8601 timestamp>` query param. Returns `{ "games": [...] }`.

## Local development (without Docker)

```bash
pnpm install
mkdir -p data
INGEST_SHARED_TOKEN=local-dev-token pnpm start
```

## Pulling captured games onto your dev machine

```bash
curl -H "x-ingest-token: <shared-secret>" http://<home-server-ip>:8787/export > games-export.json
```

Wiring this into the project's own calibration scripts
(`scripts/calibration/calibrate.ts` etc.) is separate follow-up work, not
covered here.
