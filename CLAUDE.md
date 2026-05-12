# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**DZ Drop Planner** — a browser-based simulator/optimizer for parachutist drop passes. The app is a static HTML + vanilla JS page (no build step, no package manager, no tests). Tailwind, D3, and Leaflet are loaded from CDNs. UI strings and most code comments are in French; keep that language when modifying user-facing text.

The scientific model (atmosphere, integration schemes, Monte-Carlo, optimizer) is fully documented in `SCIENCE.md` — **read it before changing physics, numerics, or scoring**, since those equations are load-bearing.

## Running the app

There is no build. Two ways to run:

- **With an HTTP server** (recommended, enables `importScripts` in Web Workers):
  ```bash
  python3 -m http.server 8000
  # then open http://localhost:8000/
  ```
- **Direct `file://` open** works too — the optimizer falls back to Blob workers and XHR-injects `physics-core.js` source into them (see `_fetchPCSource` in `optimizer-v2.js`). Keep that fallback intact if you touch worker plumbing.

## Architecture

### Script load order (globals, not modules)

All JS files expose globals and are concatenated by `<script src=...>` tags in `index.html` at the bottom of `<body>`. Order matters:

1. `physics-core.js` — IIFE `PhysicsCore` (atmosphere, TAS, wind interp, RK4/RK2 integrators, density LUT). Zero DOM. Shared between main thread and Web Workers.
2. `nfz.js` — IIFE `NFZ` (polygonal no-fly zones with altitude bounds, Leaflet-drawn).
3. `monte-carlo.js` — IIFE `MonteCarlo` (Box-Muller, AR(1) wind perturbation, confidence ellipses). Depends on `PhysicsCore`.
4. `simulation.js` — **legacy physics + orchestration** (see caveat below). Exposes top-level `runSimulation`, `runOptimizer`, `runCoreSimulation`, `simulateHeadless`, and the legacy atmosphere/RK4 duplicates.
5. `app.js` — DZ database (`DZ_DB`), global state (`map`, `windProfile`, `meteoData`, `jumpersList`, `currentTarget`, `currentRV`), DOM wiring, compass/accordion/meteo UI, `getDZ()`, `recompute()`.
6. `charts.js` — D3 wind barbs, airgram, transversal profile, distance chart.
7. `map.js` — Leaflet init, DZ/RV/target markers, axis drag handles, result overlays.
8. `animation.js` — playback timeline (plane + jumpers), uses `requestAnimationFrame`.
9. `optimizer-v2.js` — IIFE `OptimizerV2` (4-phase optimizer: coarse scan → fine refine → genetic stick order → Monte-Carlo validation).
10. `ui-optimizer.js` — injects NFZ panel, Monte-Carlo settings, and the V2 optimizer button into the right panel; renders result cards and ellipses.

### Dual physics implementations — important

Physics currently exists **twice**:

- `physics-core.js` (`PhysicsCore.*`) is the canonical, side-effect-free kernel, used by `optimizer-v2.js`, `optimizer-worker-v2.js`, and Monte-Carlo.
- `simulation.js` contains an **older, parallel copy** of the same formulas (`getAtmosphere`, `getDensity`, `computeTAS`, `rk4Step`, `rk2Step`, `windVecAtZ`, etc.) used by the main-thread simulation path and by the legacy `optimizer-worker.js`.

When changing physics constants or formulas, update **both** and keep `SCIENCE.md` in sync, otherwise main-thread results and worker results will diverge.

### Two optimizers coexist

- `runOptimizer()` in `simulation.js` is the **legacy** path, using `optimizer-worker.js`.
- `OptimizerV2.run()` in `optimizer-v2.js` is the **current** 4-phase pipeline, using `optimizer-worker-v2.js`.
- The top-bar "OPTIMISER" button (`onMainOptimize` in `index.html`) prefers V2 when `OptimizerV2` is defined and falls back to `runOptimizer()` otherwise. New work should target V2.

### Web Worker contract

Workers receive fully-serialized inputs (`windProfile`, `jumpersList`, `nfzSerialized`, `cfg`) — they have **no DOM access and no shared state**. If you add a new input to the simulation, you must (a) pass it through the worker message, (b) teach `PhysicsCore` (or the legacy worker duplicate) to apply it, and (c) update `ui-optimizer.js` / `optimizer-v2.js` where the cfg is built.

### Simulation pipeline (single pass, `runCoreSimulation` in `simulation.js`)

1. Compute exit altitude from FL + QNH correction, derive TAS from KIAS + ISA.
2. For each jumper: `derivePhysicsParams` → freefall (RK4, dt=0.25 s) → opening (RK2/Heun, 5.5 s, dt=0.1 s) → canopy (kinematic, dt=0.5 s) → landing.
3. Aggregate: RDV margins, min inter-jumper separation, NFZ checks, Go/No-Go verdict.
4. Monte-Carlo wraps this: N passes with AR(1)-perturbed wind and perturbed jumper params; produces P(GO), percentiles, and 95% confidence ellipses.

### State model

There is no framework — state lives in module-level `var`s in `app.js` (`windProfile`, `jumpersList`, `currentTarget`, `currentRV`, `simResults`, `meteoData`) and is read directly by `simulation.js`, `charts.js`, `map.js`, `animation.js`. When adding state, put it with the other globals in `app.js` and have `recompute()` keep derived values fresh.

## Conventions

- ES5-flavored vanilla JS, `'use strict'`, IIFE modules exposing a single global. Don't introduce ES modules, bundlers, or TypeScript — they'd break the zero-build setup and the Blob-worker `file://` fallback.
- Units: SI internally (meters, m/s, radians where noted); UI uses kt, NM, ft, FL, °. Conversion constants live in `PhysicsCore` (`KT2MS`, `NM2M`, `DEG2RAD`).
- Coordinates: East/North meters relative to the DZ center (`_lonlatToEN` pattern in `nfz.js` / `map.js`).

## Tests & CI

### Running tests locally

```bash
npm test                # runs all tests in tests/ via node:test
npm run test:watch      # rerun on file change
npm run test:coverage   # experimental coverage report
```

No test framework dependency — uses Node's built-in `node:test` and `node:assert`. **Requires Node 20+.**

### What's tested

| Module / area | File | Coverage |
|---|---|---|
| Atmosphere, ISA, TAS, density | `tests/physics-core.atmosphere.test.js` | density curve, ISA delta, TAS factor |
| Wind interpolation + cache | `tests/physics-core.wind.test.js` | linear interp, log-profile near surface, clamping |
| Integrators + jumper sim | `tests/physics-core.integrators.test.js` | RK4, simFreefall, simOpening, simCanopy, simJumper, classifyJumper, v3ExitOrder |
| Landing pattern + simPass | `tests/physics-core.landing-pattern.test.js` | createLandingPattern, full pass, gap rules (tandem 15s / gros groupe Δt+2s), zonePolygon, redE position |
| NFZ | `tests/nfz.test.js` | addZone/removeZone, serialize, distToPolyEdge |
| Monte-Carlo | `tests/monte-carlo.test.js` | gaussRandom moments, perturbWind, perturbJumpers (with subOverrides, flipProb) |
| OptimizerV3 stick builder | `tests/optimizer-v3.test.js` | buildStickV3 at all N sizes, gap rules, cumExitTime |

**67 tests** total, all green at the time of writing.

### Writing new tests

- Drop a new `tests/*.test.js` file. `node --test tests/` auto-discovers.
- Modules that need to run in Node must end with `if (typeof module !== 'undefined') module.exports = MyGlobal;` to be requirable. `physics-core.js`, `nfz.js`, `monte-carlo.js`, `optimizer-worker-v3.js` already do this.
- Worker entry points (`onmessage = ...`) must be guarded with `if (typeof self !== 'undefined' && typeof postMessage === 'function')` so they don't crash when required from Node.
- DOM-heavy modules (`app.js`, `map.js`, `pattern-editor.js`, `ui-optimizer.js`, `charts.js`, `animation.js`) are not unit-tested — they're tested manually via the browser. Don't try to require them from a Node test, they'll explode on `document.getElementById`.
- Test names should be descriptive : the goal is that a failing assertion message + test name alone tells you what broke. Use French or English consistently within a file.

### Conventions for test code

- Each test calls `PC.setWindProfile(...)` before relying on `windAtZ` — wind state is global.
- For NFZ tests, call `NFZ.init(lat, lon)` then `NFZ.clearZones()` to start from a clean state (tests share module state).
- Tolerances: prefer `Math.abs(x - expected) < tol` over `strictEqual` for floats. Use `tol = 1e-3` for unitless, `tol = 0.5 m` or `0.5 kt` for physics quantities.

### CI

`.github/workflows/test.yml` runs on push + PR to `main`:

1. **test** matrix Node 20 + Node 22 → `npm test`
2. **lint-html** : checks that all `?v=N` cache-bust suffixes in `index.html` agree (a single number), and that `credentials.json` / `.env*` are never committed.

To bump cache version : `sed -i 's/?v=N/?v=N+1/g' index.html` after any JS change, otherwise users will run stale code. The CI lint job will fail if you forget to bump uniformly.

### Pre-commit hygiene

Before every commit involving JS changes:

1. `npm test` locally — must be green.
2. Bump the `?v=N` cache version uniformly in `index.html` (one number, applied with `sed` to all `<script>` tags + the comment).
3. Brace balance sanity check : `python3 -c "src=open('FILE.js').read(); print(sum(1 for c in src if c in '({[') == sum(1 for c in src if c in ')}]'))"` — catches missing `}` from a botched Edit.
4. Never commit `credentials.json`, `.env*`, or anything under `.claude/`. The `.gitignore` enforces this but double-check `git status`.
