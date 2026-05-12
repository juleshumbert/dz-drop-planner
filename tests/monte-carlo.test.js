'use strict';
// Tests : module Monte-Carlo (perturbations vent + jumpers, histogram).
// MC.run() est testé en intégration légère dans tests/integration.test.js.

const test = require('node:test');
const assert = require('node:assert');
// MC requiert PhysicsCore en global. On l'injecte.
global.PhysicsCore = require('../physics-core.js');
const MC = require('../monte-carlo.js');

test('gaussRandom returns finite numbers, mean ~0 over many draws', () => {
    let sum = 0, sum2 = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) {
        const g = MC.gaussRandom();
        assert.ok(Number.isFinite(g), 'gaussRandom must be finite');
        sum += g;
        sum2 += g * g;
    }
    const mean = sum / N;
    const variance = sum2 / N - mean * mean;
    assert.ok(Math.abs(mean) < 0.1, `mean ≈ 0, got ${mean}`);
    assert.ok(Math.abs(variance - 1) < 0.15, `variance ≈ 1, got ${variance}`);
});

test('perturbWind preserves profile structure (same #layers, z values)', () => {
    const profile = [
        { z: 10, spd: 5, dir: 270, temp: 15, geoH: 10 },
        { z: 1000, spd: 10, dir: 280, temp: 10, geoH: 1000 },
        { z: 4000, spd: 20, dir: 290, temp: -5, geoH: 4000 }
    ];
    const p = MC.perturbWind(profile, { spd: 3, dir: 15, correlation: 0.7 });
    assert.strictEqual(p.length, profile.length, 'same #layers');
    p.forEach(function (layer, i) {
        assert.strictEqual(layer.z, profile[i].z, `layer ${i} z preserved`);
        assert.ok(Number.isFinite(layer.spd), 'spd finite');
        assert.ok(Number.isFinite(layer.dir), 'dir finite');
        assert.ok(layer.dir >= 0 && layer.dir < 360, `dir in [0,360) : ${layer.dir}`);
    });
});

test('perturbWind keeps perturbations bounded over many draws (3σ rule)', () => {
    const profile = [
        { z: 10, spd: 5, dir: 270, temp: 15, geoH: 10 }
    ];
    // Standard σ ≈ 3 kt → 99% of draws within ±9 kt of 5 → spd in [0, 14]
    let outOfRange = 0;
    for (let i = 0; i < 200; i++) {
        const p = MC.perturbWind(profile, { spd: 3, dir: 15, correlation: 0.7 });
        if (p[0].spd < 0 || p[0].spd > 25) outOfRange++;
    }
    assert.ok(outOfRange < 5, `outOfRange=${outOfRange}/200 should be <5`);
});

test('perturbJumpers adds noise to vc, vzVoile, glide, hOuv, skill', () => {
    const jumpers = [
        { vc: 50, vzVoile: 5, glide: 2.5, hOuv: 1000, skill: 0.8, nbPara: 1 }
    ];
    // Large sigma to ensure deviation
    const p = MC.perturbJumpers(jumpers, { vc: 0.5, vzVoile: 0.5, glide: 0.5, hOuv: 200, skill: 0.3 });
    assert.strictEqual(p.length, 1);
    // Should have _mcPilotNoise injected
    assert.ok(typeof p[0]._mcPilotNoise === 'number', '_mcPilotNoise injected');
    // Sub-angle noise per sub-jumper
    assert.ok(Array.isArray(p[0]._subAngleNoise), '_subAngleNoise array');
    // Skill clamped [0.2, 1.0]
    assert.ok(p[0].skill >= 0.2 && p[0].skill <= 1.0, `skill ${p[0].skill} in [0.2,1.0]`);
});

test('perturbJumpers preserves group structure (nbPara unchanged)', () => {
    const jumpers = [
        { vc: 50, vzVoile: 5, glide: 2.5, hOuv: 1000, skill: 0.8, nbPara: 4 }
    ];
    const p = MC.perturbJumpers(jumpers, { vc: 0.05 });
    assert.strictEqual(p[0].nbPara, 4, 'nbPara preserved');
    assert.strictEqual(p[0]._subAngleNoise.length, 4, '4 sub-angle noises');
});

test('perturbJumpers handles subOverrides (PAC moniteur breakoff)', () => {
    const jumpers = [
        {
            name: 'PAC', id: 'pac', vc: 50, vzVoile: 5, glide: 2.5, hOuv: 1000, skill: 0.9, nbPara: 2,
            subOverrides: [
                { name: 'élève', hOuv: 1500, skill: 0.55 },
                { name: 'mono', hOuv: 1000, breakoffDist: 200, breakoffAxis: 90, breakoffAxisSigma: 10 }
            ]
        }
    ];
    const p = MC.perturbJumpers(jumpers, { vc: 0.05, skill: 0.1 });
    assert.ok(p[0].subOverrides, 'subOverrides preserved');
    assert.strictEqual(p[0].subOverrides.length, 2, '2 subs');
    // Moniteur sub has _breakoffAxisNoise injected
    const mono = p[0].subOverrides.find(s => s.name === 'mono');
    assert.ok(typeof mono._breakoffAxisNoise === 'number',
        'mono has _breakoffAxisNoise');
});

test('perturbJumpers : flipProb=1 always sets _flipped + adds 180° to tracking noise', () => {
    // Repeat over many draws to defend against gaussian noise from σ=15° default
    // pushing the absolute value below a tight threshold (~ ±45° at 3σ).
    let allFlipped = true, sumAbs = 0;
    const N = 50;
    for (let i = 0; i < N; i++) {
        const p = MC.perturbJumpers([
            { vc: 50, vzVoile: 5, glide: 2.5, hOuv: 1500, skill: 0.5, nbPara: 1,
              isTracking: true, trackDist: 600, flipProb: 1.0 }
        ], {});
        if (!p[0]._flipped) allFlipped = false;
        sumAbs += Math.abs(p[0]._trackAxisNoise);
    }
    assert.ok(allFlipped, 'flipped=true on every draw with flipProb=1');
    const avgAbs = sumAbs / N;
    assert.ok(avgAbs > 150 && avgAbs < 250,
        `|trackAxisNoise| avg ≈ 180° (got ${avgAbs.toFixed(1)})`);
});
