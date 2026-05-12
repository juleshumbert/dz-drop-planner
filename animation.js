/**
 * ANIMATION / PLAYBACK ENGINE
 * Handles the live visualization of aircraft and jumpers
 */

var animTime = 0;
var isPlaying = false;
var animSpeed = 1.0;
var lastAnimTimestamp = 0;
var animFrameId = null;

var planeMarker = null;
var jumperMarkers = [];

function togglePlay() {
    isPlaying = !isPlaying;
    var btn = document.getElementById('play_btn');
    var icon = document.getElementById('play_icon');
    var text = document.getElementById('play_text');

    if (isPlaying) {
        if (btn) btn.classList.add('playing');
        if (icon) icon.textContent = '⏸';
        if (text) text.textContent = 'Pause';
        lastAnimTimestamp = performance.now();
        animFrameId = requestAnimationFrame(animLoop);
    } else {
        if (btn) btn.classList.remove('playing');
        if (icon) icon.textContent = '▶';
        if (text) text.textContent = 'Jouer';
        if (animFrameId) cancelAnimationFrame(animFrameId);
    }
}

function resetAnim() {
    animTime = 0;
    updateUI();
    updateMarkers();
    if (isPlaying) togglePlay();
}

function updateAnimSpeed() {
    animSpeed = parseFloat(document.getElementById('anim_speed').value) || 1.0;
    document.getElementById('speed_val').textContent = animSpeed.toFixed(1) + 'x';
}

function animLoop(timestamp) {
    if (!isPlaying) return;

    var dt = (timestamp - lastAnimTimestamp) / 1000;
    lastAnimTimestamp = timestamp;

    animTime += dt * animSpeed;

    // Boundary check (stop if all paras have landed + some margin)
    var maxT = window.maxSimTime || 0;
    if (animTime > maxT + 5) {
        animTime = maxT + 5;
        togglePlay();
    }

    updateUI();
    updateMarkers();
    if (typeof updateTransversalAnimation === 'function') updateTransversalAnimation(animTime);

    animFrameId = requestAnimationFrame(animLoop);
}

function updateUI() {
    document.getElementById('anim_time').textContent = animTime.toFixed(1).padStart(4, '0') + 's';

    if (!simResults) return;

    var maxT = window.maxSimTime || 1;
    var prog = (animTime / maxT) * 100;

    // Update progress bar
    document.getElementById('anim_progress').style.width = Math.min(100, prog) + '%';

    // Update slider if not playing (to avoid glitchy input feel while sliding)
    var slider = document.getElementById('anim_slider');
    if (slider) {
        slider.value = Math.min(100, (animTime / maxT) * 100);
    }

    // Phase detection
    if (animTime < simResults.delaiTopVert) {
        document.getElementById('anim_phase').textContent = 'Approche avion';
    } else {
        document.getElementById('anim_phase').textContent = 'Largage / Descente';
    }
}

function onSliderChange(val) {
    if (!simResults) return;
    var maxT = window.maxSimTime || 1;
    animTime = (parseFloat(val) / 100) * maxT;

    // If playing, we pause to allow precise seek
    if (isPlaying) togglePlay();

    updateUI();
    updateMarkers();
    if (typeof updateTransversalAnimation === 'function') updateTransversalAnimation(animTime);
}

function seekAnim(e) {
    if (!simResults) return;
    var container = document.getElementById('anim_timeline_container');
    var rect = container.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var pct = (x / rect.width) * 100;
    onSliderChange(pct);
}

function updateMarkers() {
    if (!simResults || !map) return;

    // 1. Plane Position
    // T=0 is Green Light
    var planeE = simResults.greenLightE + simResults.trackE * simResults.gsMs * animTime;
    var planeN = simResults.greenLightN + simResults.trackN * simResults.gsMs * animTime;
    var planeLL = toLL({ e: planeE, n: planeN });

    if (!planeMarker) {
        var planeIcon = L.divIcon({
            className: '',
            html: '<div class="plane-icon" style="font-size:32px; transform:rotate(' + (simResults.axe - 90) + 'deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">✈️</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
        planeMarker = L.marker(planeLL, { icon: planeIcon, zIndexOffset: 2000 }).addTo(map);
    } else {
        planeMarker.setLatLng(planeLL);
        var el = planeMarker.getElement();
        if (el) {
            var iconDiv = el.querySelector('.plane-icon');
            if (iconDiv) iconDiv.style.transform = 'rotate(' + (simResults.axe - 90) + 'deg)';
        }
    }

    // Stop plane if after red light + margin
    var planeAlong = planeE * simResults.trackE + planeN * simResults.trackN;
    if (planeAlong > simResults.redLightAlongTrack + 2000) {
        planeMarker.setOpacity(0);
    } else {
        planeMarker.setOpacity(1);
    }

    // 2. Jumpers
    var n = simResults.timedTrajs.length;
    // Remove excess markers if the number of jumpers decreased
    while (jumperMarkers.length > n) {
        var oldM = jumperMarkers.pop();
        map.removeLayer(oldM);
    }
    // Add new markers if increased
    while (jumperMarkers.length < n) {
        var jIdx = jumperMarkers.length;
        // Use the color from the source trajectory
        var col = simResults.trajectories[jIdx].color || '#fff';
        var m = L.marker([0, 0], {
            icon: L.divIcon({
                className: '',
                html: '<div style="width:12px; height:12px; background:' + col + '; border:2px solid #fff; border-radius:50%; box-shadow:0 0 6px rgba(0,0,0,0.5); font-size:8px; display:flex; align-items:center; justify-content:center; color:#000; font-weight:bold;">' + (jIdx + 1) + '</div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            }),
            zIndexOffset: 1500
        }).addTo(map);
        jumperMarkers.push(m);
    }

    simResults.timedTrajs.forEach((timed, i) => {
        var pos = posAtTime(timed, animTime);
        var m = jumperMarkers[i];
        if (!pos) {
            m.setOpacity(0);
        } else {
            m.setOpacity(1);
            m.setLatLng(toLL({ e: pos.x, n: pos.y }));

            // Adjust icon based on phase
            var col = simResults.trajectories[i].color || '#fff';
            var html = '';

            if (pos.phase === 'ff') {
                // Freefall: colored circle
                html = '<div style="width:14px; height:14px; background:' + col + '; border:2px solid #fff; border-radius:50%; font-size:9px; display:flex; align-items:center; justify-content:center; color:#000; font-weight:900; box-shadow:0 1px 3px rgba(0,0,0,0.4);">' + (i + 1) + '</div>';
            } else if (pos.phase === 'opening') {
                // Opening: square
                html = '<div style="width:18px; height:18px; background:#fff; border:2px solid ' + col + '; border-radius:3px; font-size:9px; display:flex; align-items:center; justify-content:center; color:#000; font-weight:900; box-shadow:0 1px 5px rgba(0,0,0,0.4);">' + (i + 1) + '</div>';
            } else {
                // Canopy: Parachute icon
                html = '<div style="width:24px; height:24px; background:' + col + '; border:2px solid #fff; border-radius:4px; font-size:12px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; text-shadow:0 0 2px #000; box-shadow:0 2px 6px rgba(0,0,0,0.5);">🪂</div>';
            }
            m.setIcon(L.divIcon({ className: '', html: html, iconSize: [24, 24], iconAnchor: [12, 12] }));
        }
    });
}

// Ensure markers are created/updated when simulation finishes
// NOTE: the master `window.onSimulationComplete` is defined in index.html
// (it updates KPI pills, verdict badge, etc.) and calls updateMarkers() itself.
// Exposing updateMarkers globally here so that handler can invoke it.
window.updateAnimationMarkers = updateMarkers;
