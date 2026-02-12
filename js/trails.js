import S from './state.js';
import { OVERPASS_SERVERS, TRAIL_RADIUS } from './config.js';
import { showLoading, showToast } from './ui.js';

// グラフ構造: trailGraph.nodes = Map<nodeId, {lon, lat}>
//             trailGraph.edges = Map<nodeId, [{to, dist}]>
export const trailGraph = { nodes: new Map(), edges: new Map() };

function haversineDistance(lon1, lat1, lon2, lat2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function addEdge(from, to, dist) {
    if (!trailGraph.edges.has(from)) trailGraph.edges.set(from, []);
    if (!trailGraph.edges.has(to)) trailGraph.edges.set(to, []);
    trailGraph.edges.get(from).push({ to, dist });
    trailGraph.edges.get(to).push({ to: from, dist }); // 双方向
}

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

            // グラフ構築
            let newNodes = 0, newEdges = 0;
            const wayEndpoints = []; // 各wayの端点を記録
            ways.forEach(way => {
                const wayNodes = way.nodes.filter(nid => nodes.has(nid));
                for (let i = 0; i < wayNodes.length; i++) {
                    const nid = wayNodes[i];
                    if (!trailGraph.nodes.has(nid)) {
                        const [lon, lat] = nodes.get(nid);
                        trailGraph.nodes.set(nid, { lon, lat });
                        newNodes++;
                    }
                    if (i > 0) {
                        const prev = wayNodes[i - 1];
                        const [lon1, lat1] = nodes.get(prev);
                        const [lon2, lat2] = nodes.get(nid);
                        const existing = trailGraph.edges.get(prev);
                        if (!existing || !existing.some(e => e.to === nid)) {
                            const dist = haversineDistance(lon1, lat1, lon2, lat2);
                            addEdge(prev, nid, dist);
                            newEdges++;
                        }
                    }
                }
                // 端点を記録
                if (wayNodes.length >= 2) {
                    wayEndpoints.push(wayNodes[0], wayNodes[wayNodes.length - 1]);
                }
            });

            // === 途切れた登山道を自動接続（25m以内）===
            const BRIDGE_MAX_M = 25;
            let bridgeCount = 0;
            const uniqueEndpoints = [...new Set(wayEndpoints)];
            for (let i = 0; i < uniqueEndpoints.length; i++) {
                const a = uniqueEndpoints[i];
                const nodeA = trailGraph.nodes.get(a);
                if (!nodeA) continue;
                for (let j = i + 1; j < uniqueEndpoints.length; j++) {
                    const b = uniqueEndpoints[j];
                    const nodeB = trailGraph.nodes.get(b);
                    if (!nodeB) continue;
                    // 既に接続済みならスキップ
                    const edgesA = trailGraph.edges.get(a);
                    if (edgesA && edgesA.some(e => e.to === b)) continue;
                    const dist = haversineDistance(nodeA.lon, nodeA.lat, nodeB.lon, nodeB.lat);
                    if (dist <= BRIDGE_MAX_M) {
                        addEdge(a, b, dist);
                        bridgeCount++;
                    }
                }
            }

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
            console.log(`[Trail Graph] ${trailGraph.nodes.size} nodes, ${newEdges} edges, ${bridgeCount} bridges(≤25m)`);
            if (ways.length > 0) showToast(`登山道 ${ways.length}本（${trailGraph.nodes.size}ノード${bridgeCount > 0 ? ', ' + bridgeCount + '箇所自動接続' : ''}）`);
            else showToast('この範囲に登山道データがありません');
            success = true;
            // トレースガイド更新
            if (S.traceGuideActive) import('./trace.js').then(m => m.updateTraceGuide());
        } catch (e) { console.log('Trail server failed:', server, e.message); }
    }

    if (!success) showToast('登山道の読み込みに失敗（後で再試行してください）');
    S.trailLoadActive = false;
    setTimeout(() => showLoading(false), 300);
}

// 最寄りのグラフノードを探す
export function findNearestNode(lon, lat, maxDistM = 500) {
    let bestId = null, bestDist = Infinity;
    for (const [id, node] of trailGraph.nodes) {
        const d = haversineDistance(lon, lat, node.lon, node.lat);
        if (d < bestDist) { bestDist = d; bestId = id; }
    }
    if (bestDist > maxDistM) return null;
    return { id: bestId, dist: bestDist };
}

// ダイクストラ最短経路
export function dijkstra(startId, endId) {
    if (!trailGraph.edges.has(startId) || !trailGraph.edges.has(endId)) return null;

    const dist = new Map();
    const prev = new Map();
    const visited = new Set();
    // 簡易優先キュー（小規模グラフなので十分）
    const queue = [];

    dist.set(startId, 0);
    queue.push({ id: startId, d: 0 });

    while (queue.length > 0) {
        // 最小距離のノードを取得
        queue.sort((a, b) => a.d - b.d);
        const { id: current } = queue.shift();

        if (visited.has(current)) continue;
        visited.add(current);

        if (current === endId) break;

        const edges = trailGraph.edges.get(current) || [];
        for (const edge of edges) {
            if (visited.has(edge.to)) continue;
            const newDist = dist.get(current) + edge.dist;
            if (!dist.has(edge.to) || newDist < dist.get(edge.to)) {
                dist.set(edge.to, newDist);
                prev.set(edge.to, current);
                queue.push({ id: edge.to, d: newDist });
            }
        }
    }

    if (!prev.has(endId) && startId !== endId) return null;

    // パス復元
    const path = [];
    let current = endId;
    while (current !== undefined) {
        const node = trailGraph.nodes.get(current);
        if (node) path.unshift({ lon: node.lon, lat: node.lat });
        current = prev.get(current);
    }
    return path.length >= 2 ? { path, totalDist: dist.get(endId) || 0 } : null;
}
