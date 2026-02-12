import S from './state.js';
import { trailGraph, findNearestNode, dijkstra } from './trails.js';
import { addHosePoint, resetHoseLine } from './hose.js';
import { showLoading, showToast, clearTool, closeSidePanel, hideGuideBanner, updateLayerCards } from './ui.js';
import { toggleMapLayer } from './map.js';

// シンプルなガイドバナー表示（1行メッセージ）
function showStepBanner(icon, message, actionLabel, actionFn) {
    let el = document.getElementById('guideBanner');
    if (!el) {
        el = document.createElement('div');
        el.id = 'guideBanner';
        document.body.appendChild(el);
    }
    el.innerHTML = `
        <div class="guide-banner-body">
            <span class="material-icons" style="font-size:20px">${icon}</span>
            <span class="guide-msg">${message}</span>
            ${actionLabel ? `<button class="guide-action-btn" onclick="${actionFn}">${actionLabel}</button>` : ''}
            <button class="guide-close" onclick="hideGuideBanner()">✕</button>
        </div>
    `;
    el.classList.add('show');
}

function activateTool(tool, iconName, label, modeClass, hintText) {
    clearTool();
    S.currentTool = tool;
    const ind = document.getElementById('modeIndicator');
    const ic = document.getElementById('modeIcon');
    const tx = document.getElementById('modeText');
    const ht = document.getElementById('modeHint');
    ic.textContent = iconName;
    tx.textContent = label;
    if (ht) ht.textContent = hintText || '';
    ind.className = 'mode-indicator show ' + modeClass;
    updateLayerCards();
}

// ガイド更新（他モジュールから呼ばれる）
export function updateTraceGuide() {
    if (!S.traceGuideActive) return;

    const hasTrails = trailGraph.nodes.size > 0;
    const hasWater = S.waterSources.length > 0;
    const hasFire = S.firePoints.length > 0;

    if (!hasTrails) {
        showStepBanner('hiking', '登山道を読み込んでいます...');
        return;
    }

    if (!hasFire) {
        activateTool('fire', 'local_fire_department', '火点追加', '', '地図をタップして火点を登録');
        showStepBanner('local_fire_department', '火点を地図にタップして追加してください');
        return;
    }

    if (!hasWater) {
        activateTool('water', 'water_drop', '水利追加', 'water-mode', '地図をタップして水源を登録');
        showStepBanner('water_drop', '水利を地図にタップして追加してください');
        return;
    }

    // 全条件揃った
    S.traceGuideActive = false;
    clearTool();
    showStepBanner('route', '準備完了', '▶ トレース実行', '_execTrace()');
}

// トレースボタン押下
export async function traceTrailRoute() {
    closeSidePanel();
    clearTool();

    const hasTrails = trailGraph.nodes.size > 0;
    const hasWater = S.waterSources.length > 0;
    const hasFire = S.firePoints.length > 0;

    if (hasTrails && hasWater && hasFire) {
        showStepBanner('route', '準備完了', '▶ トレース実行', '_execTrace()');
        return;
    }

    // ガイドモードON
    S.traceGuideActive = true;

    if (!hasTrails) {
        if (!S.layers.trails) toggleMapLayer('trails');
        showStepBanner('hiking', '登山道を読み込んでいます...');
    } else if (!hasFire) {
        activateTool('fire', 'local_fire_department', '火点追加', '', '地図をタップして火点を登録');
        showStepBanner('local_fire_department', '火点を地図にタップして追加してください');
    } else {
        activateTool('water', 'water_drop', '水利追加', 'water-mode', '地図をタップして水源を登録');
        showStepBanner('water_drop', '水利を地図にタップして追加してください');
    }
}

// 実行ラッパー（window公開用）
export async function execTrace() {
    hideGuideBanner();
    await executeTrace();
}

// トレース実行
async function executeTrace() {
    hideGuideBanner();
    S.traceGuideActive = false;
    showLoading(true, '最適ルートを探索中...', 20);

    const water = S.waterSources[S.waterSources.length - 1];
    const fire = S.firePoints[S.firePoints.length - 1];

    const nearWater = findNearestNode(water.lon, water.lat, 1000);
    const nearFire = findNearestNode(fire.lon, fire.lat, 1000);

    if (!nearWater) { showLoading(false); showToast('水利の近くに登山道が見つかりません（1km以内）'); return; }
    if (!nearFire) { showLoading(false); showToast('火点の近くに登山道が見つかりません（1km以内）'); return; }

    showLoading(true, 'ダイクストラ探索中...', 40);
    const result = dijkstra(nearWater.id, nearFire.id);
    if (!result) { showLoading(false); showToast('水利→火点の経路が見つかりません（道がつながっていない可能性）'); return; }

    showLoading(true, `ルート発見（${result.path.length}点, ${(result.totalDist / 1000).toFixed(1)}km）標高取得中...`, 60);

    const fullPath = [{ lon: water.lon, lat: water.lat }];
    fullPath.push(...result.path);
    fullPath.push({ lon: fire.lon, lat: fire.lat });
    const simplified = simplifyPath(fullPath, 100);

    showLoading(true, '標高データを取得中...', 70);
    const cartographics = simplified.map(p => Cesium.Cartographic.fromDegrees(p.lon, p.lat));
    try {
        const updated = await Cesium.sampleTerrainMostDetailed(S.viewer.terrainProvider, cartographics);
        for (let i = 0; i < simplified.length; i++) simplified[i].height = updated[i].height || 0;
    } catch (e) {
        simplified.forEach(p => p.height = p.height || 0);
    }

    showLoading(true, 'ホースラインを生成中...', 90);
    clearTool();
    S.currentTool = 'hose';
    document.getElementById('modeIcon').textContent = 'route';
    document.getElementById('modeText').textContent = 'ホース延長';
    document.getElementById('modeIndicator').className = 'mode-indicator show hose-mode';
    const hint = document.getElementById('modeHint');
    if (hint) hint.textContent = '「確定」でシミュレーション実行';
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
