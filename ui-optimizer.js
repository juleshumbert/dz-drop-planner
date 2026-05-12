// ================================================================
//  UI-OPTIMIZER.JS — NFZ panel, MC settings, optimizer button,
//                    results display, ellipse rendering
//  Depends on: physics-core.js, nfz.js, monte-carlo.js,
//              optimizer-v3.js, app.js (getDZ, jumpersList, etc.)
// ================================================================
(function () {
    'use strict';

    // ── HTML injection ─────────────────────────────────────────
    function injectUI(containerId) {
        var ctn = document.getElementById(containerId);
        if (!ctn) return;

        ctn.innerHTML =
            // ── PATTERN EDITOR ──
            '<div class="border border-slate-700 rounded-xl p-3 mb-3 bg-slate-900/50">' +
            '  <div class="flex items-center justify-between mb-2">' +
            '    <span class="text-[10px] font-black uppercase tracking-wider text-amber-400">🛬 Circuits d\'atterrissage</span>' +
            '    <span class="text-[9px] text-slate-500">selon vent au sol</span>' +
            '  </div>' +
            '  <div class="grid grid-cols-2 gap-1 mb-1">' +
            '    <button id="btn_edit_a" class="text-[9px] bg-amber-700 hover:bg-amber-600 text-white px-2 py-1 rounded font-bold">Éditer circuit 1</button>' +
            '    <button id="btn_edit_b" class="text-[9px] bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded font-bold">Éditer circuit 2</button>' +
            '  </div>' +
            '  <div class="grid grid-cols-2 gap-1 mb-1 text-[8px]">' +
            '    <span class="text-slate-500">Circuit 1 : <span id="pattern_label_a" class="font-bold">non défini</span></span>' +
            '    <span class="text-slate-500">Circuit 2 : <span id="pattern_label_b" class="font-bold">non défini</span></span>' +
            '  </div>' +
            '  <div class="grid grid-cols-2 gap-1 mb-2">' +
            '    <button id="btn_reset_a" class="text-[8px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded">Reset 1</button>' +
            '    <button id="btn_reset_b" class="text-[8px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded">Reset 2</button>' +
            '  </div>' +
            // Evolution zones (per circuit). Optional altitude-bleeding area.
            '  <div class="border-t border-slate-700 pt-2 mb-2">' +
            '    <div class="text-[9px] text-slate-400 mb-1">⥁ Zones d\'évolution (perte d\'altitude avant le circuit)</div>' +
            '    <div class="grid grid-cols-[auto_1fr_1fr_auto] gap-1 text-[8px] items-center mb-1">' +
            '      <span class="text-amber-400 font-bold">C1</span>' +
            '      <button id="btn_evo_a_circle"  class="bg-amber-800 hover:bg-amber-700 text-white px-1 py-1 rounded">○ Cercle</button>' +
            '      <button id="btn_evo_a_polygon" class="bg-amber-800 hover:bg-amber-700 text-white px-1 py-1 rounded">▢ Poly</button>' +
            '      <button id="btn_evo_a_clear"   class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-1 py-1 rounded" title="Supprimer">🗑</button>' +
            '    </div>' +
            '    <div class="grid grid-cols-[auto_1fr_1fr_auto] gap-1 text-[8px] items-center">' +
            '      <span class="text-blue-400 font-bold">C2</span>' +
            '      <button id="btn_evo_b_circle"  class="bg-blue-800 hover:bg-blue-700 text-white px-1 py-1 rounded">○ Cercle</button>' +
            '      <button id="btn_evo_b_polygon" class="bg-blue-800 hover:bg-blue-700 text-white px-1 py-1 rounded">▢ Poly</button>' +
            '      <button id="btn_evo_b_clear"   class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-1 py-1 rounded" title="Supprimer">🗑</button>' +
            '    </div>' +
            '  </div>' +
            '  <div class="border-t border-slate-700 pt-2">' +
            '    <span class="text-[10px] font-black uppercase tracking-wider text-blue-400">📐 Zone de posé (polygone)</span>' +
            '    <div class="grid grid-cols-2 gap-1 mt-1">' +
            '      <button id="btn_edit_zone" class="text-[9px] bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded font-bold">Éditer zone de posé</button>' +
            '      <button id="btn_reset_zone" class="text-[8px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded">Reset zone</button>' +
            '    </div>' +
            '    <div class="text-[8px] text-slate-600 mt-1">Polygone (≥3 sommets). Si défini, remplace le rectangle Long×Larg dans le critère "posé dans zone".</div>' +
            '  </div>' +
            // ── NFZ : intégré dans la même carte que circuits + zone de
            //    posé. Le bouton « + Ajouter » dessine un polygone par
            //    défaut, puis chaque zone est éditable inline (nom, type
            //    HARD/SOFT, alt min/max) + ✏ pour éditer les sommets sur
            //    la carte + ✕ pour supprimer.
            '  <div class="border-t border-slate-700 pt-2 mt-2">' +
            '    <div class="flex items-center justify-between mb-1">' +
            '      <span class="text-[10px] font-black uppercase tracking-wider text-red-400">🚫 Zones Interdites (NFZ)</span>' +
            '      <button id="btn_add_nfz" class="text-[9px] bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded font-bold">+ Ajouter</button>' +
            '    </div>' +
            '    <div id="nfz_list" class="text-[9px] text-slate-500 italic">Aucune zone</div>' +
            '    <div class="text-[8px] text-slate-600 mt-1">Polygones avec bornes altitude. Les paras qui les traversent dans la plage altitude marquent la config NO-GO.</div>' +
            '  </div>' +
            '  <div class="grid grid-cols-2 gap-1 mt-2 border-t border-slate-700 pt-2">' +
            '    <button id="btn_export_cfg" class="text-[8px] bg-emerald-800 hover:bg-emerald-700 text-emerald-100 px-2 py-1 rounded">⬇ Export JSON</button>' +
            '    <label for="btn_import_cfg" class="text-[8px] bg-emerald-800 hover:bg-emerald-700 text-emerald-100 px-2 py-1 rounded text-center cursor-pointer">⬆ Import JSON</label>' +
            '    <input type="file" id="btn_import_cfg" accept=".json" class="hidden">' +
            '  </div>' +
            '  <div class="text-[8px] text-slate-600 mt-1">Clique « Éditer » : marqueurs draggables sur la carte, sauvé auto. Le bon circuit est choisi selon le vent au sol.</div>' +
            '</div>' +

            // ── MC PARAMS (full) ──
            '<div class="border border-slate-700 rounded-xl p-3 mb-3 bg-slate-900/50">' +
            '  <div class="flex items-center justify-between mb-2">' +
            '    <span class="text-[10px] font-black uppercase tracking-wider text-indigo-400">🎲 Monte-Carlo</span>' +
            '    <button id="btn_mc_toggle_advanced" class="text-[9px] text-indigo-300 hover:text-indigo-200" type="button">paramètres avancés ▾</button>' +
            '  </div>' +
            '  <div class="grid grid-cols-3 gap-2 mb-2">' +
            '    <label class="text-[9px] text-slate-500">Itérations<br>' +
            '      <input id="mc_n" type="number" value="100" min="20" max="2000" step="10" class="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px] mt-0.5">' +
            '    </label>' +
            '    <label class="text-[9px] text-slate-500">σ Vent (kt)<br>' +
            '      <input id="mc_wind_spd" type="number" value="3" min="0" max="10" step="0.5" class="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px] mt-0.5">' +
            '    </label>' +
            '    <label class="text-[9px] text-slate-500">σ Dir (°)<br>' +
            '      <input id="mc_wind_dir" type="number" value="10" min="0" max="45" step="5" class="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px] mt-0.5">' +
            '    </label>' +
            '  </div>' +
            // Advanced sigmas (hidden by default)
            '  <div id="mc_advanced" class="hidden mt-1">' +
            '    <div class="text-[9px] uppercase text-slate-500 font-bold mb-1 mt-2">Vent</div>' +
            '    <div class="grid grid-cols-2 gap-2 mb-2">' +
            '      <label class="text-[9px] text-slate-500">Corrélation z<br>' +
            '        <input id="mc_wind_corr" type="number" value="0.7" min="0" max="0.99" step="0.05" class="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px] mt-0.5">' +
            '      </label>' +
            '      <label class="text-[9px] text-slate-500">Pas échantillon (s)<br>' +
            '        <input id="mc_sample_dt" type="number" value="2" min="0.5" max="10" step="0.5" class="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px] mt-0.5">' +
            '      </label>' +
            '    </div>' +
            '    <div class="text-[9px] uppercase text-slate-500 font-bold mb-1">Parachutiste (relatif sauf hOuv et skill)</div>' +
            '    <div class="grid grid-cols-3 gap-2 mb-1">' +
            '      <label class="text-[9px] text-slate-500">σ vC (rel.)<br>' +
            '        <input id="mc_sig_vc" type="number" value="0.05" min="0" max="0.30" step="0.01" class="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px] mt-0.5">' +
            '      </label>' +
            '      <label class="text-[9px] text-slate-500">σ vZ voile<br>' +
            '        <input id="mc_sig_vz" type="number" value="0.05" min="0" max="0.30" step="0.01" class="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px] mt-0.5">' +
            '      </label>' +
            '      <label class="text-[9px] text-slate-500">σ glide<br>' +
            '        <input id="mc_sig_glide" type="number" value="0.10" min="0" max="0.30" step="0.01" class="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px] mt-0.5">' +
            '      </label>' +
            '    </div>' +
            '    <div class="grid grid-cols-2 gap-2 mb-1">' +
            '      <label class="text-[9px] text-slate-500">σ hOuv (m)<br>' +
            '        <input id="mc_sig_houv" type="number" value="50" min="0" max="200" step="10" class="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px] mt-0.5">' +
            '      </label>' +
            '      <label class="text-[9px] text-slate-500">σ skill (abs.)<br>' +
            '        <input id="mc_sig_skill" type="number" value="0.10" min="0" max="0.50" step="0.05" class="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px] mt-0.5">' +
            '      </label>' +
            '    </div>' +
            '    <div class="text-[9px] uppercase text-slate-500 font-bold mb-1 mt-1">Dérive & dispersion (deg)</div>' +
            '    <div class="grid grid-cols-2 gap-2 mb-1">' +
            '      <label class="text-[9px] text-slate-500">σ angle séparation groupe<br>' +
            '        <input id="mc_sig_subangle" type="number" value="20" min="0" max="90" step="5" class="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px] mt-0.5">' +
            '      </label>' +
            '      <label class="text-[9px] text-slate-500">σ axe tracking<br>' +
            '        <input id="mc_sig_trackaxis" type="number" value="15" min="0" max="90" step="5" class="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px] mt-0.5">' +
            '      </label>' +
            '    </div>' +
            '    <div class="text-[8px] text-slate-600 mt-0.5">Les typologies (ex: élève en dérive) peuvent surcharger ces σ et ajouter une probabilité d\'axe opposé.</div>' +
            '  </div>' +
            // Visualization controls
            '  <div class="border-t border-slate-700 mt-2 pt-2">' +
            '    <div class="grid grid-cols-2 gap-1 mb-1">' +
            '      <label class="text-[9px] text-slate-400 flex items-center gap-1 cursor-pointer">' +
            '        <input id="mc_show_ellipses" type="checkbox" checked class="rounded"> Ellipses ouverture/poser' +
            '      </label>' +
            '      <label class="text-[9px] text-slate-400 flex items-center gap-1 cursor-pointer">' +
            '        <input id="mc_show_tube" type="checkbox" class="rounded"> Tube ±σ trajectoire' +
            '      </label>' +
            '      <label class="text-[9px] text-slate-400 flex items-center gap-1 cursor-pointer col-span-2">' +
            '        <input id="mc_show_heatmap" type="checkbox" class="rounded"> Heatmap trajectoires (carte + transversale)' +
            '      </label>' +
            '    </div>' +
            '    <div class="flex items-center gap-2">' +
            '      <span class="text-[9px] text-slate-500 w-14">Confiance :</span>' +
            '      <input id="mc_sigma_scale" type="range" min="1" max="3" step="0.5" value="2" class="flex-1">' +
            '      <span id="mc_sigma_scale_val" class="text-[10px] font-mono font-bold text-indigo-300 w-10 text-right">±2σ</span>' +
            '    </div>' +
            '    <div class="text-[8px] text-slate-600 mt-0.5">1σ ≈ 39%, 2σ ≈ 86%, 3σ ≈ 99%</div>' +
            '  </div>' +
            '  <div class="grid grid-cols-2 gap-2 mt-2">' +
            '    <label class="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer">' +
            '      <input id="mc_enabled" type="checkbox" checked class="rounded"> Avec optimiseur' +
            '    </label>' +
            '    <button id="btn_mc_standalone" class="text-[10px] py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 text-white font-bold">▶ Lancer MC sur stick actuel</button>' +
            '  </div>' +
            '</div>' +

            // ── MAIN BUTTON (V3 only) ──
            '<button id="btn_optimize_v3" class="w-full py-3 rounded-xl font-black text-sm bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white shadow-lg shadow-cyan-900/40 transition-all active:scale-[0.98]">' +
            '  🛩️ OPTIMISER (top vert / top fin)' +
            '</button>' +
            '<div class="text-[8px] text-slate-500 mt-1">Borne le jumprun avec ancres (VR/FF petite voile WL=1.5 → top vert ; tandem → top fin), propose jusqu\'à 3 axes diversifiés, validation Monte-Carlo 1000 itérations.</div>' +

            // ── PROGRESS ──
            '<div id="opt2_progress" class="mt-2 hidden">' +
            '  <div class="flex items-center gap-2 mb-0.5">' +
            '    <div class="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">' +
            '      <div id="opt2_bar" class="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all" style="width:0%"></div>' +
            '    </div>' +
            '    <span id="opt2_pct" class="text-[10px] text-slate-400 font-mono w-10 text-right">0%</span>' +
            '  </div>' +
            '  <div id="opt2_status" class="text-[9px] text-slate-500"></div>' +
            '</div>' +

            // ── RESULTS ──
            // (MC verdict banner and per-jumper table live in the static
            //  "Monte-Carlo" scard above — we just populate them.)
            '<div id="opt2_results" class="mt-3"></div>' +
            // V3 proposals container (separate so V2 results don't clobber)
            '<div id="opt3_results" class="mt-3"></div>';

        var v3btn = document.getElementById('btn_optimize_v3');
        if (v3btn) v3btn.addEventListener('click', _onOptimizeV3Click);
        document.getElementById('btn_add_nfz').addEventListener('click', _onAddNFZ);

        // Pattern editor wiring
        function _wireEdit(btnId, slot) {
            var btn = document.getElementById(btnId);
            if (!btn) return;
            btn.addEventListener('click', function () {
                if (typeof PatternEditor === 'undefined') return;
                if (btn.textContent.indexOf('Terminer') >= 0) PatternEditor.endEdit();
                else PatternEditor.startEdit(slot);
            });
        }
        _wireEdit('btn_edit_a', 'a');
        _wireEdit('btn_edit_b', 'b');

        function _wireReset(btnId, slot) {
            var btn = document.getElementById(btnId);
            if (btn) btn.addEventListener('click', function () {
                if (typeof PatternEditor !== 'undefined') PatternEditor.reset(slot);
            });
        }
        _wireReset('btn_reset_a', 'a');
        _wireReset('btn_reset_b', 'b');

        // Evolution-zone buttons (per circuit, per shape).
        function _wireEvoEdit(btnId, slot, type) {
            var btn = document.getElementById(btnId);
            if (!btn) return;
            btn.addEventListener('click', function () {
                if (typeof PatternEditor === 'undefined') return;
                if (btn.textContent.indexOf('Terminer') >= 0) PatternEditor.endEditEvolutionZone();
                else PatternEditor.startEditEvolutionZone(slot, type);
            });
        }
        _wireEvoEdit('btn_evo_a_circle',  'a', 'circle');
        _wireEvoEdit('btn_evo_a_polygon', 'a', 'polygon');
        _wireEvoEdit('btn_evo_b_circle',  'b', 'circle');
        _wireEvoEdit('btn_evo_b_polygon', 'b', 'polygon');
        function _wireEvoClear(btnId, slot) {
            var btn = document.getElementById(btnId);
            if (btn) btn.addEventListener('click', function () {
                if (typeof PatternEditor !== 'undefined') PatternEditor.clearEvolutionZone(slot);
            });
        }
        _wireEvoClear('btn_evo_a_clear', 'a');
        _wireEvoClear('btn_evo_b_clear', 'b');

        var btnEditZone = document.getElementById('btn_edit_zone');
        if (btnEditZone) btnEditZone.addEventListener('click', function () {
            if (typeof PatternEditor !== 'undefined') PatternEditor.startEditZone();
        });
        var btnResetZone = document.getElementById('btn_reset_zone');
        if (btnResetZone) btnResetZone.addEventListener('click', function () {
            if (typeof PatternEditor !== 'undefined') PatternEditor.resetZone();
        });

        var btnExp = document.getElementById('btn_export_cfg');
        if (btnExp) btnExp.addEventListener('click', function () {
            if (typeof PatternEditor !== 'undefined') PatternEditor.exportJSON();
        });
        var btnImp = document.getElementById('btn_import_cfg');
        if (btnImp) btnImp.addEventListener('change', function (e) {
            if (typeof PatternEditor !== 'undefined' && e.target.files[0]) {
                PatternEditor.importJSON(e.target.files[0]);
            }
        });

        // Trigger initial label refresh after panel injection
        if (typeof PatternEditor !== 'undefined' && typeof PatternEditor.refreshDisplay === 'function') {
            setTimeout(PatternEditor.refreshDisplay, 100);
        }
        // Render NFZ list (NFZ may have been loaded from localStorage by
        // PatternEditor.load() before injectUI ran).
        setTimeout(_updateNFZList, 120);
        document.getElementById('btn_mc_standalone').addEventListener('click', _onRunMCStandalone);
        document.getElementById('btn_mc_toggle_advanced').addEventListener('click', _toggleMCAdvanced);
        document.getElementById('mc_show_tube').addEventListener('change', _onTubeToggle);
        document.getElementById('mc_show_ellipses').addEventListener('change', _onEllipseToggle);
        document.getElementById('mc_show_heatmap').addEventListener('change', _onHeatmapToggle);

        // Keep the legacy header button "Ellipses 95%" in sync with the panel checkbox
        var legacyBtn = document.getElementById('btn_toggle_ellipses');
        if (legacyBtn) legacyBtn.addEventListener('click', function () {
            var box = document.getElementById('mc_show_ellipses');
            // The header button has already toggled window._ellipsesVisible via toggleEllipses()
            box.checked = window._ellipsesVisible !== false;
        });

        var sliderEl = document.getElementById('mc_sigma_scale');
        var sliderLabel = document.getElementById('mc_sigma_scale_val');
        sliderEl.addEventListener('input', function () {
            sliderLabel.textContent = '±' + parseFloat(sliderEl.value).toFixed(1).replace(/\.0$/, '') + 'σ';
            _onSigmaScaleChange();
        });
    }

    function _toggleMCAdvanced() {
        var box = document.getElementById('mc_advanced');
        var btn = document.getElementById('btn_mc_toggle_advanced');
        var open = box.classList.toggle('hidden');
        btn.textContent = open ? 'paramètres avancés ▾' : 'paramètres avancés ▴';
    }

    // ── NFZ UI ─────────────────────────────────────────────────
    function _onAddNFZ() {
        var mapObj = window._map || (typeof map !== 'undefined' ? window.map : null);
        if (!mapObj) { alert('Carte non disponible'); return; }
        var dz = typeof getDZ === 'function' ? getDZ() : { lat: 0, lon: 0 };
        NFZ.init(dz.lat, dz.lon);

        // Seed a default 4-vertex polygon centred on the map view.
        var center = mapObj.getCenter();
        var cosLat = Math.cos(center.lat * Math.PI / 180);
        var dLat = function (m) { return m / 111320; };
        var dLon = function (m) { return m / (111320 * cosLat); };
        var polygon = [
            [center.lng - dLon(150), center.lat + dLat(150)],
            [center.lng + dLon(150), center.lat + dLat(150)],
            [center.lng + dLon(150), center.lat - dLat(150)],
            [center.lng - dLon(150), center.lat - dLat(150)]
        ];

        var name = 'NFZ ' + (NFZ.getZones().length + 1);
        var z = NFZ.addZone({
            name: name, type: 'hard',
            altMin: 0, altMax: 99999,
            polygon: polygon
        });
        NFZ.drawOnMap(mapObj);
        _updateNFZList();
        if (typeof PatternEditor !== 'undefined') {
            PatternEditor.save();
            // Immediately enter vertex-edit mode so the user can drag the polygon
            PatternEditor.startEditNFZ(z.id);
            window._editingNfzZoneId = z.id;
        }
    }

    function _updateNFZList() {
        var el = document.getElementById('nfz_list');
        if (!el) return;
        var zones = NFZ.getZones();
        if (!zones.length) { el.innerHTML = '<span class="italic text-slate-500">Aucune zone</span>'; return; }
        el.innerHTML = zones.map(function (z) {
            return '<div class="border-b border-slate-800 py-1">' +
                '  <div class="flex items-center gap-1">' +
                '    <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:' + z.color + '"></span>' +
                '    <input type="text" value="' + z.name + '" ' +
                '      onchange="UIOptimizer.updateNFZ(\'' + z.id + '\', \'name\', this.value)" ' +
                '      class="flex-1 bg-slate-900 border border-slate-700 rounded px-1 text-slate-200 text-[10px] min-w-0">' +
                '    <button onclick="UIOptimizer.editNFZ(\'' + z.id + '\')" ' +
                '      class="text-blue-400 hover:text-blue-300 text-[12px] ml-1" title="Éditer sommets">✏</button>' +
                '    <button onclick="UIOptimizer.removeNFZ(\'' + z.id + '\')" ' +
                '      class="text-red-400 hover:text-red-300 text-[10px] ml-1" title="Supprimer">✕</button>' +
                '  </div>' +
                '  <div class="grid grid-cols-3 gap-1 mt-0.5 text-[9px] text-slate-500">' +
                '    <label>Type<br>' +
                '      <select onchange="UIOptimizer.updateNFZ(\'' + z.id + '\', \'type\', this.value)" ' +
                '        class="w-full bg-slate-900 border border-slate-700 rounded px-1 text-slate-200 text-[10px]">' +
                '        <option value="hard"' + (z.type === 'hard' ? ' selected' : '') + '>HARD</option>' +
                '        <option value="soft"' + (z.type !== 'hard' ? ' selected' : '') + '>SOFT</option>' +
                '      </select>' +
                '    </label>' +
                '    <label>Alt mini<br>' +
                '      <input type="number" value="' + (z.altMin || 0) + '" step="100" min="0" ' +
                '        onchange="UIOptimizer.updateNFZ(\'' + z.id + '\', \'altMin\', this.value)" ' +
                '        class="w-full bg-slate-900 border border-slate-700 rounded px-1 text-slate-200 text-[10px]">' +
                '    </label>' +
                '    <label>Alt maxi<br>' +
                '      <input type="number" value="' + (z.altMax === 99999 ? '' : z.altMax) + '" step="100" placeholder="∞" ' +
                '        onchange="UIOptimizer.updateNFZ(\'' + z.id + '\', \'altMax\', this.value)" ' +
                '        class="w-full bg-slate-900 border border-slate-700 rounded px-1 text-slate-200 text-[10px]">' +
                '    </label>' +
                '  </div>' +
                '</div>';
        }).join('');
    }

    function _updateNFZField(zoneId, field, value) {
        var zone = NFZ.getZones().find(function (z) { return z.id === zoneId; });
        if (!zone) return;
        if (field === 'name') zone.name = value;
        else if (field === 'type') {
            zone.type = value;
            zone.color = value === 'hard' ? '#ef4444' : '#f59e0b';
            var mapObj = window._map;
            if (mapObj) NFZ.drawOnMap(mapObj);
        }
        else if (field === 'altMin') zone.altMin = parseFloat(value) || 0;
        else if (field === 'altMax') zone.altMax = value === '' ? 99999 : parseFloat(value);
        if (typeof PatternEditor !== 'undefined') PatternEditor.save();
        if (typeof recompute === 'function') recompute();
    }

    function _editNFZ(zoneId) {
        if (typeof PatternEditor === 'undefined') return;
        if (window._editingNfzZoneId === zoneId) {
            PatternEditor.endEditNFZ();
            window._editingNfzZoneId = null;
        } else {
            PatternEditor.startEditNFZ(zoneId);
            window._editingNfzZoneId = zoneId;
        }
    }

    function _removeNFZ(zoneId) {
        if (window._editingNfzZoneId === zoneId && typeof PatternEditor !== 'undefined') {
            PatternEditor.endEditNFZ();
            window._editingNfzZoneId = null;
        }
        NFZ.removeZone(zoneId);
        var mapObj = window._map;
        if (mapObj) NFZ.drawOnMap(mapObj);
        if (typeof PatternEditor !== 'undefined') PatternEditor.save();
        _updateNFZList();
        if (typeof recompute === 'function') recompute();
    }

    // Read all MC parameters from the UI.
    function _readMCOptions() {
        function v(id, dflt, parse) { var e = document.getElementById(id); return e ? (parse(e.value) || dflt) : dflt; }
        return {
            N: v('mc_n', 100, parseInt),
            windSigma: {
                spd: v('mc_wind_spd', 3, parseFloat),
                dir: v('mc_wind_dir', 15, parseFloat),
                correlation: v('mc_wind_corr', 0.7, parseFloat)
            },
            jumperSigma: {
                vc: v('mc_sig_vc', 0.05, parseFloat),
                vzVoile: v('mc_sig_vz', 0.08, parseFloat),
                glide: v('mc_sig_glide', 0.10, parseFloat),
                hOuv: v('mc_sig_houv', 50, parseFloat),
                skill: v('mc_sig_skill', 0.10, parseFloat),
                subAngle: v('mc_sig_subangle', 20, parseFloat),
                trackAxis: v('mc_sig_trackaxis', 15, parseFloat)
            },
            sigmaScale: v('mc_sigma_scale', 2, parseFloat),
            sampleInterval: v('mc_sample_dt', 2.0, parseFloat)
        };
    }

    // Build a baseCfg for MonteCarlo.run from the current UI state +
    // the active simulation parameters (axe, crossNm, topNm).
    function _buildBaseCfg() {
        var dz = typeof getDZ === 'function' ? getDZ() : {};
        var fl = parseFloat(document.getElementById('fl_jump').value) || 140;
        var kias = parseFloat(document.getElementById('kias').value) || 120;
        var isa = parseFloat(document.getElementById('isa_delta').value) || 0;
        var qnh = parseFloat(document.getElementById('qnh_val').value) || 1013.25;
        var altM = fl * 100 * 0.3048 + (qnh - 1013.25) * 8.43;
        var kiasMs = kias * PhysicsCore.KT2MS;
        var tasMs = PhysicsCore.computeTAS(kiasMs, altM, isa);

        // If a zone polygon is defined, use its centroid as the landing
        // target / RV. Else fall back to the legacy currentRV.
        var zonePoly = typeof PatternEditor !== 'undefined' ? PatternEditor.getZonePolygon() : null;
        var rvCenter = { lat: currentRV.lat, lon: currentRV.lon };
        if (zonePoly && zonePoly.length >= 3) {
            var sumLat = 0, sumLon = 0;
            zonePoly.forEach(function (p) { sumLat += p.lat; sumLon += p.lon; });
            rvCenter = { lat: sumLat / zonePoly.length, lon: sumLon / zonePoly.length };
        }

        return {
            dz: dz,
            target: { lat: currentTarget.lat, lon: currentTarget.lon },
            rv: rvCenter,
            altM: altM,
            elevM: dz.elev || 0,
            tasMs: tasMs,
            isa: isa,
            axe: parseFloat(document.getElementById('axe_largage').value) || 0,
            crossNm: parseFloat(document.getElementById('cross_track_nm').value) || 0,
            topNm: parseFloat(document.getElementById('top_largage_nm').value) || 0,
            delaiTopVert: parseFloat(document.getElementById('delai_top_vert').value) || 5,
            espacementM: parseFloat(document.getElementById('espacement_m').value) || 300,
            safetyThresh: parseFloat(document.getElementById('gono_sep_dist').value) || 78,
            criticalThresh: parseFloat(document.getElementById('gono_crit_dist').value) || 30,
            sepThresh: parseFloat(document.getElementById('gono_sep_dist').value) || 78,
            timeMin: parseFloat(document.getElementById('gono_min_dt').value) || 5,
            rvLength: parseFloat(document.getElementById('rv_length').value) || 400,
            rvWidth: parseFloat(document.getElementById('rv_width').value) || 100,
            rvAlt: parseFloat(document.getElementById('gono_rv_alt').value) || 300,
            tPilotCommon: parseFloat(document.getElementById('t_pilot_common').value) || 8,
            jumpers: (typeof jumpersList !== 'undefined' ? jumpersList : []).slice(),
            nPara: (typeof jumpersList !== 'undefined' ? jumpersList.length : 0),
            _windProfile: (typeof sortedWindProfile !== 'undefined' ? sortedWindProfile : null) ||
                (typeof windProfile !== 'undefined' ? windProfile : []),
            nfzList: typeof NFZ !== 'undefined' ? NFZ.serialize() : [],
            // User-defined landing pattern (if any) matching ground wind
            userPattern: _resolveUserPattern(),
            // Evolution zone (cercle ou polygone) du circuit actif :
            // zone où le pilote brûle son altitude avant de joindre le
            // début de vent arrière.
            evolutionZone: _resolveEvolutionZone(),
            // User-defined landing zone polygon (overrides the rectangle
            // for the "posé dans zone" criterion if present).
            zonePolygon: typeof PatternEditor !== 'undefined' ? PatternEditor.getZonePolygon() : null
        };
    }

    function _activePattern() {
        if (typeof PatternEditor === 'undefined') return null;
        var profile = (typeof sortedWindProfile !== 'undefined' ? sortedWindProfile : null) ||
            (typeof windProfile !== 'undefined' ? windProfile : []);
        if (!profile.length) return null;
        var sorted = profile.slice().sort(function (a, b) { return a.z - b.z; });
        return PatternEditor.patternForWind(sorted[0].dir || 0);
    }

    function _resolveUserPattern() {
        var pat = _activePattern();
        return pat && pat.waypoints ? pat.waypoints : null;
    }

    function _resolveEvolutionZone() {
        var pat = _activePattern();
        return pat && pat.evolutionZone ? pat.evolutionZone : null;
    }

    async function _onRunMCStandalone() {
        var btn = document.getElementById('btn_mc_standalone');
        var progress = document.getElementById('opt2_progress');
        var bar = document.getElementById('opt2_bar');
        var pct = document.getElementById('opt2_pct');
        var status = document.getElementById('opt2_status');
        var results = document.getElementById('opt2_results');

        if (typeof jumpersList === 'undefined' || !jumpersList.length) {
            alert('Aucun parachutiste dans le stick.');
            return;
        }

        btn.disabled = true;
        var oldText = btn.textContent;
        btn.textContent = '⏳ MC en cours…';
        progress.classList.remove('hidden');
        results.innerHTML = '';
        document.getElementById('mc_verdict_banner').classList.add('hidden');
        document.getElementById('mc_jumper_table').classList.add('hidden');
        bar.style.width = '0%';
        pct.textContent = '0%';
        status.textContent = 'Préparation…';

        var baseCfg = _buildBaseCfg();
        var mcOpts = _readMCOptions();

        // Yield once to let the UI update before the heavy synchronous loop
        await new Promise(function (r) { setTimeout(r, 30); });

        var t0 = Date.now();
        var mcResult;
        try {
            PhysicsCore.setWindProfile(baseCfg._windProfile);
            PhysicsCore.enableWindCache(Math.ceil(baseCfg.altM) + 100);
            mcResult = MonteCarlo.run(baseCfg, mcOpts, function (done, total) {
                var p = Math.round(done / total * 100);
                bar.style.width = p + '%';
                pct.textContent = p + '%';
                status.textContent = 'Itération ' + done + '/' + total;
            });
        } catch (err) {
            console.error('MC standalone error:', err);
            results.innerHTML = '<div class="bg-red-900/30 border border-red-700 rounded-xl p-3 text-red-400 text-[10px] font-bold">❌ Erreur MC : ' + (err.message || err) + '</div>';
            btn.disabled = false; btn.textContent = oldText;
            return;
        }

        var ms = Date.now() - t0;
        bar.style.width = '100%'; pct.textContent = '100%';
        status.textContent = 'Terminé en ' + (ms / 1000).toFixed(1) + 's';

        // Display
        results.innerHTML = '<div class="bg-slate-800/50 border border-slate-700 rounded-xl p-3">' +
            '<div class="text-[10px] font-black uppercase tracking-wider text-indigo-400 mb-2">🎲 Monte-Carlo (' + mcResult.N + ' itér.)</div>' +
            '<div class="text-[9px] text-slate-400">σ vent : ' + mcOpts.windSigma.spd + ' kt / ' + mcOpts.windSigma.dir + '°' +
            ' | σ jumpers : vc±' + (mcOpts.jumperSigma.vc * 100).toFixed(0) + '%, vz±' + (mcOpts.jumperSigma.vzVoile * 100).toFixed(0) + '%, glide±' + (mcOpts.jumperSigma.glide * 100).toFixed(0) + '%, hOuv±' + mcOpts.jumperSigma.hOuv + 'm</div>' +
            '</div>';

        _displayMCResults(mcResult, baseCfg);

        // Auto-render overlays whose toggle is on
        if (document.getElementById('mc_show_tube').checked) _renderTrajectoryTube();
        if (document.getElementById('mc_show_heatmap').checked) _renderHeatmap();

        btn.disabled = false; btn.textContent = oldText;
    }

    function _renderTrajectoryTube() {
        if (!window._lastMcResult || !window._lastMcDz) return;
        var mapObj = window._map || (typeof map !== 'undefined' ? map : null);
        if (mapObj) MonteCarlo.drawTrajectoryUncertainty(mapObj, window._lastMcResult, window._lastMcDz);
        // Same corridor projected on the transversal cut
        if (typeof window.simResults !== 'undefined' && window.simResults &&
            window.transversalXS && window.transversalYS) {
            var svgG = d3.select('#transversal-chart svg g');
            if (!svgG.empty()) {
                MonteCarlo.drawTransversalTube(svgG, window._lastMcResult,
                    window.simResults.trackE, window.simResults.trackN,
                    window.simResults.elevM,
                    window.transversalXS, window.transversalYS);
            }
        }
    }

    function _onTubeToggle() {
        var on = document.getElementById('mc_show_tube').checked;
        if (on) {
            _renderTrajectoryTube();
        } else {
            var mapObj = window._map || (typeof map !== 'undefined' ? map : null);
            if (mapObj) MonteCarlo.clearTrajectoryUncertainty(mapObj);
            var svgG = d3.select('#transversal-chart svg g');
            if (!svgG.empty()) MonteCarlo.clearTransversalTube(svgG);
        }
    }

    function _onEllipseToggle() {
        var on = document.getElementById('mc_show_ellipses').checked;
        window._ellipsesVisible = on;
        var legacyBtn = document.getElementById('btn_toggle_ellipses');
        if (legacyBtn) legacyBtn.classList.toggle('active', on);
        var mapObj = window._map || (typeof map !== 'undefined' ? map : null);
        if (!mapObj) return;
        if (on && window._lastMcResult && window._lastMcDz) {
            MonteCarlo.drawEllipses(mapObj, window._lastMcResult, window._lastMcDz);
        } else {
            MonteCarlo.clearEllipses(mapObj);
        }
    }

    function _renderHeatmap() {
        if (!window._lastMcResult || !window._lastMcDz) return;
        var mapObj = window._map || (typeof map !== 'undefined' ? map : null);
        if (mapObj) MonteCarlo.drawTrajectoryHeatmap(mapObj, window._lastMcResult, window._lastMcDz);
        // Transversal chart overlay
        if (typeof window.simResults !== 'undefined' && window.simResults &&
            window.transversalXS && window.transversalYS) {
            var svgG = d3.select('#transversal-chart svg g');
            if (!svgG.empty()) {
                MonteCarlo.drawTransversalHeatmap(svgG, window._lastMcResult,
                    window.simResults.trackE, window.simResults.trackN,
                    window.simResults.elevM,
                    window.transversalXS, window.transversalYS);
            }
        }
    }

    function _onHeatmapToggle() {
        var on = document.getElementById('mc_show_heatmap').checked;
        var mapObj = window._map || (typeof map !== 'undefined' ? map : null);
        if (on) {
            _renderHeatmap();
        } else {
            if (mapObj) MonteCarlo.clearTrajectoryHeatmap(mapObj);
            var svgG = d3.select('#transversal-chart svg g');
            if (!svgG.empty()) MonteCarlo.clearTransversalHeatmap(svgG);
        }
    }

    function _onSigmaScaleChange() {
        // If MC results are stored, re-compute ellipses at the new sigma and redraw
        if (!window._lastMcResult) return;
        var newScale = parseFloat(document.getElementById('mc_sigma_scale').value) || 2;
        // Rescale a, b for each ellipse: chi² scales as scale², linear lengths scale as scale.
        // We stored absolute extents at the original scale; rescale geometrically.
        var oldScale = (window._lastMcResult.params && window._lastMcResult.params.sigmaScale) || 2;
        if (Math.abs(newScale - oldScale) < 1e-3) return;
        var ratio = newScale / oldScale;
        var rescaled = JSON.parse(JSON.stringify(window._lastMcResult));
        rescaled.jumperStats.forEach(function (js) {
            ['openEllipse', 'landEllipse'].forEach(function (key) {
                _rescaleEllipse(js[key], ratio);
            });
            (js.trajectoryEllipses || []).forEach(function (te) {
                _rescaleEllipse(te.ellipse, ratio);
            });
        });
        rescaled.params.sigmaScale = newScale;
        window._lastMcResult = rescaled;

        var mapObj = window._map || (typeof map !== 'undefined' ? map : null);
        if (mapObj) {
            if (window._ellipsesVisible !== false) MonteCarlo.drawEllipses(mapObj, rescaled, window._lastMcDz);
            if (document.getElementById('mc_show_tube').checked) _renderTrajectoryTube();
        }
    }

    function _rescaleEllipse(ell, ratio) {
        if (!ell) return;
        ell.a *= ratio; ell.b *= ratio;
        if (ell.points && ell.points.length) {
            ell.points = ell.points.map(function (p) {
                return { e: ell.cx + (p.e - ell.cx) * ratio, n: ell.cy + (p.n - ell.cy) * ratio };
            });
        }
    }

    // ── V3 OPTIMIZER ───────────────────────────────────────────
    async function _onOptimizeV3Click() {
        var btn = document.getElementById('btn_optimize_v3');
        var progress = document.getElementById('opt2_progress');
        var bar = document.getElementById('opt2_bar');
        var pct = document.getElementById('opt2_pct');
        var status = document.getElementById('opt2_status');
        var results = document.getElementById('opt3_results');

        if (typeof OptimizerV3 === 'undefined') {
            alert('OptimizerV3 indisponible.');
            return;
        }

        // V3 a besoin d'un stick non vide pour scorer (la longueur de
        // jumpersList caps `nPara` dans la sim de validation). Si le
        // stick est vide on le pré-remplit avec un stick "test" de 12
        // entrées (sera remplacé par un stick à la bonne taille N_max
        // au moment du clic « Appliquer »).
        if (typeof jumpersList !== 'undefined' && !jumpersList.length) {
            var seed = _buildOneOfEachStick(12);
            if (seed) seed.forEach(function (j) { jumpersList.push(j); });
            if (typeof buildJumpers === 'function') buildJumpers();
        }

        // Ouvre le panneau droit + active l'overlay scintillant pour
        // que la progress bar V3 reste visible pendant l'optimisation.
        var rp = document.getElementById('right_panel');
        if (rp && !rp.classList.contains('open') && typeof togglePanel === 'function') {
            togglePanel('right');
        }
        var overlay = document.getElementById('opt_overlay');
        if (overlay) overlay.classList.add('active');

        btn.disabled = true;
        var oldText = btn.textContent;
        btn.textContent = '⏳ V3 en cours…';
        progress.classList.remove('hidden');
        results.innerHTML = '';
        bar.style.width = '0%'; pct.textContent = '0%';
        status.textContent = 'Préparation V3…';

        var dz = typeof getDZ === 'function' ? getDZ() : {};
        NFZ.init(dz.lat || 0, dz.lon || 0);

        var fl = parseFloat(document.getElementById('fl_jump').value) || 140;
        var kias = parseFloat(document.getElementById('kias').value) || 120;
        var isa = parseFloat(document.getElementById('isa_delta').value) || 0;
        var qnh = parseFloat(document.getElementById('qnh_val').value) || 1013.25;
        var altM = fl * 100 * 0.3048 + (qnh - 1013.25) * 8.43;
        var kiasMs = kias * PhysicsCore.KT2MS;
        var tasMs = PhysicsCore.computeTAS(kiasMs, altM, isa);

        var cfg = _buildBaseCfg();
        // Override altitude / TAS in case they drifted from the form
        cfg.altM = altM;
        cfg.tasMs = tasMs;
        cfg.elevM = dz.elev || 0;
        cfg.isa = isa;
        cfg.nfzList = NFZ.serialize();
        // Passe les PARA_TYPOLOGIES au worker pour qu'il puisse
        // construire le stick V3 (gros groupes / solos / fillers).
        cfg._paraTypologies = (typeof PARA_TYPOLOGIES !== 'undefined') ? PARA_TYPOLOGIES : null;

        try {
            await OptimizerV3.run(cfg, {
                K: 3,
                offsetMaxNm: 0.6,
                enableMC: true,
                mcN: 1000,
                onProgress: function (type, a, b) {
                    var pp = 0;
                    if (type === 'status') { status.textContent = a; return; }
                    else if (type === 'scan') {
                        pp = Math.round((a / b) * 30);
                        status.textContent = 'Scan géométrique ' + a + '/' + b + ' axes·offsets';
                    }
                    else if (type === 'mc') {
                        pp = 30 + Math.round((a / b) * 70);
                        status.textContent = 'Monte-Carlo ' + a + '/' + b + ' itérations';
                    }
                    bar.style.width = pp + '%';
                    pct.textContent = pp + '%';
                },
                onComplete: function (result) {
                    bar.style.width = '100%'; pct.textContent = '100%';
                    btn.disabled = false;
                    btn.textContent = oldText;
                    if (overlay) overlay.classList.remove('active');

                    if (!result.success) {
                        results.innerHTML =
                            '<div class="bg-red-900/30 border border-red-700 rounded-xl p-3 text-red-400 text-[10px] font-bold">' +
                            '❌ ' + (result.reason || 'Échec V3') + '</div>';
                        return;
                    }
                    _displayV3Proposals(result, cfg);
                }
            });
        } catch (err) {
            console.error('OptimizerV3 threw:', err);
            btn.disabled = false;
            btn.textContent = oldText;
            if (overlay) overlay.classList.remove('active');
            results.innerHTML =
                '<div class="bg-red-900/30 border border-red-700 rounded-xl p-3 text-red-400 text-[10px] font-bold">' +
                '❌ Erreur V3 : ' + (err.message || err) + '</div>';
        }
    }

    function _displayV3Proposals(result, cfg) {
        var el = document.getElementById('opt3_results');
        if (!result.proposals || !result.proposals.length) {
            el.innerHTML = '<div class="bg-amber-900/30 border border-amber-700 rounded-xl p-3 text-amber-300 text-[10px]">Aucune proposition V3 trouvée.</div>';
            return;
        }
        // Stash for the apply callback
        window._v3LastResult = { result: result, cfg: cfg };

        var html = '<div class="text-[10px] font-black uppercase tracking-wider text-cyan-400 mb-2">🛩️ Propositions V3 (' + result.proposals.length + ')</div>';
        result.proposals.forEach(function (p, i) {
            var pgo = p.mc ? Math.round(p.mc.pGO * 100) : null;
            var verd = p.mc ? p.mc.verdict : null;
            var verdColor = verd === 'GO' ? '#34d399' : verd === 'MARGINAL' ? '#fbbf24' : verd === 'NOGO' ? '#f87171' : '#94a3b8';

            // 2 « rouges » : le premier rouge = dernier slot pour un PAC
            // duo (moins de marge de dérive) ; le dernier rouge = dernier
            // slot pour un tandem (plus de marge → plus loin sur l'axe).
            // Les deux sont rendus rouge pour cohérence avec la pratique
            // — ce sont deux feux rouges distincts du largage.
            var nMaxRows = '';
            if (p.nMaxIfPac != null) {
                nMaxRows += '<div class="text-[9px] text-slate-400 flex justify-between"><span>🔴 Premier rouge (dernier PAC duo)</span>' +
                    '<span class="font-mono"><b class="text-rose-300">' + p.nMaxIfPac + ' max</b> · ' + (p.jumprunPacM / 1852).toFixed(2) + ' NM · top ' + p.topFinPacNm.toFixed(2) + ' NM</span></div>';
            }
            if (p.nMaxIfTandem != null) {
                nMaxRows += '<div class="text-[9px] text-slate-400 flex justify-between"><span>🔴 Dernier rouge (dernier tandem)</span>' +
                    '<span class="font-mono"><b class="text-rose-300">' + p.nMaxIfTandem + ' max</b> · ' + (p.jumprunTandemM / 1852).toFixed(2) + ' NM · top ' + p.topFinTandemNm.toFixed(2) + ' NM</span></div>';
            }

            // Stick order + delays
            var stickRows = '';
            if (p.order && p.delays && p.order.length === p.delays.length) {
                for (var oi = 0; oi < p.order.length; oi++) {
                    var ord = p.order[oi];
                    var t = p.delays[oi];
                    var prev = oi > 0 ? p.delays[oi - 1] : 0;
                    var gap = oi > 0 ? (t - prev) : 0;
                    var typeColor = {
                        belly_big: '#3b82f6', belly_small: '#60a5fa',
                        freefly_big: '#8b5cf6', freefly_small: '#a78bfa',
                        tandem: '#f59e0b', aff: '#22c55e', tracking: '#ec4899',
                        wingsuit: '#ef4444', hop_pop: '#6b7280', angle: '#14b8a6'
                    }[ord.category] || '#94a3b8';
                    stickRows += '<div class="flex items-center gap-1 text-[8px] font-mono">' +
                        '<span class="w-4 text-right text-slate-500">' + (oi + 1) + '.</span>' +
                        '<span class="px-1 rounded font-bold" style="background:' + typeColor + '22;color:' + typeColor + '">' + (ord.name || ord.category || '?') + (ord.nbPara > 1 ? ' ×' + ord.nbPara : '') + '</span>' +
                        '<span class="ml-auto text-violet-300">t=' + t.toFixed(1) + 's</span>' +
                        (oi > 0 ? '<span class="text-slate-500 ml-1">+' + gap.toFixed(1) + 's</span>' : '<span class="text-slate-600 ml-1">(top vert)</span>') +
                        '</div>';
                }
            }

            // MC stats (histogramme + hors zone)
            var mcStatsBlock = '';
            if (p.mc) {
                var mc = p.mc;
                // Histogramme sep min (texte ascii compact)
                var sepHist = '';
                if (mc.sepHistogram && mc.sepHistogram.bins) {
                    var maxC = Math.max.apply(null, mc.sepHistogram.counts.length ? mc.sepHistogram.counts : [1]);
                    var bars = mc.sepHistogram.counts.map(function (c, bi) {
                        var ratio = maxC > 0 ? c / maxC : 0;
                        var b = mc.sepHistogram.bins[bi];
                        var color = b < 78 ? '#f87171' : b < 150 ? '#fbbf24' : '#34d399';
                        return '<div title="' + b + '–' + (b + mc.sepHistogram.binSize) + ' m : ' + c + ' iter" ' +
                            'style="flex:1;height:' + Math.round(2 + ratio * 28) + 'px;background:' + color + ';opacity:0.85;border-radius:1px"></div>';
                    }).filter(function (_, idx) { return idx < 16; }).join('');
                    sepHist = '<div class="mt-1"><div class="text-[8px] text-slate-500 mb-0.5">Distrib. séparation min inter-paras (' + mc.N + ' itér., bins 25 m, rouge < 78 m)</div>' +
                        '<div style="display:flex;align-items:end;gap:1px;height:32px;background:#0f172a;padding:1px;border-radius:3px">' + bars + '</div>' +
                        '<div class="text-[8px] text-slate-500 mt-0.5 flex justify-between"><span>P5 ' + Math.round(mc.sepP5) + 'm</span><span>P50 ' + Math.round(mc.sepP50) + 'm</span></div></div>';
                }
                // Histogramme hors zone
                var ozHist = '';
                if (mc.outOfZoneHistogram && mc.outOfZoneHistogram.counts) {
                    var oc = mc.outOfZoneHistogram.counts;
                    var maxOC = Math.max.apply(null, oc.length ? oc : [1]);
                    var ozBars = oc.map(function (c, bi) {
                        var r = maxOC > 0 ? c / maxOC : 0;
                        return '<div title="' + bi + ' para hors zone : ' + c + ' iter" style="flex:1;height:' + Math.round(2 + r * 22) + 'px;background:' + (bi === 0 ? '#34d399' : '#f87171') + ';opacity:0.85;border-radius:1px"></div>';
                    }).join('');
                    ozHist = '<div class="mt-1"><div class="text-[8px] text-slate-500 mb-0.5">Distrib. # paras hors zone (moyenne ' + (mc.outOfZoneMean || 0).toFixed(2) + ')</div>' +
                        '<div style="display:flex;align-items:end;gap:1px;height:24px;background:#0f172a;padding:1px;border-radius:3px">' + ozBars + '</div></div>';
                }
                // Per-jumper out-of-zone freq
                var jsOZ = '';
                if (mc.jumperStats && mc.jumperStats.length) {
                    jsOZ = '<div class="mt-1 text-[8px] text-slate-400"><b>P(hors zone) par para :</b> ' +
                        mc.jumperStats.map(function (js, jsi) {
                            var pct = (js.pOutZone * 100).toFixed(0);
                            var col = js.pOutZone > 0.20 ? '#f87171' : js.pOutZone > 0.05 ? '#fbbf24' : '#34d399';
                            return '<span style="color:' + col + '">P' + (jsi + 1) + ':' + pct + '%</span>';
                        }).join(' ') + '</div>';
                }
                mcStatsBlock = '<details class="mb-2"><summary class="text-[9px] text-cyan-300 cursor-pointer hover:text-cyan-200">📊 Statistiques Monte-Carlo (' + mc.N + ' itér.)</summary>' +
                    '<div class="bg-slate-900/40 rounded-lg p-2 mt-1">' +
                    '<div class="grid grid-cols-3 gap-1 text-[8px] text-center mb-1">' +
                    _kpi('Reach', (mc.reachProb * 100).toFixed(0) + '%', 'text-base ' + (mc.reachVerdict === 'GO' ? 'text-emerald-400' : mc.reachVerdict === 'MARGINAL' ? 'text-amber-400' : 'text-red-400')) +
                    _kpi('Safety', (mc.safetyProb * 100).toFixed(1) + '%', 'text-base ' + (mc.safetyVerdict === 'GO' ? 'text-emerald-400' : mc.safetyVerdict === 'MARGINAL' ? 'text-amber-400' : 'text-red-400')) +
                    _kpi('P(coll)', (mc.criticalRisk * 100).toFixed(2) + '%', 'text-base ' + (mc.criticalVerdict === 'ACCEPTABLE' ? 'text-emerald-400' : mc.criticalVerdict === 'WARN' ? 'text-amber-400' : 'text-red-400')) +
                    '</div>' + sepHist + ozHist + jsOZ +
                    '</div></details>';
            }

            html += '<div class="bg-slate-800/50 border border-slate-700 rounded-xl p-3 mb-2">' +
                '<div class="flex items-center justify-between mb-2">' +
                '  <span class="text-[10px] font-black text-cyan-300">#' + (i + 1) + ' — Axe ' + Math.round(p.axe).toString().padStart(3, '0') + '°</span>' +
                (verd ? '  <span class="text-[10px] font-black px-2 py-0.5 rounded" style="background:' + verdColor + '22;color:' + verdColor + '">' + verd + (pgo != null ? ' ' + pgo + '%' : '') + '</span>' : '') +
                '</div>' +
                '<div class="grid grid-cols-4 gap-1 text-center mb-2">' +
                _kpi('N stick', p.nPara + ' paras', 'text-emerald-400 text-2xl', '= L/300') +
                _kpi('N landed', p.nLandedOk + '/' + p.nPara,
                     p.nLandedOk === p.nPara ? 'text-emerald-400 text-base' : 'text-amber-400 text-base',
                     p.nLandedOk === p.nPara ? 'tous' : (p.nPara - p.nLandedOk) + ' hors zone') +
                _kpi('Jumprun fenêtre', (p.jumprunLengthM / 1852).toFixed(2) + ' NM', 'text-sky-300 text-base', Math.round(p.jumprunLengthM) + ' m') +
                _kpi('Jumprun réel', (p.realJumprunM / 1852).toFixed(2) + ' NM',
                     p.realJumprunM > p.jumprunLengthM ? 'text-amber-300 text-base' : 'text-emerald-300 text-base',
                     'gaps ' + Math.round(p.cumExitT) + 's') +
                '</div>' +
                '<div class="grid grid-cols-3 gap-1 text-center mb-2">' +
                _kpi('Δt cible', p.dtSortie.toFixed(1) + 's', 'text-violet-300 text-base', 'GS ' + Math.round(p.gsMs * 1.94384) + 'kt') +
                _kpi('Espacement', Math.round(p.espacementM) + 'm', 'text-slate-300 text-base') +
                _kpi('Axe / Offset', Math.round(p.axe).toString().padStart(3, '0') + '° / ' + (p.crossNm >= 0 ? '+' : '') + p.crossNm.toFixed(2) + 'NM', 'text-slate-300 text-sm') +
                '</div>' +
                '<div class="grid grid-cols-2 gap-1 text-center mb-2">' +
                _kpi('Marge min', Math.round(p.minMarge) + 'm', p.minMarge < 0 ? 'text-red-400 text-sm' : 'text-emerald-400 text-sm') +
                _kpi('Sep min', Math.round(p.minSep) + 'm', p.minSep < 78 ? 'text-amber-400 text-sm' : 'text-emerald-400 text-sm') +
                '</div>' +
                '<div class="bg-slate-900/40 rounded-lg p-2 mb-2 space-y-0.5">' +
                '  <div class="text-[9px] text-slate-400 flex justify-between"><span>🟢 Top vert (VR/FF petite voile)</span><span class="font-mono text-emerald-300">' + p.topNm.toFixed(2) + ' NM</span></div>' +
                nMaxRows +
                '</div>' +
                (stickRows ? '<details class="mb-2"><summary class="text-[9px] text-cyan-300 cursor-pointer hover:text-cyan-200">📋 Ordre du stick + temps de départ</summary>' +
                    '<div class="bg-slate-900/40 rounded-lg p-2 mt-1 space-y-0.5">' + stickRows + '</div></details>' : '') +
                mcStatsBlock +
                '<button onclick="UIOptimizer.applyV3(' + i + ')" class="w-full bg-cyan-700 hover:bg-cyan-600 text-white text-[10px] font-bold py-1.5 rounded">✓ Appliquer cette config</button>' +
                '</div>';
        });
        el.innerHTML = html;
    }

    // Stick auto-construit pour une proposition V3.
    //   nMax        : nombre total de sorties (= N_max de la fenêtre)
    //   nPacRegion  : nombre de slots accessibles à un PAC duo (0..nMax)
    //                 → si null/undefined, on suppose que tout slot
    //                 accepte un PAC (cas générique : pas d'info anchor)
    //
    // Layout :
    //   - Slots 1 .. (nPacRegion - 1)   : entrées « régulières »
    //     (Gros VR, Gros FF, Groupe tracking, Élève, Élève dérive,
    //      remplisseurs solos au milieu) — pas de PAC, pas de tandem
    //   - Slot nPacRegion              : PAC duo (dernier slot où PAC
    //                                    peut atterrir en sécurité)
    //   - Slots nPacRegion+1 .. nMax   : Tandems uniquement (zone où
    //                                    seul le tandem peut dériver
    //                                    jusqu'à la zone)
    //
    // Edge cases :
    //   - nPacRegion = 0  → pas de PAC, que des tandems
    //   - nMax = nPacRegion → pas de tandem-only, le stick finit par
    //     PAC (cas où l'ancre PAC > ancre tandem, rare)
    //   - nPacRegion non fourni → comportement initial : finit par
    //     PAC + Tandem aux 2 dernières positions
    function _buildOneOfEachStick(nMax, nPacRegion) {
        if (typeof PARA_TYPOLOGIES === 'undefined' || !nMax || nMax < 1) return null;
        function clone(o) { return JSON.parse(JSON.stringify(o)); }

        var T = PARA_TYPOLOGIES;
        function mk(srcKey, overrides) {
            if (!T[srcKey]) return null;
            var x = clone(T[srcKey]);
            if (overrides) Object.keys(overrides).forEach(function (k) { x[k] = overrides[k]; });
            return x;
        }

        // Mode par défaut (pas de stratification PAC/tandem) : 1 PAC
        // puis 1 tandem aux 2 dernières positions.
        var mode = (nPacRegion == null) ? 'legacy' : 'stratified';
        if (mode === 'stratified') {
            nPacRegion = Math.max(0, Math.min(parseInt(nPacRegion, 10), nMax));
        }
        var nTandemOnly = (mode === 'stratified') ? (nMax - nPacRegion) : 0;
        var hasPacInRegion = (mode === 'stratified')
            ? (nPacRegion >= 1 && T.pac)
            : (nMax >= 2 && T.pac);
        var nTandemTail = (mode === 'stratified') ? nTandemOnly : (nMax >= 1 && T.tandem ? 1 : 0);
        var nRegular = nMax - (hasPacInRegion ? 1 : 0) - nTandemTail;
        if (nRegular < 0) nRegular = 0;

        // Templates principaux non-PAC, non-tandem
        var main = [
            { e: mk('vr_mv',      { nbPara: 4, sepDist: 100, name: 'Gros groupe VR' }),       rank: 1, pos: 1 },
            { e: mk('ff_mv',      { nbPara: 4, sepDist: 100, name: 'Gros groupe Freefly' }),  rank: 2, pos: 3 },
            { e: mk('track_mv',   { nbPara: 2, sepDist: 100, name: 'Groupe tracking' }),      rank: 3, pos: 5 },
            { e: mk('eleve_15',   null),                                                       rank: 4, pos: 7 },
            { e: mk('eleve_drift',null),                                                       rank: 5, pos: 8 }
        ].filter(function (t) { return t.e; });

        var solos = [
            mk('vr_mv',    { nbPara: 1, sepDist: 0, name: 'Solo VR' }),
            mk('ff_mv',    { nbPara: 1, sepDist: 0, name: 'Solo Freefly' }),
            mk('track_mv', { nbPara: 1, sepDist: 0, name: 'Solo tracking' })
        ].filter(function (e) { return e; });

        var ranked = main.slice().sort(function (a, b) { return a.rank - b.rank; });
        var picked = ranked.slice(0, Math.min(nRegular, ranked.length));

        // Solos remplisseurs intercalés (positions fractionnaires entre
        // les groupes principaux).
        var extra = nRegular - picked.length;
        for (var i = 0; i < extra; i++) {
            var s = clone(solos[i % solos.length]);
            if (i >= solos.length) s.name = s.name + ' #' + (Math.floor(i / solos.length) + 2);
            var slotIndex = i % 3;
            var bumpInside = Math.floor(i / 3);
            var basePos = [1.5, 3.5, 5.5][slotIndex];
            picked.push({ e: s, rank: 99, pos: basePos + 0.05 * bumpInside });
        }

        picked.sort(function (a, b) { return a.pos - b.pos; });
        var stick = picked.map(function (t) { return clone(t.e); });

        if (hasPacInRegion) stick.push(clone(T.pac));

        // Zone tandem-only : N tandems alignés en queue
        if (T.tandem) {
            for (var ti = 0; ti < nTandemTail; ti++) {
                var tnd = clone(T.tandem);
                if (ti > 0) tnd.name = (T.tandem.name || 'Tandem') + ' #' + (ti + 1);
                stick.push(tnd);
            }
        }
        return stick;
    }

    function _applyV3Proposal(idx) {
        var st = window._v3LastResult;
        if (!st || !st.result.proposals[idx]) return;
        var p = st.result.proposals[idx];

        function setVal(id, v) {
            var e = document.getElementById(id);
            if (e) {
                e.value = v;
                // Fire change/input so app.js listeners pick it up
                e.dispatchEvent(new Event('input', { bubbles: true }));
                e.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        setVal('axe_largage', Math.round(p.axe));
        setVal('cross_track_nm', p.crossNm.toFixed(2));
        setVal('top_largage_nm', p.topNm.toFixed(2));
        setVal('delai_top_vert', '0');
        setVal('espacement_m', Math.round(p.espacementM));

        // Le worker a déjà construit le stick optimal pour cette
        // proposition (stick type + fillers + cap réaliste sur le temps
        // cumulé). On l'installe tel quel dans jumpersList.
        if (p.stick && p.stick.length && typeof jumpersList !== 'undefined') {
            jumpersList.length = 0;
            p.stick.forEach(function (j) {
                jumpersList.push(JSON.parse(JSON.stringify(j)));
            });
            if (typeof buildJumpers === 'function') buildJumpers();
        }

        if (typeof updateAxisAngle === 'function') updateAxisAngle(p.axe);
        if (typeof runSimulation === 'function') runSimulation();

        // Ghost markers : on n'affiche QUE les top fins alternatifs
        // (tandem, PAC) — le top vert et le top fin principal sont déjà
        // rendus par les marqueurs natifs greenMarker/redMarker du flux
        // standard de simulation.
        _drawV3GhostMarkers(p);
    }

    var _v3GhostLayer = null;
    function _drawV3GhostMarkers(p) {
        var mapObj = window._map || (typeof map !== 'undefined' ? map : null);
        if (!mapObj) return;

        // Clean previous ghost layer
        if (_v3GhostLayer) {
            try { mapObj.removeLayer(_v3GhostLayer); } catch (e) { }
            _v3GhostLayer = null;
        }

        var dz = typeof getDZ === 'function' ? getDZ() : null;
        var target = (typeof currentTarget !== 'undefined') ? currentTarget : null;
        if (!dz || !target) return;

        var axeRad = p.axe * Math.PI / 180;
        var trackE = Math.sin(axeRad), trackN = Math.cos(axeRad);
        var perpE = trackN, perpN = -trackE;
        var crossM = p.crossNm * 1852;

        var cosLat = Math.cos(dz.lat * Math.PI / 180);
        var tgtE = (target.lon - dz.lon) * 111320 * cosLat;
        var tgtN = (target.lat - dz.lat) * 111320;
        var baseE = tgtE + crossM * perpE;
        var baseN = tgtN + crossM * perpN;

        function en2ll(e, n) {
            return [dz.lat + n / 111320, dz.lon + e / (111320 * cosLat)];
        }
        function pointAt(sNm) {
            var sM = sNm * 1852;
            return en2ll(baseE + trackE * sM, baseN + trackN * sM);
        }

        var layer = L.layerGroup().addTo(mapObj);
        _v3GhostLayer = layer;

        function ghost(latlng, html, tip) {
            return L.marker(latlng, {
                icon: L.divIcon({
                    className: '',
                    html: html,
                    iconSize: [22, 22], iconAnchor: [11, 11]
                }),
                zIndexOffset: 800,
                interactive: true
            }).bindTooltip(tip, { direction: 'top', permanent: false });
        }

        // Le greenMarker/redMarker natifs montrent déjà top vert et le
        // top fin EFFECTIF (le plus permissif des deux ancres). On
        // ajoute ici un ghost UNIQUEMENT pour le top fin alternatif
        // (l'ancre la plus restrictive) afin de visualiser les deux
        // « rouges » distincts du largage : PAC duo en premier, tandem
        // en dernier.
        var altFin = null, altLabel = null, altNmax = null;
        if (p.topFinTandemNm != null && p.topFinPacNm != null) {
            if (p.topFinPacNm < p.topFinTandemNm) {
                // Cas typique : PAC plus restrictif → ghost = PAC, label "Premier rouge"
                altFin = p.topFinPacNm; altLabel = 'Premier rouge (dernier PAC duo)'; altNmax = p.nMaxIfPac;
            } else if (p.topFinTandemNm < p.topFinPacNm) {
                // Cas inverse : tandem plus restrictif → ghost = tandem
                altFin = p.topFinTandemNm; altLabel = 'Premier rouge (dernier tandem)'; altNmax = p.nMaxIfTandem;
            }
        }
        if (altFin != null) {
            layer.addLayer(ghost(pointAt(altFin),
                '<div style="font-size:18px;line-height:1;opacity:0.7">🔴</div>',
                '🔴 ' + altLabel + ' — ' + altFin.toFixed(2) + ' NM, N max ' + altNmax));
        }
    }

    function _kpi(label, value, cls, sub) {
        return '<div class="bg-slate-900/50 rounded-lg p-2">' +
            '<div class="text-[8px] text-slate-500 uppercase mb-0.5">' + label + '</div>' +
            '<div class="font-black ' + cls + '">' + value + '</div>' +
            (sub ? '<div class="text-[8px] text-slate-500 mt-0.5">' + sub + '</div>' : '') +
            '</div>';
    }

    function _displayMCResults(mc, cfg) {
        var section = document.getElementById('mc_section');
        var banner = document.getElementById('mc_verdict_banner');
        var icon = document.getElementById('mc_verdict_icon');
        var text = document.getElementById('mc_verdict_text');
        var detail = document.getElementById('mc_verdict_detail');
        var table = document.getElementById('mc_jumper_table');
        var probBadge = document.getElementById('mc_prob_badge');

        var styles = {
            GO: { bg: '#065f4644', border: '#059669', icon: '🟢', badgeBg: '#06503044', badgeFg: '#34d399' },
            ACCEPTABLE: { bg: '#065f4644', border: '#059669', icon: '🟢', badgeBg: '#06503044', badgeFg: '#34d399' },
            MARGINAL: { bg: '#78350f44', border: '#d97706', icon: '🟡', badgeBg: '#78350f44', badgeFg: '#fbbf24' },
            WARN: { bg: '#78350f44', border: '#d97706', icon: '🟡', badgeBg: '#78350f44', badgeFg: '#fbbf24' },
            NOGO: { bg: '#7f1d1d44', border: '#dc2626', icon: '🔴', badgeBg: '#7f1d1d44', badgeFg: '#f87171' },
            CRITICAL: { bg: '#7f1d1d44', border: '#dc2626', icon: '⚠️', badgeBg: '#7f1d1d44', badgeFg: '#f87171' }
        };

        // Build the dual-criterion banner content
        var sR = styles[mc.reachVerdict] || styles.NOGO;
        var sS = styles[mc.safetyVerdict] || styles.NOGO;
        var sC = styles[mc.criticalVerdict] || styles.CRITICAL;

        if (banner) {
            // Use the worst of the three to colour the outer frame
            var worstVerdict = (mc.criticalVerdict === 'CRITICAL' || mc.reachVerdict === 'NOGO' ||
                mc.safetyVerdict === 'NOGO') ? 'NOGO'
                : (mc.criticalVerdict === 'WARN' || mc.reachVerdict === 'MARGINAL' ||
                    mc.safetyVerdict === 'MARGINAL') ? 'MARGINAL'
                : 'GO';
            var sw = styles[worstVerdict];
            banner.style.background = sw.bg;
            banner.style.borderColor = sw.border;
        }
        if (icon) icon.textContent = ''; // we'll embed icons inline
        if (text) {
            text.innerHTML =
                '<span style="display:flex;justify-content:space-around;gap:6px;font-size:11px;">' +
                '<span style="display:flex;flex-direction:column;align-items:center;">' +
                '  <span style="color:' + sR.border + ';font-weight:900;">' + sR.icon + ' POSÉ</span>' +
                '  <span style="font-size:14px;font-weight:900;color:' + sR.border + ';">' + Math.round(mc.reachProb * 100) + '%</span>' +
                '  <span style="font-size:8px;color:#94a3b8;">atteint</span>' +
                '</span>' +
                '<span style="display:flex;flex-direction:column;align-items:center;">' +
                '  <span style="color:' + sS.border + ';font-weight:900;">' + sS.icon + ' SÉCU</span>' +
                '  <span style="font-size:14px;font-weight:900;color:' + sS.border + ';">' + Math.round(mc.safetyProb * 100) + '%</span>' +
                '  <span style="font-size:8px;color:#94a3b8;">≥' + Math.round(mc.safetyThresh) + 'm</span>' +
                '</span>' +
                '<span style="display:flex;flex-direction:column;align-items:center;">' +
                '  <span style="color:' + sC.border + ';font-weight:900;">' + sC.icon + ' CRIT</span>' +
                '  <span style="font-size:14px;font-weight:900;color:' + sC.border + ';">' + (mc.criticalRisk * 100).toFixed(2) + '%</span>' +
                '  <span style="font-size:8px;color:#94a3b8;">&lt;' + Math.round(mc.criticalThresh) + 'm</span>' +
                '</span>' +
                '</span>';
            text.style.color = '';
        }
        if (detail) {
            var pairsTxt = '';
            if (mc.pairStats && mc.pairStats.length) {
                var worstPair = mc.pairStats[0]; // sorted by p5 ascending
                pairsTxt = ' | Paire la + critique : P' + (worstPair.idxA + 1) + '↔P' + (worstPair.idxB + 1) +
                    ' (P5=' + Math.round(worstPair.p5) + 'm)';
            }
            detail.innerHTML = mc.N + ' itérations | σ=±' + (mc.params && mc.params.sigmaScale ? mc.params.sigmaScale : 2) + 'σ' + pairsTxt;
        }
        if (probBadge) {
            // Combined verdict in the header badge
            var sw2 = styles[mc.verdict] || styles.NOGO;
            probBadge.textContent = mc.verdict;
            probBadge.style.background = sw2.badgeBg;
            probBadge.style.color = sw2.badgeFg;
        }
        if (section) section.style.display = '';
        if (banner) banner.classList.remove('hidden');

        // Per-jumper marges + per-pair separation distances
        if (table) {
            var thtml =
                '<div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:2px;">Marges zone de posé par parachutiste</div>' +
                '<table style="width:100%;font-size:10px;color:#475569;border-collapse:collapse;">' +
                '<thead><tr style="font-size:9px;text-transform:uppercase;color:#64748b;">' +
                '<th style="text-align:left;padding:4px 6px;">Para</th>' +
                '<th>P5</th><th>P50</th><th>P95</th></tr></thead><tbody>';
            mc.jumperStats.forEach(function (js, idx) {
                var p5col = js.margeP5 < 0 ? '#ef4444' : '#10b981';
                thtml += '<tr style="border-top:1px solid #e2e8f0;">' +
                    '<td style="padding:3px 6px;font-weight:700;color:#1e293b;">P' + (idx + 1) + '</td>' +
                    '<td style="text-align:center;color:' + p5col + ';font-weight:700;">' + Math.round(js.margeP5) + 'm</td>' +
                    '<td style="text-align:center;">' + Math.round(js.margeP50) + 'm</td>' +
                    '<td style="text-align:center;">' + Math.round(js.margeP95) + 'm</td>' +
                    '</tr>';
            });
            thtml += '</tbody></table>';

            if (mc.pairStats && mc.pairStats.length) {
                thtml += '<div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:700;margin:8px 0 2px;">Séparation inter-paires (distance min horizontale)</div>' +
                    '<table style="width:100%;font-size:10px;color:#475569;border-collapse:collapse;">' +
                    '<thead><tr style="font-size:9px;text-transform:uppercase;color:#64748b;">' +
                    '<th style="text-align:left;padding:4px 6px;">Paire</th>' +
                    '<th>P5</th><th>P50</th>' +
                    '<th title="P(distance < seuil sécu)">P&lt;' + Math.round(mc.safetyThresh) + 'm</th>' +
                    '<th title="P(distance < seuil critique)">P&lt;' + Math.round(mc.criticalThresh) + 'm</th>' +
                    '</tr></thead><tbody>';
                // Show top 8 worst pairs (sorted by p5 ascending)
                mc.pairStats.slice(0, 8).forEach(function (pa) {
                    var p5col = pa.p5 < mc.safetyThresh ? '#ef4444' : (pa.p5 < mc.safetyThresh * 1.5 ? '#f59e0b' : '#10b981');
                    var critCol = pa.pCritical > 0.001 ? '#ef4444' : '#10b981';
                    var unsafeCol = pa.pUnsafe > 0.01 ? '#ef4444' : '#10b981';
                    thtml += '<tr style="border-top:1px solid #e2e8f0;">' +
                        '<td style="padding:3px 6px;font-weight:700;color:#1e293b;">P' + (pa.idxA + 1) + '↔P' + (pa.idxB + 1) + '</td>' +
                        '<td style="text-align:center;color:' + p5col + ';font-weight:700;">' + Math.round(pa.p5) + 'm</td>' +
                        '<td style="text-align:center;">' + Math.round(pa.p50) + 'm</td>' +
                        '<td style="text-align:center;color:' + unsafeCol + ';font-weight:700;">' + (pa.pUnsafe * 100).toFixed(1) + '%</td>' +
                        '<td style="text-align:center;color:' + critCol + ';font-weight:700;">' + (pa.pCritical * 100).toFixed(2) + '%</td>' +
                        '</tr>';
                });
                thtml += '</tbody></table>';
                if (mc.pairStats.length > 8) {
                    thtml += '<div style="font-size:8px;color:#94a3b8;margin-top:2px;">… ' + (mc.pairStats.length - 8) + ' autres paires moins critiques</div>';
                }
            }
            table.innerHTML = thtml;
            table.classList.remove('hidden');
        }

        // Store MC result for ellipse toggle / tube / sigma rescale
        window._lastMcResult = mc;
        window._lastMcDz = typeof getDZ === 'function' ? getDZ() : (cfg.dz || {});

        // Ellipses on map (respect toggle state)
        var mapObj = window._map || (typeof map !== 'undefined' ? map : null);
        if (mapObj && window._ellipsesVisible !== false) {
            MonteCarlo.drawEllipses(mapObj, mc, window._lastMcDz);
        }
        // Trajectory tube if user has toggled it on
        var tubeBox = document.getElementById('mc_show_tube');
        if (mapObj && tubeBox && tubeBox.checked) {
            MonteCarlo.drawTrajectoryUncertainty(mapObj, mc, window._lastMcDz);
        }
    }

    // ── PUBLIC API ─────────────────────────────────────────────
    window.UIOptimizer = {
        init: injectUI,
        refreshNFZ: _updateNFZList,
        editNFZ: _editNFZ,
        removeNFZ: _removeNFZ,
        updateNFZ: _updateNFZField,
        runMCStandalone: _onRunMCStandalone,
        readMCOptions: _readMCOptions,
        buildBaseCfg: _buildBaseCfg,
        renderTrajectoryTube: _renderTrajectoryTube,
        renderHeatmap: _renderHeatmap,
        applyV3: _applyV3Proposal
    };

    // Auto-inject when DOM is ready
    document.addEventListener('DOMContentLoaded', function () {
        if (document.getElementById('optimizer_v2_container'))
            injectUI('optimizer_v2_container');
    });
})();
