// ================================================================
//  PATTERN-EDITOR.JS — Interactive map editor for landing patterns
//  & NFZ. Lets the user place draggable waypoints on the Leaflet map
//  for one east-wind and one west-wind landing pattern, and edit NFZ
//  polygon vertices. State persists in localStorage and is consumed
//  by the simulation (see PhysicsCore.simPass cfg.userPatterns).
// ================================================================
var PatternEditor = (function () {
    'use strict';

    // Per-DZ storage : chaque DZ a ses propres patterns / zone de posé /
    // NFZ. Quand l'utilisateur switch de DZ, on charge automatiquement
    // la config sauvegardée pour cette DZ (ou des seeds si vide).
    var STORAGE_PREFIX = 'dz_user_patterns_v1_';

    function _currentDzCode() {
        var dz = (typeof getDZ === 'function') ? getDZ() : null;
        return (dz && dz.code) ? dz.code : '_default';
    }
    function _storageKey() {
        return STORAGE_PREFIX + _currentDzCode();
    }

    // Default empty pattern slot. Two slots are exposed in the UI but they
    // are NOT pre-bound to a specific wind direction — the pattern's "wind
    // direction" is derived from its waypoints (the final approach axis).
    // This lets users define patterns for any DZ orientation (E/W, N/S, etc.)
    function _defaultPattern(color) {
        return {
            color: color,
            waypoints: null,  // {downwindStart, baseStart, finalStart, target} as {lat, lon}
            zonePolygon: null, // optional override (legacy, not used here)
            // Optional altitude-bleeding area used BEFORE entering the
            // landing circuit. Shape is either a circle or a polygon :
            //   { type: 'circle',  center: {lat, lon}, radiusM: number }
            //   { type: 'polygon', vertices: [{lat, lon}, ...] }   ≥3 vertices
            evolutionZone: null
        };
    }

    // Keys 'a' and 'b' are arbitrary slot identifiers (was 'east'/'west' but
    // those names assume an E/W runway — we generalised it).
    var _state = {
        patterns: {
            a: _defaultPattern('#f59e0b'),
            b: _defaultPattern('#3b82f6')
        },
        zonePolygon: null   // [{lat, lon}, ...] optional polygonal landing zone
    };

    var _map = null;
    var _editingDir = null;          // 'east' | 'west' | null
    var _editingMarkers = [];        // current draggable markers
    var _editingPolyline = null;
    var _displayLayers = [];         // static rendering of saved patterns
    var _nfzVertexHandles = [];      // draggable vertex handles for NFZ editing
    var _editingNfzId = null;

    var WP_NAMES = ['Vent arrière (DW)', 'Base', 'Finale', 'Cible'];
    var WP_KEYS = ['downwindStart', 'baseStart', 'finalStart', 'target'];

    // ── Persistence ────────────────────────────────────────────
    function load() {
        try {
            // 1) Lit la clé spécifique à la DZ courante
            var raw = localStorage.getItem(_storageKey());
            // 2) Fallback : migre l'ancienne clé globale `dz_user_patterns_v1`
            //    vers la clé de la DZ courante (1 seule fois) puis la supprime
            if (!raw) {
                var legacy = localStorage.getItem('dz_user_patterns_v1');
                if (legacy) {
                    localStorage.setItem(_storageKey(), legacy);
                    localStorage.removeItem('dz_user_patterns_v1');
                    raw = legacy;
                }
            }
            if (!raw) {
                // Pas de config pour cette DZ — on reset l'état en mémoire
                _state.patterns = { a: _defaultPattern('#f59e0b'), b: _defaultPattern('#3b82f6') };
                _state.zonePolygon = null;
                if (typeof NFZ !== 'undefined') {
                    var dz0 = typeof getDZ === 'function' ? getDZ() : { lat: 0, lon: 0 };
                    NFZ.init(dz0.lat, dz0.lon);
                    NFZ.clearZones();
                }
                return;
            }
            var data = JSON.parse(raw);
            if (data.patterns) {
                // Legacy key migration: east → a, west → b
                if (data.patterns.east && !data.patterns.a) data.patterns.a = data.patterns.east;
                if (data.patterns.west && !data.patterns.b) data.patterns.b = data.patterns.west;
                ['a', 'b'].forEach(function (k) {
                    if (data.patterns[k]) _state.patterns[k] = Object.assign(_state.patterns[k], data.patterns[k]);
                });
            }
            if (data.zonePolygon) _state.zonePolygon = data.zonePolygon;
            // Restore NFZ if persisted
            if (data.nfz && typeof NFZ !== 'undefined') {
                var dz = typeof getDZ === 'function' ? getDZ() : { lat: 0, lon: 0 };
                NFZ.init(dz.lat, dz.lon);
                NFZ.clearZones();
                data.nfz.forEach(function (z) { NFZ.addZone(z); });
            }
        } catch (e) { console.warn('PatternEditor.load failed', e); }
    }

    function save() {
        try {
            var nfzList = typeof NFZ !== 'undefined' ? NFZ.getZones().map(function (z) {
                return {
                    name: z.name, type: z.type,
                    altMin: z.altMin, altMax: z.altMax,
                    polygon: z.polygon
                };
            }) : [];
            localStorage.setItem(_storageKey(), JSON.stringify({
                patterns: _state.patterns,
                zonePolygon: _state.zonePolygon,
                nfz: nfzList
            }));
        } catch (e) { console.warn('PatternEditor.save failed', e); }
    }

    // Recharge la config de la DZ courante depuis localStorage. Appelée
    // par app.js sur changement de DZ.
    function reload() {
        // Efface tous les rendus carte (patterns + NFZ). refreshDisplay()
        // redessine les patterns + zone de posé.
        if (_map) {
            _displayLayers.forEach(function (l) { _map.removeLayer(l); });
            _displayLayers = [];
            if (typeof NFZ !== 'undefined' && typeof NFZ.clearMapLayers === 'function') {
                NFZ.clearMapLayers(_map);
            }
        }
        load();
        refreshDisplay();
        if (typeof NFZ !== 'undefined' && _map) NFZ.drawOnMap(_map);
        if (typeof UIOptimizer !== 'undefined' && typeof UIOptimizer.refreshNFZ === 'function') {
            UIOptimizer.refreshNFZ();
        }
    }

    function exportJSON() {
        var payload = {
            patterns: _state.patterns,
            nfz: typeof NFZ !== 'undefined' ? NFZ.getZones().map(function (z) {
                return {
                    name: z.name, type: z.type, polygon: z.polygon,
                    altMin: z.altMin, altMax: z.altMax
                };
            }) : []
        };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'dz-patterns.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function importJSON(file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = JSON.parse(e.target.result);
                if (data.patterns) _state.patterns = data.patterns;
                if (data.nfz && typeof NFZ !== 'undefined') {
                    NFZ.clearZones();
                    var dz = typeof getDZ === 'function' ? getDZ() : { lat: 0, lon: 0 };
                    NFZ.init(dz.lat, dz.lon);
                    data.nfz.forEach(function (z) { NFZ.addZone(z); });
                    if (_map) NFZ.drawOnMap(_map);
                }
                save();
                refreshDisplay();
                alert('Configuration importée');
            } catch (err) {
                alert('Échec import : ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    // ── Default placement ──────────────────────────────────────
    // Seed initial waypoints around the current RV. Slot 'a' starts on the
    // east side (default), slot 'b' on the west — but the user can drag
    // them anywhere afterward. The pattern's actual "wind direction" is
    // derived from the final approach axis at sim time.
    function _seedPattern(slotKey) {
        var rv = window.currentRV || { lat: 0, lon: 0 };
        var dz = typeof getDZ === 'function' ? getDZ() : rv;
        var cosLat = Math.cos(dz.lat * Math.PI / 180);
        var dLat = function (m) { return m / 111320; };
        var dLon = function (m) { return m / (111320 * cosLat); };

        // 'a' starts on the east side (final faces east, used with wind from
        //  east), 'b' on the west. Just a default — drag to relocate.
        var sign = slotKey === 'a' ? -1 : 1;

        return {
            downwindStart: { lat: rv.lat - dLat(80),  lon: rv.lon + dLon(sign * 200) },
            baseStart:     { lat: rv.lat - dLat(80),  lon: rv.lon + dLon(sign * 60) },
            finalStart:    { lat: rv.lat,             lon: rv.lon + dLon(sign * 60) },
            target:        { lat: rv.lat,             lon: rv.lon }
        };
    }

    // Compute the "wind FROM" angle (deg, compass) that this pattern is
    // designed for, from the final approach direction (target − finalStart).
    // The pilot faces this direction during final, so the wind FROM is the
    // same angle.
    function _patternWindFrom(pat) {
        if (!pat.waypoints) return null;
        var wp = pat.waypoints;
        var dz = typeof getDZ === 'function' ? getDZ() : { lat: 0, lon: 0 };
        var cosLat = Math.cos(dz.lat * Math.PI / 180);
        var dE = (wp.target.lon - wp.finalStart.lon) * 111320 * cosLat;
        var dN = (wp.target.lat - wp.finalStart.lat) * 111320;
        var len = Math.sqrt(dE * dE + dN * dN);
        if (len < 5) return null;
        // Pilot heads in dir (dE, dN). Wind FROM that direction.
        var deg = Math.atan2(dE, dN) * 180 / Math.PI;
        return ((deg % 360) + 360) % 360;
    }

    // Human label for a wind angle: "Vent N", "Vent NE", "Vent E", etc.
    function _windLabel(angle) {
        if (angle == null) return 'non défini';
        var dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        var idx = Math.round(angle / 45) % 8;
        return 'Vent ' + dirs[idx] + ' (' + Math.round(angle) + '°)';
    }

    // ── Editing UX ─────────────────────────────────────────────
    function startEdit(dir) {
        if (!_map) { alert('Carte non disponible'); return; }
        if (_editingDir) endEdit();
        _editingDir = dir;
        var pat = _state.patterns[dir];
        if (!pat.waypoints) pat.waypoints = _seedPattern(dir);

        var color = pat.color;
        WP_KEYS.forEach(function (key, i) {
            var wp = pat.waypoints[key];
            var marker = L.marker([wp.lat, wp.lon], {
                draggable: true,
                icon: L.divIcon({
                    className: '',
                    html: '<div style="background:' + color + ';color:#fff;border:2px solid #fff;' +
                        'border-radius:4px;padding:1px 6px;font-size:10px;font-weight:800;' +
                        'box-shadow:0 0 4px rgba(0,0,0,0.5);white-space:nowrap;">' +
                        WP_NAMES[i] + '</div>',
                    iconSize: [80, 18], iconAnchor: [40, 9]
                })
            }).addTo(_map);
            marker._wpKey = key;
            marker.on('drag', function () { _onDrag(); });
            marker.on('dragend', function () {
                var ll = marker.getLatLng();
                pat.waypoints[key] = { lat: ll.lat, lon: ll.lng };
                save();
                _refreshLine();
                if (typeof recompute === 'function') recompute();
            });
            _editingMarkers.push(marker);
        });
        _refreshLine();
        var btn = document.getElementById('btn_edit_' + dir);
        if (btn) btn.textContent = '✓ Terminer édition';
        _refreshPatternLabels();
    }

    function endEdit() {
        _editingMarkers.forEach(function (m) { _map.removeLayer(m); });
        _editingMarkers = [];
        if (_editingPolyline) { _map.removeLayer(_editingPolyline); _editingPolyline = null; }
        var lastDir = _editingDir;
        _editingDir = null;
        if (lastDir) {
            var btn = document.getElementById('btn_edit_' + lastDir);
            if (btn) btn.textContent = 'Éditer circuit ' + (lastDir === 'a' ? '1' : '2');
        }
        refreshDisplay();
        _refreshPatternLabels();
    }

    function _onDrag() {
        var pat = _state.patterns[_editingDir];
        if (!pat.waypoints) return;
        var pts = _editingMarkers.map(function (m) {
            var ll = m.getLatLng(); return [ll.lat, ll.lng];
        });
        if (_editingPolyline) _editingPolyline.setLatLngs(pts);
        else _editingPolyline = L.polyline(pts, { color: pat.color, weight: 2, opacity: 0.8 }).addTo(_map);
    }

    function _refreshLine() {
        var pat = _state.patterns[_editingDir];
        if (!pat || !pat.waypoints) return;
        var pts = WP_KEYS.map(function (k) { return [pat.waypoints[k].lat, pat.waypoints[k].lon]; });
        if (_editingPolyline) _editingPolyline.setLatLngs(pts);
        else _editingPolyline = L.polyline(pts, { color: pat.color, weight: 2, opacity: 0.8 }).addTo(_map);
    }

    function reset(dir) {
        if (!confirm('Effacer le circuit ' + (dir === 'a' ? '1' : '2') + ' ?')) return;
        _state.patterns[dir].waypoints = null;
        save();
        if (_editingDir === dir) endEdit();
        refreshDisplay();
        _refreshPatternLabels();
    }

    function _refreshPatternLabels() {
        ['a', 'b'].forEach(function (k) {
            var lbl = document.getElementById('pattern_label_' + k);
            if (!lbl) return;
            var pat = _state.patterns[k];
            var angle = _patternWindFrom(pat);
            lbl.textContent = pat.waypoints ? _windLabel(angle) : 'non défini';
            lbl.style.color = pat.waypoints ? pat.color : '#64748b';
        });
    }

    // ── Static display of saved patterns ───────────────────────
    function refreshDisplay() {
        if (!_map) return;
        _displayLayers.forEach(function (l) { _map.removeLayer(l); });
        _displayLayers = [];
        ['a', 'b'].forEach(function (dir) {
            var pat = _state.patterns[dir];
            if (!pat.waypoints) return;
            var pts = WP_KEYS.map(function (k) { return [pat.waypoints[k].lat, pat.waypoints[k].lon]; });
            var angle = _patternWindFrom(pat);
            var label = (dir === 'a' ? 'Circuit 1' : 'Circuit 2') + ' — ' + _windLabel(angle);
            var line = L.polyline(pts, {
                color: pat.color, weight: 1.5, opacity: 0.5, dashArray: '4,3'
            }).addTo(_map);
            _displayLayers.push(line);
            pts.forEach(function (ll, i) {
                var dot = L.circleMarker(ll, {
                    radius: 4, color: pat.color, fillColor: pat.color, fillOpacity: 0.8
                }).addTo(_map).bindTooltip(label + ' — ' + WP_NAMES[i], { permanent: false });
                _displayLayers.push(dot);
            });
        });
        _renderZonePolygon();
        _renderEvolutionZones();
    }

    // ── Landing-zone polygon ───────────────────────────────────
    var _zoneLayer = null;
    var _zoneVertexHandles = [];
    var _editingZone = false;

    function _renderZonePolygon() {
        if (_zoneLayer) { _map.removeLayer(_zoneLayer); _zoneLayer = null; }
        if (_state.zonePolygon && _state.zonePolygon.length >= 3) {
            var ll = _state.zonePolygon.map(function (p) { return [p.lat, p.lon]; });
            _zoneLayer = L.polygon(ll, {
                color: '#3b82f6', weight: 2, fillOpacity: 0.10, dashArray: _editingZone ? null : '5,5'
            }).addTo(_map);
        }
    }

    function _seedZonePolygon() {
        var rv = window.currentRV || { lat: 0, lon: 0 };
        var dz = typeof getDZ === 'function' ? getDZ() : rv;
        var cosLat = Math.cos(dz.lat * Math.PI / 180);
        var dLat = function (m) { return m / 111320; };
        var dLon = function (m) { return m / (111320 * cosLat); };
        // Default rectangle 200×100 m centred on rv
        return [
            { lat: rv.lat + dLat(50),  lon: rv.lon - dLon(100) },
            { lat: rv.lat + dLat(50),  lon: rv.lon + dLon(100) },
            { lat: rv.lat - dLat(50),  lon: rv.lon + dLon(100) },
            { lat: rv.lat - dLat(50),  lon: rv.lon - dLon(100) }
        ];
    }

    function startEditZone() {
        if (!_map) return;
        if (_editingZone) { endEditZone(); return; }
        if (!_state.zonePolygon || _state.zonePolygon.length < 3) {
            _state.zonePolygon = _seedZonePolygon();
        }
        _editingZone = true;
        _zoneVertexHandles.forEach(function (m) { _map.removeLayer(m); });
        _zoneVertexHandles = [];
        _state.zonePolygon.forEach(function (pt, i) {
            var marker = L.marker([pt.lat, pt.lon], {
                draggable: true,
                icon: L.divIcon({
                    className: '',
                    html: '<div style="width:14px;height:14px;background:#3b82f6;border:2px solid #fff;' +
                        'border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>',
                    iconSize: [14, 14], iconAnchor: [7, 7]
                })
            }).addTo(_map);
            marker._idx = i;
            marker.on('drag dragend', function () {
                var ll = marker.getLatLng();
                _state.zonePolygon[i] = { lat: ll.lat, lon: ll.lng };
                save();
                _renderZonePolygon();
                if (typeof recompute === 'function') recompute();
            });
            _zoneVertexHandles.push(marker);
        });
        _renderZonePolygon();
        var btn = document.getElementById('btn_edit_zone');
        if (btn) btn.textContent = '✓ Terminer édition zone';
    }

    function endEditZone() {
        _editingZone = false;
        _zoneVertexHandles.forEach(function (m) { _map.removeLayer(m); });
        _zoneVertexHandles = [];
        _renderZonePolygon();
        var btn = document.getElementById('btn_edit_zone');
        if (btn) btn.textContent = 'Éditer zone de posé';
    }

    function resetZone() {
        if (!confirm('Effacer la zone de posé polygonale ?')) return;
        _state.zonePolygon = null;
        save();
        endEditZone();
        _renderZonePolygon();
    }

    function getZonePolygon() { return _state.zonePolygon; }
    function setZonePolygon(poly) { _state.zonePolygon = poly; save(); _renderZonePolygon(); }

    // ── NFZ vertex editing ─────────────────────────────────────
    var _nfzEditingPoly = null;      // editor-owned polygon for smooth live update

    function startEditNFZ(zoneId) {
        endEditNFZ();
        if (typeof NFZ === 'undefined' || !_map) return;
        var zone = NFZ.getZones().find(function (z) { return z.id === zoneId; });
        if (!zone) return;
        _editingNfzId = zoneId;

        // Hide the original NFZ polygon (it would lag behind during drag).
        // Our editor owns a dedicated polygon that mirrors zone.polygon and
        // updates instantly on every 'drag' event.
        NFZ.clearMapLayers(_map);
        var initialLL = zone.polygon.map(function (p) { return [p[1], p[0]]; });
        _nfzEditingPoly = L.polygon(initialLL, {
            color: zone.color, fillColor: zone.color,
            fillOpacity: 0.20, weight: 2,
            dashArray: zone.type === 'soft' ? '5,5' : null
        }).addTo(_map);

        zone.polygon.forEach(function (pt, i) {
            var marker = L.marker([pt[1], pt[0]], {
                draggable: true,
                icon: L.divIcon({
                    className: '',
                    html: '<div style="width:14px;height:14px;background:' + zone.color +
                        ';border:2px solid #fff;border-radius:50%;box-shadow:0 0 3px rgba(0,0,0,0.5);"></div>',
                    iconSize: [14, 14], iconAnchor: [7, 7]
                })
            }).addTo(_map);
            marker._vertexIdx = i;

            // Smooth live update on EVERY drag event — only updates the local
            // polygon layer's latlngs, no full NFZ rebuild.
            marker.on('drag', function () {
                var ll = marker.getLatLng();
                zone.polygon[i] = [ll.lng, ll.lat];
                if (_nfzEditingPoly) {
                    var ringLL = zone.polygon.map(function (p) { return [p[1], p[0]]; });
                    _nfzEditingPoly.setLatLngs(ringLL);
                }
            });

            // Full rebuild only at dragend so derived fields (_polyEN, _bbox)
            // and persistence stay correct without flicker mid-drag.
            marker.on('dragend', function () {
                var snapshot = NFZ.getZones().map(function (z) {
                    return {
                        id: z.id, name: z.name, type: z.type,
                        altMin: z.altMin, altMax: z.altMax,
                        polygon: z.polygon.map(function (p) { return p.slice(); })
                    };
                });
                var dz = typeof getDZ === 'function' ? getDZ() : { lat: 0, lon: 0 };
                NFZ.init(dz.lat, dz.lon);
                NFZ.clearZones();
                snapshot.forEach(function (zSrc) { NFZ.addZone(zSrc); });
                save();
                if (typeof recompute === 'function') recompute();
            });
            _nfzVertexHandles.push(marker);
        });
    }

    function endEditNFZ() {
        if (!_map) return;
        _nfzVertexHandles.forEach(function (m) { _map.removeLayer(m); });
        _nfzVertexHandles = [];
        if (_nfzEditingPoly) { _map.removeLayer(_nfzEditingPoly); _nfzEditingPoly = null; }
        _editingNfzId = null;
        // Restore the static NFZ rendering on map
        if (typeof NFZ !== 'undefined') NFZ.drawOnMap(_map);
    }

    // ── Evolution zone editing ─────────────────────────────────
    // The evolution zone is the area where the pilot bleeds altitude
    // BEFORE joining the landing circuit (downwindStart). It can be a
    // circle (center + radius) or a polygon (≥3 vertices). One per
    // pattern slot. Rendered in the slot's color.

    var _evoEditing = null;          // { slotKey, type } or null while editing
    var _evoLayers = [];             // map layers for the current edit session
    var _evoDisplayLayers = [];      // map layers for the static display

    function _seedEvolutionZone(slotKey, type) {
        // Anchor the seed at the pattern's downwindStart if known, else RV
        var pat = _state.patterns[slotKey];
        var anchor = (pat.waypoints && pat.waypoints.downwindStart) ||
            window.currentRV || { lat: 0, lon: 0 };
        var dz = typeof getDZ === 'function' ? getDZ() : anchor;
        var cosLat = Math.cos(dz.lat * Math.PI / 180);
        var dLat = function (m) { return m / 111320; };
        var dLon = function (m) { return m / (111320 * cosLat); };
        if (type === 'circle') {
            return { type: 'circle', center: { lat: anchor.lat, lon: anchor.lon }, radiusM: 200 };
        }
        return {
            type: 'polygon',
            vertices: [
                { lat: anchor.lat + dLat(150),  lon: anchor.lon - dLon(150) },
                { lat: anchor.lat + dLat(150),  lon: anchor.lon + dLon(150) },
                { lat: anchor.lat - dLat(150),  lon: anchor.lon + dLon(150) },
                { lat: anchor.lat - dLat(150),  lon: anchor.lon - dLon(150) }
            ]
        };
    }

    function _renderEvolutionZones() {
        if (!_map) return;
        _evoDisplayLayers.forEach(function (l) { _map.removeLayer(l); });
        _evoDisplayLayers = [];
        ['a', 'b'].forEach(function (k) {
            // Skip the slot currently being edited — its own editor layers
            // are already on the map and would visually clash.
            if (_evoEditing && _evoEditing.slotKey === k) return;
            var pat = _state.patterns[k];
            var ez = pat.evolutionZone;
            if (!ez) return;
            var color = pat.color;
            if (ez.type === 'circle' && ez.center && ez.radiusM > 0) {
                var c = L.circle([ez.center.lat, ez.center.lon], {
                    radius: ez.radiusM, color: color, weight: 1.5,
                    fillColor: color, fillOpacity: 0.06, dashArray: '5,4', interactive: false
                }).addTo(_map);
                _evoDisplayLayers.push(c);
            } else if (ez.type === 'polygon' && ez.vertices && ez.vertices.length >= 3) {
                var ll = ez.vertices.map(function (p) { return [p.lat, p.lon]; });
                var p = L.polygon(ll, {
                    color: color, weight: 1.5,
                    fillColor: color, fillOpacity: 0.06, dashArray: '5,4', interactive: false
                }).addTo(_map);
                _evoDisplayLayers.push(p);
            }
        });
    }

    function _clearEvoLayers() {
        _evoLayers.forEach(function (l) { _map.removeLayer(l); });
        _evoLayers = [];
    }

    function startEditEvolutionZone(slotKey, type) {
        if (!_map) return;
        endEditEvolutionZone();
        var pat = _state.patterns[slotKey];
        // Re-seed if not yet set OR if the user is switching shape.
        if (!pat.evolutionZone || pat.evolutionZone.type !== type) {
            pat.evolutionZone = _seedEvolutionZone(slotKey, type);
        }
        _evoEditing = { slotKey: slotKey, type: type };
        _renderEvolutionZones(); // hides the static rendering for this slot

        var ez = pat.evolutionZone;
        var color = pat.color;

        if (type === 'circle') {
            // Editor-owned L.circle that mirrors the data.
            var circ = L.circle([ez.center.lat, ez.center.lon], {
                radius: ez.radiusM, color: color, weight: 2,
                fillColor: color, fillOpacity: 0.12
            }).addTo(_map);
            _evoLayers.push(circ);

            // Center handle (drag = move whole circle)
            var centerMk = L.marker([ez.center.lat, ez.center.lon], {
                draggable: true,
                icon: L.divIcon({
                    className: '',
                    html: '<div style="width:14px;height:14px;background:' + color +
                        ';border:2px solid #fff;border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>',
                    iconSize: [14, 14], iconAnchor: [7, 7]
                })
            }).addTo(_map);
            _evoLayers.push(centerMk);

            // Radius handle (point on the circle, east of center). Drag =
            // change radius. Distance from center → radiusM in meters.
            var dz = typeof getDZ === 'function' ? getDZ() : ez.center;
            var cosLat = Math.cos(dz.lat * Math.PI / 180);
            function radiusEdge(centerLL, r) {
                return [centerLL.lat, centerLL.lon + r / (111320 * cosLat)];
            }
            var radiusMk = L.marker(radiusEdge(ez.center, ez.radiusM), {
                draggable: true,
                icon: L.divIcon({
                    className: '',
                    html: '<div style="width:12px;height:12px;background:#fff;border:2px solid ' +
                        color + ';border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>',
                    iconSize: [12, 12], iconAnchor: [6, 6]
                })
            }).addTo(_map);
            _evoLayers.push(radiusMk);

            centerMk.on('drag', function () {
                var ll = centerMk.getLatLng();
                ez.center = { lat: ll.lat, lon: ll.lng };
                circ.setLatLng([ll.lat, ll.lng]);
                radiusMk.setLatLng(radiusEdge(ez.center, ez.radiusM));
            });
            centerMk.on('dragend', function () { save(); if (typeof recompute === 'function') recompute(); });

            radiusMk.on('drag', function () {
                var rll = radiusMk.getLatLng();
                var dE = (rll.lng - ez.center.lon) * 111320 * cosLat;
                var dN = (rll.lat - ez.center.lat) * 111320;
                var r = Math.sqrt(dE * dE + dN * dN);
                ez.radiusM = Math.max(20, r);
                circ.setRadius(ez.radiusM);
            });
            radiusMk.on('dragend', function () { save(); if (typeof recompute === 'function') recompute(); });
        } else {
            // Polygon editor — same pattern as NFZ : own polygon layer +
            // per-vertex draggable handles with live setLatLngs() updates.
            var ringLL = ez.vertices.map(function (v) { return [v.lat, v.lon]; });
            var poly = L.polygon(ringLL, {
                color: color, weight: 2,
                fillColor: color, fillOpacity: 0.12
            }).addTo(_map);
            _evoLayers.push(poly);

            ez.vertices.forEach(function (v, i) {
                var mk = L.marker([v.lat, v.lon], {
                    draggable: true,
                    icon: L.divIcon({
                        className: '',
                        html: '<div style="width:12px;height:12px;background:' + color +
                            ';border:2px solid #fff;border-radius:50%;box-shadow:0 0 3px rgba(0,0,0,0.5);"></div>',
                        iconSize: [12, 12], iconAnchor: [6, 6]
                    })
                }).addTo(_map);
                mk.on('drag', function () {
                    var ll = mk.getLatLng();
                    ez.vertices[i] = { lat: ll.lat, lon: ll.lng };
                    var ring = ez.vertices.map(function (p) { return [p.lat, p.lon]; });
                    poly.setLatLngs(ring);
                });
                mk.on('dragend', function () { save(); if (typeof recompute === 'function') recompute(); });
                _evoLayers.push(mk);
            });
        }

        _refreshEvoButtonsLabel();
    }

    function endEditEvolutionZone() {
        if (!_map) { _evoEditing = null; return; }
        _clearEvoLayers();
        _evoEditing = null;
        _renderEvolutionZones();
        _refreshEvoButtonsLabel();
    }

    function clearEvolutionZone(slotKey) {
        if (!confirm("Effacer la zone d'évolution du circuit " + (slotKey === 'a' ? '1' : '2') + ' ?')) return;
        _state.patterns[slotKey].evolutionZone = null;
        if (_evoEditing && _evoEditing.slotKey === slotKey) endEditEvolutionZone();
        save();
        _renderEvolutionZones();
        _refreshEvoButtonsLabel();
    }

    function getEvolutionZone(slotKey) {
        return _state.patterns[slotKey] ? _state.patterns[slotKey].evolutionZone : null;
    }

    function _refreshEvoButtonsLabel() {
        ['a', 'b'].forEach(function (k) {
            ['circle', 'polygon'].forEach(function (t) {
                var btn = document.getElementById('btn_evo_' + k + '_' + t);
                if (!btn) return;
                var editingThis = _evoEditing && _evoEditing.slotKey === k && _evoEditing.type === t;
                var hasThis = _state.patterns[k].evolutionZone &&
                    _state.patterns[k].evolutionZone.type === t;
                btn.textContent = editingThis ? '✓ Terminer'
                    : (t === 'circle' ? '○ Cercle' : '▢ Poly') + (hasThis ? ' ✏' : '');
            });
        });
    }

    // ── Public API ─────────────────────────────────────────────
    function init(map) {
        _map = map;
        load();
        refreshDisplay();
        // Draw NFZ that were loaded from localStorage
        if (typeof NFZ !== 'undefined' && NFZ.getZones().length) {
            NFZ.drawOnMap(_map);
            // Refresh the NFZ list panel if it's already injected
            if (typeof UIOptimizer !== 'undefined' && typeof UIOptimizer.refreshNFZ === 'function') {
                UIOptimizer.refreshNFZ();
            }
        }
    }

    /** Get the user pattern best matching a given wind FROM angle (deg,
     *  compass). Each pattern's intended wind angle is derived from its
     *  final approach axis. Returns null if no pattern is defined. */
    function patternForWind(windFromDeg) {
        var d = ((windFromDeg % 360) + 360) % 360;
        var best = null, bestDist = Infinity;
        ['a', 'b'].forEach(function (k) {
            var pat = _state.patterns[k];
            if (!pat.waypoints) return;
            var patAngle = _patternWindFrom(pat);
            if (patAngle == null) return;
            var diff = Math.abs(d - patAngle);
            if (diff > 180) diff = 360 - diff;
            if (diff < bestDist) { bestDist = diff; best = pat; }
        });
        // Only return if reasonably close (within 90°)
        return (bestDist < 90) ? best : null;
    }

    function getPatterns() { return _state.patterns; }

    return {
        init: init,
        startEdit: startEdit,
        endEdit: endEdit,
        reset: reset,
        save: save,
        load: load,
        reload: reload,
        exportJSON: exportJSON,
        importJSON: importJSON,
        refreshDisplay: refreshDisplay,
        patternForWind: patternForWind,
        getPatterns: getPatterns,
        startEditNFZ: startEditNFZ,
        endEditNFZ: endEditNFZ,
        startEditZone: startEditZone,
        endEditZone: endEditZone,
        resetZone: resetZone,
        getZonePolygon: getZonePolygon,
        setZonePolygon: setZonePolygon,
        startEditEvolutionZone: startEditEvolutionZone,
        endEditEvolutionZone: endEditEvolutionZone,
        clearEvolutionZone: clearEvolutionZone,
        getEvolutionZone: getEvolutionZone,
        windLabel: _windLabel,
        patternWindFrom: _patternWindFrom
    };
})();
