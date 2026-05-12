'use strict';
// Tests : intégrateurs RK4 / RK2, simulation freefall, opening, canopy.
// Référence physique : SCIENCE.md §4 (deriv), §6 (simFreefall),
// §7 (simOpening), §8 (simCanopy).

const test = require('node:test');
const assert = require('node:assert');
const PC = require('../physics-core.js');

function calmWind() {
    return [{ z: 10, spd: 0, dir: 0, temp: 15, geoH: 10 },
            { z: 4500, spd: 0, dir: 0, temp: 0, geoH: 4500 }];
}

test('rk4 single step converges toward terminal velocity for a steady state', () => {
    PC.setWindProfile(calmWind());
    // State at terminal velocity in calm air should be a fixed point in vertical.
    // s = [E, N, z, vE, vN, vz] with vz < 0 (descent). At terminal vz_term ≈ -vT.
    const vT = 50;  // m/s (belly)
    const s0 = [0, 0, 4000, 0, 0, -vT];  // at terminal
    const sNext = PC.rk4(s0, 0.25, vT, 0);
    // Vertical speed should remain near -vT
    assert.ok(Math.abs(sNext[5] + vT) < 1.5, `vz drift from -vT: ${sNext[5] + vT}`);
    // Altitude drops by ~vT * dt
    const dz = sNext[2] - s0[2];
    assert.ok(Math.abs(dz - (-vT * 0.25)) < 2, `dz=${dz}, expected ~${-vT * 0.25}`);
});

test('simFreefall : freefall from 4000m to 1000m takes ~60s for vT=50m/s', () => {
    PC.setWindProfile(calmWind());
    // Drop from FL140 (~4267 m) opening at 1000 m AGL (no elev offset)
    const s0 = [0, 0, 4267, 0, 0, 0];  // start at rest
    const res = PC.simFreefall(s0, 50, 1000, 0, 0, 0.25, null);
    // Should reach z = 1000 after ~60-70s (with init transient + ground accel)
    assert.ok(res.tEnd > 55 && res.tEnd < 90, `tEnd=${res.tEnd}, expected 55-90s`);
    assert.ok(Math.abs(res.fs[2] - 1000) < 1, `final z=${res.fs[2]}`);
    // sp (snapshots) has positive length
    assert.ok(res.sp.length > 0, 'snapshots non-empty');
});

test('simFreefall : with wind, jumper drifts downwind', () => {
    PC.setWindProfile([
        { z: 10, spd: 10 / PC.KT2MS / 0.514444 * 0.514444 / PC.KT2MS, dir: 270, temp: 15, geoH: 10 },
        { z: 4500, spd: 10, dir: 270, temp: 0, geoH: 4500 }  // 10 kt from west
    ]);
    const s0 = [0, 0, 4000, 0, 0, 0];
    const res = PC.simFreefall(s0, 50, 1000, 0, 0, 0.25, null);
    // Wind from west → drift to east → positive E
    assert.ok(res.fs[0] > 100, `E drift = ${res.fs[0]}, expected > 100m`);
});

test('simOpening : starting at terminal velocity ends with canopy steady', () => {
    PC.setWindProfile(calmWind());
    // Opening starts at hOuv = 1000 m AGL, with terminal velocity
    const vc = 50;       // freefall vT
    const vzVoile = 5.0; // canopy descent rate
    const s0 = [0, 0, 1000, 0, 0, -vc];
    const res = PC.simOpening(s0, vc, vzVoile, 0, 0, 0.1);
    // After opening, vz should be near -vzVoile (= -5 m/s)
    assert.ok(Math.abs(res.fs[5] + vzVoile) < 1, `vz=${res.fs[5]}, expected ~${-vzVoile}`);
    // Horizontal speed near 0 (no command, in calm)
    const vh = Math.sqrt(res.fs[3] * res.fs[3] + res.fs[4] * res.fs[4]);
    assert.ok(vh < 5, `horizontal speed after opening=${vh}, should be near 0`);
});

test('simCanopy : descends from opening to ground', () => {
    PC.setWindProfile(calmWind());
    const vzVoile = 5.0;
    const glide = 2.5;
    const s0 = [0, 0, 1000, 0, 0, -vzVoile];
    // No steering (steerFn returns null) → drifts straight down with wind
    const steerFn = function () { return { targetHeading: 0 }; };
    const res = PC.simCanopy(s0, vzVoile, glide, 0, 0, steerFn, null, { dt: 0.5 });
    // Final altitude should be at or just below 0
    assert.ok(res.fs[2] <= 5, `final alt=${res.fs[2]} expected ≤ ~ground`);
    assert.ok(res.grounded, 'should be grounded');
});

test('simJumper : full belly jump from FL140 lands within 5 km of exit (calm)', () => {
    PC.setWindProfile(calmWind());
    const env = {
        exitE: 0, exitN: 0,
        altM: 4267, elevM: 0, isa: 0,
        gsE: 50, gsN: 0,  // plane GS = 50 m/s east
        axeDeg: 90, trackE: 1, trackN: 0
    };
    const jp = { vc: 50, vzVoile: 5, glide: 2.5, hOuv: 1000, hBreak: 1500, skill: 0.8 };
    // Trivial steer : aim at exit point
    const steer = function () { return { targetHeading: 0 }; };
    const r = PC.simJumper(jp, env, null, steer, undefined, 0);
    const landDist = Math.sqrt(r.finalState[0] ** 2 + r.finalState[1] ** 2);
    assert.ok(landDist < 5000, `landing dist ${landDist}m > 5km`);
    assert.ok(r.finalState[2] < 100, `final alt ${r.finalState[2]} should be near ground`);
});

test('classifyJumper : tandem detected by name', () => {
    assert.strictEqual(PC.classifyJumper({ name: 'Tandem (1500m)', vc: 50 }), 'tandem');
    assert.strictEqual(PC.classifyJumper({ name: 'Saut en Tandem', vc: 50, isTandem: true }), 'tandem');
});

test('classifyJumper : freefly_big vs freefly_small by group size', () => {
    assert.strictEqual(PC.classifyJumper({ vc: 70, nbPara: 4 }), 'freefly_big');
    assert.strictEqual(PC.classifyJumper({ vc: 70, nbPara: 1 }), 'freefly_small');
});

test('classifyJumper : belly_big vs belly_small by group size', () => {
    assert.strictEqual(PC.classifyJumper({ vc: 50, nbPara: 5 }), 'belly_big');
    assert.strictEqual(PC.classifyJumper({ vc: 50, nbPara: 1 }), 'belly_small');
});

test('classifyJumper : aff detected from "élève" name', () => {
    assert.strictEqual(PC.classifyJumper({ name: 'Élève (1500m)', vc: 50 }), 'aff');
    assert.strictEqual(PC.classifyJumper({ name: 'eleve drift', vc: 50 }), 'aff');
});

test('classifyJumper : wingsuit detected via flag', () => {
    assert.strictEqual(PC.classifyJumper({ isWingsuit: true, vc: 40 }), 'wingsuit');
});

test('classifyJumper : tracking detected via flag + trackDist', () => {
    assert.strictEqual(PC.classifyJumper({ isTracking: true, trackDist: 1000, vc: 50 }), 'tracking');
});

test('classicExitOrder : sorts by EXIT_PRIORITY ascending', () => {
    const jumpers = [
        { name: 'tandem', isTandem: true, vc: 50 },
        { name: 'belly_big', vc: 50, nbPara: 5 },
        { name: 'aff', vc: 50, isAFF: true },
    ];
    const sorted = PC.classicExitOrder(jumpers);
    assert.strictEqual(sorted[0].name, 'belly_big', 'belly_big first');
    assert.strictEqual(sorted[2].name, 'tandem', 'tandem last (before tracking)');
});

test('v3ExitOrder : tandem strictly last, PAC second-to-last', () => {
    const jumpers = [
        { id: 'tandem', name: 'Tandem' },
        { id: 'pac', name: 'PAC duo' },
        { vc: 70, nbPara: 4, name: 'Gros FF' },
        { isTracking: true, trackDist: 1000, vc: 60, name: 'Tracker' },
    ];
    const sorted = PC.v3ExitOrder(jumpers);
    assert.strictEqual(sorted[sorted.length - 1].id, 'tandem', 'tandem strictly last');
    assert.strictEqual(sorted[sorted.length - 2].id, 'pac', 'PAC second-to-last');
    // Tracker BEFORE tandem (V3 fix vs classicExitOrder)
    const trackIdx = sorted.findIndex(j => j.isTracking);
    const tandemIdx = sorted.length - 1;
    assert.ok(trackIdx < tandemIdx, 'tracker exits before tandem');
});
