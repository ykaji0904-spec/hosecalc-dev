import S from './state.js';
import { WATER_TYPE_NAMES, WATER_TYPE_COLORS } from './config.js';
import { closeAllPanels, showToast } from './ui.js';
import { saveAllData } from './storage.js';

const WATER_ICONS = { hydrant: '💧', tank: '🪣', natural: '🌊', other: '💧' };

function createWaterIcon(type) {
    const c = document.createElement('canvas'); c.width = 28; c.height = 28;
    const ctx = c.getContext('2d');
    ctx.beginPath(); ctx.arc(14, 14, 12, 0, Math.PI * 2);
    ctx.fillStyle = WATER_TYPE_COLORS[type] || '#2196f3'; ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'white'; ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(WATER_ICONS[type] || '💧', 14, 14);
    return c.toDataURL();
}

export function addWaterSource(type, name, lon, lat) {
    const id = `water-${++S.waterIdCounter}`;
    const w = { id, type, name, lon, lat };
    S.waterSources.push(w);
    const e = S.viewer.entities.add({
        id, position: Cesium.Cartesian3.fromDegrees(lon, lat),
        billboard: { image: createWaterIcon(type), width: 28, height: 28, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND }
    });
    S.waterEntities.push(e);
    if (!S.isRestoring) saveAllData();
    // トレースガイド更新
    if (S.traceGuideActive) import('./trace.js').then(m => m.updateTraceGuide());
    return id;
}

export function selectWater(id) {
    const w = S.waterSources.find(s => s.id === id);
    if (!w) return;
    closeAllPanels();
    S.selectedWater = w;
    document.getElementById('waterType').textContent = WATER_TYPE_NAMES[w.type] || w.type;
    document.getElementById('waterLat').textContent = w.lat.toFixed(6) + '°';
    document.getElementById('waterLon').textContent = w.lon.toFixed(6) + '°';
    document.getElementById('waterPanel').classList.add('active');
}

export function deleteSelectedWater() {
    if (!S.selectedWater) return;
    const id = S.selectedWater.id;
    // IDで検索（インデックス同期に依存しない）
    const dataIdx = S.waterSources.findIndex(s => s.id === id);
    if (dataIdx >= 0) S.waterSources.splice(dataIdx, 1);
    // エンティティもIDで検索して削除
    const entityIdx = S.waterEntities.findIndex(e => e.id === id);
    if (entityIdx >= 0) {
        S.viewer.entities.remove(S.waterEntities[entityIdx]);
        S.waterEntities.splice(entityIdx, 1);
    } else {
        // フォールバック: viewer.entitiesから直接IDで削除
        const entity = S.viewer.entities.getById(id);
        if (entity) S.viewer.entities.remove(entity);
    }
    document.getElementById('waterPanel').classList.remove('active');
    S.selectedWater = null;
    saveAllData();
}

export function showWaterPicker(x, y) {
    const picker = document.getElementById('waterPicker');
    picker.style.left = Math.min(x, window.innerWidth - 200) + 'px';
    picker.style.top = Math.max(10, y - 160) + 'px';
    picker.classList.add('show');
}

export function hideWaterPicker() {
    document.getElementById('waterPicker').classList.remove('show');
}

export function confirmWaterType(type) {
    hideWaterPicker();
    if (!S.pendingWaterCoords) return;
    const name = WATER_TYPE_NAMES[type] + '#' + (S.waterIdCounter + 1);
    const id = addWaterSource(type, name, S.pendingWaterCoords.lon, S.pendingWaterCoords.lat);
    selectWater(id);
    S.pendingWaterCoords = null;
}
