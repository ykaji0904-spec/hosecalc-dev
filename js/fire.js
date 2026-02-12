import S from './state.js';
import { closeAllPanels, showToast } from './ui.js';
import { saveAllData } from './storage.js';

const FIRE_AREA_ID = 'fire-area-polygon';
const FIRE_BORDER_ID = 'fire-area-border';

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

// --- Convex Hull (Andrew's monotone chain) ---
function convexHull(points) {
    if (points.length < 3) return points.slice();
    const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const p of pts) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
        lower.push(p);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
        upper.push(p);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
}

// --- 延焼エリア表示更新 ---
export function updateFireArea() {
    // 既存を削除
    const existing = S.viewer.entities.getById(FIRE_AREA_ID);
    if (existing) S.viewer.entities.remove(existing);
    const existingBorder = S.viewer.entities.getById(FIRE_BORDER_ID);
    if (existingBorder) S.viewer.entities.remove(existingBorder);

    if (S.firePoints.length < 3) {
        S.viewer.scene.requestRender();
        return;
    }

    // 凸包を計算
    const pts = S.firePoints.map(p => [p.lon, p.lat]);
    const hull = convexHull(pts);
    if (hull.length < 3) return;

    // 凸包をわずかに膨らませる（バッファ）
    const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
    const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
    const buffered = hull.map(p => {
        const dx = p[0] - cx, dy = p[1] - cy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const expand = 0.0003; // 約30m程度の膨らみ
        return [p[0] + (dx / len) * expand, p[1] + (dy / len) * expand];
    });

    const degreesFlat = [];
    buffered.forEach(p => { degreesFlat.push(p[0], p[1]); });

    // 半透明ポリゴン（地形にドレープ）
    S.viewer.entities.add({
        id: FIRE_AREA_ID,
        polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(degreesFlat),
            material: Cesium.Color.fromCssColorString('#ff3300').withAlpha(0.18),
            classificationType: Cesium.ClassificationType.TERRAIN
        }
    });

    // 境界線（破線風の赤）
    const borderDegrees = [...degreesFlat, degreesFlat[0], degreesFlat[1]];
    S.viewer.entities.add({
        id: FIRE_BORDER_ID,
        polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(borderDegrees),
            width: 3,
            material: new Cesium.PolylineDashMaterialProperty({
                color: Cesium.Color.fromCssColorString('#ff3300').withAlpha(0.7),
                dashLength: 12
            }),
            clampToGround: true
        }
    });

    S.viewer.scene.requestRender();
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
    updateFireArea();
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
    updateFireArea();
}
