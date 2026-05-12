# Modélisation scientifique du simulateur de largage parachutiste

## 1. Equations du mouvement

### 1.1 Modèle atmosphérique (ISA)

Le simulateur utilise l'**Atmosphère Standard Internationale** (ISA) à 3 couches pour calculer la masse volumique de l'air :

| Couche | Altitude | Température T(z) | Pression P(z) |
|---|---|---|---|
| Troposphère | 0 – 11 000 m | T = 288.15 − 0.0065·z | P = 101325·(T/288.15)^5.2559 |
| Tropopause | 11 000 – 20 000 m | T = 216.65 (isotherme) | P = P₁₁·exp(−g·(z−11000)/(R·216.65)) |
| Stratosphère | > 20 000 m | T = 216.65 + 0.001·(z−20000) | P = P₂₀·(T/216.65)^(−g/(0.001·R)) |

La masse volumique est alors :

$$\rho(z) = \frac{P(z)}{R_{air} \cdot T(z)}$$

avec **R_air = 287.058 J/(kg·K)** et **g = 9.80665 m/s²**.

Un décalage ISA (paramètre `isa`) permet d'ajuster la température par rapport au standard.

Pour des raisons de performance, une **Look-Up Table** (LUT) précalculée couvre 0–13 000 m par pas de 10 m avec interpolation linéaire.

### 1.2 Correction de densité et TAS

La vitesse vraie (TAS) est déduite de la vitesse indiquée (KIAS) par :

$$TAS = KIAS \times \sqrt{\frac{\rho_0}{\rho(z)}}$$

avec ρ₀ = 1.225 kg/m³ (densité au niveau de la mer ISA).

### 1.3 Modèle de vent

Le profil de vent est défini par couches (altitude, vitesse en kt, direction "venant de" en degrés). L'interpolation est **vectorielle** : les composantes Est/Nord sont interpolées séparément (et non vitesse+direction, ce qui éviterait les artefacts aux passages 360°/0°).

Sous la couche la plus basse, un **profil logarithmique de Prandtl** est appliqué :

$$\vec{V}(z) = \vec{V}_{ref} \times \frac{\ln(z/z_0)}{\ln(z_{ref}/z_0)}$$

avec z₀ = 0.03 m (longueur de rugosité pour terrain plat/herbe).

### 1.4 Equations fondamentales du mouvement

L'état du parachutiste est un vecteur à 6 composantes :

$$\mathbf{s} = [x_E,\; x_N,\; z,\; v_E,\; v_N,\; v_z]$$

(positions Est, Nord, altitude ; vitesses Est, Nord, verticale)

Les dérivées sont :

$$\dot{x}_E = v_E, \quad \dot{x}_N = v_N, \quad \dot{z} = v_z$$

Pour les accélérations, le modèle utilise la **traînée aérodynamique** via la vitesse terminale vT :

$$\vec{v}_r = \vec{v} - \vec{w}(z) - \vec{v}_{track}$$

$$|\vec{v}_r| = \sqrt{v_{r,E}^2 + v_{r,N}^2 + v_{r,z}^2}$$

$$c = \frac{\rho(z)}{\rho_0} \cdot \frac{g}{v_T^2}$$

$$\dot{v}_E = -c \cdot |\vec{v}_r| \cdot v_{r,E}$$

$$\dot{v}_N = -c \cdot |\vec{v}_r| \cdot v_{r,N}$$

$$\dot{v}_z = -g - c \cdot |\vec{v}_r| \cdot v_{r,z}$$

**Physiquement** : la force de traînée est proportionnelle au carré de la vitesse relative à l'air et opposée à celle-ci. Le coefficient c est calibré pour que la vitesse d'équilibre en chute stable soit exactement vT au niveau de la mer.

Le vecteur `trackVec` permet de modéliser un déplacement horizontal intentionnel (tracking, wingsuit) en l'injectant directement dans le calcul de la vitesse relative.

---

## 2. Intégration numérique

### 2.1 Runge-Kutta d'ordre 4 (RK4) — Chute libre

La phase de chute libre utilise la méthode **RK4 classique** :

```
k₁ = f(sₙ)
k₂ = f(sₙ + ½·dt·k₁)
k₃ = f(sₙ + ½·dt·k₂)
k₄ = f(sₙ + dt·k₃)

sₙ₊₁ = sₙ + (dt/6)·(k₁ + 2·k₂ + 2·k₃ + k₄)
```

Pas de temps typique : **dt = 0.25 s** en chute libre.

RK4 offre une erreur d'ordre O(dt⁵) par pas, ce qui est crucial pour la précision de trajectoires longues (30–60 s de chute libre).

### 2.2 Runge-Kutta d'ordre 2 (RK2/Heun) — Phase d'ouverture

La phase d'ouverture utilise un **RK2 (méthode de Heun)** :

```
k₁ = f(sₙ)
k₂ = f(sₙ + dt·k₁)

sₙ₊₁ = sₙ + ½·dt·(k₁ + k₂)
```

Pas de temps : **dt = 0.1 s**. La transition de vitesse terminale est rapide (~5.5 s), un RK2 plus fin suffit ici.

### 2.3 Intégration cinématique — Phase voile

Sous voile, le mouvement est **cinématique** (pas de résolution de forces) :

$$v_{h,TAS} = v_{z,voile} \times finesse \times \sqrt{\rho_0 / \rho(z)}$$

$$v_z = v_{z,voile} \times \sqrt{\rho_0/\rho(z)} + k_{virage} \cdot \dot{\psi}^2$$

Les composantes horizontales sont calculées par :

$$v_E = \sin(\psi) \cdot v_{h,TAS} + w_E(z)$$
$$v_N = \cos(\psi) \cdot v_{h,TAS} + w_N(z)$$

avec ψ le cap, mis à jour via un modèle de virage avec taux max (30°/s), accélération angulaire (90°/s²) et freinage anticipatif.

Pas de temps : **dt = 0.5 s**.

### 2.4 Modèle d'ouverture (transition chute libre → voile)

La phase d'ouverture dure **5.5 s** en trois sous-phases :

| Sous-phase | Durée | Vitesse terminale effective |
|---|---|---|
| Extracteur (pilot chute) | 1.0 s | vT diminue de 10% linéairement |
| Déploiement (line stretch) | 1.5 s | Transition linéaire de vc vers 3·vz_voile |
| Gonflage (inflation) | 3.0 s | Transition lissée (Hermite) de 3·vz_voile vers vz_voile |

Le lissage Hermite est `f² × (3 − 2f)` pour éviter les à-coups.

### 2.5 Détection de seuil (ground hit / target)

Quand l'altitude franchit un seuil cible entre deux pas, une **interpolation linéaire fractionnaire** localise précisément le point d'impact :

$$f = \frac{z_n - z_{cible}}{z_n - z_{n+1}}, \quad \mathbf{s}_{impact} = \mathbf{s}_n + f \cdot (\mathbf{s}_{n+1} - \mathbf{s}_n)$$

---

## 3. Simulation Monte-Carlo

### 3.1 Objectif

Quantifier l'**incertitude** sur les positions d'ouverture et d'atterrissage, et estimer la **probabilité de GO** d'une configuration de largage.

### 3.2 Génération de nombres aléatoires

Utilisation de la transformation de **Box-Muller** pour générer des variables gaussiennes :

$$Z = \sqrt{-2\ln(U_1)} \cdot \cos(2\pi U_2)$$

avec U₁, U₂ uniformes sur [0,1].

### 3.3 Perturbation du vent — Bruit AR(1) corrélé

Le vent n'est pas perturbé indépendamment couche par couche. Un modèle **autorégressif d'ordre 1 (AR(1))** maintient une corrélation verticale entre les couches :

$$\epsilon_k = \phi \cdot \epsilon_{k-1} + \sqrt{1-\phi^2} \cdot \sigma \cdot \mathcal{N}(0,1)$$

avec **φ = 0.7** (coefficient de corrélation). Cela signifie que si une couche est perturbée vers le haut, la couche adjacente a tendance à l'être aussi, ce qui est physiquement réaliste.

Paramètres par défaut :
- **σ_vitesse** = 3 kt
- **σ_direction** = 15°

Les perturbations sont appliquées séparément sur la vitesse et la direction, puis la vitesse est clampée ≥ 0.

### 3.4 Perturbation des paramètres du parachutiste

Chaque paramètre est perturbé multiplicativement (sauf h_ouverture, additive) :

| Paramètre | Perturbation | Sigma par défaut |
|---|---|---|
| Vitesse terminale (vc) | vc × (1 + σ·N(0,1)) | σ = 5% |
| Taux de chute voile (vzVoile) | vzV × (1 + σ·N(0,1)) | σ = 8% |
| Finesse (glide) | glide × (1 + σ·N(0,1)) | σ = 10% |
| Hauteur d'ouverture (hOuv) | hOuv + σ·N(0,1) | σ = 50 m |
| Compétence pilotage (skill) | skill + σ·N(0,1), clampé [0.2, 1.0] | σ = 0.1 |
| Bruit de navigation | N(0,1) directement injecté dans le steering | — |

### 3.5 Boucle Monte-Carlo

Pour N itérations (typiquement **100–500**) :

1. Générer un profil de vent perturbé (AR(1))
2. Générer des paramètres de parachutistes perturbés
3. Exécuter la simulation complète (`simPass`)
4. Collecter : positions d'ouverture (E,N), positions d'atterrissage (E,N), marges RDV, séparations minimales, verdict GO/NOGO

### 3.6 Analyse statistique

**Probabilité de GO** :

$$P_{GO} = \frac{N_{GO}}{N}$$

- GO si P_GO ≥ 95%
- MARGINAL si 80% ≤ P_GO < 95%
- NOGO si P_GO < 80%

**Ellipses de confiance à 95%** (pour les nuages de points ouverture/atterrissage) :

1. Calcul de la matrice de covariance 2×2 :
$$\Sigma = \begin{pmatrix} \sigma_{EE} & \sigma_{EN} \\ \sigma_{EN} & \sigma_{NN} \end{pmatrix}$$

2. Valeurs propres par la formule analytique :
$$\lambda_{1,2} = \frac{tr(\Sigma)}{2} \pm \sqrt{\frac{tr(\Sigma)^2}{4} - det(\Sigma)}$$

3. Angle de l'axe principal :
$$\theta = \frac{1}{2} \arctan\left(\frac{2\sigma_{EN}}{\sigma_{EE} - \sigma_{NN}}\right)$$

4. Demi-axes de l'ellipse :
$$a = \sqrt{\chi^2_{0.95,\,2df} \cdot \lambda_1}, \quad b = \sqrt{\chi^2_{0.95,\,2df} \cdot \lambda_2}$$

avec χ²₀.₉₅ = −2·ln(1 − 0.95) ≈ 5.991 (loi du chi-deux à 2 degrés de liberté).

**Percentiles des marges** : P5, P25, P50, P75, P95 calculés sur les marges RDV triées.

**Séparation minimale** : P5 et P50 sur les distances minimales inter-parachutistes.

---

## 4. Optimisation

### 4.1 Architecture en 4 phases

L'optimiseur cherche la meilleure configuration de largage selon un pipeline en 4 phases séquentielles.

### 4.2 Phase 1 — Scan géométrique grossier

**Espace de recherche :**
- **Axe de passe** : échantillonnage fin (±60° autour du lit du vent par pas de 5°), puis grossier (360° par pas de 15°)
- **Offset latéral (cross)** : de −1.0 à +1.0 NM par pas de 0.2 NM

Pour chaque couple (axe, cross), une simulation complète `simPass` est exécutée et scorée.

**Parallélisation** : le travail est réparti sur **2 à 8 Web Workers** (selon `navigator.hardwareConcurrency`). Chaque worker reçoit un sous-ensemble d'axes et évalue toutes les combinaisons.

### 4.3 Phase 2 — Raffinement fin

Les **8 meilleures** configurations issues de la phase 1 (celles maximisant le nombre de parachutistes + le score) sont raffinées :

- Axe : ±5° par pas de 1° autour du meilleur
- Offset : ±0.15 NM par pas de 0.05 NM autour du meilleur

Les résultats des deux phases sont fusionnés et triés par score.

### 4.4 Phase 3 — Optimisation de l'ordre de sortie (algorithme génétique)

**Objectif** : trouver l'ordre de sortie des sticks qui maximise la fonction objectif, en partant de l'ordre classique (hop&pop → belly → freefly → tandem → AFF → tracking → wingsuit).

**Algorithme génétique :**
- **Population** : min(20, max(8, 2×N)) individus
- **Initialisation** : 1 individu = ordre classique, les autres = permutations aléatoires
- **Générations** : 100 (si ≤7 sticks) ou 300 (si >7 sticks)
- **Sélection** : tri par score, les 50% meilleurs survivent
- **Mutation** : swap aléatoire de deux positions dans l'ordre
- **Pas de croisement** (crossover) — les enfants sont des copies mutées des parents

### 4.5 Phase 4 — Validation Monte-Carlo

La meilleure configuration géométrique + le meilleur ordre sont soumis à une **simulation Monte-Carlo** (section 3) pour valider la robustesse :
- Typiquement 100 itérations
- Fournit la probabilité de GO et les ellipses de confiance

### 4.6 Fonction objectif

La fonction de score multi-critères combine :

$$S = S_{nPara} + S_{vent} + S_{marge} + S_{sep} + S_{temps} - S_{offset}$$

| Composante | Formule | Poids max |
|---|---|---|
| Nombre de parachutistes | nPara × 10 000 | ∞ (priorité absolue) |
| Alignement vent (face au vent = optimal) | max(0, 1 − \|Δaxe\|/90°) × 500 | 500 |
| Marge RDV minimale | min(margeMin/300, 1) × 2000 | 2 000 |
| Séparation minimale | min(sepMin/400, 1) × 1500 | 1 500 |
| Temps inter-sortie | min(dtSortie/12, 1) × 300 | 300 |
| Pénalité offset latéral | \|crossNm\| × 200 | −∞ |

**Pré-requis** : si la configuration n'est pas GO (violation NFZ, marge négative, séparation insuffisante, temps inter-sortie < 5s), le score est **−∞**.

La hiérarchie des poids garantit que :
1. On maximise d'abord le nombre de parachutistes embarqués
2. Puis on favorise un axe face au vent
3. Puis on maximise les marges de sécurité et séparations
4. Enfin on minimise l'offset latéral (préférence pour un passage centré sur la cible)
