import S from './state.js';
import { trailGraph, findNearestNode, dijkstra } from './trails.js';
import { confirmHoseLine, addHosePoint, resetHoseLine } from './hose.js';
import { showLoading, showToast, clearTool, closeSidePanel, showGuideBanner, hideGuideBanner } from './ui.js';
import { geodesicDistance } from './utils.js';

// ガイドバナーの状態を更新（他モジュールから呼ばれる）
export function updateTraceGuide() {
    if (!S.traceGuideActive) return;
    
    const hasTrails = trailGraph.nodes.size > 0;
    const hasWater = S.waterSources.length > 0;
    const hasFire = S.firePoints.length > 0;

    if (hasTrails && hasWater && hasFire) {
        // 全条件揃った → 自動実行
        S.traceGuideActive = false;
        hideGuideBanner();
        setTimeout(() => executeTrace(), 300);
        return;
    }

    showGuideBanner([
        { label: '登山道を読み込む', done: hasTrails, active: !hasTrails },
        { label: '水利を登録', done: hasWater, active: hasTrails && !hasWater },
        { label: '火点を登録', done: hasFire, active: hasTrails && hasWater && !hasFire },
        { label: 'トレース実行', done: false, active: false }
    ]);
}

// トレースボタン押下
export async function traceTrailRoute() {
    closeSidePanel();
    
    const hasTrails = trailGraph.nodes.size > 0;
    const hasWater = S.waterSources.length > 0;
    const hasFire = S.firePoints.length > 0;

    if (!hasTrails || !hasWater || !hasFire) {
        // ガイドモードON
        S.traceGuideActive = true;
        updateTraceGuide();
        return;
    }

    // 全条件揃っている → 即実行
    hideGuideBanner();
    S.traceGuideActive = false;
    await executeTrace();
}

// 実際のトレース処理
async function executeTrace() {
    showLoading(true, '最適ルートを探索中...', 20);

    const water = S.waterSources[S.waterSources.length - 1];
    const fire = S.firePoints[S.firePoints.length - 1];

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

    const result = dijkstra(nearWater.id, nearFire.id);
    if (!result) {
        showLoading(false);
        showToast('水利→火点の経路が見つかりません（道がつながっていない可能性）');
        return;
    }

    showLoading(true, `ルート発見（${result.path.length}点, ${(result.totalDist / 1000).toFixed(1)}km）標高取得中...`, 60);

    const fullPath = [{ lon: water.lon, lat: water.lat }];
    fullPath.push(...result.path);
    fullPath.push({ lon: fire.lon, lat: fire.lat });

    const simplified = simplifyPath(fullPath, 100);

    showLoading(true, '標高データを取得中...', 70);

    const cartographics = simplified.map(p => Cesium.Cartographic.fromDegrees(p.lon, p.lat));
    try {
        const updated = await Cesium.sampleTerrainMostDetailed(S.viewer.terrainProvider, cartographics);
        for (let i = 0; i < simplified.length; i++) {
            simplified[i].height = updated[i].height || 0;
        }
    } catch (e) {
        console.warn('Terrain sampling failed:', e);
        simplified.forEach(p => p.height = p.height || 0);
    }

    showLoading(true, 'ホースラインを生成中...', 90);

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

    for (const p of simplified) {
        const cartesian = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.height);
        addHosePoint(p.lon, p.lat, p.height, cartesian);
    }

    showLoading(false);

    const totalDist = result.totalDist + nearWater.dist + nearFire.dist;
    showToast(`登山道トレース完了（${(totalDist / 1000).toFixed(1)}km, ${simplified.length}点）→「確定」でシミュレーション`);
    S.viewer.scene.requestRender();
}

function simplifyPath(path, maxPoints) {
    if (path.length <= maxPoints) return path;
    const step = (path.length - 1) / (maxPoints - 1);
    const result = [];
    for (let i = 0; i < maxPoints; i++) {
        const idx = Math.min(Math.round(i * step), path.length - 1);
        result.push(path[idx]);
    }
    result[0] = path[0];
    result[result.length - 1] = path[path.length - 1];
    return result;
}
