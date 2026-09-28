# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Frontend-only Vue.js application. It fetches data from the Oura Ring API and shows the key health metrics in a polished, visually appealing dashboard.

## Stack

Vue 3 + TypeScript, Vite, Vue Router, Pinia, oxlint (lint), oxfmt (format). Scaffolded with `create-vue`; the demo views/components (`HelloWorld`, `TheWelcome`, `counter` store) are still placeholders.

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

## Tests

The project has no unit-test setup (removed on purpose). Do not add tests or a test runner unless explicitly asked.

## Plan

`docs/PLAN.md` holds the agreed plan and decisions. Key constraints: single user (the ring owner), runs locally only, desktop-first, dark theme only, Russian UI. The Oura token lives in `.env.local` (not `VITE_`-prefixed) and is injected by the Vite dev proxy, so it never reaches the browser. Full history is synced into IndexedDB (Dexie) and the UI reads only from there; intraday heart rate is fetched on demand per day.
