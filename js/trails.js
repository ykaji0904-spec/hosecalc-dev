import S from './state.js';
import { OVERPASS_SERVERS, TRAIL_RADIUS } from './config.js';
import { showLoading, showToast } from './ui.js';

export async function loadTrails() {
    if (S.trailLoadActive) return;
    const c = S.viewer.camera.positionCartographic;
    const lat = Cesium.Math.toDegrees(c.latitude), lon = Cesium.Math.toDegrees(c.longitude);
    const radius = TRAIL_RADIUS;
    S.trailLoadActive = true;
    showLoading(true, '登山道を読み込み中...', 30);

    let success = false;
    for (const server of OVERPASS_SERVERS) {
        if (success) break;
        try {
            const bbox = `${lat - radius},${lon - radius},${lat + radius},${lon + radius}`;
            const query = `[out:json][timeout:30];(way["highway"="path"](${bbox});way["highway"="track"](${bbox}););out body;>;out skel qt;`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);
            showLoading(true, 'サーバーに接続中...', 50);
            const res = await fetch(server, {
                method: 'POST', body: 'data=' + encodeURIComponent(query),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) continue;

            showLoading(true, 'データを処理中...', 70);
            const data = await res.json();
            if (!data.elements) continue;

            const nodes = new Map();
            data.elements.forEach(e => { if (e.type === 'node') nodes.set(e.id, [e.lon, e.lat]); });
            const ways = data.elements.filter(e => e.type === 'way');

            showLoading(true, `${ways.length}本の登山道を描画中...`, 85);
            ways.forEach(way => {
                if (S.trailEntities.some(e => e.osmId === way.id)) return;
                const pos = way.nodes.filter(nid => nodes.has(nid)).map(nid => { const n = nodes.get(nid); return Cesium.Cartesian3.fromDegrees(n[0], n[1]); });
                if (pos.length >= 2) {
                    const e = S.viewer.entities.add({ polyline: { positions: pos, width: 3, material: Cesium.Color.LIGHTGREEN.withAlpha(0.8), clampToGround: true } });
                    e.show = S.layers.trails; e.osmId = way.id;
                    S.trailEntities.push(e);
                }
            });

            S.viewer.scene.requestRender();
            showLoading(true, '完了', 100);
            if (ways.length > 0) showToast(`登山道 ${ways.length}本`);
            else showToast('この範囲に登山道データがありません');
            success = true;
        } catch (e) { console.log('Trail server failed:', server, e.message); }
    }

    if (!success) showToast('登山道の読み込みに失敗（後で再試行してください）');
    S.trailLoadActive = false;
    setTimeout(() => showLoading(false), 300);
}
