# DZ Drop Planner

Simulateur et optimiseur de passages de largage parachutisme (Cessna Caravan C208B), application HTML statique sans build.

![CI](https://github.com/juleshumbert/dz-drop-planner/actions/workflows/test.yml/badge.svg)

## Quick start

```bash
# Lancer l'app
npm run serve   # python3 -m http.server 8000
# → http://localhost:8000/

# Lancer les tests
npm test        # 67 tests, ~250 ms
```

Requiert **Node 20+** pour les tests (utilise `node:test` builtin, zéro dépendance npm).

## Architecture

Application statique HTML + JS vanilla (ES5-style IIFE, pas de bundler).

- `physics-core.js` — kernel scientifique : atmosphère ISA, intégrateurs RK4/RK2, simulation chute libre / ouverture / sous voile, optimiseur V3 stick builder
- `monte-carlo.js` — quantification d'incertitude (perturbations vent AR(1) + jumpers)
- `optimizer-v3.js` + `optimizer-worker-v3.js` — pipeline V3 : top vert / top fin par ancres, stick type 8 sorties, fillers, MC 1000 itér.
- `nfz.js` — no-fly zones polygonales
- `pattern-editor.js` — édition interactive des circuits, zones de posé, NFZ
- `simulation.js`, `app.js`, `map.js`, `charts.js`, `ui-optimizer.js`, `animation.js` — UI + glue Leaflet/D3

Détails complets dans [`CLAUDE.md`](./CLAUDE.md). Modèle scientifique dans [`SCIENCE.md`](./SCIENCE.md). Méthodologie largage / FFP dans [`METHODOLOGIE.md`](./METHODOLOGIE.md).

## Tests

```bash
npm test                # full suite
npm run test:watch      # auto-rerun
npm run test:coverage   # coverage report (Node experimental)
```

Couverture : atmosphère / vent / intégrateurs / circuit d'atterrissage / NFZ / Monte-Carlo / V3 stick builder. Détails dans [`CLAUDE.md`](./CLAUDE.md) section _Tests & CI_.

## License

MIT.
