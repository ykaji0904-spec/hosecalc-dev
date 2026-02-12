import S from './state.js';
import { geodesicDistance, formatDistance, calcLossForDistance, interpolatePath } from './utils.js';
import { clearTool, closeAllPanels, showToast } from './ui.js';
import { saveAllData } from './storage.js';

// === Drawing ===

export function addHosePoint(lon, lat, height, cartesian) {
    S.hosePoints.push({ lon, lat, height, cartesian });
    const m = S.viewer.entities.add({
        position: cartesian,
        point: { pixelSize: 8, color: Cesium.Color.ORANGE, outlineColor: Cesium.Color.WHITE, outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND }
    });
    S.hoseMarkers.push(m);
    updateHoseLine();
    updateHosePanel();
    S.viewer.scene.requestRender();
}

function updateHoseLine() {
    if (S.hoseLine) S.viewer.entities.remove(S.hoseLine);
    S.hoseLine = null;
    if (S.hosePoints.length >= 2) {
        S.hoseLine = S.viewer.entities.add({
            polyline: { positions: S.hosePoints.map(p => p.cartesian), width: 4, material: Cesium.Color.ORANGE.withAlpha(0.9), clampToGround: true }
        });
    }
}

function updateHosePanel() {
    if (S.hosePoints.length < 2) {
        document.getElementById('hoseTotalDist').textContent = '0m';
        document.getElementById('hoseTotalCount').textContent = '0本';
        document.getElementById('hoseElevInfo').textContent = '-';
        return;
    }
    let totalDist = 0;
    for (let i = 1; i < S.hosePoints.length; i++) {
        totalDist += geodesicDistance(S.hosePoints[i - 1].lon, S.hosePoints[i - 1].lat, S.hosePoints[i].lon, S.hosePoints[i].lat);
    }
    const totalHose = Math.ceil(totalDist / 20);
    const elevDiff = S.hosePoints[S.hosePoints.length - 1].height - S.hosePoints[0].height;
    document.getElementById('hoseTotalDist').textContent = formatDistance(totalDist);
    document.getElementById('hoseTotalCount').textContent = totalHose + '本';
    document.getElementById('hoseElevInfo').textContent = (elevDiff >= 0 ? '+' : '') + elevDiff.toFixed(0) + 'm';
}

export function undoHosePoint() {
    if (S.hosePoints.length === 0) return;
    S.hosePoints.pop();
    if (S.hoseMarkers.length > 0) S.viewer.entities.remove(S.hoseMarkers.pop());
    updateHoseLine();
    updateHosePanel();
    S.viewer.scene.requestRender();
}

export function resetHoseLine() {
    S.hosePoints = [];
    S.hoseMarkers.forEach(m => S.viewer.entities.remove(m));
    S.hoseMarkers = [];
    if (S.hoseLine) { S.viewer.entities.remove(S.hoseLine); S.hoseLine = null; }
    updateHosePanel();
    document.getElementById('hoseHint').textContent = '連続タップでポイント追加';
}

export function closeHosePanel() {
    document.getElementById('hosePanel').classList.remove('active');
    resetHoseLine();
    clearTool();
}

export function confirmHoseLine() {
    if (S.hosePoints.length < 2) { showToast('2点以上必要です'); return; }
    const lineId = 'hose-' + Date.now();
    const pathLLH = S.hosePoints.map(p => ({ lon: p.lon, lat: p.lat, height: p.height }));
    S.confirmedLines.push({ id: lineId, points: [...S.hosePoints].map(p => ({ lon: p.lon, lat: p.lat, height: p.height })) });
    if (S.hoseLine) S.viewer.entities.remove(S.hoseLine);
    S.hoseLine = null;
    S.hoseMarkers.forEach(m => S.viewer.entities.remove(m));
    S.hoseMarkers = [];
    runSimulationForLine(lineId, pathLLH);
    S.hosePoints = [];
    document.getElementById('hosePanel').classList.remove('active');
    document.getElementById('hoseInfoPanel').classList.add('active');
    clearTool();
    S.viewer.scene.requestRender();
    saveAllData();
    showToast('シミュレーション完了');
}

export function selectHoseLine(id) {
    const line = S.confirmedLines.find(l => l.id === id);
    if (!line) return;
    closeAllPanels();
    S.selectedHoseLine = id;
    const pathLLH = line.points.map(p => ({ lon: p.lon, lat: p.lat, height: p.height }));
    runSimulationForLine(id, pathLLH);
    document.getElementById('hoseInfoPanel').classList.add('active');
}

export function deleteSelectedHose() {
    if (!S.selectedHoseLine) return;
    const idx = S.confirmedLines.findIndex(l => l.id === S.selectedHoseLine);
    if (idx >= 0) S.confirmedLines.splice(idx, 1);
    clearSimulationVisuals(S.selectedHoseLine);
    document.getElementById('hoseInfoPanel').classList.remove('active');
    S.selectedHoseLine = null;
    S.viewer.scene.requestRender();
    saveAllData();
}

export function onParamChange() {
    if (S.selectedHoseLine) {
        const line = S.confirmedLines.find(l => l.id === S.selectedHoseLine);
        if (line) runSimulationForLine(S.selectedHoseLine, line.points.map(p => ({ lon: p.lon, lat: p.lat, height: p.height })));
    }
}

// === Simulation Engine ===

function readParamsFromUI() {
    S.hoseParams.pumpOutputMPa = parseFloat(document.getElementById('paramPumpOut').value) || 1.2;
    S.hoseParams.relayOutputMPa = parseFloat(document.getElementById('paramRelayOut').value) || 0.8;
    S.hoseParams.minInletPressureMPa = parseFloat(document.getElementById('paramInlet').value) || 0.15;
    S.hoseParams.nozzleRequiredMPa = parseFloat(document.getElementById('paramNozzle').value) || 0.4;
    S.hoseParams.lossPerHoseMPa = parseFloat(document.getElementById('paramLossPerHose').value) || 0.02;
}

export function clearSimulationVisuals(lineId) {
    const ss = S.hoseSimState;
    (ss.markersByLineId.get(lineId) || []).forEach(e => S.viewer.entities.remove(e));
    ss.markersByLineId.delete(lineId);
    (ss.relayMarkersByLine.get(lineId) || []).forEach(e => S.viewer.entities.remove(e));
    ss.relayMarkersByLine.delete(lineId);
    (ss.colorizedLinesByLine.get(lineId) || []).forEach(e => S.viewer.entities.remove(e));
    ss.colorizedLinesByLine.delete(lineId);
    (ss.startEndMarkersByLine.get(lineId) || []).forEach(e => S.viewer.entities.remove(e));
    ss.startEndMarkersByLine.delete(lineId);
}

function computeRelayPositions(interpolated, params) {
    const relays = [];
    let currentPressure = params.pumpOutputMPa;
    let lastRelayIdx = 0;
    for (let i = 1; i < interpolated.length; i++) {
        const dist = interpolated[i].distFromStart - interpolated[lastRelayIdx].distFromStart;
        const dh = interpolated[i].height - interpolated[lastRelayIdx].height;
        const loss = calcLossForDistance(dist, dh, params);
        const remain = currentPressure - loss;
        if (remain < params.minInletPressureMPa) {
            const relayIdx = i - 1 > lastRelayIdx ? i - 1 : i;
            relays.push({ index: relayIdx, lon: interpolated[relayIdx].lon, lat: interpolated[relayIdx].lat, height: interpolated[relayIdx].height });
            lastRelayIdx = relayIdx;
            currentPressure = params.relayOutputMPa;
        }
    }
    return relays;
}

function computePumpSegments(interpolated, relays, params) {
    const segments = [];
    const relayIndices = [0, ...relays.map(r => r.index)];
    for (let p = 0; p < relayIndices.length; p++) {
        const startIdx = relayIndices[p];
        const endIdx = p < relayIndices.length - 1 ? relayIndices[p + 1] : interpolated.length - 1;
        const dist = interpolated[endIdx].distFromStart - interpolated[startIdx].distFromStart;
        const dh = interpolated[endIdx].height - interpolated[startIdx].height;
        const hoses = Math.ceil(dist / params.hoseLengthM);
        const loss = calcLossForDistance(dist, dh, params);
        const outputP = p === 0 ? params.pumpOutputMPa : params.relayOutputMPa;
        const remain = outputP - loss;
        const pumpLabel = p === 0 ? '消防車' : `P${p + 1}`;
        const nextLabel = p < relayIndices.length - 1 ? `P${p + 2}` : '筒先';
        segments.push({ pumpLabel, nextLabel, distance: dist, hoses, elevation: dh, loss, remainingPressure: remain });
    }
    return segments;
}

export function runSimulationForLine(lineId, pathLLH) {
    readParamsFromUI();
    clearSimulationVisuals(lineId);
    const interpolated = interpolatePath(pathLLH, 10);
    const params = S.hoseParams;
    const relays = computeRelayPositions(interpolated, params);
    const pumpSegments = computePumpSegments(interpolated, relays, params);
    const totalDist = interpolated[interpolated.length - 1].distFromStart;
    const totalHoses = Math.ceil(totalDist / params.hoseLengthM);
    const endPressure = pumpSegments.length > 0 ? pumpSegments[pumpSegments.length - 1].remainingPressure : params.pumpOutputMPa;

    renderStartEndMarkers(lineId, pathLLH);
    renderRelayMarkers(lineId, relays);
    renderColorizedLines(lineId, interpolated, relays, pumpSegments);
    updateHoseInfoPanel({ totalLengthM: totalDist, totalHoses20m: totalHoses, endPressureMPa: endPressure, totalPumps: relays.length + 1, pumpSegments });
    S.viewer.scene.requestRender();
}

// === Visualization ===

function renderStartEndMarkers(lineId, pathLLH) {
    const prev = S.hoseSimState.startEndMarkersByLine.get(lineId) || [];
    prev.forEach(e => S.viewer.entities.remove(e));
    const markers = [];
    if (pathLLH.length >= 1) {
        const start = pathLLH[0];
        const e = S.viewer.entities.add({
            id: 'start-' + lineId,
            position: Cesium.Cartesian3.fromDegrees(start.lon, start.lat, start.height || 0),
            point: { pixelSize: 14, color: Cesium.Color.RED, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
            label: { text: '🚒', font: 'bold 12px sans-serif', fillColor: Cesium.Color.WHITE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -12) }
        });
        e.markerData = { name: '消防車（P1）', lat: start.lat, lon: start.lon, height: start.height || 0 };
        markers.push(e);
    }
    if (pathLLH.length >= 2) {
        const end = pathLLH[pathLLH.length - 1];
        const e = S.viewer.entities.add({
            id: 'end-' + lineId,
            position: Cesium.Cartesian3.fromDegrees(end.lon, end.lat, end.height || 0),
            point: { pixelSize: 12, color: Cesium.Color.BLUE, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
            label: { text: '筒先', font: 'bold 11px sans-serif', fillColor: Cesium.Color.WHITE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -12) }
        });
        e.markerData = { name: '筒先', lat: end.lat, lon: end.lon, height: end.height || 0 };
        markers.push(e);
    }
    S.hoseSimState.startEndMarkersByLine.set(lineId, markers);
}

function renderRelayMarkers(lineId, relays) {
    const prev = S.hoseSimState.relayMarkersByLine.get(lineId) || [];
    prev.forEach(e => S.viewer.entities.remove(e));
    const markers = relays.map((r, i) => {
        const e = S.viewer.entities.add({
            id: 'relay-' + lineId + '-' + i,
            position: Cesium.Cartesian3.fromDegrees(r.lon, r.lat, r.height || 0),
            point: { pixelSize: 12, color: Cesium.Color.ORANGE, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
            label: { text: 'P' + (i + 2), font: 'bold 11px sans-serif', fillColor: Cesium.Color.WHITE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -12) }
        });
        e.relayData = { name: 'P' + (i + 2), lat: r.lat, lon: r.lon, height: r.height || 0 };
        return e;
    });
    S.hoseSimState.relayMarkersByLine.set(lineId, markers);
}

function renderColorizedLines(lineId, interpolated, relays, pumpSegments) {
    const prev = S.hoseSimState.colorizedLinesByLine.get(lineId) || [];
    prev.forEach(e => S.viewer.entities.remove(e));
    const lines = [];
    const params = S.hoseParams;

    for (let p = 0; p < pumpSegments.length; p++) {
        let startIdx, endIdx;
        if (p === 0) { startIdx = 0; endIdx = relays.length > 0 ? relays[0].index : interpolated.length - 1; }
        else if (p <= relays.length) { startIdx = relays[p - 1].index; endIdx = p < relays.length ? relays[p].index : interpolated.length - 1; }
        else continue;

        const startPressure = p === 0 ? params.pumpOutputMPa : params.relayOutputMPa;
        const startDist = interpolated[startIdx].distFromStart;
        const startHeight = interpolated[startIdx].height || 0;

        let currentColorStart = startIdx;
        let currentColor = null;

        for (let i = startIdx; i <= endIdx; i++) {
            const dist = interpolated[i].distFromStart - startDist;
            const dh = (interpolated[i].height || 0) - startHeight;
            const loss = calcLossForDistance(dist, dh, params);
            const pressure = startPressure - loss;
            const newColor = pressure >= 0.5 ? 'green' : pressure >= 0.3 ? 'yellow' : 'red';

            if (currentColor !== null && newColor !== currentColor) {
                lines.push(createColorSegment(lineId, p, currentColorStart, i, interpolated, currentColor));
                currentColorStart = i;
            }
            currentColor = newColor;
        }
        if (currentColorStart < endIdx) {
            lines.push(createColorSegment(lineId, p, currentColorStart, endIdx, interpolated, currentColor));
        }
    }
    S.hoseSimState.colorizedLinesByLine.set(lineId, lines.filter(Boolean));
    setTimeout(() => S.viewer.scene.requestRender(), 100);
}

function createColorSegment(lineId, pumpIdx, startIdx, endIdx, interpolated, color) {
    const positions = [];
    for (let j = startIdx; j <= endIdx; j++) {
        if (interpolated[j]) positions.push(Cesium.Cartesian3.fromDegrees(interpolated[j].lon, interpolated[j].lat, interpolated[j].height || 0));
    }
    if (positions.length < 2) return null;
    const cesiumColor = color === 'green' ? Cesium.Color.LIMEGREEN : color === 'yellow' ? Cesium.Color.YELLOW : Cesium.Color.RED;
    return S.viewer.entities.add({
        id: lineId + '-seg-' + pumpIdx + '-' + startIdx,
        polyline: { positions, width: 5, material: cesiumColor.withAlpha(0.9), clampToGround: true }
    });
}

function updateHoseInfoPanel(data) {
    document.getElementById('hoseInfoDist').textContent = formatDistance(data.totalLengthM);
    document.getElementById('hoseInfoCount').textContent = data.totalHoses20m + '本';
    const endPEl = document.getElementById('hoseInfoEndP');
    endPEl.textContent = data.endPressureMPa.toFixed(2) + ' MPa';
    endPEl.className = data.endPressureMPa >= S.hoseParams.nozzleRequiredMPa ? 'panel-stat-value ok' : data.endPressureMPa >= S.hoseParams.minInletPressureMPa ? 'panel-stat-value highlight' : 'panel-stat-value warning';
    document.getElementById('hoseInfoRelay').textContent = (data.totalPumps - 1) + '台';

    if (data.pumpSegments) {
        const tbody = document.getElementById('segmentTableBody');
        let html = '';
        for (const seg of data.pumpSegments) {
            const colorClass = seg.remainingPressure >= 0.4 ? 'green' : seg.remainingPressure >= 0.2 ? 'yellow' : 'red';
            const elevClass = seg.elevation >= 0 ? 'elev-up' : 'elev-down';
            const elevStr = seg.elevation >= 0 ? '+' + seg.elevation.toFixed(0) : seg.elevation.toFixed(0);
            html += `<tr class="${colorClass}"><td>${seg.pumpLabel}→${seg.nextLabel}</td><td>${seg.distance.toFixed(0)}m</td><td>${seg.hoses}本</td><td class="${elevClass}">${elevStr}m</td><td>${seg.loss.toFixed(2)}</td><td>${seg.remainingPressure.toFixed(2)}</td></tr>`;
        }
        tbody.innerHTML = html;
    }
}
