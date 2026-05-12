# DZ Drop Planner — méthodologie complète et plan d'évolution

*Document de référence pour **jump-simu**. Décrit fidèlement le fonctionnement actuel du simulateur (atmosphère, météo, aérodynamique de la chute, ouverture, vol sous voile, Monte-Carlo, optimiseur) et propose un plan d'amélioration chiffré, adossé à la recherche aérodynamique consignée dans `AERODYNAMICS_RESEARCH.md` et à la DT FFP 49 pour les aspects wingsuit. Il doit se lire aussi bien comme une **documentation** destinée à un nouveau contributeur que comme un **plan d'implémentation** pour les évolutions à venir.*

---

## Sommaire

1. [Portée du document et conventions](#1-portée-du-document-et-conventions)
2. [Architecture globale du code](#2-architecture-globale-du-code)
3. [Modèle atmosphérique](#3-modèle-atmosphérique)
4. [Données météorologiques](#4-données-météorologiques)
5. [Hypothèses de largage et repères géométriques](#5-hypothèses-de-largage-et-repères-géométriques)
6. [Chute libre — aérodynamique et intégration](#6-chute-libre--aérodynamique-et-intégration)
7. [Phase d'ouverture](#7-phase-douverture)
8. [Vol sous voile](#8-vol-sous-voile)
9. [Pilotage et steering](#9-pilotage-et-steering)
10. [Pipeline complet `simPass`](#10-pipeline-complet-simpass)
11. [Monte-Carlo et quantification d'incertitude](#11-monte-carlo-et-quantification-dincertitude)
12. [Optimiseur en 4 phases](#12-optimiseur-en-4-phases)
13. [Zones interdites (NFZ)](#13-zones-interdites-nfz)
14. [Synthèse des hypothèses courantes](#14-synthèse-des-hypothèses-courantes)
15. [Limites actuelles et plan d'amélioration](#15-limites-actuelles-et-plan-damélioration)
    1. §15.1–15.16 (voir détail)
    2. §15.17 [Paramétrage Monte-Carlo enrichi en UI](#1517-paramétrage-monte-carlo-enrichi-en-ui)
    3. §15.18 [Enveloppe d'incertitude le long de la trajectoire (1σ / 3σ)](#1518-enveloppe-dincertitude-le-long-de-la-trajectoire-1σ--3σ)
    4. §15.19 [Stick type pour l'optimisation](#1519-stick-type-pour-loptimisation)
    5. §15.20 [Délai de sortie inter-groupes basé sur la vitesse relative plan-voile (Geens 2003)](#1520-délai-de-sortie-inter-groupes-basé-sur-la-vitesse-relative-plan-voile-geens-2003)
16. [Annexes — API publique et constantes](#16-annexes--api-publique-et-constantes)

---

## 1. Portée du document et conventions

### 1.1 Ce que décrit ce document

- Le **modèle scientifique** implémenté (cohérent avec `SCIENCE.md`, plus détaillé sur les hypothèses et sur le lien entrées UI ↔ physique).
- La **chaîne de calcul** depuis la saisie de l'utilisateur (DZ, FL, météo, stick) jusqu'au verdict GO/NOGO sous Monte-Carlo.
- Les **hypothèses simplificatrices** actuellement en place, leurs domaines de validité, leurs effets de bord potentiels.
- Les **points d'évolution** : chaque limite identifiée donne lieu à une proposition d'implémentation, chiffrée et adossée à la recherche aéro (`AERODYNAMICS_RESEARCH.md`) ou à la DT FFP 49 (wingsuit).

### 1.2 Ce que le document ne décrit pas

- L'UI en tant que telle (DOM, composants Tailwind, Leaflet) — c'est le rôle des commentaires en tête de `app.js`, `map.js`, `charts.js`, `ui-optimizer.js`.
- Les règles réglementaires de largage côté pilote avion (cf. `METHODES_LARGAGE.md`).

### 1.3 Conventions

- **Langue** : français. Le vocabulaire technique suit `AERODYNAMICS_RESEARCH.md §7`.
- **Unités** :
  - Interne (code) : **SI strict** — m, m/s, rad.
  - UI : kt, NM, ft, FL, °. Conversions via `PhysicsCore.KT2MS`, `NM2M`, `DEG2RAD`.
- **Repère** : Est/Nord en mètres relatifs au centre DZ. `cosLat = cos(lat_DZ)`, `toE(lon) = (lon−lon_DZ)·111320·cosLat`, `toN(lat) = (lat−lat_DZ)·111320`.
- **Variables d'état** : vecteur `s = [xE, xN, z, vE, vN, vz]`, tout en SI. `z` est l'altitude **absolue** (AMSL), pas AGL.

---

## 2. Architecture globale du code

### 2.1 Pile zéro-build

L'application est une page HTML statique + JS vanille. **Pas de bundler, pas de `npm`, pas de test runner.** Tailwind, D3, Leaflet sont chargés depuis des CDN. Deux modes d'exécution :

- **HTTP local** (recommandé, nécessaire pour le multithreading optimal) : `python3 -m http.server 8000`, puis `http://localhost:8000/`.
- **`file://` direct** : fonctionne aussi. Les Web Workers tombent alors sur une solution de repli : `optimizer-v2.js::_fetchPCSource` injecte la source de `physics-core.js` dans un Blob-worker (XHR synchrone vers le fichier). Toute modification du plumbing worker doit préserver ce fallback.

### 2.2 Ordre de chargement des scripts (IIFE globales)

Ordre dicté dans `<body>` à la fin de `index.html` :

| # | Fichier | Exporte | Dépend de |
|---|---|---|---|
| 1 | `physics-core.js` | `PhysicsCore` | — |
| 2 | `nfz.js` | `NFZ` | Leaflet |
| 3 | `monte-carlo.js` | `MonteCarlo` | `PhysicsCore` |
| 4 | `simulation.js` | `runSimulation`, `runCoreSimulation`, `simulateHeadless` (orchestration main-thread, lecture de l'état UI) | `PhysicsCore`, `NFZ`, état global `app.js` |
| 5 | `app.js` | `DZ_DB`, `PARA_TYPOLOGIES`, `PLEVELS`, état global (`map`, `windProfile`, `meteoData`, `jumpersList`, `currentTarget`, `currentRV`, `simResults`), UI wiring, `recompute()`, `fetchMeteo()` | `PhysicsCore` |
| 6 | `charts.js` | barbes de vent D3, airgram, profil transversal, graphe distance | D3, `windProfile` |
| 7 | `map.js` | init Leaflet, marqueurs DZ/RV/cible, poignées de drag de l'axe, overlays | Leaflet |
| 8 | `animation.js` | timeline de lecture (avion + parachutistes) | `simResults` |
| 9 | `optimizer-v2.js` | `OptimizerV2` (unique pipeline optimisation 4 phases) | `PhysicsCore`, `MonteCarlo`, workers |
| 10 | `ui-optimizer.js` | panneaux NFZ, Monte-Carlo, bouton "OPTIMISER" | `OptimizerV2`, `MonteCarlo`, `NFZ` |

### 2.3 Duplication de physique — point critique

La physique existe **en deux exemplaires** :

- `physics-core.js` (`PhysicsCore.*`) est le **kernel canonique**, sans effet de bord, utilisé par `OptimizerV2`, `optimizer-worker-v2.js` et `MonteCarlo`.
- `simulation.js` contient un **jumeau legacy** (`getAtmosphere`, `getDensity`, `computeTAS`, `rk4Step`, `rk2Step`, `windVecAtZ`…) utilisé par le chemin main-thread pour les rafraîchissements live (`recompute()` → `runSimulation`).

**Règle absolue** : toute modification de constante ou de formule physique doit être appliquée aux deux fichiers en même temps, et `SCIENCE.md` doit être mis à jour. Sans ça, les résultats main-thread et worker divergent silencieusement.

> Le §15.1 propose de supprimer le jumeau legacy et de faire transiter le main thread entièrement par `PhysicsCore`. C'est la priorité n°1 des évolutions.

### 2.4 Un seul optimiseur

Le pipeline d'optimisation est fourni uniquement par **`OptimizerV2`** (`optimizer-v2.js`), qui délègue le travail parallèle à `optimizer-worker-v2.js`. Le bouton "OPTIMISER" de `index.html` (`onMainOptimize`) appelle directement `OptimizerV2.run()`. Tout nouveau travail cible ce chemin unique.

### 2.5 Contrat Web Worker

Les workers reçoivent des **entrées sérialisées complètes** : `windProfile`, `jumpersList`, `nfzSerialized`, `cfg`. Ils n'ont **aucun accès DOM, aucun état partagé**. Toute nouvelle entrée doit :
1. Être ajoutée au message posté (copie sérialisable).
2. Être prise en compte dans `PhysicsCore` pour l'appliquer.
3. Être remontée côté `ui-optimizer.js` / `optimizer-v2.js` où la config est construite.

### 2.6 État global (pas de framework)

L'état vit dans des `var` au niveau module de `app.js` :

| Variable | Contenu | Lue par |
|---|---|---|
| `windProfile` | tableau de 12 couches `{hpa, z, spd, dir, temp, cloud, geoH}` | `PhysicsCore.setWindProfile`, `charts.js`, Monte-Carlo |
| `meteoData` | dernière réponse Open-Meteo enrichie (`qnh`, `cloud_*`, `time`) | UI, `recompute()` |
| `jumpersList` | stick courant — array de configs parachutistes | `simPass`, builder d'UI, optimiseur |
| `currentTarget` | `{lat, lon}` point visé | `simPass`, carte |
| `currentRV` | `{lat, lon}` zone RDV | `simPass`, carte |
| `simResults` | dernière sortie de `runSimulation` | `animation.js`, `charts.js`, carte |

Toute nouvelle donnée d'état doit être placée dans `app.js` et `recompute()` doit maintenir les dérivées à jour.

---

## 3. Modèle atmosphérique

### 3.1 ISA à 3 couches — fondation

L'Atmosphère Standard Internationale est implémentée dans `PhysicsCore.getAtmosphereRho(altM, isa)` :

| Couche | Altitude | Température `T(z)` | Pression `P(z)` |
|---|---|---|---|
| Troposphère | 0 – 11 000 m | `T = 288.15 − 0.0065·z` | `P = 101325·(T/288.15)^5.2559` |
| Tropopause | 11 000 – 20 000 m | `T = 216.65` | `P = P₁₁·exp(−g·(z−11000)/(R·216.65))` |
| Stratosphère | > 20 000 m | `T = 216.65 + 0.001·(z−20000)` | `P = P₂₀·(T/216.65)^(−g/(0.001·R))` |

Constantes : `g = 9.80665 m/s²`, `R_air = 287.058 J·kg⁻¹·K⁻¹`, `ρ₀ = 1.225 kg/m³`, plancher numérique `T ≥ 150 K`. Le paramètre utilisateur `isa` (K) **décale uniquement la température** `T(z) := T_ISA(z) + isa`, pas la pression.

Densité déduite par gaz parfait : `ρ(z) = P(z) / (R_air · T(z))`.

### 3.2 Rôle actuel des données météo pour ρ

Point important à clarifier : **aujourd'hui, `ρ(z)` est calculée uniquement à partir de l'ISA + delta utilisateur**, pas à partir des données Open-Meteo. La chaîne est :

```
UI                    PhysicsCore                      Sortie
────────────────────────────────────────────────────────────
altM (FL × 30.48)  ─┐
qnh (depuis méteo) ─┼─→ altQnhM = altM + (qnh−1013.25)·8.43
isaDelta (UI)      ─┼─→ getDensity(altQnhM, isaDelta) ─→ ρ(z)
                    │
windProfile[i].temp ╳  (pas utilisé pour ρ)
windProfile[i].geoH ╳  (pas utilisé pour ρ)
```

Autrement dit :
- **`qnh`** issu de `meteoData.qnh` est **bien injecté** dans l'altitude effective (§3.4).
- **`isaDelta`** est **saisi manuellement** dans l'UI (`isa_delta`), valeur par défaut 0.
- **Les températures par niveau** `windProfile[i].temp` renvoyées par Open-Meteo sont **stockées mais inutilisées** côté ρ. Elles servent uniquement à l'airgram pour l'affichage.

Effet : si l'atmosphère réelle est à ISA+15 °C (journée chaude en Occitanie) et que l'utilisateur n'a pas ajusté `isaDelta`, la densité calculée est fausse de ~5 %, ce qui décale la TAS et la vitesse terminale d'autant. *Le §15.13 propose de dériver `ρ(z)` directement du profil thermique Open-Meteo.*

### 3.3 Table d'interpolation de densité (LUT)

Pour la performance (ρ est évaluée à chaque pas RK4), une LUT `Float64Array(1301)` est précalculée à l'initialisation : 0 à 13 000 m par pas de 10 m, avec interpolation linéaire. Hors plage ou si `isa ≠ 0`, `getAtmosphereRho` est appelée directement.

**Invariant** : la LUT n'est calculée qu'une fois (au chargement) ; elle ne change jamais. Elle est construite à `isa = 0`, donc un `isaDelta ≠ 0` court-circuite la LUT et paie le coût de `getAtmosphereRho` à chaque pas. Pour une simulation en atmosphère non-standard c'est le cas attendu ; pour une optimisation massive on a intérêt à garder `isaDelta = 0`.

### 3.4 Correction QNH

L'altitude saisie par l'utilisateur (`FL × 100 × 0.3048`) est une **altitude pression** référée à 1013.25 hPa. La correction QNH simple :

```
altQnhM = altM + (qnh − 1013.25) × 8.43
```

`8.43 m/hPa` correspond au gradient altimétrique pour une atmosphère standard à basse altitude (pH ≈ R·T/g ≈ 8 430 m pour T = 288 K ⇒ dz/dP ≈ 8.43 m/hPa au sol). C'est la formule utilisée par tous les altimètres aéronautiques.

### 3.5 Vitesse vraie (TAS)

`PhysicsCore.computeTAS(kiasMs, altM, isa)` convertit KIAS en TAS :

```
TAS = KIAS × √(ρ₀ / ρ(z))
```

Pour FL140 ISA standard, la correction est typiquement de l'ordre de **+20 %** (KIAS 120 → TAS ~144 kt).

---

## 4. Données météorologiques

### 4.1 Source : Open-Meteo

L'application pointe vers `https://api.open-meteo.com/v1/forecast` avec :
- **Modèle** : choisi par l'utilisateur (GFS, ECMWF, ICON, AROME selon couverture) — paramètre `model`.
- **Lieu** : lat/lon de la DZ sélectionnée.
- **Horaire** : `hourly=…` avec, pour chaque niveau pression, `wind_speed_{hpa}hPa`, `wind_direction_{hpa}hPa`, `temperature_{hpa}hPa`, `cloud_cover_{hpa}hPa`, `geopotential_height_{hpa}hPa`.
- **Unités vent** : `wind_speed_unit=kn` (nœuds).
- **Horizon** : jusqu'à **+48 h** (sélecteur `meteo_hour` peuplé par `populateHours()`).

L'offset horaire choisi par l'utilisateur détermine l'index lu dans la réponse (`idx = min(hourOffset, data.hourly.time.length − 1)`).

### 4.2 Niveaux pression exploités

```js
PLEVELS = [500, 550, 600, 650, 700, 750, 800, 850, 900, 925, 950, 1000]; // hPa
```

12 niveaux qui couvrent ~0 m (1000 hPa) à ~5 500 m (500 hPa) en atmosphère standard. Suffisant pour les altitudes typiques de largage (FL80–FL145).

Chaque couche est stockée comme `{hpa, z, spd, dir, temp, cloud, geoH}` où **`z` est le `geopotential_height`** renvoyé par l'API (altitude géopotentielle réelle du niveau pression), pas une altitude ISA supposée. La conversion `hpa2alt` (`charts.js`) sert de repli quand l'API ne renvoie pas la géopotentielle.

### 4.3 Données météo annexes

En plus du profil vent, la réponse enrichit `meteoData` :
- `qnh` : `pressure_msl[idx]` — injecté dans la correction altimétrique (§3.4).
- `cloud_total`, `cloud_low`, `cloud_mid`, `cloud_high` : airgram et alerte plafond.
- `time` : timestamp ISO, affiché sous l'airgram.

### 4.4 Interpolation vectorielle du vent — justification physique

Dans `PhysicsCore.windAtZ(z)` : l'interpolation se fait sur les **composantes Est/Nord** déjà précalculées dans `setWindProfile`, pas sur (vitesse, direction).

**Pourquoi vectoriel ?** Interpoler la direction à travers le passage 360°/0° produit des artefacts énormes. Exemple : si la couche inférieure est à 355° et la suivante à 5°, interpoler la direction donne 180° (à l'envers), alors qu'interpoler E/N donne 0° (correct).

**Pourquoi linéaire et pas spline cubique ?** Le vent en troposphère libre varie de façon relativement douce en altitude (hors couches de cisaillement marquées), et la densité des mesures Open-Meteo (12 niveaux entre 0 et 5 500 m, soit ~450 m entre couches dans la basse troposphère) est assez fine pour que l'erreur d'interpolation linéaire soit de l'ordre de grandeur de l'incertitude modèle elle-même (1–2 kt, quelques degrés). Une spline cubique n'apporterait rien de physiquement significatif dans la plage d'intérêt (0–4 500 m).

**Physiquement valide ?** Oui pour la troposphère libre où le vent est quasi-géostrophique et varie lentement avec l'altitude. Dans la couche limite de surface (<300 m), c'est le **profil logarithmique de Prandtl** (§4.5) qui prend le relais — c'est lui qui est physiquement important, pas la spline entre couches d'altitude.

**Conséquence pratique** : la linéarité reste. Elle est **cohérente avec la résolution verticale des données source** (Open-Meteo fournit des moyennes par niveau pression, pas des profils haute résolution type radiosondage). Le cache eager du §4.6 gèle ces valeurs à l'initialisation pour supprimer le coût à la requête.

### 4.5 Profil logarithmique de surface (Prandtl)

Sous la plus basse couche de la prévision, un profil **log** est appliqué :

```
V(z) = V_ref × ln(z/z₀) / ln(z_ref/z₀)
```

avec `z₀ = 0.03 m` (longueur de rugosité pour terrain plat/herbe type DZ). En dessous de `z₀` (soit 3 cm), la vitesse est mise à zéro.

**Effet** : à 100 m sol, avec `V_ref = 15 kt` à 300 m, on obtient ~12.7 kt. Cela évite les discontinuités visibles en finale et rapproche la simulation de l'expérience pilote (arrondi au vent presque nul).

### 4.6 LUT de vent précalculée (comme pour ρ)

**Conception cible.** Exactement comme la LUT densité du §3.3, le profil de vent est transformé en **deux `Float64Array` précalculées** à chaque `setWindProfile`. Deux tableaux `_wLutE[0..maxAlt]` et `_wLutN[0..maxAlt]` (par pas de 1 m, typiquement 0–14 000 m) sont remplis **eager** au moment du `setWindProfile`, en appelant `windAtZ_computed(z)` pour chaque index entier. `windAtZ(z)` se réduit alors à :

```js
function windAtZ(z) {
  var k = z | 0;
  if (k < 0) k = 0;
  if (k >= _wLutE.length) k = _wLutE.length - 1;
  var f = z - k;
  return {
    e: _wLutE[k] + f * (_wLutE[k+1] - _wLutE[k]),
    n: _wLutN[k] + f * (_wLutN[k+1] - _wLutN[k])
  };
}
```

Coût mémoire : 2 × 14 000 × 8 B = 224 kB — négligeable. Gain : `windAtZ` devient une lecture pure en O(1), sans recherche binaire, sans branchement de repli log-Prandtl (déjà encodé dans la LUT). **Cela retire une fraction significative du temps d'un `simPass`** qui appelle `windAtZ` plusieurs milliers de fois par parachutiste.

**Invalidation.** La LUT est reconstruite à chaque `setWindProfile` (changement de DZ, de modèle, d'heure, de perturbation Monte-Carlo). C'est acceptable car ces événements sont rares (dizaines par seconde au pire en MC, avec 14 000 évaluations `windAtZ_computed` à reconstruire = 1.4 × 10⁵ opérations, coût ~1 ms).

**Implémentation actuelle.** Le code actuel de `enableWindCache` est un cache **lazy** à sentinelle (`-999999`), rempli à la première requête. L'évolution §15.14 le remplace par le LUT eager ci-dessus, pour le bénéfice de performance et la simplicité du code.

---

## 5. Hypothèses de largage et repères géométriques

### 5.1 Chaîne des repères

Le calcul du point de largage suit la géométrie classique du jump run. Dans `PhysicsCore.simPass` :

1. **Cible (TGT)** : `currentTarget` en E/N ; typiquement le centre de la PA.
2. **Offset cross-track** : `crossNm` (NM, signé). Le vecteur perpendiculaire au jump run est `(trackN, −trackE)`. Point visé après offset :
   ```
   tgtE = targetE + crossM × perpE
   tgtN = targetN + crossM × perpN
   ```
3. **Top vert (greenPoint)** : à `topNm` devant `tgt` selon l'axe.
4. **Sortie du parachutiste n°1 (p1Exit)** : à `delaiTopVert` secondes après le top vert. Le delta est `delaiTopVert × gsMs` projeté sur l'axe.
5. **Sortie du parachutiste n°i** : `p_i = p1Exit + trackE·(i·dt_sortie·gsMs), …`
6. **Top rouge (redPoint)** : dernière sortie.

### 5.2 Vitesse sol sur jump run

```
tw = wJump · track           (composante vent projetée sur l'axe)
gsMs = max(1, tasMs + tw)
dtSortie = espacementM / gsMs
```

`tw < 0` face au vent → `gsMs < tasMs`, `dtSortie` augmente → meilleure séparation horizontale inter-parachutiste.

### 5.3 Direction de break-off et séparation intra-groupe

Le signe de l'offset cross-track détermine **de quel côté** de l'axe se trouve la RV, ce qui définit la direction de sortie du break-off pour chaque parachutiste. Les parachutistes se séparent **en s'éloignant de la RV** côté opposé, pour laisser à chacun l'espace de piloter vers la RV sans conflit.

Pour un groupe de `nbPara > 1` dans une même entrée (freefly, VR), les sous-parachutistes sont distribués sur un cercle de rayon `sepDist` autour du point de sortie, angle `360°/nbPara`.

### 5.4 Hypothèses implicites

- **Axe constant** : le pilote vole l'axe commandé, pas de correction dynamique.
- **Vitesse constante** : TAS fixée par le réglage UI, pas de modèle de pilotage avion.
- **Exit vertical parfait** : chaque parachutiste quitte l'avion avec la vitesse sol de l'avion (`gsE`, `gsN`) et `vz = 0`. Pas de modèle de "marche à la porte" ni de chute initiale différentielle. Approximation correcte pour un exit propre. *Le §15.8 introduit une incertitude sur le temps de sortie effective qui englobe ce phénomène.*

---

## 6. Chute libre — aérodynamique et intégration

### 6.1 Équations de traînée

L'état est `s = [xE, xN, z, vE, vN, vz]`. Le simulateur **ne modélise pas `Cd·A` explicitement** : il paramètre la traînée par la **vitesse terminale `vT`** (donnée par l'utilisateur comme `vc`).

Vitesse relative à l'air (corrigée du tracking, cf §6.3) :
```
v_r = v − w(z) − v_track
|v_r| = √(vr,E² + vr,N² + vr,z²)
```

Coefficient de traînée effectif :
```
c = (ρ(z)/ρ₀) × g / vT²
```

Dérivées :
```
v̇_E = −c · |v_r| · v_r,E
v̇_N = −c · |v_r| · v_r,N
v̇_z = −g − c · |v_r| · v_r,z
```

**Vérification physique** : à l'équilibre vertical stable au niveau de la mer (`v_E = w_E`, `v_N = w_N`, `v̇_z = 0`, `ρ = ρ₀`), on retrouve `−g + (g/vT²)·vT² = 0`. Donc `vT` est exactement la vitesse terminale MSL. En altitude, la densité réduit le coefficient effectif et la terminale réelle devient `vT·√(ρ₀/ρ(z))`, cohérent avec `V_term ∝ 1/√ρ`.

### 6.2 Limites du modèle isotrope

**Avantages.** Un seul paramètre `vT`, O(1) par évaluation, correction densité correcte, compatible `trackVec`.

**Limites.**
- **Isotrope** : `c` identique dans les 3 directions. Un ventral a en réalité `Cd·A` vertical ~3× supérieur à horizontal.
- **Pas de portance explicite** : une wingsuit génère une vraie `L`, modélisée ici comme un vent fantôme via `trackVec`.
- **`vT` unique** pour ventral, sit, tête en bas, tandem, AFF.

### 6.3 Injection du tracking

Pour un tracking ou wingsuit, l'utilisateur saisit `trackDist` (m horizontaux) et `trackAxis` (angle signé par rapport à l'axe de largage). Dans `simJumper` :

```js
totalFallZ = env.altM − hOuvAbs
vtTrack    = vc × 1.15
grTrack    = min(trackDist / max(totalFallZ, 100), 1.5)
vhTrack    = grTrack × vtTrack
trackVec   = { e: sin(axe + trackAxis) · vhTrack,
               n: cos(axe + trackAxis) · vhTrack }
```

Le vecteur est soustrait de `v_r`. Le parachutiste trouve un équilibre où `vh ≈ vhTrack`. Le facteur ×1.15 majore la terminale (surface efficace tracking légèrement supérieure au ventral).

**Limite immédiate** : le plafond `grTrack ≤ 1.5` est correct pour un tracking en combi mais **sous-estime une wingsuit haute performance (2.5–3.5)**. Évolution §15.3.

### 6.4 Break-off

Si `hBreak > hOuv`, une deuxième phase de chute libre va de `hBreak` à `hOuv` avec un `trackVec` issu du vecteur radial `_sepE/_sepN`. Modélise la séparation post-break-off.

### 6.5 Intégration — RK4 classique

`PhysicsCore.rk4` sur un pas `dt` (classique à quatre évaluations). Pas typique : **`dt = 0.25 s`** ; validation finale V2 à `dt = 0.15 s`. Erreur locale `O(dt⁵)`, globale `O(dt⁴)`, acceptable à <1 m pour des trajectoires de 30–60 s à `vc ~ 50 m/s`.

### 6.6 Détection de seuil

À chaque pas, si `ns[2] ≤ targetZ`, interpolation linéaire fractionnaire :
```
frac = (s[2] − targetZ) / (s[2] − ns[2])
s_exact = s + frac · (ns − s)
```

Évite un biais systématique de `±dt/2`.

---

## 7. Phase d'ouverture

### 7.1 Modèle à 3 sous-phases

`PhysicsCore.simOpening(s0, vc, vzVoile, isa, elevM, dt)` modélise la transition chute → voile sur **5.5 s** :

| Sous-phase | Durée | `vE` effective (vT "effective") |
|---|---|---|
| Pilot chute (extraction) | 1.0 s | `vc × (1 − 0.1·t/t_P)` : diminution linéaire 10 % |
| Line stretch (déploiement) | 1.5 s | Transition linéaire `vc → 3·vzVoile` |
| Inflation (gonflage) | 3.0 s | Transition lissée Hermite `3·vzVoile → vzVoile` |

Lissage Hermite `f²·(3 − 2f)` → dérivée nulle aux bornes. `max(vE, vzVoile)` empêche la surcorrection numérique.

### 7.2 Intégration RK2 (Heun)

Pas `dt = 0.1 s`. Justification : phase courte, `vE` varie rapidement ; RK2 fin = meilleur compromis que RK4.

### 7.3 Hypothèses implicites

- **Durée fixe 5.5 s**, quelle que soit la voile. Évolution §15.4.
- **Pas de pic snatch** : le modèle ne reproduit pas la pointe d'effort tension-lignes (3–6 G selon type).
- **Pas de dérive de cap pendant l'ouverture** : parachutiste supposé ouvrir en ligne droite.
- **Vent vertical nul**.

### 7.4 Transition main → voile

À la sortie de `simOpening`, l'état est fourni tel quel à `simCanopy`. La vitesse verticale est `vzVoile`, la vitesse horizontale est l'intégration du vent pendant l'ouverture. Cap initial `atan2(vE, vN)` : le parachutiste "sort" de l'ouverture face à la trajectoire d'air ambiant.

---

## 8. Vol sous voile

### 8.1 Modèle cinématique

Le vol sous voile est **cinématique**, pas résolu en forces :

```
vh_TAS = vzVoile × glide × √(ρ₀/ρ(z))            # vitesse horizontale air
vz     = vzVoile × √(ρ₀/ρ(z)) + k_virage·ψ̇²       # vitesse verticale + coût virage
v_E    = sin(ψ)·vh_TAS + w_E(z)
v_N    = cos(ψ)·vh_TAS + w_N(z)
```

avec `ψ` le cap, mis à jour via un modèle de virage.

### 8.2 Correction de densité

Comme pour la TAS avion, la voile vole plus vite en altitude (air moins dense). À FL140, ~+20 %. Les paramètres saisis sont donc référés au niveau du sol.

### 8.3 Modèle de virage

Dans `simCanopy`, chaque pas (`dt = 0.5 s` par défaut) :
1. Cible de cap `targetH` fournie par `steerFn(state, t)`.
2. `delta = targetH − heading` ramené à `[−180°, 180°]`.
3. `desiredRate = clamp(delta/dt, −maxTR, +maxTR)`.
4. Accélération angulaire limitée : changement de taux ≤ `rateAccel × dt`.
5. Freinage anticipatif : si `|delta| < stoppingAngle × 1.2 && |delta| < 10°`, taux × 0.7.
6. Mise à jour du cap.
7. Coût de virage sur `vz` : `vz += turnSinkFactor × currentRate²`.

Valeurs par défaut : `maxTurnRate = 30°/s` (modulé par `skill`), `rateAccel = 90°/s²`, `turnSinkFactor = 0.015`.

### 8.4 Hypothèses implicites

- **Finesse constante** : ne dépend ni des freins, ni de la charge alaire explicite, ni de la densité. *Simplification majeure, évolutions §15.5–15.7.*
- **Pas de min-sink ni rear-riser** : toujours en plein vol. Évolution §15.5.
- **Pas de décrochage.**
- **Arrondi implicite** : simulation stoppe à `z = elevM`.

---

## 9. Pilotage et steering

### 9.1 Steering "vers un point"

`PhysicsCore.createSteerToPoint(targetE, targetN, vhMs, opts)` calcule à chaque pas le cap à viser pour que le **vecteur vitesse sol** pointe vers la cible (algorithme "crab angle") :

1. Distance cible `dh = √(dx² + dy²)`. Si `dh < 5 m`, cap figé.
2. Vent courant `w = windAtZ(z)`.
3. Composante perpendiculaire `wp = w · perp(dx̂, dŷ)`.
4. Si `|wp| ≥ vhMs` → vol **face au vent pur** (pénétration impossible).
5. Sinon `comp = √(vh² − wp²)`, vecteur vitesse air cible aligne la vitesse sol.

**Bruit pilote** : `noiseAngle = noiseSeed · 20°·(1 − skill)`.  
**Délai de réaction** : `reactionDelay = 2.0 / max(skill, 0.1)` s.

### 9.2 Steering deux-phases

`createSteerTwoPhase(…, tPilot, …)` : pendant `t < tPilot` (défaut 8 s), cap "perpendiculaire" vers `perpE/perpN` (break-off). Ensuite : steering direct vers la RV.

### 9.3 Critère d'atteinte de la zone RDV

```js
if (|state[0] − rvZone.e| ≤ rvZone.L/2 &&
    |state[1] − rvZone.n| ≤ rvZone.W/2)
  → stop, data = { marge: state[2] − rvZone.altAbs }
```

`rvAlt = 300 m AGL` par défaut : ~1 min de vol sous voile restante pour la finale.

---

## 10. Pipeline complet `simPass`

### 10.1 Entrées de `simPass(cfg)`

| Champ | Unité | Description |
|---|---|---|
| `dz`, `target`, `rv` | `{lat, lon}` | Centre DZ, cible, zone RDV |
| `axe` | ° | Cap jump run |
| `crossNm`, `topNm` | NM | Offset latéral signé, distance top vert → cible |
| `altM`, `elevM` | m | Altitude sortie AMSL (QNH-corrigée), altitude sol |
| `tasMs`, `isa` | m/s, K | TAS avion, delta ISA |
| `delaiTopVert`, `espacementM` | s, m | Délai annonce pilote, séparation horizontale |
| `jumpers`, `nPara` | array, int | Stick |
| `dtCfg` | `{ff, open, canopy}` | Pas d'intégration |
| `sepThresh`, `timeMin` | m, s | Seuils min séparation / `dtSortie` |
| `nfzList` | array | Zones NFZ sérialisées |
| `rvLength`, `rvWidth`, `rvAlt` | m | Géométrie/plancher RV |
| `tPilotCommon` | s | Durée steering break-off |
| `_windProfile`, `_mcNoise` | — | Injection Monte-Carlo |

### 10.2 Étapes

1. **Géométrie** : lat/lon → E/N.
2. **Vent d'altitude** → `gsMs`, `dtSortie`.
3. **Points clés** : `tgtE/N`, `greenE/N`, `p1ExitE/N`.
4. **Direction break-off** : `crossSign`.
5. **Boucle parachutistes** : `simJumper` × N avec positions de sortie décalées.
6. **Séparations** : `computePairMinDists` avec garde `t₀ + 10 s`.
7. **NFZ** : échantillonnage tous les 3 points, bbox + ray-casting.
8. **Verdict GO** : `!nfzViolation && ∀ margeRDV ≥ 0 && sep_min ≥ 50 m && dtSortie ≥ 5 s`.

---

## 11. Monte-Carlo et quantification d'incertitude

### 11.1 Intention

`simPass` est déterministe. Le Monte-Carlo relance N passes (défaut 100) avec entrées perturbées. Sorties :
- `P_GO` = fraction de passes GO.
- Verdict GO (≥ 95 %) / MARGINAL (≥ 80 %) / NOGO.
- Ellipses de confiance 95 % sur `open` et `land` de chaque parachutiste.
- Percentiles (P5, P25, P50, P75, P95) sur marges RDV.
- Percentiles P5 / P50 des distances minimales inter-parachutistes.

### 11.2 Box-Muller

```
u1, u2 ∼ U(0, 1)
Z = √(−2·ln(u1 + 1e−30)) · cos(2π·u2)
```

### 11.3 Perturbation du vent — AR(1) corrélé

```
ε_k = φ · ε_{k−1} + √(1 − φ²) · σ · N(0,1)
```

`φ = 0.7`, σ_spd = 3 kt, σ_dir = 15°. Facteur `√(1 − φ²)` = normalisation variance stationnaire. Longueur de corrélation verticale ~1 km.

### 11.4 Perturbations actuelles des parachutistes

| Paramètre | Perturbation | σ défaut |
|---|---|---|
| `vc` | × (1 + σ·N(0,1)) | 5 % |
| `vzVoile` | × (1 + σ·N(0,1)) | 8 % |
| `glide` | × (1 + σ·N(0,1)) | 10 % |
| `hOuv` | + σ·N(0,1) | 50 m |
| `skill` | additive, clampé [0.2, 1.0] | 0.1 |
| `_mcPilotNoise` | N(0,1) injecté dans steering | — |

**Le §15.8 propose une refonte** de ces perturbations pour couvrir plus de sources d'incertitude réalistes (temps de sortie, heading à l'ouverture, tracking axis, dérive inconsciente…).

### 11.5 Calcul d'ellipse de confiance

1. Moyenne `(mx, my)` sur les N points.
2. Matrice de covariance 2×2 `Σ`.
3. Valeurs propres analytiques `λ₁, λ₂ = tr/2 ± √(tr²/4 − det)`, plancher 0.01.
4. Angle principal `½·atan2(2σEN, σEE − σNN)`.
5. Seuil chi² 2 ddl 95 % : `χ² = −2·ln(0.05) ≈ 5.991`.
6. Demi-axes `a = √(χ²·λ₁)`, `b = √(χ²·λ₂)`.
7. Polygone de 42 points rendu Leaflet.

---

## 12. Optimiseur en 4 phases

### 12.1 Motivation

Trouver manuellement `(axe, cross, top)` optimal est fastidieux. L'optimiseur cherche la meilleure configuration au sens de `PhysicsCore.objectiveScore` en enchaînant exploration grossière, raffinement local, optimisation combinatoire sur l'ordre, puis validation stochastique.

### 12.2 Phase 1 — Scan grossier (parallèle)

- **Axes** : prioritaire ±60° autour du vent à l'altitude de sortie, pas de 5° (25 axes) ; puis 0°…360° / 15° (24 axes généraux, doublons filtrés par `Set`).
- **Offsets** : −1.0 → +1.0 NM par pas de 0.2 NM (11 offsets).
- **Workers** : `N_WORKERS = min(max(hardwareConcurrency, 2), 8)` chunks d'axes.

~300 configs en 2–5 s selon matériel.

### 12.3 Phase 2 — Raffinement fin

8 meilleures configs au `nPara` max → axe ±5° par 1°, offset ±0.15 NM par 0.05. ≈ 600 configs supplémentaires.

### 12.4 Phase 3 — Ordre de sortie (algorithme génétique)

**Ordre initial (classic)** — évolution proposée (cf. §15.9). L'ordre classique de référence **supprime le hop&pop** du début (non utilisé dans la plupart des sticks réels) et **répartit les trackers et wingsuits** à trois positions du stick (début, milieu, fin) pour aérer le trafic sous voile :

```
belly_big → [tracking_1] → belly_small → freefly_big → freefly_small →
aff → [tracking_2] → tandem → [tracking_3 / wingsuit]
```

Règle de répartition :
- Si 1 tracker : placé **en fin** de stick.
- Si 2 trackers : 1 au **milieu**, 1 **en fin**.
- Si ≥ 3 trackers : **1 en début, 1 au milieu, le reste en fin**.
- Les wingsuits sortent **toujours en dernier** (règle FFP DT49 : vitesse verticale faible + finesse élevée + trajectoire réservée).

**Algorithme génétique** :
- Population `popSize = min(20, max(8, 2N))`.
- Générations : 100 si `N ≤ 7`, sinon 300.
- Sélection élitiste 50 %.
- Mutation : swap aléatoire.
- Pas de crossover (évolution §15.11 : Order Crossover OX).

Chaque individu scoré par `_evalOrder` → `simPass` → `objectiveScore`.

### 12.5 Phase 4 — Validation Monte-Carlo

Config optimale + ordre soumis à MC (§11) avec paramètres configurables. Validation finale via un `simPass` avec `dtCfg.ff = 0.15 s` (plus fin que les 0.25 s de l'optimisation).

### 12.6 Fonction objectif — pondérations actuelles et configurabilité

Score :
```
S = S_nPara + S_vent + S_marge + S_sep + S_temps − S_offset
```

| Composante | Formule (poids actuel) | Sens |
|---|---|---|
| Parachutistes placés | `nPara × 10 000` | ∞ (priorité absolue) |
| Alignement vent (face au vent = optimal) | `max(0, 1 − |Δaxe|/90°) × 500` | 500 |
| Marge RDV minimale | `min(margeMin/300, 1) × 2 000` | 2 000 |
| Séparation minimale | `min(sepMin/400, 1) × 1 500` | 1 500 |
| Temps inter-sortie | `min(dtSortie/12, 1) × 300` | 300 |
| Pénalité offset | `|crossNm| × 200` | −∞ |

Pré-requis : NOGO (NFZ violée, marge négative, séparation < 50 m, `dtSortie` < 5 s) ⇒ score `−∞`.

**Les poids (`10 000`, `500`, `2 000`, `1 500`, `300`, `200`) sont aujourd'hui hardcodés dans `objectiveScore`.** Le §15.10 propose de les exposer dans l'UI pour permettre au chef largueur de calibrer la fonction selon la priorité du jour (ex. maximiser les marges sur un jour limite vs. maximiser la centration sur un jour calme).

---

## 13. Zones interdites (NFZ)

### 13.1 Modèle

Chaque NFZ : polygone lat/lon, bornes `altMin`/`altMax` (m AMSL), type `hard` (violation = NOGO) ou `soft` (pénalité, pas encore active). Sérialisation worker : `_polyEN` en E/N + `_bbox` pour rejet rapide.

### 13.2 Test d'appartenance

Dans `_checkNFZ(sp, nfzList)` :
1. Échantillonnage tous les 3 points.
2. Rejet altitude hors bornes.
3. Rejet bbox.
4. Ray-casting `_pointInPoly`.

Une violation sur n'importe quelle trajectoire = passe NOGO.

### 13.3 Limites

- Zones `soft` non scorées (évolution §15.9).
- Pas de fenêtre temporelle (évolution §15.11).

---

## 14. Synthèse des hypothèses courantes

| Domaine | Paramètre | Valeur | Remarque |
|---|---|---|---|
| **Atmo** | g | 9.80665 m/s² | Constante |
| Atmo | R_air | 287.058 J/kg/K | Constante |
| Atmo | ρ₀ | 1.225 kg/m³ | ISA MSL |
| Atmo | Clamp T | 150 K | Protection numérique |
| Atmo | Gradient QNH | 8.43 m/hPa | Altimétrie standard |
| Atmo | Source ρ | ISA + `isaDelta` UI | Températures Open-Meteo non utilisées (évol. §15.13) |
| Atmo | LUT densité | 0–13 000 m / pas 10 m | Construite à `isa = 0` |
| **Vent** | z₀ rugosité | 0.03 m | Terrain plat/herbe |
| Vent | Interpolation | Linéaire sur E/N | Physiquement valide pour troposphère libre |
| Vent | PLEVELS | 12 niveaux 500–1000 hPa | Open-Meteo |
| Vent | Cache | Lazy sentinelle actuellement ; évol. §15.14 → LUT eager | |
| **Chute libre** | RK4 dt | 0.25 s (0.15 s valid.) | Compromis précision/coût |
| Chute libre | Modèle traînée | Paramétré par `vT` unique | Simplification isotrope |
| Chute libre | Tracking vT × | 1.15 | Heuristique |
| Chute libre | Finesse tracking max | 1.5 | Plafond dur (évol. §15.3 pour wingsuit) |
| **Ouverture** | Durée totale | 5.5 s | Constante toutes voiles (évol. §15.4) |
| Ouverture | Phase pilot chute | 1.0 s, `vc·(1−0.1f)` | |
| Ouverture | Phase line stretch | 1.5 s, transition linéaire | |
| Ouverture | Phase inflation | 3.0 s, Hermite `f²(3−2f)` | |
| Ouverture | RK2 dt | 0.1 s | |
| **Voile** | dt | 0.5 s | |
| Voile | maxTurnRate | 30°/s | Modulé par `skill` |
| Voile | rateAccel | 90°/s² | |
| Voile | turnSinkFactor | 0.015 | Coût quadratique de virage |
| Voile | Finesse | Constante `glide` | Pas de min-sink ni rear-riser (évol. §15.5) |
| **Steering** | `tPilotCommon` | 8 s | Break-off avant direct |
| Steering | `reactionDelay` | 2.0/max(skill, 0.1) s | |
| Steering | `headingError` | 20°·(1−skill) | |
| **Skill défaut** | Élève, tandem | 0.6 | Évol. §15.12 : lié à la typologie |
| Skill défaut | Ventral, freefly | 0.8 | |
| Skill défaut | Tracking, wingsuit | 0.9 | |
| **RV** | `rvAlt` | 300 m AGL | Plancher |
| RV | `rvLength` / `rvWidth` | 200 / 100 m | Rectangle |
| **Séparations** | `sepThresh` | 50 m | |
| Séparations | `timeMin` | 5 s inter-sortie | |
| **Monte-Carlo** | N défaut | 100 | |
| MC | σ vent spd/dir | 3 kt / 15° | |
| MC | AR(1) φ | 0.7 | Correlation ~1 km |
| MC | σ vc/vz/glide/hOuv/skill | **5 % → 10 % (évol. §15.8)** / 8 % / 10 % / 50 m / 0.1 | |
| **Optim** | Axes | ±60°/5° + 15°/360° | |
| Optim | Offsets grossiers | ±1 NM / 0.2 | |
| Optim | Raffinement | ±5°/1°, ±0.15 NM/0.05 | |
| Optim | AG générations | 100 (N≤7) / 300 (N>7) | |
| Optim | Poids objectif | Hardcodés (évol. §15.10) | |

---

## 15. Limites actuelles et plan d'amélioration

Chaque proposition identifie une limite, chiffre l'effet et propose une modification adossée à la recherche aéro ou à la DT FFP 49.

### 15.1 Unifier la physique (supprimer le duplicata `simulation.js`)

**Limite.** La physique existe en double : `physics-core.js` (canonique) et `simulation.js` (legacy main-thread). Tout écart est une bombe à retardement.

**Proposition.** Migrer le chemin main-thread de `simulation.js` vers `PhysicsCore` intégralement :
1. Remplacer `getAtmosphere`, `getDensity`, `computeTAS`, `rk4Step`, `rk2Step`, `windVecAtZ` par des appels à `PhysicsCore.*`.
2. Remplacer `runCoreSimulation` par un appel direct à `PhysicsCore.simPass`.
3. Garder `runSimulation` et `simulateHeadless` comme fines enveloppes qui lisent l'état UI et appellent `PhysicsCore.simPass`.

**Fichiers.** `simulation.js`. **Effet.** Suppression d'une classe entière de bugs de divergence, code ~500 lignes en moins.

---

### 15.2 Typologies de parachutistes alignées sur la recherche aéro et la DT FFP 49

**Limite.** `PARA_TYPOLOGIES` actuelles : 9 entrées avec `vc` grossiers, pas de distinction sit-fly vs tête en bas, pas de wingsuit réaliste, `skill` implicite à 1.0 partout.

**Proposition.** Refondre la table en alignant :
- Les vitesses terminales sur `AERODYNAMICS_RESEARCH.md §2`.
- Les paramètres wingsuit sur la **DT FFP 49** (avril 2025) : altitude minimale d'ouverture 1 100 m pour WS2 breveté, 1 500 m avant brevet, drisse 2.10 m mini (WS1), 2.40 m (WS3), séparation ≥ 10 s entre wingsuiteurs, sortie en dernier.
- Les finesses voile sur `AERODYNAMICS_RESEARCH.md §4` (classes de voile).
- Un `skill` par défaut cohérent avec l'expérience typique (table §15.12).

```js
const PARA_TYPOLOGIES = {
  // Ventral — charge alaire moyenne
  belly_std:    { name:'Ventral (RW) standard',  vc: 55, vzVoile: 5.0, glide: 2.8, hOuv: 1000,
                  hBreak: 1500, sepDist: 80, skill: 0.8, canopyClass: 'sport_9c' },
  // Freefly
  sit_fly:      { name:'Sit-fly',                vc: 68, vzVoile: 5.5, glide: 2.7, hOuv: 1200,
                  hBreak: 1700, sepDist: 120, skill: 0.8, canopyClass: 'sport_9c' },
  head_down:    { name:'Tête en bas (VFS)',      vc: 78, vzVoile: 5.5, glide: 2.7, hOuv: 1200,
                  hBreak: 1700, sepDist: 120, skill: 0.85, canopyClass: 'sport_9c' },
  // Angle / tracking (intermédiaires)
  angle_fly:    { name:'Angle flying',           vc: 65, vzVoile: 5.0, glide: 2.8, hOuv: 1200,
                  hBreak: 1600, sepDist: 150, skill: 0.85,
                  isTracking: true, trackDist: 1800, trackAxis: 90,
                  canopyClass: 'sport_9c' },
  tracking:     { name:'Dérive (combi tracking)', vc: 45, vzVoile: 5.0, glide: 2.8, hOuv: 1000,
                  hBreak: 1500, sepDist: 150, skill: 0.9,
                  isTracking: true, trackDist: 2500, trackAxis: 90,
                  canopyClass: 'sport_9c' },
  // Wingsuits (DT FFP 49)
  wingsuit_ws1: { name:'Wingsuit WS1 (initiation)', vc: 42, vzVoile: 5.2, glide: 2.6, hOuv: 1200,
                  hBreak: 1400, sepDist: 200, skill: 0.85,
                  isWingsuit: true, wsLD: 2.2, wsSide: 'auto',
                  trackDist: 3500, trackAxis: 90,
                  canopyClass: 'sport_7c' },
  wingsuit_ws2: { name:'Wingsuit WS2 (sport)',      vc: 32, vzVoile: 5.0, glide: 3.0, hOuv: 1100,
                  hBreak: 1200, sepDist: 200, skill: 0.9,
                  isWingsuit: true, wsLD: 2.8, wsSide: 'auto',
                  trackDist: 6500, trackAxis: 90,
                  canopyClass: 'sport_7c' },
  wingsuit_ws3: { name:'Wingsuit WS3 (expert)',     vc: 22, vzVoile: 4.8, glide: 3.1, hOuv: 1100,
                  hBreak: 1200, sepDist: 200, skill: 0.95,
                  isWingsuit: true, wsLD: 3.2, wsSide: 'auto',
                  trackDist: 10000, trackAxis: 90,
                  canopyClass: 'sport_7c' },
  // Élèves
  eleve_12:     { name:'Élève (ouv. 1200 m)',    vc: 52, vzVoile: 5.0, glide: 2.5, hOuv: 1200,
                  hBreak: 1300, sepDist: 0, skill: 0.5, canopyClass: 'sport_9c' },
  eleve_15:     { name:'Élève (ouv. 1500 m)',    vc: 52, vzVoile: 5.0, glide: 2.5, hOuv: 1500,
                  hBreak: 1600, sepDist: 0, skill: 0.5, canopyClass: 'sport_9c' },
  tandem:       { name:'Tandem (ouv. 1500 m)',   vc: 54, vzVoile: 6.5, glide: 2.7, hOuv: 1500,
                  hBreak: 1600, sepDist: 0, skill: 0.6, canopyClass: 'tandem' }
};
```

**Fichiers.** `app.js::PARA_TYPOLOGIES`, builder d'UI `buildJumpers`.

---

### 15.3 Wingsuit : plafond de finesse relevé, pilotage dédié, option côté de vol

**Limite.** Dans `simJumper`, le plafond `grTrack = min(..., 1.5)` empêche toute wingsuit d'atteindre sa vraie finesse (2.5–3.5). Aucun distinguo physique entre tracking et wingsuit, et surtout **pas de gestion du côté de vol** — critique en pratique.

**Contexte FFP DT49 + pratique DZ** (ex. Pamiers/LFDJ) : les wingsuits d'un même largage suivent **toutes la même ligne de vol**, toutes du même côté de l'axe (à Pamiers, nord ou sud selon l'axe du jour), pour ne pas croiser les sous voile et laisser le couloir libre au passage suivant. Angle sortie typique 30–45° par rapport à l'axe, puis vol rectiligne pendant 30–60 s avant virage retour.

**Proposition en 3 temps.**

**(a) Plafond et loi aérodynamique wingsuit.** Découpler la logique du tracking pur :

```js
if (jp.isWingsuit && jp.wsLD) {
  var LD = jp.wsLD;
  // Pour une wingsuit en équilibre, vz² (1 + L/D²) = vT², donc :
  var vzEff  = jp.vc / Math.sqrt(1 + LD*LD);  // m/s verticaux
  var vhWS   = LD * vzEff;                    // m/s horizontaux
  // Note : jp.vc ici est interprété comme la magnitude du vecteur air total,
  // pas la seule composante verticale. Voir (b) pour le côté de vol.
  var wsRad  = (env.axeDeg + jp.trackAxis + wsSideOffset(jp, env)) * DEG2RAD;
  trackVec = {
    e: Math.sin(wsRad) * vhWS,
    n: Math.cos(wsRad) * vhWS
  };
}
else if (jp.isTracking) {
  // Plafond relevé à 1.2 (vs 1.5 actuel — le 1.5 était borderline wingsuit)
  var vtTrack = jp.vc * 1.15;
  var grTrack = Math.min(jp.trackDist / Math.max(totalFallZ, 100), 1.2);
  var vhTrack = grTrack * vtTrack;
  // ...
}
```

Pour `LD = 3.0`, `jp.vc = 22` (WS3) : `vzEff = 22/√10 ≈ 7.0 m/s` vertical, `vhWS = 3·7.0 = 20.9 m/s` horizontal — cohérent avec la mesure FlySight sur une wingsuit HP (~65–75 km/h vertical, ~180–220 km/h horizontal après conversion).

**(b) Option côté de vol wingsuit (`wsSide`).** Nouveau paramètre par parachutiste wingsuit :

| `wsSide` | Signification |
|---|---|
| `'auto'` | Calculé par simPass selon signe du cross-track RV (comme le break-off actuel) |
| `'left'` | Vol à gauche de l'axe (`trackAxis = −90°` par rapport à l'axe sol) |
| `'right'` | Vol à droite de l'axe (`trackAxis = +90°`) |
| `'N'` / `'S'` / `'E'` / `'W'` | Vol vers un cardinal fixe (indépendant de l'axe) |

Helper :
```js
function wsSideOffset(jp, env) {
  if (jp.wsSide === 'left')  return -90 - jp.trackAxis;  // force −90° absolu
  if (jp.wsSide === 'right') return +90 - jp.trackAxis;
  if (jp.wsSide === 'N') return  0 - env.axeDeg - jp.trackAxis;
  if (jp.wsSide === 'S') return 180 - env.axeDeg - jp.trackAxis;
  if (jp.wsSide === 'E') return  90 - env.axeDeg - jp.trackAxis;
  if (jp.wsSide === 'W') return 270 - env.axeDeg - jp.trackAxis;
  return 0; // 'auto' : le signe du cross-track RV est déjà géré par jp.trackAxis
}
```

**UI.** Ajouter dans `buildJumpers` un sélecteur `wsSide` visible uniquement si `isWingsuit = true` :
```
[ Auto | ← Gauche | Droite → | ↑ N | ↓ S | → E | ← W ]
```

**(c) Application sur plusieurs wingsuits.** Toutes les wingsuits du stick héritent du même `wsSide` par défaut (cohérence FFP : tout le monde du même côté). L'UI doit proposer un bouton "Appliquer à toutes les WS" qui propage le choix. Les wingsuits sortent avec un **espacement minimal de 10 s** (FFP DT49), imposé via une règle spéciale dans la phase de séparation (§15.8).

**Fichiers.** `physics-core.js::simJumper` (pilotage), `physics-core.js::simPass` (appel + contrainte espacement WS), `app.js::PARA_TYPOLOGIES` + builder UI, `ui-optimizer.js` (sélecteur côté).

---

### 15.4 Ouverture : durée et profil différenciés par classe de voile

**Limite.** 5.5 s quel que soit le type de voile. Valeurs de référence (recherche `AERODYNAMICS_RESEARCH §5.1` + skydivemag Matt Gerdes "WS Progression 3" pour les voiles wingsuit) :

| Classe voile | Snivel typique | Inflation totale | Conseils matériel (WS) |
|---|---|---|---|
| Sport 9-cell moderne | 3–6 s | 4–5 s | — |
| Sport 7-cell docile | 2–4 s | 3–4 s | **Recommandé WS** : charge alaire < 1.3, drisse 2.40 m / extracteur 28–32″ (FFP DT49 WS1/WS2) |
| Tandem drogue | 2–3 s | 3 s | — |
| BASE slider brake-set | 5–10 s | 7–10 s | Pour comparaison, non simulé ici |
| Cross-braced (swoop) | 1–3 s | 2–3 s | Snivel très court |

**Proposition.** Paramétrer par `openingProfile` :

```js
var OPENING_PROFILE = {
  sport_9c:    { tP: 0.5, tL: 0.8, tI: 3.5, ratio: 3.0 },
  sport_7c:    { tP: 0.6, tL: 0.9, tI: 2.5, ratio: 3.0 },
  tandem:      { tP: 0.5, tL: 0.7, tI: 2.8, ratio: 2.5 },
  cross_brace: { tP: 0.5, tL: 0.7, tI: 2.0, ratio: 3.5 }
};
```

`simOpening` lit `jp.openingProfile` (repli `sport_9c`). Structure 3-phase + Hermite conservée.

**Bonus.** Exposer l'altitude de fin réelle dans `simResults.perJumper.hCanopyStart` — utile pour vérifier que les WS2 brevetés respectent bien le minimum 1 100 m de la DT49.

**Fichiers.** `physics-core.js::simOpening`.

---

### 15.5 Modèle de finesse variable sous voile (rear-risers, min-sink)

**Limite majeure.** La finesse est constante tout au long du vol sous voile. Conséquences :
- Long spot sous-estimé (rear-risers : +15 % portée, cf. `AERODYNAMICS_RESEARCH §6.4`).
- Min-sink absent pour un vent arrière.
- Vent arrière très fort → modèle optimiste (pas de saturation vitesse air).

**Proposition.** Régime de vol `flightRegime` avec 3 valeurs :

| Régime | `glide_eff` | `vz_eff` | Quand |
|---|---|---|---|
| `full_flight` (défaut) | `glide` | `vzVoile` | Régime nominal |
| `rear_riser` | `glide × 1.08` | `vzVoile × 0.85` | Long spot face au vent |
| `min_sink` | `glide × 0.80` | `vzVoile × 0.60` | Long spot vent arrière |

Sélection automatique selon composante vent vers la cible :

```js
function _selectRegime(stateE, stateN, tgtE, tgtN, w, vh_full) {
  var dx = tgtE - stateE, dy = tgtN - stateN;
  var dh = Math.sqrt(dx*dx + dy*dy);
  if (dh < 1) return 'full_flight';
  var dxn = dx/dh, dyn = dy/dh;
  var wp = w.e * dxn + w.n * dyn;             // + = tailwind
  if (wp >  0.4 * vh_full)                      return 'min_sink';
  if (wp < -0.5 * vh_full && wp > -vh_full)     return 'rear_riser';
  return 'full_flight';
}
```

**Effet MC attendu** : ellipses d'atterrissage −10 à −15 % en scénario long, +5 % en scénario court.

**Fichiers.** `physics-core.js::simCanopy` et `createSteerToPoint`.

---

### 15.6 Finesse dépendante du vent apparent et de la densité

**Limite.** `glide` constant. Le L/D est maximal à une vitesse air spécifique.

**Proposition (priorité basse).**
```
glide_eff = glide × (1 − α · ((vh/vh_opt) − 1)²)
```
`α = 0.15`, `vh_opt ≈ 12.9 m/s` (25 kt) pour voile sport à WL 1.1. Gain marginal, à réserver à une v3.

---

### 15.7 Charge alaire explicite

**Limite.** `vzVoile` et `glide` sont des scalaires directs ; ils dépendent physiquement de `WL`.

**Proposition.** Ajouter `wingLoading` + `canopyClass` :

```
vzVoile = vz_ref · √(WL / WL_ref)
vh      = glide · vzVoile
v_stall = 7 · √WL m/s
```

Valeurs par classe (AERO §4) :

| Classe | WL | `vz_ref` à WL 1 | `glide` |
|---|---|---|---|
| Docile 9-cell | 0.8–1.1 | 5.0 m/s | 2.9 |
| Intermédiaire | 1.0–1.4 | 5.2 m/s | 3.1 |
| Elliptique 9-cell | 1.2–1.6 | 5.3 m/s | 3.2 |
| Cross-braced | 1.8–2.5 | 5.5 m/s | 3.2 |
| BASE | 0.6–1.1 | 4.5 m/s | 3.0 |
| Tandem | 0.7–0.9 | 6.5 m/s | 2.7 |

`v_stall` alimente un garde-fou dans `simCanopy`.

**Fichiers.** `app.js::PARA_TYPOLOGIES`, `physics-core.js::simCanopy`.

---

### 15.8 Monte-Carlo : refonte des sources d'incertitude

**Remplace la version initiale du document (altitude avion / ouverture dure / tour de suspentes ont été écartés).** Les incertitudes ci-dessous sont celles qui dominent réellement la dispersion observée en largage sport et qui doivent donc entrer dans le Monte-Carlo.

**(a) Temps entre les sorties — climb-out et taille de groupe.**

Actuellement `dtSortie = espacementM / gsMs` est déterministe. En réalité :
- Pour une sortie **solo propre**, le délai réel est ~ la valeur nominale à σ ≈ 0.5 s près.
- Pour un groupe de 2–4 (VR, freefly), il faut compter un **climb-out** de 3–5 s pendant lequel les parachutistes se mettent en place sur la barre extérieure avant le countdown, soit un délai *additionnel* avant la première chute effective.
- Pour un groupe de 5+, climb-out 5–8 s, dispersion plus large.

Modèle proposé :
```js
function perturbExitTimes(jumpers, dtNominal) {
  return jumpers.map(function (j) {
    var nb = j.nbPara || 1;
    var climbOutMean =
      nb === 1 ? 0 :
      nb <= 4 ? 2.0 + 0.5 * nb :   // 2.5 s à 2 paras, 4 s à 4 paras
                5.0 + 0.6 * nb;    // 8 s à 5 paras, 11 s à 10 paras
    var climbOutSigma = 0.4 + 0.15 * nb;   // plus de variance sur gros groupes
    // Jitter de sortie individuel
    var jitter = gaussRandom() * 0.6;      // σ = 0.6 s (ex. 6 s annoncé → 5.4–6.6 s observé)
    // Climb-out
    var climbOut = climbOutMean + gaussRandom() * climbOutSigma;
    return { _climbOut: Math.max(0, climbOut), _exitJitter: jitter };
  });
}
```

Dans `simPass`, le temps de sortie effectif du parachutiste `j` devient :
```
t_exit_j = delaiTopVert
           + Σ_{k<j} (dtSortie + climbOut_k + jitter_k)
           + jitter_j
```

**(b) Incertitude sur la vitesse terminale.** Passe de **σ = 5 % à σ = 10 %**. Motivation : jour à jour, un même parachutiste peut varier de ±5 % intrinsèque, auquel il faut ajouter l'incertitude sur sa catégorie typologique (un "freefly petite voile" couvre une fourchette `vc = 65–75` m/s). La somme quadratique donne ~10 %.

**(c) Incertitude sur le cap de tracking (±20°).** Actuellement le vecteur de tracking `trackVec` suit exactement `trackAxis`. En réalité, un tracker atteint rarement son cap visé à mieux que ±20° sur une chute complète, surtout s'il doit ajuster pour éviter le groupe précédent.

```js
// Dans perturbJumpers, si isTracking ou isWingsuit :
if (j.isTracking || j.isWingsuit) {
  var axisErrorSigma = j.isWingsuit ? 10 : 20;   // °
  j.trackAxis = (j.trackAxis || 90) + gaussRandom() * axisErrorSigma;
}
```

σ plus petit (10°) pour les wingsuits : elles sont plus directionnelles et la visibilité est meilleure.

**(d) Dérive inconsciente pour les parachutistes non-tracking.** Un ventral "stable" dérive en réalité de 5–15 m/s horizontalement sur 30 s de chute, sans que le parachutiste ne s'en rende compte. Introduire pour chaque non-tracker :

```js
// Axe de dérive aléatoire, amplitude gaussienne
var driftAxisRad = Math.random() * 2 * Math.PI;
var driftSpeed   = Math.abs(gaussRandom()) * 3;   // σ = 3 m/s (moyenne ~2.4 m/s)
j._driftVec = {
  e: Math.sin(driftAxisRad) * driftSpeed,
  n: Math.cos(driftAxisRad) * driftSpeed
};
// Appliqué comme un trackVec léger additionnel, intégré dans le RK4 de chute libre
```

Sur 30 s de chute, une dérive de 2 m/s horizontaux produit 60 m de déviation — réaliste et invisible au parachutiste.

**(e) Incertitude sur le heading à l'ouverture.** La voile ne sort pas systématiquement dans l'axe de la vitesse air ; un "line twist" léger ou une inflation asymétrique biaise le cap initial de ±30°. Le pilote corrige vite mais perd ~50 m de navigation pendant la correction.

```js
// Biais initial de cap en sortie d'ouverture
j._headingOpenErr = gaussRandom() * 30;   // σ = 30°
// Appliqué au cap initial de simCanopy
```

**(f) σ `hOuv`.** Conservé à 50 m (correspond à l'imprécision altimètre + délai pilote — ne change pas).

**(g) σ `skill`.** Conservé à 0.1, mais avec une **moyenne par typologie** (§15.12).

**(h) σ vent.** Conservé (3 kt / 15° par couche, AR(1) φ=0.7).

**Implémentation.**

```js
function perturbJumpers(jumpers, sigma) {
  // ... perturbations scalaires ...
  return jumpers.map(function (j) {
    var pj = Object.assign({}, j, {
      vc:      j.vc      * (1 + gaussRandom() * (sigma.vc      || 0.10)),  // ← 10 %
      vzVoile: j.vzVoile * (1 + gaussRandom() * (sigma.vzVoile || 0.08)),
      glide:   j.glide   * (1 + gaussRandom() * (sigma.glide   || 0.10)),
      hOuv:    j.hOuv    + gaussRandom() * (sigma.hOuv || 50),
      skill:   Math.max(0.2, Math.min(1.0,
                 (j.skill || j._skillDefault || 0.8) + gaussRandom() * (sigma.skill || 0.1)
               )),
      _headingOpenErr: gaussRandom() * (sigma.headingOpen || 30)
    });

    // Tracking / wingsuit : erreur d'axe
    if (pj.isTracking || pj.isWingsuit) {
      var axErr = pj.isWingsuit ? 10 : 20;
      pj.trackAxis = (pj.trackAxis || 90) + gaussRandom() * axErr;
    } else {
      // Non-tracker : dérive inconsciente
      var driftAx = Math.random() * 2 * Math.PI;
      var driftV  = Math.abs(gaussRandom()) * (sigma.driftSpeed || 3);
      pj._driftVec = { e: Math.sin(driftAx)*driftV, n: Math.cos(driftAx)*driftV };
    }

    // Climb-out + jitter
    var nb = pj.nbPara || 1;
    pj._climbOut = Math.max(0,
      (nb === 1 ? 0 : nb <= 4 ? 2.0 + 0.5*nb : 5.0 + 0.6*nb)
      + gaussRandom() * (0.4 + 0.15*nb));
    pj._exitJitter = gaussRandom() * (sigma.exitJitter || 0.6);

    return pj;
  });
}
```

Côté `simPass`, on intègre `_driftVec` au `trackVec` de chute libre (même mécanisme que tracking), `_headingOpenErr` au cap initial de `simCanopy`, `_climbOut + _exitJitter` au calcul de l'instant de sortie.

**Effet Monte-Carlo attendu.** Ellipses de position d'atterrissage de +25 à +40 % en largeur pour les groupes freefly (l'incertitude de sortie + dérive inconsciente gagnent +50 à +100 m latéraux). Les ellipses des wingsuits restent serrées (tracking directionnel bien contraint, dérive non applicable).

**Fichiers.** `monte-carlo.js::perturbJumpers`, `physics-core.js::simPass` (prise en compte `_climbOut`, `_exitJitter`), `physics-core.js::simJumper` (intégration `_driftVec` et `_headingOpenErr`).

---

### 15.9 Fonction objectif enrichie : NFZ soft + vent arrière + plafond nuageux

**Limites.**
- Zones NFZ `soft` non scorées (scoring binaire via `hard` uniquement).
- Alignement vent pénalise les axes perpendiculaires mais pas les axes **vent arrière**.
- Pas de pénalité sur la proximité aux limites plafond nuageux.

**Propositions.**

1. **Soft NFZ** :
```js
score -= softNfzViolationCount(result, nfzList) * 100;
```

2. **Pénalité explicite vent arrière** :
```js
var axeDiff = ((result.axe - windFromDeg + 540) % 360) - 180;
var alignBonus;
if      (Math.abs(axeDiff) < 30)  alignBonus = 500;
else if (Math.abs(axeDiff) > 150) alignBonus = -200;
else                              alignBonus = 500 * (1 - (Math.abs(axeDiff) - 30) / 60);
score += alignBonus;
```

3. **Marge plafond nuageux** : si `meteoData.cloud_low > 50 %` et `altM > cloudBase`, pénalité proportionnelle au ratio de dépassement.

**Fichiers.** `physics-core.js::objectiveScore`.

---

### 15.10 Poids de la fonction objectif configurables en UI

**Limite.** Les coefficients (`10 000`, `500`, `2 000`, `1 500`, `300`, `200`) sont hardcodés. Or un chef largueur veut parfois privilégier une marge plus importante (jour limite) ou une passe parfaitement centrée (exigence technique).

**Proposition.** Exposer les poids dans un panneau UI de `ui-optimizer.js` et les faire transiter par `objectiveScore` :

```js
// Nouvelle signature
PhysicsCore.objectiveScore(result, windFromDeg, weights)

// weights défaut
var DEFAULT_WEIGHTS = {
  nPara:     10000,     // absolue
  alignWind:   500,
  marge:      2000,
  sep:        1500,
  dtSortie:    300,
  offset:     -200,     // (poids négatif)
  softNfz:    -100      // (évol. §15.9)
};
```

**UI**. Panneau "Priorités d'optimisation" avec sliders 0–2 (multiplicateur) pour chaque composante. Persistance en `localStorage` pour retrouver les préférences DZ/user.

**Fichiers.** `physics-core.js::objectiveScore`, `ui-optimizer.js` (panneau), `optimizer-v2.js::_phaseStickOrder` (passe `weights` à chaque `_evalOrder`).

---

### 15.11 NFZ : support temporel et zones soft actives

**Proposition.** Étendre la structure NFZ :
```js
{
  type: 'hard' | 'soft',
  altMin, altMax,
  poly: [{lat, lon}, ...],
  tWindow: null | { tStart: ISO, tEnd: ISO },
  priority: 1..5
}
```

Dans `_checkNFZ`, filtrer les zones dont `tWindow` ne couvre pas `meteoData.time`. Pour les `soft`, retourner un compteur de violations (utilisé par §15.9).

---

### 15.12 Skills par défaut liés à la typologie (et propagation dans le Monte-Carlo)

**Limite.** Le champ `skill` n'est pas présent dans les typologies actuelles (implicite à 1.0 dans `simCanopy`). C'est irréaliste : un élève en brevet n'a pas la même précision de pilotage qu'un wingsuit WS3.

**Proposition.** Ajouter un `skill` défaut par typologie (table ci-dessus §15.2), repris dans le Monte-Carlo avec `σ = 0.1` :

| Typologie | `skill` défaut | Raison |
|---|---|---|
| Élève 1200 / 1500 | 0.5 | Découverte pilotage, délais de réaction longs |
| Tandem | 0.6 | Instructeur expérimenté, mais voile chargée + passager |
| Ventral, freefly | 0.8 | Sport confirmé |
| Angle, tracking | 0.85–0.9 | Spécialité, pilotage fin attendu |
| Wingsuit WS1 | 0.85 | Brevet récent, pilotage correct mais nouveau matériel |
| Wingsuit WS2 | 0.9 | Expérimenté |
| Wingsuit WS3 | 0.95 | Expert |

**Impact sur `simCanopy`**. Le `skill` module :
- `maxTurnRate` : plus faible si skill bas.
- `reactionDelay` : plus long si skill bas (`2.0 / max(skill, 0.1)`).
- `headingError` : plus grand si skill bas (`20° · (1 − skill)`).
- **En MC**, σ_skill est additive autour de la valeur de typologie.

**Fichiers.** `app.js::PARA_TYPOLOGIES` (champ `skill` partout), `monte-carlo.js::perturbJumpers` (utilise `j.skill` au lieu de fallback `0.8`).

---

### 15.13 Utiliser les températures Open-Meteo pour dériver ρ(z)

**Limite.** Aujourd'hui `ρ(z)` est calculée à partir de ISA + `isaDelta`, et les champs `windProfile[i].temp` sont stockés mais inutilisés pour la physique. Cela génère une erreur systématique de 3–5 % sur la densité quand l'atmosphère réelle diverge de l'ISA.

**Proposition.** Construire une **LUT de densité dérivée de la météo** à chaque `fetchMeteo` :

1. Pour chaque couche `i`, on a `z_i = geoH_i`, `T_i = temp_i + 273.15`, `p_i = hpa_i × 100`.
2. Densité par couche : `ρ_i = p_i / (R_air · T_i)`.
3. Entre deux couches, interpolation linéaire sur `z`, `T`, `p` ; densité dérivée.
4. Remplacer la LUT ISA par cette LUT "météo" **quand `meteoData.time` correspond à l'heure courante** (on conserve l'ISA pour le hors-DZ ou les tests headless).

```js
function buildDensityLUTFromMeteo(windProfile, maxAlt) {
  var sorted = windProfile.slice().sort((a,b) => a.z - b.z);
  var lut = new Float64Array(maxAlt + 1);
  for (var z = 0; z <= maxAlt; z++) {
    if (z <= sorted[0].z) {
      // Sous la plus basse couche : extrapolation ISA conservée
      lut[z] = getAtmosphereRho(z, 0);
    } else if (z >= sorted[sorted.length-1].z) {
      lut[z] = getAtmosphereRho(z, 0);
    } else {
      // Recherche binaire + interp linéaire sur T, p
      var lo = 0, hi = sorted.length - 1;
      while (hi - lo > 1) { var mid = (lo+hi)>>1; if (sorted[mid].z <= z) lo=mid; else hi=mid; }
      var f = (z - sorted[lo].z) / (sorted[hi].z - sorted[lo].z);
      var T = (sorted[lo].temp + 273.15) + f * (sorted[hi].temp - sorted[lo].temp);
      var p = sorted[lo].hpa*100 + f * (sorted[hi].hpa - sorted[lo].hpa) * 100;
      lut[z] = p / (287.058 * T);
    }
  }
  return lut;
}
```

**Effet.** Élimination du biais ISA. `isaDelta` UI devient accessoire (utile uniquement pour simulation manuelle sans météo chargée).

**Fichiers.** `physics-core.js` (nouveau path LUT météo), `app.js::fetchMeteo` (construction de la LUT après réception).

---

### 15.14 LUT vent eager précalculée (comme ρ)

Implémentation du §4.6 cible : remplacer le cache lazy sentinelle par deux `Float64Array` remplies à chaque `setWindProfile`. Voir §4.6 pour la justification perf et le code cible.

**Fichiers.** `physics-core.js::setWindProfile`, `enableWindCache`, `windAtZ`.

---

### 15.15 Ordre de sortie : crossover OX

**Limite.** L'AG actuel ne fait que des swaps.

**Propositions.**
- **Crossover OX** (Order Crossover) : parent A donne un segment continu, parent B complète dans l'ordre restant.
- **Élite mémoire** : garder les 3 meilleurs ordres historiques pour seeds des générations futures.

Gain attendu : +2 à 5 % sur le score final pour sticks 8+.

**Fichiers.** `optimizer-v2.js::_phaseStickOrder`.

---

### 15.16 UX : panneau "Hypothèses" dans l'UI

**Proposition non-physique.** Ajouter un panneau `ui-optimizer.js` affichant la table §14 en version condensée, lue depuis les constantes exposées par `PhysicsCore`. Aide le pilote à calibrer ses attentes et à savoir ce qui n'est pas modélisé.

---

### 15.17 Paramétrage Monte-Carlo enrichi en UI

**Limite.** Le panneau MC actuel n'expose que `mcN`, `mcWindSpd`, `mcWindDir`, `mcVc`, `mcVz`, `mcGlide`, `mcHouv`. Toutes les nouvelles sources d'incertitude introduites au §15.8 (cap tracking, dérive non-tracker, heading ouverture, climb-out, jitter de sortie) sont **silencieuses** côté UI : on ne peut pas les calibrer pour la DZ ou pour l'expérience du chef largueur.

**Proposition.** Refondre le panneau Monte-Carlo en trois groupes hiérarchisés :

```
┌─ Monte-Carlo ───────────────────────────────────────┐
│  Itérations N : [100] (50–1000, slider)             │
│  Niveau de confiance ellipses : (•) 95 %  ( ) 99.7% │
│  Profil : [Standard ▾] (Conservateur / Standard /   │
│           Aggressif / Personnalisé)                  │
├─ Vent ──────────────────────────────────────────────┤
│  σ vitesse [3] kt   σ direction [15] °              │
│  Corrélation verticale (φ AR(1)) [0.7]              │
├─ Parachutiste ──────────────────────────────────────┤
│  σ vc (terminale)    [10] %                         │
│  σ vzVoile           [8 ] %                         │
│  σ finesse           [10] %                         │
│  σ hOuv              [50] m                         │
│  σ skill             [0.1]                          │
│  σ heading ouverture [30] °                         │
│  σ axe tracking      [20] °                         │
│  σ axe wingsuit      [10] °                         │
│  σ dérive non-track  [3 ] m/s                       │
│  Climb-out activé    [✔]                            │
│  σ jitter sortie     [0.6] s                        │
└─────────────────────────────────────────────────────┘
[Réinitialiser défauts]   [Sauvegarder profil DZ]
```

**Profils prédéfinis** :

| Profil | N | σ vent | σ vc | σ skill | Quand |
|---|---|---|---|---|---|
| Conservateur | 200 | 5 kt / 25° | 15 % | 0.15 | Météo douteuse, stick mixte, exigence sécurité élevée |
| Standard | 100 | 3 kt / 15° | 10 % | 0.10 | Cas nominal |
| Agressif | 50 | 1.5 kt / 8° | 5 % | 0.05 | Compétition contrôlée, stick homogène expérimenté |

**Persistance.** Le profil personnalisé est stocké en `localStorage` sous clé `mcProfile_<DZ>` — chaque DZ peut avoir son réglage.

**Implémentation.** L'objet `sigma` est déjà passé à `MonteCarlo.run` ; il suffit d'ajouter les champs nouveaux et de les lire dans `perturbJumpers` (cf. §15.8). Côté UI, c'est un panneau collapsible dans `ui-optimizer.js` (à côté de "Priorités" §15.10).

**Fichiers.** `ui-optimizer.js` (panneau UI), `monte-carlo.js::run` + `perturbJumpers` (lecture des nouveaux sigmas), `app.js` (`localStorage` profils).

---

### 15.18 Enveloppe d'incertitude le long de la trajectoire (1σ / 3σ)

**Limite double.**
1. Le Monte-Carlo actuel (`MonteCarlo.run`) ne stocke que **deux ellipses** par parachutiste : position d'ouverture et position d'atterrissage. Tout ce qui se passe entre les deux est invisible.
2. Le rendu (`drawEllipses`) n'affiche bien que tous les parachutistes du `jumperStats` (boucle `forEach`), mais la palette de couleurs ne contient que **10 entrées** ; au-delà de 10 paras les couleurs se répètent et deviennent illisibles. **Pour les sticks de plus de 10 parachutistes, certains sont effectivement masqués visuellement** par superposition de couleur identique sur trajectoires voisines.

**Proposition.**

**(a) Échantillonnage temporel des trajectoires en MC.** Dans `MonteCarlo.run`, à chaque itération et pour chaque parachutiste, échantillonner la trajectoire à intervalle régulier (par exemple chaque `dtSample = 5 s` ou chaque 200 m d'altitude). Pour `i = 1..N` itérations et `j = 1..N_paras` parachutistes :

```js
// Stockage : trajSamples[j][k] = liste des (E, N) sur les N itérations à l'instant t_k
var trajSamples = [];
for (var j = 0; j < nPara; j++) {
  trajSamples.push([]); // tableau de [{E:[],N:[]}, ...] indexé par k
}

// À chaque itération i
res.timedTrajs.forEach(function (tt, j) {
  var sp = tt.sp;
  for (var k = 0; k < N_TIME_BINS; k++) {
    var t_k = k * dtSample;
    var pt = PhysicsCore.interpSp(sp, tt.t0 + t_k);
    if (!pt) continue;
    if (!trajSamples[j][k]) trajSamples[j][k] = { E: [], N: [] };
    trajSamples[j][k].E.push(pt.x);
    trajSamples[j][k].N.push(pt.y);
  }
});
```

**(b) Calcul d'ellipse par bin temporel.** Une fois la boucle MC terminée, calculer pour chaque parachutiste et chaque bin temporel l'ellipse à 1σ et 3σ via `MonteCarlo.computeEllipse(E, N, level)`. Niveaux :

| Sigma | χ² (2 ddl) | Confidence |
|---|---|---|
| 1σ | 2.279 | 68.27 % |
| 2σ | 6.180 | 95.45 % |
| 3σ | 11.83 | 99.73 % |

(Conversion : `χ² = −2·ln(1 − conf)`.)

**(c) Rendu — tubes d'incertitude.** Plutôt que dessiner une ellipse à chaque bin (illisible quand on en a 30 par parachutiste sur une trajectoire de 150 s), construire un **polygone tube** : enveloppe convexe / contour des bords gauche-droite des ellipses successives, projetés sur la trajectoire moyenne. Implémentation Leaflet :

```js
function buildEnvelope(trajMean, ellipses, sigmaLevel) {
  // Pour chaque bin, l'ellipse (cx, cy, a, b, angle) ; on prend les 2 points
  // perpendiculaires à la trajectoire à distance "rayon principal"
  var leftSide = [], rightSide = [];
  ellipses.forEach(function (ell, k) {
    var rad = sigmaLevel * Math.max(ell.a, ell.b);   // simplification : rayon enveloppant
    var heading = trajHeadingAt(trajMean, k);         // direction du segment suivant
    var perpE = -Math.cos(heading), perpN = Math.sin(heading);
    leftSide.push({ e: ell.cx + perpE * rad, n: ell.cy + perpN * rad });
    rightSide.unshift({ e: ell.cx - perpE * rad, n: ell.cy - perpN * rad });
  });
  return leftSide.concat(rightSide); // polygone fermé
}
```

Deux tubes par parachutiste : 1σ (rempli plus opaque) et 3σ (contour seul ou rempli très transparent).

**(d) Couleurs pour > 10 parachutistes.** Remplacer la palette fixe de 10 couleurs par une **rotation HSL** :

```js
function colorFor(idx, total) {
  var hue = (idx * 360 / Math.max(total, 1)) % 360;
  return 'hsl(' + hue + ', 70%, 50%)';
}
```

Garantit `total` couleurs distinctes même pour 20 parachutistes (l'œil distingue ~30 teintes en saturation 70 %).

**(e) Toggle UI.** Trois cases à cocher dans le panneau MC :
- ☐ Points de sortie (déjà présent)
- ☐ Ellipse ouverture / atterrissage (déjà présent)
- ☐ Enveloppe trajectoire 1σ
- ☐ Enveloppe trajectoire 3σ

Combinable. Par défaut : ouverture/atterrissage ON, trajectoires OFF (rendu lourd avec sticks > 8).

**Coût mémoire.** N=100 itérations × N_paras=15 × N_bins=30 × 2 (E,N) × 8 B ≈ 720 kB. Acceptable.

**Coût rendu.** Polygones Leaflet — pour 15 paras × 2 enveloppes = 30 polygones de ~60 sommets, soit ~1 800 points. Imperceptible.

**Effet pédagogique.** Permet au chef largueur de voir **où** la trajectoire est incertaine : typiquement, l'ellipse 3σ s'élargit fortement entre l'ouverture et la zone RDV pour les parachutistes mal cap-corrigés (skill bas) ou loin de l'axe vent ; et reste serrée sous voile pour les pilotes performants. Détecte des cas où "la marge moyenne est OK mais le 3σ touche une NFZ" — situation NOGO masquée par le percentile.

**Fichiers.** `monte-carlo.js::run` (échantillonnage temporel + ellipses par bin), `monte-carlo.js::drawEnvelopes` (nouvelle fonction), `ui-optimizer.js` (toggles), `physics-core.js::interpSp` (déjà OK).

---

### 15.19 Stick type pour l'optimisation

**Limite.** Le bouton "OPTIMISER" travaille sur **le stick courant** tel qu'il est dans `jumpersList`. Or :

- À l'init, `buildJumpers` peuple `jumpersList` avec **4 ventral standard** (`vr_mv`) si vide. C'est ce qui sera optimisé tant que l'utilisateur n'a pas explicitement composé son stick.
- Les chefs largueurs qui veulent **explorer** une configuration de DZ (axe optimal "type", vent type d'une saison) doivent d'abord composer manuellement un stick représentatif. C'est fastidieux.
- Pour la planification annuelle (rotation des modèles d'avion, capacité d'embarquement, ratio tandems/sport), un **stick type** documenté serait précieux.

**Proposition.** Constituer une bibliothèque de **sticks types** alignés sur la pratique réelle des DZ françaises, avec un sélecteur dans l'UI :

```js
const STICK_PRESETS = {
  // Pilatus / Cessna 208 — cas tandem-école typique
  ecole_pc6: {
    name: 'École — PC-6 (8 pax)',
    description: 'Saut école : 1 tandem + 2 élèves + 4 sport + 1 freefly',
    composition: [
      { type: 'tandem', count: 1 },
      { type: 'eleve_15', count: 2 },
      { type: 'belly_std', count: 4 },
      { type: 'sit_fly', count: 1 }
    ]
  },
  // PAC 750 — boogie sport mixed
  boogie_pac: {
    name: 'Boogie sport — PAC 750 (12 pax)',
    description: '4 freefly + 4 ventral + 2 tracking + 2 wingsuit',
    composition: [
      { type: 'belly_std', count: 4 },
      { type: 'sit_fly', count: 2 },
      { type: 'head_down', count: 2 },
      { type: 'tracking', count: 2 },
      { type: 'wingsuit_ws2', count: 2 }
    ]
  },
  // Stick compétition VR-4
  comp_vr4: {
    name: 'Compétition VR-4',
    description: '4 ventral homogènes (équipe nationale)',
    composition: [
      { type: 'belly_std', count: 4, sepDist: 0 } // fermé, pas de séparation radiale
    ]
  },
  // Spécifique wingsuit
  ws_focus: {
    name: 'Wingsuit dédié',
    description: '6 wingsuits mixtes WS1/WS2/WS3',
    composition: [
      { type: 'wingsuit_ws1', count: 2 },
      { type: 'wingsuit_ws2', count: 3 },
      { type: 'wingsuit_ws3', count: 1 }
    ]
  },
  // Tandem-only (commercial à plein)
  tandem_max: {
    name: 'Commercial tandem',
    description: '6 tandems consécutifs',
    composition: [
      { type: 'tandem', count: 6 }
    ]
  },
  // Mixed lourd "porteur"
  caravan_full: {
    name: 'Cessna Caravan complet (15 pax)',
    description: '2 tandems + 3 élèves + 6 sport + 2 freefly + 2 tracking',
    composition: [
      { type: 'tandem', count: 2 },
      { type: 'eleve_15', count: 2 },
      { type: 'eleve_12', count: 1 },
      { type: 'belly_std', count: 6 },
      { type: 'sit_fly', count: 2 },
      { type: 'tracking', count: 2 }
    ]
  }
};
```

**UI.** Sélecteur "Stick type" en tête de la zone Parachutistes, à côté du bouton "Tout supprimer" :

```
[Stick type ▾] [Charger]   [+ Ajouter para]   [Vider]
```

Sélection → "Charger" remplit `jumpersList` en dépliant la composition (un objet `PARA_TYPOLOGIES` cloné par `count` × `type`) puis appelle `buildJumpers()` + `recompute()`.

**Bénéfice optimisation.** Avec un stick type chargé, l'optimiseur résout un **problème représentatif** :
- Tracking → axe contraint par leur direction d'évacuation.
- Wingsuit → côté de vol cohérent (`wsSide` propagé).
- Tandems → marges RDV plus fines (voile chargée, descente rapide).
- Élèves → marges minimales et `dtSortie` plus longs (stabilité avant ouverture).

Le score objectif intègre ces contraintes et l'axe / offset / ordre trouvés sont **directement applicables le jour J** sans reprendre l'optimisation pour le stick effectif (sauf composition très différente).

**Bonus — Statistiques de stick types.** Pour une vraie planification, on peut faire tourner l'optimiseur **sur les 6 sticks types** en parallèle (un worker chacun) avec une matrice météo (axe vent × vitesse vent), et présenter une carte de chaleur `stick × condition → score moyen`. Ça aide à choisir l'avion pour la rotation. Cette extension est documentaire pour l'instant — pas dans le scope immédiat.

**Fichiers.** `app.js` (constante `STICK_PRESETS` + chargement), builder UI dans `buildJumpers`, sélecteur dans le HTML près de la zone parachutistes.

---

### 15.20 Délai de sortie inter-groupes basé sur la vitesse relative plan-voile (Geens 2003)

**Problème.** §5.2 actuel calcule le délai entre deux sorties par :

```
gsMs    = max(1, tasMs + tw)
dtSortie = espacementM / gsMs
```

soit **vitesse sol avion seule**. La thèse Geens (APF, 2003 — voir `METHODES_LARGAGE.md` §6) montre par physique élémentaire que **le critère correct est la vitesse relative `v_p − v_c`**, où `v_c` est la **vitesse sol de la voile du groupe précédent**, projetée sur l'axe jump run, à l'altitude d'ouverture.

**Cas où l'écart est significatif :**

| Situation | `v_p` (m/s) | `v_c` (m/s) | `v_p − v_c` (m/s) | Erreur du modèle actuel |
|---|---|---|---|---|
| Vent faible, jumprun face vent | 40 | 8 | 32 | +25 % de séparation effective sous-estimée si on dimensionne sur `v_p` seul (conservatif, OK) |
| Vent fort à l'altitude largage, vent faible à l'ouverture | 25 | 8 | 17 | dt sous-estimé de 47 % — **scénario critique** |
| Vents haut/bas opposés (Geens §D) | 30 | 23 | 7 | dt sous-estimé d'un facteur 4 — **dangereux** |

**Refonte proposée.** Dans `PhysicsCore.simPass` (ou un helper dédié), calculer pour chaque transition entre deux exits :

```js
function dtSortieGeens(cfg, prevJumper, nextJumper, env) {
  // Vitesse sol avion sur jump run (déjà calculée)
  var gsPlane = Math.max(1, cfg.tasMs + dot(env.windAtJump, cfg.trackVec));

  // Vitesse sol voile du groupe précédent à l'altitude d'ouverture,
  // projetée sur le jump run et orientée +trackVec (vers le groupe suivant)
  var hOuv = prevJumper.hOuv;
  var windOpen = PhysicsCore.windAtZ(env.elevM + hOuv);
  var vhCanopy = prevJumper.vc * KH2MS;          // m/s
  // Cap voile au pire cas : straight-line vers le groupe suivant
  var vCanopyOnAxis = vhCanopy + dot(windOpen, cfg.trackVec);

  var vRel = Math.max(1, gsPlane - vCanopyOnAxis);
  return cfg.espacementM / vRel;
}
```

**Espacement requis.** L'espacement minimal entre deux sorties n'est plus `cfg.espacementM` constant mais **dépend de la géométrie des deux groupes** (Geens §6.3) :

```
espacementM = D₁(N₁) + D₂(N₂) + 78 + canopyRunOut
D(N)        = 39 / cos(90° − 180°/N)              // tracking radius
canopyRunOut = 3 s × vh_voile_max                  // marge sous voile, ~130 m typique
```

**Intégration dans `PhysicsCore`.**

1. Ajouter `PhysicsCore.exitSpacingGeens(jumperA, jumperB, env, opts)` qui retourne `{ distanceM, dtMin, vRel }`.
2. Dans `simPass`, remplacer le `dtSortie` constant par un appel par paire successive d'exits.
3. Backward-compat : si `cfg.useGeensSpacing === false`, retomber sur le calcul actuel.

**Bénéfice optimiseur.** La phase 3 (ordre de sortie, §12.4) bénéficie directement : le score d'un ordre intègre désormais correctement l'effet **vents opposés haut/bas** et les **diamètres de groupe différents**. Un ordre VR-puis-FF qui était jusqu'ici favorisé uniquement via la dérive chute libre se voit aussi récompensé via le forward throw (4 s × `gsMs`, voir §6.6 procédures).

**Détection de scénarios critiques.** Lever un warning UI quand :

- `(v_p − v_c) < 10 m/s` sur n'importe quelle paire successive (= vent haut/bas opposés ou groundspeed avion proche de la voile).
- `dtSortie > 15 s` (= jump run irréaliste, suggérer double passe).

**Cohérence simulation.** Cette refonte aligne le simulateur avec la **référence APF** (encore en ligne et reprise par les manuels USPA/UK). C'est un argument de crédibilité auprès des chefs de centre et des moniteurs qui utiliseront l'outil.

**Fichiers.** `physics-core.js` (nouvelles fonctions `exitSpacingGeens`, `tracking RadiusGeens`), `simulation.js` (mise à jour du jumeau legacy ou suppression — voir §15.1), `optimizer-v2.js` (utilisation du nouveau délai dans la phase 3), `ui-optimizer.js` (warning sur `vRel` faible et `dt` trop long), `SCIENCE.md` (équations).

**Validation.** Reproduire les 4 cas de Geens p. 14 (A/B/C/D) en regression test : un jeu de données `windProfile` minimal et deux jumpers VR-VR doivent rendre `t_e` à ±5 % de 7,3 s / 14 s / 21 s / 34 s respectivement.

---

## 16. Annexes — API publique et constantes

### 16.1 `PhysicsCore`

```js
PhysicsCore.KT2MS, NM2M, DEG2RAD, RAD2DEG, G, RHO0

// Atmosphere
PhysicsCore.getDensity(altM, isa?)
PhysicsCore.densityCorrection(altM, isa?)
PhysicsCore.computeTAS(kiasMs, altM, isa?)

// Wind
PhysicsCore.setWindProfile(profile)
PhysicsCore.enableWindCache(maxAlt)
PhysicsCore.windAtZ(z)

// Integrators
PhysicsCore.rk4(s, dt, vT, isa, trackVec?)
PhysicsCore.rk2(s, dt, vT, isa)

// Phases
PhysicsCore.simFreefall(s0, vT, targetZ, isa, t0, dt, trackVec?)
PhysicsCore.simOpening(s0, vc, vzVoile, isa, elevM, dt)
PhysicsCore.simCanopy(s0, vzV, glide, elevM, isa, steerFn, stopFn, opts)

// Steering
PhysicsCore.createSteerToPoint(targetE, targetN, vhMs, opts)
PhysicsCore.createSteerTwoPhase(perpE, perpN, tgtE, tgtN, vhMs, tPilot, opts)

// Full pass
PhysicsCore.simJumper(jp, env, rvZone, steerFn, dtCfg, t0)
PhysicsCore.simPass(cfg)

// Scoring
PhysicsCore.objectiveScore(result, windFromDeg, weights?)   // ← weights (évol. §15.10)
PhysicsCore.classicExitOrder(jumpers)
PhysicsCore.classifyJumper(j)

// Helpers
PhysicsCore.interpSp(sp, t)
PhysicsCore.computePairMinDists(timedTrajs)
```

### 16.2 `MonteCarlo`

```js
MonteCarlo.run(baseCfg, sigma, N, progressFn)
MonteCarlo.drawEllipses(map, mcResult, dz)
MonteCarlo.clearEllipses(map)
MonteCarlo.computeEllipse(xs, ys, confidence?)
MonteCarlo.perturbWind(profile, sigma)
MonteCarlo.perturbJumpers(jumpers, sigma)
MonteCarlo.gaussRandom()
```

### 16.3 `OptimizerV2`

```js
OptimizerV2.run(cfg, opts)    // async ; opts.onProgress, opts.onComplete, opts.weights
OptimizerV2.isRunning()
OptimizerV2.getResults()
```

### 16.4 Checklist pour modifier la physique

- [ ] Modifier `physics-core.js` (source canonique).
- [ ] Modifier `simulation.js` (jumeau legacy) — ou supprimer ce fichier si §15.1 est implémentée.
- [ ] Mettre à jour `SCIENCE.md` (équations) et `METHODOLOGIE.md` (hypothèses).
- [ ] Si nouvelle entrée, la faire transiter par `cfg` dans `simPass` et par le message worker (§2.5).
- [ ] Si une typologie change, mettre à jour `app.js::PARA_TYPOLOGIES`.
- [ ] Tester LFDJ Pamiers avant/après ; vérifier que `margeRDV` et `sep_min` restent dans la fourchette attendue.

---

*Document compilé le 2026-04-24. Maintenu en parallèle de `SCIENCE.md` (équations détaillées), `AERODYNAMICS_RESEARCH.md` (sources bibliographiques), `METHODES_LARGAGE.md` (pratique pays par pays) et `CLAUDE.md` (conventions projet). Wingsuit aligné sur la DT FFP 49 modifiée le 15 avril 2025.*
