// ================================================================
//  MONTE-CARLO.JS — Uncertainty quantification + ellipses + tube
//  Depends on PhysicsCore (physics-core.js)
// ================================================================
var MonteCarlo = (function () {
    'use strict';

    var PC = null;
    function _pc() { if (!PC) PC = PhysicsCore; return PC; }

    var KT2MS = 0.514444, DEG2RAD = Math.PI / 180, RAD2DEG = 180 / Math.PI;

    // ── Defaults ──────────────────────────────────────────────
    var DEFAULTS = {
        N: 100,
        windSigma: { spd: 3, dir: 15, correlation: 0.7 },
        jumperSigma: {
            vc: 0.05, vzVoile: 0.08, glide: 0.10, hOuv: 50, skill: 0.1,
            // Angular spreads (deg) — overridable per jumper via .subAngleSigma / .trackAxisSigma
            subAngle: 20,    // group radial separation direction noise per sub-jumper
            trackAxis: 15    // tracking heading noise (single offset for the whole tracking phase)
        },
        sigmaScale: 2,        // ellipse extent: 1σ ≈ 39%, 2σ ≈ 86%, 3σ ≈ 99%
        sampleInterval: 2.0,  // seconds — trajectory sampling step
        sampleMaxT: 200,      // seconds — cap on trajectory sampling
        keepRawTrajectories: true  // store per-iteration sampled trajectories for heatmap
    };

    // ── Gaussian random (Box-Muller) ───────────────────────────
    function gaussRandom() {
        var u1 = Math.random(), u2 = Math.random();
        return Math.sqrt(-2 * Math.log(u1 + 1e-30)) * Math.cos(2 * Math.PI * u2);
    }

    // ── Perturb wind profile with AR(1) correlated noise on E/N ───
    // Perturbing E/N components (rather than spd/dir independently) avoids
    // direction flips at low wind speed and respects the vectorial nature
    // of wind. The per-layer tangential component scales with the layer's
    // own wind speed so that "σ direction" stays meaningful across altitudes.
    function perturbWind(profile, sigma) {
        sigma = sigma || {};
        var spdSms = (sigma.spd || 3) * KT2MS;
        var dirSrad = (sigma.dir || 15) * DEG2RAD;
        var corr = sigma.correlation !== undefined ? sigma.correlation : 0.7;
        var sq = Math.sqrt(1 - corr * corr);
        var prevE = 0, prevN = 0;
        var sorted = profile.slice().sort(function (a, b) { return a.z - b.z; });

        return sorted.map(function (layer) {
            var s0 = (layer.spd || 0) * KT2MS;
            var d0 = (layer.dir || 0) * DEG2RAD;
            var e0 = -s0 * Math.sin(d0);
            var n0 = -s0 * Math.cos(d0);

            var sigEN = Math.sqrt(spdSms * spdSms + (s0 * dirSrad) * (s0 * dirSrad));
            var eN = corr * prevE + sq * gaussRandom() * sigEN;
            var nN = corr * prevN + sq * gaussRandom() * sigEN;
            prevE = eN; prevN = nN;

            var eNew = e0 + eN, nNew = n0 + nN;
            var sNew = Math.sqrt(eNew * eNew + nNew * nNew);
            var dNew = (Math.atan2(-eNew, -nNew) * RAD2DEG + 360) % 360;

            return {
                z: layer.z, hpa: layer.hpa,
                spd: sNew / KT2MS,
                dir: dNew,
                temp: layer.temp || 15,
                geoH: layer.geoH || layer.z
            };
        });
    }

    // ── Perturb jumper parameters ──────────────────────────────
    function perturbJumpers(jumpers, sigma) {
        sigma = sigma || {};
        var vcS = sigma.vc != null ? sigma.vc : 0.05;
        var vzS = sigma.vzVoile != null ? sigma.vzVoile : 0.08;
        var glideS = sigma.glide != null ? sigma.glide : 0.10;
        var hOuvS = sigma.hOuv != null ? sigma.hOuv : 50;
        var skillS = sigma.skill != null ? sigma.skill : 0.1;
        var subAngleS = sigma.subAngle != null ? sigma.subAngle : DEFAULTS.jumperSigma.subAngle;
        var trackAxisS = sigma.trackAxis != null ? sigma.trackAxis : DEFAULTS.jumperSigma.trackAxis;

        return jumpers.map(function (j) {
            // Per-typology overrides take precedence over global sigmas
            var subSigJ = j.subAngleSigma != null ? j.subAngleSigma : subAngleS;
            var trackSigJ = j.trackAxisSigma != null ? j.trackAxisSigma : trackAxisS;
            var brkSigJ = j.breakoffAxisSigma != null ? j.breakoffAxisSigma : trackSigJ;
            var nbGroup = Math.max(1, parseInt(j.nbPara) || 1);

            // One angular noise per sub-jumper (so a 4-way group really fans out)
            var subAngleNoise = [];
            for (var s = 0; s < nbGroup; s++) subAngleNoise.push(gaussRandom() * subSigJ);

            var trackNoise = (j.isTracking || j.flipProb > 0) ? gaussRandom() * trackSigJ : 0;
            var breakoffNoise = (j.breakoffDist > 0) ? gaussRandom() * brkSigJ : 0;
            var flipped = 0;
            if (j.flipProb && Math.random() < j.flipProb) flipped = 180;

            // Per-sub overrides (e.g. PAC moniteur in a PAC group). Each sub
            // gets its own perturbation chain for the fields it overrides.
            var subOverridesPerturbed = null;
            if (j.subOverrides && j.subOverrides.length) {
                subOverridesPerturbed = j.subOverrides.map(function (so) {
                    var perturbedSO = Object.assign({}, so);
                    if (so.vc != null)      perturbedSO.vc = so.vc * (1 + gaussRandom() * vcS);
                    if (so.vzVoile != null) perturbedSO.vzVoile = so.vzVoile * (1 + gaussRandom() * vzS);
                    if (so.glide != null)   perturbedSO.glide = so.glide * (1 + gaussRandom() * glideS);
                    if (so.hOuv != null)    perturbedSO.hOuv = so.hOuv + gaussRandom() * hOuvS;
                    if (so.skill != null)   perturbedSO.skill = Math.max(0.2, Math.min(1.0,
                        so.skill + gaussRandom() * skillS));
                    // Per-sub break-off heading noise + optional flip
                    var soFlip = 0;
                    if (so.flipProb && Math.random() < so.flipProb) soFlip = 180;
                    var soBrkSig = so.breakoffAxisSigma != null ? so.breakoffAxisSigma : brkSigJ;
                    var soBreakoff = ((so.breakoffDist > 0) ? gaussRandom() * soBrkSig : 0) + soFlip;
                    perturbedSO._breakoffAxisNoise = soBreakoff;
                    perturbedSO._flipped = !!soFlip;
                    return perturbedSO;
                });
            }

            return Object.assign({}, j, {
                vc: (j.vc || 50) * (1 + gaussRandom() * vcS),
                vzVoile: (j.vzVoile || 5) * (1 + gaussRandom() * vzS),
                glide: (j.glide || 2.5) * (1 + gaussRandom() * glideS),
                hOuv: (j.hOuv || 1000) + gaussRandom() * hOuvS,
                skill: Math.max(0.2, Math.min(1.0, (j.skill || 0.8) + gaussRandom() * skillS)),
                _mcPilotNoise: gaussRandom(),
                _subAngleNoise: subAngleNoise,
                _trackAxisNoise: trackNoise + flipped,
                _breakoffAxisNoise: breakoffNoise,
                _flipped: !!flipped,
                subOverrides: subOverridesPerturbed || j.subOverrides
            });
        });
    }

    // ── Trajectory time-sample ────────────────────────────────
    // sp is array of {t, x, y, z}. Returns position at absolute time t,
    // null if t is out of bounds.
    function _interpAt(sp, t) {
        if (!sp.length) return null;
        if (t < sp[0].t || t > sp[sp.length - 1].t) return null;
        var lo = 0, hi = sp.length - 1;
        while (hi - lo > 1) {
            var mid = (lo + hi) >> 1;
            if (sp[mid].t <= t) lo = mid; else hi = mid;
        }
        var f = (t - sp[lo].t) / Math.max(sp[hi].t - sp[lo].t, 1e-9);
        return {
            x: sp[lo].x + f * (sp[hi].x - sp[lo].x),
            y: sp[lo].y + f * (sp[hi].y - sp[lo].y),
            z: sp[lo].z + f * (sp[hi].z - sp[lo].z)
        };
    }

    /**
     * Run N Monte-Carlo iterations of a full pass simulation.
     * @param {Object} baseCfg  – Config for PhysicsCore.simPass (must include _windProfile)
     * @param {Object} options  – { N, windSigma, jumperSigma, sigmaScale, sampleInterval, sampleMaxT, progressFn }
     */
    function run(baseCfg, options, progressFn) {
        options = options || {};
        var N = options.N || DEFAULTS.N;
        var windSigma = Object.assign({}, DEFAULTS.windSigma, options.windSigma || {});
        var jSigma = Object.assign({}, DEFAULTS.jumperSigma, options.jumperSigma || {});
        var sigmaScale = options.sigmaScale || DEFAULTS.sigmaScale;
        var dt = options.sampleInterval || DEFAULTS.sampleInterval;
        var tMax = options.sampleMaxT || DEFAULTS.sampleMaxT;

        // Build relative-time bins (0, dt, 2dt, ...) for trajectory sampling
        var nBins = Math.max(1, Math.floor(tMax / dt) + 1);
        var bins = new Array(nBins);
        for (var bi = 0; bi < nBins; bi++) bins[bi] = bi * dt;

        var keepRaw = options.keepRawTrajectories !== false;
        var baseWind = baseCfg._windProfile || baseCfg.windProfile || [];
        var baseJumpers = baseCfg.jumpers || [];
        // Count total sub-jumpers (simPass produces one positions[] entry per
        // sub-jumper, so a group with nbPara=2 contributes 2 entries).
        var nGroups = baseCfg.nPara || baseJumpers.length;
        var nPara = 0;
        for (var nk = 0; nk < nGroups; nk++) {
            var src = baseJumpers[nk] || baseJumpers[baseJumpers.length - 1] || {};
            nPara += Math.max(1, parseInt(src.nbPara) || 1);
        }
        if (nPara === 0) nPara = baseJumpers.length || 1;

        // Per-jumper accumulators
        var openE = [], openN = [], landE = [], landN = [], marges = [];
        var trajSamplesE = [], trajSamplesN = [];   // [j][bi] = [iter values] (for ellipses)
        var iterTraj = [];                           // [j][iter] = [{e,n,z,t}] (for heatmap)
        for (var j = 0; j < nPara; j++) {
            openE.push([]); openN.push([]);
            landE.push([]); landN.push([]);
            marges.push([]);
            var aE = new Array(nBins), aN = new Array(nBins);
            for (var b2 = 0; b2 < nBins; b2++) { aE[b2] = []; aN[b2] = []; }
            trajSamplesE.push(aE); trajSamplesN.push(aN);
            iterTraj.push([]);
        }
        var sepMins = [];                  // min inter-group sep per iteration
        var outOfZoneByIter = [];          // # paras whose margeRDV<0 per iter
        var goCount = 0, reachCount = 0, safetyCount = 0, criticalCount = 0;
        var pairAccum = {};                // {idxA-idxB: [dist, dist, ...]}

        for (var i = 0; i < N; i++) {
            // INVARIANT: wind variability is shared across the whole drop pass.
            // perturbWind() is called ONCE per iteration → all jumpers in that
            // iteration's simPass call experience the same perturbed wind profile
            // (set globally on PhysicsCore below). Different iterations of MC
            // sample independent wind realizations.
            var pWind = perturbWind(baseWind, windSigma);
            var pJumpers = perturbJumpers(baseJumpers, jSigma);
            var mcNoise = pJumpers.map(function (jp) { return jp._mcPilotNoise; });

            // Per-group exit-time noise (asymmetric, biased positive) :
            //   noise[k] = max(-0.5, gauss * 1.0 + 0.7)
            // Mean +0.7 s, σ ≈ 1 s, clamp -0.5 s. Reflète le fait qu'en
            // pratique on part rarement plus tôt que prévu mais souvent
            // 1-2 s plus tard (climb-out hésitant, contre-ordre, etc.).
            // Steven Geens « Exit Separation » : la variance temporelle
            // est asymétrique avec une queue vers les délais longs.
            var gapNoise = pJumpers.map(function () {
                var g = gaussRandom() * 1.0 + 0.7;
                return g < -0.5 ? -0.5 : g;
            });

            _pc().setWindProfile(pWind);
            _pc().enableWindCache(Math.ceil(baseCfg.altM) + 100);

            var cfg = Object.assign({}, baseCfg, {
                jumpers: pJumpers,
                _mcNoise: mcNoise,
                _gapNoise: gapNoise,
                dtCfg: { ff: 0.25, open: 0.1, canopy: 0.5 }
            });

            var res = _pc().simPass(cfg);
            if (res.go) goCount++;
            if (res.reachOk) reachCount++;
            if (res.safetyOk) safetyCount++;
            if (res.criticalOk) criticalCount++;

            // Min inter-group sep (intra-group pairs are intentional and skipped)
            var minInter = Infinity;
            res.allPairMinDists.forEach(function (m) {
                if (m.intraGroup) return;
                if (m.dist < minInter) minInter = m.dist;
                var key = m.idxA + '-' + m.idxB;
                if (!pairAccum[key]) pairAccum[key] = { idxA: m.idxA, idxB: m.idxB, dists: [] };
                pairAccum[key].dists.push(m.dist);
            });
            sepMins.push(minInter === Infinity ? 9999 : minInter);

            var nSeen = Math.min(nPara, res.positions.length);
            var iterOutOfZone = 0;
            for (var jj = 0; jj < nSeen; jj++) {
                var pos = res.positions[jj];
                openE[jj].push(pos.open.e); openN[jj].push(pos.open.n);
                landE[jj].push(pos.land.e); landN[jj].push(pos.land.n);
                marges[jj].push(pos.margeRDV);
                if (pos.margeRDV != null && pos.margeRDV < 0) iterOutOfZone++;

                // Sample trajectory at relative time bins
                var traj = res.timedTrajs && res.timedTrajs[jj];
                if (traj && traj.sp && traj.sp.length) {
                    var t0 = traj.t0 || (traj.sp[0] ? traj.sp[0].t : 0);
                    var thisIter = keepRaw ? [] : null;
                    for (var bi2 = 0; bi2 < nBins; bi2++) {
                        var p = _interpAt(traj.sp, t0 + bins[bi2]);
                        if (p) {
                            trajSamplesE[jj][bi2].push(p.x);
                            trajSamplesN[jj][bi2].push(p.y);
                            if (thisIter) thisIter.push({ e: p.x, n: p.y, z: p.z, t: bins[bi2] });
                        }
                    }
                    if (thisIter && thisIter.length) iterTraj[jj].push(thisIter);
                }
            }
            outOfZoneByIter.push(iterOutOfZone);

            if (progressFn && (i % 5 === 0 || i === N - 1)) progressFn(i + 1, N);
        }

        // Restore base wind profile (optimizer phases may run after)
        _pc().setWindProfile(baseWind);
        _pc().enableWindCache(Math.ceil(baseCfg.altM) + 100);

        var safetyThresh = options.safetyThresh != null ? options.safetyThresh
            : (baseCfg.safetyThresh != null ? baseCfg.safetyThresh : 78);
        var criticalThresh = options.criticalThresh != null ? options.criticalThresh
            : (baseCfg.criticalThresh != null ? baseCfg.criticalThresh : 30);

        var out = _analyze({
            nPara: nPara, openE: openE, openN: openN, landE: landE, landN: landN,
            marges: marges, sepMins: sepMins, outOfZoneByIter: outOfZoneByIter,
            goCount: goCount, reachCount: reachCount,
            safetyCount: safetyCount, criticalCount: criticalCount,
            pairAccum: pairAccum,
            safetyThresh: safetyThresh, criticalThresh: criticalThresh,
            N: N, sigmaScale: sigmaScale, bins: bins,
            trajSamplesE: trajSamplesE, trajSamplesN: trajSamplesN,
            params: {
                windSigma: windSigma, jumperSigma: jSigma, sigmaScale: sigmaScale,
                sampleInterval: dt, safetyThresh: safetyThresh, criticalThresh: criticalThresh
            }
        });
        if (keepRaw) out.rawTrajectories = iterTraj;
        return out;
    }

    function _analyze(d) {
        var goProb = d.goCount / d.N;
        var jumperStats = [];

        for (var j = 0; j < d.nPara; j++) {
            var mSorted = d.marges[j].slice().sort(function (a, b) { return a - b; });
            var trajEllipses = [];
            for (var bi = 0; bi < d.bins.length; bi++) {
                var es = d.trajSamplesE[j][bi];
                var ns = d.trajSamplesN[j][bi];
                if (es.length < 3) continue;  // skip bins with too few samples
                var ell = computeEllipse(es, ns, d.sigmaScale);
                trajEllipses.push({ t: d.bins[bi], n: es.length, ellipse: ell });
            }
            // Fréquence "hors zone" pour ce jumper = % d'itérations où
            // il n'atterrit pas dans la zone de posé (margeRDV < 0).
            var nOutZone = mSorted.filter(function (x) { return x < 0; }).length;
            jumperStats.push({
                openEllipse: computeEllipse(d.openE[j], d.openN[j], d.sigmaScale),
                landEllipse: computeEllipse(d.landE[j], d.landN[j], d.sigmaScale),
                margeP5: _pct(mSorted, 0.05),
                margeP25: _pct(mSorted, 0.25),
                margeP50: _pct(mSorted, 0.50),
                margeP75: _pct(mSorted, 0.75),
                margeP95: _pct(mSorted, 0.95),
                pOutZone: d.N > 0 ? nOutZone / d.N : 0,
                nOutZone: nOutZone,
                trajectoryEllipses: trajEllipses
            });
        }

        var sepSorted = d.sepMins.slice().sort(function (a, b) { return a - b; });

        // Two distinct verdicts (per Steven Geens / user spec):
        //   - reach    : GO ≥ 95 %, MARGINAL 80–95 %, NOGO < 80 %
        //   - safety   : GO ≥ 99 %, MARGINAL 95–99 %, NOGO < 95 %  (i.e. P(unsafe) ≤ 1 %)
        //   - critical : ACCEPTABLE ≤ 0.1 %, WARN 0.1–1 %, CRITICAL > 1 %
        var reachProb = d.reachCount / d.N;
        var safetyProb = d.safetyCount / d.N;
        var criticalRisk = (d.N - d.criticalCount) / d.N;  // P(min sep < critThresh)

        function _v3(p, hi, mid) {
            return p >= hi ? 'GO' : p >= mid ? 'MARGINAL' : 'NOGO';
        }
        function _vCrit(r) {
            return r <= 0.001 ? 'ACCEPTABLE' : r <= 0.01 ? 'WARN' : 'CRITICAL';
        }

        // Per-pair statistics (excluding intra-group, those aren't accumulated)
        var pairStats = Object.keys(d.pairAccum).map(function (k) {
            var pa = d.pairAccum[k];
            var sorted = pa.dists.slice().sort(function (a, b) { return a - b; });
            var nViol = sorted.filter(function (x) { return x < d.safetyThresh; }).length;
            var nCrit = sorted.filter(function (x) { return x < d.criticalThresh; }).length;
            return {
                idxA: pa.idxA, idxB: pa.idxB,
                p5: _pct(sorted, 0.05), p50: _pct(sorted, 0.50), p95: _pct(sorted, 0.95),
                min: sorted[0], max: sorted[sorted.length - 1],
                pUnsafe: nViol / sorted.length,
                pCritical: nCrit / sorted.length
            };
        }).sort(function (a, b) { return a.p5 - b.p5; });

        return {
            N: d.N,
            // Legacy combined verdict (kept for backwards compat)
            goProb: d.goCount / d.N,
            verdict: (reachProb >= 0.95 && safetyProb >= 0.99 && criticalRisk <= 0.001) ? 'GO'
                   : (reachProb >= 0.80 && safetyProb >= 0.95 && criticalRisk <= 0.01) ? 'MARGINAL'
                   : 'NOGO',
            // ── Reach (zone RDV à altitude voulue) ─────────────
            reachProb: reachProb,
            reachVerdict: _v3(reachProb, 0.95, 0.80),
            // ── Sécurité (séparation > seuil Geens 78 m) ───────
            safetyProb: safetyProb,
            safetyVerdict: _v3(safetyProb, 0.99, 0.95),
            safetyThresh: d.safetyThresh,
            // ── Risque critique (séparation < 30 m collision) ──
            criticalRisk: criticalRisk,
            criticalVerdict: _vCrit(criticalRisk),
            criticalThresh: d.criticalThresh,
            // ── Stats par paire ────────────────────────────────
            pairStats: pairStats,
            jumperStats: jumperStats,
            sepP5: _pct(sepSorted, 0.05),
            sepP50: _pct(sepSorted, 0.50),
            // Histogramme de la séparation min inter-paras (un point
            // par itération MC). Bins de 25 m de 0 à max(sepMins).
            sepHistogram: _histogram(d.sepMins, 25, 0, 500),
            // Distribution du nombre de paras hors zone par itération
            outOfZoneByIter: d.outOfZoneByIter || [],
            outOfZoneHistogram: _histogram(d.outOfZoneByIter || [], 1, 0, d.nPara + 1),
            outOfZoneMean: (d.outOfZoneByIter || []).reduce(function (s, v) { return s + v; }, 0) /
                Math.max(1, (d.outOfZoneByIter || []).length),
            params: d.params
        };
    }

    function _histogram(values, binSize, lo, hi) {
        if (!values || !values.length) return { bins: [], counts: [] };
        var nBins = Math.ceil((hi - lo) / binSize);
        var bins = [], counts = [];
        for (var i = 0; i < nBins; i++) {
            bins.push(lo + i * binSize);
            counts.push(0);
        }
        for (var k = 0; k < values.length; k++) {
            var v = values[k];
            if (v >= hi) continue;
            var idx = Math.floor((v - lo) / binSize);
            if (idx < 0) continue;
            if (idx >= nBins) idx = nBins - 1;
            counts[idx]++;
        }
        return { bins: bins, counts: counts, binSize: binSize };
    }

    function _pct(sorted, p) {
        if (!sorted.length) return 0;
        var idx = Math.floor(p * sorted.length);
        return sorted[Math.min(idx, sorted.length - 1)];
    }

    /**
     * 2D ellipse from a cloud of points, scaled to ±sigmaScale standard deviations.
     * For 2D Gaussian: chi² = sigmaScale² ⇒
     *   1σ ≈ 39%, 2σ ≈ 86%, 3σ ≈ 99% inclusion.
     * Returns { cx, cy, a, b, angle, points, n }.
     */
    function computeEllipse(xs, ys, sigmaScale) {
        sigmaScale = sigmaScale || 2;
        var n = xs.length;
        if (n < 3) return { cx: xs[0] || 0, cy: ys[0] || 0, a: 0, b: 0, angle: 0, points: [], n: n };

        var mx = 0, my = 0;
        for (var i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
        mx /= n; my /= n;

        var sxx = 0, syy = 0, sxy = 0;
        for (var i = 0; i < n; i++) {
            var dx = xs[i] - mx, dy = ys[i] - my;
            sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
        }
        sxx /= n; syy /= n; sxy /= n;

        var trace = sxx + syy;
        var det = sxx * syy - sxy * sxy;
        var disc = Math.sqrt(Math.max(0, trace * trace / 4 - det));
        var l1 = Math.max(trace / 2 + disc, 0.01);
        var l2 = Math.max(trace / 2 - disc, 0.01);

        // chi² for 2D Mahalanobis at sigmaScale standard deviations
        var chi2 = sigmaScale * sigmaScale;
        var angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);

        var a = Math.sqrt(chi2 * l1);
        var b = Math.sqrt(chi2 * l2);
        var pts = [];
        var cosA = Math.cos(angle), sinA = Math.sin(angle);
        for (var t = 0; t < 2 * Math.PI; t += 0.15) {
            var ex = a * Math.cos(t), ey = b * Math.sin(t);
            pts.push({ e: mx + ex * cosA - ey * sinA, n: my + ex * sinA + ey * cosA });
        }

        return { cx: mx, cy: my, a: a, b: b, angle: angle * 180 / Math.PI, points: pts, n: n };
    }

    // ── LEAFLET RENDERING ──────────────────────────────────────
    var _ellipseLayers = [];
    var _tubeLayers = [];
    var _heatmapLayers = [];

    var DEFAULT_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

    function _enToLatLng(e, n, dz, cosLat) {
        return [dz.lat + n / 111320, dz.lon + e / (111320 * cosLat)];
    }

    function drawEllipses(map, mcResult, dz) {
        if (!map || typeof L === 'undefined') return;
        clearEllipses(map);

        var cosLat = Math.cos(dz.lat * Math.PI / 180);
        mcResult.jumperStats.forEach(function (js, idx) {
            var color = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
            _drawOneEllipse(map, js.openEllipse, dz, cosLat, color, true, _ellipseLayers);
            _drawOneEllipse(map, js.landEllipse, dz, cosLat, color, false, _ellipseLayers);
        });
    }

    function _drawOneEllipse(map, ell, dz, cosLat, color, dashed, store) {
        if (!ell || !ell.points || !ell.points.length) return;
        var latLngs = ell.points.map(function (p) { return _enToLatLng(p.e, p.n, dz, cosLat); });
        var poly = L.polygon(latLngs, {
            color: color, fillColor: color,
            fillOpacity: dashed ? 0.05 : 0.10,
            weight: dashed ? 1.5 : 2,
            dashArray: dashed ? '6,4' : null
        }).addTo(map);
        store.push(poly);
    }

    /**
     * Draw a per-jumper continuous "uncertainty corridor" along the entire
     * mean trajectory: at each sampled time bin we project the ellipse on the
     * local perpendicular to form upper/lower envelopes. Drawn as a strip of
     * independent quadrilaterals (one per pair of consecutive bins) so the
     * union remains correctly filled even when the trajectory loops back on
     * itself (a single self-intersecting polygon would punch holes via the
     * SVG even-odd / non-zero fill rule).
     */
    function drawTrajectoryUncertainty(map, mcResult, dz) {
        if (!map || typeof L === 'undefined') return;
        clearTrajectoryUncertainty(map);

        var cosLat = Math.cos(dz.lat * Math.PI / 180);

        mcResult.jumperStats.forEach(function (js, idx) {
            var color = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
            var ells = (js.trajectoryEllipses || []).filter(function (te) {
                return te.ellipse && te.ellipse.points && te.ellipse.points.length;
            });
            if (ells.length < 2) return;

            // Mean centerline
            var center = ells.map(function (te) {
                return _enToLatLng(te.ellipse.cx, te.ellipse.cy, dz, cosLat);
            });
            var line = L.polyline(center, { color: color, weight: 1.6, opacity: 0.85 }).addTo(map);
            line.bindTooltip('P' + (idx + 1) + ' — trajectoire moyenne', { sticky: true });
            _tubeLayers.push(line);

            // Build upper/lower envelope (E/N coords) then convert pairwise.
            var envelope = _buildCorridorEnvelope(ells);
            if (!envelope) return;

            var upper = envelope.upper, lower = envelope.lower;

            // Strip of quadrilateral patches: each segment is a simple,
            // non-self-intersecting polygon, so overlap regions just paint
            // over each other (their fill accumulates) instead of cancelling.
            var groupOpts = {
                color: color, fillColor: color,
                fillOpacity: 0.10, weight: 0, opacity: 0,
                stroke: false, smoothFactor: 0
            };
            for (var i = 0; i < ells.length - 1; i++) {
                var quad = [
                    _enToLatLng(upper[i].e, upper[i].n, dz, cosLat),
                    _enToLatLng(upper[i + 1].e, upper[i + 1].n, dz, cosLat),
                    _enToLatLng(lower[i + 1].e, lower[i + 1].n, dz, cosLat),
                    _enToLatLng(lower[i].e, lower[i].n, dz, cosLat)
                ];
                var patch = L.polygon(quad, groupOpts).addTo(map);
                _tubeLayers.push(patch);
            }

            // Thin upper/lower guide lines (continuous, no fill)
            var upperLL = upper.map(function (p) { return _enToLatLng(p.e, p.n, dz, cosLat); });
            var lowerLL = lower.map(function (p) { return _enToLatLng(p.e, p.n, dz, cosLat); });
            _tubeLayers.push(L.polyline(upperLL, { color: color, weight: 0.7, opacity: 0.5, dashArray: '2,3' }).addTo(map));
            _tubeLayers.push(L.polyline(lowerLL, { color: color, weight: 0.7, opacity: 0.5, dashArray: '2,3' }).addTo(map));
        });
    }

    function _buildCorridorEnvelope(ells) {
        if (!ells || ells.length < 2) return null;
        var upper = [], lower = [];

        for (var i = 0; i < ells.length; i++) {
            var ell = ells[i].ellipse;

            // Local tangent direction (centred difference where possible)
            var tx, ty;
            if (i === 0) {
                tx = ells[1].ellipse.cx - ell.cx;
                ty = ells[1].ellipse.cy - ell.cy;
            } else if (i === ells.length - 1) {
                tx = ell.cx - ells[i - 1].ellipse.cx;
                ty = ell.cy - ells[i - 1].ellipse.cy;
            } else {
                tx = ells[i + 1].ellipse.cx - ells[i - 1].ellipse.cx;
                ty = ells[i + 1].ellipse.cy - ells[i - 1].ellipse.cy;
            }
            var len = Math.sqrt(tx * tx + ty * ty);
            if (len < 1e-6) { tx = 1; ty = 0; len = 1; }
            tx /= len; ty /= len;

            // Perpendicular (rotate +90°)
            var px = -ty, py = tx;

            // Project each ellipse boundary point on the perpendicular and
            // keep the extreme positive / negative extents.
            var maxProj = -Infinity, minProj = Infinity;
            var pts = ell.points;
            for (var p = 0; p < pts.length; p++) {
                var proj = (pts[p].e - ell.cx) * px + (pts[p].n - ell.cy) * py;
                if (proj > maxProj) maxProj = proj;
                if (proj < minProj) minProj = proj;
            }
            if (!isFinite(maxProj)) { maxProj = 0; minProj = 0; }

            upper.push({ e: ell.cx + px * maxProj, n: ell.cy + py * maxProj });
            lower.push({ e: ell.cx + px * minProj, n: ell.cy + py * minProj });
        }
        return { upper: upper, lower: lower };
    }

    function clearEllipses(map) {
        if (!map) return;
        _ellipseLayers.forEach(function (l) { map.removeLayer(l); });
        _ellipseLayers = [];
    }

    function clearTrajectoryUncertainty(map) {
        if (!map) return;
        _tubeLayers.forEach(function (l) { map.removeLayer(l); });
        _tubeLayers = [];
    }

    function clearTrajectoryHeatmap(map) {
        if (!map) return;
        _heatmapLayers.forEach(function (l) { map.removeLayer(l); });
        _heatmapLayers = [];
    }

    function clearAll(map) {
        clearEllipses(map);
        clearTrajectoryUncertainty(map);
        clearTrajectoryHeatmap(map);
    }

    /**
     * Strava-style heatmap: every simulated trajectory is drawn as a thin
     * translucent polyline in the jumper's colour. Overlaps accumulate alpha,
     * producing a dense band where many runs converge.
     *
     * Per-jumper opacity is set so total accumulated alpha ≈ 0.7 at full
     * overlap of N iterations.
     */
    function drawTrajectoryHeatmap(map, mcResult, dz) {
        if (!map || typeof L === 'undefined') return;
        clearTrajectoryHeatmap(map);
        if (!mcResult.rawTrajectories) return;

        var cosLat = Math.cos(dz.lat * Math.PI / 180);
        var raw = mcResult.rawTrajectories;
        var N = mcResult.N || 100;
        // Empirically: alpha = 1 - (1-a)^N → solve a so total ≈ 0.7
        // a = 1 - 0.3^(1/N) ≈ 0.012 for N=100. Add a floor for low N.
        var perLineAlpha = Math.max(0.04, Math.min(0.25, 1 - Math.pow(0.30, 1 / Math.max(N, 1))));

        for (var j = 0; j < raw.length; j++) {
            var color = DEFAULT_COLORS[j % DEFAULT_COLORS.length];
            var iters = raw[j];
            for (var i = 0; i < iters.length; i++) {
                var pts = iters[i];
                if (!pts || pts.length < 2) continue;
                var ll = pts.map(function (p) { return _enToLatLng(p.e, p.n, dz, cosLat); });
                var line = L.polyline(ll, {
                    color: color, weight: 0.8, opacity: perLineAlpha,
                    smoothFactor: 1.5, interactive: false
                }).addTo(map);
                _heatmapLayers.push(line);
            }
        }
    }

    /**
     * Same heatmap but projected onto the cross-section (along-track, alt)
     * plane. Renders directly into a D3 selection (a parent <g> element)
     * using the provided x/y scales.
     *
     * @param {d3.Selection} g       D3 group to draw into
     * @param {Object}       mcResult
     * @param {number}       trackE  drop axis E-component
     * @param {number}       trackN  drop axis N-component
     * @param {number}       elevM   ground elevation AMSL
     * @param {Function}     xS      D3 scale: along-track meters → px
     * @param {Function}     yS      D3 scale: height AGL meters → px
     */
    function drawTransversalHeatmap(g, mcResult, trackE, trackN, elevM, xS, yS) {
        if (!g || !mcResult || !mcResult.rawTrajectories) return;
        // Clean previous overlay (if any)
        g.selectAll('.mc-heatmap-path').remove();

        var raw = mcResult.rawTrajectories;
        var N = mcResult.N || 100;
        var perAlpha = Math.max(0.04, Math.min(0.25, 1 - Math.pow(0.30, 1 / Math.max(N, 1))));
        var hmGroup = g.append('g').attr('class', 'mc-heatmap-path');

        for (var j = 0; j < raw.length; j++) {
            var color = DEFAULT_COLORS[j % DEFAULT_COLORS.length];
            var iters = raw[j];
            for (var i = 0; i < iters.length; i++) {
                var pts = iters[i];
                if (!pts || pts.length < 2) continue;
                var d = '';
                for (var k = 0; k < pts.length; k++) {
                    var x = xS(pts[k].e * trackE + pts[k].n * trackN);
                    var y = yS(Math.max(0, pts[k].z - elevM));
                    d += (k === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
                }
                hmGroup.append('path').attr('d', d)
                    .attr('fill', 'none').attr('stroke', color)
                    .attr('stroke-width', 0.8).attr('opacity', perAlpha);
            }
        }
    }

    function clearTransversalHeatmap(g) {
        if (g) g.selectAll('.mc-heatmap-path').remove();
    }

    /**
     * Per-jumper uncertainty corridor projected onto the transversal cut
     * (along-track distance × altitude AGL). Same algorithm as the map tube
     * but the per-bin ellipse is computed in (along-track, alt) space.
     */
    function drawTransversalTube(g, mcResult, trackE, trackN, elevM, xS, yS) {
        if (!g || !mcResult || !mcResult.rawTrajectories) return;
        clearTransversalTube(g);
        var sigmaScale = (mcResult.params && mcResult.params.sigmaScale) || 2;
        var raw = mcResult.rawTrajectories;
        var tubeGroup = g.append('g').attr('class', 'mc-transv-tube');

        for (var j = 0; j < raw.length; j++) {
            var color = DEFAULT_COLORS[j % DEFAULT_COLORS.length];
            var iters = raw[j];
            if (!iters.length) continue;
            var nBins = iters[0].length;

            // Build per-bin transversal ellipse (in along-track / alt-AGL plane)
            var ells = [];
            for (var bi = 0; bi < nBins; bi++) {
                var alongs = [], alts = [];
                for (var i = 0; i < iters.length; i++) {
                    var pt = iters[i] && iters[i][bi];
                    if (pt) {
                        alongs.push(pt.e * trackE + pt.n * trackN);
                        alts.push(Math.max(0, pt.z - elevM));
                    }
                }
                if (alongs.length < 3) continue;
                var ell = computeEllipse(alongs, alts, sigmaScale);
                if (ell && ell.points.length) ells.push({ t: iters[0][bi].t, ellipse: ell });
            }
            if (ells.length < 2) continue;

            // Mean centerline in chart coords
            var dCenter = '';
            for (var k = 0; k < ells.length; k++) {
                var e = ells[k].ellipse;
                var x = xS(e.cx), y = yS(e.cy);
                dCenter += (k === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
            }
            tubeGroup.append('path').attr('d', dCenter)
                .attr('fill', 'none').attr('stroke', color)
                .attr('stroke-width', 1.5).attr('opacity', 0.85);

            // Build envelope and render as a strip of independent quadrilaterals
            // (each one is convex so SVG fill never punches holes via parity rule).
            var envelope = _buildCorridorEnvelope(ells);
            if (!envelope) continue;
            for (var k2 = 0; k2 < ells.length - 1; k2++) {
                var u0 = envelope.upper[k2], u1 = envelope.upper[k2 + 1];
                var l0 = envelope.lower[k2], l1 = envelope.lower[k2 + 1];
                var d = 'M' + xS(u0.e).toFixed(1) + ',' + yS(u0.n).toFixed(1) +
                        'L' + xS(u1.e).toFixed(1) + ',' + yS(u1.n).toFixed(1) +
                        'L' + xS(l1.e).toFixed(1) + ',' + yS(l1.n).toFixed(1) +
                        'L' + xS(l0.e).toFixed(1) + ',' + yS(l0.n).toFixed(1) + 'Z';
                tubeGroup.append('path').attr('d', d)
                    .attr('fill', color).attr('fill-opacity', 0.10)
                    .attr('stroke', 'none');
            }
        }
    }

    function clearTransversalTube(g) {
        if (g) g.selectAll('.mc-transv-tube').remove();
    }

    return {
        run: run,
        DEFAULTS: DEFAULTS,
        drawEllipses: drawEllipses,
        drawTrajectoryUncertainty: drawTrajectoryUncertainty,
        drawTrajectoryHeatmap: drawTrajectoryHeatmap,
        drawTransversalHeatmap: drawTransversalHeatmap,
        drawTransversalTube: drawTransversalTube,
        clearEllipses: clearEllipses,
        clearTrajectoryUncertainty: clearTrajectoryUncertainty,
        clearTrajectoryHeatmap: clearTrajectoryHeatmap,
        clearTransversalHeatmap: clearTransversalHeatmap,
        clearTransversalTube: clearTransversalTube,
        clearAll: clearAll,
        computeEllipse: computeEllipse,
        perturbWind: perturbWind,
        perturbJumpers: perturbJumpers,
        gaussRandom: gaussRandom
    };
})();

if (typeof module !== 'undefined') module.exports = MonteCarlo;
