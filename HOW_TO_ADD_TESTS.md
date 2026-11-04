# How to add automated tests

The repo has no tests yet. The frontend already has the tooling installed (`vitest`, `jsdom`,
`@solidjs/testing-library`, `@testing-library/jest-dom`, a `test` script and `vitest-setup.ts`) but no test files.
The server and `shared` have no test tooling at all, and CI (`.github/workflows/ci.yml`) only runs `pnpm build`.

This document proposes a staged plan. Each stage is useful on its own, so you can stop after any of them.

| Stage | What                                                  | Needs a DB? | Effort |
|-------|-------------------------------------------------------|-------------|--------|
| 1     | Server: unit tests for pure logic                     | no          | small  |
| 2     | Server: HTTP/auth tests with `app.request()` + mocks  | no          | small  |
| 3     | Frontend: services and components with Vitest + jsdom | no          | small  |
| 4     | CI: run tests on every push/PR                        | no          | tiny   |
| 5     | Server: integration tests against a real Postgres     | yes         | medium |
| 6     | End-to-end tests with Playwright (optional)           | yes         | medium |

**Use Vitest everywhere.** The frontend already uses it, it runs TypeScript and `@sensor-sim/shared`'s `.ts`
exports without a build step, and one runner keeps the commands and the CI step the same in every package.

---

## Conventions

- **Co-locate tests next to the code:** `src/util/eventStream.ts` → `src/util/eventStream.test.ts`. That keeps
  relative `vi.mock("../index")` paths short and makes missing coverage easy to spot.
- **Import test APIs explicitly** (`import {describe, it, expect, vi} from "vitest"`). The frontend config has
  `globals: false`; keep the server the same.
- Test files sit under `src/`, so `tsc --noEmit` (`pnpm typecheck`) type-checks them too. That's intended.
  tsdown only bundles the listed entries (`index.ts`, `migrate.ts`), so tests never end up in `dist/`.
- **Script names:** `test` runs once (for CI) and `test:watch` runs in watch mode. The frontend's current
  `"test": "vitest"` starts watch mode in a terminal and runs once in CI (Vitest checks `process.env.CI`). An
  explicit `vitest run` is clearer.
- **Root script:** add `"test": "pnpm -r --if-present test"` to the root `package.json`.

---

## Stage 1: Server unit tests (no database)

### Setup

```bash
pnpm --filter @sensor-sim/server add -D vitest
```

`packages/server/package.json`:

```jsonc
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

`packages/server/vitest.config.ts`:

```ts
import {defineConfig} from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // src/db/index.ts and src/middleware/jwtAuth.ts throw at import without these.
    // drizzle() does not connect until the first query, so a dummy URL is fine for tests that never touch the DB.
    // dotenv never overrides variables that are already set, so a local .env does not leak into the tests.
    env: {
      JWT_SECRET: "test-secret",
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
    },
    restoreMocks: true,
  },
});
```

### What to test first (highest value, zero mocking)

These modules are pure or almost pure, and the rest of the server depends on them:

| Module                                | Why it matters / what to assert                                                                                                                                                                                                                          |
|---------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `util/eventStream.ts`                 | Every WS stream depends on it. Current value replayed on `collect()`, every `emit()` reaches all collectors, producer re-evaluated per read, `close()` and abort end the generators.                                                                     |
| `util/passwords.ts`                   | Hash/verify round-trip, wrong password → `false`, malformed stored value (no `:`, too many `:`) → `false`.                                                                                                                                               |
| `simulation/definitions/*.ts`         | `step` is a pure reducer: path moves toward the target and **stops** there, orbit stays on the radius, fixed never moves.                                                                                                                                |
| `simulation/simulationDefinitions.ts` | The facade sends each spec to the right definition; `getDefaultSpec(type, pos)` keeps `getLocation` at `pos` (this is what `PUT /:id/type` relies on).                                                                                                   |
| `simconfigs/simconfigs.mapping.ts`    | `toUpdate` drops `undefined` but keeps `null`; `toCreate` defaults and **forces** `ownerId`/`shareToken` (a client can't inject them, even though `createSimConfigSchema` accepts both fields); `toDto` returns `spec: null` for an invalid stored spec. |
| `simulation/simulationRunner.ts`      | With fake timers: moves while playing, keeps its state when stopped, `applySimConfig` restarts only when `spec`/`playing` changed, `dispose()` ends the stream.                                                                                          |
| `shared/src/util/geoUtils.ts`         | Distance/bearing/destination round-trips, `getPosition(o, 0, …)` returns `o`. Tested from the server, or in `shared` itself (see below).                                                                                                                 |

### Example: `src/util/eventStream.test.ts`

```ts
import {describe, expect, it} from "vitest";
import {createEventStream} from "./eventStream";

describe("createEventStream", () => {
  it("replays the current value, then yields every emit", async () => {
    const stream = createEventStream<number>();
    stream.emit(1);

    const it = stream.collect();
    expect((await it.next()).value).toBe(1);

    const next = it.next();
    stream.emit(2);
    expect((await next).value).toBe(2);
  });

  it("re-evaluates a producer on every read", async () => {
    let n = 0;
    const stream = createEventStream<number>();
    stream.emit(() => ++n);
    expect(stream.get()).toBe(1);
    expect(stream.get()).toBe(2);
  });

  it("close() ends active and future collectors", async () => {
    const stream = createEventStream<number>();
    stream.emit(1);
    const it = stream.collect();
    await it.next();

    stream.close();
    expect((await it.next()).done).toBe(true);
    expect((await stream.collect().next()).done).toBe(true);
  });

  it("aborting ends only that collector", async () => {
    const stream = createEventStream<number>();
    stream.emit(1);
    const ac = new AbortController();
    const a = stream.collect(ac.signal);
    const b = stream.collect();
    await a.next();
    await b.next();

    ac.abort();
    expect((await a.next()).done).toBe(true);

    const nextB = b.next();
    stream.emit(2);
    expect((await nextB).value).toBe(2);
  });
});
```

### Example: `src/simulation/definitions/path.test.ts`

```ts
import {describe, expect, it} from "vitest";
import {getDistance} from "@sensor-sim/shared/geoUtils";
import {SpecPath} from "@sensor-sim/shared";
import {pathDefinition} from "./path";

const spec: SpecPath = {
  type: "path",
  startLatitude: 52.264, startLongitude: 10.523,
  targetLatitude: 52.265, targetLongitude: 10.523, // ~111 m north
  speed: 10, // m/s
};
const target = {latitude: spec.targetLatitude, longitude: spec.targetLongitude};

describe("pathDefinition", () => {
  it("starts at the start point", () => {
    const state = pathDefinition.init(spec);
    expect(state.position).toEqual({latitude: spec.startLatitude, longitude: spec.startLongitude});
  });

  it("moves speed * dt toward the target", () => {
    const s0 = pathDefinition.init(spec);
    const s1 = pathDefinition.step(s0, spec, 1000);
    expect(s0.currentDistance - s1.currentDistance).toBeCloseTo(10, 5);
    expect(getDistance(s1.position, target)).toBeCloseTo(s1.currentDistance, 0);
  });

  it("stops exactly at the target and stays there", () => {
    const s0 = pathDefinition.init(spec);
    const end = pathDefinition.step(s0, spec, 60_000);
    expect(end.currentDistance).toBe(0);
    expect(end.position).toEqual(target);
    expect(pathDefinition.step(end, spec, 1000).position).toEqual(target);
  });
});
```

Orbit works the same way. Assert `getDistance(position, center) ≈ radius` after each step, and that a full lap
(`2πr / speed` seconds) brings `currentAngle` back to `startAngle` (mod 360). For `createDefaultSpec`, which uses
`Math.random`, assert only invariants (speed 5–20, radius 50–200, start 50–200 m from the target).

### Example: `src/simconfigs/simconfigs.mapping.test.ts`

```ts
import {describe, expect, it, vi} from "vitest";
import {toCreate, toDto, toUpdate} from "./simconfigs.mapping";
import type {SimConfigRow} from "../db/schema";

const row = (over: Partial<SimConfigRow> = {}): SimConfigRow => ({
  id: 1, label: "sim-1", ownerId: 7, shareToken: "", playing: true,
  spec: {type: "fixed", latitude: 1, longitude: 2},
  ...over,
} as SimConfigRow);

describe("simconfigs mapping", () => {
  it("toUpdate drops undefined but keeps null (PATCH semantics)", () => {
    expect(toUpdate({label: undefined, spec: null})).toEqual({spec: null});
  });

  it("toCreate cannot be used to set another owner or a share token", () => {
    const created = toCreate({ownerId: 999, shareToken: "1!evil", label: "x"}, 7);
    expect(created.ownerId).toBe(7);
    expect(created.shareToken).toBe("");
  });

  it("toCreate defaults: no spec, playing", () => {
    expect(toCreate({}, 7)).toMatchObject({spec: null, playing: true, ownerId: 7});
  });

  it("toDto reads an invalid stored spec as null", () => {
    vi.spyOn(console, "log").mockImplementation(() => {
    });
    const dto = toDto(row({spec: {type: "fixed", latitude: 1} as any}));
    expect(dto.spec).toBeNull();
  });
});
```

### Example: runner with fake timers (`src/simulation/simulationRunner.test.ts`)

```ts
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {SimConfig} from "@sensor-sim/shared";
import {createSimulationRunner} from "./simulationRunner";

const config: SimConfig = {
  id: 1, ownerId: 1, label: "sim-1", shareToken: "", playing: true,
  spec: {
    type: "path", startLatitude: 52.264, startLongitude: 10.523,
    targetLatitude: 52.265, targetLongitude: 10.523, speed: 10
  },
};

describe("simulationRunner", () => {
  beforeEach(() => vi.useFakeTimers());   // also fakes Date.now(), which tick() uses for deltaMs
  afterEach(() => vi.useRealTimers());

  it("moves while playing and freezes when stopped", () => {
    const runner = createSimulationRunner(config);
    const p0 = runner.simData.position;
    vi.advanceTimersByTime(1000);
    const p1 = runner.simData.position;
    expect(p1.latitude).toBeGreaterThan(p0.latitude);

    runner.stop();
    vi.advanceTimersByTime(1000);
    expect(runner.simData.position).toEqual(p1);
    runner.dispose();
  });

  it("applySimConfig ignores irrelevant changes (no reset)", () => {
    const runner = createSimulationRunner(config);
    vi.advanceTimersByTime(1000);
    const before = runner.simData.position;
    runner.applySimConfig({...config, label: "renamed"});
    expect(runner.simData.position).toEqual(before);
    runner.dispose();
  });

  it("dispose() ends the data stream", async () => {
    const runner = createSimulationRunner({...config, playing: false});
    const it = runner.simDataStream.collect();
    await it.next();
    runner.dispose();
    expect((await it.next()).done).toBe(true);
  });
});
```

### The `shared` package

`specSchema` (strict objects, discriminated union) and `geoUtils` are the contract between both sides, so they
are worth testing directly. Either give `packages/shared` its own `vitest` dev dependency and `test` script (same
config as the server, minus `env`), or test them from the server suite. A separate suite is cleaner: a failing
contract test then points at `shared` and not at the server.

Good first assertions: `specSchema.safeParse` rejects extra keys and missing keys (stored JSON that no longer
fits must read as `spec: null`), and `simConfigIdParam` rejects `0`, `-1` and `"abc"`.

> Worth a look while writing these: `simConfigResponseSchema` requires `shareToken` to be `min(1)`, but an
> unshared config stores `""`. Nothing parses responses with it today, so the mismatch only shows in the inferred
> type. A test that runs `simConfigResponseSchema.parse(toDto(row))` would catch it.

---

## Stage 2: Server HTTP and auth tests (no database)

Hono apps have `app.request(path, init)`, which runs a request in-process without opening a port. Every
subapp (`loginApp`, `simsApp`, `simConfigsApp`, …) is exported, so you can test each one in isolation. Mock the
**repositories** and the circular `../index` import (`simulationEngine`) with `vi.mock`.

**Auth tests come first:** the security rules are per subapp ("each subapp declares its own auth"), so a
dropped `.use(jwtMiddleware)` breaks nothing at compile time. For each protected subapp, test "no token → 401",
"other owner → 403" and "admin-only → 403 for non-admins".

### Test helper: `src/test/auth.ts`

```ts
import {sign} from "hono/jwt";

export async function bearer(user: { id: number; username?: string; admin?: boolean }) {
  const token = await sign({
    sub: user.id,
    username: user.username ?? `user${user.id}`,
    admin: user.admin ?? false,
    exp: Math.floor(Date.now() / 1000) + 60,
  }, process.env.JWT_SECRET!, "HS256");
  return {Authorization: `Bearer ${token}`};
}
```

### Example: `src/login/login.api.test.ts`

```ts
import {beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../users/user.repository", () => ({getUserByName: vi.fn()}));

import {getUserByName} from "../users/user.repository";
import {hashPassword} from "../util/passwords";
import {loginApp} from "./login.api";

const post = (body: unknown) => loginApp.request("/", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify(body),
});

describe("POST /api/login", () => {
  beforeEach(async () => {
    vi.mocked(getUserByName).mockResolvedValue({
      id: 1, username: "alice", password: await hashPassword("secret"), admin: false,
    });
  });

  it("returns a token for valid credentials", async () => {
    const res = await post({username: "alice", password: "secret"});
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("token");
  });

  it("rejects a wrong password with 401", async () => {
    expect((await post({username: "alice", password: "nope"})).status).toBe(401);
  });

  it("rejects an unknown user with 401", async () => {
    vi.mocked(getUserByName).mockResolvedValue(undefined);
    expect((await post({username: "bob", password: "x"})).status).toBe(401);
  });

  it("rejects a malformed body with 400", async () => {
    expect((await post({username: "alice"})).status).toBe(400);
  });
});
```

### Example: owner scoping in `src/sims/sims.api.test.ts`

```ts
import {describe, expect, it, vi} from "vitest";

const runners = new Map<number, any>();
vi.mock("../index", () => ({
  simulationEngine: {
    get: (id: number) => runners.get(id),
    list: (ownerId: number) => [...runners.values()].filter(r => r.config.ownerId === ownerId),
  },
}));

import {simsApp} from "./sims.api";
import {bearer} from "../test/auth";

runners.set(1, {config: {id: 1, ownerId: 1}, simData: {position: {latitude: 1, longitude: 2}}});

describe("/api/sims auth", () => {
  it("401 without a token", async () => {
    expect((await simsApp.request("/1")).status).toBe(401);
  });

  it("403 for another user's sim", async () => {
    expect((await simsApp.request("/1", {headers: await bearer({id: 2})})).status).toBe(403);
  });

  it("404 for an unknown sim", async () => {
    expect((await simsApp.request("/99", {headers: await bearer({id: 1})})).status).toBe(404);
  });

  it("200 for the owner", async () => {
    const res = await simsApp.request("/1", {headers: await bearer({id: 1})});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({position: {latitude: 1, longitude: 2}});
  });

  it("GET / lists only the caller's sims", async () => {
    const res = await simsApp.request("/", {headers: await bearer({id: 2})});
    expect(await res.json()).toEqual([]);
  });
});
```

Do the same for:

- `users.api` → non-admin gets 403 and admin gets 200 (mock `user.repository`).
- `simconfigs.api` → 400 for a bad id, 404 for a missing config, 403 for a non-owner (mock
  `simconfigs.repository`, `../index` and `../status/status.service`). Also check that a successful write calls
  `simulationEngine.syncConfigs()`, and that `GET /` sets `X-Config-Revision`. Use fake timers to check the
  debounced status message: two writes inside the window produce **one** message, with the later revision.
- `simShareMiddleware` / `shared.api` → malformed token → 400, revoked token (`shareToken` changed) → 403.
- `simulationEngine.syncConfigs` → mock `getSimConfigs`. Spec-less configs get no runner, deleted configs are
  disposed, and two concurrent `syncConfigs()` calls apply in order (resolve the first mock call *after* the
  second to check the `syncQueue` ordering).

### Recommended small refactor (later, not required for stage 2)

`src/index.ts` creates the engine with a top-level `await`, calls `serve()` and registers signal handlers when it
is imported, and the route modules import `simulationEngine` from it (circular). That is why stage 2 mocks
`../index`. Once you want to test the *composed* app (CORS headers, SPA fallback, mount paths such as
`/s` vs `/api/shared`), split it:

- `src/app.ts`: `export function createApp(engine: SimulationEngine): Hono` (no side effects).
- `src/engine.ts`: holds the engine instance (removes the circular import).
- `src/index.ts`: bootstrap only (`createApp`, `serve`, shutdown).

Tests can then call `createApp(fakeEngine).request("/api/...")` and test routing exactly as it runs in prod.

---

## Stage 3: Frontend tests (Vitest + jsdom, already installed)

### Setup changes

- `package.json`: change `"test": "vitest"` to `"test": "vitest run"` and add `"test:watch": "vitest"`.
- `vite.config.ts`: **remove `isolate: false`.** Several modules keep state at module level: the token signal
  in `auth.ts`, the socket/listener maps in `simulation.service.ts`, and the status-socket `createRoot` in
  `configs.service.ts`. Without isolation that state leaks between test files and causes order-dependent
  failures. Put it back later only if test runtime becomes a problem.
- Add `restoreMocks: true` and, for browser APIs that jsdom lacks, `vi.stubGlobal` in the individual test.
- Solid 2 batches DOM updates: **call `flush()` (from `solid-js`) after firing events** and before you assert.
  For async results (ky calls), use `findBy*` or `vi.waitFor`.

### What to test first

| Target                          | What to assert                                                                                                                                                                                                                                    |
|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `service/simulation.service.ts` | One socket per sim id, shared by several listeners (ref count); messages reach every listener; removing the last listener closes the socket and does **not** reconnect; a server-side close reconnects with backoff 1 s → 2 s → … capped at 30 s. |
| `auth.ts`                       | `login()` / `logout()` write and clear `localStorage["jwt_token"]`; `api.ts` sends the current token in `Authorization`.                                                                                                                          |
| `components/LoginForm.tsx`      | Submits username/password, stores the token and navigates on success, shows "Login failed" on error.                                                                                                                                              |
| `components/sims/SimCard.tsx`   | Correct summary per `spec.type`, speed slider only for path/orbit, type `<select>` calls `updateType`.                                                                                                                                            |
| `components/users/*`            | Render from a `User` fixture; the admin badge and so on.                                                                                                                                                                                          |

Keep MapLibre (`SimMap.tsx`, `simulationMap.ts`, `simulation{Fixed,Path,Orbit}.ts`) out of the jsdom suite:
it needs WebGL and workers. Unit-test the geometry those renderers compute (radius/`startAngle` from dragged
points) by moving it into small pure functions, preferably in `@sensor-sim/shared/geoUtils`. Cover the map itself
with Playwright (stage 6).

### Example: `src/service/simulation.service.test.ts`

```ts
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
    this.onclose?.();
  }

  // test helpers
  receive(data: unknown) {
    this.onmessage?.({data: JSON.stringify(data)});
  }

  serverClose() {
    this.onclose?.();
  }
}

describe("simulation.service", () => {
  let addSimulationListener: typeof import("./simulation.service").addSimulationListener;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    FakeWebSocket.instances = [];
    localStorage.setItem("jwt_token", "t0k");
    vi.resetModules();                       // fresh module-level maps per test
    ({addSimulationListener} = await import("./simulation.service"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shares one socket per sim and fans out messages", () => {
    const a = vi.fn(), b = vi.fn();
    addSimulationListener(1, a);
    addSimulationListener(1, b);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toContain("/api/sims/1/ws?token=t0k");

    FakeWebSocket.instances[0].receive({position: {latitude: 1, longitude: 2}});
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("closes without reconnecting when the last listener leaves", () => {
    const off = addSimulationListener(1, vi.fn());
    off();
    expect(FakeWebSocket.instances[0].closed).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("reconnects with exponential backoff after a server close", () => {
    addSimulationListener(1, vi.fn());
    FakeWebSocket.instances[0].serverClose();
    vi.advanceTimersByTime(999);
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2);   // after 1 s

    FakeWebSocket.instances[1].serverClose();
    vi.advanceTimersByTime(1999);
    expect(FakeWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(3);   // after 2 s
  });
});
```

### Example: `src/components/LoginForm.test.tsx`

`LoginForm` imports `../router`, which pulls in the whole route tree and the lazy pages. Mock it, and mock
`useNavigate` so the component can render without a `<Router>`.

```tsx
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@solidjs/testing-library";
import {flush} from "solid-js";

const navigate = vi.fn();
vi.mock("@solidjs/router", () => ({useNavigate: () => navigate}));
vi.mock("../router", () => ({paths: {sims: () => "/sims"}}));
vi.mock("../api", () => ({serverUrl: "http://test", api: {post: vi.fn()}}));
// useAuth()'s `user` memo calls GET /api/me with ky as soon as a token is set. If that request fails it calls
// logout() and clears the token again, so stub it to keep the test deterministic.
vi.mock("ky", () => ({
  default: {create: () => ({get: () => ({json: () => Promise.resolve({id: 1, username: "alice", admin: false})})})},
}));

import {api} from "../api";
import LoginForm from "./LoginForm";

function fillAndSubmit() {
  fireEvent.input(screen.getByPlaceholderText("Username"), {target: {value: "alice"}});
  fireEvent.input(screen.getByPlaceholderText("Password"), {target: {value: "secret"}});
  fireEvent.submit(screen.getByRole("button", {name: "Login"}).closest("form")!);
  flush();
}

describe("LoginForm", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    navigate.mockReset();
  });

  it("stores the token and navigates on success", async () => {
    vi.mocked(api.post).mockReturnValue({json: () => Promise.resolve({token: "abc"})} as any);
    render(() => <LoginForm/>);
    fillAndSubmit();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith("/sims"));
    expect(api.post).toHaveBeenCalledWith("/login", {json: {username: "alice", password: "secret"}});
    expect(localStorage.getItem("jwt_token")).toBe("abc");
  });

  it("shows an error when login fails", async () => {
    vi.mocked(api.post).mockReturnValue({json: () => Promise.reject(new Error("401"))} as any);
    render(() => <LoginForm/>);
    fillAndSubmit();

    expect(await screen.findByText("Login failed")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
```

For components that use `query()`/`action()` from `@solidjs/router` (`SimCard`, `SimList`, the users pages), **mock the
service module** (`../../service/configs.service`) instead of mocking ky. The test then checks
"clicking Start calls `startSim(id)`" and doesn't depend on HTTP details. If a component needs a real router
context, render it inside the router's memory/test router with a single route. Check the installed
`@solidjs/router` 2.x API for the exact export name before you write the helper.

Reactivity checks: `@solidjs/diagnostics/vitest` provides matchers such as `toHaveNoDiagnostics` and
`toStayWithinRerunBudget` (see `packages/frontend/CLAUDE.md`). Add them once the basic tests are in place, to
catch wasteful effect reruns in `SimMap`/`SimCard`.

---

## Stage 4: CI

Add a test step to `.github/workflows/ci.yml` after "Install dependencies", and before "Build" so that failures
show up fast:

```yaml
      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test          # root script: pnpm -r --if-present test
```

Stages 1–3 need no services, so this works on a plain `ubuntu-latest` runner. Optionally add
`pnpm --filter @sensor-sim/frontend lint` here too, and `--coverage` (`@vitest/coverage-v8`) once there is
enough to measure. Don't enforce coverage thresholds at the start.

---

## Stage 5: Server integration tests against Postgres

Stages 1–2 mock the repositories, so they never exercise the Drizzle queries, the migrations, the label sequence
default (`sim-<seq>`), the unique constraints or the jsonb round-trip. Add a separate, slower suite for those:

- **Database:**
    - Locally: [Testcontainers](https://node.testcontainers.org/) (`@testcontainers/postgresql`) starts a
      throwaway `postgres` container per run.
    - In CI: either Testcontainers (Docker is available on `ubuntu-latest`) or a `services: postgres` block in the
      workflow.
- **Schema:** run the real migrations with `migrate(db, {migrationsFolder: "drizzle"})` in a Vitest
  `globalSetup`. This also tests the migration chain itself; `0007`–`0009` are destructive and should never break
  silently.
- **Isolation:** `TRUNCATE users, sim_configs RESTART IDENTITY CASCADE` in `beforeEach`, or one database per
  worker. Run this suite with `fileParallelism: false` so files don't share the DB at the same time.
- **Separation:** put these in `*.int.test.ts` with their own `vitest.integration.config.ts` and a
  `test:integration` script, so the fast `test` script still runs without Docker.

Worth covering:

1. `dbInit`: seeds the admin once, is idempotent on a second run, skips seeding without `DEFAULT_ADMIN_PASSWORD`.
2. Repositories: insert → label defaults to `sim-N`; duplicate label → error; `spec` jsonb round-trips; delete
   returns the row.
3. Full flow through `simConfigsApp.request()` with a real DB and a real engine. Create a config, set a type,
   then check that `engine.get(id)` exists and moves. Stop → frozen; delete → runner disposed. Share → `GET
   /api/shared/:token` works; unshare → 403 immediately.
4. WebSockets (`/api/sims/:id/ws`, `/api/status/ws`): start the real server on port 0 (needs the `createApp`
   refactor from stage 2) and connect with the `ws` client. Assert that messages arrive and that deleting the sim
   closes the socket.

---

## Stage 6: End-to-end (optional)

[Playwright](https://playwright.dev/) against the production build (`pnpm build && pnpm --filter
@sensor-sim/server start`) with a Testcontainers/compose Postgres and a seeded admin. Keep it to a few smoke
flows:

- Log in → create a sim → pick "Orbit" → the marker appears on the map and moves.
- Share link opens on `/s/<token>` without logging in; after unsharing it no longer does.
- Admin creates a user; that user does not see the admin's sims.

MapTiler tiles can be stubbed with `page.route("**/api/maptiler/**", …)` so the tests don't need `MAPTILER_KEY`
or network access.

---

## Suggested order of first PRs

1. **Server Vitest setup** + `eventStream`, `passwords`, `path`/`orbit`/`fixed` definitions, mapping tests.
2. **Server auth tests** for `login`, `sims`, `simconfigs`, `users`, `shared` via `app.request()`.
3. **Frontend**: `vitest run` script, remove `isolate: false`, `simulation.service` + `LoginForm` tests.
4. **CI**: typecheck + test steps; root `test` script.
5. `createApp` refactor + Postgres integration suite.
6. Playwright smoke tests.

Also update the docs that currently say there are no tests ("No test suite." in `packages/server/CLAUDE.md`)
and add the new commands to the root `CLAUDE.md` command list.
