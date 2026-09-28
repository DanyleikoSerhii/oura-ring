# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Frontend-only Vue.js application. It fetches data from the Oura Ring API and shows the key health metrics in a polished, visually appealing dashboard.

## Stack

Vue 3 + TypeScript, Vite, Vue Router, Pinia, Tailwind CSS v4 (tokens in `src/style.css`), Dexie (IndexedDB), ECharts (`vue-echarts`), date-fns, lucide icons, oxlint (lint), oxfmt (format).

## Commands

Package manager is pnpm (pinned via `packageManager`).

- `pnpm install`
- `pnpm oura:auth` — one-time OAuth2 login to Oura (see Architecture); writes `.oura-tokens.json`
- `pnpm dev` — dev server
- `pnpm build` — type-check (`vue-tsc`) + production build
- `pnpm type-check` — types only
- `pnpm lint` — oxlint with `--fix`; `pnpm lint:check` — no fix
- `pnpm format` — oxfmt on `src/ tools/ scripts/` (config in `.oxfmtrc.json`); `pnpm format:check` — verify only
- `pnpm test` — checks only: `lint:check` + `format:check`

Node `^22.18.0 || >=24.12.0` is required.

## Architecture

Single-user, local-only, desktop-first, dark theme, Russian UI. Plan and decisions: `docs/PLAN.md`.

- **Auth/CORS:** Oura personal access tokens are deprecated, so auth is OAuth2 (authorization code). `pnpm oura:auth` (`scripts/oura-auth.ts`) reads `OURA_CLIENT_ID`/`OURA_CLIENT_SECRET` from `.env.local` (see `.env.example`), catches the redirect on `http://localhost:9876/callback` and stores tokens in `.oura-tokens.json` (git-ignored, mode 600). The Vite plugin `tools/oura-proxy.ts` (dev and preview) serves `/oura/*` → `https://api.ouraring.com/v2/usercollection/*`, injects the Bearer token server-side, refreshes the access token on expiry/401 (refresh tokens are **single-use**, refreshes are serialized and persisted atomically by `tools/oura-tokens.ts`) and exposes `/oura-status`. The token never reaches the browser. Scopes: Oura's live scope names differ from its OpenAPI doc (`spo2` vs `spo2Daily`, `heart_health`, `stress`) and unknown scopes are silently dropped, so both spellings are requested by default (override with `OURA_SCOPES`). `OURA_TOKEN` (legacy static token), `OURA_API_URL` and `OURA_TOKEN_URL` are optional overrides.
- **Data flow:** `api/client.ts` (pagination via `next_token`, retry on 429, honours `retry-after`) → `db/sync.ts` (full-history sync into Dexie, incremental re-sync with a 3-day tail, per-endpoint `synced:*` markers in the `meta` table; intraday heart rate is fetched per day on demand via `loadHeartDay`) → UI reads **only** from Dexie through `composables/useLive.ts` (`liveQuery`). Do not call the API from views.
- **Metrics:** `metrics/registry.ts` is the single list of metrics (label, unit, section colour, extractor from a `DayBundle`). Tiles, period comparison and the correlation builder all derive from it, so add a metric there once. `composables/useDailyData.ts` assembles per-day bundles (main sleep = longest `long_sleep` session) and personal baselines (30-day median).
- **Stats:** `utils/stats.ts` (Pearson r, two-sided p-value, regression) backs `CorrelationsView`.
- **State:** Pinia `stores/period.ts` (selected day, trend range), `stores/sync.ts` (sync status/progress).
- **Views:** Dashboard, Sleep, Activity, Recovery, Compare, Correlations, Export («Данные для AI»), Sync (`src/views`, lazy-loaded routes).
- **AI export:** `utils/aiExport.ts` builds a Markdown report (instruction prompt, period summary vs previous period, correlations over full history, optional daily table) that the Export view copies to the clipboard or downloads as `.md`. Nothing is sent anywhere by the app.
- Response types in `api/types.ts` were checked against the published Oura OpenAPI schemas (via third-party copies, since cloud.ouraring.com is unreachable from the dev sandbox) but never against a live account. API quirks handled in `db/sync.ts`: `end_date` is exclusive, `/sleep` is filtered by UTC `bedtime_start` (not `day`), so every window is widened by a day on each side; one endpoint failing with a 4xx (e.g. missing scope) is reported in `failures` and does not stop the others; heart-rate day bounds are sent with the local UTC offset.

## Tests

The project has no unit-test setup (removed on purpose). Do not add tests or a test runner unless explicitly asked.

## Plan

`docs/PLAN.md` holds the agreed plan and decisions. Key constraints: single user (the ring owner), runs locally only, desktop-first, dark theme only, Russian UI. The Oura token lives in `.env.local` (not `VITE_`-prefixed) and is injected by the Vite dev proxy, so it never reaches the browser. Full history is synced into IndexedDB (Dexie) and the UI reads only from there; intraday heart rate is fetched on demand per day.
