// ================================================================
//  APP — State, UI Logic, Event Handlers, Init
//  DZ Database, Global State, Accordion, Compass, Meteo, Jumpers
// ================================================================

// ================================================================
//  DZ DATABASE
// ================================================================
const DZ_DB = {
    LFAC: { name: 'Calais-Dunkerque', lat: 50.9622, lon: 1.9547, elev: 3, region: 'Hauts-de-France' },
    LFAG: { name: 'Péronne-St-Quentin', lat: 49.8686, lon: 3.0286, elev: 90, region: 'Hauts-de-France' },
    LFAF: { name: 'Laon-Chambry', lat: 49.5968, lon: 3.6335, elev: 78, region: 'Hauts-de-France' },
    LFQB: { name: 'Maubeuge-Élesmes', lat: 50.3103, lon: 3.9706, elev: 152, region: 'Hauts-de-France' },
    LFQL: { name: 'Lens-Bénifontaine', lat: 50.4667, lon: 2.8167, elev: 32, region: 'Hauts-de-France' },
    LFQO: { name: 'Lille-Bondues', lat: 50.6667, lon: 3.1167, elev: 20, region: 'Hauts-de-France' },
    LFQT: { name: 'Merville-Calonne', lat: 50.6194, lon: 2.6425, elev: 18, region: 'Hauts-de-France' },
    LFAB: { name: 'Dieppe-St-Aubin', lat: 49.8825, lon: 1.0853, elev: 110, region: 'Normandie' },
    LFOH: { name: 'Le Havre-Octeville', lat: 49.5339, lon: 0.0883, elev: 111, region: 'Normandie' },
    LFOP: { name: 'Rouen-Boos', lat: 49.3847, lon: 1.1750, elev: 151, region: 'Normandie' },
    LFOM: { name: 'Lessay', lat: 49.1842, lon: -1.5028, elev: 40, region: 'Normandie' },
    LFRO: { name: 'Lannion', lat: 48.7544, lon: -3.4706, elev: 88, region: 'Bretagne' },
    LFRV: { name: 'Vannes-Meucon', lat: 47.7233, lon: -2.7186, elev: 91, region: 'Bretagne' },
    LFFG: { name: 'La Ferté-Gaucher', lat: 48.7822, lon: 3.2722, elev: 164, region: 'Île-de-France' },
    LFPL: { name: 'Lognes-Émerainville', lat: 48.8231, lon: 2.6225, elev: 110, region: 'Île-de-France' },
    LFSA: { name: 'Besançon-Thise', lat: 47.2478, lon: 6.0833, elev: 307, region: 'Grand Est' },
    LFQZ: { name: 'Dieuze-Guéblange', lat: 48.8000, lon: 6.7167, elev: 220, region: 'Grand Est' },
    LFSN: { name: 'Nancy-Essey', lat: 48.6926, lon: 6.2301, elev: 212, region: 'Grand Est' },
    LFGA: { name: 'Colmar-Houssen', lat: 48.1100, lon: 7.3597, elev: 196, region: 'Grand Est' },
    LFAV: { name: 'Laval-Entrammes', lat: 48.0314, lon: -0.7428, elev: 101, region: 'Pays de la Loire' },
    LFRI: { name: 'La Roche-sur-Yon', lat: 46.7019, lon: -1.3786, elev: 90, region: 'Pays de la Loire' },
    LFOD: { name: 'Saumur-St Florent', lat: 47.2569, lon: -0.1153, elev: 30, region: 'Pays de la Loire' },
    LFRM: { name: 'Le Mans-Arnage', lat: 47.9486, lon: 0.2017, elev: 55, region: 'Pays de la Loire' },
    LFOO: { name: "Les Sables-d'Olonne", lat: 46.4767, lon: -1.7222, elev: 31, region: 'Pays de la Loire' },
    LFOZ: { name: 'Orléans-St Denis', lat: 47.8969, lon: 2.1633, elev: 125, region: 'Centre' },
    LFQG: { name: 'Nevers-Fourchambault', lat: 47.0025, lon: 3.1133, elev: 180, region: 'Centre' },
    LFLV: { name: 'Vichy-Charmeil', lat: 46.1694, lon: 3.4036, elev: 249, region: 'Auvergne-Rhône-Alpes' },
    LFHS: { name: 'Bourg-en-Bresse', lat: 46.2028, lon: 5.2903, elev: 255, region: 'Auvergne-Rhône-Alpes' },
    LFLE: { name: 'Chambéry-Challes', lat: 45.5611, lon: 5.9758, elev: 235, region: 'Auvergne-Rhône-Alpes' },
    LFLO: { name: 'Roanne-Renaison', lat: 46.0583, lon: 3.9933, elev: 379, region: 'Auvergne-Rhône-Alpes' },
    LFLH: { name: 'Chalon-Champforgeuil', lat: 46.8261, lon: 4.8186, elev: 188, region: 'Auvergne-Rhône-Alpes' },
    LFLY: { name: 'Lyon-Bron', lat: 45.7272, lon: 4.9444, elev: 200, region: 'Auvergne-Rhône-Alpes' },
    LFLG: { name: 'Grenoble-Le Versoud', lat: 45.2181, lon: 5.8489, elev: 220, region: 'Auvergne-Rhône-Alpes' },
    LFHY: { name: 'Moulins-Montbeugny', lat: 46.5344, lon: 3.4237, elev: 273, region: 'Auvergne-Rhône-Alpes' },
    LFHT: { name: 'Ambert-Le Poyet', lat: 45.5400, lon: 3.7500, elev: 535, region: 'Auvergne-Rhône-Alpes' },
    LFHR: { name: 'Brioude-Beaumont', lat: 45.3000, lon: 3.3700, elev: 450, region: 'Auvergne-Rhône-Alpes' },
    LFMC: { name: 'Le Luc-Le Cannet', lat: 43.3847, lon: 6.3872, elev: 81, region: 'PACA' },
    LFNT: { name: 'Avignon-Pujaut', lat: 43.9967, lon: 4.7533, elev: 40, region: 'PACA' },
    LFNA: { name: 'Gap-Tallard', lat: 44.4553, lon: 6.0378, elev: 602, region: 'PACA' },
    LFMA: { name: 'Aix-Les Milles', lat: 43.5053, lon: 5.3678, elev: 105, region: 'PACA' },
    LFCY: { name: 'Royan-Médis', lat: 45.6281, lon: -0.9725, elev: 27, region: 'Nouvelle-Aquitaine' },
    LFCZ: { name: 'Mimizan', lat: 44.1464, lon: -1.1703, elev: 30, region: 'Nouvelle-Aquitaine' },
    LFDS: { name: 'Soulac-sur-Mer', lat: 45.4900, lon: -1.0836, elev: 7, region: 'Nouvelle-Aquitaine' },
    LFBP: { name: 'Pau-Uzein', lat: 43.3800, lon: -0.4186, elev: 188, region: 'Nouvelle-Aquitaine' },
    LFBH: { name: 'La Teste-de-Buch', lat: 44.5967, lon: -1.1286, elev: 17, region: 'Nouvelle-Aquitaine' },
    LFDR: { name: 'La Réole-Floudès', lat: 44.5836, lon: -0.0531, elev: 69, region: 'Nouvelle-Aquitaine' },
    LFBN: { name: 'Niort-Souché', lat: 46.3119, lon: -0.3944, elev: 62, region: 'Nouvelle-Aquitaine' },
    LFBK: { name: 'Rochefort-St Agnant', lat: 45.8878, lon: -0.9831, elev: 18, region: 'Nouvelle-Aquitaine' },
    LFMZ: { name: 'Lézignan-Corbières', lat: 43.1758, lon: 2.7342, elev: 62, region: 'Occitanie' },
    LFDJ: { name: 'Pamiers-Les Pujols', lat: 43.090556, lon: 1.695833, elev: 308, region: 'Occitanie' },
    LFCC: { name: 'Cahors-Lalbenque', lat: 44.3536, lon: 1.4747, elev: 279, region: 'Occitanie' },
    LFCG: { name: 'Castelnau-Magnoac', lat: 43.2847, lon: 0.5203, elev: 420, region: 'Occitanie' },
    LFDT: { name: 'Tarbes-Laloubère', lat: 43.2133, lon: 0.0681, elev: 340, region: 'Occitanie' },
    LFCL: { name: 'Toulouse-Bouloc', lat: 43.7733, lon: 1.4022, elev: 152, region: 'Occitanie' },
    LFKO: { name: 'Propriano-Tavaria', lat: 41.6606, lon: 8.9453, elev: 15, region: 'Corse' },
};

const PARA_TYPOLOGIES = {
    ff_sv: { id: 'ff_sv', name: 'Freefly (Petite Voile)', vc: 70, vzVoile: 10, glide: 2.0, hOuv: 1000, nbPara: 1, hBreak: 1500, sepDist: 100, canopyType: 'crossbraced' },
    ff_mv: { id: 'ff_mv', name: 'Freefly (Voile Moyenne)', vc: 70, vzVoile: 5, glide: 2.5, hOuv: 1000, nbPara: 1, hBreak: 1500, sepDist: 100, canopyType: 'sport' },
    track_sv: { id: 'track_sv', name: 'Tracking (Petite Voile)', vc: 60, vzVoile: 10, glide: 2.0, hOuv: 1000, isTracking: true, trackDist: 1000, trackAxis: 90, nbPara: 1, hBreak: 1500, sepDist: 100, canopyType: 'crossbraced' },
    track_mv: { id: 'track_mv', name: 'Tracking (Grande Voile)', vc: 60, vzVoile: 5, glide: 2.5, hOuv: 1000, isTracking: true, trackDist: 1000, trackAxis: 90, nbPara: 1, hBreak: 1500, sepDist: 100, canopyType: 'sport' },
    vr_sv: { id: 'vr_sv', name: 'VR (Petite Voile)', vc: 50, vzVoile: 10, glide: 2.0, hOuv: 1000, nbPara: 1, hBreak: 1500, sepDist: 100, canopyType: 'sport' },
    vr_mv: { id: 'vr_mv', name: 'VR (Voile Moyenne)', vc: 50, vzVoile: 5.0, glide: 2.5, hOuv: 1000, nbPara: 1, hBreak: 1500, sepDist: 100, canopyType: 'docile' },
    eleve_12: { id: 'eleve_12', name: 'Élève (1200m)', vc: 50, vzVoile: 5.0, glide: 2.5, hOuv: 1200, nbPara: 1, hBreak: 1500, sepDist: 0, canopyType: 'student', skill: 0.65 },
    eleve_15: { id: 'eleve_15', name: 'Élève (1500m)', vc: 50, vzVoile: 5.0, glide: 2.5, hOuv: 1500, nbPara: 1, hBreak: 1700, sepDist: 0, canopyType: 'student', skill: 0.55 },
    tandem: {
        id: 'tandem', name: 'Tandem (1500m)',
        vc: 50, vzVoile: 5.5, glide: 2.8, hOuv: 1500,
        nbPara: 1, hBreak: 1700, sepDist: 0,
        canopyType: 'tandem',
        subAngleSigma: 0, trackAxisSigma: 0, skill: 0.95
    },
    pac: {
        id: 'pac', name: 'PAC (élève + moniteur, sortie groupée)',
        vc: 50, vzVoile: 5.0, glide: 2.5,
        nbPara: 2, hBreak: 1500, sepDist: 0,
        canopyType: 'docile',
        subAngleSigma: 0, trackAxisSigma: 0,
        subOverrides: [
            {
                name: 'PAC élève', hOuv: 1500,
                canopyType: 'student', skill: 0.55
            },
            {
                name: 'PAC moniteur', hOuv: 1000,
                breakoffDist: 200, breakoffAxis: 90, breakoffAxisSigma: 10,
                canopyType: 'sport', skill: 0.95
            }
        ]
    },
    pac_first: {
        id: 'pac_first', name: 'PAC premier saut (1 élève + 2 moniteurs)',
        vc: 50, vzVoile: 5.0, glide: 2.5,
        nbPara: 3, hBreak: 1500, sepDist: 0,
        canopyType: 'docile',
        subAngleSigma: 0, trackAxisSigma: 0,
        subOverrides: [
            {
                name: 'PAC élève (1er saut)', hOuv: 1500,
                canopyType: 'student', skill: 0.50
            },
            {
                name: 'PAC moniteur G', hOuv: 1000,
                breakoffDist: 200, breakoffAxis: 90, breakoffAxisSigma: 10,
                canopyType: 'sport', skill: 0.95
            },
            {
                name: 'PAC moniteur D', hOuv: 1000,
                breakoffDist: 200, breakoffAxis: -90, breakoffAxisSigma: 10,
                canopyType: 'sport', skill: 0.95
            }
        ]
    },
    eleve_drift: {
        id: 'eleve_drift', name: 'Élève en dérive (côté incertain)',
        vc: 50, vzVoile: 5.0, glide: 2.5, hOuv: 1500,
        nbPara: 1, hBreak: 1700, sepDist: 0,
        canopyType: 'student',
        isTracking: true, trackDist: 600, trackAxis: 90,
        trackAxisSigma: 25, flipProb: 0.50,
        skill: 0.5
    }
};

const PLEVELS = [500, 550, 600, 650, 700, 750, 800, 850, 900, 925, 950, 1000];
const SIM_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

// ================================================================
//  GLOBAL STATE
// ================================================================
var map, dzMarker, targetMarker, rvMarker, rvZoneRect, greenMarker, redMarker, axisRotHandle, axisOffHandle, drawnItems;
var windProfile = [], meteoData = {}, simResults = null;
var currentTarget = { lat: 43.1020, lon: 1.7000 };
var currentRV = { lat: 43.0914, lon: 1.6975 };
var jumpersList = []; // Array of { type, vc, vzVoile, glide, hOuv }
var _lastGsMs = 60;
var _draggedParaIdx = null;

// ================================================================
//  DZ HELPERS
// ================================================================
function getDZ() {
    var c = document.getElementById('dz_select').value;
    var db = DZ_DB[c];
    if (!db) { var first = Object.keys(DZ_DB)[0]; db = DZ_DB[first]; c = first; }
    return { code: c, name: db.name, lat: db.lat, lon: db.lon, elev: db.elev, region: db.region };
}

// ================================================================
//  TARGET & RV MANAGEMENT
// ================================================================
function adjTarget(key, val) {
    var el = document.getElementById('target_' + key);
    el.value = (parseFloat(el.value) + val).toFixed(4);
    updateTargetFromInput();
}
function updateTargetFromInput() {
    currentTarget.lat = parseFloat(document.getElementById('target_lat').value);
    currentTarget.lon = parseFloat(document.getElementById('target_lon').value);
    if (targetMarker) targetMarker.setLatLng([currentTarget.lat, currentTarget.lon]);
    recompute();
}
function updateInputFromTarget() {
    document.getElementById('target_lat').value = currentTarget.lat.toFixed(4);
    document.getElementById('target_lon').value = currentTarget.lon.toFixed(4);
    recompute();
}
function adjRV(key, val) {
    var el = document.getElementById('rv_' + key);
    el.value = (parseFloat(el.value) + val).toFixed(4);
    updateRVFromInput();
}
function updateRVFromInput() {
    currentRV.lat = parseFloat(document.getElementById('rv_lat').value);
    currentRV.lon = parseFloat(document.getElementById('rv_lon').value);
    if (rvMarker) rvMarker.setLatLng([currentRV.lat, currentRV.lon]);
    recompute();
}
function updateInputFromRV() {
    document.getElementById('rv_lat').value = currentRV.lat.toFixed(4);
    document.getElementById('rv_lon').value = currentRV.lon.toFixed(4);
    recompute();
}

// ================================================================
//  DZ DROPDOWN
// ================================================================
function populateDZSelect() {
    var sel = document.getElementById('dz_select');
    var regions = {};
    for (var code in DZ_DB) {
        var dz = DZ_DB[code];
        if (!regions[dz.region]) regions[dz.region] = [];
        regions[dz.region].push({ code: code, name: dz.name });
    }
    var rKeys = Object.keys(regions).sort();
    for (var ri = 0; ri < rKeys.length; ri++) {
        var r = rKeys[ri];
        var og = document.createElement('optgroup');
        og.label = '── ' + r + ' ──';
        regions[r].sort(function (a, b) { return a.name.localeCompare(b.name); });
        for (var di = 0; di < regions[r].length; di++) {
            var opt = document.createElement('option');
            opt.value = regions[r][di].code;
            opt.textContent = regions[r][di].name + ' (' + regions[r][di].code + ')';
            og.appendChild(opt);
        }
        sel.appendChild(og);
    }
    sel.value = 'LFDJ';
}

function onDZChange(isInit) {
    var dz = getDZ();
    if (!isInit) {
        currentTarget.lat = dz.lat;
        currentTarget.lon = dz.lon;
        currentRV.lat = dz.lat;
        currentRV.lon = dz.lon - 0.005;
        updateInputFromTarget();
        updateInputFromRV();
    } else {
        // Just sync inputs to globals if they were set in HTML
        currentTarget.lat = parseFloat(document.getElementById('target_lat').value) || dz.lat;
        currentTarget.lon = parseFloat(document.getElementById('target_lon').value) || dz.lon;
        currentRV.lat = parseFloat(document.getElementById('rv_lat').value) || dz.lat;
        currentRV.lon = parseFloat(document.getElementById('rv_lon').value) || (dz.lon - 0.005);
    }
    updateInputFromTarget();
    updateInputFromRV();
    document.getElementById('dz_info').textContent =
        dz.lat.toFixed(4) + '°N  ' + dz.lon.toFixed(4) + '°E — Elev ' + dz.elev + ' m (' + (dz.elev * 3.28084).toFixed(0) + ' ft)';
    updateMapDZ(dz);
    // Recharge les patterns + zone de posé + NFZ associés à la DZ courante
    // (storage scopé par code OACI : chaque DZ a sa propre config).
    if (!isInit && typeof PatternEditor !== 'undefined' && typeof PatternEditor.reload === 'function') {
        PatternEditor.reload();
    }
    recompute();
}

// ================================================================
//  ACCORDION
// ================================================================
function toggleAcc(id) {
    var el = document.getElementById(id);
    var hdr = el.previousElementSibling;
    var wasOpen = el.classList.contains('open');
    document.querySelectorAll('.acc-body').forEach(function (b) { b.classList.remove('open'); });
    document.querySelectorAll('.acc-hdr').forEach(function (h) { h.classList.remove('active'); });
    if (!wasOpen) { el.classList.add('open'); hdr.classList.add('active'); }
}

function toggleSubAcc(id) {
    var body = document.getElementById(id);
    var icon = document.getElementById(id + '-icon');
    if (!body) return;
    var isOpen = body.classList.contains('open');
    body.classList.toggle('open', !isOpen);
    if (icon) icon.style.transform = isOpen ? '' : 'rotate(180deg)';
}

// ================================================================
//  COMPASS
// ================================================================
function initCompass() {
    var svg = document.getElementById('compass_svg');
    var cx = 100, cy = 100, r = 82;
    var html = '';
    html += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#cbd5e1" stroke-width="2"/>';
    html += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 12) + '" fill="#f8fafc" stroke="none"/>';
    for (var d = 0; d < 360; d += 10) {
        var rad = (d - 90) * Math.PI / 180;
        var inner = d % 30 === 0 ? r - 8 : r - 4;
        var x1 = cx + Math.cos(rad) * inner, y1 = cy + Math.sin(rad) * inner;
        var x2 = cx + Math.cos(rad) * r, y2 = cy + Math.sin(rad) * r;
        html += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#94a3b8" stroke-width="' + (d % 30 === 0 ? 2 : 1) + '"/>';
    }
    var labels = [{ d: 0, t: 'N', c: '#ef4444' }, { d: 90, t: 'E', c: '#475569' }, { d: 180, t: 'S', c: '#475569' }, { d: 270, t: 'W', c: '#475569' }];
    for (var li = 0; li < labels.length; li++) {
        var l = labels[li], rad2 = (l.d - 90) * Math.PI / 180;
        var lx = cx + Math.cos(rad2) * (r - 22), ly = cy + Math.sin(rad2) * (r - 22);
        html += '<text x="' + lx + '" y="' + ly + '" text-anchor="middle" dominant-baseline="central" fill="' + l.c + '" font-size="11" font-weight="800">' + l.t + '</text>';
    }
    html += '<line id="compass_needle" x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy - r + 20) + '" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>';
    html += '<circle id="compass_handle" cx="' + cx + '" cy="' + (cy - r + 20) + '" r="7" fill="#3b82f6" stroke="#93c5fd" stroke-width="2"/>';
    html += '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="#60a5fa"/>';
    svg.innerHTML = html;

    var dragging = false;
    function getAngle(e) {
        var rect = svg.getBoundingClientRect();
        var clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
        var clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
        var mx = (clientX - rect.left) / rect.width * 200 - cx;
        var my = (clientY - rect.top) / rect.height * 200 - cy;
        var a = Math.atan2(mx, -my) * 180 / Math.PI;
        if (a < 0) a += 360;
        return Math.round(a);
    }
    function setAngle(deg) {
        deg = ((deg % 360) + 360) % 360;
        document.getElementById('axe_largage').value = deg;
        document.getElementById('compass_val').textContent = deg.toString().padStart(3, '0') + '°';
        var rad3 = (deg - 90) * Math.PI / 180;
        var nx = cx + Math.cos(rad3) * (r - 20), ny = cy + Math.sin(rad3) * (r - 20);
        document.getElementById('compass_needle').setAttribute('x2', nx);
        document.getElementById('compass_needle').setAttribute('y2', ny);
        var handle = document.getElementById('compass_handle');
        handle.setAttribute('cx', nx);
        handle.setAttribute('cy', ny);
        // Visual + airgram only during drag — simulation on release
        if (typeof createAirgramChart === 'function') createAirgramChart();
    }
    svg.addEventListener('mousedown', function (e) { window._isDragging = true; dragging = true; setAngle(getAngle(e)); });
    svg.addEventListener('touchstart', function (e) { window._isDragging = true; dragging = true; setAngle(getAngle(e)); e.preventDefault(); }, { passive: false });
    window.addEventListener('mousemove', function (e) { if (dragging) setAngle(getAngle(e)); });
    window.addEventListener('touchmove', function (e) { if (dragging) setAngle(getAngle(e)); }, { passive: false });
    window.addEventListener('mouseup', function () {
        if (dragging) {
            window._isDragging = false;
            dragging = false;
            recompute(); // Updates speed/heading displays then runs full simulation
        }
    });
    window.addEventListener('touchend', function () {
        if (dragging) {
            window._isDragging = false;
            dragging = false;
            recompute();
        }
    });
    setAngle(270);
}

function updateAxisAngle(deg) {
    deg = ((deg % 360) + 360) % 360;
    document.getElementById('axe_largage').value = Math.round(deg);
    var cv = document.getElementById('compass_val');
    if (cv) cv.textContent = Math.round(deg).toString().padStart(3, '0') + '°';
    var cx = 100, cy = 100, r = 82;
    var rad = (deg - 90) * Math.PI / 180;
    var nx = cx + Math.cos(rad) * (r - 20), ny = cy + Math.sin(rad) * (r - 20);
    var needle = document.getElementById('compass_needle');
    var handle = document.getElementById('compass_handle');
    if (needle) { needle.setAttribute('x2', nx); needle.setAttribute('y2', ny); }
    if (handle) { handle.setAttribute('cx', nx); handle.setAttribute('cy', ny); }
}

// ================================================================
//  FORECAST HOURS
// ================================================================
function populateHours() {
    var sel = document.getElementById('meteo_hour');
    sel.innerHTML = '';
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var dayShort = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    var monthShort = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
    for (var h = 0; h < 48; h++) {
        var t = new Date(now.getTime() + h * 3600000);
        var opt = document.createElement('option');
        opt.value = h;
        var tDay = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
        var dayDelta = Math.round((tDay - today) / 86400000);
        var dayLabel;
        if (dayDelta === 0) dayLabel = "Auj.";
        else if (dayDelta === 1) dayLabel = 'Demain';
        else if (dayDelta === 2) dayLabel = 'Après-dem.';
        else dayLabel = dayShort[t.getDay()];
        var dateStr = t.getDate() + ' ' + monthShort[t.getMonth()];
        var hourStr = t.getHours().toString().padStart(2, '0') + 'h';
        opt.textContent = dayLabel + ' ' + dateStr + ' — ' + hourStr;
        sel.appendChild(opt);
    }
}

// ================================================================
//  ESPACEMENT SYNC
// ================================================================
function syncEspM() {
    var m = parseFloat(document.getElementById('espacement_m').value) || 300;
    var dt = _lastGsMs > 0 ? m / _lastGsMs : 0;
    document.getElementById('dt_sortie_s').value = dt.toFixed(1);
    recompute();
}
function syncEspS() {
    var dt = parseFloat(document.getElementById('dt_sortie_s').value) || 5;
    var m = dt * _lastGsMs;
    document.getElementById('espacement_m').value = Math.round(m);
    recompute();
}

// ================================================================
//  RECOMPUTE (live preview)
// ================================================================
function recompute() {
    if (!window._applyingOptimum && !window._isDragging) {
        var optOff = document.getElementById('opt_start_offset');
        if (optOff) optOff.value = "0";
    }
    var dz = getDZ();
    var fl = parseFloat(document.getElementById('fl_jump').value) || 140;
    var altFt = fl * 100;
    var altM = altFt * 0.3048;
    var qnh = meteoData.qnh || parseFloat(document.getElementById('qnh_val').value) || 1013.25;
    var isaDelta = parseFloat(document.getElementById('isa_delta').value) || 0;
    var altQnhM = altM + (qnh - 1013.25) * 8.43;
    var kias = parseFloat(document.getElementById('kias').value) || 120;
    var tas = computeTAS(kias, altQnhM, isaDelta);

    var axe = parseFloat(document.getElementById('axe_largage').value) || 90;
    var wv = windVecAtZ(altQnhM);
    var trackE_r = Math.sin(axe * Math.PI / 180);
    var trackN_r = Math.cos(axe * Math.PI / 180);
    var tasMs_r = tas * 0.514444;
    var gsE_r = trackE_r * tasMs_r + wv.e;
    var gsN_r = trackN_r * tasMs_r + wv.n;
    var gs = Math.sqrt(gsE_r * gsE_r + gsN_r * gsN_r) / 0.514444;
    var headE = trackE_r * tasMs_r - wv.e;
    var headN = trackN_r * tasMs_r - wv.n;
    var capDeg = ((Math.atan2(headE, headN) * 180 / Math.PI) + 360) % 360;

    document.getElementById('speed_display').innerHTML =
        'TAS: <b>' + tas.toFixed(0) + '</b> kt (' + (tas * 0.514444).toFixed(1) + ' m/s) — GS: <b>' + gs.toFixed(0) + '</b> kt';
    var trackInfoEl = document.getElementById('track_info');
    if (trackInfoEl) trackInfoEl.innerHTML = 'Cap avion: <b>' + capDeg.toFixed(0).padStart(3, '0') + '°</b> | Route sol: <b>' + Math.round(axe).toString().padStart(3, '0') + '°</b>';

    var espM_r = parseFloat(document.getElementById('espacement_m').value) || 300;
    var gsMs_r = gs * 0.514444;
    _lastGsMs = gsMs_r;
    var dtSortie_r = gsMs_r > 0 ? espM_r / gsMs_r : 0;
    if (document.activeElement && document.activeElement.id !== 'dt_sortie_s') {
        document.getElementById('dt_sortie_s').value = dtSortie_r.toFixed(1);
    }
    var delaiTV_r = parseFloat(document.getElementById('delai_top_vert').value) || 5;
    var nPara_r = jumpersList.length || 4;
    var dureeLargCalc = delaiTV_r + (nPara_r - 1) * dtSortie_r;
    var durDispEl = document.getElementById('duree_largage_display');
    if (durDispEl) durDispEl.innerHTML = '<b>' + dureeLargCalc.toFixed(1) + '</b> s  <span style="font-size:9px;opacity:0.7">(Δt=' + dtSortie_r.toFixed(1) + 's)</span>';
    var heightM = altQnhM - dz.elev;
    var heightFt = heightM / 0.3048;
    document.getElementById('alt_display').innerHTML =
        'Haut: <b>' + heightFt.toFixed(0) + '</b> ft / <b>' + heightM.toFixed(0) + '</b> m AGL (terrain ' + dz.elev + 'm)';

    var crossNm = parseFloat(document.getElementById('cross_track_nm').value) || 0;
    if (Math.abs(crossNm) > 0.001) {
        document.getElementById('offset_display').innerHTML =
            'Cross-track: <b>' + crossNm.toFixed(1) + '</b> NM (' + (crossNm > 0 ? 'Droite' : 'Gauche') + ')';
    } else {
        document.getElementById('offset_display').innerHTML = 'Offset: <b>Sur axe</b>';
    }

    // Top-bar pills (FL / KIAS / Surf wind) — surface wind from log-Prandtl at 10m AGL
    if (typeof updateTopBarPills === 'function') {
        var fl_disp = parseFloat(document.getElementById('fl_jump').value) || 140;
        var kias_disp = parseFloat(document.getElementById('kias').value) || 120;
        var windSfcKt = null;
        if (typeof windVecAtZ === 'function') {
            var wSfc = windVecAtZ((dz.elev || 0) + 10);
            if (wSfc && (wSfc.e !== 0 || wSfc.n !== 0)) {
                var spdMs = Math.sqrt(wSfc.e * wSfc.e + wSfc.n * wSfc.n);
                windSfcKt = spdMs / 0.514444;
            }
        }
        updateTopBarPills(fl_disp, kias_disp, windSfcKt);
    }

    // Auto-run simulation (allow during dragging for live feedback)
    if (typeof runSimulation === 'function' && !window._applyingOptimum) {
        runSimulation();
    }
    // Live chart update (even while dragging)
    if (typeof createAirgramChart === 'function') createAirgramChart();
}

// ================================================================
//  JUMPERS BUILDER
// ================================================================
function addJumper(typeId) {
    var t = PARA_TYPOLOGIES[typeId || 'vr_mv'];
    if (!t) return;
    jumpersList.push(JSON.parse(JSON.stringify(t)));
    buildJumpers();
    recompute();
}

// Populate the "add jumper" dropdown from PARA_TYPOLOGIES so new typologies
// (PAC, élève en dérive, …) appear automatically without touching index.html.
function _populateTypologySelect() {
    var sel = document.getElementById('typology_select');
    if (!sel) return;
    sel.innerHTML = Object.keys(PARA_TYPOLOGIES).map(function (k) {
        return '<option value="' + k + '">' + PARA_TYPOLOGIES[k].name + '</option>';
    }).join('');
}
document.addEventListener('DOMContentLoaded', _populateTypologySelect);

function generateFullStick() {
    jumpersList = [];
    Object.keys(PARA_TYPOLOGIES).forEach(function (k) {
        jumpersList.push(JSON.parse(JSON.stringify(PARA_TYPOLOGIES[k])));
    });
    buildJumpers();
    recompute();
}

function removeJumper(idx) {
    jumpersList.splice(idx, 1);
    buildJumpers();
    recompute();
}

function updateJumperParam(idx, key, val) {
    if (jumpersList[idx]) {
        jumpersList[idx][key] = parseFloat(val);
        recompute();
    }
}

function setJumperTypology(idx, typeId) {
    var t = PARA_TYPOLOGIES[typeId];
    if (t && jumpersList[idx]) {
        var isOpen = document.getElementById('para_details_' + idx)?.style.display === 'block';
        jumpersList[idx] = JSON.parse(JSON.stringify(t));
        buildJumpers();
        if (isOpen) {
            document.getElementById('para_details_' + idx).style.display = 'block';
            document.getElementById('para_icon_' + idx).style.transform = 'rotate(180deg)';
        }
        recompute();
    }
}

function toggleJumperDetails(idx) {
    var el = document.getElementById('para_details_' + idx);
    var icon = document.getElementById('para_icon_' + idx);
    if (el) {
        var open = el.style.display !== 'none';
        el.style.display = open ? 'none' : 'block';
        if (icon) icon.style.transform = open ? '' : 'rotate(180deg)';
    }
}

function buildJumpers() {
    var c = document.getElementById('jumpers_ctn');
    if (!c) return;
    c.innerHTML = '';

    // Initial load if empty
    if (jumpersList.length === 0) {
        for (var i = 0; i < 4; i++) jumpersList.push(JSON.parse(JSON.stringify(PARA_TYPOLOGIES.vr_mv)));
    }

    jumpersList.forEach(function (p, i) {
        // Add a drop zone before each entry
        var dz = document.createElement('div');
        dz.className = 'para-drop-zone';
        dz.dataset.idx = i;
        dz.ondragover = function (e) { e.preventDefault(); this.classList.add('active'); };
        dz.ondragleave = function () { this.classList.remove('active'); };
        dz.ondrop = function (e) { handleParaDrop(e, parseInt(this.dataset.idx)); };
        c.appendChild(dz);

        var card = document.createElement('div');
        card.className = 'para-entry p-2 bg-slate-800/40 rounded border border-slate-800';
        card.draggable = true;
        card.dataset.idx = i;

        card.ondragstart = function (e) {
            handleParaDragStart(e, i);
        };
        card.ondragend = function () {
            this.classList.remove('dragging');
            _draggedParaIdx = null;
            document.querySelectorAll('.para-drop-zone').forEach(z => z.classList.remove('active'));
        };

        card.innerHTML =
            '<div class="flex items-center justify-between mb-1">' +
            '  <div class="flex items-center gap-2 cursor-pointer" onclick="toggleJumperDetails(' + i + ')">' +
            '    <svg id="para_icon_' + i + '" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-3 h-3 text-slate-500 transition-transform"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/></svg>' +
            '    <span class="text-[10px] font-black text-blue-400">P' + (i + 1) + '</span>' +
            '    <span class="text-[10px] font-bold text-slate-300">' + p.name + '</span>' +
            '  </div>' +
            '  <button onclick="removeJumper(' + i + ')" class="text-[10px] text-red-400 font-bold hover:text-red-300">Supprimer</button>' +
            '</div>' +
            '<div id="para_details_' + i + '" style="display:none;" class="mt-2 pt-2 border-t border-slate-800/50">' +
            '  <div class="mb-2">' +
            '    <label class="lbl" style="font-size:9px">Changer Typologie</label>' +
            '    <select onchange="setJumperTypology(' + i + ', this.value)" class="w-full bg-slate-900 border-slate-700 text-[10px] py-1 mb-2">' +
            Object.keys(PARA_TYPOLOGIES).map(k => '<option value="' + k + '" ' + (p.id === k ? 'selected' : '') + '>' + PARA_TYPOLOGIES[k].name + '</option>').join('') +
            '    </select>' +
            '  </div>' +
            '  <div class="grid grid-cols-2 gap-2 mb-1">' +
            '    <div><label class="lbl" style="font-size:9px">Nb Paras</label>' +
            '    <input type="number" value="' + (p.nbPara || 1) + '" step="1" min="1" oninput="updateJumperParam(' + i + ',\'nbPara\',this.value)"></div>' +
            '    <div><label class="lbl" style="font-size:9px">Vz Chute (m/s)</label>' +
            '    <input type="number" value="' + p.vc + '" oninput="updateJumperParam(' + i + ',\'vc\',this.value)"></div>' +
            '    <div><label class="lbl" style="font-size:9px">Ouv. m AGL</label>' +
            '    <input type="number" value="' + p.hOuv + '" step="50" oninput="updateJumperParam(' + i + ',\'hOuv\',this.value)"></div>' +
            '    <div><label class="lbl" style="font-size:9px">Finesse</label>' +
            '    <input type="number" value="' + p.glide + '" step="0.1" oninput="updateJumperParam(' + i + ',\'glide\',this.value)"></div>' +

            '    <div class="col-span-2 grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/50">' +
            '       <div><label class="lbl" style="font-size:9px">H. Break</label>' +
            '       <input type="number" value="' + (p.hBreak || 1500) + '" step="50" oninput="updateJumperParam(' + i + ',\'hBreak\',this.value)"></div>' +
            '       <div><label class="lbl" style="font-size:9px">Dist. Sep (m)</label>' +
            '       <input type="number" value="' + (p.sepDist || 100) + '" step="10" oninput="updateJumperParam(' + i + ',\'sepDist\',this.value)"></div>' +
            '    </div>' +
            '    <input type="hidden" value="' + p.vzVoile + '" id="vzVoile_' + i + '"><input type="hidden" id="t_pilot_' + i + '" value="8">' +
            '  </div>' +
            (p.isTracking ?
                '<div class="mt-1 border-t border-slate-700/50 pt-1"><div class="text-[9px] font-bold text-slate-400 mb-1">Configuration Tracking</div><div class="grid grid-cols-2 gap-2">' +
                '<div><label class="lbl" style="font-size:9px">Dist. (m)</label><input type="number" value="' + (p.trackDist || 1000) + '" step="50" oninput="updateJumperParam(' + i + ',\'trackDist\',this.value)"></div>' +
                '<div><label class="lbl" style="font-size:9px">Axe/Largage</label><input type="number" value="' + (p.trackAxis != null ? p.trackAxis : 90) + '" step="5" oninput="updateJumperParam(' + i + ',\'trackAxis\',this.value)"></div>' +
                '</div></div>'
                : '') +
            '</div>';
        c.appendChild(card);
    });

    // Add a final drop zone
    var dzFinal = document.createElement('div');
    dzFinal.className = 'para-drop-zone';
    dzFinal.dataset.idx = jumpersList.length;
    dzFinal.ondragover = function (e) { e.preventDefault(); this.classList.add('active'); };
    dzFinal.ondragleave = function () { this.classList.remove('active'); };
    dzFinal.ondrop = function (e) { handleParaDrop(e, parseInt(this.dataset.idx)); };
    c.appendChild(dzFinal);
}

function handleParaDrop(e, dropIdx) {
    e.preventDefault();
    var dragIdx = _draggedParaIdx;
    if (dragIdx === null || dragIdx === dropIdx || dragIdx === dropIdx - 1) {
        _draggedParaIdx = null;
        return;
    }

    var item = jumpersList.splice(dragIdx, 1)[0];
    if (dropIdx > dragIdx) dropIdx--;
    jumpersList.splice(dropIdx, 0, item);

    _draggedParaIdx = null;
    buildJumpers();
    recompute();
}

function handleParaDragStart(e, idx) {
    _draggedParaIdx = idx;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idx); // Mandatory for some browsers

    // Using a class to style the element being dragged
    var target = e.currentTarget;
    setTimeout(function () {
        target.classList.add('dragging');
    }, 0);
}

// ================================================================
//  WIND LAYERS UI
// ================================================================
function renderWindLayers() {
    var c = document.getElementById('wind_layers_ctn');
    c.innerHTML = '';
    for (var i = 0; i < PLEVELS.length; i++) {
        var p = windProfile[i] || { spd: 0, dir: 0, temp: 15 };
        var altM = p.z || hpa2alt(PLEVELS[i]);
        var flVal = Math.round(altM * 3.28084 / 100);
        var flStr = 'FL' + flVal.toString().padStart(3, '0');
        c.innerHTML +=
            '<div class="wlayer" style="grid-template-columns: 72px 1fr 1fr; gap: 8px;">' +
            '<div><span style="color:#94a3b8;font-size:10px;font-weight:700">' + PLEVELS[i] + '</span>' +
            '<span style="display:block;color:#475569;font-size:8px">~' + Math.round(altM) + 'm ' + flStr + '</span></div>' +
            '<input type="number" id="wspd_' + i + '" value="' + (p.spd != null ? p.spd.toFixed(0) : '0') + '" step="1" min="0" onchange="updateProfileFromUI()">' +
            '<div class="wind-slider-wrap">' +
            '  <svg class="wind-slider-svg" id="wslider_svg_' + i + '" viewBox="0 0 100 100" data-idx="' + i + '"></svg>' +
            '  <div class="wind-slider-val" id="wslider_val_' + i + '">' + (p.dir != null ? Math.round(p.dir).toString().padStart(3, '0') : '000') + '°</div>' +
            '  <input type="hidden" id="wdir_' + i + '" value="' + (p.dir != null ? p.dir.toFixed(0) : '0') + '">' +
            '</div>' +
            '</div>';
    }
    initWindSliders();
}

function initWindSliders() {
    for (var i = 0; i < PLEVELS.length; i++) {
        (function (idx) {
            var svg = document.getElementById('wslider_svg_' + idx);
            if (!svg) return;
            var cx = 50, cy = 50, r = 40;
            var html = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#0f172a" stroke="#334155" stroke-width="1.5"/>';
            html += '<line id="wneedle_' + idx + '" x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy - r + 5) + '" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/>';
            html += '<circle id="whandle_' + idx + '" cx="' + cx + '" cy="' + (cy - r + 5) + '" r="4" fill="#60a5fa"/>';
            svg.innerHTML = html;

            var currentDir = parseFloat(document.getElementById('wdir_' + idx).value) || 0;
            updateWindSliderUI(idx, currentDir);

            var dragging = false;
            function handleMove(e) {
                if (!dragging) return;
                var rect = svg.getBoundingClientRect();
                var clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
                var clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
                var mx = (clientX - rect.left) / rect.width * 100 - cx;
                var my = (clientY - rect.top) / rect.height * 100 - cy;
                var a = (Math.atan2(mx, -my) * 180 / Math.PI + 360) % 360;
                var deg = Math.round(a);
                document.getElementById('wdir_' + idx).value = deg;
                if (windProfile[idx]) {
                    windProfile[idx].dir = deg;
                }
                updateWindSliderUI(idx, deg);
                // Visual + airgram only during drag — simulation on release
                if (typeof updateSortedWindProfile === 'function') updateSortedWindProfile();
                if (typeof createAirgramChart === 'function') createAirgramChart();
            }

            svg.addEventListener('mousedown', function (e) { window._isDragging = true; dragging = true; handleMove(e); });
            svg.addEventListener('touchstart', function (e) { window._isDragging = true; dragging = true; handleMove(e); e.preventDefault(); }, { passive: false });
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('mouseup', function () {
                if (dragging) {
                    window._isDragging = false;
                    dragging = false;
                    recompute(); // Runs simulation on release
                }
            });
            window.addEventListener('touchend', function () {
                if (dragging) {
                    window._isDragging = false;
                    dragging = false;
                    recompute();
                }
            });
        })(i);
    }
}

function updateWindSliderUI(idx, deg) {
    var valEl = document.getElementById('wslider_val_' + idx);
    if (valEl) valEl.textContent = Math.round(deg).toString().padStart(3, '0') + '°';
    var cx = 50, cy = 50, r = 40;
    var rad = (deg - 90) * Math.PI / 180;
    var nx = cx + Math.cos(rad) * (r - 8), ny = cy + Math.sin(rad) * (r - 8);
    var needle = document.getElementById('wneedle_' + idx);
    var handle = document.getElementById('whandle_' + idx);
    if (needle) { needle.setAttribute('x2', nx); needle.setAttribute('y2', ny); }
    if (handle) { handle.setAttribute('cx', nx); handle.setAttribute('cy', ny); }
}

function updateProfileFromUI() {
    for (var i = 0; i < PLEVELS.length; i++) {
        if (windProfile[i]) {
            var spdEl = document.getElementById('wspd_' + i);
            var dirEl = document.getElementById('wdir_' + i);
            if (spdEl) windProfile[i].spd = parseFloat(spdEl.value) || 0;
            if (dirEl) windProfile[i].dir = parseFloat(dirEl.value) || 0;
        }
    }
    if (typeof updateSortedWindProfile === 'function') updateSortedWindProfile();
    recompute();
    if (typeof createAirgramChart === 'function') createAirgramChart();
}

// ================================================================
//  METEO FETCH
// ================================================================
async function fetchMeteo() {
    var dz = getDZ();
    var model = document.getElementById('meteo_model').value;
    var hourOffset = parseInt(document.getElementById('meteo_hour').value);
    var status = document.getElementById('meteo_status');
    status.textContent = '📡 Fetching ' + model + ' for ' + dz.code + '...';

    try {
        var pVars = PLEVELS.map(function (p) {
            return 'wind_speed_' + p + 'hPa,wind_direction_' + p + 'hPa,temperature_' + p + 'hPa,cloud_cover_' + p + 'hPa,geopotential_height_' + p + 'hPa';
        }).join(',');
        var extra = ',pressure_msl,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high';
        var days = Math.max(2, Math.ceil((hourOffset + 1) / 24));
        var url = 'https://api.open-meteo.com/v1/forecast?models=' + model +
            '&latitude=' + dz.lat + '&longitude=' + dz.lon +
            '&hourly=' + pVars + extra + '&wind_speed_unit=kn&forecast_days=' + days;

        var res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var data = await res.json();
        if (!data.hourly || !data.hourly.time) throw new Error('No hourly data returned for model ' + model);
        var idx = Math.min(hourOffset, data.hourly.time.length - 1);

        meteoData.qnh = data.hourly.pressure_msl ? data.hourly.pressure_msl[idx] : null;
        meteoData.cloud_total = data.hourly.cloud_cover ? data.hourly.cloud_cover[idx] : 0;
        meteoData.cloud_low = data.hourly.cloud_cover_low ? data.hourly.cloud_cover_low[idx] : 0;
        meteoData.cloud_mid = data.hourly.cloud_cover_mid ? data.hourly.cloud_cover_mid[idx] : 0;
        meteoData.cloud_high = data.hourly.cloud_cover_high ? data.hourly.cloud_cover_high[idx] : 0;
        meteoData.time = data.hourly.time[idx];

        windProfile = PLEVELS.map(function (hpa) {
            var sKey = 'wind_speed_' + hpa + 'hPa';
            var dKey = 'wind_direction_' + hpa + 'hPa';
            var tKey = 'temperature_' + hpa + 'hPa';
            var cKey = 'cloud_cover_' + hpa + 'hPa';
            var gKey = 'geopotential_height_' + hpa + 'hPa';
            var geoH = (data.hourly[gKey] && data.hourly[gKey][idx] != null) ? data.hourly[gKey][idx] : hpa2alt(hpa);
            return {
                hpa: hpa, z: geoH,
                spd: (data.hourly[sKey] && data.hourly[sKey][idx] != null) ? data.hourly[sKey][idx] : 0,
                dir: (data.hourly[dKey] && data.hourly[dKey][idx] != null) ? data.hourly[dKey][idx] : 0,
                temp: (data.hourly[tKey] && data.hourly[tKey][idx] != null) ? data.hourly[tKey][idx] : 15,
                cloud: (data.hourly[cKey] && data.hourly[cKey][idx] != null) ? data.hourly[cKey][idx] : 0,
                geoH: geoH,
            };
        });

        var qnhVal = meteoData.qnh != null ? meteoData.qnh : 1013.25;
        document.getElementById('qnh_val').value = qnhVal.toFixed(2);
        renderWindLayers();
        if (typeof updateSortedWindProfile === 'function') updateSortedWindProfile();
        recompute();
        createAirgramChart();
        var airTag = document.getElementById('airgram_tag');
        if (airTag) airTag.textContent = model.toUpperCase() + ' — ' + (meteoData.time || '');
        status.innerHTML = '✅ <b>' + dz.code + '</b> — QNH ' + qnhVal.toFixed(1) + ' hPa | ☁ ' + (meteoData.cloud_total || 0) + '% | ' + new Date().toLocaleTimeString('fr-FR');
    } catch (err) {
        console.error(err);
        status.innerHTML = '⚠️ Erreur: ' + err.message;
        windProfile = PLEVELS.map(function (hpa, i) {
            return { hpa: hpa, z: hpa2alt(hpa), spd: 5 + i * 3, dir: 270 + i * 5, temp: 15 - i * 2, cloud: 0, geoH: hpa2alt(hpa) };
        });
        meteoData.qnh = 1013.25; meteoData.cloud_total = 0;
        meteoData.cloud_low = 0; meteoData.cloud_mid = 0; meteoData.cloud_high = 0;
        renderWindLayers(); recompute(); createAirgramChart();
    }
}

// ================================================================
//  WX CLUSTER LOADER (météo "type" issue du clustering)
// ================================================================
function populateWxClusters() {
    var sel = document.getElementById('wx_cluster_select');
    if (!sel || typeof JUMP_WX_CLUSTERS === 'undefined') return;
    var data = JUMP_WX_CLUSTERS;
    sel.innerHTML = '<option value="">— sélectionner un profil clusterisé —</option>';
    var dateRange = data.date_min ? ' (' + data.date_min + ' → ' + data.date_max + ')' : '';
    var head = document.createElement('option');
    head.disabled = true;
    head.textContent = 'LFDJ ' + (data.n_sessions_total || 0) + ' demi-journées' + dateRange;
    sel.appendChild(head);
    data.clusters.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = String(c.cluster);
        opt.textContent = '#' + c.cluster + ' [' + c.n_sessions + 'j] ' + c.label;
        sel.appendChild(opt);
    });
}

function loadWxCluster(idStr) {
    if (idStr === '' || idStr == null) return;
    if (typeof JUMP_WX_CLUSTERS === 'undefined') return;
    var id = parseInt(idStr, 10);
    var cluster = JUMP_WX_CLUSTERS.clusters.find(function (c) { return c.cluster === id; });
    if (!cluster) return;

    // Construit un windProfile aux 12 niveaux PLEVELS attendus par le
    // simu, en utilisant les 7 niveaux clusterisés (950→600 hPa) +
    // l'extrapolation pour 1000, 750, 650, 550, 500.
    // Le cluster fournit aussi le niveau 10m (vent au sol).
    var sol = cluster.wind_profile.find(function (w) { return w.level === '10m'; });
    var levMap = {};
    cluster.wind_profile.forEach(function (w) {
        if (w.hpa != null) levMap[w.hpa] = w;
    });

    function lerpLevel(targetHpa) {
        var levs = [950, 925, 900, 850, 800, 700, 600];
        // Extrapolation hors bornes : on prend le bord et on tire un
        // peu (vent qui monte avec l'altitude typiquement).
        if (targetHpa >= 950) {
            // Sous le 950 hPa : interp 10m (≈ surface) ↔ 950 hPa
            var lvl950 = levMap[950];
            if (!sol || !lvl950) return lvl950 || sol;
            // hPa entre ~ surface (psurf) et 950
            var psurf = 1000;  // approximation
            var t = (targetHpa - psurf) / (950 - psurf);
            t = Math.max(0, Math.min(1, t));
            return _interpWind(sol, lvl950, t);
        }
        if (targetHpa <= 600) return levMap[600];
        // Trouve les bornes englobantes
        for (var i = 0; i < levs.length - 1; i++) {
            var hi = levs[i], lo = levs[i + 1];
            if (targetHpa <= hi && targetHpa >= lo) {
                var a = levMap[hi], b = levMap[lo];
                if (!a || !b) return a || b;
                var t2 = (hi - targetHpa) / (hi - lo);
                return _interpWind(a, b, t2);
            }
        }
        return null;
    }

    function _interpWind(a, b, t) {
        // Interpole en (u, v) cartésien puis recompose
        function uv(w) {
            var spdMs = (w.speed_kt || 0) * 0.5144;
            var dr = (w.dir_deg || 0) * Math.PI / 180;
            return { u: -spdMs * Math.sin(dr), v: -spdMs * Math.cos(dr) };
        }
        var ua = uv(a), ub = uv(b);
        var u = ua.u * (1 - t) + ub.u * t;
        var v = ua.v * (1 - t) + ub.v * t;
        var spdMs = Math.sqrt(u * u + v * v);
        var dirDeg = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
        var temp = (a.temp_c || 0) * (1 - t) + (b.temp_c || 0) * t;
        var z = (a.z || 0) * (1 - t) + (b.z || 0) * t;
        return { speed_kt: spdMs / 0.5144, dir_deg: dirDeg, temp_c: temp, z: z };
    }

    windProfile = PLEVELS.map(function (hpa) {
        var w = lerpLevel(hpa);
        if (!w) return { hpa: hpa, z: hpa2alt(hpa), spd: 0, dir: 270, temp: 15, cloud: 0, geoH: hpa2alt(hpa) };
        return {
            hpa: hpa,
            z: w.z != null ? w.z : hpa2alt(hpa),
            spd: w.speed_kt,
            dir: w.dir_deg,
            temp: w.temp_c,
            cloud: 0,
            geoH: w.z != null ? w.z : hpa2alt(hpa)
        };
    });

    // QNH + nuages + ISA approx depuis les moyennes du cluster
    meteoData.qnh = cluster.qnh;
    meteoData.cloud_total = cluster.cloud_total;
    meteoData.cloud_low = cluster.cloud_low;
    meteoData.cloud_mid = cluster.cloud_mid;
    meteoData.cloud_high = cluster.cloud_high;
    meteoData.time = 'Cluster #' + cluster.cluster;

    document.getElementById('qnh_val').value = (cluster.qnh || 1013.25).toFixed(1);
    // ΔISA = T_2m mesuré − T_ISA(altitude DZ). T_ISA(0m) = 15°C, gradient -6.5°C/km
    var dz = (typeof getDZ === 'function') ? getDZ() : { elev: 0 };
    var tIsaDZ = 15 - 6.5 * (dz.elev || 0) / 1000;
    var dIsa = (cluster.temp2m || 15) - tIsaDZ;
    var isaEl = document.getElementById('isa_delta');
    if (isaEl) isaEl.value = dIsa.toFixed(1);

    var status = document.getElementById('meteo_status');
    if (status) {
        status.innerHTML = '✅ <b>Cluster #' + cluster.cluster + '</b> — ' +
            cluster.label + ' · ' + cluster.n_sessions + ' demi-journées · ' +
            'sol ' + cluster.sol_speed_kt + 'kt/' + cluster.sol_dir_deg + '° · ' +
            '1km ' + cluster.wind_1km_speed_kt + 'kt · ' +
            '4km ' + cluster.exit_speed_kt + 'kt/' + cluster.exit_dir_deg + '° · ' +
            'cisaillement ' + cluster.shear_speed_kt + 'kt';
    }
    var airTag = document.getElementById('airgram_tag');
    if (airTag) airTag.textContent = 'CLUSTER #' + cluster.cluster + ' — ' + cluster.label;

    renderWindLayers();
    if (typeof updateSortedWindProfile === 'function') updateSortedWindProfile();
    recompute();
    if (typeof createAirgramChart === 'function') createAirgramChart();
}

// ================================================================
//  INIT
// ================================================================
window.onload = async function () {
    populateDZSelect();
    populateHours();
    onDZChange(true); // Pass true for isInit
    initCompass();
    initMap();
    buildJumpers();
    populateWxClusters();
    // Pre-populate windProfile with default values so charts render immediately
    windProfile = PLEVELS.map(function (hpa, i) {
        return { hpa: hpa, z: hpa2alt(hpa), spd: 5 + i * 2, dir: 270, temp: 15 - i * 2, cloud: 0, geoH: hpa2alt(hpa) };
    });
    renderWindLayers();
    if (typeof updateSortedWindProfile === 'function') updateSortedWindProfile();
    recompute(); // Trigger initial simulation + charts now that jumpersList is populated
    await fetchMeteo();
};
