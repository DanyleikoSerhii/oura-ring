# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Frontend-only Vue.js application. It fetches data from the Oura Ring API and shows the key health metrics in a polished, visually appealing dashboard.

## Stack

Vue 3 + TypeScript, Vite, Vue Router, Pinia, Tailwind CSS v4 (tokens in `src/style.css`), Dexie (IndexedDB), ECharts (`vue-echarts`), date-fns, lucide icons, oxlint (lint), oxfmt (format).

## Commands

Package manager is pnpm (pinned via `packageManager`).

- `pnpm install`
- `pnpm dev` — dev server
- `pnpm build` — type-check (`vue-tsc`) + production build
- `pnpm type-check` — types only
- `pnpm lint` — oxlint with `--fix`; `pnpm lint:check` — no fix
- `pnpm format` — oxfmt on `src/` (config in `.oxfmtrc.json`); `pnpm format:check` — verify only
- `pnpm test` — checks only: `lint:check` + `format:check`

Node `^22.18.0 || >=24.12.0` is required.

## Architecture

Single-user, local-only, desktop-first, dark theme, Russian UI. Plan and decisions: `docs/PLAN.md`.

- **Auth/CORS:** `OURA_TOKEN` in `.env.local` (see `.env.example`; deliberately not `VITE_`-prefixed). `vite.config.ts` proxies `/oura/*` to `https://api.ouraring.com/v2/usercollection/*` and injects the Bearer header, so the token never reaches the browser. It also defines `__HAS_TOKEN__`. Restart the dev server after changing the token.
- **Data flow:** `api/client.ts` (pagination via `next_token`, retry on 429) → `db/sync.ts` (full-history sync into Dexie, incremental re-sync with a 3-day tail, per-endpoint `synced:*` markers in the `meta` table; intraday heart rate is fetched per day on demand via `loadHeartDay`) → UI reads **only** from Dexie through `composables/useLive.ts` (`liveQuery`). Do not call the API from views.
- **Metrics:** `metrics/registry.ts` is the single list of metrics (label, unit, section colour, extractor from a `DayBundle`). Tiles, period comparison and the correlation builder all derive from it, so add a metric there once. `composables/useDailyData.ts` assembles per-day bundles (main sleep = longest `long_sleep` session) and personal baselines (30-day median).
- **Stats:** `utils/stats.ts` (Pearson r, two-sided p-value, regression) backs `CorrelationsView`.
- **State:** Pinia `stores/period.ts` (selected day, trend range), `stores/sync.ts` (sync status/progress).
- **Views:** Dashboard, Sleep, Activity, Recovery, Compare, Correlations, Export («Данные для AI»), Sync (`src/views`, lazy-loaded routes).
- **AI export:** `utils/aiExport.ts` builds a Markdown report (instruction prompt, period summary vs previous period, correlations over full history, optional daily table) that the Export view copies to the clipboard or downloads as `.md`. Nothing is sent anywhere by the app.
- The Oura response types and field names in `api/types.ts` were written from memory of the API v2 docs and have not been verified against real responses.

## Tests

The project has no unit-test setup (removed on purpose). Do not add tests or a test runner unless explicitly asked.

## Plan

`docs/PLAN.md` holds the agreed plan and decisions. Key constraints: single user (the ring owner), runs locally only, desktop-first, dark theme only, Russian UI. The Oura token lives in `.env.local` (not `VITE_`-prefixed) and is injected by the Vite dev proxy, so it never reaches the browser. Full history is synced into IndexedDB (Dexie) and the UI reads only from there; intraday heart rate is fetched on demand per day.
