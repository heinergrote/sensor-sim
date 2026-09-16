# Agent Guide

This is a SolidJS 2.x project. Solid is not React: components run once (there is no re-render), reactivity is
fine-grained through signals, and effects/memos have Solid-specific semantics. Do not port React patterns.

## Architecture

Single-page Solid app (`@sensor-sim/frontend`) that visualizes and controls simulations running on `@sensor-sim/server`.
In dev it runs on Vite (default `:3000`) against the server on `:4000`; in production it's built to `dist/client` and
served by the server itself from the same origin.

- `src/App.tsx` / `src/Document.tsx` — app shell: `Router`, page `<Title>`, `Nav`, and the HTML document wrapper.
- `src/components/Nav.tsx` — top nav bar (home link, dev indicator).
- `src/components/control/SimControl.tsx` — main layout: `SimList` (sidebar) + `SimMap` (main pane).
- `src/components/control/SimList.tsx` — create-sim form (id/type) plus a list of sim rows, each rendering a
  `SimDetails`. Reads live sims from the shared `simulations` store.
- `src/components/control/SimDetails.tsx` — per-sim control card: shows config (type, target, distance/azimuth/speed)
  and live state (current position/distance/azimuth); start/stop/delete buttons call the Hono client.
- `src/components/control/SimMap.tsx` — mounts a MapLibre instance via `createSimulationMap` on an element ref; disposes
  it on
  unmount.
- `src/components/control/simulationMap.ts` — imperative MapLibre wrapper (outside Solid's reactivity). Tracks one
  target marker + one
  current-position marker per sim, updates them from the simulations listener, and posts `updateTarget`/`updateCurrent`
  on marker drag via the Hono client.
- `src/service/simulations.service.ts` — the single source of live state for the whole app:
    - Opens one WebSocket to `${serverUrl}/ws/sims` (server URL is `http://localhost:4000` in dev,
      `window.location.origin` in prod) and keeps two Solid stores in sync on every message: `simulations`
      (`Simulation[]`, reconciled by `config.id`) and `simulationIds` (`string[]`).
    - Also maintains a plain (non-reactive) `latestSimulations` snapshot plus a listener registry
      (`addSimulationsListener`/`removeSimulationsListener`) for non-Solid consumers like `simulationMap.ts`.
    - Exports `honoClient = hc<AppType>(serverUrl)` — the typed REST client (`AppType` imported from
      `@sensor-sim/server`) used everywhere for mutations: `create`, `updateTarget`, `updateCurrent`, `start`, `stop`,
      `delete` under `honoClient.api.sims`.
- Components read reactive state from the Solid stores (`simulations`) and never poll REST for state — all live updates
  flow through the single WebSocket; REST calls are write-only (mutations).

## Env vars

- `VITE_MAP_STYLE` — MapLibre style URL (see `.env.development` / `.env.production`)

## Versioned skills (in node_modules — read on demand)

The installed packages ship agent skills that match their exact installed versions:

- `node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md` — repair guide mapping every dev-mode diagnostic code
  (e.g. `REACTIVE_WRITE_IN_OWNED_SCOPE`, `STRICT_READ_UNTRACKED`) to its prescribed fix. Read it whenever a Solid
  diagnostic code appears in test output or the browser console.
- `node_modules/@solidjs/diagnostics/skills/agent-loops/SKILL.md` — how to capture reactive evidence (which scopes
  re-ran and why, wasted recomputes, cost tables) and assert budgets, in tests and against live pages.

## Reactive diagnostics — capture evidence instead of guessing

Use these whenever you are debugging reactivity (something doesn't update, updates too often, or is slow) or verifying a
change didn't regress update granularity:

- **In tests:** `captureArtifact()` from `@solidjs/diagnostics` wraps a scenario and returns a serializable artifact of
  diagnostics + rerun attribution; matchers from `@solidjs/diagnostics/vitest` (`toHaveNoDiagnostics`,
  `toStayWithinRerunBudget`, `toHaveNoWaste`, …) assert on it. No browser needed.
- **Against the running dev server** (`diagnostics: true` in vite.config.ts; dev-only, no-op in builds). Requires an
  open page connected to the dev server (e.g. via a browser tool):
    - `GET /__solid/diagnostics` — status and connected client count
    - `POST /__solid/diagnostics` with JSON `{"method":"begin"}` then `{"method":"end"}` — capture a session into an
      artifact
    - `{"method":"whyDidRun","params":{"name":"<scope name>"}}` — recorded re-runs of one named scope in the open
      session
    - `{"method":"costs"}` — running cost tables for the open session

Name your signals/memos/effects (the `{ name: "..." }` option) — attribution reports scopes by name.
