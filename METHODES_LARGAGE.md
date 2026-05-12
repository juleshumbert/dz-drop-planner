# Calcul du jump run, top vert et top rouge — recap (v3)

*Recherche ciblée sur : (1) ce que contient la **formation des pilotes largueurs** au sujet du calcul du jump run, (2) la **méthode de calcul de l'axe et de l'offset** en fonction des vents aux différentes altitudes et de la géométrie de la DZ, (3) la détermination du **top vert** (premier largage) par pays, (4) la détermination du **top rouge** (fin de largage). Une synthèse clôt chaque section.*

---

## 1. Formation des pilotes largueurs — que contient-elle sur le calcul du jump run ?

### 1.1 Ce qui est réellement enseigné

La plupart des cursus pilotes largueurs distinguent deux niveaux :

- **Le concept** (quoi faire) : quasi-universellement enseigné. Le pilote doit comprendre ce qu'est un jump run, pourquoi le vent en altitude déplace les parachutistes, pourquoi on sort face au vent moyen, et comment la dérive sous voile contraint la position de sortie.
- **Le calcul numérique détaillé** (comment le chiffrer) : **plus rarement formalisé dans la formation pilote**. Les manuels partent du principe que le point de largage est **pré-calculé** par l'équipage, le chef largueur ou le directeur technique au sol, et que le rôle du pilote est de **voler précisément un axe et de déclencher le largage au point prescrit**.

Le *British Skydiving Jump Pilots Manual* décrit ainsi la mission : *« fly the aircraft efficiently to a predetermined point over the ground, arriving at a given height and a given speed »* — le point est **pré-déterminé**, pas calculé par le pilote en vol.

### 1.2 Tour d'horizon des cursus

| Pays | Document | Contenu sur le calcul du jump run |
|---|---|---|
| USA | *USPA Skydiving Aircraft Operations Manual* + *Jump Pilot Training Syllabus* + *FAA AC 105-2E* | Partie sur *winds aloft*, calcul de dérive, séparation par groundspeed, responsabilité partagée pilote/spotter. Pilote chargé d'annoncer heading, groundspeed et exit separation avant ouverture porte. |
| UK | *British Skydiving Jump Pilots Manual* | Décrit la notion d'*exit point* et de *heading* mais confie le calcul détaillé au jumpmaster/CCI. Le pilote doit « amener l'avion à un point pré-déterminé à une hauteur et une vitesse données ». |
| Australie | *APF Jump Pilot Manual V01-2024* (mandatoire, accepté CASA) | Explicitement : « not designed to train pilots, but to detail the specific skills and potential hazards of jump flying ». Concept de spotting défini ; calcul renvoyé à l'expérience et au CCI. |
| France | Arrêté 13 mars 1989 + programme de l'exploitant (DNC abolie en 2017) | Formation théorique facteurs humains obligatoire ; formation pratique au largage dispensée par le chef pilote de l'exploitant. Règle de pouce enseignée : **décaler le point de largage de 0,3 NM par 10 kt de vent**. |
| Canada | *CSPA Jump Master Reference Manual* + PIM 2C | Insiste sur l'expérience : « The ability to select the correct set-up point is gained by experience […] a jump-by-jump assessment of the winds. » Formules de base enseignées au brevet. |
| Allemagne | *DFV Handbuch Absetzbetrieb* | Formules métriques explicites : ex. 40 kt × 0,5 = 20 m/s × 60 s = 1200 m de dérive chute. Calcul enseigné aux pilotes et sauteurs. |

### 1.3 Synthèse — formation pilote et jump run

Le calcul du jump run **n'est presque nulle part une responsabilité formellement attribuée au pilote seul**. Les manuels pilotes (USA, UK, AU) décrivent le concept, les variables d'entrée (winds aloft, vitesse avion, altitude), la mécanique du spotting et les règles de communication, mais la **méthode numérique détaillée** est soit enseignée au parachutiste (spotter/jumpmaster), soit apprise par compagnonnage auprès du chef pilote. L'Allemagne et la France dispensent des règles de pouce chiffrées ; les pays anglophones privilégient les tableaux et calculateurs externes (AXIS, Spot Assist, Skydive Academy Virtual Spot).

**Ce que le pilote sait obligatoirement faire** après formation : lire un bulletin winds-aloft, estimer la dérive, voler un axe précis à la vitesse demandée, annoncer groundspeed et séparation, gérer les passes multiples (racetrack). **Ce qui reste typiquement le travail du sol / de l'équipage DZ** : choisir l'axe, tracer la *« fenêtre de largage »* (nearest/furthest exit), valider le décalage vs obstacles.

---

## 2. Calcul de l'axe et de l'offset du jump run

### 2.1 Entrées du calcul

1. **Vent en altitude** (winds-aloft forecast) à 3 000, 6 000, 9 000, 12 000 ft (typiquement, pour un largage à ~13 500 ft) — direction et force de chaque couche.
2. **Vent surface** (ou à l'altitude d'ouverture) pour la phase sous voile.
3. **Altitude de largage**, **altitude d'ouverture** et **altitude sol** (QNH corrigé).
4. **TAS de l'avion au jump run** (généralement 70–90 kt sur PC-6/Cessna, 80–100 kt sur Otter).
5. **Performance voile** : finesse et vitesse horizontale en air calme (15–30 mph = 13–26 kt pour une voile standard, finesse ≈ 2:1 à 3:1 ; 3:1 et 70 mph pour une wingsuit performante).
6. **Géométrie de la DZ** : longueur, largeur, orientation du grand axe, obstacles sur les côtés, *outs* (aires d'évacuation), NFZ.

### 2.2 Détermination de l'axe

**Méthode standard (USA/UK/FR/CA)** :

1. Moyenner les directions du vent des couches 3k / 6k / 9k / 12k et du vent sol.
2. Prendre cette direction moyenne comme **axe de ligne de vol**, cap avion = 180° opposé (on vole face au vent moyen).
3. Si la DZ est **longue et étroite**, choisir si possible l'axe qui exploite le grand axe de la DZ, quitte à accepter un léger crosswind.
4. Si le vent moyen conduit à passer sur un obstacle (ville, aérodrome, NFZ), décaler l'axe jusqu'à obtenir un compromis acceptable.

**Exemple chiffré (Skydive the Ranch, USA)** : winds 240°/260°/270°/270°/290° → (240+260+270+270+290)/5 = **266°**, donc ligne de vol au 086° (face au vent).

### 2.3 Détermination de l'offset (distance entre le PI/cible et le point de sortie)

**A. Dérive chute libre** — formule universelle :

```
Drift_FF = V_wind_moyen × T_chute
```

Conversions usuelles :
- `V_wind (kt) × T_chute (s) / 3600 × 6076 = Drift (ft)`
- Règle de pouce : **60 kt pendant 60 s ≈ 1 NM de dérive** (≈ 1 852 m, ≈ 6 076 ft).
- 30 kt / 60 s ≈ 0,5 NM
- 15 kt / 60 s ≈ 0,25 NM (≈ 1 320 ft)

Exemple (USPA-style) : winds 40/45/30/50 kt aux 4 niveaux → moyenne 41,25 kt × 1,15 = 47,4 mph / 60 = **0,79 mi** — puis on retranche ~0,2 mi de *forward throw* = **0,59 mi** d'offset utile.

**B. Forward throw** (inertie avion au moment de la sortie) :

- ≈ 45 m à 90 kt sur une sortie *belly*
- ≈ 0,2 mi (≈ 320 m) en pratique cumulée pour plusieurs secondes de transition (rule of thumb USA)
- À soustraire de la dérive chute libre dans le sens du cap avion.

**C. Dérive sous voile** :

- Voile à finesse 2,5:1 typique élève : elle avance 2,5 ft pour 1 ft de descente, vitesse horizontale 15–30 mph.
- Temps sous voile ≈ altitude ouverture / taux descente (≈ 1 000 ft/min élève, ≈ 500–800 ft/min confirmé).
- Dérive sous voile = vent à l'altitude d'ouverture et plus bas × temps sous voile, MINUS la capacité de pénétration de la voile face au vent.

Exemple (DFV, Allemagne) : vent moyen 10 kt (5 m/s), 3 min sous voile → 900 m de dérive sous voile, à cumuler avec la dérive chute (1 200 m dans l'exemple allemand), soit **2 100 m totaux à remonter contre le vent**.

**D. Règle française synthétique** (enseignée au *pilote largueur*) :

> **Décaler le point de largage de 0,3 NM par tranche de 10 kt de vent**, la fenêtre de largage étant centrée sur ce point.

Soit ≈ 0,56 km / 10 kt. C'est une approximation qui agrège dérive chute + dérive sous voile − forward throw pour un largage de loisir standard à ~4 000 m, et qui est **cohérente avec les règles USPA** (30 kt → 0,9 NM, à comparer aux ~0,75 NM de la règle américaine).

### 2.4 Impact de la géométrie de la DZ

La géométrie **peut forcer à renoncer à un jump run pile face au vent**. Les configurations typiques :

- **DZ longue et étroite avec obstacle d'un côté** → **crosswind jump run** : axe perpendiculaire au vent, avec un **offset latéral** de sorte que tous les parachutistes restent à la même distance de la zone dangereuse. L'offset dépend de la taille des groupes : faible pour un 4-way, important pour un 40-way (break-off spread).
- **Vent moyen orienté vers obstacle** → **hook pattern jump run** : entrée offset côté downwind, virage maintenu, les sauteurs sortent pendant que l'avion décrit un arc autour de la DZ. Utilisé sur Twin Otter principalement, exige une coordination explicite avec les sauteurs (qui d'habitude ne sortent pas en virage).
- **Big-ways** (formations 40+) → offset augmenté côté opposé au break-off pour laisser de la marge à l'écartement.
- **Angle flying / tracking / wingsuit** → axe souvent décalé de 30–45° du jump run principal pour dégager la trajectoire des autres groupes. Jumprun wingsuit pensé en **offset perpendiculaire au jump run belly** sur certaines DZ.

### 2.5 Synthèse — méthode de calcul

La méthode réellement utilisée en civil est un **algorithme à deux étapes** :

**Étape 1 — Calcul théorique** depuis les winds-aloft :
1. Moyenne des directions → axe.
2. Moyenne des vitesses → dérive chute libre (`V × T`).
3. Vents basse altitude + performance voile → dérive sous voile.
4. Cumul − forward throw = **offset total upwind du PI**.
5. Marges : fenêtre de largage = segment le long de l'axe entre **exit point le plus proche** (limite d'accès sous voile face au vent) et **exit point le plus éloigné** (limite de finesse voile pour revenir).

**Étape 2 — Ajustement géométrique** :
- Vérifier que l'axe n'envoie pas les chuteurs ou les voiles sur un obstacle / NFZ / airport actif.
- Si non : crosswind ou hook, avec recalcul de l'offset latéral.
- Si formations larges : élargir l'offset pour le break-off spread.

Le chiffrage peut être fait **à la main** (tous les manuels donnent les règles de pouce), **graphiquement** sur une photo de la DZ (méthode USPA/UK/CSPA classique), ou **via outil** (AXIS Exit Separation, Spot Assist, Skydive Academy Virtual Spot, GPS en cockpit avec waypoints). La tendance moderne est le **GPS en cockpit** avec axe tracé et waypoint « release point » ; le spotter garde un rôle de **vérification visuelle** au moment de l'ouverture de la porte.

---

## 3. Détermination du top vert (premier largage) par pays

### 3.1 Principe universel

Le top vert est donné **lorsque l'avion atteint le point de sortie le plus en amont de la fenêtre de largage** (ou, selon les DZ, lorsque le centre de gravité de la fenêtre est atteint, si un seul groupe). C'est le point où :
- La sortie permet au *premier groupe* (le plus lent à tomber = le moins dérivé) d'ouvrir au-dessus du PI après 60 s de chute plus la dérive sous voile.
- L'espace aérien est vérifié libre (ATC informé, pas d'avion en palier, pas de nuage bloquant la vue du sol).

### 3.2 Pratique par pays

**USA (USPA SIM 4-7 + AC 105-2E + pratique commune DZ)**
- Avant le largage : le pilote annonce en cabine les **call-outs** (« 2 minutes », « 1 minute », « door »).
- Le spotter (ou le pilote seul sur petite DZ) **check visuel** par la porte ouverte : axe correct, cible alignée, pas de trafic en dessous.
- **Top vert** : donné verbalement (« GO ! »), par signe, ou par **feu vert** si l'avion en est équipé. Techniquement, le feu vert signifie « le pilote a terminé les ajustements de vitesse/trim, ATC est informé ».
- Le PIC a autorité finale : il peut **refuser le vert** même si l'avion est sur le spot (trafic, nuage). La `WDI` (Wind Drift Indicator papier) est abandonnée au profit du GPS.

**Royaume-Uni (British Skydiving Ops Manual)**
- Spot calculé par le CCI en pré-vol.
- Pilote vole l'axe, atteint altitude et vitesse prescrites, **confirme avec le JM/spotter**.
- Largage déclenché sur **signal du jumpmaster** (le pilote ne largue pas lui-même), mais le pilote reste maître du refus du largage.

**France (FFP / arrêté 1989 + pratique PC-6)**
- Pilote suit l'**axe affiché au GPS** (waypoint préparé au briefing).
- À l'approche du point de largage (FL110 ou équivalent) : réduction de puissance à ~70 kt, info ATC.
- **Top vert** : le cockpit annonce **« C'est OK ! »** aux parachutistes, la porte coulissante est ouverte, les sauteurs sortent séquentiellement.
- L'avion entre en légère descente pendant la sortie (éviter l'empennage).

**Australie (APF Jump Pilot Manual V01-2024)**
- Spot désigné par le CCI / DZSO.
- Jump run « on a track overhead the DZ and into the designated area ».
- Pilote gère l'approche, coordonne avec le LJM (*Load Jumpmaster*), feu vert ou commande verbale selon l'équipement avion.

**Canada (CSPA PIM 2C + JM Reference Manual)**
- Approche très expérientielle : le set-up point « se gagne par l'expérience, jump par jump ».
- Pilote et JM se coordonnent ; le top vert est déclenché par le JM, confirmé par le pilote.

**Allemagne (DFV)**
- Calcul plus numérique, formulé en métrique.
- Pilote largueur qualifié par le *DFV* ; il applique les formules dérive enseignées et valide le point de largage avec le *Fluglehrer* / chef de centre.

**Militaire (cadrage rapide)**
- Feu **rouge** au décollage et à l'approche DZ.
- Feu **vert** synchronisé sur le CARP : `D = K·A·V` remonte du PI vers l'amont vent.
- Parachutistes sortent à cadence imposée (1/s/porte) jusqu'au feu rouge.

### 3.3 Synthèse — top vert

Le top vert est partout la **matérialisation physique** de l'arrivée de l'avion sur le **point de sortie amont** de la fenêtre de largage, **conditionné par la clairance espace aérien et visuelle**. La différence entre pays n'est pas sur le *quand* (toujours : « on atteint le spot amont ET clair ») mais sur **qui déclenche** :
- Feu + signal pilote, chuteur sort de lui-même : USA, AU, DE, CA sur gros avions.
- Signal verbal cockpit (« C'est OK ») : France.
- Signal du jumpmaster / spotter : UK, CA sur petits avions, USA sur gros avions en formation.

Les **outils** convergent : GPS en cockpit avec waypoint release + check visuel par le spotter reste l'architecture dominante. Les WDI papier ont disparu des cursus post-2010.

---

## 4. Détermination du top rouge (fin de largage) par pays

### 4.1 Principe universel

Le top rouge marque la fin de la fenêtre de largage. Il est déclenché par **l'une de ces quatre conditions** :

1. **Tous les groupes ont sauté** → le pilote ferme la porte et pique vers le circuit de descente.
2. **L'avion dépasse le point de sortie aval** (furthest exit point) : au-delà, les voiles ne pourraient plus rejoindre la cible contre le vent.
3. **Problème de sécurité** : trafic, nuage, intrusion NFZ, panne avion, chute d'équipement.
4. **Annulation sol** : le DZSO / chef de centre appelle la radio pour arrêter le largage (obstacle au sol, autre avion en finale, changement brusque de vent).

Si des groupes n'ont pas sauté à cause d'un top rouge précoce (cause 2, 3 ou 4), l'avion effectue un **racetrack** (circuit hippodrome, virage dans le sens DZ-briefing) et présente une **deuxième passe**.

### 4.2 Calcul du point de sortie aval

**Contrainte physique** : la voile doit pouvoir revenir au PI. Si `V_voile_air` est la vitesse horizontale voile en air calme et `V_vent` le vent face (composante face à la voile au retour), la portée utile est :

```
Portée_voile = (V_voile_air − V_vent) × T_sous_voile
```

Si `V_vent ≥ V_voile_air`, la voile **ne rentre pas** : on ne largue plus. Ex. : voile 20 kt, vent 25 kt au niveau ouverture → V_rel négatif → point de sortie aval **côté amont** du PI.

**Règle pratique** (USPA et dérivés) : tracer sur la photo DZ le segment le long de l'axe entre *nearest exit* et *furthest exit*, où les deux sont définis par la finesse voile avec/contre le vent. La **longueur de la fenêtre** détermine combien de groupes peuvent sortir sur une seule passe avec la séparation requise (7 s à 90 kt, 5 s à 120 kt).

### 4.3 Pratique par pays

**USA** : le feu rouge est utilisé sur les avions gros porteurs (Otter, Caravan avec équipement). Sur les petits avions, annonce verbale ou le pilote ferme simplement la porte. Sortie d'un groupe sur feu rouge : **violation de sécurité** majeure, engage la responsabilité du PIC.

**UK (British Skydiving)** : fin de largage sur décision pilote ou JM. *Operations Manual* exige que le pilote garde la main pour stopper le largage à tout moment.

**France** : fin de largage = signal négatif du cockpit (porte refermée) ou annonce radio ; si nécessaire, **demi-tour en hippodrome** et nouvelle passe. Le pilote largueur est formé à l'enchaînement descente rapide post-largage (~6 500 ft/min à 90-95 KIAS sur PC-6) pour libérer l'espace aérien.

**Australie** : le *Jump Pilot Manual* décrit la procédure d'abandon et de go-around, y compris communication radio. Sur gros avions équipés, feu rouge.

**Canada, Allemagne** : procédures équivalentes, feu rouge sur gros avions, signalisation verbale sinon.

**Militaire (cadrage)** : feu rouge **illuminé dès que la DZ est franchie** ou dès qu'un problème survient. **Le pilote amorce immédiatement le racetrack**. Sortie sur feu rouge = sanction et enquête.

### 4.4 Synthèse — top rouge

Le top rouge est **moins célébré** que le top vert dans la littérature mais tout aussi codifié. Il n'a pas de **formule dédiée** — il est déterminé par le **dépassement d'une limite** (géographique, temporelle, opérationnelle). Sa **signification géographique** (dépassement du furthest exit) est calculée via la finesse voile et la vitesse de pénétration face au vent, donc indirectement via les mêmes winds-aloft que le top vert.

**Points de convergence internationale** :
- Feu rouge sur gros avions, annonce verbale sinon.
- Responsabilité pilote de maintenir la possibilité d'arrêt à tout moment.
- Racetrack pour 2e passe standardisé (virage côté DZ-briefing, altitude conservée).
- Violation majeure si sortie sur feu rouge.

---

## 5. Synthèse globale

| Phase | Responsable du **calcul** | Responsable du **déclenchement** | Formule dominante |
|---|---|---|---|
| Axe | Chef de centre / JM / spotter en pré-vol | Pilote exécute | Moyenne vectorielle winds 3k/6k/9k/12k + vent sol |
| Offset (upwind) | idem | Pilote positionne | `Drift = V × T` (60kt/60s ≈ 1 NM) ou règle FR 0,3 NM/10 kt |
| Fenêtre de largage | idem | Pilote survole | Longueur = portée voile face au vent (V_voile − V_vent) × T_voile |
| **Top vert** | — | Pilote (feu/voix) ou JM | Avion sur *nearest exit* + clair espace aérien |
| **Top rouge** | — | Pilote | Avion sur *furthest exit* OU problème sécu OU tous sortis |

**Convergences inter-pays** :
- Le calcul de **l'axe** est identique : moyenne des winds-aloft + ajustement géométrique.
- Le calcul de **l'offset** repose sur la même physique (dérive = vent × temps) ; seules les règles de pouce diffèrent (métrique vs NM, agrégée vs décomposée).
- Le **top vert** est toujours la conjonction « spot atteint + clair ».
- Le **top rouge** est toujours le dépassement d'une limite (géographique, sécurité, ou fin logique).

**Divergences notables** :
- **Qui calcule** : le pilote dans les petits pays / petits avions (FR, CA rural), le JM/spotter dans les pays anglophones (USA, UK, AU).
- **Quelle règle de pouce** : France 0,3 NM/10 kt ; USA 60 kt → 1 NM (dérive pure, forward throw à part) ; Allemagne métrique pure.
- **Place du feu rouge/vert dans la formation** : central dans les opérations gros avions / militaire, informel sur petits avions civils.

**La formation pilote largueur**, quel que soit le pays, se concentre sur : (1) comprendre les entrées du calcul, (2) exécuter l'axe et les vitesses, (3) déclencher vert/rouge avec discipline. **Le calcul détaillé reste, en pratique, partagé ou délégué au chef largueur / jumpmaster / chef de centre.**

---

## 6. Séparation entre groupes successifs — apports de la thèse Geens (APF, 2003)

*Source : Steven Geens, *Exit Separation — Instructor A Thesis*, APF, novembre 2003. Ce document — encore référencé sur le site officiel APF et largement repris par les manuels anglophones — formalise la séparation horizontale inter-groupes par une physique élémentaire. Il complète les sections 2-5 ci-dessus (qui traitent du jump run global) en se concentrant sur le **délai entre deux sorties**.*

### 6.1 Postulat fondateur — pas de séparation verticale

Geens écarte d'emblée le raisonnement « les vitesses verticales différentes garantissent la séparation à l'ouverture ». Une **ouverture lente, prématurée ou un dysfonctionnement** annulent cette séparation verticale instantanément. **Seule la séparation horizontale au moment de l'ouverture compte**, et c'est cela qu'il faut dimensionner.

### 6.2 Distance minimale entre deux voiles à l'ouverture — 78 m

Trois constantes empiriques posent le plancher universel :

- **Temps de réaction humain pour percevoir une collision et l'éviter** : 3 s.
- **Vitesse air voile « moyenne »** (sport, époque thèse) : 13 m/s ≈ 26 kt.
- **Taux de descente voile moyen** : 6,5 m/s.

D'où : `2 × 3 s × 13 m/s = 78 m` minimum entre deux voiles ouvertes face-à-face. C'est la **distance plancher inter-voile**, indépendante du vent.

> **Cohérence avec le simulateur DZ Drop Planner** : les voiles modélisées dans `app.js::PARA_TYPOLOGIES` ont `vc=50–70 km/h` (≈ 14–19 m/s) et `vzVoile=5–10 m/s`. La voile « MV » du sim (vh ≈ 12,5 m/s, vz = 5 m/s) cadre avec la référence Geens ; les voiles « SV » (vh ≈ 20 m/s, vz = 10 m/s) sont plus rapides et exigeraient un plancher relevé proportionnellement (ex. 2 × 3 s × 20 m/s = 120 m).

### 6.3 Géométrie de groupe à l'ouverture — formule de tracking

Pour `S` parachutistes répartis uniformément autour d'un centre, qui trackent vers l'extérieur jusqu'à atteindre 78 m entre voisins :

```
A = 90° − 180°/S            (demi-angle au centre)
D = 39 / cos(A)             (distance de tracking par jumper, m)
∅ groupe à l'ouverture = 2 × D
```

Tableau de référence (Geens, Table 2) :

| Groupe (S) | Tracking D (m) | Diamètre groupe à l'ouverture (m) |
|---|---|---|
| 1 | 0 | 39 |
| 2 | 39 | 78 |
| 4 | 55 | 110 |
| 8 | 102 | 204 |
| 10 | 126 | 252 |

Au-delà de 10, les jumpers cassent en **vagues concentriques** (l'extérieur tracke plus loin et plus longtemps), et le diamètre réel est inférieur à `2D` extrapolé.

### 6.4 Distance et délai d'exit entre deux groupes — formule clé

```
D_exit  = D₁ + D₂ + 78 m + (canopy run-out)
t_exit  = D_exit / (v_p − v_c)
```

où `D₁`, `D₂` sont les rayons de tracking des deux groupes, `v_p` la **vitesse sol avion** sur jump run, `v_c` la **vitesse sol voile** du groupe 1 dans la direction de jump run.

**L'apport central de Geens** : il ne suffit pas de prendre la vitesse sol avion. **C'est la différence (v_p − v_c) qui dimensionne le délai**. Cas pédagogique extrême (Geens §C) : avion dans 50 m/s de vent face = ground speed 0 ; voile recule à −11 m/s sous 24 m/s de vent face ; on obtient quand même une séparation valide en 21 s, parce que la voile s'éloigne du point de sortie pendant que l'avion stationne.

### 6.5 Cas dangereux — vents haut/bas opposés

Quand le vent à l'altitude de largage et le vent à l'altitude d'ouverture sont **en sens opposés**, `v_p` et `v_c` peuvent avoir le même signe et `(v_p − v_c)` devient très petit.

Exemple Geens §D : vent haut 20 m/s ouest, vent bas 10 m/s est, jumprun ouest, TAS 50 m/s → `v_p = 30 m/s`, `v_c = 23 m/s` (la voile pénètre faiblement le vent bas), `t_exit = 235 / 7 = 34 s`. **Impossible à tenir sur un jump run normal** — la solution opérationnelle est :

- **Briefer tout le monde** sur la situation.
- **Sortir bien en amont de la PA** pour profiter du vent bas vers la PA.
- **Pivoter immédiatement à 90° du jump run après ouverture** pour quitter l'axe et regarder le groupe suivant ouvrir avant de revenir vers la PA.
- À défaut : double passe.

### 6.6 Disciplines à vitesses verticales différentes — ordre de sortie

**Dérive en chute libre** (l'air pousse le sauteur après ~10 s) :
- Une équipe VR (53 m/s vertical, ~70 s de chute depuis 14 000 ft) dérive **20 s de plus** qu'une équipe freefly (73 m/s, ~50 s).
- Sous 30 kt de vent moyen, ça fait un écart de **300 m** entre les deux groupes.

**Forward throw** (inertie horizontale après sortie) :
- Un freeflyer (head-down/head-up, surface frontale faible) garde l'inertie avion plus longtemps qu'un belly.
- Geens chiffre l'écart à **≈ 4 s × vitesse sol avion** (ex. 4 × 40 m/s = 160 m de throw différentiel).

**Conclusion ordre de sortie** : *slow fallers (VR) avant fast fallers (freefly)*. Vrai même par vent nul (forward throw) et amplifié par le vent (dérive chute libre). L'inverse — freefly d'abord — peut conduire la VR à ouvrir **directement au-dessus** des freeflyers ouverts, scénario analysé page 18 de la thèse.

> **Cohérence avec `PhysicsCore.classicExitOrder`** : à vérifier que le tri actuel place bien VR avant freefly. Le §15.2 de `METHODOLOGIE.md` (typologies alignées sur la recherche aéro) doit intégrer ce critère explicitement.

### 6.7 Disciplines à mouvement horizontal (tracking, atmonauti, flocking)

- **Direction obligatoire 90° du jump run**, sauf si seul groupe.
- Si plusieurs groupes mouvants : **alterner gauche/droite**.
- Position dans la stack : **milieu**, pas premier ni dernier (les autres tombent dans des zones mortes par rapport à l'axe de tracking).
- Sortie **légèrement en amont de la PA** (côté upwind sous voile), pour laisser de la place au déplacement et atterrir à la PA.

### 6.8 Ordre de sortie « jour normal » recommandé

Geens propose, pour vents au sol 0–10 kt et vents en altitude 10–20 kt **dans le même sens** :

```
CRW (11000 ft) → Skysurf → VR → VR → Élève (3500 ft)
              → Freefly → Tandem (3900 ft) → Ouverture haute (7500 ft)
```

avec inversion VR/élève selon orientation jump run et position de la zone élèves au sol. Cet ordre **minimise la longueur de jump run** ; toute autre permutation rallonge le jump run pour récupérer la séparation, au risque d'amener des groupes hors PA.

### 6.9 Plancher pratique recommandé par Geens

Pour un jour « normal » (vents bas et haut alignés, légers à modérés) sans calcul détaillé :

- **Groupes < 4 sauteurs** : **300 m** d'exit distance minimum.
- **Groupes 4–10 sauteurs** : **500 m** d'exit distance minimum.

Décomposition : tracking + 78 m réaction + **130 m de marge de sécurité (3 s sous voile)**. Au-delà de cela, calcul détaillé requis.

### 6.10 Tableau « situations anormales » (Geens p. 27)

| Situation | Mitigation |
|---|---|
| Ground speed < 60 kt | Allonger le délai, demander aux sauteurs d'être patients à la porte, dégager axe vent dès contrôle voile |
| Ground speed > 110 kt | Raccourcir le délai, sauteurs prêts à la porte |
| Fast fallers avant slow fallers | +100 m par 10 kt de vent moyen + 4 s pour le forward throw |
| Sortie amont PA (long spot) | Dégager axe vent, ne pas viser la PA tant que le groupe suivant n'est pas vu ouvrir |
| Vents haut/bas opposés | Briefer tout le monde, exclure les élèves/inexpérimentés s'ils ne peuvent être placés à part |
| Crosswind jumprun | Briefer ouverture hors axe vent, attention spéciale aux groupes mouvants |
| Break-off élevé | Pas de tracking sur le cap avion (un bon track fait 20 m/s, on entre dans le groupe suivant) |
| Beaucoup de sorties | Premier et dernier ouvrent plus haut, ou deux passes |
| Tailwind run-in | Reconsidérer l'ordre slow/fast en intégrant dérive et forward throw |

### 6.11 Synthèse — apports concrets pour la documentation procédures

1. **Le critère universel est la vitesse relative `v_p − v_c`**, pas la vitesse sol avion seule. À retenir comme amendement à la formule simplifiée des sections 2.3 et 5.
2. **Plancher 78 m + tracking + 130 m de marge** = **300 m / 500 m** selon taille de groupe, sans calcul, par jour normal.
3. **VR avant freefly** est défendable même par vent nul (forward throw). Sous vent réel, c'est obligatoire.
4. **Vents opposés haut/bas** = situation à traiter spécifiquement, briefing collectif et 90° dégagement post-ouverture.
5. **Disciplines mouvantes au milieu de la stack**, mouvement perpendiculaire au jump run, alternance gauche/droite.

---

## Sources

### Méthodologie générale et formules
- USPA SIM 4-7 — <https://www.uspa.org/sim/4-7>
- USPA Drop Zone Management & Aircraft Operations — <https://www.uspa.org/drop-zone-management/aircraft-operations-and-pilot-training>
- FAA AC 105-2E — <https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_105-2E.pdf>
- Skydive Fundamentals, *Freefall Drift & Spotting* — <https://www.skydivefundamentals.com/safety/freefall-drift-and-selecting-a-spot>
- Skydive the Ranch, *Determining Exit Point* — <https://skydivetheranch.com/learn-to-skydive/determing-exit-point/>
- Florida Skydiving Center, *Determining Exit Point aka Spotting* — <https://floridaskydiving.com/determining-exit-point-aka-spotting/>
- Jump Aircraft Spotting Basics (DiverDriver) — <https://diverdriver.com/jump-aircraft-spotting-basics/>
- Crosswind Jump Runs (DiverDriver) — <https://diverdriver.com/crosswind-jump-runs/>
- Hook Pattern Jump Run (DiverDriver) — <https://diverdriver.com/hook-pattern-jump-run/>
- GPS Spotting (DiverDriver) — <https://diverdriver.com/gps-spotting/>
- Jump Pilot Training Syllabus (DiverDriver) — <https://diverdriver.com/jump-pilot-training-syllabus/>
- AXIS Exit Separation tool — <https://axis.tools/tool_Exit.php>

### Manuels pilotes par pays
- British Skydiving Jump Pilots Manual — <https://skydiverdriver.com/britishskydiving.pdf>
- APF Jump Pilot Manual V01-2024 — <https://www.apf.com.au/ArticleDocuments/1260/Jump%20Pilot%20Manual%20V01-2024%20FINAL.pdf.aspx>
- APF *Exit Separation* thesis (Steven Geens) — <https://www.apf.com.au/ArticleDocuments/1411/exit-separation.pdf.aspx>
- FFP, *Piloter un avion largueur* — <https://www.ffp.asso.fr/en/piloter-un-avion-largueur/>
- Arrêté du 13 mars 1989 (largage parachutistes) — <https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000863105>
- aeroVFR, *Largage para en PC-6 Turbo Porter* — <https://www.aerovfr.com/2024/08/largage-para-en-pc-6-turbo-porter/>
- CSPA PIM 2C FR — <https://www.cspa.ca/sites/default/files/PIM2C-fr_1.pdf>
- CSPA Jump Master Reference Manual — <https://www.cspa.ca/sites/default/files/2019%20JM%20Reference%20Manual%20(en).pdf>
- EASA *Handbuch für Absetzbetrieb* — <https://www.easa.europa.eu/en/downloads/134328/de>
- ENAC, *Regolamento lanci paracadutistici* — <https://www.enac.gov.it/app/uploads/2024/04/Regolamento_Disciplina_lanci_paracaditistici_ordinari_e_speciali_finale_Ed2.pdf>

### Wingsuit / groupes spécifiques
- Skydivemag, *Jump Run for Wingsuits* — <https://www.skydivemag.com/new/2017-08-31-jump-run-for-wingsuits/>
- USPA, *Wingsuit Progression Part Three* — <https://www.uspa.org/wingsuit-progression-part-three-a-wingsuit-skydive-from-start-to-finish-an-incomplete-guide>
- Squirrel, *WS Progression 2: Exits* — <https://squirrel.ws/learn/wingsuit-progression-2-exit-order/>

### Militaire (cadrage)
- AFMAN 11-231 CARP — <https://static.e-publishing.af.mil/production/1/af_a3/publication/afman11-231/afman11-231.pdf>
- FM 3-21.38 ch. 6 — <https://www.globalsecurity.org/military/library/policy/army/fm/3-21-38/ch6.htm>
- Consignes Particulières Parachutage (Noratlas de Provence) — <https://noratlas-de-provence.com/communication/105-3-consignes-particulieres-parachutage-au-01-04-16.html>
