import S from './state.js';
import { trailGraph, findNearestNode, dijkstra } from './trails.js';
import { addHosePoint, resetHoseLine } from './hose.js';
import { showLoading, showToast, clearTool, closeSidePanel, hideGuideBanner, updateLayerCards } from './ui.js';
import { toggleMapLayer } from './map.js';

// --- バナー表示 ---
function showStepBanner(icon, message, actionLabel, actionFn) {
    let el = document.getElementById('guideBanner');
    if (!el) {
        el = document.createElement('div');
        el.id = 'guideBanner';
        document.body.appendChild(el);
    }
    const colorClass = icon === 'local_fire_department' ? 'ic-fire' : icon === 'water_drop' ? 'ic-water' : icon === 'route' ? 'ic-route' : '';
    el.innerHTML = `
        <div class="guide-banner-body">
            <span class="material-icons ${colorClass}" style="font-size:20px">${icon}</span>
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
    // トレースガイド中はモードインジケーター非表示（バナーだけで誘導）
    const ind = document.getElementById('modeIndicator');
    const ic = document.getElementById('modeIcon');
    const tx = document.getElementById('modeText');
    const ht = document.getElementById('modeHint');
    if (S.traceGuideActive) {
        ind.className = 'mode-indicator';
    } else {
        ic.textContent = iconName;
        tx.textContent = label;
        if (ht) ht.textContent = hintText || '';
        ind.className = 'mode-indicator show ' + modeClass;
    }
    updateLayerCards();
}

// --- トレースボタン押下（毎回火点→水利の選択から開始）---
export async function traceTrailRoute() {
    closeSidePanel();
    clearTool();

    // トレース用の選択をリセット
    S.traceFire = null;
    S.traceWater = null;
    S.traceGuideActive = true;

    const hasTrails = trailGraph.nodes.size > 0;
    if (!hasTrails) {
        S.traceGuideStep = 'trails';
        if (!S.layers.trails) toggleMapLayer('trails');
        showStepBanner('hiking', '登山道データを読み込んでいます...');
    } else {
        goToFireStep();
    }
}

// --- Step: 火点選択/追加 ---
function goToFireStep() {
    S.traceGuideStep = 'fire';
    activateTool('fire', 'local_fire_department', '火点選択', '', '地図タップで新規追加、または既存の火点をタップ');
    if (S.firePoints.length > 0) {
        showStepBanner('local_fire_department', '火点を選択、または地図タップで新規追加');
    } else {
        showStepBanner('local_fire_department', '火点を地図にタップして追加してください');
    }
}

// --- Step: 水利選択/追加 ---
function goToWaterStep() {
    S.traceGuideStep = 'water';
    activateTool('water', 'water_drop', '水利選択', 'water-mode', '地図タップで新規追加、または既存の水利をタップ');
    if (S.waterSources.length > 0) {
        showStepBanner('water_drop', '水利を選択、または地図タップで新規追加');
    } else {
        showStepBanner('water_drop', '水利を地図にタップして追加してください');
    }
}

// --- Step: 準備完了 ---
function goToReadyStep() {
    S.traceGuideStep = null;
    S.traceGuideActive = false;
    clearTool();
    showStepBanner('route', '準備完了', '▶ トレース実行', '_execTrace()');
}

// --- 他モジュールからの通知（新規追加時）---
export function updateTraceGuide() {
    if (!S.traceGuideActive) return;
    const step = S.traceGuideStep;

    if (step === 'trails') {
        if (trailGraph.nodes.size > 0) goToFireStep();
        return;
    }

    if (step === 'fire') {
        const last = S.firePoints[S.firePoints.length - 1];
        if (last) {
            S.traceFire = { lon: last.lon, lat: last.lat, height: last.height };
            showToast('火点を選択しました');
            goToWaterStep();
        }
        return;
    }

    if (step === 'water') {
        const last = S.waterSources[S.waterSources.length - 1];
        if (last) {
            S.traceWater = { lon: last.lon, lat: last.lat };
            showToast('水利を選択しました');
            goToReadyStep();
        }
        return;
    }
}

// --- 既存ポイントタップ時（fire.js / water.js から呼ばれる）---
export function traceSelectFire(fp) {
    if (!S.traceGuideActive || S.traceGuideStep !== 'fire') return false;
    S.traceFire = { lon: fp.lon, lat: fp.lat, height: fp.height };
    showToast('火点を選択しました');
    goToWaterStep();
    return true;
}

export function traceSelectWater(ws) {
    if (!S.traceGuideActive || S.traceGuideStep !== 'water') return false;
    S.traceWater = { lon: ws.lon, lat: ws.lat };
    showToast('水利を選択しました');
    goToReadyStep();
    return true;
}

// --- 実行 ---
export async function execTrace() {
    hideGuideBanner();
    await executeTrace();
}

async function executeTrace() {
    hideGuideBanner();
    S.traceGuideActive = false;
    S.traceGuideStep = null;

    const fire = S.traceFire;
    const water = S.traceWater;
    if (!fire || !water) { showToast('火点と水利を選択してください'); return; }

    showLoading(true, '最適ルートを探索中...', 20);
    const nearWater = findNearestNode(water.lon, water.lat, 1000);
    const nearFire = findNearestNode(fire.lon, fire.lat, 1000);
    if (!nearWater) { showLoading(false); showToast('水利の近くに登山道が見つかりません（1km以内）'); return; }
    if (!nearFire) { showLoading(false); showToast('火点の近くに登山道が見つかりません（1km以内）'); return; }

    showLoading(true, 'ダイクストラ探索中...', 40);
    const result = dijkstra(nearWater.id, nearFire.id);
    if (!result) { showLoading(false); showToast('水利→火点の経路が見つかりません（道がつながっていない可能性）'); return; }

    showLoading(true, `ルート発見（${result.path.length}点, ${(result.totalDist / 1000).toFixed(1)}km）`, 60);
    const fullPath = [{ lon: water.lon, lat: water.lat }];
    fullPath.push(...result.path);
    fullPath.push({ lon: fire.lon, lat: fire.lat });
    const simplified = simplifyPath(fullPath, 100);

    showLoading(true, '標高データを取得中...', 70);
    const cartographics = simplified.map(p => Cesium.Cartographic.fromDegrees(p.lon, p.lat));
    try {
        const updated = await Cesium.sampleTerrainMostDetailed(S.viewer.terrainProvider, cartographics);
        for (let i = 0; i < simplified.length; i++) simplified[i].height = updated[i].height || 0;
    } catch (e) { simplified.forEach(p => p.height = p.height || 0); }

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
    S.traceFire = null;
    S.traceWater = null;
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
