import S from './state.js';
import { closeAllPanels, showToast } from './ui.js';
import { saveAllData } from './storage.js';

function createFireIcon() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.beginPath(); ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#f44336'; ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'white'; ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔥', 16, 16);
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
    return id;
}

export function selectFirePoint(id) {
    const f = S.firePoints.find(p => p.id === id);
    if (!f) return;
    closeAllPanels();
    S.selectedFirePoint = f;
    document.getElementById('fireLat').textContent = f.lat.toFixed(6) + '°';
    document.getElementById('fireLon').textContent = f.lon.toFixed(6) + '°';
    document.getElementById('fireElev').textContent = f.height.toFixed(1) + 'm';
    document.getElementById('firePanel').classList.add('active');
}

export function deleteSelectedFire() {
    if (!S.selectedFirePoint) return;
    const idx = S.firePoints.findIndex(p => p.id === S.selectedFirePoint.id);
    if (idx >= 0) {
        S.firePoints.splice(idx, 1);
        S.viewer.entities.remove(S.firePointEntities[idx]);
        S.firePointEntities.splice(idx, 1);
    }
    document.getElementById('firePanel').classList.remove('active');
    S.selectedFirePoint = null;
    saveAllData();
}
