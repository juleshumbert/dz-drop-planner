// ================================================================
//  OPTIMIZER-V3.JS — Anchor-bounded jumprun proposer
//
//  Reframes the problem : instead of optimising a single (axe, offset,
//  topNm) triplet, V3 derives the EXTENT of the jumprun (top vert ↔
//  top fin) from two anchor profiles :
//    - anchor "top vert" : RW solo / freefly with a small, high-WL
//      canopy (WL ≈ 1.5). Sets the most-downstream exit point that
//      can still recover to the safe zone.
//    - anchor "top fin"  : tandem (or PAC duo). Sets the most-upstream
//      exit point that can still drift back to the safe zone.
//
//  Output : up to 3 diversified proposals { axe, offset, topVert,
//  topFin, nPara, dtSortie, jumprunLength, P(GO), minSep, score }.
//
//  Depends on : physics-core.js, monte-carlo.js, nfz.js
// ================================================================
var OptimizerV3 = (function () {
    'use strict';

    var PC = null;
    var _pc = function () { if (!PC) PC = PhysicsCore; return PC; };
    var _state = { running: false, results: null };

    // Default anchor profiles. Constants — not user-editable. WL=1.5 for
    // the top-vert anchor was confirmed by the user.
    var ANCHORS = {
        vert: {
            name: '__anchor_vert',
            vc: 55,            // freefly fall rate (m/s)
            vzVoile: 5.5,      // small high-WL canopy descent (m/s)
            glide: 2.4,
            hOuv: 800,         // m AGL
            hBreak: 1000,
            skill: 0.95,
            canopyType: 'sportive',
            nbPara: 1,
            sepDist: 0,
            isTracking: false
        },
        fin: {
            name: '__anchor_fin_tandem',
            vc: 55,            // tandem in drogue
            vzVoile: 4.0,      // tandem main
            glide: 2.0,
            hOuv: 1500,        // tandems open higher
            hBreak: 1500,
            skill: 1.0,
            canopyType: 'docile',
            nbPara: 1,
            sepDist: 0,
            isTracking: false
        },
        finPac: {
            name: '__anchor_fin_pac',
            vc: 50,            // PAC élève / ventral, belly fall rate
            vzVoile: 5.0,      // student docile canopy
            glide: 2.5,
            hOuv: 1500,        // PAC ouvre haut (1500 m AGL)
            hBreak: 1500,
            skill: 0.7,        // élève moins skillé
            canopyType: 'docile',
            nbPara: 1,
            sepDist: 0,
            isTracking: false
        }
    };

    // Cached sources for Blob worker injection (file:// support)
    var _pcSource = null;
    var _wkSource = null;

    function _fetchSrc(url, cb) {
        var req = new XMLHttpRequest();
        req.open('GET', url, true);
        req.onload = function () { cb(req.status === 200 ? req.responseText : null); };
        req.onerror = function () { cb(null); };
        req.send();
    }

    function _fetchWorkerBundle(cb) {
        if (_pcSource && _wkSource) { cb(_pcSource, _wkSource); return; }
        var pending = 2;
        function done() { if (--pending === 0) cb(_pcSource, _wkSource); }
        if (_pcSource) { done(); } else {
            _fetchSrc('physics-core.js', function (src) { _pcSource = src; done(); });
        }
        if (_wkSource) { done(); } else {
            _fetchSrc('optimizer-worker-v3.js', function (src) { _wkSource = src; done(); });
        }
    }

    function _range(from, to, step) {
        var arr = [];
        for (var v = from; v <= to + step * 0.001; v += step)
            arr.push(Math.round(v * 10000) / 10000);
        return arr;
    }

    function _windFromDeg(altM) {
        var w = _pc().windAtZ(altM);
        return (Math.atan2(-w.e, -w.n) * _pc().RAD2DEG + 360) % 360;
    }

    // ── Diversification : keep at most K proposals, prefer different
    //    axes (cluster by 30° buckets so we don't return three
    //    near-identical orientations).
    function _diversify(proposals, K) {
        proposals.sort(function (a, b) { return b.score - a.score; });
        var picked = [];
        var usedBuckets = new Set();
        for (var i = 0; i < proposals.length && picked.length < K; i++) {
            var p = proposals[i];
            var bucket = Math.round(p.axe / 30) % 12;
            if (usedBuckets.has(bucket)) continue;
            usedBuckets.add(bucket);
            picked.push(p);
        }
        // Top up if not enough unique buckets
        for (var j = 0; j < proposals.length && picked.length < K; j++) {
            if (picked.indexOf(proposals[j]) === -1) picked.push(proposals[j]);
        }
        return picked;
    }

    // ── MC validation per proposal ────────────────────────────
    function _mcValidate(proposal, baseCfg, mcOptions, onProgress) {
        _pc().setWindProfile(baseCfg._windProfile);
        _pc().enableWindCache(Math.ceil(baseCfg.altM) + 100);

        // Réutilise EXACTEMENT le stick construit par le worker pour
        // que les stats MC reflètent le stick que le bouton « Apply »
        // installera dans `jumpersList`. Si proposal.stick absent
        // (vieille proposition), retombe sur l'ordering V3 du stick
        // utilisateur (legacy).
        var ordered;
        if (proposal.stick && proposal.stick.length) {
            ordered = proposal.stick;
        } else {
            var v3sorted = _pc().v3ExitOrder(baseCfg.jumpers);
            ordered = v3sorted.slice(Math.max(0, v3sorted.length - proposal.nPara));
        }

        var passCfg = Object.assign({}, baseCfg, {
            axe: proposal.axe,
            crossNm: proposal.crossNm,
            topNm: proposal.topNm,
            delaiTopVert: 0,
            espacementM: proposal.espacementM,
            nPara: ordered.length,
            jumpers: ordered,
            dtCfg: { ff: 0.5, open: 0.2, canopy: 1.0 }
        });
        return MonteCarlo.run(passCfg, mcOptions, onProgress);
    }

    // ── MAIN ──────────────────────────────────────────────────
    async function run(cfg, opts) {
        opts = opts || {};
        _state.running = true;
        var onP = opts.onProgress || function () { };
        var onC = opts.onComplete || function () { };

        try {
            _pc().setWindProfile(cfg._windProfile);
            _pc().enableWindCache(Math.ceil(cfg.altM) + 100);

            // ── Phase A : axis × offset scan, find jumprun windows
            onP('status', 'Phase 1/3 : Recherche fenêtres de jumprun…');

            var windFrom = _windFromDeg(cfg.altM);
            var axisSet = new Set();
            for (var d = -75; d <= 75; d += 5)
                axisSet.add(Math.round(((windFrom + d) % 360 + 360) % 360));
            for (var a = 0; a < 360; a += 20)
                axisSet.add(a);
            var axes = Array.from(axisSet);
            axes.sort(function (a, b) { return a - b; });

            var offsets = _range(-(opts.offsetMaxNm || 0.6), opts.offsetMaxNm || 0.6, 0.2);

            var NWORKERS = Math.min(Math.max(navigator.hardwareConcurrency || 4, 2), 8);
            var chunkSize = Math.ceil(axes.length / NWORKERS);
            var chunks = [];
            for (var i = 0; i < axes.length; i += chunkSize)
                chunks.push(axes.slice(i, i + chunkSize));

            var totalCells = axes.length * offsets.length;
            var donePerWorker = new Array(chunks.length).fill(0);

            var payload = {
                msg: {
                    cfg: cfg,
                    windProfile: cfg._windProfile,
                    jumpersList: cfg.jumpers,
                    nfzSerialized: cfg.nfzList || [],
                    offsets: offsets,
                    anchors: ANCHORS,
                    paraTypologies: cfg._paraTypologies || null,
                    scanSLo: -2.5, scanSHi: 2.5, scanStep: 0.25
                },
                totalWork: totalCells
            };

            // Per-chunk progress aggregator. The worker reports its own
            // (done/total); we sum across workers.
            var aggregator = function (perWorkerIdx) {
                return function (chunkDone, chunkTotal) {
                    donePerWorker[perWorkerIdx] = chunkDone;
                    var sum = donePerWorker.reduce(function (s, v) { return s + v; }, 0);
                    onP('scan', sum, totalCells);
                };
            };

            var proposals = await new Promise(function (resolve) {
                var collected = [];
                var left = chunks.length;
                if (!left) { resolve([]); return; }
                chunks.forEach(function (chunk, wi) {
                    function attach(w) {
                        w.onmessage = function (ev) {
                            if (ev.data.type === 'progress') aggregator(wi)(ev.data.done, ev.data.total);
                            else if (ev.data.type === 'result') {
                                collected = collected.concat(ev.data.proposals);
                                w.terminate();
                                left--;
                                if (left === 0) resolve(collected);
                            } else if (ev.data.type === 'error') {
                                console.error('OptimizerV3 worker:', ev.data.msg);
                            }
                        };
                        w.onerror = function () { try { w.terminate(); } catch (_) { } left--; if (left === 0) resolve(collected); };
                        w.postMessage(Object.assign({}, payload.msg, { axesChunk: chunk }));
                    }
                    if (window.location.protocol !== 'file:') {
                        try { attach(new Worker('optimizer-worker-v3.js')); return; } catch (e) { /* fall through */ }
                    }
                    _fetchWorkerBundle(function (pcSrc, wkSrc) {
                        if (!pcSrc || !wkSrc) {
                            left--;
                            if (left === 0) resolve(collected);
                            return;
                        }
                        var code = pcSrc + '\n' + wkSrc;
                        var blob = new Blob([code], { type: 'application/javascript' });
                        var url = URL.createObjectURL(blob);
                        var w;
                        try { w = new Worker(url); } finally { URL.revokeObjectURL(url); }
                        attach(w);
                    });
                });
            });

            if (!proposals.length) {
                _state.running = false;
                onC({ success: false, reason: 'Aucune fenêtre de largage trouvée pour les ancres' });
                return;
            }

            // Filter : require at least 1 jumper and reachOk semantics
            // tolerated through allLandOk soft criterion in score.
            var feasible = proposals.filter(function (p) { return p.nPara >= 1; });

            // ── Phase B : diversify and pick top-K
            onP('status', 'Phase 2/3 : Sélection des propositions diversifiées…');
            var K = opts.K || 3;
            var picked = _diversify(feasible, K);

            // ── Phase C : Monte-Carlo validation
            var mcResults = [];
            if (opts.enableMC !== false) {
                var mcOptions = opts.mcOptions || {
                    N: opts.mcN || 1000,
                    windSigma: { spd: opts.mcWindSpd || 3, dir: opts.mcWindDir || 15, correlation: 0.7 },
                    jumperSigma: { vc: 0.05, vzVoile: 0.08, glide: 0.10, hOuv: 50, skill: 0.10 },
                    sigmaScale: 2,
                    sampleInterval: 2.0
                };
                for (var pi = 0; pi < picked.length; pi++) {
                    var p = picked[pi];
                    onP('status', 'Phase 3/3 : Monte-Carlo proposition ' + (pi + 1) + '/' + picked.length +
                        ' (' + mcOptions.N + ' itér.)…');
                    // Yield to the UI thread BEFORE each heavy MC.run so
                    // the progress bar/status text actually repaint.
                    await new Promise(function (r) { setTimeout(r, 40); });
                    try {
                        var pi_capture = pi;
                        var mc = _mcValidate(p, cfg, mcOptions, function (d, t) {
                            onP('mc', pi_capture * mcOptions.N + d, picked.length * mcOptions.N);
                        });
                        p.mc = {
                            pGO: mc.goProb != null ? mc.goProb : 0,
                            reachProb: mc.reachProb,
                            safetyProb: mc.safetyProb,
                            criticalRisk: mc.criticalRisk,
                            verdict: mc.verdict,
                            reachVerdict: mc.reachVerdict,
                            safetyVerdict: mc.safetyVerdict,
                            criticalVerdict: mc.criticalVerdict,
                            N: mc.N,
                            sepP5: mc.sepP5,
                            sepP50: mc.sepP50,
                            sepHistogram: mc.sepHistogram,
                            outOfZoneByIter: mc.outOfZoneByIter,
                            outOfZoneHistogram: mc.outOfZoneHistogram,
                            outOfZoneMean: mc.outOfZoneMean,
                            jumperStats: mc.jumperStats
                        };
                        mcResults.push(mc);
                    } catch (err) {
                        console.warn('MC failed for proposal', pi, err);
                        p.mc = null;
                    }
                }
                // Re-rank using P(GO) as a multiplicative factor
                picked.sort(function (a, b) {
                    var pa = a.mc ? a.mc.pGO : 0.5;
                    var pb = b.mc ? b.mc.pGO : 0.5;
                    return (b.score * (pb + 0.1)) - (a.score * (pa + 0.1));
                });
            }

            var result = {
                success: true,
                proposals: picked,
                allCandidates: proposals.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 20),
                anchors: ANCHORS,
                windFromDeg: windFrom
            };

            _state.results = result;
            _state.running = false;
            onC(result);

        } catch (err) {
            console.error('OptimizerV3 error:', err);
            _state.running = false;
            onC({ success: false, reason: err.message || String(err) });
        }
    }

    return {
        run: run,
        ANCHORS: ANCHORS,
        isRunning: function () { return _state.running; },
        getResults: function () { return _state.results; }
    };
})();
