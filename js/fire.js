import S from './state.js';
import { closeAllPanels, showToast } from './ui.js';
import { saveAllData } from './storage.js';

function createFireIcon() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    // Outer flame (orange-red)
    ctx.beginPath();
    ctx.moveTo(16, 2);
    ctx.bezierCurveTo(18, 8, 26, 12, 26, 20);
    ctx.bezierCurveTo(26, 26, 21, 30, 16, 30);
    ctx.bezierCurveTo(11, 30, 6, 26, 6, 20);
    ctx.bezierCurveTo(6, 12, 14, 8, 16, 2);
    ctx.closePath();
    const gOuter = ctx.createRadialGradient(16, 22, 2, 16, 18, 14);
    gOuter.addColorStop(0, '#ff6600');
    gOuter.addColorStop(0.6, '#e53935');
    gOuter.addColorStop(1, '#b71c1c');
    ctx.fillStyle = gOuter; ctx.fill();
    // Inner flame (yellow)
    ctx.beginPath();
    ctx.moveTo(16, 10);
    ctx.bezierCurveTo(17, 14, 22, 16, 22, 21);
    ctx.bezierCurveTo(22, 25, 19, 28, 16, 28);
    ctx.bezierCurveTo(13, 28, 10, 25, 10, 21);
    ctx.bezierCurveTo(10, 16, 15, 14, 16, 10);
    ctx.closePath();
    const gInner = ctx.createRadialGradient(16, 23, 1, 16, 20, 8);
    gInner.addColorStop(0, '#fff176');
    gInner.addColorStop(0.5, '#ffb300');
    gInner.addColorStop(1, '#ff6600');
    ctx.fillStyle = gInner; ctx.fill();
    return c.toDataURL();
}

export function addFirePoint(lon, lat, height) {
    const id = `fire-${++S.firePointIdCounter}`;
    S.firePoints.push({ id, lon, lat, height });
    const e = S.viewer.entities.add({
        id, position: Cesium.Cartesian3.fromDegrees(lon, lat, height),
        billboard: { image: createFireIcon(), width: 32, height: 32, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND }
    });
    S.firePointEntities.push(e);
    if (!S.isRestoring) saveAllData();
    // トレースガイド更新
    if (S.traceGuideActive) import('./trace.js').then(m => m.updateTraceGuide());
    return id;
}

export function selectFirePoint(id) {
    const f = S.firePoints.find(p => p.id === id);
    if (!f) return;

    // トレースガイド中：既存火点の選択
    if (S.traceGuideActive && S.traceGuideStep === 'fire') {
        import('./trace.js').then(m => m.traceSelectFire(f));
        return;
    }

    closeAllPanels();
    S.selectedFirePoint = f;
    document.getElementById('fireLat').textContent = f.lat.toFixed(6) + '°';
    document.getElementById('fireLon').textContent = f.lon.toFixed(6) + '°';
    document.getElementById('fireElev').textContent = f.height.toFixed(1) + 'm';
    document.getElementById('firePanel').classList.add('active');
}

export function deleteSelectedFire() {
    if (!S.selectedFirePoint) return;
    const id = S.selectedFirePoint.id;
    // IDで検索（インデックス同期に依存しない）
    const dataIdx = S.firePoints.findIndex(p => p.id === id);
    if (dataIdx >= 0) S.firePoints.splice(dataIdx, 1);
    // エンティティもIDで検索して削除
    const entityIdx = S.firePointEntities.findIndex(e => e.id === id);
    if (entityIdx >= 0) {
        S.viewer.entities.remove(S.firePointEntities[entityIdx]);
        S.firePointEntities.splice(entityIdx, 1);
    } else {
        const entity = S.viewer.entities.getById(id);
        if (entity) S.viewer.entities.remove(entity);
    }
    document.getElementById('firePanel').classList.remove('active');
    S.selectedFirePoint = null;
    saveAllData();
}
