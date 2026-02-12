import S from './state.js';
import { geodesicDistance, formatDistance } from './utils.js';
import { clearTool, showToast } from './ui.js';

export function addMeasurePoint(lon, lat, height, cartesian) {
    S.measurePoints.push({ lon, lat, height, cartesian });
    const m = S.viewer.entities.add({
        position: cartesian,
        point: { pixelSize: 10, color: Cesium.Color.CYAN, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND }
    });
    S.measureMarkers.push(m);
    if (S.measurePoints.length === 2) {
        S.measureLine = S.viewer.entities.add({
            polyline: { positions: [S.measurePoints[0].cartesian, S.measurePoints[1].cartesian], width: 3, material: Cesium.Color.CYAN.withAlpha(0.8), clampToGround: true }
        });
        const dist = geodesicDistance(S.measurePoints[0].lon, S.measurePoints[0].lat, S.measurePoints[1].lon, S.measurePoints[1].lat);
        const straight = Cesium.Cartesian3.distance(S.measurePoints[0].cartesian, S.measurePoints[1].cartesian);
        const elev = S.measurePoints[1].height - S.measurePoints[0].height;
        document.getElementById('measureDistance').textContent = formatDistance(dist);
        document.getElementById('measureStraight').textContent = formatDistance(straight);
        document.getElementById('measureElev').textContent = (elev >= 0 ? '+' : '') + elev.toFixed(1) + 'm';
        document.getElementById('measureHint').textContent = '計測完了';
        document.getElementById('measurePanel').classList.add('active');
        showToast('計測完了');
    }
}

export function resetMeasure() {
    S.measurePoints = [];
    S.measureMarkers.forEach(e => S.viewer.entities.remove(e));
    S.measureMarkers = [];
    if (S.measureLine) { S.viewer.entities.remove(S.measureLine); S.measureLine = null; }
    document.getElementById('measureDistance').textContent = '-';
    document.getElementById('measureStraight').textContent = '-';
    document.getElementById('measureElev').textContent = '-';
    document.getElementById('measureHint').textContent = '2点をタップして計測';
}

export function closeMeasurePanel() {
    document.getElementById('measurePanel').classList.remove('active');
    resetMeasure();
    clearTool();
}
