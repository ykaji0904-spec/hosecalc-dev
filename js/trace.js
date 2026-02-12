import S from './state.js';
import { trailGraph, findNearestNode, dijkstra } from './trails.js';
import { confirmHoseLine, addHosePoint, resetHoseLine } from './hose.js';
import { showLoading, showToast, clearTool, closeSidePanel } from './ui.js';
import { geodesicDistance } from './utils.js';

// 登山道トレースでホースラインを自動生成
export async function traceTrailRoute() {
    closeSidePanel();
    
    // 前提チェック
    if (trailGraph.nodes.size === 0) {
        showToast('先に登山道を読み込んでください');
        return;
    }
    if (S.waterSources.length === 0) {
        showToast('水利を登録してください');
        return;
    }
    if (S.firePoints.length === 0) {
        showToast('火点を登録してください');
        return;
    }

    showLoading(true, '最適ルートを探索中...', 20);

    // 最新の水利と火点を使用（複数ある場合は最後に追加されたもの）
    const water = S.waterSources[S.waterSources.length - 1];
    const fire = S.firePoints[S.firePoints.length - 1];

    // 最寄りの登山道ノードを探索
    const nearWater = findNearestNode(water.lon, water.lat, 1000);
    const nearFire = findNearestNode(fire.lon, fire.lat, 1000);

    if (!nearWater) {
        showLoading(false);
        showToast('水利の近くに登山道が見つかりません（1km以内）');
        return;
    }
    if (!nearFire) {
        showLoading(false);
        showToast('火点の近くに登山道が見つかりません（1km以内）');
        return;
    }

    showLoading(true, 'ダイクストラ探索中...', 40);

    // ダイクストラで最短経路
    const result = dijkstra(nearWater.id, nearFire.id);
    if (!result) {
        showLoading(false);
        showToast('水利→火点の経路が見つかりません（道がつながっていない可能性）');
        return;
    }

    showLoading(true, `ルート発見（${result.path.length}ポイント, ${(result.totalDist / 1000).toFixed(1)}km）標高取得中...`, 60);

    // 水利→最寄り登山道の直線区間を先頭に追加
    const fullPath = [{ lon: water.lon, lat: water.lat }];
    // 登山道経路を追加
    fullPath.push(...result.path);
    // 登山道→火点の直線区間を末尾に追加
    fullPath.push({ lon: fire.lon, lat: fire.lat });

    // パスを適度に間引き（Cesiumのterrain queryは重いので最大100ポイント）
    const simplified = simplifyPath(fullPath, 100);

    showLoading(true, '標高データを取得中...', 70);

    // 標高取得
    const cartographics = simplified.map(p => Cesium.Cartographic.fromDegrees(p.lon, p.lat));
    try {
        const updated = await Cesium.sampleTerrainMostDetailed(S.viewer.terrainProvider, cartographics);
        for (let i = 0; i < simplified.length; i++) {
            simplified[i].height = updated[i].height || 0;
        }
    } catch (e) {
        console.warn('Terrain sampling failed, using 0:', e);
        simplified.forEach(p => p.height = p.height || 0);
    }

    showLoading(true, 'ホースラインを生成中...', 90);

    // ホースツールをアクティブにしてポイントを追加
    clearTool();
    S.currentTool = 'hose';
    const ind = document.getElementById('modeIndicator');
    const icon = document.getElementById('modeIcon');
    const text = document.getElementById('modeText');
    icon.textContent = 'route';
    text.textContent = 'ホース延長';
    ind.className = 'mode-indicator show hose-mode';
    document.getElementById('hosePanel').classList.add('active');
    resetHoseLine();

    // ポイントを追加
    for (const p of simplified) {
        const cartesian = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.height);
        addHosePoint(p.lon, p.lat, p.height, cartesian);
    }

    showLoading(false);

    const totalDist = result.totalDist + nearWater.dist + nearFire.dist;
    showToast(`登山道トレース完了（${(totalDist / 1000).toFixed(1)}km, ${simplified.length}点）→「確定」でシミュレーション`);
    S.viewer.scene.requestRender();
}

// パスの間引き（Douglas-Peucker簡易版 + 均等サンプリング）
function simplifyPath(path, maxPoints) {
    if (path.length <= maxPoints) return path;

    // 均等サンプリング
    const step = (path.length - 1) / (maxPoints - 1);
    const result = [];
    for (let i = 0; i < maxPoints; i++) {
        const idx = Math.min(Math.round(i * step), path.length - 1);
        result.push(path[idx]);
    }
    // 必ず最初と最後を含める
    result[0] = path[0];
    result[result.length - 1] = path[path.length - 1];
    return result;
}
