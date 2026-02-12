import S from './state.js';
import { trailGraph, findNearestNode, dijkstra } from './trails.js';
import { addHosePoint, resetHoseLine } from './hose.js';
import { showLoading, showToast, clearTool, closeSidePanel, showGuideBanner, hideGuideBanner, updateLayerCards } from './ui.js';
import { toggleMapLayer } from './map.js';

// ガイド更新 — 各ステップ完了時に自動で次の操作へ遷移
export function updateTraceGuide() {
    if (!S.traceGuideActive) return;

    const hasTrails = trailGraph.nodes.size > 0;
    const hasWater = S.waterSources.length > 0;
    const hasFire = S.firePoints.length > 0;

    // バナー更新
    showGuideBanner([
        { label: '登山道読み込み中...', done: hasTrails, active: !hasTrails },
        { label: '水利を地図にタップ', done: hasWater, active: hasTrails && !hasWater },
        { label: '火点を地図にタップ', done: hasFire, active: hasTrails && hasWater && !hasFire },
        { label: 'トレース実行', done: false, active: hasTrails && hasWater && hasFire }
    ]);

    if (hasTrails && hasWater && hasFire) {
        // 全条件クリア → 自動実行
        S.traceGuideActive = false;
        hideGuideBanner();
        clearTool();
        setTimeout(() => executeTrace(), 300);
        return;
    }

    // 次のステップへ自動遷移
    if (hasTrails && !hasWater) {
        // 登山道完了 → 水利モードに自動切替
        activateTool('water', 'water_drop', '水利を地図にタップ', 'water-mode', '水源の位置（消火栓・防火水槽など）をタップ');
    } else if (hasTrails && hasWater && !hasFire) {
        // 水利完了 → 火点モードに自動切替
        activateTool('fire', 'local_fire_department', '火点を地図にタップ', '', '火災地点をタップ');
    }
}

function activateTool(tool, icon, label, modeClass, hintText) {
    clearTool();
    S.currentTool = tool;
    const ind = document.getElementById('modeIndicator');
    const ic = document.getElementById('modeIcon');
    const tx = document.getElementById('modeText');
    const ht = document.getElementById('modeHint');
    ic.textContent = icon;
    tx.textContent = label;
    if (ht) ht.textContent = hintText || '';
    ind.className = 'mode-indicator show ' + modeClass;
    updateLayerCards();
}

// トレースボタン押下 — エントリーポイント
export async function traceTrailRoute() {
    closeSidePanel();

    const hasTrails = trailGraph.nodes.size > 0;
    const hasWater = S.waterSources.length > 0;
    const hasFire = S.firePoints.length > 0;

    if (hasTrails && hasWater && hasFire) {
        // 全部揃っている → 即実行
        await executeTrace();
        return;
    }

    // ガイドモードON
    S.traceGuideActive = true;

    if (!hasTrails) {
        // 登山道を自動で読み込み開始
        if (!S.layers.trails) {
            toggleMapLayer('trails');
        }
        showGuideBanner([
            { label: '登山道読み込み中...', done: false, active: true },
            { label: '水利を地図にタップ', done: hasWater, active: false },
            { label: '火点を地図にタップ', done: hasFire, active: false },
            { label: 'トレース実行', done: false, active: false }
        ]);
    } else if (!hasWater) {
        // 水利モードに切替
        activateTool('water', 'water_drop', '水利を地図にタップ', 'water-mode', '水源の位置（消火栓・防火水槽など）をタップ');
        showGuideBanner([
            { label: '登山道読み込み', done: true, active: false },
            { label: '水利を地図にタップ', done: false, active: true },
            { label: '火点を地図にタップ', done: hasFire, active: false },
            { label: 'トレース実行', done: false, active: false }
        ]);
    } else {
        // 火点モードに切替
        activateTool('fire', 'local_fire_department', '火点を地図にタップ', '', '火災地点をタップ');
        showGuideBanner([
            { label: '登山道読み込み', done: true, active: false },
            { label: '水利を地図にタップ', done: true, active: false },
            { label: '火点を地図にタップ', done: false, active: true },
            { label: 'トレース実行', done: false, active: false }
        ]);
    }
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
    document.getElementById('modeIcon').textContent = 'route';
    document.getElementById('modeText').textContent = 'ホース延長';
    document.getElementById('modeIndicator').className = 'mode-indicator show hose-mode';
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
