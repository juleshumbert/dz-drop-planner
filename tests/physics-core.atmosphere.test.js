'use strict';
// Tests : modèle d'atmosphère ISA, densité, correction altitude, TAS.
// Le modèle est documenté dans SCIENCE.md §2.

const test = require('node:test');
const assert = require('node:assert');
const PC = require('../physics-core.js');

test('getDensity returns ISA standard at sea level (1.225 kg/m³ ± 1%)', () => {
    const rho = PC.getDensity(0, 0);
    assert.ok(Math.abs(rho - 1.225) < 0.013, `rho=${rho} expected ~1.225`);
});

test('getDensity decreases with altitude (4000 m < sea level)', () => {
    const rhoSL = PC.getDensity(0, 0);
    const rho4k = PC.getDensity(4000, 0);
    assert.ok(rho4k < rhoSL, `rho@4km (${rho4k}) should be < rho@SL (${rhoSL})`);
    assert.ok(rho4k > 0.7, `rho@4km (${rho4k}) should be > 0.7 (ISA = ~0.819)`);
    assert.ok(rho4k < 0.9, `rho@4km (${rho4k}) should be < 0.9`);
});

test('getDensity at FL140 (4267 m) is around 0.81 kg/m³', () => {
    const rho = PC.getDensity(4267, 0);
    assert.ok(Math.abs(rho - 0.81) < 0.05, `rho@FL140=${rho} expected ~0.81`);
});

test('densityCorrection = √(ρ0/ρ) > 1 at altitude (factor used to scale IAS → TAS)', () => {
    const factor = PC.densityCorrection(4000, 0);
    assert.ok(factor > 1.0, `factor (${factor}) > 1 since rho@altitude < rho_0`);
    assert.ok(factor < 1.5, `factor (${factor}) < 1.5 at 4 km`);
    assert.ok(Math.abs(PC.densityCorrection(0, 0) - 1.0) < 0.01, 'factor=1 at sea level standard');
});

test('ISA delta hot (+15°C) reduces density vs standard at same altitude', () => {
    const rhoStd = PC.getDensity(4000, 0);
    const rhoHot = PC.getDensity(4000, 15);
    assert.ok(rhoHot < rhoStd, 'hotter air should be less dense at same alt');
});

test('computeTAS at sea level standard ≈ IAS', () => {
    const ias_ms = 60;  // ~120 kt
    const tas = PC.computeTAS(ias_ms, 0, 0);
    // At ISA SL, density ratio = 1, so TAS ≈ IAS
    assert.ok(Math.abs(tas - ias_ms) < 0.5, `TAS@SL (${tas}) ≈ IAS (${ias_ms})`);
});

test('computeTAS at FL140 > IAS by ~20%', () => {
    const ias_ms = 60;
    const tas = PC.computeTAS(ias_ms, 4267, 0);
    const ratio = tas / ias_ms;
    assert.ok(ratio > 1.15 && ratio < 1.30, `TAS/IAS@FL140 = ${ratio.toFixed(2)} (expect ~1.20)`);
});

test('Constants are correctly exposed', () => {
    assert.ok(Math.abs(PC.KT2MS - 0.514444) < 1e-6, 'KT→m/s conversion');
    assert.strictEqual(PC.NM2M, 1852, 'NM→m conversion');
    assert.ok(Math.abs(PC.DEG2RAD - Math.PI / 180) < 1e-9, 'DEG2RAD');
    assert.ok(PC.G > 9.7 && PC.G < 9.9, 'gravity ~9.81');
    assert.strictEqual(PC.RHO0, 1.225, 'sea-level density');
});
