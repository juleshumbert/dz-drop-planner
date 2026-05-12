// ================================================================
//  NFZ.JS — No-Fly Zone system
//  Polygonal zones with altitude bounds, drawn on Leaflet
// ================================================================
var NFZ = (function () {
    'use strict';

    var _zones = [];
    var _dzLat = 0, _dzLon = 0, _cosLat = 1;
    var _leafletLayers = [];

    function init(dzLat, dzLon) {
        _dzLat = dzLat;
        _dzLon = dzLon;
        _cosLat = Math.cos(dzLat * Math.PI / 180);
    }

    function _lonlatToEN(lon, lat) {
        return {
            e: (lon - _dzLon) * 111320 * _cosLat,
            n: (lat - _dzLat) * 111320
        };
    }

    function addZone(opts) {
        var z = {
            id: opts.id || ('nfz_' + Date.now()),
            name: opts.name || 'Zone ' + _zones.length,
            type: opts.type || 'hard',     // 'hard' = interdit, 'soft' = warning
            altMin: opts.altMin || 0,
            altMax: opts.altMax || 99999,
            polygon: opts.polygon,         // array of [lon, lat]
            color: opts.type === 'hard' ? '#ef4444' : '#f59e0b',
            _polyEN: [],
            _bbox: null
        };

        z._polyEN = z.polygon.map(function (p) { return _lonlatToEN(p[0], p[1]); });

        var es = z._polyEN.map(function (p) { return p.e; });
        var ns = z._polyEN.map(function (p) { return p.n; });
        z._bbox = {
            minE: Math.min.apply(null, es) - 50,
            maxE: Math.max.apply(null, es) + 50,
            minN: Math.min.apply(null, ns) - 50,
            maxN: Math.max.apply(null, ns) + 50
        };
        _zones.push(z);
        return z;
    }

    function removeZone(id) {
        _zones = _zones.filter(function (z) { return z.id !== id; });
    }

    function getZones() { return _zones; }
    function clearZones() { _zones = []; }

    // Ray-casting point-in-polygon
    function pointInPoly(e, n, poly) {
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

    function distToPolyEdge(e, n, poly) {
        var minD = Infinity;
        for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            var pi = poly[i], pj = poly[j];
            var dx = pj.e - pi.e, dy = pj.n - pi.n;
            var len2 = dx * dx + dy * dy;
            var t = len2 > 0 ? Math.max(0, Math.min(1, ((e - pi.e) * dx + (n - pi.n) * dy) / len2)) : 0;
            var cx = pi.e + t * dx - e, cy = pi.n + t * dy - n;
            var d = Math.sqrt(cx * cx + cy * cy);
            if (d < minD) minD = d;
        }
        return minD;
    }

    /**
     * Check a trajectory against all (or given) NFZ.
     * Returns { violated, details: [{zoneId, zoneName, type, minDist, entryT}] }
     */
    function checkTrajectory(sp, zoneList) {
        zoneList = zoneList || _zones;
        var details = [];
        var violated = false;

        for (var zi = 0; zi < zoneList.length; zi++) {
            var z = zoneList[zi];
            var zMinDist = Infinity, entryT = null;

            for (var ti = 0; ti < sp.length; ti++) {
                var pt = sp[ti];
                var alt = pt.z !== undefined ? pt.z : 0;
                if (alt < z.altMin || alt > z.altMax) continue;

                var pe = pt.x !== undefined ? pt.x : 0;
                var pn = pt.y !== undefined ? pt.y : 0;

                var bb = z._bbox;
                if (pe < bb.minE || pe > bb.maxE || pn < bb.minN || pn > bb.maxN) {
                    var de = Math.max(bb.minE - pe, 0, pe - bb.maxE);
                    var dn = Math.max(bb.minN - pn, 0, pn - bb.maxN);
                    var d = Math.sqrt(de * de + dn * dn);
                    if (d < zMinDist) zMinDist = d;
                    continue;
                }

                if (pointInPoly(pe, pn, z._polyEN)) {
                    zMinDist = 0;
                    if (entryT === null) entryT = pt.t || 0;
                } else {
                    var d2 = distToPolyEdge(pe, pn, z._polyEN);
                    if (d2 < zMinDist) zMinDist = d2;
                }
            }

            if (zMinDist === 0 && z.type === 'hard') violated = true;
            details.push({
                zoneId: z.id, zoneName: z.name, type: z.type,
                minDist: zMinDist, entryT: entryT,
                violated: zMinDist === 0 && z.type === 'hard'
            });
        }

        return { violated: violated, details: details };
    }

    // ── LEAFLET RENDERING ──────────────────────────────────────

    function drawOnMap(map) {
        if (!map || typeof L === 'undefined') return;
        _leafletLayers.forEach(function (l) { map.removeLayer(l); });
        _leafletLayers = [];

        _zones.forEach(function (z) {
            var latLngs = z.polygon.map(function (p) { return [p[1], p[0]]; });
            var poly = L.polygon(latLngs, {
                color: z.color,
                fillColor: z.color,
                fillOpacity: 0.15,
                weight: 2,
                dashArray: z.type === 'soft' ? '5,5' : null
            }).addTo(map);
            poly.bindTooltip(
                '<b>' + z.name + '</b> (' + z.type + ')<br>' + z.altMin + '–' + z.altMax + 'm AMSL',
                { sticky: true }
            );
            _leafletLayers.push(poly);
        });
    }

    function clearMapLayers(map) {
        if (!map) return;
        _leafletLayers.forEach(function (l) { map.removeLayer(l); });
        _leafletLayers = [];
    }

    // ── SERIALIZABLE FORMAT FOR WORKERS ───────────────────────
    function serialize() {
        return _zones.map(function (z) {
            return {
                id: z.id, name: z.name, type: z.type,
                altMin: z.altMin, altMax: z.altMax,
                _polyEN: z._polyEN, _bbox: z._bbox
            };
        });
    }

    return {
        init: init,
        addZone: addZone,
        removeZone: removeZone,
        getZones: getZones,
        clearZones: clearZones,
        checkTrajectory: checkTrajectory,
        drawOnMap: drawOnMap,
        clearMapLayers: clearMapLayers,
        serialize: serialize,
        pointInPoly: pointInPoly,
        distToPolyEdge: distToPolyEdge
    };
})();

if (typeof module !== 'undefined') module.exports = NFZ;
