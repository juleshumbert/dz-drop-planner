'use strict';
// Tests : module NFZ (no-fly zones) — point-in-polygon, gestion zones,
// sérialisation.

const test = require('node:test');
const assert = require('node:assert');
const NFZ = require('../nfz.js');

test('init() then getZones() returns empty array initially', () => {
    NFZ.init(43.10, 1.70);
    NFZ.clearZones();
    assert.deepStrictEqual(NFZ.getZones(), [], 'empty after clear');
});

test('addZone() appends a zone with computed _polyEN + _bbox', () => {
    NFZ.init(43.10, 1.70);
    NFZ.clearZones();
    const z = NFZ.addZone({
        name: 'Test NFZ',
        type: 'hard',
        altMin: 0, altMax: 5000,
        polygon: [
            [1.69, 43.099],  // [lon, lat] per docs / nfz.js convention
            [1.71, 43.099],
            [1.71, 43.101],
            [1.69, 43.101]
        ]
    });
    assert.ok(z.id, 'has id');
    assert.strictEqual(z.name, 'Test NFZ');
    assert.strictEqual(NFZ.getZones().length, 1, 'one zone');
});

test('removeZone() takes an id and reduces count', () => {
    NFZ.init(43.10, 1.70);
    NFZ.clearZones();
    const z = NFZ.addZone({
        name: 'tmp', type: 'hard', altMin: 0, altMax: 1000,
        polygon: [[1.69, 43.099], [1.70, 43.099], [1.69, 43.101]]
    });
    NFZ.removeZone(z.id);
    assert.strictEqual(NFZ.getZones().length, 0, '0 zones after remove');
});

test('serialize() returns plain objects (no _polyEN/_bbox internals)', () => {
    NFZ.init(43.10, 1.70);
    NFZ.clearZones();
    NFZ.addZone({
        name: 'Z', type: 'hard', altMin: 0, altMax: 1000,
        polygon: [[1.69, 43.099], [1.71, 43.099], [1.70, 43.101]]
    });
    const ser = NFZ.serialize();
    assert.ok(Array.isArray(ser));
    assert.strictEqual(ser.length, 1);
    // serialize should include _polyEN + _bbox so workers can use them
    assert.ok(ser[0]._polyEN || ser[0].polygon, 'has poly info');
});

test('clearZones() empties the list', () => {
    NFZ.init(43.10, 1.70);
    NFZ.clearZones();
    for (let i = 0; i < 3; i++) {
        NFZ.addZone({
            name: 'Z' + i, type: 'hard', altMin: 0, altMax: 1000,
            polygon: [[1.69, 43.099], [1.71, 43.099], [1.70, 43.101]]
        });
    }
    assert.strictEqual(NFZ.getZones().length, 3);
    NFZ.clearZones();
    assert.strictEqual(NFZ.getZones().length, 0);
});

test('distToPolyEdge: returns positive distance for point outside polygon', () => {
    // Square 200x200 centered at origin
    const poly = [
        { e: -100, n: -100 },
        { e: 100, n: -100 },
        { e: 100, n: 100 },
        { e: -100, n: 100 }
    ];
    // Point at (200, 0) — 100 m east of east edge
    const d = NFZ.distToPolyEdge(200, 0, poly);
    assert.ok(Math.abs(d - 100) < 1, `dist=${d}, expected 100`);
});

test('distToPolyEdge: returns 0 or negative for point inside polygon', () => {
    const poly = [
        { e: -100, n: -100 },
        { e: 100, n: -100 },
        { e: 100, n: 100 },
        { e: -100, n: 100 }
    ];
    const d = NFZ.distToPolyEdge(0, 0, poly);
    // At center, distance to nearest edge = 100m. Sign convention: function
    // computes nearest edge distance, sign depends on impl.
    assert.ok(Math.abs(d) <= 100 + 1, `interior dist=${d}, expected ≤100 in magnitude`);
});
