// ================================================================
//  CHARTS — D3 Visualizations
//  Wind Barbs, Airgram, Transversal Profile, Distance Chart
// ================================================================

// ================================================================
//  WIND BARB DRAWING (WMO style)
// ================================================================
function drawWindBarb(g, cx, cy, speedKt, fromDeg, opts) {
    var barbColor = (opts && opts.color) || '#1e3a8a';
    var interactive = opts && opts.interactive;
    if (speedKt < 3) {
        g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 5)
            .attr('fill', 'none').attr('stroke', barbColor).attr('stroke-width', 2);
        return null;
    }
    var barbG = g.append('g')
        .attr('class', 'wind-barb-g')
        .attr('transform', 'translate(' + cx + ',' + cy + ') rotate(' + fromDeg + ')');
    var staffLen = 30, barbLen = 14, halfBarbLen = 7, spacing = 5;
    barbG.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', -staffLen)
        .attr('stroke', barbColor).attr('stroke-width', 2).attr('stroke-linecap', 'round');
    barbG.append('circle').attr('cx', 0).attr('cy', 0).attr('r', 2.5).attr('fill', barbColor);

    var spd = Math.round(speedKt / 5) * 5;
    var yPos = -staffLen;
    while (spd >= 50) {
        barbG.append('polygon')
            .attr('points', '0,' + yPos + ' ' + barbLen + ',' + (yPos + spacing * 0.5) + ' 0,' + (yPos + spacing))
            .attr('fill', barbColor);
        yPos += spacing; spd -= 50;
    }
    while (spd >= 10) {
        barbG.append('line').attr('x1', 0).attr('y1', yPos)
            .attr('x2', barbLen).attr('y2', yPos + spacing * 0.4)
            .attr('stroke', barbColor).attr('stroke-width', 2).attr('stroke-linecap', 'round');
        yPos += spacing; spd -= 10;
    }
    if (spd >= 5) {
        barbG.append('line').attr('x1', 0).attr('y1', yPos)
            .attr('x2', halfBarbLen).attr('y2', yPos + spacing * 0.3)
            .attr('stroke', barbColor).attr('stroke-width', 2).attr('stroke-linecap', 'round');
    }

    // Drag handle at tip of staff (visible on hover)
    if (interactive) {
        barbG.append('circle')
            .attr('class', 'barb-tip-handle')
            .attr('cx', 0).attr('cy', -staffLen)
            .attr('r', 8)
            .attr('fill', '#3b82f6').attr('fill-opacity', 0)
            .attr('stroke', '#3b82f6').attr('stroke-width', 0).attr('stroke-dasharray', '3,2')
            .attr('cursor', 'grab');
    }

    return barbG;
}

// ================================================================
//  CLOUD SHAPE
// ================================================================
function drawCloudShape(g, cx, cy, w, h, opacity) {
    if (opacity < 0.02) return;
    var cloud = g.append('g').attr('opacity', Math.min(1, opacity));
    var rx = w / 2, ry = h / 2;

    // SVG Path for a fluffy cloud
    var pathData = "M" + (cx - rx) + "," + cy +
        " c0," + (-ry * 1.2) + " " + (rx * 0.5) + "," + (-ry * 1.5) + " " + (rx) + "," + (-ry * 0.5) +
        " c" + (rx * 0.6) + "," + (-ry * 0.8) + " " + (rx * 1.5) + "," + (ry * 0.2) + " " + (rx * 0.8) + "," + (ry * 0.8) +
        " c" + (rx * 0.4) + "," + (ry * 0.8) + " -" + (rx * 0.4) + "," + (ry * 1.2) + " -" + (rx * 1.0) + "," + (ry * 0.8) +
        " c-" + (rx * 0.4) + "," + (ry * 0.6) + " -" + (rx * 1.2) + "," + (ry * 0.2) + " -" + (rx * 0.8) + ",-" + (ry * 0.8) +
        " Z";

    cloud.append('path')
        .attr('d', pathData)
        .attr('fill', '#ffffff')
        .attr('stroke', '#cbd5e1')
        .attr('stroke-width', 0.5);
}

// ================================================================
//  COMBINED AIRGRAM
// ================================================================
function createAirgramChart() {
    if (typeof d3 === 'undefined') return; // Fallback if CDN fails
    var container = d3.select('#airgram-chart');
    if (container.empty()) return; // Safety check
    container.selectAll('*').remove();
    if (!windProfile || !windProfile.length) return;

    var dz = getDZ();
    var elevM = dz.elev;

    var node = container.node();
    if (!node) return;
    var W = node.clientWidth || 380;
    var H = node.clientHeight || 320;
    if (H < 150) H = 320; // fallback if container has no set height
    var mg = { top: 50, right: 55, bottom: 45, left: 50 };
    var cw = W - mg.left - mg.right;
    var ch = H - mg.top - mg.bottom;
    var svg = container.append('svg').attr('width', W).attr('height', H);
    var defs = svg.append('defs');
    var grad = defs.append('linearGradient').attr('id', 'skyGrad').attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#0c1445').attr('stop-opacity', 0.6);
    grad.append('stop').attr('offset', '45%').attr('stop-color', '#1e3a5f').attr('stop-opacity', 0.35);
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#87ceeb').attr('stop-opacity', 0.15);

    var g = svg.append('g').attr('transform', 'translate(' + mg.left + ',' + mg.top + ')');

    var maxZ = Math.max(elevM + 5000, d3.max(windProfile, function (d) { return d.z; }) * 1.1);
    var yScale = d3.scaleLinear().domain([elevM, maxZ]).range([ch, 0]);

    defs.append('clipPath').attr('id', 'airgramClip')
        .append('rect').attr('x', -10).attr('y', -10).attr('width', cw + 20).attr('height', ch + 10);
    var gClipped = g.append('g').attr('clip-path', 'url(#airgramClip)');

    gClipped.append('rect').attr('x', 0).attr('y', 0).attr('width', cw).attr('height', ch)
        .attr('fill', 'url(#skyGrad)').attr('rx', 6);

    g.append('line').attr('x1', 0).attr('x2', cw).attr('y1', ch).attr('y2', ch)
        .attr('stroke', '#2d5a27').attr('stroke-width', 3);
    g.append('rect').attr('x', 0).attr('y', ch - 4).attr('width', cw).attr('height', 4)
        .attr('fill', '#4a7c3f').attr('opacity', 0.5);
    g.append('text').attr('x', cw / 2).attr('y', ch + 12)
        .attr('text-anchor', 'middle').attr('font-size', 8).attr('fill', '#2d5a27').attr('font-weight', '700')
        .text('SOL — 0m (' + elevM + 'm AMSL)');

    var tempColor = d3.scaleLinear()
        .domain([-30, -15, 0, 15, 30, 45])
        .range(['#1e3a5f', '#3b82f6', '#22d3ee', '#fbbf24', '#ef4444', '#7f1d1d'])
        .clamp(true);

    // Temperature colored bands (adapted to reversed windProfile [p500 -> p1000])
    for (var bi = 0; bi < windProfile.length - 1; bi++) {
        var pTop = windProfile[bi], pBot = windProfile[bi + 1];
        var bandTopZ = pTop.z, bandBotZ = pBot.z;
        if (bandBotZ < elevM && bandTopZ < elevM) continue;

        var yTop = yScale(Math.max(bandTopZ, elevM));
        var yBot = yScale(Math.max(bandBotZ, elevM));
        var h = yBot - yTop;
        if (h <= 0) continue;

        var avgT = (pTop.temp + pBot.temp) / 2;
        gClipped.append('rect').attr('x', 0).attr('y', yTop).attr('width', cw).attr('height', h)
            .attr('fill', tempColor(avgT)).attr('opacity', 0.15).attr('rx', 0);

        // Horizontal pressure divider line
        gClipped.append('line').attr('x1', 0).attr('x2', cw).attr('y1', yBot).attr('y2', yBot)
            .attr('stroke', tempColor(pBot.temp)).attr('stroke-width', 1).attr('stroke-dasharray', '4,3').attr('opacity', 0.2);
    }

    // Cloud layers (Move before text/lines for background/Z-order)
    var cloudG = gClipped.append('g').attr('id', 'clouds-layer');

    function drawScatteredClouds(parentG, cx, cy, totalW, totalH, pct) {
        var nSlots = 20; // 20 slots across total width
        var nFilled = Math.round(pct / 100 * nSlots);
        if (nFilled < 1 && pct > 0) nFilled = 1;

        var cols = 20;
        var cellW = totalW / cols;
        var puffRx = cellW * 0.45;
        var puffRy = totalH * 0.4;

        // Random-ish order for distribution
        var order = [0, 10, 5, 15, 2, 12, 7, 17, 1, 11, 6, 16, 4, 14, 9, 19, 3, 13, 8, 18];
        for (var si = 0; si < nSlots; si++) {
            if (si < nFilled) {
                var slot = order[si];
                var px = cx - totalW / 2 + slot * cellW + cellW / 2;
                var py = cy; // Keep on the line or middle of band

                // Shadow
                parentG.append('ellipse').attr('cx', px + 1).attr('cy', py + 1)
                    .attr('rx', puffRx).attr('ry', puffRy).attr('fill', '#94a3b8').attr('opacity', 0.3);
                // White puff
                parentG.append('ellipse').attr('cx', px).attr('cy', py)
                    .attr('rx', puffRx).attr('ry', puffRy).attr('fill', '#ffffff').attr('opacity', 0.85);
            }
        }
    }

    var hasPerLevel = windProfile.some(function (pt) { return (pt.cloud || 0) > 0; });

    if (hasPerLevel) {
        windProfile.forEach(function (pt, idx) {
            if (pt.z < elevM) return;
            var y = yScale(pt.z);
            var cloudPct = pt.cloud || 0;
            var nextZ = idx < windProfile.length - 1 ? windProfile[idx + 1].z : (pt.z + 500);
            var prevZ = idx > 0 ? windProfile[idx - 1].z : elevM;
            var bandH = Math.max(Math.abs(yScale(nextZ) - yScale(prevZ)) * 0.4, 20);
            drawScatteredClouds(cloudG, cw / 2, y, cw, bandH, cloudPct);
        });
    }

    var altTicks = [0, 500, 1000, 1500, 2000, 3000, 4000, 5000].map(function (h) { return h + elevM; });
    var heightTicks = [0, 500, 1000, 1500, 2000, 3000, 4000, 5000];

    // Jump level reference lines
    var refLevels = [1000, 1500, 2500, 3200];
    var qnh = meteoData.qnh || parseFloat(document.getElementById('qnh_val').value) || 1013.25;
    refLevels.forEach(function (h) {
        var amslM = h + elevM;
        // Approximate FL: FL = (Hp ft) / 100
        // Hp = Alt + (1013.25 - qnh) * 28 ft
        var hpFt = (amslM / 0.3048) + (1013.25 - qnh) * 28;
        var fl = Math.round(hpFt / 100);
        var ry = yScale(amslM);
        if (ry >= 0 && ry <= ch) {
            gClipped.append('line').attr('x1', 0).attr('x2', cw).attr('y1', ry).attr('y2', ry)
                .attr('stroke', '#475569').attr('stroke-width', 1.2).attr('stroke-dasharray', '4,3');
            gClipped.append('text').attr('x', cw - 5).attr('y', ry - 4)
                .attr('text-anchor', 'end').attr('font-size', 11).attr('fill', '#334155').attr('font-weight', '900')
                .text('FL' + fl);
        }
    });

    // Selected Jumping altitude line
    var flJump = parseFloat(document.getElementById('fl_jump').value) || 140;
    var dropAltM = flJump * 100 * 0.3048 + (qnh - 1013.25) * 8.43;
    if (dropAltM <= maxZ && dropAltM >= elevM) {
        var dropY = yScale(dropAltM);
        gClipped.append('line').attr('x1', 0).attr('x2', cw).attr('y1', dropY).attr('y2', dropY)
            .attr('stroke', '#f97316').attr('stroke-width', 3).attr('stroke-dasharray', '12,6');
        gClipped.append('text').attr('x', cw * 0.50 + 4).attr('y', dropY - 6)
            .attr('font-size', 13).attr('font-weight', '950').attr('fill', '#ea580c')
            .text('🚀 FL' + Math.round(flJump) + ' ~' + Math.round(dropAltM - elevM) + 'm');
    }

    // 0°C line
    if (windProfile.length >= 2) {
        for (var fi = 0; fi < windProfile.length - 1; fi++) {
            if ((windProfile[fi].temp >= 0 && windProfile[fi + 1].temp < 0) ||
                (windProfile[fi].temp < 0 && windProfile[fi + 1].temp >= 0)) {
                var fFrac = Math.abs(windProfile[fi].temp) / Math.abs(windProfile[fi + 1].temp - windProfile[fi].temp);
                var frzZ = windProfile[fi].z + fFrac * (windProfile[fi + 1].z - windProfile[fi].z);
                if (frzZ > elevM) {
                    var frzY = yScale(frzZ);
                    gClipped.append('line').attr('x1', 0).attr('x2', cw).attr('y1', frzY).attr('y2', frzY)
                        .attr('stroke', '#22d3ee').attr('stroke-width', 2).attr('stroke-dasharray', '8,4');
                    gClipped.append('text').attr('x', cw * 0.50 + 4).attr('y', frzY + 14)
                        .attr('font-size', 8).attr('fill', '#22d3ee').attr('font-weight', '700').text('❄️ 0°C ~' + Math.round(frzZ - elevM) + 'm');
                }
                break;
            }
        }
    }

    // Per-level data — store barb groups for interactivity
    var barbGroups = [];
    var barbCx = cw * 0.17;
    windProfile.forEach(function (pt, idx) {
        if (pt.z < elevM) return;
        var y = yScale(pt.z);
        gClipped.append('line').attr('x1', 0).attr('x2', cw * 0.50).attr('y1', y).attr('y2', y)
            .attr('stroke', '#cbd5e1').attr('stroke-width', 1).attr('opacity', 0.4);

        var barbG = drawWindBarb(gClipped, barbCx, y, pt.spd, pt.dir, { interactive: true });
        if (barbG) {
            barbGroups.push({ g: barbG, idx: idx, cx: barbCx, cy: y });
        }
    });

    // Cloud shapes - Moved to a background group
    var gClouds = gClipped.append('g').attr('class', 'cloud-background');
    var gForeground = gClipped.append('g').attr('class', 'foreground-elements');

    var cloudX = 0;
    var cloudW = cw;

    function drawScatteredClouds(parentG, cx, cy, totalW, totalH, pct) {
        var nSlots = 20;
        var nFilled = Math.round(pct / 100 * nSlots);
        if (nFilled < 1 && pct > 0) nFilled = 1;
        var cols = 10, rows = 2;
        var cellW = totalW / cols;
        var cellH = totalH / rows;

        // Logical distribution for 20 slots
        var order = [0, 10, 5, 15, 2, 12, 7, 17, 4, 14, 9, 19, 1, 11, 6, 16, 3, 13, 8, 18];

        var cloudPath = "M25,60 C15,60 5,50 5,40 C5,30 15,20 25,20 C27,10 40,5 50,5 C62,5 73,12 75,22 C85,20 95,25 95,35 C95,45 85,55 75,55 L25,55 Z";

        for (var si = 0; si < nSlots; si++) {
            var slot = order[si];
            var col = slot % cols;
            var row = Math.floor(slot / cols);
            var px = cx - totalW / 2 + col * cellW + cellW / 2;
            var py = cy - totalH / 2 + row * cellH + cellH / 2;

            if (si < nFilled) {
                var scale = Math.min(cellW, cellH) / 60 * 0.8;
                parentG.append('path')
                    .attr('d', cloudPath)
                    .attr('transform', 'translate(' + (px - 50 * scale) + ',' + (py - 30 * scale) + ') scale(' + scale + ')')
                    .attr('fill', '#ffffff')
                    .attr('stroke', '#cbd5e1')
                    .attr('stroke-width', 1)
                    .attr('opacity', 0.6);
            }
        }
    }

    var hasPerLevel = windProfile.some(function (pt) { return (pt.cloud || 0) > 0; });

    if (hasPerLevel) {
        windProfile.forEach(function (pt, idx) {
            if (pt.z < elevM) return;
            var y = yScale(pt.z);
            var cloudPct = pt.cloud || 0;
            var nextZ = idx < windProfile.length - 1 ? windProfile[idx + 1].z : maxZ;
            var prevZ = idx > 0 ? windProfile[idx - 1].z : elevM;
            var bandTop = yScale((pt.z + nextZ) / 2);
            var bandBot = yScale(Math.max((pt.z + prevZ) / 2, elevM));
            var bandH = Math.max(Math.abs(bandBot - bandTop) * 0.8, 18);

            drawScatteredClouds(gClouds, cw / 2, y, cw, bandH, cloudPct);

            var pctColor = cloudPct < 25 ? '#22c55e' : cloudPct < 50 ? '#3b82f6' : cloudPct < 75 ? '#f59e0b' : '#ef4444';
            gForeground.append('text').attr('x', cw - 30).attr('y', y + 4)
                .attr('text-anchor', 'end').attr('font-size', 10).attr('font-weight', '800')
                .attr('fill', pctColor).text(cloudPct + '%');
        });
    } else {
        var cloudLayers = [
            { label: 'High ☁', pct: meteoData.cloud_high || 0, zMin: hpa2alt(500), zMax: maxZ },
            { label: 'Mid ☁', pct: meteoData.cloud_mid || 0, zMin: hpa2alt(700), zMax: hpa2alt(500) },
            { label: 'Low ☁', pct: meteoData.cloud_low || 0, zMin: 0, zMax: hpa2alt(850) },
        ];
        cloudLayers.forEach(function (cl) {
            var cy1 = yScale(Math.min(cl.zMax, maxZ)), cy2 = yScale(Math.max(cl.zMin, elevM));
            var midY = (cy1 + cy2) / 2;
            var bandH = Math.abs(cy2 - cy1) * 0.5;

            drawScatteredClouds(gClouds, cw / 2, midY, cw, bandH, cl.pct);

            var pctColor2 = cl.pct < 33 ? '#22c55e' : cl.pct < 66 ? '#f59e0b' : '#ef4444';
            gForeground.append('text').attr('x', cw - 30).attr('y', midY + 4)
                .attr('text-anchor', 'end').attr('font-size', 11).attr('font-weight', '800')
                .attr('fill', pctColor2).text(cl.pct + '%');
        });
    }

    // LEFT Y axis: height AGL
    altTicks.forEach(function (altVal, idx) {
        var y = yScale(altVal);
        g.append('text').attr('x', -8).attr('y', y + 4)
            .attr('text-anchor', 'end').attr('font-size', 10).attr('fill', '#334155').attr('font-weight', '700')
            .text(heightTicks[idx] + 'm');
        g.append('line').attr('x1', -5).attr('x2', 0).attr('y1', y).attr('y2', y)
            .attr('stroke', '#94a3b8').attr('stroke-width', 1);
    });

    // RIGHT Y axis: pressure hPa
    var undergroundCount = 0;
    windProfile.forEach(function (pt) {
        if (pt.z < elevM) {
            var yGnd = ch + 12 + undergroundCount * 11;
            g.append('text').attr('x', cw + 8).attr('y', yGnd).attr('text-anchor', 'start')
                .attr('font-size', 8).attr('fill', '#94a3b8').attr('font-style', 'italic')
                .text(pt.hpa + ' hPa (sous sol)');
            undergroundCount++;
        } else {
            var y = yScale(pt.z);
            g.append('text').attr('x', cw + 8).attr('y', y + 4).attr('text-anchor', 'start')
                .attr('font-size', 10).attr('fill', '#475569').attr('font-weight', '700')
                .text(pt.hpa + ' hPa');
            g.append('line').attr('x1', cw).attr('x2', cw + 5).attr('y1', y).attr('y2', y)
                .attr('stroke', '#94a3b8').attr('stroke-width', 1);
        }
    });



    // Header (Simplified)
    var qnhVal = meteoData.qnh != null ? meteoData.qnh : 1013.25;
    svg.append('text').attr('x', mg.left + 5).attr('y', 20)
        .attr('font-size', 14).attr('font-weight', '900').attr('fill', '#1e40af')
        .text('QNH: ' + qnhVal.toFixed(1) + ' hPa');

    // ── INTERACTIVE WIND EDITING ─────────────────────────────────
    // Fluid drag on barb tip to rotate direction + aligned side speed inputs

    // Store yScale and margins for the side input column
    window._airgramLayout = { yScale: yScale, mg: mg, elevM: elevM, barbCx: barbCx };

    // 1) Attach drag behavior to each barb group's tip handle
    barbGroups.forEach(function (item) {
        var tipHandle = item.g.select('.barb-tip-handle');
        if (tipHandle.empty()) return;

        // Use a transparent overlay circle in the chart g space for correct coordinates
        var overlay = g.append('circle')
            .attr('cx', item.cx).attr('cy', item.cy).attr('r', 36)
            .attr('fill', 'transparent').attr('cursor', 'grab')
            .datum(item);

        var dragBehavior = d3.drag()
            .on('start', function (event) {
                var d = d3.select(this).datum();
                d._dragging = true;
                d.g.select('.barb-tip-handle')
                    .attr('fill-opacity', 0.3).attr('stroke-width', 2.5);
            })
            .on('drag', function (event) {
                var d = d3.select(this).datum();
                var dx = event.x - d.cx;
                var dy = event.y - d.cy;
                var angle = Math.atan2(dx, -dy) * 180 / Math.PI;
                if (angle < 0) angle += 360;
                angle = Math.round(angle / 5) * 5;
                if (angle === 0) angle = 360;

                // Fluid: just rotate the barb group — no full redraw
                d.g.attr('transform', 'translate(' + d.cx + ',' + d.cy + ') rotate(' + angle + ')');
                d._liveAngle = angle;
            })
            .on('end', function () {
                var d = d3.select(this).datum();
                d._dragging = false;
                d.g.select('.barb-tip-handle')
                    .attr('fill-opacity', 0).attr('stroke-width', 0);

                if (d._liveAngle != null) {
                    windProfile[d.idx].dir = d._liveAngle;
                    var dirInput = document.getElementById('wdir_' + d.idx);
                    if (dirInput) dirInput.value = d._liveAngle;
                    d._liveAngle = null;

                    // Full redraw + recompute only on release
                    createAirgramChart();
                    if (typeof recompute === 'function') recompute();
                }
            });

        overlay.call(dragBehavior);

        // Show tip handle when hovering the overlay
        overlay
            .on('mouseover', function () {
                var d = d3.select(this).datum();
                if (!d._dragging) {
                    d.g.select('.barb-tip-handle')
                        .attr('fill-opacity', 0.15).attr('stroke-width', 2);
                }
            })
            .on('mouseout', function () {
                var d = d3.select(this).datum();
                if (!d._dragging) {
                    d.g.select('.barb-tip-handle')
                        .attr('fill-opacity', 0).attr('stroke-width', 0);
                }
            });
    });

    // 2) Populate side wind speed input column — aligned with barb positions
    var inputCol = document.getElementById('wind_inputs_col');
    if (inputCol) {
        var html = '';
        windProfile.forEach(function (pt, idx) {
            if (pt.z < elevM) return;
            var yPos = yScale(pt.z);
            var topPx = mg.top + yPos - 11;
            html += '<div style="position:absolute;top:' + topPx + 'px;left:2px;right:2px;">' +
                '<input type="number" value="' + Math.round(pt.spd) + '" min="0" max="120" step="5"' +
                ' data-idx="' + idx + '"' +
                ' oninput="onAirgramSpdChange(this)"' +
                ' style="width:100%;padding:2px 1px;font-size:9px;font-weight:700;text-align:center;' +
                'border:1px solid #cbd5e1;border-radius:4px;background:#fff;color:#1e293b;' +
                'font-family:JetBrains Mono,monospace;outline:none;transition:border-color .15s;"' +
                ' onfocus="this.style.borderColor=\'#3b82f6\'" onblur="this.style.borderColor=\'#cbd5e1\'">' +
                '</div>';
        });
        inputCol.style.position = 'relative';
        inputCol.innerHTML = html;
    }
}

// Handler for speed input changes from the airgram side column
function onAirgramSpdChange(el) {
    var idx = parseInt(el.getAttribute('data-idx'));
    var val = parseFloat(el.value);
    if (isNaN(val) || isNaN(idx)) return;
    if (val < 0) val = 0;
    windProfile[idx].spd = val;

    // Sync hidden wind layer input
    var spdInput = document.getElementById('wspd_' + idx);
    if (spdInput) spdInput.value = Math.round(val);

    // Debounce the full redraw for fluid typing
    clearTimeout(window._airgramSpdTimer);
    window._airgramSpdTimer = setTimeout(function () {
        createAirgramChart();
        if (typeof recompute === 'function') recompute();
        // Re-focus the input after redraw
        var newEl = document.querySelector('#wind_inputs_col input[data-idx="' + idx + '"]');
        if (newEl) newEl.focus();
    }, 300);
}

// ================================================================
//  DISTANCE OVER TIME CHART (DEACTIVATED)
// ================================================================
function drawDistanceChart() {
    return; // Chart removed as requested
}

// ================================================================
//  TRANSVERSAL PROFILE (Side view)
// ================================================================
function drawTransversalChart() {
    if (typeof d3 === 'undefined') return; // Fallback if CDN fails
    var container = d3.select('#transversal-chart');
    if (container.empty()) return; // Safety check
    container.selectAll('*').remove();
    if (!simResults) return;

    var node = container.node();
    if (!node) return;
    var W = node.clientWidth || 800;
    var H = node.clientHeight || 260;
    if (H < 150) H = 260;
    var mg = { top: 30, right: 50, bottom: 50, left: 65 };
    var cw = W - mg.left - mg.right;
    var ch = H - mg.top - mg.bottom;
    var svg = container.append('svg').attr('width', W).attr('height', H);
    var g = svg.append('g').attr('transform', 'translate(' + mg.left + ',' + mg.top + ')');

    var trackE = simResults.trackE;
    var trackN = simResults.trackN;
    var elevM = simResults.elevM;

    var allAlongTrack = [];
    var allHeight = [];

    simResults.trajectories.forEach(function (t) {
        t.ff.forEach(function (s) { allAlongTrack.push(s[0] * trackE + s[1] * trackN); allHeight.push(s[2] - elevM); });
        t.canopy.forEach(function (s) { allAlongTrack.push(s[0] * trackE + s[1] * trackN); allHeight.push(s[2] - elevM); });
    });

    var padD = (d3.max(allAlongTrack) - d3.min(allAlongTrack)) * 0.08 + 100;
    var xMin = d3.min(allAlongTrack) - padD;
    var xMax = d3.max(allAlongTrack) + padD;
    var hMax = d3.max(allHeight) + 200;

    // Safety checks for NaN
    if (isNaN(xMin) || isNaN(xMax) || isNaN(hMax)) return;

    var xS = d3.scaleLinear().domain([xMin, xMax]).range([0, cw]);
    var yS = d3.scaleLinear().domain([0, hMax]).range([ch, 0]);
    window.transversalXS = xS; window.transversalYS = yS;


    // Ground
    g.append('rect').attr('x', 0).attr('y', yS(0)).attr('width', cw).attr('height', ch - yS(0))
        .attr('fill', '#4a7c3f').attr('opacity', 0.15);
    g.append('line').attr('x1', 0).attr('x2', cw).attr('y1', yS(0)).attr('y2', yS(0))
        .attr('stroke', '#2d5a27').attr('stroke-width', 2);

    // Grid
    xS.ticks(8).forEach(function (t) {
        g.append('line').attr('x1', xS(t)).attr('x2', xS(t)).attr('y1', 0).attr('y2', yS(0))
            .attr('stroke', '#1e2d47').attr('stroke-width', 1);
    });
    yS.ticks(8).forEach(function (t) {
        if (t < 0) return;
        g.append('line').attr('x1', 0).attr('x2', cw).attr('y1', yS(t)).attr('y2', yS(t))
            .attr('stroke', '#1e2d47').attr('stroke-width', 1);
    });

    // RV Zone representation (Box)
    var rvLen = parseFloat(document.getElementById('rv_length').value) || 100;
    var rvWid = parseFloat(document.getElementById('rv_width').value) || 50;
    var dz_r = simResults.dz;
    var rvE = (currentRV.lon - dz_r.lon) * 111320 * Math.cos(dz_r.lat * Math.PI / 180);
    var rvN = (currentRV.lat - dz_r.lat) * 111320;
    var corn = [
        { e: rvE - rvLen / 2, n: rvN - rvWid / 2 },
        { e: rvE + rvLen / 2, n: rvN - rvWid / 2 },
        { e: rvE - rvLen / 2, n: rvN + rvWid / 2 },
        { e: rvE + rvLen / 2, n: rvN + rvWid / 2 }
    ];
    var alns = corn.map(function (c) { return c.e * trackE + c.n * trackN; });
    var minX_rv = d3.min(alns), maxX_rv = d3.max(alns);
    var rvAlt = parseFloat(document.getElementById('gono_rv_alt').value) || 300;

    // RV Zone column
    var zTop = 1000;
    var zBase = 0;
    var rvW = Math.max(2, xS(maxX_rv) - xS(minX_rv));

    // Zone above rvAlt (default blue)
    g.append('rect')
        .attr('x', xS(minX_rv))
        .attr('y', yS(zTop))
        .attr('width', rvW)
        .attr('height', Math.max(0, yS(rvAlt) - yS(zTop)))
        .attr('fill', '#3b82f6').attr('fill-opacity', 0.1)
        .attr('stroke', '#3b82f6').attr('stroke-width', 1).attr('stroke-dasharray', '4,4');

    // Zone below rvAlt (Red/Alert)
    g.append('rect')
        .attr('x', xS(minX_rv))
        .attr('y', yS(rvAlt))
        .attr('width', rvW)
        .attr('height', Math.max(0, yS(zBase) - yS(rvAlt)))
        .attr('fill', '#ef4444').attr('fill-opacity', 0.15)
        .attr('stroke', '#ef4444').attr('stroke-width', 1).attr('stroke-dasharray', '4,4');

    // Horizontal line for target RV Alt
    g.append('line')
        .attr('x1', xS(minX_rv)).attr('x2', xS(maxX_rv))
        .attr('y1', yS(rvAlt)).attr('y2', yS(rvAlt))
        .attr('stroke', '#3b82f6').attr('stroke-width', 2).attr('stroke-dasharray', '2,1');

    // Aircraft line
    var jumpHeight = simResults.altM - elevM;
    var acMinD = d3.min(allAlongTrack) - padD * 0.5;
    var acMaxD = d3.max(allAlongTrack) + padD * 0.5;
    g.append('line').attr('x1', xS(acMinD)).attr('x2', xS(acMaxD))
        .attr('y1', yS(jumpHeight)).attr('y2', yS(jumpHeight))
        .attr('stroke', '#94a3b8').attr('stroke-width', 2).attr('stroke-dasharray', '10,5');

    // Green/Red lights
    if (simResults.gsMs && simResults.greenLightAlongTrack != null) {
        var xTop = xS(simResults.greenLightAlongTrack);
        var xFin = xS(simResults.redLightAlongTrack);
        g.append('line').attr('x1', xTop).attr('x2', xTop).attr('y1', 0).attr('y2', yS(0))
            .attr('stroke', '#22c55e').attr('stroke-width', 2.5).attr('stroke-dasharray', '8,4').attr('opacity', 0.85);
        g.append('circle').attr('cx', xTop).attr('cy', yS(jumpHeight)).attr('r', 7)
            .attr('fill', '#22c55e').attr('stroke', '#fff').attr('stroke-width', 1.5);
        g.append('line').attr('x1', xFin).attr('x2', xFin).attr('y1', 0).attr('y2', yS(0))
            .attr('stroke', '#ef4444').attr('stroke-width', 2.5).attr('stroke-dasharray', '8,4').attr('opacity', 0.85);
        g.append('circle').attr('cx', xFin).attr('cy', yS(jumpHeight)).attr('r', 7)
            .attr('fill', '#ef4444').attr('stroke', '#fff').attr('stroke-width', 1.5);
    }

    // Draw each jumper trajectory
    var colors = SIM_COLORS;
    simResults.trajectories.forEach(function (t, i) {
        var ffLine = d3.line()
            .x(function (s) { return xS(s[0] * trackE + s[1] * trackN); })
            .y(function (s) { return yS(s[2] - elevM); })
            .curve(d3.curveMonotoneY);
        g.append('path').datum(t.ff).attr('d', ffLine)
            .attr('fill', 'none').attr('stroke', colors[i % 10]).attr('stroke-width', 3)
            .attr('stroke-linecap', 'round');

        var opLine = d3.line()
            .x(function (s) { return xS(s[0] * trackE + s[1] * trackN); })
            .y(function (s) { return yS(s[2] - elevM); })
            .curve(d3.curveMonotoneY);
        g.append('path').datum(t.opening).attr('d', opLine)
            .attr('fill', 'none').attr('stroke', colors[i % 10]).attr('stroke-width', 2.5)
            .attr('stroke-dasharray', '2,6').attr('stroke-linecap', 'round');

        var pos = simResults.positions[i];

        var tPilot = parseFloat(document.getElementById('t_pilot_common').value) || 8;
        var pilotLen = Math.floor(tPilot / 1.0);
        var canopyPilot = t.canopy.slice(0, pilotLen + 1);
        var canopyRide = t.canopy.slice(Math.max(0, pilotLen));

        var canopyAbove300 = canopyRide.filter(function (s) { return s[2] >= elevM + 300; });
        var canopyBelow300 = canopyRide.filter(function (s) { return s[2] <= elevM + 300; });
        if (canopyAbove300.length > 0 && canopyBelow300.length > 0) {
            canopyBelow300.unshift(canopyAbove300[canopyAbove300.length - 1]);
        }

        var canLine = d3.line()
            .x(function (s) { return xS(s[0] * trackE + s[1] * trackN); })
            .y(function (s) { return yS(s[2] - elevM); })
            .curve(d3.curveMonotoneY);

        if (canopyPilot.length >= 2) {
            g.append('path').datum(canopyPilot).attr('d', canLine)
                .attr('fill', 'none').attr('stroke', colors[i % 10]).attr('stroke-width', 3)
                .attr('stroke-dasharray', '8,4').attr('opacity', 1.0);
        }
        if (canopyAbove300.length >= 2) {
            g.append('path').datum(canopyAbove300).attr('d', canLine)
                .attr('fill', 'none').attr('stroke', colors[i % 10]).attr('stroke-width', 2).attr('opacity', 0.5);
        }
        if (canopyBelow300.length >= 2) {
            g.append('path').datum(canopyBelow300).attr('d', canLine)
                .attr('fill', 'none').attr('stroke', colors[i % 10]).attr('stroke-width', 2)
                .attr('stroke-dasharray', '5,5').attr('opacity', 0.9);
        }

        if (pos.pos300) {
            var x300 = xS(pos.pos300.e * trackE + pos.pos300.n * trackN);
            g.append('circle').attr('cx', x300).attr('cy', yS(300)).attr('r', 3.5)
                .attr('fill', '#fff').attr('stroke', colors[i % 10]).attr('stroke-width', 1.5);
        }

        var exitD = pos.exit.e * trackE + pos.exit.n * trackN;
        g.append('rect').attr('x', xS(exitD) - 5).attr('y', yS(jumpHeight) - 5)
            .attr('width', 10).attr('height', 10).attr('fill', colors[i % 10])
            .attr('transform', 'rotate(45,' + xS(exitD) + ',' + yS(jumpHeight) + ')');

        var openD = pos.open.e * trackE + pos.open.n * trackN;
        var openH = t.ff[t.ff.length - 1][2] - elevM;
        g.append('circle').attr('cx', xS(openD)).attr('cy', yS(openH)).attr('r', 5)
            .attr('fill', 'none').attr('stroke', colors[i % 10]).attr('stroke-width', 2);

        var landD = pos.land.e * trackE + pos.land.n * trackN;
        g.append('circle').attr('cx', xS(landD)).attr('cy', yS(0)).attr('r', 8)
            .attr('fill', colors[i % 10]).attr('opacity', 1.0);
        g.append('text').attr('x', xS(landD)).attr('y', yS(0) + 3.5)
            .attr('text-anchor', 'middle').attr('font-size', '10px').attr('font-weight', 'bold')
            .attr('fill', '#fff').text(i + 1);
    });

    // Min distance annotations between pairs

    (simResults.allPairMinDists || []).forEach(function (md) {
        var mdAx = md.posA.x * trackE + md.posA.y * trackN;
        var mdBx = md.posB.x * trackE + md.posB.y * trackN;
        var mdAh = md.posA.z - elevM;
        var mdBh = md.posB.z - elevM;
        var distColor = md.dist < 50 ? '#ef4444' : md.dist < 150 ? '#f59e0b' : '#22c55e';

        // Average height for horizontal distance line
        var avgH = (mdAh + mdBh) / 2;

        // Horizontal dashed line (the horizontal distance between the two paras)
        g.append('line').attr('x1', xS(mdAx)).attr('y1', yS(avgH)).attr('x2', xS(mdBx)).attr('y2', yS(avgH))
            .attr('stroke', distColor).attr('stroke-width', 2).attr('stroke-dasharray', '4,2').attr('opacity', 0.85);

        // Actual position circles for each para at that moment
        g.append('circle').attr('cx', xS(mdAx)).attr('cy', yS(mdAh)).attr('r', 4.5)
            .attr('fill', distColor).attr('stroke', '#fff').attr('stroke-width', 1.5).attr('opacity', 0.95);
        g.append('circle').attr('cx', xS(mdBx)).attr('cy', yS(mdBh)).attr('r', 4.5)
            .attr('fill', distColor).attr('stroke', '#fff').attr('stroke-width', 1.5).attr('opacity', 0.95);

        // Vertical dashed lines from each actual position down to the horizontal measure line
        if (Math.abs(yS(mdAh) - yS(avgH)) > 3) {
            g.append('line')
                .attr('x1', xS(mdAx)).attr('y1', yS(mdAh))
                .attr('x2', xS(mdAx)).attr('y2', yS(avgH))
                .attr('stroke', distColor).attr('stroke-width', 1).attr('stroke-dasharray', '2,2').attr('opacity', 0.65);
        }
        if (Math.abs(yS(mdBh) - yS(avgH)) > 3) {
            g.append('line')
                .attr('x1', xS(mdBx)).attr('y1', yS(mdBh))
                .attr('x2', xS(mdBx)).attr('y2', yS(avgH))
                .attr('stroke', distColor).attr('stroke-width', 1).attr('stroke-dasharray', '2,2').attr('opacity', 0.65);
        }

        // Distance pill: background rect + label + SVG title (hover tooltip)
        var labelTxt = Math.round(md.dist) + 'm';
        var lx = xS((mdAx + mdBx) / 2);
        var ly = yS(avgH) - 7;
        var pillW = 36, pillH = 14;
        var pillG = g.append('g').attr('class', 'dist-pill').style('cursor', 'default');
        pillG.append('title').text(
            'Dist. min P' + (md.idxA + 1) + '\u2194P' + (md.idxB + 1) + ' : ' + Math.round(md.dist) + ' m\n' +
            'Alt A : ' + Math.round(mdAh) + ' m  |  Alt B : ' + Math.round(mdBh) + ' m\n' +
            '\u0394alt : ' + Math.round(Math.abs(mdAh - mdBh)) + ' m'
        );
        pillG.append('rect')
            .attr('x', lx - pillW / 2).attr('y', ly - pillH + 2)
            .attr('width', pillW).attr('height', pillH)
            .attr('rx', 5).attr('ry', 5)
            .attr('fill', '#0d1526').attr('stroke', distColor).attr('stroke-width', 1.5)
            .attr('opacity', 0.95);
        pillG.append('text')
            .attr('x', lx).attr('y', ly - 1)
            .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
            .attr('font-size', 9).attr('font-weight', '900')
            .attr('fill', distColor)
            .text(labelTxt);
    });

    // Axes
    var xAxis = g.append('g').attr('transform', 'translate(0,' + ch + ')')
        .call(d3.axisBottom(xS).ticks(8).tickFormat(function (d) { return (d / 1000).toFixed(1) + ' km'; }));
    xAxis.selectAll('text').attr('font-size', 9).attr('fill', '#94a3b8');
    xAxis.selectAll('line').attr('stroke', '#475569');
    xAxis.select('.domain').attr('stroke', '#475569');
    var yAxis = g.append('g')
        .call(d3.axisLeft(yS).ticks(8).tickFormat(function (d) { return d < 0 ? '' : Math.round(d) + 'm'; }));
    yAxis.selectAll('text').attr('font-size', 9).attr('fill', '#94a3b8');
    yAxis.selectAll('line').attr('stroke', '#475569');
    yAxis.select('.domain').attr('stroke', '#475569');

    svg.append('text').attr('x', mg.left + cw / 2).attr('y', H - 6)
        .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#94a3b8').attr('font-weight', '600')
        .text('Distance le long de l\'axe de largage (' + Math.round(simResults.axe) + '°)');
    svg.append('text').attr('x', 14).attr('y', mg.top + ch / 2)
        .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#94a3b8').attr('font-weight', '600')
        .attr('transform', 'rotate(-90,14,' + (mg.top + ch / 2) + ')').text('Hauteur / sol (m)');

    // Legend
    var lg = g.append('g').attr('transform', 'translate(' + (cw - 190) + ',8)');
    lg.append('rect').attr('x', -5).attr('y', -5).attr('width', 190).attr('height', 88)
        .attr('fill', '#0d1526').attr('rx', 6).attr('stroke', '#1e2d47').attr('opacity', 0.95);
    lg.append('line').attr('x1', 5).attr('x2', 30).attr('y1', 10).attr('y2', 10)
        .attr('stroke', '#3b82f6').attr('stroke-width', 2.5);
    lg.append('text').attr('x', 35).attr('y', 13).attr('font-size', 9).attr('fill', '#94a3b8').text('Chute');

    lg.append('line').attr('x1', 5).attr('x2', 30).attr('y1', 23).attr('y2', 23)
        .attr('stroke', '#3b82f6').attr('stroke-width', 2.5).attr('stroke-dasharray', '2,6');
    lg.append('text').attr('x', 35).attr('y', 26).attr('font-size', 9).attr('fill', '#94a3b8').text('Ouverture');

    lg.append('line').attr('x1', 5).attr('x2', 30).attr('y1', 36).attr('y2', 36)
        .attr('stroke', '#3b82f6').attr('stroke-width', 3).attr('stroke-dasharray', '8,4');
    lg.append('text').attr('x', 35).attr('y', 39).attr('font-size', 9).attr('fill', '#94a3b8').text('Éloignement');

    lg.append('line').attr('x1', 5).attr('x2', 30).attr('y1', 49).attr('y2', 49)
        .attr('stroke', '#3b82f6').attr('stroke-width', 1.5).attr('opacity', 0.5);
    lg.append('text').attr('x', 35).attr('y', 52).attr('font-size', 9).attr('fill', '#94a3b8').text('Sous-voile');

    lg.append('line').attr('x1', 5).attr('x2', 30).attr('y1', 62).attr('y2', 62)
        .attr('stroke', '#64748b').attr('stroke-width', 1.5).attr('stroke-dasharray', '5,3');
    lg.append('text').attr('x', 35).attr('y', 65).attr('font-size', 9).attr('fill', '#94a3b8').text('Dist. mini inter-paras');

    lg.append('rect').attr('x', 5).attr('y', 72).attr('width', 25).attr('height', 8)
        .attr('fill', '#ef4444').attr('fill-opacity', 0.2).attr('stroke', '#ef4444').attr('stroke-width', 0.5);
    lg.append('text').attr('x', 35).attr('y', 80).attr('font-size', 9).attr('fill', '#94a3b8').text('Zone posé < Alt mini');

    g.append('g').attr('id', 'anim-tg');
}

function updateTransversalAnimation(time) {
    if (typeof d3 === 'undefined') return; // Fallback if CDN fails
    var g = d3.select('#anim-tg');
    if (g.empty() || !simResults || !window.transversalXS) return;
    g.selectAll('*').remove();

    var trackE = simResults.trackE, trackN = simResults.trackN;
    var xS = window.transversalXS, yS = window.transversalYS;

    // Plane
    var delaiS = parseFloat(document.getElementById('delai_top_vert').value) || 5;
    var planeAlong = simResults.greenLightAlongTrack + simResults.gsMs * (time + delaiS);
    var jumpHeight = simResults.altM - simResults.elevM;
    if (planeAlong < simResults.redLightAlongTrack + 500) {
        g.append('text').attr('x', xS(planeAlong)).attr('y', yS(jumpHeight) + 5)
            .attr('text-anchor', 'middle').attr('font-size', 20).text('✈️');
    }

    // Jumpers
    simResults.timedTrajs.forEach((timed, i) => {
        var pos = posAtTime(timed, time);
        if (pos) {
            var col = simResults.trajectories[i].color || '#fff';
            var along = pos.x * trackE + pos.y * trackN;
            var h = pos.z - simResults.elevM;

            if (pos.phase === 'ff') {
                g.append('circle').attr('cx', xS(along)).attr('cy', yS(h)).attr('r', 5)
                    .attr('fill', col).attr('stroke', '#fff').attr('stroke-width', 1.5);
            } else if (pos.phase === 'opening') {
                g.append('rect').attr('x', xS(along) - 5).attr('y', yS(h) - 5).attr('width', 10).attr('height', 10)
                    .attr('fill', '#fff').attr('stroke', col).attr('stroke-width', 2);
            } else {
                g.append('text').attr('x', xS(along)).attr('y', yS(h) + 6)
                    .attr('text-anchor', 'middle').attr('font-size', 16).text('🪂');
            }
        }
    });
}
