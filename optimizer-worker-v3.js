'use strict';
// ================================================================
//  OPTIMIZER-WORKER-V3.JS — proposes jumprun configs bounded by
//  anchor profiles (top vert = small-canopy solo, top fin = tandem).
//
//  Receives: { axesChunk, offsets, cfg, windProfile,
//              jumpersList, nfzSerialized, anchors,
//              physicsCoreSource? }
//  Sends:    { type:'progress', done, total }
//            { type:'result',   proposals:[...] }
// ================================================================

var PhysicsCore;
if (typeof importScripts === 'function') {
    try { importScripts('physics-core.js'); }
    catch (e) { /* file:// fallback — main thread injects source */ }
}

// ── Stick type V3 (ne dépend que de la base de PARA_TYPOLOGIES passée
//   via cfg). Composition cible 8 sorties (cf. analyse PAPA F-GULA /
//   F-GPBK / OY-PBK), avec fillers pour les fenêtres plus longues et
//   troncature par le DÉBUT pour les fenêtres plus courtes.
function _buildStickV3(typologies, nTarget) {
    if (!typologies || nTarget < 1) return [];
    var T = typologies;
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    function mk(srcKey, overrides) {
        if (!T[srcKey]) return null;
        var x = clone(T[srcKey]);
        if (overrides) Object.keys(overrides).forEach(function (k) { x[k] = overrides[k]; });
        return x;
    }

    // Stick type complet (8 entrées). Ordre méthodologique V3 (top vert
    // → top fin) : gros groupes RW → freefly → tracking → élève → PAC
    // → tandem.
    var grosVR    = mk('vr_mv',    { nbPara: 4, sepDist: 100, name: 'Gros groupe VR' });
    var soloVR    = mk('vr_mv',    { nbPara: 1, sepDist: 0, name: 'Solo VR' });
    var grosFF    = mk('ff_mv',    { nbPara: 4, sepDist: 100, name: 'Gros groupe Freefly' });
    var grpTrack  = mk('track_mv', { nbPara: 3, sepDist: 100, name: 'Groupe tracking' });
    var eleveSolo = mk('eleve_15', null);
    var soloTrack = mk('track_mv', { nbPara: 1, sepDist: 0, name: 'Solo tracking' });
    var pac       = mk('pac', null);
    var tandem    = mk('tandem', null);

    // Fillers (insérés ENTRE position 5 = élève solo et position 6 = solo tracking)
    var fillers = [
        mk('vr_mv', { nbPara: 1, sepDist: 0, name: 'Solo libre' }),
        mk('ff_mv', { nbPara: 2, sepDist: 100, name: 'Duo Freefly' }),
        mk('vr_mv', { nbPara: 2, sepDist: 100, name: 'Duo VR' }),
        mk('vr_mv', { nbPara: 1, sepDist: 0, name: 'Solo libre #2' }),
        mk('ff_mv', { nbPara: 2, sepDist: 100, name: 'Init Freefly' }),
        mk('vr_mv', { nbPara: 1, sepDist: 0, name: 'Solo libre #3' })
    ].filter(function (f) { return f; });

    // Stick "8 entrées" canonique
    var head = [grosVR, soloVR, grosFF, grpTrack, eleveSolo].filter(function (e) { return e; });
    var tail = [soloTrack, pac, tandem].filter(function (e) { return e; });

    if (nTarget >= head.length + tail.length) {
        // Insère K fillers entre head et tail
        var nFillers = Math.min(nTarget - head.length - tail.length, fillers.length);
        var stick = head.concat(fillers.slice(0, nFillers)).concat(tail);
        // Si on dépasse encore (nTarget > 8 + fillers.length), on duplique
        // le dernier filler (Solo libre)
        while (stick.length < nTarget && fillers.length) {
            var copy = JSON.parse(JSON.stringify(fillers[fillers.length - 1]));
            copy.name = (copy.name || 'Solo') + '+';
            stick.splice(head.length + nFillers, 0, copy);
        }
        return stick;
    }
    // nTarget < 8 : tronque par le DÉBUT (garde toujours PAC + Tandem en queue,
    // et solo tracking si N permet)
    var combined = head.concat(tail);     // 8 entrées
    return combined.slice(combined.length - nTarget);
}

// Gap (s) avant l'exit du jumper `jp` selon son type.
//   - tandem ou PAC → 15 s base
//   - groupe ≥ 4 paras → dtBase + 2 s
//   - sinon → dtBase
function _gapForJumperLocal(jp, dtBase) {
    if (!jp) return dtBase;
    var nm = (jp.name || '').toLowerCase();
    var isTandem = jp.id === 'tandem' || jp.isTandem || nm.indexOf('tandem') >= 0;
    var isPac = jp.id === 'pac' || jp.id === 'pac_first' || nm.indexOf('pac') === 0;
    if (isTandem || isPac) return 15;
    var nb = parseInt(jp.nbPara) || 1;
    if (nb >= 4) return dtBase + 2;
    return dtBase;
}

// Temps cumulé d'exit du dernier groupe du stick (s, depuis le 1ᵉʳ exit).
function _cumExitTime(stick, dtBase) {
    if (!stick || stick.length < 2) return 0;
    var t = 0;
    for (var k = 1; k < stick.length; k++) t += _gapForJumperLocal(stick[k], dtBase);
    return t;
}

// ── Probe helpers ─────────────────────────────────────────────
//   _probe : runs simPass with nPara=1 and a single anchor jumper at
//            (axe, crossNm, sNm) on the axis. Returns the position
//            object so the caller can read margeRDV.
function _probe(PC, baseCfg, axe, crossNm, sNm, jumper) {
    var passCfg = Object.assign({}, baseCfg, {
        axe: axe,
        crossNm: crossNm,
        topNm: sNm,
        delaiTopVert: 0,
        nPara: 1,
        jumpers: [jumper],
        dtCfg: { ff: 0.5, open: 0.2, canopy: 1.0 }
    });
    var r = PC.simPass(passCfg);
    var pos = r.positions[0];
    return {
        margeRDV: pos ? pos.margeRDV : -9999,
        nfzOk: r.nfzOk,
        ok: r.nfzOk && pos && pos.margeRDV >= 0
    };
}

// Coarse scan + bisection to find the lowest sNm where the anchor
// lands inside the safe zone. Returns null if no GO point found.
function _findBoundary(PC, baseCfg, axe, crossNm, jumper, opts) {
    var sLo = opts.sLo, sHi = opts.sHi, step = opts.step, mode = opts.mode;
    // Coarse scan to find first GO (mode='lo') or last GO (mode='hi')
    var firstGoS = null, lastGoS = null;
    for (var s = sLo; s <= sHi + 1e-6; s += step) {
        var r = _probe(PC, baseCfg, axe, crossNm, s, jumper);
        if (r.ok) {
            if (firstGoS === null) firstGoS = s;
            lastGoS = s;
        }
    }
    if (firstGoS === null) return null;

    // Bisect the boundary we care about
    var anchor = mode === 'lo' ? firstGoS : lastGoS;
    var outside = mode === 'lo' ? Math.max(sLo, anchor - step) : Math.min(sHi, anchor + step);
    var lo = Math.min(anchor, outside), hi = Math.max(anchor, outside);
    for (var it = 0; it < 6; it++) {
        var mid = (lo + hi) / 2;
        var rm = _probe(PC, baseCfg, axe, crossNm, mid, jumper);
        if (mode === 'lo') {
            // We want the smallest s with ok. Search left of firstGo until ko.
            if (rm.ok) hi = mid; else lo = mid;
        } else {
            // mode === 'hi' : want the largest s with ok. Search right of lastGo.
            if (rm.ok) lo = mid; else hi = mid;
        }
    }
    return mode === 'lo' ? hi : lo;
}

// ── Per (axe, offset) jumprun window ──────────────────────────
function _windowFor(PC, cfg, axe, crossNm, anchors, scanCfg) {
    // anchorVert    = small-canopy solo (lower bound)
    // anchorFinTan  = tandem (upper bound, alternative #1)
    // anchorFinPac  = PAC binôme (upper bound, alternative #2)
    var sLo = scanCfg.sLo, sHi = scanCfg.sHi, step = scanCfg.step;

    var topVertS = _findBoundary(PC, cfg, axe, crossNm, anchors.vert,
        { sLo: sLo, sHi: sHi, step: step, mode: 'lo' });
    if (topVertS === null) return null;

    var topFinTanS = _findBoundary(PC, cfg, axe, crossNm, anchors.fin,
        { sLo: sLo, sHi: sHi, step: step, mode: 'hi' });
    var topFinPacS = anchors.finPac
        ? _findBoundary(PC, cfg, axe, crossNm, anchors.finPac,
            { sLo: sLo, sHi: sHi, step: step, mode: 'hi' })
        : null;

    if (topFinTanS === null && topFinPacS === null) return null;

    // Use the most permissive (largest) fin as the geometric "max" for
    // the jumprun. Both individual values are returned so the UI can
    // display 2 distinct red points.
    var topFinS = Math.max(
        topFinTanS != null ? topFinTanS : -Infinity,
        topFinPacS != null ? topFinPacS : -Infinity
    );
    if (topFinS - topVertS < 0.05) return null; // < ~90 m, useless

    return {
        topVertS: topVertS,
        topFinS: topFinS,
        topFinTandemS: topFinTanS,
        topFinPacS: topFinPacS
    };
}

// ── Build a full V3 proposal for one (axe, crossNm) ───────────
function _buildProposal(PC, cfg, axe, crossNm, win, jumpers, windFromDeg, typologies) {
    // Compute GS along jumprun (constant on the axis)
    var axeRad = axe * PC.DEG2RAD;
    var trackE = Math.sin(axeRad), trackN = Math.cos(axeRad);
    var w = PC.windAtZ(cfg.altM);
    var tw = w.e * trackE + w.n * trackN;
    var gsMs = Math.max(1, cfg.tasMs + tw);

    var lengthM = (win.topFinS - win.topVertS) * PC.NM2M;
    // Δt cible déterminé par GS et l'espacement-cible (300 m par défaut).
    var espacementM = cfg.espacementM != null ? cfg.espacementM : 300;
    var dtSortie = espacementM / gsMs;
    // N_max GÉOMÉTRIQUE = nombre maximum de slots de 300 m dans la
    // fenêtre. Pratique pour le « plafond raisonnable » qu'on cherche
    // à atteindre.
    var nMaxByWindow = 1 + Math.floor(lengthM / Math.max(espacementM, 1e-3));
    var lengthTandemM = win.topFinTandemS != null
        ? (win.topFinTandemS - win.topVertS) * PC.NM2M : null;
    var lengthPacM = win.topFinPacS != null
        ? (win.topFinPacS - win.topVertS) * PC.NM2M : null;
    var nMaxIfTandem = lengthTandemM != null && lengthTandemM > 0
        ? 1 + Math.floor(lengthTandemM / Math.max(espacementM, 1e-3)) : null;
    var nMaxIfPac = lengthPacM != null && lengthPacM > 0
        ? 1 + Math.floor(lengthPacM / Math.max(espacementM, 1e-3)) : null;

    // Construit le stick type V3 + fillers à la taille « raisonnable »
    // = N_geom (= L/300). Les gaps réels (tandem 15s, gros groupes Δt+2s)
    // étirent le jumprun effectif au-delà de L : c'est OK, la
    // simulation calcule la position exacte de chaque exit, et MC
    // révèlera dans les stats quels paras n'atterrissent pas dans la
    // zone (margeRDV<0). On NE TRONQUE PAS à priori.
    var ordered = _buildStickV3(typologies, nMaxByWindow);
    if (!ordered || !ordered.length) return null;
    var nPara = ordered.length;
    // Temps cumulé estimé du dernier exit (sert à indiquer combien de
    // mètres la jumprun réelle dépasse la fenêtre top vert / top fin)
    var cumExitT = _cumExitTime(ordered, dtSortie);
    var realJumprunM = cumExitT * gsMs;

    // (`ordered` a déjà été calculé plus haut via _buildStickV3 +
    //  contrainte temps cumulé)

    var passCfg = Object.assign({}, cfg, {
        axe: axe,
        crossNm: crossNm,
        topNm: win.topVertS,
        delaiTopVert: 0,
        espacementM: espacementM,
        nPara: nPara,
        jumpers: ordered,
        dtCfg: { ff: 0.25, open: 0.1, canopy: 0.5 }
    });
    var sim = PC.simPass(passCfg);

    var mg = sim.positions.map(function (p) { return p.margeRDV; });
    var minMarge = mg.length ? Math.min.apply(null, mg) : -9999;
    var nLandedOk = mg.filter(function (m) { return m >= 0; }).length;
    var allLandOk = mg.length === nLandedOk;

    var seps = sim.allPairMinDists.filter(function (m) { return !m.intraGroup; })
        .map(function (m) { return m.dist; });
    var minSep = seps.length ? Math.min.apply(null, seps) : 9999;

    return {
        axe: axe,
        crossNm: crossNm,
        topNm: win.topVertS,
        topFinNm: win.topFinS,
        topFinTandemNm: win.topFinTandemS,
        topFinPacNm: win.topFinPacS,
        delaiTopVert: 0,
        espacementM: espacementM,
        dtSortie: dtSortie,
        gsMs: gsMs,
        jumprunLengthM: lengthM,
        jumprunTandemM: lengthTandemM,
        jumprunPacM: lengthPacM,
        nMaxByWindow: nMaxByWindow,         // plafond géométrique (L/300)
        realJumprunM: realJumprunM,         // longueur RÉELLE du jumprun avec les gaps
        cumExitT: cumExitT,                 // temps cumul du dernier exit (s)
        nMaxIfTandem: nMaxIfTandem,
        nMaxIfPac: nMaxIfPac,
        nPara: nPara,
        nLandedOk: nLandedOk,
        allLandOk: allLandOk,
        // Stick complet (objets jumper) — réutilisé tel quel par MC et
        // par le bouton « Apply » côté UI.
        stick: ordered,
        order: ordered.map(function (j) {
            return {
                name: j.name || '',
                nbPara: parseInt(j.nbPara) || 1,
                category: PC.classifyJumper(j)
            };
        }),
        delays: sim.delays || [],
        go: sim.go,
        nfzOk: sim.nfzOk,
        reachOk: sim.reachOk,
        safetyOk: sim.safetyOk,
        minMarge: minMarge,
        minSep: minSep,
        windFromDeg: windFromDeg,
        score: _scoreProposal(nLandedOk, lengthM, minSep, dtSortie, allLandOk, minMarge)
    };
}

// Lex score : (nLandedOk, jumprunLength, dtSortie). Lower-tier
// criteria (margin to NFZ, separation) act as soft tiebreakers.
function _scoreProposal(nLandedOk, lengthM, minSep, dtSortie, allLandOk, minMarge) {
    var s = 0;
    s += nLandedOk * 1e6;
    s += Math.min(lengthM / 3000, 1) * 1e4;
    if (allLandOk) s += 5000;
    s += Math.min(minMarge / 200, 1) * 1500;
    s += Math.min(minSep / 200, 1) * 800;
    s += Math.min(dtSortie / 12, 1) * 300;
    return s;
}

// ── Main scan loop ────────────────────────────────────────────
function scanV3(data) {
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

    var cfg = Object.assign({}, data.cfg, {
        nfzList: data.nfzSerialized || [],
        zonePolygon: data.cfg.zonePolygon || null,
        userPattern: data.cfg.userPattern || null,
        evolutionZone: data.cfg.evolutionZone || null
    });

    var axes = data.axesChunk;
    var offsets = data.offsets;
    var jumpers = data.jumpersList || [];
    var typologies = data.paraTypologies || null;
    var wJ = PC.windAtZ(cfg.altM);
    var windFromDeg = (Math.atan2(-wJ.e, -wJ.n) * PC.RAD2DEG + 360) % 360;

    var scanCfg = {
        sLo: data.scanSLo != null ? data.scanSLo : -2.5,
        sHi: data.scanSHi != null ? data.scanSHi : 2.5,
        step: data.scanStep != null ? data.scanStep : 0.25
    };

    var total = axes.length * offsets.length;
    var done = 0;
    var proposals = [];

    for (var ai = 0; ai < axes.length; ai++) {
        for (var oi = 0; oi < offsets.length; oi++) {
            var axe = axes[ai];
            var crossNm = offsets[oi];

            try {
                var win = _windowFor(PC, cfg, axe, crossNm, data.anchors, scanCfg);
                if (win) {
                    var prop = _buildProposal(PC, cfg, axe, crossNm, win, jumpers, windFromDeg, typologies);
                    if (prop) proposals.push(prop);
                }
            } catch (err) {
                // swallow per-cell errors so a single bad config doesn't
                // bring the whole worker down
            }

            done++;
            if (done % 5 === 0) postMessage({ type: 'progress', done: done, total: total });
        }
    }

    postMessage({ type: 'progress', done: total, total: total });
    return proposals;
}

// Worker entry — only wired when running in a Web Worker context.
// In Node (unit tests), `onmessage` / `postMessage` are undefined.
if (typeof self !== 'undefined' && typeof postMessage === 'function') {
    self.onmessage = function (e) {
        var proposals = scanV3(e.data);
        postMessage({ type: 'result', proposals: proposals });
    };
}

// Node test exports (no-op in worker context : `module` is undefined inside a Web Worker)
if (typeof module !== 'undefined') {
    module.exports = {
        buildStickV3: _buildStickV3,
        gapForJumperLocal: _gapForJumperLocal,
        cumExitTime: _cumExitTime
    };
}
