// Auto-extrait depuis flight_statistics/dashboards/jump_weather_clusters/data.js
// Clusters K-means de profils vent opérationnels au DZ Pamiers (LFDJ).
// 1421 demi-journées entre 2021-04-15 et 2026-04-24.
window.JUMP_WX_CLUSTERS = {
 "generated_at": "2026-04-30T22:39:36",
 "n_sessions_total": 1421,
 "date_min": "2021-04-15",
 "date_max": "2026-04-24",
 "k": 6,
 "pressure_levels": [
  950,
  925,
  900,
  850,
  800,
  700,
  600
 ],
 "geopotential_median": {
  "950hPa": 591.0,
  "925hPa": 818.0,
  "900hPa": 1051.0,
  "850hPa": 1533.0,
  "800hPa": 2038.0,
  "700hPa": 3134.0,
  "600hPa": 4362.0
 },
 "clusters": [
  {
   "cluster": 0,
   "label": "4 km W modéré (15 kt) · 1 km NW faible (6 kt) · sol calme (2 kt) · léger virement",
   "n_sessions": 439,
   "qnh": 1017.6,
   "temp2m": 20.8,
   "cloud_total": 44.0,
   "cloud_low": 14.0,
   "cloud_mid": 11.0,
   "cloud_high": 29.0,
   "gusts_p90": 15.0,
   "wind_profile": [
    {
     "level": "10m",
     "z": 10,
     "speed_kt": 2.43,
     "dir_deg": 327.3,
     "temp_c": 20.8,
     "hpa": null
    },
    {
     "level": "950hPa",
     "z": 591.0,
     "speed_kt": 3.22,
     "dir_deg": 326.9,
     "temp_c": 18.5,
     "hpa": 950
    },
    {
     "level": "925hPa",
     "z": 818.0,
     "speed_kt": 3.82,
     "dir_deg": 315.0,
     "temp_c": 16.9,
     "hpa": 925
    },
    {
     "level": "900hPa",
     "z": 1051.0,
     "speed_kt": 4.58,
     "dir_deg": 304.8,
     "temp_c": 15.3,
     "hpa": 900
    },
    {
     "level": "850hPa",
     "z": 1533.0,
     "speed_kt": 6.18,
     "dir_deg": 290.0,
     "temp_c": 12.4,
     "hpa": 850
    },
    {
     "level": "800hPa",
     "z": 2038.0,
     "speed_kt": 8.36,
     "dir_deg": 282.7,
     "temp_c": 9.8,
     "hpa": 800
    },
    {
     "level": "700hPa",
     "z": 3134.0,
     "speed_kt": 12.5,
     "dir_deg": 281.3,
     "temp_c": 3.1,
     "hpa": 700
    },
    {
     "level": "600hPa",
     "z": 4362.0,
     "speed_kt": 14.54,
     "dir_deg": 285.9,
     "temp_c": -4.7,
     "hpa": 600
    }
   ],
   "sol_speed_kt": 2.4,
   "sol_dir_deg": 327.0,
   "wind_1km_speed_kt": 5.5,
   "wind_1km_dir_deg": 295.0,
   "exit_speed_kt": 14.5,
   "exit_dir_deg": 286.0,
   "shear_speed_kt": 9.1,
   "meteo_description": {
    "title": "Tramontane / dorsale anticyclonique post-frontale",
    "paragraph": "L'anticyclone se reforme au nord-ouest après le passage d'une perturbation atlantique. QNH 1018 hPa (+4.3 / 1013). Le ciel se dégage par subsidence (44 %). Le flux est cohérent du sol (NW 2 kt) à 4 km (NW 15 kt), avec une homogénéité directionnelle excellente (R̄ 4 km = 0.93). Cohérence sol↔4 km +0.75 — pas de cisaillement, le drift sous voile suit celui en chute. Conditions opérationnelles franches mais avec un vent au sol qui peut être pénible pour la finale si le sol monte au-delà de 12 kt.",
    "season_hint": "aoû (20 %), jun (14 %), jul (13 %)",
    "tags": [
     "tramontane",
     "post-frontal-NW",
     "flux-aligné"
    ]
   }
  },
  {
   "cluster": 1,
   "label": "4 km SE faible (6 kt) · 1 km calme (2 kt) · sol calme (3 kt) · cisaillement ⚠",
   "n_sessions": 231,
   "qnh": 1019.8,
   "temp2m": 19.2,
   "cloud_total": 34.0,
   "cloud_low": 7.0,
   "cloud_mid": 8.0,
   "cloud_high": 26.0,
   "gusts_p90": 16.5,
   "wind_profile": [
    {
     "level": "10m",
     "z": 10,
     "speed_kt": 2.91,
     "dir_deg": 79.0,
     "temp_c": 19.2,
     "hpa": null
    },
    {
     "level": "950hPa",
     "z": 591.0,
     "speed_kt": 4.25,
     "dir_deg": 85.2,
     "temp_c": 17.2,
     "hpa": 950
    },
    {
     "level": "925hPa",
     "z": 818.0,
     "speed_kt": 3.61,
     "dir_deg": 94.6,
     "temp_c": 16.2,
     "hpa": 925
    },
    {
     "level": "900hPa",
     "z": 1051.0,
     "speed_kt": 2.35,
     "dir_deg": 101.6,
     "temp_c": 15.1,
     "hpa": 900
    },
    {
     "level": "850hPa",
     "z": 1533.0,
     "speed_kt": 1.01,
     "dir_deg": 134.1,
     "temp_c": 12.5,
     "hpa": 850
    },
    {
     "level": "800hPa",
     "z": 2038.0,
     "speed_kt": 1.36,
     "dir_deg": 169.6,
     "temp_c": 9.6,
     "hpa": 800
    },
    {
     "level": "700hPa",
     "z": 3134.0,
     "speed_kt": 3.5,
     "dir_deg": 164.2,
     "temp_c": 2.3,
     "hpa": 700
    },
    {
     "level": "600hPa",
     "z": 4362.0,
     "speed_kt": 5.51,
     "dir_deg": 147.3,
     "temp_c": -5.7,
     "hpa": 600
    }
   ],
   "sol_speed_kt": 2.9,
   "sol_dir_deg": 79.0,
   "wind_1km_speed_kt": 1.5,
   "wind_1km_dir_deg": 114.0,
   "exit_speed_kt": 5.5,
   "exit_dir_deg": 147.0,
   "shear_speed_kt": 4.3,
   "meteo_description": {
    "title": "Marais barométrique — pas de système synoptique marqué",
    "paragraph": "Pas de gradient de pression marqué sur le SW : QNH 1020 hPa (+6.6 / 1013). Vents faibles à toutes altitudes (4 km 6 kt, sol 3 kt). La direction reflète des brises locales (autan résiduel d'E/SE, ou retour de mer rétrogradant) plutôt qu'un flux synoptique. Conditions calmes, idéales pour le saut, souvent matinales avant que la convection thermique se développe. Couverture 34 %.",
    "season_hint": "mai (13 %), sep (12 %), fév (11 %)",
    "tags": [
     "marais-barométrique",
     "calme",
     "brises-locales"
    ]
   }
  },
  {
   "cluster": 2,
   "label": "4 km SW soutenu (25 kt) · 1 km calme (2 kt) · sol calme (3 kt) · inversion ⚠⚠",
   "n_sessions": 213,
   "qnh": 1011.6,
   "temp2m": 21.6,
   "cloud_total": 66.0,
   "cloud_low": 15.0,
   "cloud_mid": 25.0,
   "cloud_high": 47.0,
   "gusts_p90": 19.6,
   "wind_profile": [
    {
     "level": "10m",
     "z": 10,
     "speed_kt": 2.69,
     "dir_deg": 63.0,
     "temp_c": 21.6,
     "hpa": null
    },
    {
     "level": "950hPa",
     "z": 591.0,
     "speed_kt": 4.49,
     "dir_deg": 74.3,
     "temp_c": 19.5,
     "hpa": 950
    },
    {
     "level": "925hPa",
     "z": 818.0,
     "speed_kt": 4.23,
     "dir_deg": 84.6,
     "temp_c": 18.2,
     "hpa": 925
    },
    {
     "level": "900hPa",
     "z": 1051.0,
     "speed_kt": 2.97,
     "dir_deg": 97.2,
     "temp_c": 16.9,
     "hpa": 900
    },
    {
     "level": "850hPa",
     "z": 1533.0,
     "speed_kt": 2.27,
     "dir_deg": 168.8,
     "temp_c": 14.3,
     "hpa": 850
    },
    {
     "level": "800hPa",
     "z": 2038.0,
     "speed_kt": 5.89,
     "dir_deg": 207.1,
     "temp_c": 11.2,
     "hpa": 800
    },
    {
     "level": "700hPa",
     "z": 3134.0,
     "speed_kt": 16.95,
     "dir_deg": 221.9,
     "temp_c": 3.4,
     "hpa": 700
    },
    {
     "level": "600hPa",
     "z": 4362.0,
     "speed_kt": 24.79,
     "dir_deg": 229.1,
     "temp_c": -5.0,
     "hpa": 600
    }
   ],
   "sol_speed_kt": 2.7,
   "sol_dir_deg": 63.0,
   "wind_1km_speed_kt": 2.0,
   "wind_1km_dir_deg": 145.0,
   "exit_speed_kt": 24.8,
   "exit_dir_deg": 229.0,
   "shear_speed_kt": 24.7,
   "meteo_description": {
    "title": "Régime d'autan classique avec dépression au sud-ouest",
    "paragraph": "Une dépression centrée sur le golfe de Gascogne ou le nord de l'Espagne (QNH 1012 hPa, -1.6 hPa par rapport à 1013 hPa standard) creuse un gradient ouest→est qui canalise un flux de SE en surface dans le couloir du Lauragais (Carcassonne–Toulouse) : c'est l'**autan**, sol 3 kt @ 63°. Au-dessus de la couche d'autan (~1 km), le flux s'aligne sur la circulation cyclonique : SW 25 kt à 4 km. La cohérence sol↔4 km est négative (-0.97) — signature opérationnelle classique de cisaillement vertical : la dérive en chute (SW) est presque opposée à celle sous voile (E). Par ciel à 66 %, l'autan peut être 'blanc' (sec, dégagé, anticyclone à l'E) ou 'noir' (humide, front en approche).",
    "season_hint": "jun (19 %), sep (17 %), jul (14 %)",
    "tags": [
     "autan",
     "inversion",
     "dépression-gascogne"
    ]
   }
  },
  {
   "cluster": 3,
   "label": "4 km W fort (35 kt) · 1 km W faible (4 kt) · sol calme (2 kt) · cisaillement ⚠",
   "n_sessions": 193,
   "qnh": 1014.9,
   "temp2m": 19.7,
   "cloud_total": 55.0,
   "cloud_low": 19.0,
   "cloud_mid": 17.0,
   "cloud_high": 35.0,
   "gusts_p90": 16.9,
   "wind_profile": [
    {
     "level": "10m",
     "z": 10,
     "speed_kt": 1.63,
     "dir_deg": 342.7,
     "temp_c": 19.7,
     "hpa": null
    },
    {
     "level": "950hPa",
     "z": 591.0,
     "speed_kt": 2.02,
     "dir_deg": 358.9,
     "temp_c": 17.8,
     "hpa": 950
    },
    {
     "level": "925hPa",
     "z": 818.0,
     "speed_kt": 1.96,
     "dir_deg": 340.3,
     "temp_c": 16.3,
     "hpa": 925
    },
    {
     "level": "900hPa",
     "z": 1051.0,
     "speed_kt": 2.31,
     "dir_deg": 315.8,
     "temp_c": 14.7,
     "hpa": 900
    },
    {
     "level": "850hPa",
     "z": 1533.0,
     "speed_kt": 4.29,
     "dir_deg": 274.5,
     "temp_c": 12.1,
     "hpa": 850
    },
    {
     "level": "800hPa",
     "z": 2038.0,
     "speed_kt": 8.69,
     "dir_deg": 254.3,
     "temp_c": 9.8,
     "hpa": 800
    },
    {
     "level": "700hPa",
     "z": 3134.0,
     "speed_kt": 21.61,
     "dir_deg": 253.8,
     "temp_c": 3.4,
     "hpa": 700
    },
    {
     "level": "600hPa",
     "z": 4362.0,
     "speed_kt": 35.17,
     "dir_deg": 264.4,
     "temp_c": -4.4,
     "hpa": 600
    }
   ],
   "sol_speed_kt": 1.6,
   "sol_dir_deg": 343.0,
   "wind_1km_speed_kt": 3.6,
   "wind_1km_dir_deg": 284.0,
   "exit_speed_kt": 35.2,
   "exit_dir_deg": 264.0,
   "shear_speed_kt": 31.8,
   "meteo_description": {
    "title": "Branche sud du jet polaire au-dessus d'une couche limite stable",
    "paragraph": "Le jet polaire descend en latitude (régime hivernal ou d'équinoxe) et balaie le sud de la France à 35 kt à 4 km, secteur W. La basse couche est découplée par une inversion thermique de subsidence ou de rayonnement nocturne (sol 2 kt @ 343°, T 19.7 °C). Cisaillement vertical fort mais flux d'altitude bien orienté W : un freefall extrêmement porteur vers l'E, à compenser par un point d'exit franchement à l'ouest de la DZ. Cohérence sol↔4 km +0.20.",
    "season_hint": "jul (34 %), mai (9 %), jun (9 %)",
    "tags": [
     "jet-polaire",
     "inversion-stable",
     "spotting-sensible"
    ]
   }
  },
  {
   "cluster": 4,
   "label": "4 km N soutenu (18 kt) · 1 km NW modéré (11 kt) · sol NW faible (5 kt) · cisaillement ⚠",
   "n_sessions": 185,
   "qnh": 1023.5,
   "temp2m": 16.2,
   "cloud_total": 33.0,
   "cloud_low": 18.0,
   "cloud_mid": 8.0,
   "cloud_high": 12.0,
   "gusts_p90": 17.6,
   "wind_profile": [
    {
     "level": "10m",
     "z": 10,
     "speed_kt": 5.21,
     "dir_deg": 305.0,
     "temp_c": 16.2,
     "hpa": null
    },
    {
     "level": "950hPa",
     "z": 591.0,
     "speed_kt": 7.63,
     "dir_deg": 298.1,
     "temp_c": 13.6,
     "hpa": 950
    },
    {
     "level": "925hPa",
     "z": 818.0,
     "speed_kt": 9.42,
     "dir_deg": 294.6,
     "temp_c": 12.1,
     "hpa": 925
    },
    {
     "level": "900hPa",
     "z": 1051.0,
     "speed_kt": 10.64,
     "dir_deg": 292.7,
     "temp_c": 10.6,
     "hpa": 900
    },
    {
     "level": "850hPa",
     "z": 1533.0,
     "speed_kt": 11.02,
     "dir_deg": 295.9,
     "temp_c": 7.8,
     "hpa": 850
    },
    {
     "level": "800hPa",
     "z": 2038.0,
     "speed_kt": 10.37,
     "dir_deg": 315.7,
     "temp_c": 5.4,
     "hpa": 800
    },
    {
     "level": "700hPa",
     "z": 3134.0,
     "speed_kt": 13.43,
     "dir_deg": 2.4,
     "temp_c": 0.5,
     "hpa": 700
    },
    {
     "level": "600hPa",
     "z": 4362.0,
     "speed_kt": 17.84,
     "dir_deg": 12.3,
     "temp_c": -6.3,
     "hpa": 600
    }
   ],
   "sol_speed_kt": 5.2,
   "sol_dir_deg": 305.0,
   "wind_1km_speed_kt": 10.9,
   "wind_1km_dir_deg": 294.0,
   "exit_speed_kt": 17.8,
   "exit_dir_deg": 12.0,
   "shear_speed_kt": 18.9,
   "meteo_description": {
    "title": "Advection d'air polaire / régime de N",
    "paragraph": "Une dépression méditerranéenne (golfe de Gênes, par exemple) couplée à un anticyclone sur les îles britanniques canalise un flux de N à NE sur la France. À LFDJ, cela donne un flux de N à 4 km (18 kt @ 12°) avec un sol 5 kt @ 305°. Régime peu fréquent (~10–15 % des sauts) mais marquant : air froid, ciel souvent dégagé (33 %), T 16.2 °C. Spotting et axe de largage doivent être basculés (pas l'axe d'ouest habituel).",
    "season_hint": "mai (22 %), fév (12 %), jul (12 %)",
    "tags": [
     "flux-N",
     "advection-froide"
    ]
   }
  },
  {
   "cluster": 5,
   "label": "4 km NW fort (31 kt) · 1 km W soutenu (16 kt) · sol NW faible (6 kt) · flux aligné ✓",
   "n_sessions": 160,
   "qnh": 1020.5,
   "temp2m": 15.7,
   "cloud_total": 54.0,
   "cloud_low": 31.0,
   "cloud_mid": 13.0,
   "cloud_high": 20.0,
   "gusts_p90": 21.2,
   "wind_profile": [
    {
     "level": "10m",
     "z": 10,
     "speed_kt": 5.99,
     "dir_deg": 300.0,
     "temp_c": 15.7,
     "hpa": null
    },
    {
     "level": "950hPa",
     "z": 591.0,
     "speed_kt": 9.27,
     "dir_deg": 291.8,
     "temp_c": 13.5,
     "hpa": 950
    },
    {
     "level": "925hPa",
     "z": 818.0,
     "speed_kt": 11.77,
     "dir_deg": 290.5,
     "temp_c": 11.8,
     "hpa": 925
    },
    {
     "level": "900hPa",
     "z": 1051.0,
     "speed_kt": 14.11,
     "dir_deg": 289.0,
     "temp_c": 10.2,
     "hpa": 900
    },
    {
     "level": "850hPa",
     "z": 1533.0,
     "speed_kt": 17.46,
     "dir_deg": 287.0,
     "temp_c": 7.2,
     "hpa": 850
    },
    {
     "level": "800hPa",
     "z": 2038.0,
     "speed_kt": 19.78,
     "dir_deg": 290.2,
     "temp_c": 4.7,
     "hpa": 800
    },
    {
     "level": "700hPa",
     "z": 3134.0,
     "speed_kt": 24.61,
     "dir_deg": 308.2,
     "temp_c": -0.1,
     "hpa": 700
    },
    {
     "level": "600hPa",
     "z": 4362.0,
     "speed_kt": 30.73,
     "dir_deg": 316.2,
     "temp_c": -6.1,
     "hpa": 600
    }
   ],
   "sol_speed_kt": 6.0,
   "sol_dir_deg": 300.0,
   "wind_1km_speed_kt": 16.1,
   "wind_1km_dir_deg": 288.0,
   "exit_speed_kt": 30.7,
   "exit_dir_deg": 316.0,
   "shear_speed_kt": 18.2,
   "meteo_description": {
    "title": "Tramontane / dorsale anticyclonique post-frontale",
    "paragraph": "L'anticyclone se reforme au nord-ouest après le passage d'une perturbation atlantique. QNH 1021 hPa (+7.3 / 1013). Le ciel se dégage par subsidence (54 %). Le flux est cohérent du sol (NW 6 kt) à 4 km (NW 31 kt), avec une homogénéité directionnelle excellente (R̄ 4 km = 0.95). Cohérence sol↔4 km +0.96 — pas de cisaillement, le drift sous voile suit celui en chute. Conditions opérationnelles franches mais avec un vent au sol qui peut être pénible pour la finale si le sol monte au-delà de 12 kt.",
    "season_hint": "jul (16 %), aoû (16 %), avr (13 %)",
    "tags": [
     "tramontane",
     "post-frontal-NW",
     "flux-aligné"
    ]
   }
  }
 ]
};
