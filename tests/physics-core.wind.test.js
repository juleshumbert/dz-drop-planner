'use strict';
// Tests : interpolation linéaire du profil vent (E/N), cache, accès couches.
// Le profil vent est un tableau de {z, spd (kt), dir (deg, FROM), temp, geoH}.

const test = require('node:test');
const assert = require('node:assert');
const PC = require('../physics-core.js');

function buildProfile() {
    // Vent calé pour Pamiers : sol calme, 1 km W léger, 4 km W modéré.
    // 10 m = niveau surface (Open-Meteo), pas z=0 car le modèle utilise un
    // log-profile (Prandtl) sous la 1ʳᵉ couche.
    return [
        { z: 10,   spd: 2,  dir: 270, temp: 20, geoH: 10   },
        { z: 1000, spd: 6,  dir: 280, temp: 13, geoH: 1000 },
        { z: 2000, spd: 12, dir: 285, temp: 7,  geoH: 2000 },
        { z: 4000, spd: 20, dir: 280, temp: -7, geoH: 4000 }
    ];
}

test('windAtZ matches surface layer at z=10 m', () => {
    PC.setWindProfile(buildProfile());
    const w = PC.windAtZ(10);
    const wKt = Math.sqrt(w.e * w.e + w.n * w.n) / PC.KT2MS;
    assert.ok(Math.abs(wKt - 2) < 0.5, `wind@10 = ${wKt}kt expected ~2`);
});

test('windAtZ uses log-profile below first layer (z=1m < z=10m bottom)', () => {
    PC.setWindProfile(buildProfile());
    const w = PC.windAtZ(1);
    const wKt = Math.sqrt(w.e * w.e + w.n * w.n) / PC.KT2MS;
    // log(1/0.03) / log(10/0.03) ≈ 0.60 → 60% du vent surface ≈ 1.2 kt
    assert.ok(wKt < 2, `wind@1m (${wKt}) < wind@10m (~2)`);
    assert.ok(wKt > 0, `wind@1m (${wKt}) > 0`);
});

test('windAtZ matches profile at exact altitude', () => {
    PC.setWindProfile(buildProfile());
    const w = PC.windAtZ(4000);
    const ws = Math.sqrt(w.e * w.e + w.n * w.n) / PC.KT2MS;
    assert.ok(Math.abs(ws - 20) < 0.5, `wind@4000 = ${ws}kt expected ~20`);
});

test('windAtZ interpolates linearly between layers', () => {
    PC.setWindProfile(buildProfile());
    const w = PC.windAtZ(1500); // entre 1000 (6kt) et 2000 (12kt) → ~9 kt
    const ws = Math.sqrt(w.e * w.e + w.n * w.n) / PC.KT2MS;
    assert.ok(Math.abs(ws - 9) < 1.0, `wind@1500 = ${ws}kt expected ~9`);
});

test('windAtZ clamps to top layer above ceiling', () => {
    PC.setWindProfile(buildProfile());
    const wTop = PC.windAtZ(4000);
    const wAbove = PC.windAtZ(5500);
    const sTop = Math.sqrt(wTop.e * wTop.e + wTop.n * wTop.n);
    const sAbove = Math.sqrt(wAbove.e * wAbove.e + wAbove.n * wAbove.n);
    assert.ok(Math.abs(sTop - sAbove) < 0.5, 'wind clamped to top layer');
});

test('windAtZ clamps to bottom layer below floor', () => {
    PC.setWindProfile(buildProfile());
    const wBot = PC.windAtZ(0);
    const wBelow = PC.windAtZ(-500);
    const sBot = Math.sqrt(wBot.e * wBot.e + wBot.n * wBot.n);
    const sBelow = Math.sqrt(wBelow.e * wBelow.e + wBelow.n * wBelow.n);
    assert.ok(Math.abs(sBot - sBelow) < 0.5, 'wind clamped to bottom');
});

test('windAtZ direction "FROM" : dir=270° → wind blowing toward EAST (positive ve)', () => {
    PC.setWindProfile([{ z: 1000, spd: 10, dir: 270, temp: 15, geoH: 1000 }]);
    const w = PC.windAtZ(1000);
    // wind FROM 270° = wind blowing TO 90° = positive E, ~zero N
    assert.ok(w.e > 4, `vE should be positive (${w.e})`);
    assert.ok(Math.abs(w.n) < 1, `vN should be near 0 (${w.n})`);
});

test('enableWindCache speeds up repeated windAtZ calls (smoke test, no perf assertion)', () => {
    PC.setWindProfile(buildProfile());
    PC.enableWindCache(5000);
    // Just check no throw + matches non-cached
    const w1 = PC.windAtZ(2500);
    const w2 = PC.windAtZ(2500);
    assert.ok(Math.abs(w1.e - w2.e) < 1e-9);
    assert.ok(Math.abs(w1.n - w2.n) < 1e-9);
});
