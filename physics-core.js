// ================================================================
//  PHYSICS-CORE.JS — Single source of truth for all physics
//  Used by both main thread and Web Workers
//  Zero DOM dependency
// ================================================================
var PhysicsCore = (function () {
    'use strict';

    // ── 1. CONSTANTS ───────────────────────────────────────────
    var G = 9.80665;
    var R_AIR = 287.058;
    var RHO0 = 1.225;
    var KT2MS = 0.514444;
    var NM2M = 1852;
    var DEG2RAD = Math.PI / 180;
    var RAD2DEG = 180 / Math.PI;

    // ── 2. ATMOSPHERE (ISA, 3 layers) ──────────────────────────
    function getAtmosphereRho(altM, isa) {
        isa = isa || 0;
        var T, P;
        if (altM <= 11000) {
            var Tstd = 288.15 - 0.0065 * altM;
            T = Tstd + isa;
            P = 101325 * Math.pow(Tstd / 288.15, 5.2559);
        } else if (altM <= 20000) {
            T = 216.65 + isa;
            var P11 = 101325 * Math.pow(216.65 / 288.15, 5.2559);
            P = P11 * Math.exp(-G * (altM - 11000) / (R_AIR * 216.65));
        } else {
            var Tstrat = 216.65 + 0.001 * (altM - 20000);
            T = Tstrat + isa;
            var P11b = 101325 * Math.pow(216.65 / 288.15, 5.2559);
            var P20 = P11b * Math.exp(-G * 9000 / (R_AIR * 216.65));
            P = P20 * Math.pow(Tstrat / 216.65, -G / (0.001 * R_AIR));
        }
        T = Math.max(T, 150);
        return P / (R_AIR * T);
    }

    // Density LUT: 0..13000 m, step 10 m, ISA+0
    var _lut = new Float64Array(1301);
    for (var _i = 0; _i <= 1300; _i++) _lut[_i] = getAtmosphereRho(_i * 10, 0);

    function getDensity(altM, isa) {
        isa = isa || 0;
        if (isa === 0 && altM >= 0 && altM <= 13000) {
            var idx = altM * 0.1, lo = idx | 0, hi = Math.min(lo + 1, 1300);
            return _lut[lo] + (idx - lo) * (_lut[hi] - _lut[lo]);
        }
        return getAtmosphereRho(altM, isa);
    }

    function densityCorrection(altM, isa) {
        return Math.sqrt(RHO0 / getDensity(altM, isa));
    }

    function computeTAS(kiasMs, altM, isa) {
        return kiasMs * densityCorrection(altM, isa);
    }

    // ── 3. WIND — Vectorial interpolation ─────────────────────
    //    Interpolates E/N components (NOT speed+direction separately).
    //    Surface log-profile below lowest layer.

    var _windProfile = [];  // sorted by z, pre-converted to _e/_n

    function setWindProfile(profile) {
        _windProfile = profile.slice().sort(function (a, b) { return a.z - b.z; });
        for (var i = 0; i < _windProfile.length; i++) {
            var w = _windProfile[i];
            var s = w.spd * KT2MS;
            var r = w.dir * DEG2RAD;
            w._e = -s * Math.sin(r);
            w._n = -s * Math.cos(r);
        }
        _wCacheE = null;
        _wCacheN = null;
    }

    var _wCacheE = null, _wCacheN = null;

    function enableWindCache(maxAlt) {
        maxAlt = maxAlt || 14000;
        _wCacheE = new Float64Array(maxAlt + 1);
        _wCacheN = new Float64Array(maxAlt + 1);
        for (var i = 0; i <= maxAlt; i++) _wCacheE[i] = -999999;
    }

    function windAtZ(z) {
        var k = z | 0;
        if (k < 0) k = 0;
        if (_wCacheE !== null && k < _wCacheE.length && _wCacheE[k] > -999998) {
            return { e: _wCacheE[k], n: _wCacheN[k] };
        }

        var p = _windProfile, ve, vn;
        if (!p.length) {
            ve = 0; vn = 0;
        } else if (z <= p[0].z) {
            // Surface log-profile (Prandtl law) below the lowest wind layer
            var z0 = 0.03;  // roughness length for grass/flat terrain
            var zRef = Math.max(p[0].z, 1);
            if (z <= z0) { ve = 0; vn = 0; }
            else {
                var factor = Math.log(z / z0) / Math.log(zRef / z0);
                ve = p[0]._e * factor;
                vn = p[0]._n * factor;
            }
        } else if (z >= p[p.length - 1].z) {
            ve = p[p.length - 1]._e;
            vn = p[p.length - 1]._n;
        } else {
            // Binary search
            var lo = 0, hi = p.length - 1;
            while (hi - lo > 1) {
                var mid = (lo + hi) >> 1;
                if (p[mid].z <= z) lo = mid; else hi = mid;
            }
            // VECTORIAL interpolation — interpolate E/N components, NOT speed+dir
            var f = (z - p[lo].z) / (p[hi].z - p[lo].z);
            ve = p[lo]._e + f * (p[hi]._e - p[lo]._e);
            vn = p[lo]._n + f * (p[hi]._n - p[lo]._n);
        }

        if (_wCacheE !== null && k < _wCacheE.length) {
            _wCacheE[k] = ve;
            _wCacheN[k] = vn;
        }
        return { e: ve, n: vn };
    }

    // ── 4. INTEGRATOR — RK4 + RK2, trackVec injected ──────────

    function deriv(s, vT, isa, trackVec) {
        var z = Math.max(s[2], 0), w = windAtZ(z);
        var vrx = s[3] - w.e, vry = s[4] - w.n, vrz = s[5];

        // Physical tracking: inject horizontal airspeed into relative wind
        if (trackVec) { vrx -= trackVec.e; vry -= trackVec.n; }

        var vn2 = Math.sqrt(vrx * vrx + vry * vry + vrz * vrz);
        if (vn2 < 0.01) vn2 = 0.01;
        var c = (getDensity(z, isa) / RHO0) * G / (vT * vT);
        return [
            s[3], s[4], s[5],
            -c * vn2 * vrx,
            -c * vn2 * vry,
            -G - c * vn2 * vrz
        ];
    }

    function rk4(s, dt, vT, isa, trackVec) {
        var k1 = deriv(s, vT, isa, trackVec);
        var s2 = new Array(6), s3 = new Array(6), s4 = new Array(6);
        for (var i = 0; i < 6; i++) s2[i] = s[i] + 0.5 * dt * k1[i];
        var k2 = deriv(s2, vT, isa, trackVec);
        for (var i = 0; i < 6; i++) s3[i] = s[i] + 0.5 * dt * k2[i];
        var k3 = deriv(s3, vT, isa, trackVec);
        for (var i = 0; i < 6; i++) s4[i] = s[i] + dt * k3[i];
        var k4d = deriv(s4, vT, isa, trackVec);
        var out = new Array(6);
        for (var i = 0; i < 6; i++)
            out[i] = s[i] + dt * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4d[i]) / 6;
        return out;
    }

    function rk2(s, dt, vT, isa) {
        var k1 = deriv(s, vT, isa);
        var sp = new Array(6);
        for (var i = 0; i < 6; i++) sp[i] = s[i] + dt * k1[i];
        var k2 = deriv(sp, vT, isa);
        var out = new Array(6);
        for (var i = 0; i < 6; i++) out[i] = s[i] + 0.5 * dt * (k1[i] + k2[i]);
        return out;
    }

    // ── 5. FREEFALL PHASE ──────────────────────────────────────
    //    trackVec is physically injected into RK4 derivatives.
    //    Returns { fs: finalState, sp: [{t,x,y,z}], tEnd }

    function simFreefall(s0, vT, targetZ, isa, t0, dt, trackVec) {
        dt = dt || 0.25;
        var s = s0.slice(), t = 0, sp = [];
        var maxIter = Math.ceil(600 / dt);

        for (var i = 0; i < maxIter; i++) {
            var ns = rk4(s, dt, vT, isa, trackVec || null);
            t += dt;
            if (ns[2] <= targetZ) {
                var frac = (s[2] - targetZ) / Math.max(s[2] - ns[2], 1e-6);
                frac = Math.max(0, Math.min(1, frac));
                var ex = new Array(6);
                for (var j = 0; j < 6; j++) ex[j] = s[j] + frac * (ns[j] - s[j]);
                ex[2] = targetZ;
                sp.push({ t: t0 + t, x: ex[0], y: ex[1], z: targetZ });
                return { fs: ex, sp: sp, tEnd: t0 + t };
            }
            sp.push({ t: t0 + t, x: ns[0], y: ns[1], z: ns[2] });
            s = ns;
        }
        return { fs: s, sp: sp, tEnd: t0 + t };
    }

    // ── 6. OPENING PHASE ───────────────────────────────────────
    function simOpening(s0, vc, vzVoile, isa, elevM, dt) {
        dt = dt || 0.1;
        var s = s0.slice(), sp = [];
        var tP = 1.0, tL = 1.5, tI = 3.0, tot = tP + tL + tI;
        var vcC = 3 * vzVoile;

        for (var t = 0; t < tot; t += dt) {
            var vE;
            if (t < tP) {
                vE = vc * (1 - 0.1 * t / tP);
            } else if (t < tP + tL) {
                var f = (t - tP) / tL;
                vE = vc + f * (vcC - vc);
            } else {
                var f2 = (t - tP - tL) / tI;
                f2 = f2 * f2 * (3 - 2 * f2);
                vE = vcC + f2 * (vzVoile - vcC);
            }
            vE = Math.max(vE, vzVoile);
            s = rk2(s, dt, vE, isa);
            sp.push({ t: t, x: s[0], y: s[1], z: s[2], state: s.slice() });
            if (s[2] <= elevM) break;
        }
        return { fs: s, sp: sp };
    }

    // ── 7. CANOPY PHASE ────────────────────────────────────────

    var CANOPY_DEFAULTS = {
        maxTurnRate: 30,        // deg/s
        turnSinkFactor: 0.015,
        rateAccel: 90,          // deg/s²
        dt: 0.5
    };

    // Canopy piloting modes calibrated from Brian Germain
    // (skydive-safety / "Parachute and its Pilot") + Steven Geens "Exit
    // Separation" + AERODYNAMICS_RESEARCH.md §6.1-6.3.  GROUND glide ratio
    // GR_sol = (Vh_air + Vw) / Vz is the relevant optimisation target —
    // not air glide. The modes' multipliers are RELATIVE to the trim values
    // of the specific canopy (so cross-braced and student canopies adapt).
    //
    //   - TRIM       : full flight, hands up. Nominal (Vh, Vz) per jumper.
    //                  Maximum airspeed → best for very strong head wind
    //                  ("body in ball" if you have it; here we keep the
    //                  jumper's nominal values).
    //   - BEST_GLIDE : 2-3 cm rear risers OR ~1/3 toggles. Vh ~unchanged,
    //                  Vz drops ~15 % → +18 % air glide ratio.
    //                  This is the "long spot facing moderate wind" mode
    //                  AND the universal best-air-glide setting in calm.
    //   - MIN_SINK   : ~50 % toggles. Vh × 0.55, Vz × 0.65 — actually a
    //                  WORSE air glide than trim, but the goal here is
    //                  TIME ALOFT, not glide. Used when the tail wind is
    //                  dominant (Vw > Vh) so the wind itself does the
    //                  ground-speed work and we only need to maximise the
    //                  duration.
    // Default (docile sport canopy) — kept for backward compat
    var CANOPY_MODES = {
        TRIM:       { vhMul: 1.00, vzMul: 1.00, label: 'plein vol' },
        BEST_GLIDE: { vhMul: 1.00, vzMul: 0.85, label: 'arrière' },
        MIN_SINK:   { vhMul: 0.55, vzMul: 0.65, label: 'freins' },
        // Deep-brakes flare mode (~80 % toggles) — used during the final
        // touchdown drift so the pilot does not drift far downwind when
        // they reach the target with excess altitude.
        FLARE:      { vhMul: 0.30, vzMul: 0.75, label: 'freins profonds' }
    };

    // Per-canopy-type profiles. Each profile overrides the (vhMul, vzMul) of
    // BEST_GLIDE and MIN_SINK; TRIM is universal. Sources:
    //   - AERODYNAMICS_RESEARCH.md §4 (glide ratios per class) +
    //     §6.2 (Brian Germain rear-riser/light-brakes recommendation),
    //   - PD Sabre2/Silhouette flight characteristics,
    //   - Practical wisdom for cross-braced (rear riser dive less effective,
    //     full flight already near best glide; brakes degrade glide a lot).
    var CANOPY_TYPE_PROFILES = {
        // Voile école (Navigator, Manta, gros 7-cell F-111). Marge faible
        // avant décrochage, allongement bas → rear risers quasi neutres.
        student: {
            TRIM:       { vhMul: 1.00, vzMul: 1.00, label: 'plein vol' },
            BEST_GLIDE: { vhMul: 0.95, vzMul: 0.88, label: 'arrière léger' },
            MIN_SINK:   { vhMul: 0.50, vzMul: 0.65, label: 'freins ½' }
        },
        // 9-caissons docile à WL modérée (Silhouette, Pilot, Sabre 2 légère).
        // Ce sont les chiffres canoniques de Brian Germain.
        docile: {
            TRIM:       { vhMul: 1.00, vzMul: 1.00, label: 'plein vol' },
            BEST_GLIDE: { vhMul: 1.00, vzMul: 0.85, label: 'arrière' },
            MIN_SINK:   { vhMul: 0.55, vzMul: 0.65, label: 'freins ½' }
        },
        // 9-caissons sportive / elliptique modérée (Sabre 3, Crossfire 3,
        // Katana sub-2). Légèrement plus efficace en arrière.
        sport: {
            TRIM:       { vhMul: 1.00, vzMul: 1.00, label: 'plein vol' },
            BEST_GLIDE: { vhMul: 1.00, vzMul: 0.83, label: 'arrière' },
            MIN_SINK:   { vhMul: 0.55, vzMul: 0.65, label: 'freins ½' }
        },
        // Cross-braced (Velocity, JFX 2). Rear-risers donnent peu — le profil
        // est déjà près du Cl optimal en plein vol. Freins dégradent la finesse.
        crossbraced: {
            TRIM:       { vhMul: 1.00, vzMul: 1.00, label: 'plein vol' },
            BEST_GLIDE: { vhMul: 1.00, vzMul: 0.92, label: 'arrière' },
            MIN_SINK:   { vhMul: 0.50, vzMul: 0.70, label: 'freins ½' }
        },
        // Tandem (Sigma, Icarus Tandem) — voile chargée à finesse modérée,
        // dynamique de freins assez douce.
        tandem: {
            TRIM:       { vhMul: 1.00, vzMul: 1.00, label: 'plein vol' },
            BEST_GLIDE: { vhMul: 0.97, vzMul: 0.88, label: 'arrière' },
            MIN_SINK:   { vhMul: 0.55, vzMul: 0.70, label: 'freins ½' }
        }
    };

    function _resolveCanopyProfile(canopyType) {
        return CANOPY_TYPE_PROFILES[canopyType] || CANOPY_TYPE_PROFILES.docile;
    }

    /**
     * Pick the canopy mode that maximises ground glide toward the target.
     *
     * Decision tree, ordered by priority (each branch stops the search):
     *
     *   A. Tail wind dominant (Vw > Vh):
     *        Mostly the wind is moving us; reduce Vz to maximise time aloft
     *        → MIN_SINK. Air glide drops but wind drift more than compensates
     *        because Vw / Vz ratio improves.
     *
     *   B. Tail wind significant + would overshoot:
     *        Slow down so the target stays ahead.
     *        → MIN_SINK.
     *
     *   C. Extreme head wind (Vw < -0.85 Vh):
     *        rear risers / light brakes risk net-zero ground speed; we need
     *        every meter of Vh to penetrate → TRIM (full flight, body
     *        compact). This is the "vent de face fort, bras haut" case
     *        Steven Geens and field practice describe.
     *
     *   D. Moderate head wind OR undershoot:
     *        rear risers preserve Vh while cutting Vz ~15 % ⇒ +18 % air
     *        glide and therefore +18 % ground reach when Vw is moderate
     *        → BEST_GLIDE.
     *
     *   E. Comfortable margin (default):
     *        No correction needed → TRIM keeps things simple.
     *
     * Skill modulation : a Bernoulli draw against `skill` decides whether
     * the optimal mode is actually selected. Novices (skill ≈ 0.4) fall
     * back to TRIM ~60 % of the time. The draw is seeded by the per-jumper
     * MC noise so results stay repeatable across MC re-runs.
     */
    function selectCanopyMode(dx, dy, vhTrim, wind, altRem, glideTrim, skill, rngU, canopyType) {
        var profile = _resolveCanopyProfile(canopyType);
        var dh = Math.sqrt(dx * dx + dy * dy);
        if (dh < 50 || altRem < 100 || glideTrim <= 0) return profile.TRIM;
        var dxn = dx / dh, dyn = dy / dh;
        var windAlong = wind.e * dxn + wind.n * dyn;  // + = tail wind toward target
        var vzTrim = vhTrim / glideTrim;
        var trimGsToward = vhTrim + windAlong;
        var reach = (altRem / vzTrim) * Math.max(0.5, trimGsToward);

        var picksOptimal = (rngU == null) ? true : (rngU < skill);

        var optimal;
        if (windAlong > vhTrim) {
            optimal = profile.MIN_SINK;
        } else if (windAlong > 0.3 * vhTrim && reach > dh * 1.3) {
            optimal = profile.MIN_SINK;
        } else if (windAlong < -0.85 * vhTrim) {
            optimal = profile.TRIM;
        } else if (reach < dh * 1.05 || windAlong < -0.10 * vhTrim) {
            optimal = profile.BEST_GLIDE;
        } else {
            optimal = profile.TRIM;
        }
        return picksOptimal ? optimal : profile.TRIM;
    }

    /**
     * @param s0       [e, n, z, ve, vn, vz]
     * @param vzV      canopy sink rate (m/s)
     * @param glide    glide ratio
     * @param elevM    ground elevation AMSL (m)
     * @param isa      ISA delta
     * @param steerFn  function(state, t) → {targetHeading: deg} or null
     * @param stopFn   function(state, t) → {stop: bool, data: any} or null
     * @param opts     {dt, maxTurnRate, skill}
     */
    function simCanopy(s0, vzV, glide, elevM, isa, steerFn, stopFn, opts) {
        opts = opts || {};
        var dt = opts.dt || CANOPY_DEFAULTS.dt;
        var maxTR = (opts.maxTurnRate || CANOPY_DEFAULTS.maxTurnRate) * (opts.skill || 1.0);
        var tsf = CANOPY_DEFAULTS.turnSinkFactor;
        var rateAccel = CANOPY_DEFAULTS.rateAccel;

        var s = s0.slice();
        var heading = Math.atan2(s[3], s[4]) * RAD2DEG;
        var currentRate = 0;
        var vh = vzV * glide;
        // Track which piloting mode is active each step for diagnostics/UI
        var currentMode = CANOPY_MODES.TRIM;
        var currentPhase = '';
        var sp = [{ t: 0, x: s[0], y: s[1], z: s[2], heading: heading, mode: currentMode.label, phase: currentPhase }];

        for (var i = 1; i < 12000; i++) {
            var t = i * dt;
            var z = Math.max(s[2], 0);
            var w = windAtZ(z);

            var targetH = heading;
            if (steerFn) {
                var cmd = steerFn(s, t);
                if (cmd && cmd.targetHeading !== undefined) targetH = cmd.targetHeading;
                if (cmd && cmd.mode) currentMode = cmd.mode;
                if (cmd && cmd.phase) currentPhase = cmd.phase;
            }

            // Turn rate with acceleration limit (further attenuated under min-sink
            // because heavy brakes also slow yaw response)
            var modeMaxTR = maxTR * (currentMode.vhMul > 0.6 ? 1.0 : 0.7);
            var delta = targetH - heading;
            while (delta > 180) delta -= 360;
            while (delta < -180) delta += 360;
            var desiredRate = Math.max(-modeMaxTR, Math.min(modeMaxTR, delta / Math.max(dt, 0.01)));
            var maxChange = rateAccel * dt;
            var rateDiff = desiredRate - currentRate;
            if (Math.abs(rateDiff) > maxChange) currentRate += maxChange * Math.sign(rateDiff);
            else currentRate = desiredRate;

            // Anticipatory braking
            var stoppingAngle = (currentRate * currentRate) / (2 * rateAccel);
            if (Math.abs(delta) < stoppingAngle * 1.2 && Math.abs(delta) < 10)
                currentRate *= 0.7;

            heading += currentRate * dt;
            heading = ((heading % 360) + 360) % 360;

            var corr = densityCorrection(z, isa);
            var vhA = vh * currentMode.vhMul * corr;
            var vzA = vzV * currentMode.vzMul * corr + tsf * currentRate * currentRate;

            var hr = heading * DEG2RAD;
            var vx = Math.sin(hr) * vhA + w.e;
            var vy = Math.cos(hr) * vhA + w.n;

            s = [s[0] + vx * dt, s[1] + vy * dt, s[2] - vzA * dt, vx, vy, -vzA];
            sp.push({ t: t, x: s[0], y: s[1], z: s[2], heading: heading, mode: currentMode.label, phase: currentPhase });

            if (stopFn) {
                var sc = stopFn(s, t);
                if (sc && sc.stop) return { fs: s, sp: sp, stopped: true, data: sc.data };
            }

            if (s[2] <= elevM) {
                s[2] = elevM;
                return { fs: s, sp: sp, stopped: false, grounded: true };
            }
        }
        return { fs: s, sp: sp, stopped: false, grounded: false };
    }

    // ── 8. STEERING FUNCTIONS ──────────────────────────────────

    function createSteerToPoint(targetE, targetN, vhMs, opts) {
        opts = opts || {};
        var skill = opts.skill || 1.0;
        var glide = opts.glide || 2.6;
        var canopyType = opts.canopyType || 'docile';
        var targetAltAbs = opts.targetAltAbs;  // optional, for mode selection
        var modeEnabled = opts.modeEnabled !== false;
        var headingError = 20 * (1 - skill);
        var reactionDelay = 2.0 / Math.max(skill, 0.1);
        var noiseAngle = (opts.noiseSeed || 0) * headingError;
        // Skill-based Bernoulli draw used by selectCanopyMode (deterministic per MC iter)
        var rngSeed = opts.noiseSeed != null ? Math.abs(opts.noiseSeed) : Math.random();
        var rngU = (Math.tanh(rngSeed) + 1) * 0.5;

        var lastUpdate = -999, cachedH = null, cachedMode = CANOPY_MODES.TRIM;

        return function (state, t) {
            if (t - lastUpdate < reactionDelay && cachedH !== null) {
                return { targetHeading: cachedH, mode: cachedMode };
            }
            lastUpdate = t;

            var dx = targetE - state[0], dy = targetN - state[1];
            var dh = Math.sqrt(dx * dx + dy * dy);
            if (dh < 5) { cachedH = cachedH || 0; return { targetHeading: cachedH, mode: cachedMode }; }

            var z = Math.max(state[2], 0);
            var w = windAtZ(z);

            var dxn = dx / dh, dyn = dy / dh;
            var wp = w.e * (-dyn) + w.n * dxn;
            var te, tn;
            if (Math.abs(wp) >= vhMs) {
                te = -w.e; tn = -w.n;
            } else {
                var comp = Math.sqrt(vhMs * vhMs - wp * wp);
                te = comp * dxn - wp * (-dyn);
                tn = comp * dyn - wp * dxn;
            }

            var h = Math.atan2(te, tn) * RAD2DEG + noiseAngle;
            cachedH = h;

            // Auto-select piloting mode if enabled and we know the target altitude
            if (modeEnabled && targetAltAbs != null) {
                var altRem = z - targetAltAbs;
                cachedMode = selectCanopyMode(dx, dy, vhMs, w, altRem, glide, skill, rngU, canopyType);
            }
            return { targetHeading: h, mode: cachedMode };
        };
    }

    /**
     * Build a landing pattern. New approach (April 2026):
     *
     *   1. At opening, the pilot CHOOSES one of four circuits based on
     *      whether they have enough altitude to fly it completely:
     *         - 'full'   : open → DW entry → base entry → final entry → target
     *         - 'base'   : open → base entry → final entry → target
     *         - 'final'  : open → final entry → target  (long final)
     *         - 'direct' : open → target  (last resort)
     *
     *      The longest feasible circuit is chosen. Feasibility =
     *         (path length) / glide < altOpen × 0.95   (5 % wind margin)
     *
     *   2. The chosen circuit is a fixed list of waypoints, executed
     *      sequentially. Phase advances when within 30 m of the current
     *      waypoint. No altitude-based mid-circuit jumps → no surprise
     *      U-turns.
     *
     *   3. After the last waypoint (= target), pilot latches into FLARE :
     *      heading face-au-vent, mode MIN_SINK. Heading is then frozen so
     *      the pilot drifts with the wind instead of trying to recapture
     *      the target each step.
     *
     *   4. Throughout, mode auto-selects vol/arrière/freins via
     *      selectCanopyMode (skill-modulated).
     *
     * Returned steering function : (state, t) → { targetHeading, mode, phase }.
     */
    function createLandingPattern(landTarget, vhMs, opts) {
        opts = opts || {};
        var elevM = opts.elevM || 0;
        // Nominal entry altitudes serve as a conservative LOWER BOUND on
        // the entryAltReq. The actual requirement is computed from leg
        // cost, but we always respect these floors to absorb turn-induced
        // sink, integration drift, and brief excursions outside the leg.
        var altDownwindAGL = opts.altDownwind != null ? opts.altDownwind : 300;
        var altBaseAGL = opts.altBase != null ? opts.altBase : 150;
        var altFinalAGL = opts.altFinal != null ? opts.altFinal : 60;
        var finalSeconds = opts.finalSeconds || 10;
        var patternSide = opts.patternSide || 'left';
        var skill = opts.skill || 1.0;
        var glide = opts.glide || 2.6;
        var canopyType = opts.canopyType || 'docile';
        var noiseSeed = opts.noiseSeed || 0;
        var modeEnabled = opts.modeEnabled !== false;
        var rngU = (Math.tanh(Math.abs(noiseSeed)) + 1) * 0.5;
        var reactionDelay = 1.0 / Math.max(skill, 0.3);
        var ORBIT_TRIGGER_EXCESS = 80;   // m of excess altitude above which we orbit
        var ORBIT_RADIUS = 70;           // m

        var pattern = null;
        var queue = null;            // FIFO of waypoints {type:'point'|'orbit', e, n, altExit?}
        var circuitName = null;      // 'full' | 'base' | 'final' | 'direct'
        var flaring = false;
        var inFinalHold = false;     // latched once near target, prevents oscillation
        var lastUpdate = -999, cachedH = null, cachedMode = null, cachedPhase = '';

        function buildPattern() {
            var z50 = elevM + altFinalAGL;
            var w = windAtZ(z50);

            // If the caller supplied a user-defined pattern (E/N waypoints),
            // use it as-is and derive the leg lengths from the geometry.
            if (opts.userPatternEN && opts.userPatternEN.target) {
                var u = opts.userPatternEN;
                var dist = function (a, b) {
                    var dx = b.e - a.e, dy = b.n - a.n;
                    return Math.sqrt(dx * dx + dy * dy);
                };
                var fLen = dist(u.finalStart, u.target);
                var bLen = dist(u.baseStart, u.finalStart);
                var dLen = dist(u.downwindStart, u.baseStart);
                return {
                    target: u.target, finalStart: u.finalStart,
                    baseStart: u.baseStart, downwindStart: u.downwindStart,
                    finalLen: fLen, baseLen: bLen, downwindLen: dLen,
                    finalDir: null, perpDir: null,
                    windE: w.e, windN: w.n,
                    userDefined: true
                };
            }

            var ws = Math.sqrt(w.e * w.e + w.n * w.n);
            var windDirE, windDirN;
            if (ws < 0.5) { windDirE = 0; windDirN = 1; ws = 0.5; }
            else { windDirE = w.e / ws; windDirN = w.n / ws; }
            var finalDirE = -windDirE, finalDirN = -windDirN;
            var finalGsToward = Math.max(2, vhMs - ws);
            var finalLen = Math.max(60, finalGsToward * finalSeconds);
            var finalStart = {
                e: landTarget.e - finalDirE * finalLen,
                n: landTarget.n - finalDirN * finalLen
            };
            var perpSign = (patternSide === 'right') ? -1 : 1;
            var perpE = -finalDirN * perpSign;
            var perpN = finalDirE * perpSign;
            var baseLen = 80;
            var baseStart = {
                e: finalStart.e + perpE * baseLen,
                n: finalStart.n + perpN * baseLen
            };
            var downwindLen = 200;
            var downwindStart = {
                e: baseStart.e + finalDirE * downwindLen,
                n: baseStart.n + finalDirN * downwindLen
            };
            return {
                target: landTarget, finalStart: finalStart, baseStart: baseStart,
                downwindStart: downwindStart,
                finalLen: finalLen, baseLen: baseLen, downwindLen: downwindLen,
                finalDir: { e: finalDirE, n: finalDirN },
                perpDir: { e: perpE, n: perpN },
                windE: w.e, windN: w.n,
                userDefined: false
            };
        }

        function _hwTo(state, wp) {
            var dx = wp.e - state[0], dy = wp.n - state[1];
            return Math.sqrt(dx * dx + dy * dy);
        }

        function _navHeading(state, wp) {
            var dx = wp.e - state[0], dy = wp.n - state[1];
            var dh = Math.sqrt(dx * dx + dy * dy);
            if (dh < 5) return cachedH != null ? cachedH : 0;
            var dxn = dx / dh, dyn = dy / dh;
            var z = Math.max(state[2], 0);
            var w = windAtZ(z);
            var wp_ = w.e * (-dyn) + w.n * dxn;
            var te, tn;
            if (Math.abs(wp_) >= vhMs) { te = -w.e; tn = -w.n; }
            else {
                var c = Math.sqrt(vhMs * vhMs - wp_ * wp_);
                te = c * dxn - wp_ * (-dyn);
                tn = c * dyn - wp_ * dxn;
            }
            return Math.atan2(te, tn) * RAD2DEG;
        }

        // Hold heading near a center while bleeding altitude.
        //   - If far from center : nav directly toward it (wind-corrected).
        //   - If near center     : face the wind so the pilot doesn't drift
        //                          downwind faster than they can recover.
        // The classic tangential orbit was abandoned because in any wind
        // significant relative to vh, MIN_SINK orbits drift uncontrollably
        // downwind and the pilot can't recover the entry point.
        function _holdHeading(state, center, w) {
            var dx = center.e - state[0], dy = center.n - state[1];
            var dh = Math.sqrt(dx * dx + dy * dy);
            if (dh > 40) {
                return _navHeading(state, center);
            }
            var ws = Math.sqrt(w.e * w.e + w.n * w.n);
            if (ws < 0.5) {
                // Calm : tangential CCW so we don't sit on the spot
                return Math.atan2(dy, -dx) * RAD2DEG;
            }
            return Math.atan2(-w.e, -w.n) * RAD2DEG; // face wind
        }

        // Pick the hold mode :
        //   - if wind speed > vh × 0.5 → TRIM (need full vh to navigate),
        //   - else                     → MIN_SINK (max time aloft, wind weak
        //                                enough that pilot remains controllable).
        function _holdMode(w) {
            var ws = Math.sqrt(w.e * w.e + w.n * w.n);
            var profile = _resolveCanopyProfile(canopyType);
            return (ws > vhMs * 0.5) ? profile.TRIM : profile.MIN_SINK;
        }

        // Centroid (E, N) of an evolution zone — circle center or polygon
        // vertex average. Returns null if the zone is malformed.
        function _evolutionZoneCenter(ez) {
            if (!ez) return null;
            if (ez.type === 'circle' && ez.center) {
                return { e: ez.center.e, n: ez.center.n };
            }
            if (ez.type === 'polygon' && ez.vertices && ez.vertices.length >= 3) {
                var sumE = 0, sumN = 0;
                for (var i = 0; i < ez.vertices.length; i++) {
                    sumE += ez.vertices[i].e; sumN += ez.vertices[i].n;
                }
                return { e: sumE / ez.vertices.length, n: sumN / ez.vertices.length };
            }
            return null;
        }

        // Test if (e, n) is inside the evolution zone.
        function _insideEvolutionZone(e, n) {
            var ez = opts.evolutionZoneEN;
            if (!ez) return false;
            if (ez.type === 'circle') {
                var dx = e - ez.center.e, dy = n - ez.center.n;
                return dx * dx + dy * dy <= ez.radiusM * ez.radiusM;
            }
            if (ez.type === 'polygon') {
                return _pointInPoly(e, n, ez.vertices);
            }
            return false;
        }

        // Heading for an EVOLUTION orbit : if the pilot has drifted out of
        // the zone, navigate back toward the centroid (wind-corrected). If
        // inside, face the wind to bleed altitude with minimal motion.
        function _evolutionHoldHeading(state, center, w) {
            if (!_insideEvolutionZone(state[0], state[1])) {
                return _navHeading(state, center);
            }
            var ws = Math.sqrt(w.e * w.e + w.n * w.n);
            if (ws < 0.5) {
                // Calm wind : tangential CCW so we don't sit on a single spot
                var dx = center.e - state[0], dy = center.n - state[1];
                return Math.atan2(dy, -dx) * RAD2DEG;
            }
            return Math.atan2(-w.e, -w.n) * RAD2DEG; // face wind
        }

        // Altitude cost of a single straight leg `from → to` flown in a
        // given canopy mode. Wind-triangle : the pilot crabs into the
        // crosswind, costing along-leg air speed. Returns Infinity if
        // unflyable (crosswind > vh_eff or gs < 1).
        function _legAltCostMode(from, to, mode) {
            var dx = to.e - from.e, dy = to.n - from.n;
            var dh = Math.sqrt(dx * dx + dy * dy);
            if (dh < 1) return 0;
            var dxn = dx / dh, dyn = dy / dh;
            var w = windAtZ(elevM + 100);
            var crosswind = w.e * (-dyn) + w.n * dxn;
            var vhEff = vhMs * mode.vhMul;
            if (Math.abs(crosswind) >= vhEff) return Infinity;
            var alongAir = Math.sqrt(vhEff * vhEff - crosswind * crosswind);
            var windAlong = w.e * dxn + w.n * dyn;
            var gs = alongAir + windAlong;
            if (gs < 1) return Infinity;
            var vzEff = (vhMs / glide) * mode.vzMul;
            return (dh / gs) * vzEff;
        }

        // Best (minimum) altitude cost across the 3 piloting modes.
        // The optimal mode depends on the wind component along the leg :
        //   - Head wind     → BEST_GLIDE (vz × 0.85, +18% air glide)
        //   - Tail wind     → MIN_SINK (vh × 0.55, vz × 0.65 — more time aloft)
        //   - Calm          → TRIM
        function _legAltCostBest(from, to) {
            var profile = _resolveCanopyProfile(canopyType);
            var c1 = _legAltCostMode(from, to, profile.TRIM);
            var c2 = _legAltCostMode(from, to, profile.BEST_GLIDE);
            var c3 = _legAltCostMode(from, to, profile.MIN_SINK);
            return Math.min(c1, c2, c3);
        }

        // Skill-weighted EXPECTED leg cost (option B) :
        //   cost = skill × cost_optimal_mode + (1 − skill) × cost_TRIM
        // Models the fact that a less-skilled pilot fails to pick the
        // optimal mode (1 − skill) of the time and falls back to TRIM.
        // When mode selection is disabled (e.g. visual main thread),
        // the cost is TRIM-only — matching the actual flight behavior.
        function _legAltCost(from, to) {
            var profile = _resolveCanopyProfile(canopyType);
            var costTrim = _legAltCostMode(from, to, profile.TRIM);
            if (costTrim === Infinity) return Infinity;
            // If mode-based selection is off, the pilot always flies TRIM.
            if (opts.modeEnabled === false) return costTrim;
            var costBest = _legAltCostBest(from, to);
            if (costBest === Infinity || !isFinite(costBest)) costBest = costTrim;
            // Bound skill in [0, 1] to keep the weighted sum sensible.
            var sk = Math.max(0, Math.min(1, skill));
            return sk * costBest + (1 - sk) * costTrim;
        }

        // Total altitude needed to fly a sequence of legs.
        function _pathAltCost(points) {
            var total = 0;
            for (var i = 0; i < points.length - 1; i++) {
                total += _legAltCost(points[i], points[i + 1]);
                if (total === Infinity) return Infinity;
            }
            return total;
        }

        // Backwards-compat helper used by the adaptive fallback.
        function _altAtArrival(state, wp) {
            var altAGL = state[2] - elevM;
            var c = _legAltCost({ e: state[0], n: state[1] }, wp);
            return c === Infinity ? null : altAGL - c;
        }

        // Pick the polygon vertex with extreme projection along (dE, dN).
        // If the zone has no polygon, fallback to a small offset from the centroid.
        function _zoneEdgePoint(centroid, dE, dN) {
            var poly = opts.zonePolygonEN;
            if (poly && poly.length >= 3) {
                var bestIdx = 0, bestProj = -Infinity;
                for (var i = 0; i < poly.length; i++) {
                    var v = poly[i];
                    var proj = (v.e - centroid.e) * dE + (v.n - centroid.n) * dN;
                    if (proj > bestProj) { bestProj = proj; bestIdx = i; }
                }
                return { e: poly[bestIdx].e, n: poly[bestIdx].n };
            }
            // Default: offset by 30 m from centroid in the requested direction
            return { e: centroid.e + dE * 30, n: centroid.n + dN * 30 };
        }

        // Find a SHIFTED final that the pilot can reach. The final
        // direction is preserved (same orientation as the published /
        // computed pattern → pilot lands face-into-wind), only the
        // touchdown point is shifted by a perpendicular and/or
        // along-axis offset. The new touchdown can be OUTSIDE the
        // landing zone — better to land off-zone facing the wind than
        // downwind on-zone. Returns the smallest-shift solution that
        // is reachable, or null if no shift works.
        function _findShiftedFinal(state) {
            var altAGLloc = state[2] - elevM;
            var apE, apN;
            if (pattern.userDefined && pattern.finalStart) {
                var dxAp = pattern.target.e - pattern.finalStart.e;
                var dyAp = pattern.target.n - pattern.finalStart.n;
                var dAp = Math.sqrt(dxAp * dxAp + dyAp * dyAp);
                if (dAp < 0.5) return null;
                apE = dxAp / dAp; apN = dyAp / dAp;
            } else {
                var ws_r = Math.sqrt(pattern.windE * pattern.windE + pattern.windN * pattern.windN);
                if (ws_r < 0.5) return null;
                apE = -pattern.windE / ws_r;
                apN = -pattern.windN / ws_r;
            }
            var finalLenLoc = pattern.finalLen || 80;
            // Perpendicular direction (CCW 90°)
            var perpE = -apN, perpN = apE;
            var startPos = { e: state[0], n: state[1] };
            var BUF = 30;
            var BUF2 = 20;

            // Build a list of (perpShift, alongShift) candidates ordered
            // by total euclidean distance (= we prefer the smallest
            // displacement from the original touchdown).
            var step = 25;       // m
            var maxShift = 600;  // m search radius
            var shifts = [{ p: 0, a: 0 }];   // identity (rarely useful at this point)
            for (var r = step; r <= maxShift; r += step) {
                // 8 cardinal/diagonal directions at radius r
                var dirs = [
                    [r, 0], [-r, 0], [0, r], [0, -r],
                    [r * 0.707, r * 0.707], [-r * 0.707, r * 0.707],
                    [r * 0.707, -r * 0.707], [-r * 0.707, -r * 0.707]
                ];
                for (var k = 0; k < dirs.length; k++) {
                    shifts.push({ p: dirs[k][0], a: dirs[k][1] });
                }
            }

            for (var i = 0; i < shifts.length; i++) {
                var sh = shifts[i];
                var newT = {
                    e: pattern.target.e + sh.p * perpE + sh.a * apE,
                    n: pattern.target.n + sh.p * perpN + sh.a * apN
                };
                var newFs = {
                    e: newT.e - apE * finalLenLoc,
                    n: newT.n - apN * finalLenLoc
                };
                var costApp = _legAltCost(startPos, newFs);
                var costFin = _legAltCost(newFs, newT);
                if (costApp === Infinity || costFin === Infinity) continue;
                // Coût du virage à l'entrée de la finale (jusqu'à 60 m
                // pour un demi-tour). Sans ça, un para arrivant en
                // sens opposé n'a pas l'altitude pour aligner sa finale.
                var turnCost = _entryTurnCost(state, newFs, newT);
                if (altAGLloc >= costApp + turnCost + costFin + BUF + BUF2) {
                    return { finalStart: newFs, target: newT, shift: sh };
                }
            }
            return null;
        }

        // Adaptive pattern : redraw the final so its TOUCHDOWN is at the zone
        // edge that matches the pilot's wind-relative position :
        //   - pilot upwind of zone (offset < 0) → land at UPWIND edge
        //     (long final into the wind, gives time to descend)
        //   - pilot downwind (offset > 0)       → land at DOWNWIND edge
        //     (short final, accept that pilot can't fly upwind further)
        // Then aim for the start of this redrawn final.
        function _buildAdaptivePattern(state) {
            var ws = Math.sqrt(pattern.windE * pattern.windE + pattern.windN * pattern.windN);
            if (ws < 0.5) return null;
            var windDirE = pattern.windE / ws;
            var windDirN = pattern.windN / ws;
            var pilotE = state[0], pilotN = state[1];
            var offset = (pilotE - pattern.target.e) * windDirE +
                         (pilotN - pattern.target.n) * windDirN;
            // Edge on pilot's side of the zone
            var sign = offset > 0 ? 1 : -1;
            var landPoint = _zoneEdgePoint(pattern.target, windDirE * sign, windDirN * sign);
            // Final into the wind, ending at landPoint
            var finalDirE = -windDirE, finalDirN = -windDirN;
            var finalGsToward = Math.max(2, vhMs - ws);
            var finalLen = Math.max(60, finalGsToward * finalSeconds);
            var adaptedFinalStart = {
                e: landPoint.e - finalDirE * finalLen,
                n: landPoint.n - finalDirN * finalLen
            };
            return {
                target: landPoint,
                finalStart: adaptedFinalStart,
                finalLen: finalLen
            };
        }

        // Coût altitude pour la rotation à l'entrée d'une branche.
        //   state    : position courante (avant l'approche vers entry)
        //   entry    : waypoint d'entrée
        //   firstEnd : prochain waypoint après entry (pour calculer
        //              l'angle de virage à entry)
        // Renvoie le drop altitude estimé (m) pour le virage. ~30 m
        // par 90° de virage (= 60 m pour un demi-tour 180°). Permet
        // au pilote d'avoir le temps de tourner avant d'enchaîner.
        function _entryTurnCost(state, entry, firstEnd) {
            if (!firstEnd) return 0;
            var apE = entry.e - state[0], apN = entry.n - state[1];
            var apDist = Math.sqrt(apE * apE + apN * apN);
            if (apDist < 1) return 0;
            var lgE = firstEnd.e - entry.e, lgN = firstEnd.n - entry.n;
            var lgDist = Math.sqrt(lgE * lgE + lgN * lgN);
            if (lgDist < 1) return 0;
            var dot = (apE * lgE + apN * lgN) / (apDist * lgDist);
            dot = Math.max(-1, Math.min(1, dot));
            var turnRad = Math.acos(dot);  // 0 .. π
            return 30 * (turnRad / (Math.PI / 2));
        }

        // Build the WP queue at opening based on what's feasible. If excess
        // altitude exists at entry, prepend an ORBIT waypoint that bleeds
        // altitude until entryAltAGL is reached.
        function _planQueue(state) {
            var altAGL = state[2] - elevM;

            var options = [];

            // If an evolution zone is defined and the user pattern has a
            // downwindStart, prefer to bleed altitude IN the zone, then
            // fly the FULL circuit. The orbit is centered on the zone
            // (circle center or polygon centroid).
            var evoCenter = null;
            if (opts.evolutionZoneEN) {
                evoCenter = _evolutionZoneCenter(opts.evolutionZoneEN);
            }
            if (evoCenter) {
                options.push({
                    name: 'evo-full',
                    entry: evoCenter,
                    nominalAlt: altDownwindAGL,
                    legs: [pattern.downwindStart, pattern.baseStart, pattern.finalStart, pattern.target],
                    isEvolution: true
                });
            }

            options.push(
                { name: 'full',   entry: pattern.downwindStart, nominalAlt: altDownwindAGL,
                  legs: [pattern.downwindStart, pattern.baseStart, pattern.finalStart, pattern.target] },
                { name: 'base',   entry: pattern.baseStart, nominalAlt: altBaseAGL,
                  legs: [pattern.baseStart, pattern.finalStart, pattern.target] },
                { name: 'final',  entry: pattern.finalStart, nominalAlt: altFinalAGL,
                  legs: [pattern.finalStart, pattern.target] }
            );

            // For each option, the REQUIRED entry altitude is the MAX of :
            //   - the nominal entry alt (300/150/60 m), as a safety floor
            //     that absorbs turn-induced sink, integration drift, and
            //     brief excursions outside the planned leg, AND
            //   - the wind-triangle leg cost + per-turn penalty + flare.
            //
            // Per-turn penalty : each waypoint transition costs ~30 m of
            // altitude (the canopy's turn-induced sink scales as tsf × ω²,
            // and at 30°/s it adds ≈ 13 m/s of vz over a 2-3 s turn).
            // Without this term, legCost dramatically underestimates the
            // real flight cost and the pilot lands short.
            var FLARE_BUFFER = 20;
            var TURN_PENALTY = 30;  // m of altitude per leg transition
            for (var i = 0; i < options.length; i++) {
                var opt = options[i];

                var legPath = opt.isEvolution ? [opt.entry].concat(opt.legs) : opt.legs;
                var legCost = _pathAltCost(legPath);
                if (legCost === Infinity) continue;
                // Internal turns only : the entry-into-first-wp turn is
                // absorbed during the approach/orbit phase; the final-to-
                // ground "turn" doesn't exist (pilot lands on the same
                // heading as the final approach). So we count length - 2.
                var nTurns = Math.max(0, legPath.length - 2);
                var entryAltReq = Math.max(opt.nominalAlt,
                    legCost + nTurns * TURN_PENALTY + FLARE_BUFFER);

                var startPos = { e: state[0], n: state[1] };
                var approachCost = _legAltCost(startPos, opt.entry);
                if (approachCost === Infinity) continue;
                // Coût du demi-tour (ou virage) entre l'approche et la
                // première branche. Sans ça, un para qui arrive en sens
                // opposé n'a pas l'altitude pour faire son demi-tour
                // avant de poser sa finale.
                var firstLegEnd = opt.legs && opt.legs.length >= 2 ? opt.legs[1] : null;
                var entryTurn = _entryTurnCost(state, opt.entry, firstLegEnd);
                var altAtEntry = altAGL - approachCost - entryTurn;
                if (altAtEntry < entryAltReq) continue;

                var qu = [];
                var excess = altAtEntry - entryAltReq;
                if (excess > ORBIT_TRIGGER_EXCESS) {
                    qu.push({
                        type: opt.isEvolution ? 'evo-orbit' : 'orbit',
                        e: opt.entry.e, n: opt.entry.n,
                        altExit: entryAltReq
                    });
                } else if (opt.isEvolution) {
                    // No real excess to bleed → the evolution zone serves
                    // no purpose for this opening, fall through to the
                    // standard 'full' option (which heads straight to
                    // downwindStart without orbiting in the zone).
                    continue;
                }
                opt.legs.forEach(function (wp) {
                    qu.push({ type: 'point', e: wp.e, n: wp.n });
                });
                return { name: opt.name, queue: qu };
            }

            // No standard circuit feasible → try a SHIFTED FINAL :
            // garde la même direction d'approche (face au vent / dans
            // l'orientation de la finale publiée) mais décale le touch-
            // down par un offset (perpendiculaire + along-axe). Le
            // pilote atterrit toujours dans le bon sens, possiblement
            // hors zone — mieux qu'un atterrissage downwind dans la
            // zone.
            var shifted = _findShiftedFinal(state);
            if (shifted) {
                return {
                    name: 'shift-final',
                    queue: [
                        { type: 'point', e: shifted.finalStart.e, n: shifted.finalStart.n },
                        { type: 'point', e: shifted.target.e,     n: shifted.target.n }
                    ]
                };
            }

            // No standard circuit feasible → ADAPTIVE redraw : reposition the
            // final so its touchdown is at the zone edge on the pilot's side
            // (upwind or downwind), and aim for the new finalStart.
            var adapt = _buildAdaptivePattern(state);
            if (adapt) {
                // Use the optimistic approach + realistic final-leg cost.
                var dxAd = adapt.finalStart.e - state[0], dyAd = adapt.finalStart.n - state[1];
                var dhAd = Math.sqrt(dxAd * dxAd + dyAd * dyAd);
                var wAd = windAtZ(state[2]);
                var gsAd = dhAd < 5 ? vhMs : (vhMs + (wAd.e * dxAd + wAd.n * dyAd) / dhAd);
                var altAtAdapt = (gsAd >= 1) ? altAGL - (dhAd / Math.max(gsAd, 1)) * (vhMs / glide) : null;
                var adaptFinalCost = _legAltCost(adapt.finalStart, adapt.target);
                if (altAtAdapt != null && adaptFinalCost !== Infinity && altAtAdapt > adaptFinalCost + 20) {
                    return {
                        name: 'adaptive',
                        queue: [
                            { type: 'point', e: adapt.finalStart.e, n: adapt.finalStart.n },
                            { type: 'point', e: adapt.target.e,     n: adapt.target.n }
                        ]
                    };
                }
                // Adaptive entry also unreachable — at least head INTO the wind
                // toward the zone-edge landing point. Pilot lands short but
                // pointed correctly.
                return {
                    name: 'fallback',
                    queue: [{ type: 'point', e: adapt.target.e, n: adapt.target.n }]
                };
            }

            // Wind too weak / no zone polygon → straight to target as last resort
            return {
                name: 'direct',
                queue: [{ type: 'point', e: pattern.target.e, n: pattern.target.n }]
            };
        }

        function _wpReached(state, wp, altAGL) {
            if (wp.type === 'orbit' || wp.type === 'evo-orbit') {
                return altAGL <= wp.altExit + 5;
            }
            return _hwTo(state, wp) < 30;
        }

        return function (state, t) {
            if (!pattern) pattern = buildPattern();
            if (queue == null) {
                var plan = _planQueue(state);
                circuitName = plan.name;
                queue = plan.queue;
                flaring = false;
            }

            if (t - lastUpdate < reactionDelay && cachedH !== null) {
                return { targetHeading: cachedH, mode: cachedMode, phase: cachedPhase };
            }
            lastUpdate = t;

            var z = state[2];
            var altAGL = z - elevM;

            // Advance through completed waypoints (always keep at least one)
            while (queue.length > 1 && _wpReached(state, queue[0], altAGL)) {
                queue.shift();
            }

            // Near target : face wind so the pilot lands oriented correctly,
            // but stay in TRIM until really low — vh×0.3 in FLARE is less
            // than typical wind, so latching FLARE early would blow the
            // pilot backwards downwind for the rest of the descent. The
            // deep-brakes flare is reserved for the last ~15 m AGL.
            // Latch final-hold only when we're on the LAST waypoint of
            // the queue (the actual landing point — could be the user
            // target OR an adaptive zone-edge point) and within 30 m.
            // Without this gate the latch would fire at the first tick
            // for any pilot opening near the zone.
            if (!inFinalHold && queue.length === 1 && queue[0].type === 'point') {
                var dxLast = queue[0].e - state[0], dyLast = queue[0].n - state[1];
                if (dxLast * dxLast + dyLast * dyLast < 30 * 30) inFinalHold = true;
            }
            if (flaring || (inFinalHold && altAGL < 15)) {
                flaring = true;
                var w0 = windAtZ(z);
                var ws0 = Math.sqrt(w0.e * w0.e + w0.n * w0.n);
                if (ws0 > 0.5) {
                    cachedH = Math.atan2(-w0.e, -w0.n) * RAD2DEG;
                } else if (cachedH == null) {
                    cachedH = _navHeading(state, pattern.target);
                }
                cachedMode = CANOPY_MODES.FLARE;
                cachedPhase = 'flare';
                return { targetHeading: cachedH, mode: cachedMode, phase: cachedPhase };
            }
            if (inFinalHold) {
                // Final hold : face wind in TRIM. The pilot's residual
                // altitude bleeds at vzTrim while ground motion is small
                // (and slightly upwind if vh > wind). LATCHED — once we
                // entered, we stay until ground (or flare).
                var wn = windAtZ(z);
                var wsN = Math.sqrt(wn.e * wn.e + wn.n * wn.n);
                if (wsN > 0.5) {
                    cachedH = Math.atan2(-wn.e, -wn.n) * RAD2DEG;
                } else {
                    cachedH = _navHeading(state, pattern.target);
                }
                cachedMode = _resolveCanopyProfile(canopyType).TRIM;
                cachedPhase = 'final-hold';
                return { targetHeading: cachedH, mode: cachedMode, phase: cachedPhase };
            }

            var wp = queue[0];
            if (wp.type === 'orbit') {
                var wHold = windAtZ(z);
                cachedH = _holdHeading(state, wp, wHold);
                cachedMode = _holdMode(wHold);
                cachedPhase = circuitName + ':orbit';
            } else if (wp.type === 'evo-orbit') {
                var wEvo = windAtZ(z);
                cachedH = _evolutionHoldHeading(state, wp, wEvo);
                cachedMode = _holdMode(wEvo);
                cachedPhase = circuitName + ':evo';
            } else {
                cachedH = _navHeading(state, wp);
                // Turn anticipation : in tail wind, ground speed is high
                // and the canopy's 30°/s turn rate can't track sharp 90°
                // corners cleanly — pilot overshoots base/final entries.
                // Start steering toward the next waypoint when within
                // ~2.5 s of ground travel of the current one, but ONLY if
                // there is real tail wind (gs > vh + 3) AND the next-leg
                // heading change is significant (>30°).
                var nextWp = (queue.length >= 2 && queue[1].type === 'point') ? queue[1] : null;
                if (nextWp) {
                    var distToCur = _hwTo(state, wp);
                    var wTurn = windAtZ(z);
                    var gsTow = vhMs;
                    if (distToCur > 5) {
                        gsTow = vhMs + (wTurn.e * (wp.e - state[0]) + wTurn.n * (wp.n - state[1])) / distToCur;
                    }
                    if (gsTow > vhMs + 3) {
                        var hNext = _navHeading(state, nextWp);
                        var deltaH = Math.abs(((hNext - cachedH + 540) % 360) - 180);
                        if (deltaH > 30) {
                            var antLead = Math.min(80, gsTow * 2.5);
                            if (distToCur < antLead) cachedH = hNext;
                        }
                    }
                }
                if (modeEnabled) {
                    cachedMode = selectCanopyMode(
                        pattern.target.e - state[0],
                        pattern.target.n - state[1],
                        vhMs, windAtZ(z),
                        Math.max(0, altAGL),
                        glide, skill, rngU, canopyType);
                } else {
                    cachedMode = _resolveCanopyProfile(canopyType).TRIM;
                }
                cachedPhase = circuitName + ':wp(' + queue.length + ')';
            }
            return { targetHeading: cachedH, mode: cachedMode, phase: cachedPhase };
        };
    }

    /**
     * Two-phase canopy steering :
     *   - Phase 1 : perpendicular hold for `tPilot` seconds — safety wait so
     *               the next jumper can finish opening before this one heads
     *               back toward the RDV up-track. Only effective if currently
     *               UPSTREAM of the DZ (along jumprun); a jumper who opened
     *               past the DZ has no reason to wait perpendicular.
     *   - Phase 2 : direct, wind-corrected steering to RDV.
     *
     * Skill-based execution : a less skilled jumper may skip the wait. The
     * skill check uses the per-jumper noise seed so the same MC iteration is
     * deterministic across re-runs.
     *
     *   opts:
     *     - skill        (0..1)  probability that the wait is honoured
     *     - noiseSeed    deterministic 0..1 trigger
     *     - trackE/trackN, targetAlongTrack  optional upstream-check inputs
     */
    function createSteerTwoPhase(perpE, perpN, targetE, targetN, vhMs, tPilot, opts) {
        opts = opts || {};
        var skill = opts.skill != null ? opts.skill : 1.0;
        var trackE = opts.trackE != null ? opts.trackE : null;
        var trackN = opts.trackN != null ? opts.trackN : null;
        var targetAlongTrack = opts.targetAlongTrack;
        var rng = opts.noiseSeed != null ? Math.abs(opts.noiseSeed) : Math.random();
        var rngU = (Math.tanh(rng) + 1) * 0.5;
        // The perpendicular hold's only purpose is to give space to the
        // jumper EXITING NEXT. The last jumper in the stick has nobody
        // behind, so the wait is wasted altitude. opts.isLast lets the
        // caller signal this.
        var isLast = !!opts.isLast;
        var executesWait = (rngU < skill) && !isLast;

        // Pick inner steerer : full landing pattern (default) or simple direct nav
        var innerFn;
        if (opts.useLandingPattern !== false) {
            innerFn = createLandingPattern({ e: targetE, n: targetN }, vhMs, opts);
        } else {
            innerFn = createSteerToPoint(targetE, targetN, vhMs, opts);
        }

        return function (state, t) {
            if (executesWait && t < tPilot) {
                if (trackE != null && targetAlongTrack != null) {
                    var alongTrack = state[0] * trackE + state[1] * trackN;
                    if (alongTrack >= targetAlongTrack) return innerFn(state, t);
                }
                return { targetHeading: Math.atan2(perpE, perpN) * RAD2DEG };
            }
            return innerFn(state, t);
        };
    }

    // ── 9. FULL JUMPER SIMULATION ──────────────────────────────

    function simJumper(jp, env, rvZone, steerFn, dtCfg, t0) {
        dtCfg = dtCfg || { ff: 0.25, open: 0.1, canopy: 0.5 };
        t0 = t0 || 0;

        var vc = jp.vc || 50, vzV = jp.vzVoile || 5, glide = jp.glide || 2.5;
        var hOuvAbs = env.elevM + (jp.hOuv || 1000);
        var hBreakAbs = env.elevM + (jp.hBreak || 1500);
        var limitH = Math.max(hBreakAbs, hOuvAbs);

        // Build tracking vector for the RK4 physics (not post-processing)
        var trackVec = null;
        if (jp.isTracking && jp.trackDist > 0) {
            var tAxis = jp.trackAxis != null ? parseFloat(jp.trackAxis) : 90;
            // Monte-Carlo heading noise (and optional 180° flip for student drift)
            if (jp._trackAxisNoise) tAxis += jp._trackAxisNoise;
            var tRad = (env.axeDeg + tAxis) * DEG2RAD;
            var totalFallZ = env.altM - hOuvAbs;
            var vtTrack = vc * 1.15;
            var grTrack = Math.min(jp.trackDist / Math.max(totalFallZ, 100), 1.5);
            var vhTrack = grTrack * vtTrack;
            trackVec = { e: Math.sin(tRad) * vhTrack, n: Math.cos(tRad) * vhTrack };
        }

        // Phase 1: FF exit → break/opening limit
        var s0 = [env.exitE, env.exitN, env.altM, env.gsE, env.gsN, 0];
        var ff1 = simFreefall(s0, vc, limitH, env.isa, t0, dtCfg.ff, trackVec);

        // Phase 2: FF break → opening (if hBreak > hOuv)
        var ff2 = null;
        if (hBreakAbs > hOuvAbs) {
            var breakVec = null;
            if (jp._sepE !== undefined) {
                var breakFallZ = hBreakAbs - hOuvAbs;
                var grBreak = Math.min((jp._sepDist || 0) / Math.max(breakFallZ, 100), 1.5);
                var vhBreak = grBreak * vc * 1.15;
                if (jp._sepDist > 0)
                    breakVec = { e: jp._sepE * vhBreak / jp._sepDist, n: jp._sepN * vhBreak / jp._sepDist };
            }
            ff2 = simFreefall(ff1.fs, vc, hOuvAbs, env.isa, ff1.tEnd, dtCfg.ff, breakVec);
        }

        var statePreOpen = ff2 ? ff2.fs : ff1.fs;
        var tPreOpen = ff2 ? ff2.tEnd : ff1.tEnd;

        // Phase 3: Opening
        var open = simOpening(statePreOpen, vc, vzV, env.isa, env.elevM, dtCfg.open);

        // Phase 4: Canopy
        // Two semantics:
        //   - LEGACY (cfg.useLandingPattern === false) : stopFn fires when
        //       reaching rvZone at altitude X — margeRDV = altitude margin
        //       above target alt.
        //   - PATTERN (default) : continues all the way to the ground while
        //       executing a downwind/base/final pattern. margeRDV is then
        //       the SIGNED LANDING DISTANCE margin = landRadius - dist(land,target).
        //       We still record `zoneEntryMarge` for diagnostics.
        var letLandOnTarget = jp._useLandingPattern !== false;
        var zoneEntryMarge = -9999;
        var stopFn = null;
        if (rvZone) {
            stopFn = function (state) {
                var inside;
                if (rvZone.polygon && rvZone.polygon.length >= 3) {
                    inside = _pointInPolyEN(state[0], state[1], rvZone.polygon);
                } else {
                    inside = Math.abs(state[0] - rvZone.e) <= rvZone.L / 2 &&
                             Math.abs(state[1] - rvZone.n) <= rvZone.W / 2;
                }
                if (inside) {
                    if (zoneEntryMarge === -9999) {
                        zoneEntryMarge = state[2] - rvZone.altAbs;
                    }
                    if (!letLandOnTarget) {
                        return { stop: true, data: { marge: zoneEntryMarge } };
                    }
                }
                return { stop: false };
            };
        }
        var canopy = simCanopy(
            open.fs, vzV, glide, env.elevM, env.isa,
            steerFn, stopFn,
            { dt: dtCfg.canopy, skill: jp.skill || 1.0 }
        );

        var allSp = ff1.sp.slice();
        if (ff2) allSp = allSp.concat(ff2.sp);
        open.sp.forEach(function (p) {
            allSp.push({ t: tPreOpen + p.t, x: p.x, y: p.y, z: p.z });
        });
        var tCanopyStart = tPreOpen + (open.sp.length ? open.sp[open.sp.length - 1].t : 0);
        canopy.sp.forEach(function (p) {
            allSp.push({ t: tCanopyStart + p.t, x: p.x, y: p.y, z: p.z, mode: p.mode, phase: p.phase });
        });

        // Compute landing position vs landing zone. Two cases :
        //   - rvZone.polygon (preferred) : signed point-in-polygon distance
        //   - rectangle L×W (legacy)     : signed distance to rectangle edge
        //   landingDistance = scalar distance to centre (for stats)
        //   margeRDV (pattern mode) = SIGNED edge margin (≥0 inside, <0 outside)
        var landE = canopy.fs[0], landN = canopy.fs[1];
        var landingDistance = -1;
        var rectMarge = -9999;
        if (rvZone) {
            var dxLand = landE - rvZone.e, dyLand = landN - rvZone.n;
            landingDistance = Math.sqrt(dxLand * dxLand + dyLand * dyLand);
            if (rvZone.polygon && rvZone.polygon.length >= 3) {
                rectMarge = _signedDistToPolygon(landE, landN, rvZone.polygon);
            } else {
                var halfL = rvZone.L / 2, halfW = rvZone.W / 2;
                var adx = Math.abs(dxLand), ady = Math.abs(dyLand);
                if (adx <= halfL && ady <= halfW) {
                    rectMarge = Math.min(halfL - adx, halfW - ady);
                } else {
                    var edgeDx = Math.max(0, adx - halfL);
                    var edgeDy = Math.max(0, ady - halfW);
                    rectMarge = -Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);
                }
            }
        }

        var margeRDV;
        if (letLandOnTarget) {
            margeRDV = rvZone ? rectMarge : -9999;
        } else if (canopy.stopped && canopy.data && canopy.data.marge !== undefined) {
            margeRDV = canopy.data.marge;
        } else {
            margeRDV = -9999;
        }

        return {
            allSp: allSp,
            margeRDV: margeRDV,
            zoneEntryMarge: zoneEntryMarge,
            landingDistance: landingDistance,
            reachedZone: zoneEntryMarge > -9999 || (canopy.stopped || false),
            finalState: canopy.fs,
            openState: open.fs,
            exitE: env.exitE, exitN: env.exitN
        };
    }

    // ── 10. FULL PASS SIMULATION ───────────────────────────────

    function simPass(cfg) {
        var dz = cfg.dz, target = cfg.target, rv = cfg.rv;
        var axe = cfg.axe, crossNm = cfg.crossNm || 0, topNm = cfg.topNm || 0;
        var altM = cfg.altM, elevM = cfg.elevM, tasMs = cfg.tasMs, isa = cfg.isa || 0;
        // != null pour distinguer 0 (V3 : pas de délai) de undefined (V2/UI : 5s par défaut)
        var delaiTopVert = cfg.delaiTopVert != null ? cfg.delaiTopVert : 5;
        var espacementM = cfg.espacementM || 300;
        var jumpers = cfg.jumpers || [];
        var nPara = cfg.nPara || jumpers.length;
        var dtCfg = cfg.dtCfg || { ff: 0.25, open: 0.1, canopy: 0.5 };
        // Two safety thresholds (Steven Geens, "Exit Separation"):
        //   - safetyThresh = 78 m : minimum horizontal distance between two
        //     opening canopies allowing 3 s reaction time at 13 m/s airspeed.
        //   - criticalThresh = 30 m : collision-imminent distance.
        var safetyThresh = cfg.safetyThresh != null ? cfg.safetyThresh
            : (cfg.sepThresh != null ? cfg.sepThresh : 78);
        var criticalThresh = cfg.criticalThresh != null ? cfg.criticalThresh : 30;
        var timeMin = cfg.timeMin || 5;
        var nfzList = cfg.nfzList || [];

        var cosLat = Math.cos(dz.lat * DEG2RAD);
        var toE = function (lon) { return (lon - dz.lon) * 111320 * cosLat; };
        var toN = function (lat) { return (lat - dz.lat) * 111320; };

        var targetE = toE(target.lon), targetN = toN(target.lat);
        var rvE = toE(rv.lon), rvN = toN(rv.lat);

        var axeRad = axe * DEG2RAD;
        var trackE = Math.sin(axeRad), trackN = Math.cos(axeRad);

        var wJump = windAtZ(altM);
        var tw = wJump.e * trackE + wJump.n * trackN;
        var gsMs = Math.max(1, tasMs + tw);
        var dtSortie = espacementM / gsMs;

        var gsE = trackE * gsMs, gsN = trackN * gsMs;

        var crossM = crossNm * NM2M;
        var perpE = trackN, perpN = -trackE;
        var tgtE = targetE + crossM * perpE, tgtN = targetN + crossM * perpN;

        var distTopM = topNm * NM2M;
        var greenE = tgtE + trackE * distTopM, greenN = tgtN + trackN * distTopM;
        var p1ExitE = greenE + trackE * delaiTopVert * gsMs;
        var p1ExitN = greenN + trackN * delaiTopVert * gsMs;

        var rvL = cfg.rvLength || 400, rvW = cfg.rvWidth || 100;
        var rvAltAbs = elevM + (cfg.rvAlt || 300);
        var rvZone = { e: rvE, n: rvN, L: rvL, W: rvW, altAbs: rvAltAbs };
        // Always populate rvZone.polygon (in E/N) so downstream consumers
        // (margeRDV calc, adaptive pattern fallback) have a uniform shape :
        //   - if cfg.zonePolygon (user-drawn polygon) is provided, use it
        //   - else synthesise a 4-vertex rectangle from rvLength × rvWidth
        if (cfg.zonePolygon && cfg.zonePolygon.length >= 3) {
            rvZone.polygon = cfg.zonePolygon.map(function (p) {
                return { e: toE(p.lon), n: toN(p.lat) };
            });
        } else {
            var hL = rvL / 2, hW = rvW / 2;
            rvZone.polygon = [
                { e: rvE - hL, n: rvN - hW },
                { e: rvE + hL, n: rvN - hW },
                { e: rvE + hL, n: rvN + hW },
                { e: rvE - hL, n: rvN + hW }
            ];
        }

        // tPilot = perpendicular safety hold time. Default = time between
        // openings ≈ dtSortie - 5.5 s (opening duration). Each jumper holds
        // perpendicular until the next jumper has finished their opening,
        // matching real-world DZ practice. cfg.tPilotCommon overrides.
        var tPilotCommon = cfg.tPilotCommon != null
            ? parseFloat(cfg.tPilotCommon)
            : Math.max(2, dtSortie - 5.5);

        // Convert user-defined landing pattern (lat/lon WPs) to E/N relative
        // to the DZ. Passed through to createLandingPattern via opts.
        var userPatternEN = null;
        if (cfg.userPattern && cfg.userPattern.target) {
            var uLatLon = cfg.userPattern;
            var ll2en = function (p) { return { e: toE(p.lon), n: toN(p.lat) }; };
            userPatternEN = {
                downwindStart: ll2en(uLatLon.downwindStart),
                baseStart:     ll2en(uLatLon.baseStart),
                finalStart:    ll2en(uLatLon.finalStart),
                target:        ll2en(uLatLon.target)
            };
        }

        // Threshold for skipping the perpendicular hold : use the active
        // circuit's downwindStart projected on the track axis if available
        // (the pilot is committed to the circuit once past it), else fall
        // back to the DZ centroid. Without this, a pilot opened just east
        // of the DZ but already past downwindStart would still wait
        // perpendicular for nothing.
        var skipHoldRefE = userPatternEN ? userPatternEN.downwindStart.e : targetE;
        var skipHoldRefN = userPatternEN ? userPatternEN.downwindStart.n : targetN;
        var targetAlongTrack = skipHoldRefE * trackE + skipHoldRefN * trackN;

        // Convert evolution zone (lat/lon → E/N). Either a circle (center +
        // radius) or a polygon (≥3 vertices). The pilot bleeds altitude
        // inside this zone before joining the landing circuit.
        var evolutionZoneEN = null;
        if (cfg.evolutionZone) {
            var ez = cfg.evolutionZone;
            if (ez.type === 'circle' && ez.center && ez.radiusM > 0) {
                evolutionZoneEN = {
                    type: 'circle',
                    center: { e: toE(ez.center.lon), n: toN(ez.center.lat) },
                    radiusM: ez.radiusM
                };
            } else if (ez.type === 'polygon' && ez.vertices && ez.vertices.length >= 3) {
                evolutionZoneEN = {
                    type: 'polygon',
                    vertices: ez.vertices.map(function (v) {
                        return { e: toE(v.lon), n: toN(v.lat) };
                    })
                };
            }
        }

        var positions = [], timedTrajs = [];

        var rvDeltaE = rvE - p1ExitE, rvDeltaN = rvN - p1ExitN;
        var crossSign = trackE * rvDeltaN - trackN * rvDeltaE;
        var jPerpE = crossSign >= 0 ? -trackN : trackN;
        var jPerpN = crossSign >= 0 ? trackE : -trackE;

        // Pré-calcule le délai cumulatif d'exit de chaque groupe. Le gap
        // ENTRE deux groupes consécutifs dépend du type du groupe qui
        // sort :
        //   - tandem ou PAC : 15 s base (climb-out long)
        //   - groupe ≥ 4 paras (RW/freefly) : dtSortie + 2 s
        //   - autres : dtSortie
        // En MC, cfg._gapNoise[k] (asymétrique, biais positif) ajoute
        // du bruit sur le gap k → simule l'incertitude réelle de timing.
        var gapNoise = cfg._gapNoise || [];
        function _gapForJumper(jp, dtBase) {
            if (!jp) return dtBase;
            var nm = (jp.name || '').toLowerCase();
            var isTandem = jp.id === 'tandem' || jp.isTandem || nm.indexOf('tandem') >= 0;
            var isPac = jp.id === 'pac' || jp.id === 'pac_first' ||
                        nm.indexOf('pac') === 0;
            if (isTandem || isPac) return 15;
            var nb = parseInt(jp.nbPara) || 1;
            if (nb >= 4) return dtBase + 2;
            return dtBase;
        }
        var delays = new Array(nPara);
        delays[0] = delaiTopVert;
        for (var dk = 1; dk < nPara; dk++) {
            var jpForGap = jumpers[dk] || jumpers[jumpers.length - 1];
            var gap = _gapForJumper(jpForGap, dtSortie);
            gap += (gapNoise[dk] || 0);
            // Garde-fou : on ne peut pas sortir avant le précédent
            if (gap < 0.5) gap = 0.5;
            delays[dk] = delays[dk - 1] + gap;
        }

        for (var j = 0; j < nPara; j++) {
            var defaultP = jumpers.length ? jumpers[jumpers.length - 1] : { vc: 50, vzVoile: 5, glide: 2.5, hOuv: 1000 };
            var p = jumpers[j] || Object.assign({}, defaultP);
            var nbInGroup = Math.max(1, parseInt(p.nbPara) || 1);
            var sepDist = parseFloat(p.sepDist) || 0;
            // Le délai du premier groupe = delaiTopVert (compte dans
            // p1ExitE déjà). Pour les suivants, on remplace par la
            // somme cumulée des gaps.
            var delay = delays[j] - delaiTopVert;

            var exitE = p1ExitE + trackE * delay * gsMs;
            var exitN = p1ExitN + trackN * delay * gsMs;

            for (var sub = 0; sub < nbInGroup; sub++) {
                var jp = Object.assign({}, p);

                // Per-sub field overrides (e.g. PAC group: élève hOuv=1500 vs
                // moniteur hOuv=1000, breakoffDist=200). Applied BEFORE the
                // separation-direction logic so each sub's own breakoff fields
                // can drive the FF2 horizontal velocity.
                if (p.subOverrides && p.subOverrides[sub]) {
                    Object.assign(jp, p.subOverrides[sub]);
                }

                if (jp.breakoffDist > 0 && jp.breakoffAxis != null) {
                    // Per-sub explicit break-off (PAC moniteur). Takes priority
                    // over the radial fan-out so a group with subOverrides can
                    // mix vertical-only members and tracking members.
                    var brDist = parseFloat(jp.breakoffDist) || 0;
                    var brAxis = parseFloat(jp.breakoffAxis) || 0;
                    if (jp._breakoffAxisNoise) brAxis += jp._breakoffAxisNoise;
                    var brRad = (axe + brAxis) * DEG2RAD;
                    jp._sepE = Math.sin(brRad) * brDist;
                    jp._sepN = Math.cos(brRad) * brDist;
                    jp._sepDist = brDist;
                } else if (nbInGroup > 1 && sepDist > 0) {
                    // Default circular fan-out for traditional RW groups
                    var angDeg = (360 / nbInGroup) * sub;
                    if (p._subAngleNoise && p._subAngleNoise[sub] != null) {
                        angDeg += p._subAngleNoise[sub];
                    }
                    var angRad = angDeg * DEG2RAD;
                    jp._sepE = Math.sin(angRad) * sepDist;
                    jp._sepN = Math.cos(angRad) * sepDist;
                    jp._sepDist = sepDist;
                }

                var env = {
                    exitE: exitE, exitN: exitN,
                    altM: altM, elevM: elevM, isa: isa,
                    gsE: gsE, gsN: gsN,
                    axeDeg: axe, trackE: trackE, trackN: trackN
                };

                // Propagate landing-pattern flag to the canopy phase
                jp._useLandingPattern = cfg.useLandingPattern !== false;

                var vh = (p.vzVoile || 5) * (p.glide || 2.5);
                var steerFn = createSteerTwoPhase(jPerpE, jPerpN, rvE, rvN, vh, tPilotCommon, {
                    skill: p.skill || 1.0,
                    glide: p.glide || 2.5,
                    canopyType: p.canopyType || 'docile',
                    targetAltAbs: rvAltAbs,
                    modeEnabled: cfg.canopyModesEnabled !== false,
                    trackE: trackE, trackN: trackN,
                    targetAlongTrack: targetAlongTrack,
                    // Last jumper in stick → skip the perpendicular hold
                    // (nobody behind to give space to).
                    isLast: (j === nPara - 1),
                    // Landing pattern settings (per cfg) ─────────────
                    useLandingPattern: cfg.useLandingPattern !== false,
                    userPatternEN: userPatternEN,
                    evolutionZoneEN: evolutionZoneEN,
                    zonePolygonEN: rvZone.polygon || null,
                    elevM: elevM,
                    altDownwind: cfg.landAltDownwind != null ? cfg.landAltDownwind : 300,
                    altBase: cfg.landAltBase != null ? cfg.landAltBase : 150,
                    altFinal: cfg.landAltFinal != null ? cfg.landAltFinal : 60,
                    finalSeconds: cfg.landFinalSeconds != null ? cfg.landFinalSeconds : 10,
                    patternSide: cfg.landPatternSide || 'left',
                    noiseSeed: cfg._mcNoise ? cfg._mcNoise[j] || 0 : 0
                });

                var res = simJumper(jp, env, rvZone, steerFn, dtCfg, delay);

                positions.push({
                    idx: j, sub: sub,
                    exit: { e: exitE, n: exitN },
                    open: { e: res.openState[0], n: res.openState[1] },
                    land: { e: res.finalState[0], n: res.finalState[1] },
                    margeRDV: res.margeRDV,
                    landingDistance: res.landingDistance,
                    zoneEntryMarge: res.zoneEntryMarge,
                    reachedZone: res.reachedZone
                });
                timedTrajs.push({ t0: delay, sp: res.allSp, groupIdx: j });
            }
        }

        var allPairMinDists = computePairMinDists(timedTrajs);
        // Tag intra-group pairs so the GO check ignores them: members of the
        // same logical group (e.g. PAC élève + moniteur) are intentionally
        // co-located until break-off and shouldn't be flagged for separation.
        allPairMinDists.forEach(function (md) {
            md.intraGroup = timedTrajs[md.idxA] && timedTrajs[md.idxB] &&
                timedTrajs[md.idxA].groupIdx === timedTrajs[md.idxB].groupIdx;
        });

        var nfzViolation = false;
        if (nfzList.length) {
            for (var ti = 0; ti < timedTrajs.length; ti++) {
                if (_checkNFZ(timedTrajs[ti].sp, nfzList)) nfzViolation = true;
            }
        }

        // ── Critères Go/No-Go décomposés ──────────────────────
        // 1. NFZ
        var nfzOk = !nfzViolation;
        // 2. RDV reach : tous les paras atteignent la zone à l'altitude voulue
        var reachOk = positions.every(function (po) { return po.margeRDV >= 0; });
        // 3. Sécurité : aucune paire inter-groupe sous le seuil de sécurité (78 m Geens)
        // 4. Critique : aucune paire inter-groupe sous le seuil critique (30 m collision)
        var safetyOk = true, criticalOk = true;
        var minSepInter = Infinity, minSepPair = null;
        allPairMinDists.forEach(function (md) {
            if (md.intraGroup) return;
            if (md.dist < minSepInter) { minSepInter = md.dist; minSepPair = md; }
            if (md.dist < safetyThresh) safetyOk = false;
            if (md.dist < criticalThresh) criticalOk = false;
        });
        if (dtSortie < timeMin) { safetyOk = false; }

        var go = nfzOk && reachOk && safetyOk;

        return {
            go: go,
            nfzOk: nfzOk,
            reachOk: reachOk,
            safetyOk: safetyOk,
            criticalOk: criticalOk,
            minSepInter: minSepInter === Infinity ? null : minSepInter,
            minSepPair: minSepPair,
            positions: positions,
            timedTrajs: timedTrajs,
            allPairMinDists: allPairMinDists,
            dtSortie: dtSortie,
            gsMs: gsMs,
            greenE: greenE, greenN: greenN,
            // Position du dernier exit = p1Exit + (delays[N-1] - delaiTopVert) × GS
            redE: p1ExitE + trackE * (delays[nPara - 1] - delaiTopVert) * gsMs,
            redN: p1ExitN + trackN * (delays[nPara - 1] - delaiTopVert) * gsMs,
            delays: delays.slice(),       // délais cumulés par groupe (s)
            axe: axe, crossNm: crossNm, topNm: topNm, nPara: nPara
        };
    }

    function _checkNFZ(sp, nfzList) {
        for (var zi = 0; zi < nfzList.length; zi++) {
            var z = nfzList[zi];
            if (z.type !== 'hard') continue;
            var bb = z._bbox;
            if (!bb) continue;
            for (var ti = 0; ti < sp.length; ti++) {
                var pt = sp[ti];
                var alt = pt.z;
                if (alt < z.altMin || alt > z.altMax) continue;
                if (pt.x < bb.minE || pt.x > bb.maxE || pt.y < bb.minN || pt.y > bb.maxN) continue;
                if (_pointInPoly(pt.x, pt.y, z._polyEN)) return true;
            }
        }
        return false;
    }

    function _pointInPoly(e, n, poly) {
        var inside = false;
        for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            var pi = poly[i], pj = poly[j];
            if ((pi.n > n) !== (pj.n > n) &&
                e < (pj.e - pi.e) * (n - pi.n) / (pj.n - pi.n) + pi.e) {
                inside = !inside;
            }
        }
        return inside;
    }

    // Aliases for landing-zone polygon (same algorithm, different caller)
    function _pointInPolyEN(e, n, poly) { return _pointInPoly(e, n, poly); }

    // Distance from point (e, n) to nearest edge of an open polygon segment.
    function _distToPolyEdge(e, n, poly) {
        var best = Infinity;
        for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            var ex = poly[j].e, ey = poly[j].n;
            var fx = poly[i].e, fy = poly[i].n;
            var dx = fx - ex, dy = fy - ey;
            var len2 = dx * dx + dy * dy;
            var t = len2 > 0 ? ((e - ex) * dx + (n - ey) * dy) / len2 : 0;
            t = Math.max(0, Math.min(1, t));
            var px = ex + t * dx, py = ey + t * dy;
            var ddx = e - px, ddy = n - py;
            var d = Math.sqrt(ddx * ddx + ddy * ddy);
            if (d < best) best = d;
        }
        return best;
    }

    // Signed distance to polygon boundary : positive inside, negative outside.
    function _signedDistToPolygon(e, n, poly) {
        var d = _distToPolyEdge(e, n, poly);
        return _pointInPolyEN(e, n, poly) ? d : -d;
    }

    /**
     * Compute the minimum HORIZONTAL approach distance between every pair of
     * trajectories — not just consecutive ones. This is the relevant safety
     * metric (cf. Steven Geens, "Exit Separation": only horizontal distance
     * matters because canopies fly horizontally and reaction time × airspeed
     * defines the safe bubble around an opening canopy).
     *
     * Each returned pair carries:
     *   - dist : minimum horizontal distance during co-fall
     *   - t    : time at which that minimum is reached
     *   - intraGroup : both members belong to the same simPass group
     *                  (e.g. PAC élève + moniteur) — caller may ignore those
     */
    function computePairMinDists(timedTrajs) {
        var pairs = [];
        for (var i = 0; i < timedTrajs.length - 1; i++) {
            for (var j = i + 1; j < timedTrajs.length; j++) {
                var pair = _pairMinDist(timedTrajs[i], timedTrajs[j], i, j);
                if (pair) pairs.push(pair);
            }
        }
        return pairs;
    }

    function _pairMinDist(trajA, trajB, idxA, idxB) {
        var tA = trajA.sp, tB = trajB.sp;
        if (!tA || !tB || !tA.length || !tB.length) return null;
        var tsStart = Math.max(tA[0].t, tB[0].t);
        var tsEnd = Math.min(tA[tA.length - 1].t, tB[tB.length - 1].t);
        // 10 s after the LATER of the two exits — gives time to clear the
        // immediate exit point before evaluating "approach"
        var laterT0 = Math.max(trajA.t0 || 0, trajB.t0 || 0);
        var validStart = laterT0 + 10;
        var best = Infinity, bestT = null;

        // Sample on whichever trajectory has fewer points to bound cost
        var src = tA.length <= tB.length ? tA : tB;
        var other = src === tA ? tB : tA;
        for (var si = 0; si < src.length; si++) {
            var sA = src[si];
            if (sA.t < tsStart || sA.t < validStart || sA.t > tsEnd) continue;
            var pB = interpSp(other, sA.t);
            if (!pB) continue;
            var dx = sA.x - pB.x, dy = sA.y - pB.y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d < best) { best = d; bestT = sA.t; }
        }
        if (best === Infinity) return null;
        return {
            dist: best, t: bestT, idxA: idxA, idxB: idxB,
            intraGroup: trajA.groupIdx != null && trajA.groupIdx === trajB.groupIdx
        };
    }

    function interpSp(sp, t) {
        if (!sp.length || t <= sp[0].t) return sp[0] || null;
        if (t >= sp[sp.length - 1].t) return sp[sp.length - 1];
        var lo = 0, hi = sp.length - 1;
        while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (sp[mid].t <= t) lo = mid; else hi = mid; }
        var f = (t - sp[lo].t) / (sp[hi].t - sp[lo].t);
        return { x: sp[lo].x + f * (sp[hi].x - sp[lo].x), y: sp[lo].y + f * (sp[hi].y - sp[lo].y), t: t };
    }

    // ── 11. OBJECTIVE FUNCTION ─────────────────────────────────
    function objectiveScore(result, windFromDeg) {
        if (!result.go) return -Infinity;

        var score = result.nPara * 10000;

        // Wind alignment bonus — face au vent = optimal
        var axeDiff = ((result.axe - windFromDeg + 540) % 360) - 180;
        score += Math.max(0, 1 - Math.abs(axeDiff) / 90) * 500;

        var mg = result.positions.map(function (p) { return p.margeRDV; });
        var margeMin = mg.length ? Math.min.apply(null, mg) : -9999;
        score += Math.min(margeMin / 300, 1) * 2000;

        var seps = result.allPairMinDists.map(function (m) { return m.dist; });
        var sepMin = seps.length ? Math.min.apply(null, seps) : 9999;
        score += Math.min(sepMin / 400, 1) * 1500;

        score += Math.min(result.dtSortie / 12, 1) * 300;
        score -= Math.abs(result.crossNm) * 200;

        return score;
    }

    // ── 12. CLASSIC EXIT ORDER ─────────────────────────────────
    var EXIT_PRIORITY = {
        'hop_pop': 0, 'angle': 1, 'belly_big': 2, 'belly_small': 3,
        'freefly_big': 4, 'freefly_small': 5, 'aff': 6, 'tandem': 7,
        'tracking': 8, 'wingsuit': 9
    };

    function classifyJumper(j) {
        if ((j.hOuv || 1000) > 1500) return 'hop_pop';
        if (j.isWingsuit) return 'wingsuit';
        if (j.isTandem || (j.name && j.name.toLowerCase().indexOf('tandem') >= 0)) return 'tandem';
        if (j.isAFF || (j.name && (j.name.toLowerCase().indexOf('élève') >= 0 || j.name.toLowerCase().indexOf('eleve') >= 0))) return 'aff';
        if (j.isTracking && (j.trackDist || 0) > 500) return 'tracking';
        var vc = j.vc || 50;
        var nb = parseInt(j.nbPara) || 1;
        if (vc > 60) return nb > 3 ? 'freefly_big' : 'freefly_small';
        return nb > 4 ? 'belly_big' : 'belly_small';
    }

    function classicExitOrder(jumpers) {
        return jumpers.slice().sort(function (a, b) {
            var pa = EXIT_PRIORITY[classifyJumper(a)] !== undefined ? EXIT_PRIORITY[classifyJumper(a)] : 5;
            var pb = EXIT_PRIORITY[classifyJumper(b)] !== undefined ? EXIT_PRIORITY[classifyJumper(b)] : 5;
            if (pa !== pb) return pa - pb;
            return (parseInt(b.nbPara) || 1) - (parseInt(a.nbPara) || 1);
        });
    }

    // V3-specific exit order : tandem strictement en dernier (= ancre
    // top fin), PAC duo juste avant. Trackers placés AVANT tandem
    // (contrairement à classicExitOrder où tracking est priorité 8 et
    // termine après tandem). Le reste suit l'ordre méthodologique
    // gros VR → solos → gros FF → solos → tracking → élèves → PAC →
    // tandem.
    function v3ExitOrder(jumpers) {
        function _v3prio(j) {
            // Detection PAC (non gérée par classifyJumper)
            if (j.id === 'pac' || (j.name && j.name.toUpperCase().indexOf('PAC') === 0)) return 90;
            // Detection tandem explicite
            if (j.id === 'tandem' || j.isTandem ||
                (j.name && j.name.toLowerCase().indexOf('tandem') >= 0)) return 99;
            var c = classifyJumper(j);
            var map = {
                hop_pop: 1, belly_big: 2, belly_small: 3,
                freefly_big: 4, freefly_small: 5, aff: 6,
                tracking: 7, angle: 8, wingsuit: 95
            };
            return map[c] !== undefined ? map[c] : 50;
        }
        return jumpers.slice().sort(function (a, b) {
            var pa = _v3prio(a), pb = _v3prio(b);
            if (pa !== pb) return pa - pb;
            // Dans la même classe : grand groupe avant petit
            return (parseInt(b.nbPara) || 1) - (parseInt(a.nbPara) || 1);
        });
    }

    // ── PUBLIC API ─────────────────────────────────────────────
    return {
        KT2MS: KT2MS, NM2M: NM2M, DEG2RAD: DEG2RAD, RAD2DEG: RAD2DEG, G: G, RHO0: RHO0,
        getDensity: getDensity,
        densityCorrection: densityCorrection,
        computeTAS: computeTAS,
        setWindProfile: setWindProfile,
        enableWindCache: enableWindCache,
        windAtZ: windAtZ,
        rk4: rk4, rk2: rk2,
        simFreefall: simFreefall,
        simOpening: simOpening,
        simCanopy: simCanopy,
        createSteerToPoint: createSteerToPoint,
        createLandingPattern: createLandingPattern,
        selectCanopyMode: selectCanopyMode,
        CANOPY_MODES: CANOPY_MODES,
        CANOPY_TYPE_PROFILES: CANOPY_TYPE_PROFILES,
        createSteerTwoPhase: createSteerTwoPhase,
        simJumper: simJumper,
        simPass: simPass,
        objectiveScore: objectiveScore,
        classicExitOrder: classicExitOrder,
        v3ExitOrder: v3ExitOrder,
        classifyJumper: classifyJumper,
        interpSp: interpSp,
        computePairMinDists: computePairMinDists
    };
})();

if (typeof module !== 'undefined') module.exports = PhysicsCore;
