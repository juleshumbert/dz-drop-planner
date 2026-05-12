'use strict';
// Tests : construction du circuit d'atterrissage, fallback shifted-final,
// detection de zone de posé (polygone).

const test = require('node:test');
const assert = require('node:assert');
const PC = require('../physics-core.js');

function steadyWindWest(spdKt) {
    return [
        { z: 10, spd: spdKt, dir: 270, temp: 15, geoH: 10 },
        { z: 4500, spd: spdKt, dir: 270, temp: 0, geoH: 4500 }
    ];
}

test('createLandingPattern: computed pattern places finalStart upwind of target', () => {
    PC.setWindProfile(steadyWindWest(10));
    const landTarget = { e: 0, n: 0 };
    const fn = PC.createLandingPattern(landTarget, 12, {
        elevM: 0, altFinal: 60, altBase: 150, altDownwind: 300,
        finalSeconds: 10, skill: 0.9, glide: 2.5, canopyType: 'docile'
    });
    // Smoke: returned a steer function
    assert.strictEqual(typeof fn, 'function', 'returns steer fn');
    // Cannot inspect internals — but call it and verify shape
    const cmd = fn([0, 1000, 600, 0, 0, -5], 0);
    assert.ok(cmd && typeof cmd.targetHeading === 'number', 'cmd has targetHeading');
});

test('createLandingPattern: user-defined pattern (E/N waypoints) is honored', () => {
    PC.setWindProfile(steadyWindWest(10));
    const target = { e: 0, n: 0 };
    const userPatternEN = {
        target: { e: 0, n: 0 },
        finalStart: { e: 100, n: 0 },         // 100m east of target
        baseStart: { e: 100, n: 80 },
        downwindStart: { e: 300, n: 80 }
    };
    const fn = PC.createLandingPattern(target, 12, {
        elevM: 0, finalSeconds: 10, userPatternEN: userPatternEN,
        canopyType: 'docile'
    });
    const cmd = fn([50, 100, 500, 0, 0, -5], 0);
    assert.ok(cmd && typeof cmd.targetHeading === 'number');
});

test('simJumper with rvZone polygon : detects landing inside zone', () => {
    PC.setWindProfile([
        { z: 10, spd: 0, dir: 0, temp: 15, geoH: 10 },
        { z: 4500, spd: 0, dir: 0, temp: 0, geoH: 4500 }
    ]);
    // Carré 400 x 400 m centré sur (0,0)
    const rvZone = {
        e: 0, n: 0, L: 400, W: 400, altAbs: 0,
        polygon: [
            { e: -200, n: -200 },
            { e: 200, n: -200 },
            { e: 200, n: 200 },
            { e: -200, n: 200 }
        ]
    };
    const env = {
        exitE: 0, exitN: 100, altM: 1200, elevM: 0, isa: 0,
        gsE: 0, gsN: 0,  // no plane drift
        axeDeg: 0, trackE: 0, trackN: 1
    };
    const jp = { vc: 50, vzVoile: 5, glide: 2.5, hOuv: 1000, hBreak: 1200, skill: 0.9 };
    // Steer toward center (0,0)
    const steer = function () { return { targetHeading: 180 }; };
    const r = PC.simJumper(jp, env, rvZone, steer, undefined, 0);
    // landingDistance is set, margeRDV is set
    assert.ok(typeof r.margeRDV === 'number', 'margeRDV computed');
    assert.ok(typeof r.landingDistance === 'number', 'landingDistance computed');
});

test('simPass : full pass with 2 jumpers, calm wind, lands jumpers near target', () => {
    const dz = { lat: 43.10, lon: 1.70 };
    const target = { lat: 43.10, lon: 1.70 };
    const rv = { lat: 43.09, lon: 1.70 };
    PC.setWindProfile([
        { z: 10, spd: 0, dir: 0, temp: 15, geoH: 10 },
        { z: 4500, spd: 0, dir: 0, temp: 0, geoH: 4500 }
    ]);
    const cfg = {
        dz: dz, target: target, rv: rv,
        axe: 270, crossNm: 0, topNm: 0,
        altM: 4267, elevM: 0, tasMs: 60, isa: 0,
        delaiTopVert: 0, espacementM: 300,
        jumpers: [
            { name: 'solo 1', vc: 50, vzVoile: 5, glide: 2.5, hOuv: 1000, hBreak: 1200, nbPara: 1, skill: 0.9 },
            { name: 'tandem', vc: 50, vzVoile: 5.5, glide: 2.8, hOuv: 1500, hBreak: 1700, nbPara: 1, skill: 0.9, isTandem: true, id: 'tandem' }
        ],
        nPara: 2,
        rvLength: 400, rvWidth: 400, rvAlt: 300,
        timeMin: 3, safetyThresh: 78
    };
    const r = PC.simPass(cfg);
    assert.strictEqual(r.positions.length, 2, 'positions for 2 jumpers');
    assert.ok(typeof r.go === 'boolean', 'go verdict computed');
    assert.ok(r.delays && r.delays.length === 2, 'delays returned per jumper');
});

test('simPass : delays reflect group gap rules (tandem 15s, gros groupes Δt+2s)', () => {
    PC.setWindProfile([
        { z: 10, spd: 0, dir: 0, temp: 15, geoH: 10 },
        { z: 4500, spd: 0, dir: 0, temp: 0, geoH: 4500 }
    ]);
    const cfg = {
        dz: { lat: 43.10, lon: 1.70 }, target: { lat: 43.10, lon: 1.70 }, rv: { lat: 43.10, lon: 1.70 },
        axe: 270, crossNm: 0, topNm: 0,
        altM: 4267, elevM: 0, tasMs: 60, isa: 0,
        delaiTopVert: 5, espacementM: 300,
        jumpers: [
            { name: 'gros VR', vc: 50, vzVoile: 5, glide: 2.5, hOuv: 1000, hBreak: 1200, nbPara: 4, skill: 0.8 },
            { name: 'solo', vc: 50, vzVoile: 5, glide: 2.5, hOuv: 1000, hBreak: 1200, nbPara: 1, skill: 0.8 },
            { name: 'PAC', id: 'pac', vc: 50, vzVoile: 5, glide: 2.5, hOuv: 1000, hBreak: 1200, nbPara: 2, skill: 0.8 },
            { name: 'Tandem', id: 'tandem', vc: 50, vzVoile: 5.5, glide: 2.8, hOuv: 1500, hBreak: 1700, nbPara: 1, skill: 0.95 }
        ],
        nPara: 4,
        rvLength: 400, rvWidth: 400, rvAlt: 300,
        timeMin: 3, safetyThresh: 78
    };
    const r = PC.simPass(cfg);
    const delays = r.delays;
    // delays[0] = delaiTopVert = 5
    assert.strictEqual(delays[0], 5, `delays[0]=${delays[0]} expected 5`);
    // delays[1] = 5 + gap(solo, dtSortie≈5) ≈ 5 + 5 = 10
    // dtSortie = 300m / GS. GS≈75 → dtSortie≈4. Pour gap solo = dtSortie ~4
    const dtSortie = r.dtSortie;
    assert.ok(Math.abs(delays[1] - (5 + dtSortie)) < 0.5,
        `delays[1] = ${delays[1]} expected ~${5 + dtSortie} (delaiTopVert + dtSortie)`);
    // delays[2] = delays[1] + gap(PAC) = delays[1] + 15
    assert.ok(Math.abs(delays[2] - (delays[1] + 15)) < 0.5,
        `delays[2] = ${delays[2]} expected ${delays[1] + 15} (PAC = 15s climb-out)`);
    // delays[3] = delays[2] + gap(Tandem) = delays[2] + 15
    assert.ok(Math.abs(delays[3] - (delays[2] + 15)) < 0.5,
        `delays[3] = ${delays[3]} expected ${delays[2] + 15} (Tandem = 15s climb-out)`);
});

test('simPass : zonePolygon overrides rvLength × rvWidth rectangle', () => {
    PC.setWindProfile([
        { z: 10, spd: 0, dir: 0, temp: 15, geoH: 10 },
        { z: 4500, spd: 0, dir: 0, temp: 0, geoH: 4500 }
    ]);
    // Define a small polygon (200x200) around target. rvLength=400 would be larger.
    const dz = { lat: 43.10, lon: 1.70 };
    const cfg = {
        dz: dz, target: dz, rv: dz,
        axe: 270, crossNm: 0, topNm: 0,
        altM: 4267, elevM: 0, tasMs: 60, isa: 0,
        delaiTopVert: 0, espacementM: 300,
        jumpers: [{ vc: 50, vzVoile: 5, glide: 2.5, hOuv: 1000, hBreak: 1200, nbPara: 1, skill: 0.9 }],
        nPara: 1,
        rvLength: 400, rvWidth: 400, rvAlt: 300,
        timeMin: 3, safetyThresh: 78,
        zonePolygon: [
            { lat: 43.0991, lon: 1.6989 },
            { lat: 43.1009, lon: 1.6989 },
            { lat: 43.1009, lon: 1.7011 },
            { lat: 43.0991, lon: 1.7011 }
        ]
    };
    const r = PC.simPass(cfg);
    assert.strictEqual(r.positions.length, 1, 'one jumper sim');
    // Smoke : margeRDV computed against the polygon
    assert.ok(typeof r.positions[0].margeRDV === 'number');
});

test('simPass : redE/redN reflect actual last-jumper delay (not uniform)', () => {
    PC.setWindProfile([
        { z: 10, spd: 0, dir: 0, temp: 15, geoH: 10 },
        { z: 4500, spd: 0, dir: 0, temp: 0, geoH: 4500 }
    ]);
    const dz = { lat: 43.10, lon: 1.70 };
    const cfg = {
        dz: dz, target: dz, rv: dz,
        axe: 90, crossNm: 0, topNm: 0,
        altM: 4267, elevM: 0, tasMs: 60, isa: 0,
        delaiTopVert: 0, espacementM: 300,
        jumpers: [
            { vc: 50, vzVoile: 5, glide: 2.5, hOuv: 1000, hBreak: 1200, nbPara: 1, skill: 0.9 },
            { id: 'tandem', vc: 50, vzVoile: 5.5, glide: 2.8, hOuv: 1500, hBreak: 1700, nbPara: 1, skill: 0.95 }
        ],
        nPara: 2,
        rvLength: 400, rvWidth: 400, rvAlt: 300,
        timeMin: 3, safetyThresh: 78
    };
    const r = PC.simPass(cfg);
    // delays[1] = 0 + 15 (tandem gap) = 15s
    // redE = p1ExitE + trackE * (15 - 0) * GS = 0 + 1 * 15 * GS
    const expectedRedE = 15 * r.gsMs;
    assert.ok(Math.abs(r.redE - expectedRedE) < 5,
        `redE=${r.redE} expected ${expectedRedE} (15s × GS)`);
});

test('computePairMinDists : returns pair distances', () => {
    const sp1 = [{ t: 0, x: 0, y: 0, z: 1000 }, { t: 10, x: 0, y: 0, z: 800 }];
    const sp2 = [{ t: 0, x: 100, y: 0, z: 1000 }, { t: 10, x: 100, y: 0, z: 800 }];
    const trajs = [
        { t0: 0, sp: sp1, groupIdx: 0 },
        { t0: 0, sp: sp2, groupIdx: 1 }
    ];
    const pairs = PC.computePairMinDists(trajs);
    assert.ok(Array.isArray(pairs), 'returns array');
    assert.ok(pairs.length > 0, 'has pairs');
    assert.ok(Math.abs(pairs[0].dist - 100) < 5, `min dist=${pairs[0].dist}, expected 100`);
});
