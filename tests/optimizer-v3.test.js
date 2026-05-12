'use strict';
// Tests : OptimizerV3 worker helpers (stick V3 builder, gap timing).
// Le run end-to-end nécessite Web Workers / Blob URLs, non testable en
// Node — testé manuellement via le UI.

const test = require('node:test');
const assert = require('node:assert');
const { buildStickV3, gapForJumperLocal, cumExitTime } = require('../optimizer-worker-v3.js');

// Typologies de référence (extrait de app.js PARA_TYPOLOGIES).
const TYPOS = {
    vr_mv:  { id: 'vr_mv', name: 'VR Voile Moyenne', vc: 50, vzVoile: 5.0, glide: 2.5, hOuv: 1000, hBreak: 1500, nbPara: 1, canopyType: 'docile' },
    ff_mv:  { id: 'ff_mv', name: 'Freefly Voile Moyenne', vc: 70, vzVoile: 5.0, glide: 2.5, hOuv: 1000, hBreak: 1500, nbPara: 1, canopyType: 'sport' },
    track_mv: { id: 'track_mv', name: 'Tracking Grande Voile', vc: 60, vzVoile: 5.0, glide: 2.5, hOuv: 1000, hBreak: 1500, nbPara: 1, canopyType: 'sport', isTracking: true, trackDist: 1000, trackAxis: 90 },
    eleve_15: { id: 'eleve_15', name: 'Élève (1500m)', vc: 50, vzVoile: 5.0, glide: 2.5, hOuv: 1500, hBreak: 1700, nbPara: 1, canopyType: 'student', skill: 0.55 },
    pac:    { id: 'pac', name: 'PAC', vc: 50, vzVoile: 5.0, glide: 2.5, hOuv: 1000, hBreak: 1500, nbPara: 2, canopyType: 'docile' },
    tandem: { id: 'tandem', name: 'Tandem', vc: 50, vzVoile: 5.5, glide: 2.8, hOuv: 1500, hBreak: 1700, nbPara: 1, canopyType: 'tandem' }
};

test('buildStickV3 returns 8-entry canonical stick at N_target=8', () => {
    const s = buildStickV3(TYPOS, 8);
    assert.strictEqual(s.length, 8, 'stick has 8 entries');
    // Last must be tandem (= top fin anchor)
    assert.ok(/tandem/i.test(s[s.length - 1].name || ''), 'last = tandem');
    // Second to last = PAC
    assert.ok(/pac/i.test(s[s.length - 2].name || s[s.length - 2].id || ''), 'second-to-last = PAC');
    // First = gros groupe VR
    assert.ok(/gros groupe vr/i.test(s[0].name || ''), 'first = Gros VR');
});

test('buildStickV3 adds fillers when N_target > 8', () => {
    const s = buildStickV3(TYPOS, 12);
    assert.strictEqual(s.length, 12, 'stick has 12 entries');
    // Tail still tandem
    assert.ok(/tandem/i.test(s[s.length - 1].name || ''));
    // Some fillers inserted (Solo libre / Duo / Init...)
    const fillerCount = s.filter(j => /(solo libre|duo|init)/i.test(j.name || '')).length;
    assert.ok(fillerCount >= 3, `at least 3 fillers, got ${fillerCount}`);
});

test('buildStickV3 truncates from FRONT when N_target < 8 (tandem preserved)', () => {
    const s = buildStickV3(TYPOS, 4);
    assert.strictEqual(s.length, 4);
    // Last = tandem
    assert.ok(/tandem/i.test(s[s.length - 1].name || ''), 'tandem still last');
    // 2nd to last = PAC
    assert.ok(/pac/i.test(s[s.length - 2].name || s[s.length - 2].id || ''), 'PAC still 2nd-to-last');
});

test('buildStickV3 returns just tandem when N_target=1', () => {
    const s = buildStickV3(TYPOS, 1);
    assert.strictEqual(s.length, 1);
    assert.ok(/tandem/i.test(s[0].name || ''));
});

test('buildStickV3 returns empty array when N_target<=0', () => {
    assert.deepStrictEqual(buildStickV3(TYPOS, 0), [], 'N=0 → []');
    assert.deepStrictEqual(buildStickV3(TYPOS, -1), [], 'N<0 → []');
});

test('buildStickV3 returns empty when typologies missing', () => {
    assert.deepStrictEqual(buildStickV3(null, 8), [], 'null typologies → []');
    assert.deepStrictEqual(buildStickV3({}, 8), [], 'empty typologies → []');
});

test('gapForJumperLocal: tandem → 15s, regardless of dtBase', () => {
    assert.strictEqual(gapForJumperLocal({ id: 'tandem' }, 6), 15);
    assert.strictEqual(gapForJumperLocal({ id: 'tandem' }, 10), 15);
    assert.strictEqual(gapForJumperLocal({ name: 'Tandem' }, 6), 15);
    assert.strictEqual(gapForJumperLocal({ isTandem: true }, 6), 15);
});

test('gapForJumperLocal: PAC → 15s', () => {
    assert.strictEqual(gapForJumperLocal({ id: 'pac' }, 6), 15);
    assert.strictEqual(gapForJumperLocal({ id: 'pac_first' }, 6), 15);
    assert.strictEqual(gapForJumperLocal({ name: 'PAC duo' }, 6), 15);
});

test('gapForJumperLocal: group ≥4 paras → dtBase + 2', () => {
    assert.strictEqual(gapForJumperLocal({ nbPara: 4 }, 6), 8);
    assert.strictEqual(gapForJumperLocal({ nbPara: 5 }, 6), 8);
    assert.strictEqual(gapForJumperLocal({ nbPara: 4 }, 10), 12);
});

test('gapForJumperLocal: solo (nbPara=1) → dtBase', () => {
    assert.strictEqual(gapForJumperLocal({ nbPara: 1 }, 6), 6);
    assert.strictEqual(gapForJumperLocal({ nbPara: 3 }, 6), 6);
});

test('gapForJumperLocal: null/undefined jumper → dtBase', () => {
    assert.strictEqual(gapForJumperLocal(null, 6), 6);
});

test('cumExitTime: empty/single stick returns 0', () => {
    assert.strictEqual(cumExitTime([], 6), 0);
    assert.strictEqual(cumExitTime([{ id: 'tandem' }], 6), 0);
});

test('cumExitTime: sums gaps from index 1 onward (NOT index 0)', () => {
    const stick = [
        { nbPara: 4 },        // gros, gap absent (first exit)
        { nbPara: 1 },        // gap = 6
        { id: 'tandem' },     // gap = 15
    ];
    // total = 6 + 15 = 21
    assert.strictEqual(cumExitTime(stick, 6), 21);
});

test('cumExitTime: full V3 stick at dtBase=6s', () => {
    const stick = buildStickV3(TYPOS, 8);
    const T = cumExitTime(stick, 6);
    // Cumul gaps (k=1..7) :
    // SoloVR(6) + GrosFF(8) + GrpTrack(6) + Élève(6) + SoloTrack(6) + PAC(15) + Tandem(15) = 62
    assert.strictEqual(T, 62);
});

test('cumExitTime: scales with dtBase', () => {
    const stick = buildStickV3(TYPOS, 8);
    const T6 = cumExitTime(stick, 6);
    const T10 = cumExitTime(stick, 10);
    // Solo/group gaps scale, PAC/Tandem are fixed @15s.
    // T6 = 6+8+6+6+6+15+15 = 62
    // T10 = 10+12+10+10+10+15+15 = 82
    assert.strictEqual(T10 - T6, 20, 'diff = (10-6)*5 = 20s on the 5 non-PAC/tandem gaps');
});
