// ================================================================
//  SIMULATION ENGINE — DZ Drop Simulator
//  Aero, RK4, Phases, Orchestration, Optimizer, Go/No-Go
//  Paramètres corrigés: vc=50 m/s, vzVoile=5.0 m/s
// ================================================================

// ================================================================
//  AERO COMPUTATIONS
// ================================================================
function hpa2alt(hpa) {
    return 44330.77 * (1 - Math.pow(hpa / 1013.25, 0.1902632));
}

function getAtmosphere(altM, isaDelta) {
    var isa = isaDelta || 0;
    var T, P;

    if (altM <= 11000) {
        // Troposphère
        T = 288.15 - 0.0065 * altM + isa;
        P = 101325 * Math.pow((288.15 - 0.0065 * altM) / 288.15, 5.2559);
    } else if (altM <= 20000) {
        // Tropopause (T constante)
        T = 216.65 + isa;
        var P11 = 101325 * Math.pow(216.65 / 288.15, 5.2559); // ~22632 Pa
        P = P11 * Math.exp(-9.81 * (altM - 11000) / (287.058 * 216.65));
    } else {
        // Stratosphère basse
        T = 216.65 + 0.001 * (altM - 20000) + isa;
        var P11 = 101325 * Math.pow(216.65 / 288.15, 5.2559);
        var P20 = P11 * Math.exp(-9.81 * 9000 / (287.058 * 216.65));
        P = P20 * Math.pow(T / (216.65 + isa), -9.81 / (0.001 * 287.058));
    }

    T = Math.max(T, 150); // sécurité
    var rho = P / (287.058 * T);
    return { T: T, P: P, rho: rho };
}

/**
 * Moteur RK2 (Heun) pour phases transitoires.
 */
function rk2Step(state, dt, vTerm, isaDelta) {
    var k1 = getDerivatives(state, vTerm, isaDelta);
    var sPredict = state.map((v, i) => v + dt * k1[i]);
    var k2 = getDerivatives(sPredict, vTerm, isaDelta);
    return state.map((v, i) => v + 0.5 * dt * (k1[i] + k2[i]));
}

// ── Density LUT: ISA+0, 0..13 000 m, step 10 m (built once at load) ──────────
var _densityLUT = (function () {
    var t = new Float64Array(1301);
    for (var i = 0; i <= 1300; i++) t[i] = getAtmosphere(i * 10, 0).rho;
    return t;
}());

function getDensity(altM, isaDelta) {
    isaDelta = isaDelta || 0;
    // Fast LUT path for standard ISA (covers 99 % of calls in optimiser)
    if (isaDelta === 0 && altM >= 0 && altM <= 13000) {
        var idx = altM * 0.1, lo = idx | 0, hi = Math.min(lo + 1, 1300);
        return _densityLUT[lo] + (idx - lo) * (_densityLUT[hi] - _densityLUT[lo]);
    }
    return getAtmosphere(altM, isaDelta).rho;
}

function computeTAS(kias, altM, isaDelta) {

    var rho0 = 1.225;
    var rho = getDensity(altM, isaDelta);
    return kias * Math.sqrt(rho0 / rho);
}

function windToEN(spdKt, fromDeg) {
    var s = spdKt * 0.514444;
    var rad = fromDeg * Math.PI / 180;
    return { e: -s * Math.sin(rad), n: -s * Math.cos(rad) };
}

var sortedWindProfile = [];
function updateSortedWindProfile() {
    sortedWindProfile = [...windProfile].sort((a, b) => a.z - b.z);
}

function windVecAtZ(z) {
    if (!sortedWindProfile.length) updateSortedWindProfile();
    var profile = sortedWindProfile;
    if (!profile.length) return { e: 0, n: 0 };

    // Log surface profile below lowest layer (Prandtl roughness length z0 = 0.03 m grass)
    var z0 = 0.03, zRef = profile[0].z > 0 ? profile[0].z : 10;
    if (z <= profile[0].z) {
        var baseEN = windToEN(profile[0].spd, profile[0].dir);
        var logFactor = z > z0 ? Math.log(Math.max(z, z0 + 0.01) / z0) / Math.log(zRef / z0) : 0;
        return { e: baseEN.e * logFactor, n: baseEN.n * logFactor };
    }
    if (z >= profile[profile.length - 1].z) return windToEN(profile[profile.length - 1].spd, profile[profile.length - 1].dir);

    // Binary search O(log n)
    var lo = 0, hi = profile.length - 1;
    while (hi - lo > 1) {
        var mid = (lo + hi) >> 1;
        if (profile[mid].z <= z) lo = mid;
        else hi = mid;
    }

    // Vectorial interpolation — avoids lerpAngle artefacts on opposing winds
    var f = (z - profile[lo].z) / (profile[hi].z - profile[lo].z);
    var wLo = windToEN(profile[lo].spd, profile[lo].dir);
    var wHi = windToEN(profile[hi].spd, profile[hi].dir);
    return { e: wLo.e + f * (wHi.e - wLo.e), n: wLo.n + f * (wHi.n - wLo.n) };
}

// ================================================================
//  RK4 PHYSICS ENGINE
// ================================================================
function getDerivatives(state, vTerm, isaDelta) {
    var z = Math.max(state[2], 0);
    var wind = windVecAtZ(z);

    var vx = state[3], vy = state[4], vz = state[5];
    var vrx = vx - wind.e;
    var vry = vy - wind.n;
    var vrz = vz;

    var rho0 = 1.225;
    var rhoZ = getDensity(z, isaDelta);
    var vrNorm = Math.sqrt(vrx * vrx + vry * vry + vrz * vrz);
    if (vrNorm < 0.01) vrNorm = 0.01;

    var coef = (rhoZ / rho0) * 9.81 / (vTerm * vTerm);
    var ax = -coef * vrNorm * vrx;
    var ay = -coef * vrNorm * vry;
    var az = -9.81 - coef * vrNorm * vrz;

    return [vx, vy, vz, ax, ay, az];
}

function rk4Step(state, dt, vTerm, isaDelta) {
    var k1 = getDerivatives(state, vTerm, isaDelta);
    var s2 = state.map(function (val, i) { return val + 0.5 * dt * k1[i]; });
    var k2 = getDerivatives(s2, vTerm, isaDelta);
    var s3 = state.map(function (val, i) { return val + 0.5 * dt * k2[i]; });
    var k3 = getDerivatives(s3, vTerm, isaDelta);
    var s4 = state.map(function (val, i) { return val + dt * k3[i]; });
    var k4 = getDerivatives(s4, vTerm, isaDelta);
    var nextState = state.map(function (val, i) {
        return val + (dt / 6.0) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    });
    // Stability floor for canopy-phase (very low vTerm) to avoid integrator
    // oscillation near terminal velocity. Documented: keeps vz from drifting
    // positive when the small-vTerm regime over-shoots gravity in one RK4 step.
    if (vTerm < 20 && nextState[5] > -1) nextState[5] = -1;
    return nextState;
}

function simulatePhase(initialState, vTerm, targetZ, dt, isaDelta) {
    var trajectory = [initialState.slice()];
    var state = initialState.slice();
    var time = 0;
    for (var i = 0; i < 30000; i++) {
        var nextState = rk4Step(state, dt, vTerm, isaDelta);
        time += dt;
        if (isNaN(nextState[2])) { console.error("Simulation instability: NaN"); break; }
        if (nextState[2] > state[2] + 2) { console.error("Simulation instability: Alt increasing"); break; }
        if (nextState[2] <= targetZ) {
            if (state[2] > targetZ) {
                var frac = (state[2] - targetZ) / (state[2] - nextState[2]);
                if (frac > 1) frac = 1; if (frac < 0) frac = 0;
                var exact = state.map(function (val, idx) { return val + frac * (nextState[idx] - val); });
                exact[2] = targetZ;
                trajectory.push(exact);
            }
            break;
        }
        trajectory.push(nextState.slice());
        state = nextState;
    }
    return trajectory;
}

function simulateOpeningPhase(stateAtDeploy, params) {
    var trajectory = [];
    var state = stateAtDeploy.slice();
    var dt = 0.05; // pas fin pour capturer la dynamique

    var tPilotChute = 1.0;   // secondes avant extraction
    var tLineStretch = 1.5;  // secondes pour extension suspentes
    var tInflation = 3.0;    // secondes pour inflation complète
    var tTotal = tPilotChute + tLineStretch + tInflation;

    var vcFF = params.vc;     // vTerm chute libre
    var vcCanopy = 3 * params.vzVoile; // vTerm "artificiel" élevé au début de l'inflation (drag croissant)

    for (var t = 0; t < tTotal; t += dt) {
        var effectiveVTerm;

        if (t < tPilotChute) {
            // Phase 1 : extracteur - légère augmentation du drag
            var f = t / tPilotChute;
            effectiveVTerm = vcFF * (1 - 0.1 * f); // 10% de drag en plus
        } else if (t < tPilotChute + tLineStretch) {
            // Phase 2 : extension des suspentes - drag augmente progressivement
            var f = (t - tPilotChute) / tLineStretch;
            effectiveVTerm = vcFF + f * (vcCanopy - vcFF);
        } else {
            // Phase 3 : inflation - convergence vers paramètres voile
            var f = (t - tPilotChute - tLineStretch) / tInflation;
            f = f * f * (3 - 2 * f); // smoothstep
            effectiveVTerm = vcCanopy + f * (params.vzVoile - vcCanopy);
        }

        effectiveVTerm = Math.max(effectiveVTerm, params.vzVoile);
        // Utilisation de RK2 pour cette phase transitoire
        state = rk2Step(state, dt, effectiveVTerm, params.isaDelta);

        if (state[2] <= params.elevM) break;
        trajectory.push(state.slice());
    }

    return trajectory;
}

/**
 * Canopy phase that flies all the way to the ground. The first state to
 * enter the landing zone rectangle is tagged with `_reachedZone = true` for
 * any visualisation that wants to highlight the zone-entry point, but the
 * simulation continues to touchdown.
 *
 * The function name is preserved for backward compatibility but the
 * "ZoneStop" semantics is now "ZoneTag" — we just record the first entry.
 *
 * @param {Array}    initialState  [e, n, z, ve, vn, vz]
 * @param {number}   vv            canopy sink rate (m/s)
 * @param {number}   glide         glide ratio
 * @param {number}   elevM         ground elevation (m AMSL)
 * @param {Function} steerFn       steering function (state, t) -> {e, n}
 * @param {Object}   rvZone        { e, n, L, W } — landing zone rectangle
 * @param {number}   rvAltAbs      reference altitude (kept for API compat)
 * @param {number}   isaDelta      ISA delta (°C)
 */
function simulateCanopyPhaseWithZoneStop(initialState, vv, glide, elevM, steerFn, rvZone, rvAltAbs, isaDelta) {
    var trajectory = [];
    var state = initialState.slice();
    var heading = Math.atan2(state[3], state[4]) * 180 / Math.PI;
    var dt = 0.5;
    var isa = isaDelta || 0;

    var vhTrim = vv * glide;
    var vzTrim = vv;
    var maxTurnRate = 30;
    var turnSinkFactor = 0.015;
    var zoneTagged = false;

    function inZone(e, n) {
        if (!rvZone) return false;
        if (rvZone.polygon && rvZone.polygon.length >= 3) {
            // Ray-cast point-in-polygon
            var inside = false;
            var poly = rvZone.polygon;
            for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                var pi = poly[i], pj = poly[j];
                if ((pi.n > n) !== (pj.n > n) &&
                    e < (pj.e - pi.e) * (n - pi.n) / (pj.n - pi.n) + pi.e) inside = !inside;
            }
            return inside;
        }
        return Math.abs(e - rvZone.e) <= rvZone.L / 2 &&
               Math.abs(n - rvZone.n) <= rvZone.W / 2;
    }

    trajectory.push(state.slice());

    for (var i = 0; i < 12000; i++) {
        var z = Math.max(state[2], 0);
        var wind = windVecAtZ(z);

        var target = steerFn ? steerFn(state, i * dt) : { e: 0, n: 0 };
        var targetHeading = Math.atan2(target.e, target.n) * 180 / Math.PI;
        // Mode multipliers passed by the steerFn (FLARE = vh×0.3 vz×0.75 etc.).
        // Without these the visual canopy ignores brake mode and drifts
        // downwind in face-wind hold instead of bleeding altitude in place.
        var vhMul = (target.vhMul != null) ? target.vhMul : 1.0;
        var vzMul = (target.vzMul != null) ? target.vzMul : 1.0;
        // Normalised mode key for rendering distinction on the map.
        // Classification is unambiguous from the (vhMul, vzMul) pair :
        //   FLARE      vh×0.30  vz×0.75
        //   MIN_SINK   vh×0.55  vz×0.65
        //   BEST_GLIDE vh×1.00  vz×0.85
        //   TRIM       vh×1.00  vz×1.00
        var modeKey;
        if (vhMul < 0.5) modeKey = 'FLARE';
        else if (vhMul < 0.95) modeKey = 'MIN_SINK';
        else if (vzMul < 0.95) modeKey = 'BEST_GLIDE';
        else modeKey = 'TRIM';

        var dh = targetHeading - heading;
        while (dh > 180) dh -= 360;
        while (dh < -180) dh += 360;

        var turnRate = Math.max(-maxTurnRate, Math.min(maxTurnRate, dh / dt));
        heading += turnRate * dt;
        heading = ((heading % 360) + 360) % 360;

        var densityCorrFactor = Math.sqrt(1.225 / getDensity(z, isa));
        var vhAct = vhTrim * vhMul * densityCorrFactor;
        var vzAct = vzTrim * vzMul * densityCorrFactor + turnSinkFactor * turnRate * turnRate;

        var hRad = heading * Math.PI / 180;
        var vx = Math.sin(hRad) * vhAct + wind.e;
        var vy = Math.cos(hRad) * vhAct + wind.n;
        var vz = -vzAct;

        var nextState = [
            state[0] + vx * dt, state[1] + vy * dt, state[2] + vz * dt,
            vx, vy, vz
        ];
        nextState._mode = modeKey;

        // Tag the FIRST point that enters the landing zone (diagnostic only,
        // we no longer stop the simulation — the canopy flies to the ground).
        if (!zoneTagged && inZone(nextState[0], nextState[1])) {
            nextState._reachedZone = true;
            zoneTagged = true;
        }

        // Stop at ground (touchdown)
        if (nextState[2] <= elevM) {
            var frac = (state[2] - elevM) / (state[2] - nextState[2]);
            frac = Math.max(0, Math.min(1, frac));
            var exact = state.map(function (v, idx) { return v + frac * (nextState[idx] - v); });
            exact[2] = elevM;
            exact._mode = modeKey;
            if (nextState._reachedZone) exact._reachedZone = true;
            trajectory.push(exact);
            break;
        }

        // Custom array properties (_mode, _reachedZone) are NOT copied by
        // slice(), so we transfer them explicitly to the snapshot pushed
        // into the trajectory.
        var snap = nextState.slice();
        snap._mode = modeKey;
        if (nextState._reachedZone) snap._reachedZone = true;
        trajectory.push(snap);
        state = nextState;
    }

    return trajectory;
}

function dist2(a, b) {
    return Math.sqrt((a.e - b.e) * (a.e - b.e) + (a.n - b.n) * (a.n - b.n));
}

// ================================================================
//  MAIN SIMULATION (RK4)
// ================================================================
function runSimulation() {
    var dz = getDZ();
    var nPara = jumpersList.length;
    var espacementM = parseFloat(document.getElementById('espacement_m').value) || 300;
    var axe = parseFloat(document.getElementById('axe_largage').value) || 90;
    var crossNm = parseFloat(document.getElementById('cross_track_nm').value) || 0;
    var qnhVal = parseFloat(document.getElementById('qnh_val').value) || 1013.25;
    var topLargageNm = parseFloat(document.getElementById('top_largage_nm').value) || 0;

    var res = runCoreSimulation(
        dz, currentTarget, currentRV, axe, crossNm, topLargageNm,
        null, // dtSortie auto calculated inside
        nPara,
        null, // altM calculated inside
        qnhVal,
        jumpersList,
        0 // startOffS
    );

    window.simResults = res;

    var durDisp = document.getElementById('duree_largage_display');
    if (durDisp) {
        var delaiTopVert = parseFloat(document.getElementById('delai_top_vert').value) || 5;
        durDisp.innerHTML = '<b>' + res.dureeLargage.toFixed(1) + '</b> s  <span style="font-size:9px;opacity:0.7">(Δt=' + res.dtSortie.toFixed(1) + 's / ' + Math.round(espacementM) + 'm)</span>';
    }

    drawTransversalChart();
    drawMapResults();
    drawDistanceChart();
    updateGoNoGo();
    updateKPIRecap(res);
    if (window.onSimulationComplete) window.onSimulationComplete();
}

function updateKPIRecap(res) {
    var ctn = document.getElementById('config_recap');
    if (!ctn) return;

    // Safety checks
    if (!res || !res.positions) { ctn.innerHTML = ''; return; }

    var nPara = res.nPara || res.positions.length;
    var axe = res.axe != null ? Math.round(res.axe) : Math.round(parseFloat(document.getElementById('axe_largage').value));
    var topNm = res.topNm != null ? res.topNm : parseFloat(document.getElementById('top_largage_nm').value);
    var crossNm = res.crossNm != null ? res.crossNm : parseFloat(document.getElementById('cross_track_nm').value);

    var sepMin = Infinity;
    (res.allPairMinDists || []).forEach(md => { if (md.dist < sepMin) sepMin = md.dist; });
    var sepMinStr = sepMin < Infinity ? sepMin.toFixed(0) + 'm' : '--';

    var margeMin = Infinity;
    (res.positions || []).forEach(pos => { if (pos.margeRDV < margeMin) margeMin = pos.margeRDV; });
    var margeMinStr = margeMin < Infinity ? margeMin.toFixed(0) + 'm' : '--';

    var interval = res.dtSortie ? res.dtSortie.toFixed(1) + 's' : '--';

    // compute green/red distance in NM relative to target (along track)
    var greenNmStr = '--', redNmStr = '--';
    if (res.greenLightAlongTrack != null && res.targetAlongTrack != null) {
        var greenDistM = res.greenLightAlongTrack - res.targetAlongTrack;
        var greenNm = greenDistM / 1852;
        greenNmStr = (greenNm >= 0 ? '+' : '') + greenNm.toFixed(2) + ' NM';
    }
    if (res.redLightAlongTrack != null && res.targetAlongTrack != null) {
        var redDistM = res.redLightAlongTrack - res.targetAlongTrack;
        var redNm = redDistM / 1852;
        redNmStr = (redNm >= 0 ? '+' : '') + redNm.toFixed(2) + ' NM';
    }

    ctn.innerHTML = '<div style="background:#090e1c;border-bottom:1px solid #1a2744;padding:4px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
        '  <span style="font-size:8px;font-weight:800;color:#3a4d6e;text-transform:uppercase;letter-spacing:.08em;margin-right:4px;">📊 KPIs</span>' +
        '  <span style="display:flex;flex-direction:column;align-items:center;padding:0 8px;border-right:1px solid #141f3822;">' +
        '    <span style="font-size:7px;color:#4a5568;text-transform:uppercase;letter-spacing:.06em;">Paras</span>' +
        '    <span style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:800;color:#c084fc;">' + nPara + '</span>' +
        '  </span>' +
        '  <span style="display:flex;flex-direction:column;align-items:center;padding:0 8px;border-right:1px solid #141f3822;">' +
        '    <span style="font-size:7px;color:#4a5568;text-transform:uppercase;letter-spacing:.06em;">Axe</span>' +
        '    <span style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:800;color:#60a5fa;">' + axe.toString().padStart(3, '0') + '°</span>' +
        '  </span>' +
        '  <span style="display:flex;flex-direction:column;align-items:center;padding:0 8px;border-right:1px solid #141f3822;">' +
        '    <span style="font-size:7px;color:#4a5568;text-transform:uppercase;letter-spacing:.06em;">Offset</span>' +
        '    <span style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:800;color:#fbbf24;">' + (crossNm > 0 ? '+' : '') + parseFloat(crossNm).toFixed(1) + ' NM</span>' +
        '  </span>' +
        '  <span style="display:flex;flex-direction:column;align-items:center;padding:0 8px;border-right:1px solid #141f3822;">' +
        '    <span style="font-size:7px;color:#4a5568;text-transform:uppercase;letter-spacing:.06em;">Δt Sortie</span>' +
        '    <span style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:800;color:#fb923c;">' + interval + '</span>' +
        '  </span>' +
        '  <span style="display:flex;flex-direction:column;align-items:center;padding:0 8px;border-right:1px solid #141f3822;">' +
        '    <span style="font-size:7px;color:#4a5568;text-transform:uppercase;letter-spacing:.06em;">Sep Min</span>' +
        '    <span style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:800;color:' + (sepMin < 50 ? '#f87171' : '#34d399') + ';">' + sepMinStr + '</span>' +
        '  </span>' +
        '  <span style="display:flex;flex-direction:column;align-items:center;padding:0 8px;border-right:1px solid #141f3822;">' +
        '    <span style="font-size:7px;color:#4a5568;text-transform:uppercase;letter-spacing:.06em;">Marge zone</span>' +
        '    <span style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:800;color:' + (margeMin < 0 ? '#f87171' : '#38bdf8') + ';">' + margeMinStr + '</span>' +
        '  </span>' +
        '  <span style="display:flex;flex-direction:column;align-items:center;padding:0 8px;border-right:1px solid #141f3822;">' +
        '    <span style="font-size:7px;color:#34d399;text-transform:uppercase;letter-spacing:.06em;">🟢 Top</span>' +
        '    <span style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:800;color:#34d399;">' + greenNmStr + '</span>' +
        '  </span>' +
        '  <span style="display:flex;flex-direction:column;align-items:center;padding:0 8px;">' +
        '    <span style="font-size:7px;color:#f87171;text-transform:uppercase;letter-spacing:.06em;">🔴 Fin</span>' +
        '    <span style="font-family:JetBrains Mono,monospace;font-size:13px;font-weight:800;color:#f87171;">' + redNmStr + '</span>' +
        '  </span>' +
        '</div>';
}

function runCoreSimulation(dz, target, rv, axe, crossNm, topNm, dtSortie, nPara, altM, qnh, pList, startOffS) {
    var isaDelta = parseFloat(document.getElementById('isa_delta').value) || 0;
    var delaiTopVert = parseFloat(document.getElementById('delai_top_vert').value) || 5;
    var espacementM = parseFloat(document.getElementById('espacement_m').value) || 300;

    if (!altM) {
        var fl = parseFloat(document.getElementById('fl_jump').value) || 140;
        altM = fl * 100 * 0.3048 + (qnh - 1013.25) * 8.43;
    }

    var elevM = dz.elev;
    var kias = parseFloat(document.getElementById('kias').value) || 120;
    var tas = computeTAS(kias, altM, isaDelta);
    if (!tas || tas < 1) tas = 120;
    var tasMs = tas * 0.514444;

    var targetE_fromARP = (target.lon - dz.lon) * (111320 * Math.cos(dz.lat * Math.PI / 180));
    var targetN_fromARP = (target.lat - dz.lat) * 111320;

    var axeRad = axe * Math.PI / 180;
    var trackE = Math.sin(axeRad);
    var trackN = Math.cos(axeRad);

    var wJump = windVecAtZ(altM);
    var tailwindMs = wJump.e * trackE + wJump.n * trackN;
    var gsMs = tasMs + tailwindMs;
    if (gsMs < 1) gsMs = 1;

    if (!dtSortie) dtSortie = espacementM / gsMs;

    var gsE = trackE * gsMs;
    var gsN = trackN * gsMs;

    var crossM = crossNm * 1852;
    var perpE = trackN;
    var perpN = -trackE;
    var targetE = targetE_fromARP + crossM * perpE;
    var targetN = targetN_fromARP + crossM * perpN;

    var rvE = (rv.lon - dz.lon) * (111320 * Math.cos(dz.lat * Math.PI / 180));
    var rvN = (rv.lat - dz.lat) * 111320;

    var distTopM = topNm * 1852;
    var greenLightE = targetE + trackE * distTopM;
    var greenLightN = targetN + trackN * distTopM;

    var p1ExitE = greenLightE + trackE * (delaiTopVert * gsMs);
    var p1ExitN = greenLightN + trackN * (delaiTopVert * gsMs);
    var redLightE = p1ExitE + trackE * (nPara - 1) * dtSortie * gsMs;
    var redLightN = p1ExitN + trackN * (nPara - 1) * dtSortie * gsMs;

    var allPositions = [];
    var allTrajectories = [];
    var colors = typeof SIM_COLORS !== 'undefined' ? SIM_COLORS : ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

    var rvLength = parseFloat(document.getElementById('rv_length').value) || 400;
    var rvWidth = parseFloat(document.getElementById('rv_width').value) || 100;
    // If a user polygon is defined, convert it to E/N and override the rectangle
    var rvPolyEN = null;
    if (typeof PatternEditor !== 'undefined' && typeof PatternEditor.getZonePolygon === 'function') {
        var poly = PatternEditor.getZonePolygon();
        if (poly && poly.length >= 3) {
            var cosL = Math.cos(dz.lat * Math.PI / 180);
            rvPolyEN = poly.map(function (p) {
                return {
                    e: (p.lon - dz.lon) * 111320 * cosL,
                    n: (p.lat - dz.lat) * 111320
                };
            });
        }
    }
    // Synthesize a rectangle polygon when no user polygon is set, so the
    // adaptive landing fallback always has a real polygon to work with.
    var rvPolyForLanding = rvPolyEN;
    if (!rvPolyForLanding) {
        var hL = rvLength / 2, hW = rvWidth / 2;
        rvPolyForLanding = [
            { e: rvE - hL, n: rvN - hW },
            { e: rvE + hL, n: rvN - hW },
            { e: rvE + hL, n: rvN + hW },
            { e: rvE - hL, n: rvN + hW }
        ];
    }
    var rvZone = { e: rvE, n: rvN, L: rvLength, W: rvWidth, polygon: rvPolyEN };
    var tPilotCommon = parseFloat(document.getElementById('t_pilot_common').value) || 8;
    var tPilotOffsetAngle = parseFloat(document.getElementById('axe_pilot_offset').value) || 90;

    var rvAltAbs = elevM + (parseFloat(document.getElementById('gono_rv_alt').value) || 300);

    // The optimizer needs to simulate more jumpers than currently in pList to find maximum capacity.
    // If we exceed pList.length, duplicate the properties of the last jumper in the list.
    var loopCount = nPara;
    for (var j = 0; j < loopCount; j++) {
        var defaultP = pList.length > 0 ? pList[pList.length - 1] : { vc: 50, vzVoile: 5, glide: 2.5, hOuv: 1000 };
        var p = pList[j] || defaultP;

        var nbInGroup = parseInt(p.nbPara) || 1;
        var hBreak = (parseFloat(p.hBreak) || 1500) + elevM;
        var sepDist = parseFloat(p.sepDist) || 100;

        var delay = j * dtSortie;
        var groupExitE = p1ExitE + trackE * delay * gsMs;
        var groupExitN = p1ExitN + trackN * delay * gsMs;

        var vc = p.vc || 50;
        var vzVoile = p.vzVoile || 5.0;
        var glide = p.glide || 2.8;
        var hOuv = p.hOuv || 1000;
        var hOuvAbs = elevM + hOuv;

        // 1. Simulate Main FF Group Trajectory from Exit to Break (or Opening if no break)
        var state0 = [groupExitE, groupExitN, altM, gsE, gsN, 0];

        // FF Phase 1: Exit -> Max(hBreak, hOuv)
        var limitH = Math.max(hBreak, hOuvAbs);
        var trajFF1 = simulatePhase(state0, vc, limitH, 0.1, isaDelta);

        // Apply Tracking shift to Phase 1 if enabled
        if (p.isTracking) {
            var trackDistM = parseFloat(p.trackDist) || 1000;
            var trackAxis = p.trackAxis != null ? parseFloat(p.trackAxis) : 90;
            var trRad = (axe + trackAxis) * Math.PI / 180;
            var trE = Math.sin(trRad) * trackDistM;
            var trN = Math.cos(trRad) * trackDistM;

            // We need to know total Z for the whole jump to apply proportional shift?
            // Or shift speed? Let's assume linear shift over the fall (Exit -> Opening)
            var totalFallZ = altM - hOuvAbs;

            for (var k = 0; k < trajFF1.length; k++) {
                var prog = (altM - trajFF1[k][2]) / totalFallZ;
                if (prog < 0) prog = 0; // if > 1 we handle it next phase
                trajFF1[k][0] += trE * prog;
                trajFF1[k][1] += trN * prog;
            }
        }

        // Get state at Break
        var stateAtBreak = trajFF1[trajFF1.length - 1].slice();

        // 2. Spawn individual trajectories from Break
        for (var sub = 0; sub < nbInGroup; sub++) {
            var trajFF2 = [];
            var sepE = 0, sepN = 0;

            if (hBreak > hOuvAbs) {
                if (nbInGroup > 1 && sepDist > 0) {
                    var angDeg = (360 / nbInGroup) * sub;
                    var rad = angDeg * Math.PI / 180;
                    sepE = Math.sin(rad) * sepDist;
                    sepN = Math.cos(rad) * sepDist;
                }

                // Simulate vertical fall for FF2 branch
                trajFF2 = simulatePhase(stateAtBreak, vc, hOuvAbs, 0.1, isaDelta);

                var zStart = stateAtBreak[2];
                var distZ = zStart - hOuvAbs;
                var totalFallZ = altM - hOuvAbs;

                for (var k = 0; k < trajFF2.length; k++) {
                    var progSep = (zStart - trajFF2[k][2]) / distZ;
                    progSep = Math.max(0, Math.min(1, progSep));

                    var shiftE = sepE * progSep;
                    var shiftN = sepN * progSep;

                    if (p.isTracking) {
                        var trackDistM = parseFloat(p.trackDist) || 1000;
                        var trackAxis = p.trackAxis != null ? parseFloat(p.trackAxis) : 90;
                        var trRad = (axe + trackAxis) * Math.PI / 180;

                        // Delta tracking for FF2 (incremental shift from hBreak to hOuv)
                        var progAtBreak = (altM - zStart) / totalFallZ;
                        var progAtCurrent = (altM - trajFF2[k][2]) / totalFallZ;
                        var deltaProg = progAtCurrent - progAtBreak;

                        shiftE += Math.sin(trRad) * trackDistM * deltaProg;
                        shiftN += Math.cos(trRad) * trackDistM * deltaProg;
                    }

                    trajFF2[k][0] += shiftE;
                    trajFF2[k][1] += shiftN;
                }
            }

            var fullFF = trajFF1.map(pt => pt.slice()).concat(trajFF2); // Deep copy FF1 because we share it? No, slice is enough for array of arrays? No, we need to clone the arrays inside too if we modify them?
            // Actually trajFF1 was modified in place for Tracking in the loop above.
            // If we have multiple subgroups, and we modify FF1 inside the subgroup loop, that's bad.
            // Tracking modification for FF1 should be done ONCE outside. Yes, I did that.
            // So FF1 is shared and already shifted for tracking.
            // But separation only starts at FF2. So FF1 is common to all. Correct.

            var stateAtOpen = fullFF[fullFF.length - 1].slice();

            // Use the new realistic opening phase instead of linear transition
            var trajOpening = simulateOpeningPhase(stateAtOpen, {
                vc: vc,
                vzVoile: vzVoile,
                isaDelta: isaDelta,
                elevM: elevM
            });
            var stateOpen = trajOpening.length ? trajOpening[trajOpening.length - 1].slice() : stateAtOpen.slice();

            // --- CHANGE 1: Auto-detect which side of the jump axis the RDV zone is on ---
            // Cross product of track vector with (RDV - openPos) gives sign of side
            var rvDeltaE = rvE - stateOpen[0];
            var rvDeltaN = rvN - stateOpen[1];
            // cross = trackE * rvDeltaN - trackN * rvDeltaE  (positive = RDV is to the left)
            var crossSign = trackE * rvDeltaN - trackN * rvDeltaE;
            var jPerpE, jPerpN;
            if (crossSign >= 0) {
                // RDV is to the left of the jump axis (CCW)
                jPerpE = -trackN; jPerpN = trackE;
            } else {
                // RDV is to the right of the jump axis (CW)
                jPerpE = trackN; jPerpN = -trackE;
            }

            var windAtOpen = windVecAtZ(stateOpen[2]);
            var airOpenE = stateOpen[3] - windAtOpen.e;
            var airOpenN = stateOpen[4] - windAtOpen.n;

            var vh = vzVoile * glide;

            // Use the canonical landing pattern from PhysicsCore so the visual
            // trajectory matches what Monte-Carlo simulates (downwind → base
            // → final into wind, ≥10s final). PhysicsCore reads the wind via
            // its own `windAtZ` (we sync the profile right before).
            if (typeof PhysicsCore !== 'undefined') {
                PhysicsCore.setWindProfile(sortedWindProfile);
                PhysicsCore.enableWindCache(Math.ceil(altM) + 100);
            }
            // Resolve user-drawn landing pattern (if any) matching the
            // surface wind direction. Convert {lat,lon} waypoints to E/N
            // so PhysicsCore can use them directly.
            var userPatternEN = null;
            var evolutionZoneEN = null;
            if (typeof PatternEditor !== 'undefined' && typeof PatternEditor.patternForWind === 'function') {
                var lowestProf = sortedWindProfile.length ? sortedWindProfile[0] : null;
                var pat = lowestProf ? PatternEditor.patternForWind(lowestProf.dir || 0) : null;
                var cosLP = Math.cos(dz.lat * Math.PI / 180);
                var toEP = function (p) {
                    return {
                        e: (p.lon - dz.lon) * 111320 * cosLP,
                        n: (p.lat - dz.lat) * 111320
                    };
                };
                if (pat && pat.waypoints) {
                    userPatternEN = {
                        downwindStart: toEP(pat.waypoints.downwindStart),
                        baseStart:     toEP(pat.waypoints.baseStart),
                        finalStart:    toEP(pat.waypoints.finalStart),
                        target:        toEP(pat.waypoints.target)
                    };
                }
                if (pat && pat.evolutionZone) {
                    var ez = pat.evolutionZone;
                    if (ez.type === 'circle' && ez.center && ez.radiusM > 0) {
                        evolutionZoneEN = {
                            type: 'circle',
                            center: toEP(ez.center),
                            radiusM: ez.radiusM
                        };
                    } else if (ez.type === 'polygon' && ez.vertices && ez.vertices.length >= 3) {
                        evolutionZoneEN = {
                            type: 'polygon',
                            vertices: ez.vertices.map(toEP)
                        };
                    }
                }
            }

            var landFn = (typeof PhysicsCore !== 'undefined' && PhysicsCore.createLandingPattern)
                ? PhysicsCore.createLandingPattern(
                    { e: rvE, n: rvN }, vh,
                    {
                        elevM: elevM,
                        skill: p.skill || 1.0,
                        glide: glide,
                        canopyType: p.canopyType || 'docile',
                        modeEnabled: true,    // visual: show piloting modes (TRIM/BEST_GLIDE/MIN_SINK/FLARE)
                        altDownwind: 300, altBase: 150, altFinal: 60,
                        finalSeconds: 10, patternSide: 'left',
                        zonePolygonEN: rvPolyForLanding,
                        userPatternEN: userPatternEN,
                        evolutionZoneEN: evolutionZoneEN
                    })
                : null;

            // Last jumper in stick → skip the perpendicular hold (no one
            // behind to clear).
            var isLast = (j === nPara - 1);
            // Skip threshold along the jumprun track : projection of the
            // active circuit's downwindStart (or DZ if no user pattern).
            // If the pilot has already crossed this on the track axis,
            // they are committed to the circuit and the perpendicular
            // hold serves no purpose.
            var skipRefE = (userPatternEN && userPatternEN.downwindStart) ? userPatternEN.downwindStart.e : rvE;
            var skipRefN = (userPatternEN && userPatternEN.downwindStart) ? userPatternEN.downwindStart.n : rvN;
            var skipAlongTrack = skipRefE * trackE + skipRefN * trackN;
            var steerFn = (function (pe, pn, tp, vHVal, _landFn, _isLast, _trE, _trN, _refAT) {
                return function (st, t) {
                    if (t < tp && !_isLast) {
                        var alongTrack = st[0] * _trE + st[1] * _trN;
                        if (alongTrack < _refAT) {
                            // upstream of circuit entry → still need to hold perpendicular
                            return { e: pe * vHVal, n: pn * vHVal, vhMul: 1.0, vzMul: 1.0 };
                        }
                        // already past circuit entry → fall through to navigation
                    }
                    if (_landFn) {
                        var cmd = _landFn(st, t);
                        var hr = (cmd.targetHeading || 0) * Math.PI / 180;
                        var vhMul = (cmd.mode && cmd.mode.vhMul != null) ? cmd.mode.vhMul : 1.0;
                        var vzMul = (cmd.mode && cmd.mode.vzMul != null) ? cmd.mode.vzMul : 1.0;
                        return {
                            e: Math.sin(hr) * vHVal * vhMul,
                            n: Math.cos(hr) * vHVal * vhMul,
                            vhMul: vhMul, vzMul: vzMul
                        };
                    }
                    // Fallback: direct wind-corrected nav to RV
                    var w = windVecAtZ(Math.max(st[2], 0));
                    var dx = rvE - st[0], dy = rvN - st[1], dh = Math.sqrt(dx * dx + dy * dy);
                    if (dh < 5) return { e: 0, n: 0 };
                    var dxn = dx / dh, dyn = dy / dh;
                    var wp = w.e * (-dyn) + w.n * dxn;
                    var te, tn;
                    if (Math.abs(wp) >= vHVal) { te = -w.e; tn = -w.n; }
                    else {
                        var comp = Math.sqrt(vHVal * vHVal - wp * wp);
                        te = comp * dxn - wp * (-dyn); tn = comp * dyn - wp * dxn;
                    }
                    return { e: te, n: tn };
                };
            })(jPerpE, jPerpN, tPilotCommon, vh, landFn, isLast, trackE, trackN, skipAlongTrack);

            // Canopy phase runs all the way to touchdown (no early stop).
            // The first point inside the landing zone is tagged for chart use.
            var trajCanopy = simulateCanopyPhaseWithZoneStop(
                stateOpen, vzVoile, glide, elevM, steerFn, rvZone, rvAltAbs, isaDelta
            );
            var landState = trajCanopy[trajCanopy.length - 1];

            // Find the first trajectory point flagged as inside the landing zone
            var zoneEntry = null;
            for (var pi = 0; pi < trajCanopy.length; pi++) {
                if (trajCanopy[pi]._reachedZone) {
                    zoneEntry = { e: trajCanopy[pi][0], n: trajCanopy[pi][1], z: trajCanopy[pi][2] };
                    break;
                }
            }
            var reachedZone = zoneEntry !== null;

            // pos300: first point at or below rvAltAbs (used by chart for RV-alt marker)
            var posAtRVAlt = null;
            for (var pii = 0; pii < trajCanopy.length; pii++) {
                if (trajCanopy[pii][2] <= rvAltAbs) {
                    posAtRVAlt = { e: trajCanopy[pii][0], n: trajCanopy[pii][1] };
                    break;
                }
            }

            // margeRDV = SIGNED edge margin at TOUCHDOWN. Polygon if defined,
            // else rectangle. Positive ⇒ posé dans la zone, négatif ⇒ raté.
            var dxLand = landState[0] - rvE, dyLand = landState[1] - rvN;
            var landingDistance = Math.sqrt(dxLand * dxLand + dyLand * dyLand);
            var margeRDV;
            if (rvPolyEN && rvPolyEN.length >= 3) {
                // signed point-in-polygon distance
                var inside = false, best = Infinity;
                for (var pp = 0, qq = rvPolyEN.length - 1; pp < rvPolyEN.length; qq = pp++) {
                    var a = rvPolyEN[qq], b = rvPolyEN[pp];
                    if ((a.n > landState[1]) !== (b.n > landState[1]) &&
                        landState[0] < (b.e - a.e) * (landState[1] - a.n) / (b.n - a.n) + a.e) inside = !inside;
                    var dxe = b.e - a.e, dye = b.n - a.n, len2 = dxe * dxe + dye * dye;
                    var tt = len2 > 0 ? Math.max(0, Math.min(1, ((landState[0] - a.e) * dxe + (landState[1] - a.n) * dye) / len2)) : 0;
                    var px = a.e + tt * dxe, py = a.n + tt * dye;
                    var dxx = landState[0] - px, dyy = landState[1] - py;
                    var dd = Math.sqrt(dxx * dxx + dyy * dyy);
                    if (dd < best) best = dd;
                }
                margeRDV = inside ? best : -best;
            } else {
                var halfL = rvLength / 2, halfW = rvWidth / 2;
                var adx = Math.abs(dxLand), ady = Math.abs(dyLand);
                if (adx <= halfL && ady <= halfW) {
                    margeRDV = Math.min(halfL - adx, halfW - ady);
                } else {
                    var edgeDx = Math.max(0, adx - halfL);
                    var edgeDy = Math.max(0, ady - halfW);
                    margeRDV = -Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);
                }
            }

            allPositions.push({
                idx: j, groupIndex: j, subIndex: sub,
                exit: { e: groupExitE, n: groupExitN },
                open: { e: stateAtOpen[0], n: stateAtOpen[1] },
                pos300: posAtRVAlt,
                land: { e: landState[0], n: landState[1] },
                landingDistance: landingDistance,
                margeRDV: margeRDV,
                reachedZone: reachedZone
            });
            allTrajectories.push({ ff: fullFF, opening: trajOpening, canopy: trajCanopy, color: colors[j % 10], groupIndex: j, exitTime: delay });
        }
    }

    var timedTrajs = [];
    allTrajectories.forEach((tt, tj) => {
        var et = tt.exitTime;
        var timed = [];

        // Freefall: 0.1s steps
        tt.ff.forEach((s, fi) => {
            timed.push({ t: et + fi * 0.1, x: s[0], y: s[1], z: s[2], phase: 'ff' });
        });

        // Opening: 0.2s steps
        var ffe = et + (tt.ff.length - 1) * 0.1;
        tt.opening.forEach((s, oi) => {
            timed.push({ t: ffe + (oi + 1) * 0.2, x: s[0], y: s[1], z: s[2], phase: 'opening' });
        });

        // Canopy: 1.0s steps
        var ope = ffe + tt.opening.length * 0.2;
        tt.canopy.forEach((s, ci) => {
            timed.push({ t: ope + (ci + 1) * 1.0, x: s[0], y: s[1], z: s[2], phase: 'canopy' });
        });

        timed.exitTime = et;
        timedTrajs.push(timed);
    });

    var maxT = 0;
    timedTrajs.forEach(tt => {
        if (tt.length) {
            var lastT = tt[tt.length - 1].t;
            if (lastT > maxT) maxT = lastT;
        }
    });

    window.maxSimTime = maxT;

    // --- CHANGE 3: Only compute minimum distance between consecutive skydivers (i vs i+1) ---
    var allPairMinDists = [];
    for (var cp = 0; cp < nPara - 1; cp++) {
        var cq = cp + 1; // only consecutive
        var tA = timedTrajs[cp], tB = timedTrajs[cq];
        if (!tA || !tB || !tA.length || !tB.length) continue;
        var tsStart = Math.max(tA[0].t, tB[0].t);
        var tsEnd = Math.min(tA[tA.length - 1].t, tB[tB.length - 1].t);
        var bestD = Infinity, bestPA = null, bestPB = null;
        var validMinStart = tB.exitTime + 10; // wait 10s after second jumper exits

        for (var ts = tsStart; ts <= tsEnd; ts += 0.5) {
            var pA = posAtTime(tA, ts), pB = posAtTime(tB, ts);
            if (!pA || !pB || ts < validMinStart) continue;
            if (pA.phase !== 'ff' && pB.phase !== 'ff') continue;

            var dd = Math.sqrt(Math.pow(pA.x - pB.x, 2) + Math.pow(pA.y - pB.y, 2));
            if (dd < bestD) { bestD = dd; bestPA = pA; bestPB = pB; }
        }
        if (bestD < Infinity) {
            allPairMinDists.push({
                dist: bestD, posA: bestPA, posB: bestPB,
                idxA: cp, idxB: cq,
                isConsecutive: true
            });
        }
    }

    // --- RE-INSERT INTERACTION AXIS AT THE TOP ---
    // (Cette fonction devrait idéalement être dans map.js, mais si elle est ici elle doit utiliser allPairMinDists)
    var sepInput = document.getElementById('gono_sep_dist');
    var SEP_THRESH = sepInput ? (parseFloat(sepInput.value) || 78) : 78;
    var TIME_MIN = parseFloat(document.getElementById('gono_min_dt').value) || 5;

    var go = allPositions.every(function (pos) { return pos.margeRDV >= 0; });

    // Vérification de toutes les paires (sauf intra-groupe) pour le critère GO
    allPairMinDists.forEach(function (md) {
        if (md.intraGroup) return;
        if (md.dist < SEP_THRESH) go = false;
    });

    if (dtSortie < TIME_MIN) go = false;

    // Ajout d'une vérification de marge de sécurité supplémentaire
    var MARGE_MIN_GO = 0; // m
    allPositions.forEach(function (pos) {
        if (pos.margeRDV < MARGE_MIN_GO) go = false;
    });

    var headAirE = trackE * tasMs - wJump.e;
    var headAirN = trackN * tasMs - wJump.n;
    var capAvion = ((Math.atan2(headAirE, headAirN) * 180 / Math.PI) + 360) % 360;

    return {
        positions: allPositions, trajectories: allTrajectories, dz: dz, axe: axe, gsMs: gsMs, fl: altM / 100 / 0.3048, capAvion: capAvion,
        trackE: trackE, trackN: trackN, altM: altM, elevM: elevM, targetE: targetE, targetN: targetN,
        greenLightE: greenLightE, greenLightN: greenLightN,
        redLightE: redLightE, redLightN: redLightN,
        delaiTopVert: delaiTopVert,
        dureeLargage: delaiTopVert + (nPara - 1) * dtSortie, dtSortie: dtSortie, espacementM: espacementM,
        greenLightAlongTrack: targetE * trackE + targetN * trackN + distTopM,
        redLightAlongTrack: (p1ExitE + trackE * (nPara - 1) * dtSortie * gsMs) * trackE + (p1ExitN + trackN * (nPara - 1) * dtSortie * gsMs) * trackN,
        targetAlongTrack: targetE * trackE + targetN * trackN,
        allPairMinDists: allPairMinDists,
        timedTrajs: timedTrajs,
        crossNm: crossNm, topNm: topNm, nPara: nPara,
        go: go
    };
}

function posAtTime(timed, time) {
    if (time <= timed[0].t) return null;
    if (time >= timed[timed.length - 1].t) return timed[timed.length - 1];

    // Binary search O(log n)
    var lo = 0, hi = timed.length - 1;
    while (hi - lo > 1) {
        var mid = (lo + hi) >> 1;
        if (timed[mid].t <= time) lo = mid;
        else hi = mid;
    }

    var p1 = timed[lo], p2 = timed[hi];
    var f = (time - p1.t) / (p2.t - p1.t);
    return {
        x: p1.x + f * (p2.x - p1.x),
        y: p1.y + f * (p2.y - p1.y),
        z: p1.z + f * (p2.z - p1.z),
        phase: p1.phase
    };
}

function simulateHeadless(p) {
    p = p || {};
    var dz = getDZ();
    var qnhVal = parseFloat(document.getElementById('qnh_val').value) || 1013.25;

    // Core parameters for optimization
    var axe = p.axe != null ? p.axe : (parseFloat(document.getElementById('axe_largage').value) || 90);
    var crossNm = p.crossNm != null ? p.crossNm : (parseFloat(document.getElementById('cross_track_nm').value) || 0);
    var topNm = p.topNm != null ? p.topNm : (parseFloat(document.getElementById('top_largage_nm').value) || 0);
    var nPara = p.nPara || (p.overrideJumpers ? p.overrideJumpers.length : jumpersList.length);
    var overrideJumpers = p.overrideJumpers || jumpersList;
    var startOffS = p.startTimeSec || 0;

    var res = runCoreSimulation(
        dz, currentTarget, currentRV, axe, crossNm, topNm,
        null, // dtSortie
        nPara,
        null, // altM
        qnhVal,
        overrideJumpers,
        startOffS
    );

    var sepInput = document.getElementById('gono_sep_dist');
    var SEP_THRESH = sepInput ? (parseFloat(sepInput.value) || 78) : 78;
    var TIME_MIN = parseFloat(document.getElementById('gono_min_dt').value) || 5;

    var go = res.positions.every(pos => pos.margeRDV >= 0);
    res.allPairMinDists.forEach(md => {
        if (md.intraGroup) return;
        if (md.dist < SEP_THRESH) go = false;
    });
    if (res.dtSortie < TIME_MIN) go = false;

    // NFZ check (hard zones only) — main-thread fallback for legacy optimizer
    if (go && typeof NFZ !== 'undefined' && NFZ.getZones && NFZ.getZones().length) {
        var zones = NFZ.getZones().filter(function (z) { return z.type === 'hard'; });
        if (zones.length && res.timedTrajs) {
            for (var ti = 0; ti < res.timedTrajs.length && go; ti++) {
                var chk = NFZ.checkTrajectory(res.timedTrajs[ti], zones);
                if (chk.violated) go = false;
            }
        }
    }

    // Attach scan parameters to the result object so the optimizer can categorize them
    res.axe = axe;
    res.crossNm = crossNm;
    res.topNm = topNm;
    res.nPara = nPara;

    res.go = go;
    return res;
}


// ================================================================
//  STICK ORDER OPTIMIZER
// ================================================================
async function optimizeStickOrder() {
    if (!jumpersList.length) return;
    const btn = document.getElementById('btn_opt_stick');
    const progCtn = document.getElementById('opt_stick_progress');
    const bar = document.getElementById('opt_stick_bar');
    const status = document.getElementById('opt_stick_status');

    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = '⚡ CALCUL EN COURS...';
    progCtn.classList.remove('hidden');

    var currentStick = [...jumpersList];

    function getPermutations(arr) {
        if (arr.length <= 1) return [arr];
        var perms = [];
        for (var i = 0; i < arr.length; i++) {
            var rest = getPermutations(arr.slice(0, i).concat(arr.slice(i + 1)));
            for (var j = 0; j < rest.length; j++) {
                perms.push([arr[i]].concat(rest[j]));
            }
        }
        return perms;
    }

    var allPerms = [];
    if (currentStick.length <= 7) {
        allPerms = getPermutations(currentStick);
    } else {
        // Monte Carlo for large N
        const seen = new Set();
        allPerms.push([...currentStick]);
        seen.add(JSON.stringify(currentStick));
        for (var k = 0; k < 2000; k++) {
            let s = [...currentStick].sort(() => Math.random() - 0.5);
            let js = JSON.stringify(s);
            if (!seen.has(js)) {
                allPerms.push(s);
                seen.add(js);
            }
        }
    }

    var total = allPerms.length;
    var validConfigs = [];

    for (var i = 0; i < total; i++) {
        var pStick = allPerms[i];
        var res = simulateHeadless({ overrideJumpers: pStick });

        if (res.go) {
            var marges = res.positions.map(pos => pos.margeRDV);
            var seps = res.allPairMinDists.map(m => m.dist);
            validConfigs.push({
                sep_min: seps.length ? Math.min(...seps) : 9999,
                sep_avg: seps.length ? seps.reduce((s, x) => s + x, 0) / seps.length : 9999,
                marge_min: marges.length ? Math.min(...marges) : -1,
                marge_avg: marges.length ? marges.reduce((s, x) => s + x, 0) / marges.length : -1,
                stick: pStick
            });
        }

        if (i % 50 === 0) {
            bar.style.width = (i / total * 100) + '%';
            status.textContent = 'Analyse ' + i + '/' + total + ' (' + validConfigs.length + ' GO)';
            await new Promise(r => setTimeout(r, 0));
        }
    }

    if (validConfigs.length === 0) {
        alert("Aucun ordre n'est 'GO' avec les paramètres actuels.");
    } else {
        // Multi-criteria sort
        validConfigs.sort((a, b) => {
            if (Math.abs(b.sep_avg - a.sep_avg) > 5) return b.sep_avg - a.sep_avg;
            if (Math.abs(b.sep_min - a.sep_min) > 5) return b.sep_min - a.sep_min;
            return b.marge_min - a.marge_min;
        });

        jumpersList = validConfigs[0].stick;
        buildJumpers();
        runSimulation();
        alert("Ordre optimisé appliqué ! (" + validConfigs.length + " combinaisons valides)");
    }

    btn.disabled = false;
    btn.textContent = oldText;
    progCtn.classList.add('hidden');
}

// ================================================================
//  GO / NO-GO
// ================================================================
function updateGoNoGo() {
    var banner = document.getElementById('gono_banner');
    var verdict = document.getElementById('gono_verdict');
    var condEl = document.getElementById('gono_conditions');
    if (!banner || !verdict || !condEl || !simResults) return;

    var dz = simResults.dz;
    var cosLat = Math.cos(dz.lat * Math.PI / 180);
    var rvE = (currentRV.lon - dz.lon) * 111320 * cosLat;
    var rvN = (currentRV.lat - dz.lat) * 111320;
    var SEP_THRESH = parseFloat(document.getElementById('gono_sep_dist').value) || 200;
    var rvAlt = parseFloat(document.getElementById('gono_rv_alt').value) || 300;
    var conditions = [];
    var allGo = true;

    simResults.positions.forEach(function (pos, i) {
        var marge = pos.margeRDV;
        var ok = marge >= 0 && marge !== -9999;
        var margeTxt = (marge === -9999) ? 'Non atteint' : (marge >= 0 ? '+' : '') + Math.round(marge) + 'm';
        if (!ok) allGo = false;
        conditions.push({ label: 'P' + (i + 1) + ' posé dans zone', value: margeTxt, ok: ok, unit: '≥ 0m (dans rectangle)' });
    });

    var cmdArr = simResults.allPairMinDists || [];
    if (cmdArr.length) {
        cmdArr.forEach(function (md) {
            var ok = md.dist >= SEP_THRESH;
            if (!ok) allGo = false;
            conditions.push({ label: 'P' + (md.idxA + 1) + '↔P' + (md.idxB + 1) + ' min', value: Math.round(md.dist) + 'm', ok: ok, unit: '≥' + SEP_THRESH + 'm' });
        });
    } else if (simResults.positions.length > 1) {
        allGo = false;
        conditions.push({ label: 'Séparation', value: 'N/A', ok: false, unit: '≥' + SEP_THRESH + 'm' });
    }

    // Time between exits check
    var TIME_MIN = parseFloat(document.getElementById('gono_min_dt').value) || 5;
    var dtOK = simResults.dtSortie >= TIME_MIN;
    if (!dtOK) allGo = false;
    conditions.push({ label: 'Temps inter-sortie', value: simResults.dtSortie.toFixed(1) + 's', ok: dtOK, unit: '≥' + TIME_MIN + 's' });

    var summary = document.getElementById('gono_summary');
    if (allGo) {
        banner.style.background = '#065f4633'; banner.style.borderColor = '#059669';
        verdict.style.color = '#10b981'; verdict.textContent = '🟢 GO';
        if (summary) {
            summary.style.display = 'inline-block';
            summary.style.background = '#10b981';
            summary.style.color = '#000';
            summary.textContent = 'GO';
        }
    } else {
        banner.style.background = '#7f1d1d33'; banner.style.borderColor = '#b91c1c';
        verdict.style.color = '#ef4444'; verdict.textContent = '🔴 NO-GO';
        if (summary) {
            summary.style.display = 'inline-block';
            summary.style.background = '#ef4444';
            summary.style.color = '#fff';
            summary.textContent = 'NO-GO';
        }
    }

    condEl.innerHTML = conditions.map(function (c) {
        return '<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:6px;' +
            'background:' + (c.ok ? '#064e3b44' : '#7f1d1d44') + ';border:1px solid ' + (c.ok ? '#065f46' : '#991b1b') + '">' +
            '<span style="font-size:12px">' + (c.ok ? '✅' : '❌') + '</span>' +
            '<span style="font-size:10px;font-weight:600;color:#94a3b8;flex:1">' + c.label + '</span>' +
            '<span style="font-size:10px;font-weight:800;color:' + (c.ok ? '#10b981' : '#f87171') + '">' + c.value + '</span>' +
            '<span style="font-size:8px;color:#64748b;margin-left:2px">(' + c.unit + ')</span></div>';
    }).join('');
}
