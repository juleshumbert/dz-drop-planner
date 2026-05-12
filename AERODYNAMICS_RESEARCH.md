# Aérodynamique du parachutisme — vitesses de chute, finesse sous voile, ouvertures, rentrée du long

*Compilation de recherche approfondie sur (1) comment la position du corps et la discipline pratiquée influent sur la vitesse du parachutiste dans l'air, (2) les finesses (glide ratio) mesurées des voiles sport modernes à partir des données constructeurs et des rapports de vol, (3) les caractéristiques d'ouverture des parachutes (séquence, efforts, durées), et (4) l'aérodynamique et les techniques pour rentrer d'un largage long. Les unités sont données en métrique et impérial lorsque la source les fournit.*

---

## Sommaire

1. [Comment la vitesse du parachutiste est mesurée](#1-comment-la-vitesse-du-parachutiste-est-mesurée)
2. [Vitesse en chute libre selon la discipline](#2-vitesse-en-chute-libre-selon-la-discipline)
3. [Vol sous voile — chiffres de référence](#3-vol-sous-voile--chiffres-de-référence)
4. [Finesse par classe de voile](#4-finesse-par-classe-de-voile)
5. [Caractéristiques d'ouverture](#5-caractéristiques-douverture)
6. [Rentrer d'un largage long](#6-rentrer-dun-largage-long)
7. [Glossaire français–anglais](#7-glossaire-françaisanglais)
8. [Sources](#8-sources)

---

## 1. Comment la vitesse du parachutiste est mesurée

Un parachutiste possède **trois vecteurs de vitesse distincts** et les confondre est la première source de confusion dans la littérature :

| Grandeur | Symbole ici | Définition | Mesure |
|---|---|---|---|
| Vitesse verticale (vitesse de chute) | `Vz` | Taux de descente dans la masse d'air | Altimètre barométrique Δh/Δt ; vitesse verticale GPS (FlySight, FlySight 2). Le speed skydiving score la moyenne sur la meilleure fenêtre de 3 s dans le créneau de compétition. |
| Vitesse horizontale air | `Vh` | Vitesse par rapport à la masse d'air (vent retiré) | Vitesse sol GPS **moins** le vecteur vent à l'altitude ; ou Pitot sur un rig wingsuit |
| Vitesse sol | `Vg` | Vitesse par rapport au sol | Sortie GPS directe |
| Finesse (glide ratio) | `GR = Vh / Vz` | Mètres horizontaux par mètre vertical | Le FlySight la diffuse en tonalité audio en temps réel ; égale au `L/D` à vitesse stabilisée |

Deux conséquences importantes :

- **La finesse mesurée au GPS est polluée par le vent.** Une wingsuit à 3:1 volée face à 30 kt de vent affiche un GR GPS de 1.5:1 alors que son `L/D` aérodynamique est inchangé. Les analyses sérieuses corrigent donc des vents en altitude.
- **La finesse maximale ne dépend pas du poids.** Un pilote lourd atteint le même `L/D` max, mais à une vitesse plus élevée — une voile très chargée ne pénètre pas automatiquement mieux face au vent qu'une voile peu chargée (voir section 6).

La discipline **FAI speed skydiving** formalise la mesure de la vitesse de chute : FlySight monté sur le casque, fenêtre de compétition sur 7 400 ft sous le point de sortie entre 13 000 et 14 000 ft, et le score est la vitesse verticale moyenne sur les trois meilleures secondes consécutives dans cette fenêtre.

---

## 2. Vitesse en chute libre selon la discipline

Toutes les valeurs sont des **vitesses verticales terminales** au niveau de la mer et en atmosphère standard sauf indication contraire, avec la vitesse horizontale air typique dans la même ligne. « Typique » signifie ce qu'un compétiteur actuel voit sur son logger ; la dispersion individuelle est importante.

| Discipline / position | Vitesse verticale | Vitesse horizontale air | Finesse (air) | Remarques |
|---|---|---|---|---|
| **Tandem sous drogue** | ~190 km/h / 120 mph | 0 | 0 | Le drogue restaure l'équilibre de Cd ; le binôme tombe comme un ventral solo |
| **Ventral (RW, FS, arch)** | **190–220 km/h / 115–135 mph** | ~0 | ~0 | Référence classique. Arch = le plus rapide en ventral ; dos creusé / boxman = le plus lent. Combinaisons freefly avec peaux ventrales au bas de la fourchette |
| **Sit-fly (tête en haut)** | **240–290 km/h / 150–180 mph** | 0–40 km/h | 0–0.2 | Surface frontale effective plus faible qu'en ventral |
| **Tête en bas (freefly)** | **240–300 km/h / 150–190 mph** | 0–40 km/h | 0–0.2 | Vitesse VFS standard ; les top pilotes dépassent 300 km/h en position « stand » |
| **Angle flying (atmonauti)** | ~220–260 km/h / 135–160 mph | 40–100 km/h | 0.4–0.8 | Inventé par Marco Tiezzi ; incidence ~45°, entre dérive et tête en bas |
| **Dérive (tracking, sans combi)** | **~145–175 km/h / 90–110 mph** | jusqu'à ~130 km/h | 0.6–0.9 | Dos creusé, jambes tendues, bras le long du corps |
| **Dérive en combi de tracking (ex. Squirrel Sumo 2)** | ~140–165 km/h / 85–100 mph | jusqu'à ~160 km/h / 100 mph | **~1:1** | Les meilleurs dériveurs parcourent autant au sol qu'en altitude perdue |
| **Wingsuit débutant (ex. Squirrel Swift)** | 120–170 km/h / 75–105 mph | 110–150 km/h / 70–95 mph | ~2:1 | Petite combi, pardonne les erreurs |
| **Wingsuit intermédiaire / polyvalente** | 90–150 km/h / 55–95 mph | 130–180 km/h / 80–110 mph | 2.5:1 | Pilote sport typique |
| **Wingsuit haute-performance** | 65–130 km/h / 40–80 mph | 180–260 km/h / 110–160 mph | **3:1 et plus (4:1 élite)** | Combis de compétition (Squirrel Aura, Colugo, Performance Designs Phoenix, classe Intrusion) |
| **Speed skydiving (position tuck de compétition)** | **480–540 km/h / 300–335 mph** | 0 | 0 | Combi profilée, mains au-dessus de la tête, sortie au-dessus de 13 000 ft pour atteindre la vitesse de record à basse densité. Record masculin FAI : Marco Hepp 529,77 km/h (2022, Eloy) ; Sebastian Garcia crédité de 539,51 km/h à la Coupe du Monde FAI d'août 2025 |
| **Sauts stratosphériques (Baumgartner, Eustace)** | jusqu'à **1 357,6 km/h / 843,6 mph** (Mach 1,25) | 0 | 0 | Hors discipline sport — supersonique car l'air est quasi absent à 39 km. Point de comparaison uniquement |

### Points physiques clés

- La vitesse terminale vient de $\tfrac{1}{2}\rho\,C_d\,A\,V^2 = m g$. La masse du sauteur étant fixée, tout dépend du produit `Cd × A` et de la masse volumique locale `ρ`.
- **En tête en bas, `A` diminue fortement** (surface frontale ≈ 0,6 m² en ventral vs ≈ 0,15 m² tête en bas) — d'où l'augmentation de ~50 % de la vitesse.
- **Une wingsuit augmente `A`** et surtout ajoute une composante de portance, convertissant une fraction de l'énergie cinétique verticale en énergie horizontale. Le terme vertical baisse car la suit génère une portance `L` qui compense une partie de `mg`.
- **La masse volumique de l'air est divisée par deux tous les ~7 km d'altitude.** C'est pour cela que les speed skydivers cherchent les hautes sorties : la vitesse terminale évolue en `1/√ρ`.
- Il faut ~10–12 s pour atteindre la terminale ventrale (~450 m de chute) ; en tête en bas on continue d'accélérer plusieurs secondes de plus, jusqu'à ce que la densité remonte au-dessous de ~4 000 m sol.

### Rôle du « travail » sur la vitesse de chute

La discipline — le *travail* effectué par le flyer — change le rôle aérodynamique du corps :

| Mode de travail | Comportement aérodynamique dominant |
|---|---|
| Ventral, tête en bas, sit | Pur **corps de traînée**. Vertical seul. `Vz = √(2 m g / (ρ Cd A))`. |
| Dérive (tracking) | **Corps portant à faible L/D**. Jambes et torse jouent le rôle d'une plaque cambrée ; `Cl/Cd ≈ 0,6–1,0`. |
| Wingsuit | **Aile cambrée** avec bras et jambes en ailes à grand allongement. `Cl/Cd` atteint 3–4. La performance dépend de la pression interne (bord d'attaque ram-air) et de la coupe. |
| Speed skydiving | **Corps axisymétrique profilé** qui minimise `Cd × A`. Tissus lisses, casque rigide, mains au-dessus de la tête. |

---

## 3. Vol sous voile — chiffres de référence

Sur les voiles sport modernes les **chiffres du premier ordre** sont remarquablement similaires une fois normalisés par la charge alaire :

- Vitesse horizontale en plein vol : **~40–55 km/h / 22–30 kt** à charge alaire ~1,0, évolution en √WL.
- Taux de chute en plein vol : **~4–6 m/s / 800–1 200 ft/min** à WL ~1,0.
- Finesse en plein vol : **≈ 2,5:1 à 3:1**, soit ~3 ft d'avance pour 1 ft de descente.
- Configuration de taux de chute minimum : **~50 % de freins** (meilleure endurance, ~2 m/s de descente sur un 9-caissons docile, proche du décrochage sur un cross-braced).
- Décrochage : dépend de la voile, généralement en dessous de ~50 % de la vitesse plein vol ; **la vitesse de décrochage croît en √WL**, donc les voiles chargées décrochent à une vitesse sol plus élevée.
- Arrondi (flare) : un arrondi bien exécuté produit 1 à 1,5 G de cabré et ramène le taux de chute à zéro depuis ~5 m/s en ~2 s. Les voiles modernes tirent l'essentiel de leur puissance d'arrondi **du changement d'angle d'incidence**, donc le meilleur arrondi part du plein vol, pas d'une position freinée.

**Règle empirique issue des essais en vol** (Brian Germain, *Parachute and its Pilot* ; repris sur skydive-safety.com) : *« La plupart des parachutes volent plus plat, et à peu près aussi vite, avec quelques centimètres d'élévateurs arrière ou environ un tiers de freins. »* C'est la base de la technique de rentrée du long en section 6.

### Vitesse de décrochage et charge alaire

Le coefficient de portance max `Cl,max` est une propriété fixe du profil ; la vitesse de décrochage `Vs = √(2·W/(ρ·S·Cl,max)) = √(2·WL/(ρ·Cl,max))`. Doubler la charge alaire augmente `Vs` d'environ √2 ≈ +41 %. Cela **réduit aussi la marge d'avertissement** avant décrochage — les voiles fortement chargées décrochent plus abruptement et avec moins de buffet.

---

## 4. Finesse par classe de voile

Les constructeurs de voiles sport publient rarement une finesse chiffrée, car elle dépend fortement de la charge alaire, de l'état de la suspente (usure), de la densité de l'air et des entrées pilote. Les formulations **qualitatives** publiées, combinées aux rapports d'essai en vol et au consensus communautaire, donnent l'image suivante.

| Classe de voile | WL typique | Finesse plein vol (vent nul) | Exemples |
|---|---|---|---|
| Précision / successeur du Para-Commander (7-caissons, F-111) | 0,6–0,8 | 2,3–2,8 | PD Navigator, Precision Falcon |
| 9-caissons docile, square ZP | 0,8–1,1 | **≈ 2,8–3,1** | PD Silhouette, Aerodyne Pilot, NZ Safire 3, PD Spectre |
| 9-caissons intermédiaire / semi-elliptique | 1,0–1,4 | 3,0–3,2 | PD Sabre 2 / Sabre 3, NZ Safire 3 à WL haute |
| 9-caissons pleinement elliptique | 1,2–1,6 | 3,1–3,3 | NZ Crossfire 3, PD Katana (WL modérée) |
| Voile cross-braced (swoop) | 1,8–2,5+ | 3,0–3,4 | PD Velocity / Comp Velocity, JFX 2, Leia, JPX Petra |
| Secours (7-caissons, F-111 ou ZP faible volume) | calée sur la principale | 2,0–2,8 | PD Reserve, Icarus Nano |
| Principale tandem (avec drogue) | 0,6–0,9 (poids tandem) | 2,5–2,8 | Sigma, Icarus Tandem |
| Voile BASE (7-caissons, F-111, hybride ZP) | 0,6–1,1 | 2,8–3,3 | Squirrel EPICENE, Apex FLiK |

**Lecture pratique.** Un vol de 1 000 ft / 300 m sous voile donne ~900 m de plané à 3:1, moins la composante vent de face. Cela correspond à ~35–45 s de vol à 7–9 m/s de descente. Avec 15 kt (7,7 m/s) de vent de face, l'essentiel de la vitesse avant est annulé et le pilote descend presque à la verticale au-dessus du sol — c'est le mécanisme qui transforme un « long dans le vent » en « DZ inatteignable ».

**9-caissons vs 7-caissons.** À surface égale, un 9-caissons a un allongement plus élevé (≈ 2,4 vs ≈ 2,1), donc une finesse plus plate et un arrondi plus long. Un 7-caissons s'ouvre plus souvent dans l'axe, se plie plus petit, est moins exposé aux line-over et récupère du décrochage de manière plus prévisible.

**Elliptique vs rectangulaire.** Le plan elliptique réduit la traînée induite aux extrémités et ajoute un peu de vitesse ; en contrepartie, réponse en roulis plus vive, virages plus rapides, arc de récupération plus long, et décrochage plus dur.

**Cross-bracing.** Le cross-bracing maintient le profil rigide sous facteur de charge ; il n'augmente pas significativement la finesse en vol stabilisé, mais permet au profil de conserver sa forme dans un virage serré, préservant le `L/D` dans la récupération et produisant le swoop long et peu traîné. Les pilotes de compétition atteignent ~95 mph (≈ 42 m/s) en entrée de gate (Greg Windmiller, 2,404 s sur 70 m, 2012).

### Finesse wingsuit pour comparaison

| Classe de wingsuit | Finesse typique soutenue |
|---|---|
| Débutant (Swift, Squirrel Corvid) | 1,8–2,2 |
| Intermédiaire (Colugo 3, Funk) | 2,3–2,7 |
| Performance / compétition (Aura 3, Freak 4, Intrusion) | 2,8–3,3 |
| Pilote élite en conditions optimales | 3,5–4,0+ (niveau record) |

---

## 5. Caractéristiques d'ouverture

### 5.1 Séquence

Un déploiement sport typique se déroule dans cet ordre, avec des durées approximatives :

1. **Annonce (wave-off) + extraction du pilote-chute** — 0,2–0,4 s.
2. **Gonflage du pilote-chute + extraction de la drisse** — 0,3–0,5 s.
3. **Arrachement du sac (d-bag), tension des suspentes** — 0,6–1,0 s. Les suspentes passent de stowed à tendues ; la voile est encore pliée.
4. **Snatch (tension-lignes)** — la voile est brusquement accélérée à la vitesse du sauteur. Durée < 1 s. Pic d'effort.
5. **Snivel (temporisation)** — le coulisseau freine le gonflage ; l'air entre par les bouches du bord d'attaque, la voile se gonfle à moitié. **3 à 6 s sur une voile sport moderne**, ~4 s en tandem, jusqu'à 10 s sur une voile BASE en brake-set.
6. **Gonflement complet** — le coulisseau descend, les caissons de bout se pressurisent, le pilote se « rassoit » dans le harnais. 0,5–1 s.

La durée totale de l'extraction au vol contrôlable est de **3 à 5 s, soit 200 à 300 m d'altitude perdus** entre le jet du pilote-chute et la voile pilotable.

### 5.2 Efforts

La littérature d'ingénierie parachute distingue deux pics de force :

| Pic | Origine | Ordre de grandeur |
|---|---|---|
| **Snatch force** (tension-lignes) | Les suspentes passent en tension ; la voile est accélérée du repos à la vitesse du sauteur. Impulsion très brève. | 3 à 6 G sur une voile sport moderne bien pliée (essais instrumentés PCPRG sur Stiletto 150) ; jusqu'à 15 G lors d'une ouverture rapide ou mal pliée |
| **Choc d'ouverture** | La voile se gonfle et décélère le sauteur depuis la terminale jusqu'à la vitesse sous voile. Étalé sur plusieurs secondes par la coupe slider / d-bag / ligne. | Généralement ≤ au snatch, mais sur 2–4 s. Données publiées sur systèmes militaires à 400 lb : jusqu'à ~15 G |

Facteurs qui durcissent une ouverture (à éviter) : vitesse de déploiement élevée (ouverture en tête en bas — la force est en `V²`), lignes croisées, pliage asymétrique, grommets de coulisseau usés, voile poreuse. Performance Designs annonce ~3 G pour une ouverture *propre* et ~6 G pour une ouverture *plus dure que la moyenne* aux vitesses habituelles.

### 5.3 Reefing — le coulisseau

Le coulisseau est un dispositif de freinage du gonflement : un panneau de tissu rectangulaire percé de quatre grommets, enfilé sur les suspentes, qui repose contre le dessous de la voile jusqu'au début du gonflage. Au fur et à mesure que les caissons s'ouvrent, le flux envergure fait descendre le coulisseau le long des suspentes ; le frottement entre grommets et suspentes limite la vitesse d'étalement et répartit le choc d'ouverture sur plusieurs secondes.

- Les **suspentes Dacron** génèrent plus de friction sur le coulisseau que les **Spectra (HMA)** — impulsion plus douce, mais rig plus lourd et durée de vie des suspentes réduite.
- Les délais < 3–4 s se font couramment **slider-down** (en BASE) ; au-delà, le coulisseau est indispensable.
- Les pilotes de swoop de compétition utilisent souvent un *slider-off pack + sac à stows lents + grand slider* pour régler l'ouverture.

### 5.4 Altitudes

Altitudes minimales d'ouverture USPA (sol) :

| Brevet | Altitude minimum d'ouverture |
|---|---|
| A | 3 000 ft / 914 m |
| B | 2 500 ft / 762 m |
| C, D | 2 000 ft / 610 m |

Règles USPA de séparation de groupe : ≥ 1 500 ft au-dessus de la plus haute altitude d'ouverture planifiée pour des groupes ≤ 5, ≥ 2 000 ft pour les groupes de 6 et plus. La séparation en wingsuit / tracking est typiquement 4 500–5 500 ft sol car la séparation horizontale exige des marges plus grandes.

### 5.5 Ouverture dans l'axe

Empiriquement, un 7-caissons s'ouvre plus souvent dans l'axe qu'un 9-caissons (moins d'affaissements des coins du bord d'attaque), et un plan rectangulaire plus souvent qu'un elliptique. La **symétrie du corps au moment de l'ouverture** est le principal facteur contrôlable : une position d'épaules asymétrique génère des tours de suspentes plus sûrement que le pliage lui-même.

---

## 6. Rentrer d'un largage long

Cette section combine l'aérodynamique du §3 et la technique terrain publiée (Pete Lubrano, Brian Germain, skydivemag, skydive-safety).

### 6.1 La physique

Soient `Vh` la vitesse horizontale air de la voile et `Vw` la composante vent le long de la trajectoire (positif = vent arrière). La vitesse sol vaut `Vg = Vh + Vw`. Le taux de chute est `Vz`. Le temps de vol depuis l'altitude `h` est `t = h / Vz`. La distance sol est donc :

```
D = t · Vg = (h / Vz) · (Vh + Vw)
           = h · (Vh / Vz) + h · (Vw / Vz)
           = h · GR_air + h · (Vw / Vz)
```

Deux configurations différentes maximisent `D` :

1. **Vent de face (`Vw < 0`).** Il faut `Vh/Vz` élevé **et** `Vh` élevé en valeur absolue pour pénétrer. C'est le régime **plein vol / léger élévateur arrière**.
2. **Vent arrière (`Vw > 0`).** Il faut rester le plus longtemps possible en l'air — `Vz` faible, même au détriment de `Vh`. C'est le régime **freins profonds / taux de chute minimum**.

La plupart des cas de largage long sport sont des cas vent de face (le sauteur s'est fait pousser sous le vent de la DZ). Donc le régime élévateurs arrière est la réponse usuelle.

### 6.2 Quoi faire concrètement

| Scénario | Configuration | Pourquoi |
|---|---|---|
| Long, sous le vent de la DZ, vent de face pour rentrer | **Freins hauts + 2–3 cm d'élévateur arrière** *ou* ~1/3 de freins, selon ce qui immobilise la cible sol | Maximise `Vh/Vz` ; les élévateurs arrière changent l'incidence sans coûter de vitesse ; au-delà de ~2–3 cm on décroche la voile et la portée *chute* |
| Long, au vent de la DZ, vent arrière pour rentrer | Freins hauts *ou* léger élévateur arrière | Vous n'êtes pas limité en distance, vous êtes limité en temps — n'importe quel régime à haut L/D fonctionne |
| Spot très profond, peu d'air pour travailler, vent fort | **~50 % de freins** | Taux de chute minimum ; achète du temps pour que le vent vous porte. Ne marche que si `|Vw| > Vh`, c'est-à-dire vent plus fort que la vitesse air |
| Vent de face fort, cas limite | Plein vol, **corps en boule** (jambes serrées, bras rentrés) | Réduit la traînée parasite ; +5 à 10 % de vitesse avant |

### 6.3 La règle des 2–3 cm d'élévateur arrière

Les élévateurs arrière augmentent l'angle d'incidence sans bouger le bord de fuite. Dans la plage linéaire, cela aplatit la finesse **sans coût en vitesse air** ; au-delà de l'incidence de décrochage la voile « parachute » et la portée s'effondre. Les recommandations publiées (skydive-safety.com, skydivemag) sont de tirer **2 à 3 cm par main**, pas plus.

**Pourquoi ne pas tirer plus fort ?** Le décrochage aux élévateurs arrière n'a pas l'avertissement du décrochage aux freins (pas de progression de commande à ressentir) ; une fois dépassé, vous descendez à la verticale. Sur une elliptique fortement chargée, la marge est de quelques centimètres.

### 6.4 Exemple numérique

Voile 9-caissons à WL 1,1, plein vol :

- `Vh ≈ 13 m/s` (25 kt)
- `Vz ≈ 5 m/s` (1 000 ft/min)
- `GR = 2,6`
- Ouverture à 800 m sol.

**Cas A — sans vent.** Distance sol `D = 800 · 2,6 = 2 080 m ≈ 1,12 NM`.

**Cas B — 10 kt de vent de face (`Vw = −5,1 m/s`).** Vitesse sol en plein vol = 13 − 5,1 = 7,9 m/s. Temps de vol = 800 / 5 = 160 s. `D = 160 · 7,9 = 1 264 m ≈ 0,68 NM`. Vous avez perdu près de 40 % de portée.

**Cas C — 10 kt de vent de face, 2 cm d'élévateur arrière.** Taux de chute tombe à ≈ 4,3 m/s (‑15 %), vitesse air quasi inchangée à ~13 m/s. Temps de vol = 800 / 4,3 = 186 s. Vitesse sol = 7,9 m/s. `D = 186 · 7,9 = 1 469 m ≈ 0,79 NM`. **+16 % de portée** par rapport au plein vol, assez pour éviter une posée extérieure proche.

**Cas D — 20 kt de vent de face (`Vw = −10,3 m/s`).** Vitesse sol plein vol = 2,7 m/s. Vous êtes quasiment en surplace. Le min-sink aux freins **ne rapporte rien ici** (le vent dépasse toujours votre vitesse air) ; choisissez le champ propre le plus proche.

### 6.5 Heuristiques de décision

- **Choisir un repère sol et le surveiller.** Le point qui ne bouge pas par rapport à votre voile est celui où vous allez atterrir si rien ne change. S'il est au-delà de la DZ, vous êtes long — restituez avec des freins ou des virages en S. S'il est en-deçà de la DZ, appliquez la technique de plané maximum et *n'y touchez plus*. L'erreur la plus fréquente en long spot est d'enchaîner des entrées et de perdre le repère.
- **L'altitude, c'est de l'argent ; dépensez-la proprement.** Chaque virage en S face au vent coûte ~50–100 m de portée avant.
- **Engager une posée extérieure à 1 000 ft sol.** Sous 1 000 ft, vous devez être aligné sur une posée propre, pas en train de chasser la DZ.
- **Arrondir depuis le plein vol, pas depuis les freins.** Si vous finissez le plané à 50 % de freins, relâchez les freins vers 100 ft pour reconstruire la vitesse nécessaire à l'arrondi.

### 6.6 Effet de la charge alaire sur le long spot

Contre-intuitivement, une **charge alaire plus élevée n'aide pas automatiquement à pénétrer**. Le `L/D` max est inchangé ; seule la vitesse à laquelle il est atteint augmente en `√WL`. Donc une voile chargée bat une voile peu chargée face à un vent fort (elle a plus de vitesse air à soustraire au vent), mais au prix d'une vitesse de décrochage plus élevée si on sur-freine à la fin, et d'une vitesse d'atterrissage bien plus élevée en cas de posée extérieure. La règle empirique de Brian Germain est qu'au-delà de WL ≈ 1,4 on ne gagne plus de portée en plané, on gagne seulement en taux de chute.

---

## 7. Glossaire français–anglais

| Français | English |
|---|---|
| Vitesse verticale, vitesse de chute | Fall rate / vertical speed |
| Finesse (de la voile), rapport plané | Glide ratio |
| Charge alaire | Wing loading |
| Ouverture douce (extraction progressive) | Snivel |
| Pic de tension-lignes | Snatch force |
| Choc d'ouverture | Opening shock |
| Coulisseau | Slider |
| Séparation | Break-off |
| Ouverture | Pull / deployment |
| Largage long, « rentrer du long » | Long spot |
| Élévateurs arrière | Rear risers |
| Freins / commandes | Brakes / toggles |
| Plein vol, bras hauts | Full flight |
| Taux de chute minimum | Min-sink |
| Plané maximum | Best glide |
| Dérive à plat | Track / tracking |
| Combinaison ailée | Wingsuit |
| Swoop, arrondi long | Swoop |
| Décrochage | Stall |

---

## 8. Sources

### FAI / fédérations
- [FAI — Speed Skydiving](https://fai.org/page/isc-speed-skydiving)
- [Guinness — Record de vitesse en speed skydiving (FAI, hommes)](https://www.guinnessworldrecords.com/world-records/675979-fastest-speed-in-speed-skydiving-fai-approved-male)
- [FAI — Index des records](https://www.fai.org/page/isc-records)
- [FAI news — recherche speed skydiving](https://www.fai.org/news/speed-skydiving-research-600kmh)
- [USPA — Head-Up Break-off](https://www.uspa.org/uspa-news/head-up-breakoff)
- [USPA Skydive School — CAT H (altitudes d'ouverture)](https://www.uspa.org/skydiveschool/h)
- [USPA — Collapsing a slider](https://www.uspa.org/collapsing-a-slider)

### Wikipédia
- [Tracking (skydiving)](https://en.wikipedia.org/wiki/Tracking_(skydiving))
- [Wingsuit flying](https://en.wikipedia.org/wiki/Wingsuit_flying)
- [Speed skydiving](https://en.wikipedia.org/wiki/Speed_skydiving)
- [Canopy piloting](https://en.wikipedia.org/wiki/Canopy_piloting)
- [Slider (parachuting)](https://en.wikipedia.org/wiki/Slider_(parachuting))
- [Lift-to-drag ratio](https://en.wikipedia.org/wiki/Lift-to-drag_ratio)
- [Felix Baumgartner](https://en.wikipedia.org/wiki/Felix_Baumgartner)

### Constructeurs / spécifications voiles
- [Performance Designs — Silhouette](https://www.performancedesigns.com/silhouette)
- [Performance Designs — Navigator](https://www.performancedesigns.com/navigator)
- [Performance Designs — Compare4](https://www.performancedesigns.com/compare4)
- [Performance Designs — Sabre2 Flight Characteristics PDF](https://www.performancedesigns.com/docs/Sabre2-Flight.pdf)
- [Performance Designs blog — Minimum opening altitude](https://blog.performancedesigns.com/determining-your-minimum-opening-altitude/)
- [Aerodyne — Pilot specs](https://www.flyaerodyne.com/canopies/pilot/pilot-specs/)
- [Aerodyne — Triathlon](http://atools.flyaerodyne.com/triathlon.asp)
- [NZ Aerosports / JYRO — Safire 3](https://www.jyro.com/product/safire-3/)
- [NZ Aerosports / JYRO — Crossfire 3](https://www.jyro.com/product/crossfire-3/)
- [NZ Aerosports / JYRO — Typologie des voiles](https://help.jyro.com/helpcentre/10545931798681-What-are-the-Different-Canopy-Types)
- [Squirrel — Sumo 2 (combi de tracking)](https://squirrel.ws/trackingsuits/sumo2/)

### Références aérodynamiques (Brian Germain, skydive-safety, PCPRG)
- [Basic aerodynamics of a ram-air parachute](https://www.skydive-safety.com/Articles-Basic-Aerodynamics.htm)
- [Ram-air flight](http://www.skydive-safety.com/Articles-Ram-Air-Flight.htm)
- [Ram-air design parameters](http://www.skydive-safety.com/Articles-Design-Parameters.htm)
- [Getting the most out of your parachute](http://www.skydive-safety.com/Articles-Getting-The-Most-Out-of-Your-Parachute.htm)
- [Survival skills for canopy control](http://skydive-safety.com/Articles-Survival-Skills.htm)
- [John LeBlanc sur la charge alaire et la haute performance (Skydivemag)](https://www.skydivemag.com/new/2018-04-27-wing-loading-and-high-performance/)
- [PCPRG — Canopy opening G-forces](https://www.pcprg.com/g-forces.htm)
- [PCPRG — Opening symposium output](https://www.pcprg.com/sym01out.htm)

### Technique « rentrer du long »
- [Skydivemag — You're long and aren't sure if you can make it back](https://www.skydivemag.com/new/youre-long-now-what/)
- [Skydive Temple — Making it back to the DZ](https://skydivetemple.com/Safety/Making-It-Back-To-The-DropZone.php)
- [Skydive Paraclete XP — The proper way to steer a parachute](https://skydiveparacletexp.com/2020/05/26/proper-way-steer-parachute/)
- [Skydivemag — Body language and deployment](https://www.skydivemag.com/new/2018-03-21-20131106-body-language/)

### Technique wingsuit
- [Human Bird Wings — Wingsuit glide ratio](https://humanbirdwings.net/wingsuit-glide-ratio/)
- [Human Bird Wings — How fast do wingsuits go?](https://humanbirdwings.net/how-fast-do-wingsuits-go/)
- [Wingsuit Wiki — Performance flying](http://wingsuitwiki.wikidot.com/performance-flying)
- [JAFM — Aerodynamic and RSM analysis of wingsuit stability (PDF)](https://www.jafmonline.net/article_2307_fcf4c420950f2b8f7638cd6ce8f7e671.pdf)

### FlySight / mesure
- [FlySight — Configuring FlySight](https://flysight.ca/wiki/index.php/Configuring_FlySight)
- [Apex BASE — FlySight 2](https://apexbase.com/product/fly-sight-2-gps-for-base-and-skydiving/)

### Articles vulgarisation DZ (vitesses et terminale)
- [Skydive Perris — Terminal velocity explained](https://skydiveperris.com/blog/terminal-velocity-in-skydiving-explained/)
- [Skydive California — Terminal velocity of a skydiver](https://skydivecalifornia.com/blog/terminal-velocity-skydiving/)
- [Skydive Monroe — Skydiving velocity and freefall speed](https://skydivemonroe.com/blog/skydiving-velocity-freefall-speed/)
- [Skydive Carolina — How fast is skydiving?](https://www.skydivecarolina.com/blog/how-fast-is-skydiving/)
- [Wisconsin Skydiving Center — How fast do you fall?](https://wisconsinskydivingcenter.com/blog/how-fast-do-you-fall-when-skydiving/)
- [Skydive Perris — What is angle flying?](https://skydiveperris.com/blog/what-is-angle-flying/)
- [Skydive Carolina — What is angle flying?](https://www.skydivecarolina.com/blog/what-is-angle-flying/)
- [Skydive Arizona — Tracking / angle flying PDF](https://www.skydiveaz.com/wp-content/uploads/2024/07/tracking-or-angle-flying-jumps.pdf)
- [USPA — Foundations of Flight: Angle Flying](https://www.uspa.org/foundations-of-flight-angle-flyinghead-first-on-belly)

---

*Compilé le 2026-04-24 pour le projet DZ Drop Planner. Les valeurs numériques sont représentatives d'une population ; l'équipement individuel, la morphologie et les conditions atmosphériques décalent chaque ligne de ±10 à 20 %.*
