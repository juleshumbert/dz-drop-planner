// ================================================================
//  OPTIMIZER-V2.JS — 4-phase combined optimizer
//  Phase 1 : Coarse geometry scan (workers)
//  Phase 2 : Fine refinement (workers)
//  Phase 3 : Stick order (genetic, main thread)
//  Phase 4 : Monte-Carlo validation
//  Depends on: physics-core.js, monte-carlo.js, nfz.js
// ================================================================
var OptimizerV2 = (function () {
    'use strict';

    var PC = null;
    var _pc = function () { if (!PC) PC = PhysicsCore; return PC; };
    var _state = { running: false, results: null };

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
            _fetchSrc('optimizer-worker-v2.js', function (src) { _wkSource = src; done(); });
        }
    }

    // ── Utilities ─────────────────────────────────────────────
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

    function _shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
        return arr;
    }

    // ── Worker spawning (HTTP + file:// Blob fallback) ─────────
    function _spawnWorkers(chunks, payload, onProgress) {
        return new Promise(function (resolve) {
            if (!chunks.length) { resolve([]); return; }
            var allResults = [];
            var workerDone = new Array(chunks.length).fill(0);
            var left = chunks.length;
            var totalWork = payload.totalWork;

            function _makeWorker(chunk, wi) {
                function _attach(w) {
                    w.onmessage = function (ev) {
                        if (ev.data.type === 'progress') {
                            workerDone[wi] = ev.data.done;
                            var tot = workerDone.reduce(function (s, v) { return s + v; }, 0);
                            if (onProgress) onProgress(tot, totalWork);
                        } else if (ev.data.type === 'result') {
                            allResults = allResults.concat(ev.data.bestConfigs);
                            w.terminate();
                            left--;
                            if (left === 0) resolve(allResults);
                        }
                    };
                    w.onerror = function () { w.terminate(); left--; if (left === 0) resolve(allResults); };
                    w.postMessage(Object.assign({}, payload.msg, { axesChunk: chunk }));
                }

                if (window.location.protocol !== 'file:') {
                    // HTTP mode: direct script load
                    try { _attach(new Worker('optimizer-worker-v2.js')); return; } catch (e) { /* fall through */ }
                }

                // Blob fallback for file:// – bundle physics-core + worker source
                _fetchWorkerBundle(function (pcSrc, wkSrc) {
                    if (!pcSrc || !wkSrc) {
                        console.error('OptimizerV2: cannot fetch worker sources for file:// fallback');
                        left--; if (left === 0) resolve(allResults);
                        return;
                    }
                    var code = pcSrc + '\n' + wkSrc;
                    var blob = new Blob([code], { type: 'application/javascript' });
                    var url = URL.createObjectURL(blob);
                    var w;
                    try { w = new Worker(url); } finally { URL.revokeObjectURL(url); }
                    _attach(w);
                });
            }

            chunks.forEach(function (chunk, wi) { _makeWorker(chunk, wi); });
        });
    }

    // ── Phase 1: Coarse scan ───────────────────────────────────
    async function _phaseCoarse(cfg, onProgress) {
        var windFrom = _windFromDeg(cfg.altM);

        // Smart axes: prioritise ±60° around wind direction, then fill rest
        var axisSet = new Set();
        for (var d = -60; d <= 60; d += 5)
            axisSet.add(Math.round(((windFrom + d) % 360 + 360) % 360));
        for (var a = 0; a < 360; a += 15)
            axisSet.add(a);
        var primaryAxes = Array.from(axisSet);

        var offsets = _range(-(cfg.offsetMaxNm || 1.0), cfg.offsetMaxNm || 1.0, 0.2);
        var totalWork = primaryAxes.length * offsets.length;

        var NWORKERS = Math.min(Math.max(navigator.hardwareConcurrency || 4, 2), 8);
        var chunkSize = Math.ceil(primaryAxes.length / NWORKERS);
        var chunks = [];
        for (var i = 0; i < primaryAxes.length; i += chunkSize)
            chunks.push(primaryAxes.slice(i, i + chunkSize));

        var payload = {
            phase: 'coarse', offsets: offsets,
            cfg: cfg, windProfile: cfg._windProfile,
            jumpersList: cfg.jumpers, nfzSerialized: cfg.nfzList || []
        };

        return await _spawnWorkers(chunks, { msg: payload, totalWork: totalWork },
            function (done, total) { if (onProgress) onProgress('coarse', done, total); });
    }

    // ── Phase 2: Fine refinement ───────────────────────────────
    async function _phaseFine(coarseResults, cfg, onProgress) {
        if (!coarseResults.length) return [];

        var maxN = Math.max.apply(null, coarseResults.map(function (c) { return c.nPara; }));
        var topNResults = coarseResults.filter(function (c) { return c.nPara === maxN; });
        topNResults.sort(function (a, b) { return b.score - a.score; });
        var topK = topNResults.slice(0, 8);

        var allFine = [];
        for (var k = 0; k < topK.length; k++) {
            var c = topK[k];
            var axes = _range(c.axe - 5, c.axe + 5, 1);
            var offsets = _range(c.crossNm - 0.15, c.crossNm + 0.15, 0.05);

            var payload = {
                phase: 'fine', axesChunk: axes, offsets: offsets,
                cfg: Object.assign({}, cfg, { topNmMaxScan: Math.abs(c.topNm) + 0.5 }),
                windProfile: cfg._windProfile,
                jumpersList: cfg.jumpers, nfzSerialized: cfg.nfzList || []
            };
            var totalWork = axes.length * offsets.length;

            var res = await _spawnWorkers([axes], { msg: payload, totalWork: totalWork },
                function (done, total) { if (onProgress) onProgress('fine', k + 1, topK.length); });

            allFine = allFine.concat(res);
        }
        return allFine;
    }

    // ── Phase 3: Stick order (genetic algorithm) ───────────────
    function _phaseStickOrder(geomWinner, cfg, onProgress) {
        var jumpers = cfg.jumpers.slice();
        var N = jumpers.length;
        if (N <= 1) return { order: jumpers, improved: false };

        // Set wind profile / cache ONCE for the entire genetic loop
        // (popSize * generations evaluations would otherwise reset the cache each call).
        _pc().setWindProfile(cfg._windProfile);
        _pc().enableWindCache(Math.ceil(cfg.altM) + 100);

        var bestOrder = _pc().classicExitOrder(jumpers);
        var bestScore = _evalOrder(bestOrder, geomWinner, cfg);

        var popSize = Math.min(20, Math.max(8, N * 2));
        var generations = N <= 7 ? 100 : 300;

        var population = [bestOrder.slice()];
        for (var i = 1; i < popSize; i++)
            population.push(_shuffle(jumpers.slice()));

        for (var gen = 0; gen < generations; gen++) {
            var scored = population.map(function (order) {
                return { order: order, score: _evalOrder(order, geomWinner, cfg) };
            });
            scored.sort(function (a, b) { return b.score - a.score; });

            if (scored[0].score > bestScore) {
                bestScore = scored[0].score;
                bestOrder = scored[0].order.slice();
            }

            var parents = scored.slice(0, Math.ceil(popSize / 2));
            var nextPop = parents.map(function (p) { return p.order.slice(); });
            while (nextPop.length < popSize) {
                var p = parents[Math.floor(Math.random() * parents.length)].order.slice();
                var a2 = Math.floor(Math.random() * N);
                var b2 = Math.floor(Math.random() * N);
                var tmp = p[a2]; p[a2] = p[b2]; p[b2] = tmp;
                nextPop.push(p);
            }
            population = nextPop;

            if (onProgress && gen % 20 === 0) onProgress('stick', gen, generations);
        }

        return { order: bestOrder, improved: true, score: bestScore };
    }

    function _evalOrder(order, geom, cfg) {
        // Wind profile + cache are set once by the caller (_phaseStickOrder)
        var passCfg = Object.assign({}, cfg, {
            axe: geom.axe, crossNm: geom.crossNm, topNm: geom.topNm,
            nPara: order.length, jumpers: order,
            dtCfg: { ff: 0.25, open: 0.1, canopy: 0.5 },
            nfzList: cfg.nfzList || []
        });

        var res = _pc().simPass(passCfg);
        var windFrom = _windFromDeg(cfg.altM);
        return _pc().objectiveScore(res, windFrom);
    }

    // ── Phase 4: Monte-Carlo ───────────────────────────────────
    function _phaseMonteCarlo(geomWinner, order, cfg, mcOptions, onProgress) {
        _pc().setWindProfile(cfg._windProfile);
        _pc().enableWindCache(Math.ceil(cfg.altM) + 100);

        var passCfg = Object.assign({}, cfg, {
            axe: geomWinner.axe, crossNm: geomWinner.crossNm, topNm: geomWinner.topNm,
            nPara: order.length, jumpers: order,
            nfzList: cfg.nfzList || []
        });

        return MonteCarlo.run(passCfg, mcOptions,
            function (done, total) { if (onProgress) onProgress('mc', done, total); });
    }

    // ── MAIN ENTRY POINT ───────────────────────────────────────
    /**
     * Run the full 4-phase optimization pipeline.
     * @param {Object} cfg  – Full simulation config + _windProfile + jumpers
     * @param {Object} opts – { enableMC, mcN, mcWindSpd, mcWindDir, onProgress, onComplete }
     */
    async function run(cfg, opts) {
        opts = opts || {};
        _state.running = true;
        var onP = opts.onProgress || function () { };
        var onC = opts.onComplete || function () { };

        try {
            _pc().setWindProfile(cfg._windProfile);
            _pc().enableWindCache(Math.ceil(cfg.altM) + 100);

            // Classic exit order as starting point
            cfg.jumpers = _pc().classicExitOrder(cfg.jumpers);

            // ── Phase 1: Coarse scan ──────────────────────────
            onP('status', 'Phase 1/4 : Scan géométrique grossier…');
            var coarseResults = await _phaseCoarse(cfg, onP);
            if (!coarseResults.length) {
                _state.running = false;
                onC({ success: false, reason: 'Aucune configuration GO trouvée (phase 1)' });
                return;
            }

            // ── Phase 2: Fine refinement ──────────────────────
            onP('status', 'Phase 2/4 : Raffinement fin…');
            var fineResults = await _phaseFine(coarseResults, cfg, onP);
            var allResults = coarseResults.concat(fineResults);
            allResults.sort(function (a, b) { return b.score - a.score; });
            var geomWinner = allResults[0];

            // ── Phase 3: Stick order ──────────────────────────
            onP('status', "Phase 3/4 : Optimisation de l'ordre…");
            var stickResult = _phaseStickOrder(geomWinner, cfg, onP);
            var finalOrder = stickResult.order;

            // Re-check with final order + fine dt
            _pc().setWindProfile(cfg._windProfile);
            _pc().enableWindCache(Math.ceil(cfg.altM) + 100);
            var finalPassCfg = Object.assign({}, cfg, {
                axe: geomWinner.axe, crossNm: geomWinner.crossNm, topNm: geomWinner.topNm,
                nPara: finalOrder.length, jumpers: finalOrder,
                dtCfg: { ff: 0.15, open: 0.1, canopy: 0.5 },
                nfzList: cfg.nfzList || []
            });
            var finalSim = _pc().simPass(finalPassCfg);

            // ── Phase 4: Monte-Carlo ──────────────────────────
            var mcResult = null;
            if (opts.enableMC !== false) {
                var mcOptions = opts.mcOptions || {
                    N: opts.mcN || 100,
                    windSigma: { spd: opts.mcWindSpd || 3, dir: opts.mcWindDir || 15, correlation: opts.mcCorr || 0.7 },
                    jumperSigma: {
                        vc: opts.mcVc || 0.05,
                        vzVoile: opts.mcVz || 0.08,
                        glide: opts.mcGlide || 0.10,
                        hOuv: opts.mcHouv || 50,
                        skill: opts.mcSkill || 0.1
                    },
                    sigmaScale: opts.mcSigmaScale || 2,
                    sampleInterval: opts.mcSampleInterval || 2.0
                };
                onP('status', 'Phase 4/4 : Monte-Carlo (' + (mcOptions.N || 100) + ' itérations)…');
                mcResult = _phaseMonteCarlo(geomWinner, finalOrder, cfg, mcOptions, onP);
            }

            var result = {
                success: true,
                geom: geomWinner,
                order: finalOrder,
                sim: finalSim,
                mc: mcResult,
                allCandidates: allResults.slice(0, 20)
            };

            _state.results = result;
            _state.running = false;
            onC(result);

        } catch (err) {
            console.error('OptimizerV2 error:', err);
            _state.running = false;
            onC({ success: false, reason: err.message });
        }
    }

    return {
        run: run,
        isRunning: function () { return _state.running; },
        getResults: function () { return _state.results; }
    };
})();
