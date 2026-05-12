'use strict';
// ================================================================
//  OPTIMIZER-WORKER-V2.JS
//  Receives: { phase, axesChunk, offsets, cfg, windProfile,
//              jumpersList, nfzSerialized, physicsCoreSource? }
//  Sends:    { type:'progress', done, total }
//            { type:'result',   bestConfigs }
//
//  PhysicsCore is loaded via importScripts (HTTP) or injected
//  inline by the main thread (file:// Blob fallback).
// ================================================================

// ── Load PhysicsCore ──────────────────────────────────────────
var PhysicsCore;
if (typeof importScripts === 'function') {
    try {
        importScripts('physics-core.js');
    } catch (e) {
        // Blob / file:// mode – PhysicsCore will be initialised
        // from physicsCoreSource field in the first message (see below).
    }
}

// ── Scan logic ────────────────────────────────────────────────
function scanCoarse(data) {
    // Late-inject PhysicsCore source if it arrived with the message
    if (!PhysicsCore && data.physicsCoreSource) {
        // eslint-disable-next-line no-eval
        eval(data.physicsCoreSource);
    }
    if (!PhysicsCore) {
        postMessage({ type: 'error', msg: 'PhysicsCore not available in worker' });
        return [];
    }

    var PC = PhysicsCore;
    PC.setWindProfile(data.windProfile);
    PC.enableWindCache(Math.ceil(data.cfg.altM) + 100);

    var axes = data.axesChunk;
    var offsets = data.offsets;
    var cfg = data.cfg;
    var jumpers = data.jumpersList;
    var nfzList = data.nfzSerialized || [];
    var maxN = cfg.maxNParaLimit || 16;
    var topMax = cfg.topNmMaxScan || 3.0;

    var total = axes.length * offsets.length;
    var done = 0;
    var results = [];

    var dtCoarse = { ff: 0.5, open: 0.2, canopy: 1.0 };
    var dtFine = { ff: 0.15, open: 0.1, canopy: 0.5 };

    // Determine wind direction for scoring
    var wJ = PC.windAtZ(cfg.altM);
    var windFromDeg = (Math.atan2(-wJ.e, -wJ.n) * PC.RAD2DEG + 360) % 360;

    for (var ai = 0; ai < axes.length; ai++) {
        for (var oi = 0; oi < offsets.length; oi++) {
            var axe = axes[ai], crossNm = offsets[oi];
            var dtUse = data.phase === 'fine' ? dtFine : dtCoarse;
            var bisectIter = data.phase === 'fine' ? 6 : 3;
            var topStep = data.phase === 'fine' ? 0.1 : 0.25;

            var slidingNm = -topMax;
            var curBest = null;

            for (var ni = 1; ni <= maxN; ni++) {
                // Coarse scan: find first topNm value that yields GO
                var coarseGo = null;
                for (var scan = slidingNm; scan <= 1.0; scan += topStep) {
                    var passCfg = Object.assign({}, cfg, {
                        axe: axe, crossNm: crossNm, topNm: scan,
                        nPara: ni, jumpers: jumpers,
                        dtCfg: dtUse, nfzList: nfzList
                    });
                    if (PC.simPass(passCfg).go) { coarseGo = scan; break; }
                }
                if (coarseGo === null) break;

                // Bisection refinement: narrow down the exact GO threshold
                var lo = Math.max(-topMax, coarseGo - topStep), hi = coarseGo;
                for (var it = 0; it < bisectIter; it++) {
                    var mid = (lo + hi) / 2;
                    var pc2 = Object.assign({}, cfg, {
                        axe: axe, crossNm: crossNm, topNm: mid,
                        nPara: ni, jumpers: jumpers,
                        dtCfg: dtUse, nfzList: nfzList
                    });
                    if (PC.simPass(pc2).go) hi = mid; else lo = mid;
                }

                // Final evaluation at refined threshold
                var finalCfg = Object.assign({}, cfg, {
                    axe: axe, crossNm: crossNm, topNm: hi,
                    nPara: ni, jumpers: jumpers,
                    dtCfg: dtUse, nfzList: nfzList
                });
                var rBest = PC.simPass(finalCfg);
                if (!rBest.go) {
                    finalCfg.topNm = coarseGo;
                    rBest = PC.simPass(finalCfg);
                }
                if (!rBest.go) break;

                var mg = rBest.positions.map(function (p) { return p.margeRDV; });
                var sp2 = rBest.allPairMinDists.map(function (m) { return m.dist; });

                curBest = {
                    axe: axe, crossNm: crossNm, topNm: hi, nPara: ni,
                    dtSortie: rBest.dtSortie,
                    score: PC.objectiveScore(rBest, windFromDeg),
                    metrics: {
                        sep_min: sp2.length ? Math.min.apply(null, sp2) : 9999,
                        sep_avg: sp2.length ? sp2.reduce(function (s, x) { return s + x; }, 0) / sp2.length : 9999,
                        marge_min: mg.length ? Math.min.apply(null, mg) : -9999,
                        marge_avg: mg.length ? mg.reduce(function (s, x) { return s + x; }, 0) / mg.length : -9999
                    }
                };
                slidingNm = Math.max(-topMax, coarseGo - topStep);
            }

            if (curBest) results.push(curBest);
            done++;
            if (done % 10 === 0) postMessage({ type: 'progress', done: done, total: total });
        }
    }

    postMessage({ type: 'progress', done: total, total: total });
    return results;
}

// ── Message handler ───────────────────────────────────────────
onmessage = function (e) {
    var results = scanCoarse(e.data);
    postMessage({ type: 'result', bestConfigs: results });
};
