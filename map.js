// ================================================================
//  MAP — Leaflet Map Logic
//  initMap, updateMapDZ, drawMapResults
// ================================================================

function initMap() {
    var dz = getDZ();
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([dz.lat, dz.lon], 14);
    window._map = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: ''
    }).addTo(map);
    drawnItems = L.layerGroup().addTo(map);

    // Initialise the pattern editor (loads saved patterns from localStorage,
    // renders them as light dashed polylines on the map for visual reference).
    if (typeof PatternEditor !== 'undefined') {
        PatternEditor.init(map);
    }

    // --- INTERACTION HANDLING ---
    // Create a style element for interaction axis behavior
    var style = document.createElement('style');
    style.innerHTML = `
        /* Interaction pane: the DIV itself must not block mouse events */
        .leaflet-interactionPane-pane { pointer-events: none !important; }
        /* Default: pass through events on the path */
        path.interaction-axis { pointer-events: none !important; }
        /* When Ctrl is held: the DIV and path capture events */
        .leaflet-container.ctrl-pressed .leaflet-interactionPane-pane { pointer-events: auto !important; }
        .leaflet-container.ctrl-pressed path.interaction-axis { pointer-events: auto !important; cursor: crosshair !important; }
    `;
    document.head.appendChild(style);

    // Global event listeners for Ctrl key
    window.addEventListener('keydown', function (e) {
        if (e.key === 'Control' || e.ctrlKey) {
            map.getContainer().classList.add('ctrl-pressed');
        }
    });
    window.addEventListener('keyup', function (e) {
        if (e.key === 'Control' || !e.ctrlKey) {
            map.getContainer().classList.remove('ctrl-pressed');
        }
    });
    // Ensure state is cleared if window loses focus
    window.addEventListener('blur', function () {
        map.getContainer().classList.remove('ctrl-pressed');
    });

    updateMapDZ(dz);
}

function updateMapDZ(dz) {
    if (!map) return;
    map.setView([dz.lat, dz.lon], 14);
    if (dzMarker) { map.removeLayer(dzMarker); dzMarker = null; }
    if (greenMarker) { map.removeLayer(greenMarker); greenMarker = null; }
    if (redMarker) { map.removeLayer(redMarker); redMarker = null; }

    if (targetMarker) map.removeLayer(targetMarker);
    targetMarker = L.marker([currentTarget.lat, currentTarget.lon], {
        draggable: true,
        icon: L.divIcon({ className: '', html: '<div style="font-size:24px">🚩</div>', iconSize: [26, 26], iconAnchor: [13, 13] })
    }).addTo(map).bindTooltip('🚩 Cible — régler via le panneau lat/lon', { direction: 'top' });

    targetMarker.on('dragstart', function () { window._isDragging = true; });
    targetMarker.on('drag', function (e) {
        var ll = e.latlng;
        currentTarget.lat = ll.lat;
        currentTarget.lon = ll.lng;
        document.getElementById('target_lat').value = ll.lat.toFixed(4);
        document.getElementById('target_lon').value = ll.lng.toFixed(4);
        recompute(); // Light update (UI and axis lines)
    });
    targetMarker.on('dragend', function () {
        window._isDragging = false;
        runSimulation();
    });

    if (rvMarker) { map.removeLayer(rvMarker); rvMarker = null; }
    if (rvZoneRect) { map.removeLayer(rvZoneRect); rvZoneRect = null; }
    // Legacy rectangle and bullseye target removed — landing zone is now
    // exclusively the polygon defined via PatternEditor (visible as a
    // dashed blue polygon on the map). The pattern target = polygon centroid.
}

function drawMapResults() {
    if (!simResults || !map) return;

    // Ensure panes exist BEFORE any marker is created
    if (!map.getPane('interactionPane')) {
        map.createPane('interactionPane');
        map.getPane('interactionPane').style.zIndex = 620;
        map.getPane('interactionPane').style.pointerEvents = 'none';
    }
    if (!map.getPane('markerTopPane')) {
        map.createPane('markerTopPane');
        map.getPane('markerTopPane').style.zIndex = 650;
    }

    drawnItems.clearLayers();
    var dz = simResults.dz;
    var targetE = simResults.targetE;
    var targetN = simResults.targetN;


    var colors = SIM_COLORS;

    if (axisRotHandle) { map.removeLayer(axisRotHandle); axisRotHandle = null; }
    if (axisOffHandle) { map.removeLayer(axisOffHandle); axisOffHandle = null; }

    // Jump run axis
    var first = simResults.positions[0];
    var last = simResults.positions[simResults.positions.length - 1];
    var ext = 2500;
    var jrS = toLL({ e: first.exit.e - simResults.trackE * ext, n: first.exit.n - simResults.trackN * ext });
    var jrE = toLL({ e: last.exit.e + simResults.trackE * ext, n: last.exit.n + simResults.trackN * ext });

    L.polyline([jrS, jrE], { color: '#475569', weight: 2, dashArray: '8,6', opacity: 0.6, interactive: false }).addTo(drawnItems);

    // Feux de largage
    if (simResults.greenLightE != null) {
        var topPos = toLL({ e: simResults.greenLightE, n: simResults.greenLightN });
        if (!greenMarker) {
            greenMarker = L.marker(topPos, {
                draggable: true,
                icon: L.divIcon({ className: '', html: '<div style="font-size:28px;line-height:1;cursor:grab">🟢</div>', iconSize: [28, 28], iconAnchor: [14, 14] }),
                pane: 'markerTopPane',
                zIndexOffset: 2000
            }).addTo(map);

            greenMarker.on('dragstart', function () { window._isDragging = true; window._isDraggingGreen = true; });
            greenMarker.on('drag', function (e) {
                if (!simResults) return;
                var ll = e.target.getLatLng();
                var dz_g = simResults.dz;
                var cosLat = Math.cos(ll.lat * Math.PI / 180);
                var gE = (ll.lng - dz_g.lon) * 111320 * cosLat;
                var gN = (ll.lat - dz_g.lat) * 111320;

                // 1. Calculate the new position along the axis
                var newGreenAlong = gE * simResults.trackE + gN * simResults.trackN;
                var targetAlong = simResults.targetE * simResults.trackE + simResults.targetN * simResults.trackN;
                var distM = newGreenAlong - targetAlong;
                var nmVal = distM / 1852;

                // 2. Snap the marker to the current axis (keeping the transverse offset constant)
                var currentOff = simResults.targetE * simResults.trackN - simResults.targetN * simResults.trackE;
                var snappedE = (targetAlong + distM) * simResults.trackE + currentOff * simResults.trackN;
                var snappedN = (targetAlong + distM) * simResults.trackN - currentOff * simResults.trackE;

                var cosLatDZ = Math.cos(dz_g.lat * Math.PI / 180);
                greenMarker.setLatLng([dz_g.lat + snappedN / 111320, dz_g.lon + snappedE / (111320 * cosLatDZ)]);

                var topEl = document.getElementById('top_largage_nm');
                if (topEl) {
                    topEl.value = nmVal.toFixed(2);

                    var gsMs = simResults.gsMs || 60;
                    var timeS = gsMs > 0 ? distM / gsMs : 0;
                    var label = isNaN(nmVal)
                        ? '🟢 Top largage'
                        : '🟢 Top: ' + (nmVal > 0 ? '+' : '') + nmVal.toFixed(2) + ' NM / ' + (timeS > 0 ? '+' : '') + timeS.toFixed(1) + 's';

                    if (greenMarker.getTooltip()) {
                        greenMarker.setTooltipContent(label);
                    } else {
                        greenMarker.bindTooltip(label, { direction: 'left', permanent: false });
                    }
                    greenMarker.openTooltip();
                    recompute();
                }
            });
            greenMarker.on('dragend', function () {
                window._isDragging = false;
                window._isDraggingGreen = false;
                runSimulation();
            });
        } else {
            if (!window._isDraggingGreen) {
                greenMarker.setLatLng(topPos);
            }
        }
        var distM = (simResults.greenLightAlongTrack || 0) - (simResults.targetAlongTrack || 0);
        var distNm = distM / 1852;
        var gsMs = simResults.gsMs || 60;
        var timeS = gsMs > 0 ? distM / gsMs : 0;
        var label = isNaN(distNm)
            ? '🟢 Top largage'
            : '🟢 Top: ' + (distNm > 0 ? '+' : '') + distNm.toFixed(2) + ' NM / ' + (timeS > 0 ? '+' : '') + timeS.toFixed(1) + 's';

        if (greenMarker.getTooltip()) {
            greenMarker.setTooltipContent(label);
        } else {
            greenMarker.bindTooltip(label, { direction: 'left' });
        }

        var finPos = toLL({ e: simResults.redLightE, n: simResults.redLightN });
        if (!redMarker) {
            redMarker = L.marker(finPos, {
                icon: L.divIcon({ className: '', html: '<div style="font-size:28px;line-height:1">🔴</div>', iconSize: [28, 28], iconAnchor: [14, 14] }),
                zIndexOffset: 1000
            }).addTo(map);
        } else {
            redMarker.setLatLng(finPos);
        }
        redMarker.unbindTooltip().bindTooltip('🔴 Fin Largage (sortie P' + simResults.positions.length + ')', { direction: 'right' });
    } else {
        if (greenMarker) { map.removeLayer(greenMarker); greenMarker = null; }
        if (redMarker) { map.removeLayer(redMarker); redMarker = null; }
    }

    // Draw each trajectory
    simResults.trajectories.forEach(function (t, i) {
        try {
            var col = colors[i % colors.length];
            var pos = simResults.positions[i];
            var elevM = simResults.elevM;

            var ffLL = (t.ff || []).map(stateToLL).filter(function (p) { return !isNaN(p[0]) && !isNaN(p[1]); });
            if (ffLL.length >= 2) L.polyline(ffLL, { color: col, weight: 4, opacity: 1.0 }).addTo(drawnItems);

            var opLL = (t.opening || []).map(stateToLL).filter(function (p) { return !isNaN(p[0]) && !isNaN(p[1]); });
            if (opLL.length >= 2) L.polyline(opLL, { color: col, weight: 4.5, opacity: 0.8, dashArray: '1,5', lineCap: 'round' }).addTo(drawnItems);

            var tPilot = parseFloat(document.getElementById('t_pilot_common').value) || 8;
            var pilotLen = Math.floor(tPilot / 1.0);
            var canopyPilot = (t.canopy || []).slice(0, pilotLen + 1);
            var canopyRide = (t.canopy || []).slice(Math.max(0, pilotLen));

            // Phase 1 (perpendicular hold) — distinct dash pattern.
            var pilotLL = canopyPilot.map(stateToLL).filter(function (p) { return !isNaN(p[0]) && !isNaN(p[1]); });
            if (pilotLL.length >= 2) L.polyline(pilotLL, { color: col, weight: 5, opacity: 0.85, dashArray: '10,5' }).addTo(drawnItems);

            // Phase 2 (canopy navigation) — segment by piloting mode.
            // Each mode gets a distinct dash pattern so the user sees at a
            // glance when the pilot uses rear risers, brakes, or flare.
            //   TRIM        : solid                            (plein vol)
            //   BEST_GLIDE  : long dash      dashArray '14,4'  (arrière, finesse air +18%)
            //   MIN_SINK    : dotted         dashArray '2,4'   (freins ½, max temps en l'air)
            //   FLARE       : dense short dash dashArray '4,2' weight+ (touchdown deep brakes)
            var MODE_STYLES = {
                TRIM:       { dashArray: null,    weight: 3, opacity: 0.85 },
                BEST_GLIDE: { dashArray: '14,4',  weight: 3, opacity: 0.85 },
                MIN_SINK:   { dashArray: '2,4',   weight: 3, opacity: 0.90 },
                FLARE:      { dashArray: '4,2',   weight: 5, opacity: 1.00 }
            };
            // Walk the canopy ride and emit a polyline whenever the mode
            // changes. Repeat the boundary point so segments connect.
            var seg = [], curMode = null;
            for (var ri = 0; ri < canopyRide.length; ri++) {
                var s = canopyRide[ri];
                var ll = stateToLL(s);
                if (isNaN(ll[0]) || isNaN(ll[1])) continue;
                var m = s._mode || 'TRIM';
                if (curMode === null) curMode = m;
                if (m !== curMode) {
                    // close previous segment with a connecting point
                    seg.push(ll);
                    if (seg.length >= 2) {
                        var st = MODE_STYLES[curMode] || MODE_STYLES.TRIM;
                        var opts = { color: col, weight: st.weight, opacity: st.opacity };
                        if (st.dashArray) opts.dashArray = st.dashArray;
                        L.polyline(seg, opts).addTo(drawnItems);
                    }
                    seg = [ll];
                    curMode = m;
                } else {
                    seg.push(ll);
                }
            }
            if (seg.length >= 2) {
                var st2 = MODE_STYLES[curMode || 'TRIM'] || MODE_STYLES.TRIM;
                var opts2 = { color: col, weight: st2.weight, opacity: st2.opacity };
                if (st2.dashArray) opts2.dashArray = st2.dashArray;
                L.polyline(seg, opts2).addTo(drawnItems);
            }

            var exitLL = toLL(pos.exit);
            L.circleMarker(exitLL, { radius: 5, color: col, fillColor: col, fillOpacity: 1, weight: 2 })
                .addTo(drawnItems).bindTooltip('P' + (i + 1) + ' — Chute', { direction: 'top' });

            var openLL = toLL(pos.open);
            L.circleMarker(openLL, { radius: 5, color: col, fillColor: '#fff', fillOpacity: 0.9, weight: 2.5 })
                .addTo(drawnItems).bindTooltip('P' + (i + 1) + ' — Ouverture');

            var landLL = toLL(pos.land);
            var numHtml = '<div style="background:' + col + '; color:white; width:22px; height:22px; border-radius:50%; text-align:center; line-height:22px; font-weight:900; font-size:12px; border:2px solid white; box-shadow:0 0 4px rgba(0,0,0,0.5);">' + (i + 1) + '</div>';
            L.marker(landLL, {
                icon: L.divIcon({ className: '', html: numHtml, iconSize: [22, 22], iconAnchor: [11, 11] })
            }).addTo(drawnItems).bindTooltip('P' + (i + 1) + ' Land', { direction: 'right' });

            if (pos.pos300) {
                var ll300 = toLL(pos.pos300);
                L.circleMarker(ll300, { radius: 4, color: col, fillColor: '#fff', fillOpacity: 1, weight: 2 })
                    .addTo(drawnItems).bindTooltip('300m AGL', { direction: 'top' });
            }
        } catch (err) {
            console.warn('drawMapResults: erreur P' + (i + 1) + ':', err);
        }
    });

    // Min distance display on map is intentionally not shown (visible in cross-section chart only)

    // Legacy rectangle drawing removed — landing zone is now exclusively
    // the polygon defined via PatternEditor.

    // --- RE-INSERT INTERACTION AXIS AT THE TOP ---
    var interactionAxis = L.polyline([jrS, jrE], {
        color: '#334155',
        weight: 60,
        opacity: 0.0,
        interactive: true,
        className: 'interaction-axis',
        pane: 'interactionPane'
    }).addTo(drawnItems);

    // Visual line
    var visualAxis = L.polyline([jrS, jrE], { color: '#475569', weight: 2, dashArray: '8,6', opacity: 0.6, interactive: false }).addTo(drawnItems);

    var stop = function (e) {
        if (e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
            L.DomEvent.preventDefault(e.originalEvent);
        } else {
            L.DomEvent.stopPropagation(e);
        }
    };

    function getMouseEN(e) {
        var ll = e.latlng || map.mouseEventToLatLng(e.originalEvent || e);
        var dz_r = simResults.dz;
        var cosLat = Math.cos(dz_r.lat * Math.PI / 180);
        return {
            e: (ll.lng - dz_r.lon) * 111320 * cosLat,
            n: (ll.lat - dz_r.lat) * 111320
        };
    }

    interactionAxis.on('mousedown', function (e) {
        if (!e.originalEvent.ctrlKey) return; // ONLY move if Ctrl is held
        stop(e);
        var isRight = (e.originalEvent.button === 2);
        window._axisDragging = isRight ? 'offset' : 'rotation';
        window._isDragging = true;
        map.dragging.disable();
        // Store start angle for delta-rotation (avoids 180° jump)
        if (!isRight) {
            var dz_md = simResults.dz;
            var mouse0 = getMouseEN(e);
            var t0E = (currentTarget.lon - dz_md.lon) * 111320 * Math.cos(dz_md.lat * Math.PI / 180);
            var t0N = (currentTarget.lat - dz_md.lat) * 111320;
            window._axisStartAngle = parseFloat(document.getElementById('axe_largage').value) || 0;
            window._mouseStartAngle = (Math.atan2(mouse0.e - t0E, mouse0.n - t0N) * 180 / Math.PI + 360) % 360;
        }
    });

    map.on('mousemove', function (e) {
        if (!window._axisDragging) return;

        var mouse = getMouseEN(e);
        var dz_r = simResults.dz;
        var rawTargetE = (currentTarget.lon - dz_r.lon) * 111320 * Math.cos(dz_r.lat * Math.PI / 180);
        var rawTargetN = (currentTarget.lat - dz_r.lat) * 111320;

        var previewTrackE, previewTrackN, previewTargetE, previewTargetN;

        if (window._axisDragging === 'rotation') {
            var dE = mouse.e - rawTargetE, dN = mouse.n - rawTargetN;
            if (Math.sqrt(dE * dE + dN * dN) < 20) return;
            // Delta approach: rotate from start angle by the angular displacement of the mouse
            var currentMouseAngle = (Math.atan2(dE, dN) * 180 / Math.PI + 360) % 360;
            var delta = currentMouseAngle - window._mouseStartAngle;
            // Normalise delta to [-180, 180]
            while (delta > 180) delta -= 360;
            while (delta < -180) delta += 360;
            var newAxe = ((window._axisStartAngle + delta) % 360 + 360) % 360;
            newAxe = Math.round(newAxe);
            // Visual only — no recompute
            updateAxisAngle(newAxe);
            var axeRad = newAxe * Math.PI / 180;
            previewTrackE = Math.sin(axeRad);
            previewTrackN = Math.cos(axeRad);
            // Reproject cross-track offset onto new axis direction
            var crossNm = parseFloat(document.getElementById('cross_track_nm').value) || 0;
            var crossM = crossNm * 1852;
            previewTargetE = rawTargetE + crossM * previewTrackN;
            previewTargetN = rawTargetN - crossM * previewTrackE;
        } else {
            var currentAxe = parseFloat(document.getElementById('axe_largage').value) || 0;
            var axeRad2 = currentAxe * Math.PI / 180;
            previewTrackE = Math.sin(axeRad2);
            previewTrackN = Math.cos(axeRad2);
            var dE2 = mouse.e - rawTargetE, dN2 = mouse.n - rawTargetN;
            // Project mouse displacement onto the perpendicular
            var newCrossM = dE2 * previewTrackN + dN2 * (-previewTrackE);
            document.getElementById('cross_track_nm').value = (newCrossM / 1852).toFixed(2);
            previewTargetE = rawTargetE + newCrossM * previewTrackN;
            previewTargetN = rawTargetN - newCrossM * previewTrackE;
        }

        // UPDATE VISUALS ONLY — no simulation during drag
        var ext = 4000;
        var sLL = toLL({ e: previewTargetE - previewTrackE * ext, n: previewTargetN - previewTrackN * ext });
        var eLL = toLL({ e: previewTargetE + previewTrackE * ext, n: previewTargetN + previewTrackN * ext });
        visualAxis.setLatLngs([sLL, eLL]);
        interactionAxis.setLatLngs([sLL, eLL]);

        // Move green/red markers approximately along the new axis
        var topNm = parseFloat(document.getElementById('top_largage_nm').value) || 0;
        var delaiS = parseFloat(document.getElementById('delai_top_vert').value) || 5;
        var gsMs = simResults.gsMs || 60;
        var distTopM = topNm * 1852;
        var glE = previewTargetE + previewTrackE * distTopM;
        var glN = previewTargetN + previewTrackN * distTopM;
        if (greenMarker) greenMarker.setLatLng(toLL({ e: glE, n: glN }));
        var dtSortie = simResults.dtSortie || 5;
        var nPara = simResults.positions ? simResults.positions.length : 1;
        var rlE = glE + previewTrackE * (delaiS + (nPara - 1) * dtSortie) * gsMs;
        var rlN = glN + previewTrackN * (delaiS + (nPara - 1) * dtSortie) * gsMs;
        if (redMarker) redMarker.setLatLng(toLL({ e: rlE, n: rlN }));
    });

    var finishDrag = function () {
        if (window._axisDragging) {
            window._axisDragging = null;
            window._isDragging = false;
            map.dragging.enable();
            recompute(); // Updates speed/heading displays then runs full simulation
        }
    };
    window.addEventListener('mouseup', finishDrag);
    map.on('mouseup', finishDrag);

    var allLL = simResults.positions.reduce(function (a, p) { return a.concat([toLL(p.exit), toLL(p.land)]); }, []);
    allLL.push([dz.lat, dz.lon]);
    allLL.push([currentTarget.lat, currentTarget.lon]);
    allLL.push([currentRV.lat, currentRV.lon]);
}

function toLL(en) {
    if (!en || isNaN(en.e) || isNaN(en.n)) return [0, 0];
    var dz = getDZ();
    return [dz.lat + en.n / 111320, dz.lon + en.e / (111320 * Math.cos(dz.lat * Math.PI / 180))];
}
function stateToLL(s) {
    var dz = getDZ();
    return [dz.lat + s[1] / 111320, dz.lon + s[0] / (111320 * Math.cos(dz.lat * Math.PI / 180))];
}
