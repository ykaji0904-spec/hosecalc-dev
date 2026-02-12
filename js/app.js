import S from './state.js';
import { initViewer, setBasemap, setViewMode, toggleMapLayer, toggleHazardLayer, goToMyLocation, initLocation } from './map.js';
import { showLoading, showToast, openSidePanel, closeSidePanel, updateLayerCards, clearTool, closeAllPanels, closePanel, copyCoords, copyText, copyMarkerCoords, hideCoordPopup, hideMarkerPopup, showInfo, closeInfoModal } from './ui.js';
import { addFirePoint, selectFirePoint, deleteSelectedFire } from './fire.js';
import { addWaterSource, selectWater, deleteSelectedWater, showWaterPicker, hideWaterPicker, confirmWaterType } from './water.js';
import { addHosePoint, undoHosePoint, resetHoseLine, closeHosePanel, confirmHoseLine, selectHoseLine, deleteSelectedHose, onParamChange, clearSimulationVisuals, runSimulationForLine } from './hose.js';
import { addMeasurePoint, resetMeasure, closeMeasurePanel } from './measure.js';
import { doSearch, flyToSearch } from './search.js';
import { saveAllData, loadAllData, clearStoredData } from './storage.js';
import { shareSimulation, restoreFromURL } from './share.js';
import { initEventHandlers } from './events.js';
import { traceTrailRoute } from './trace.js';

// === Global error handler (PC問題診断用) ===
window.onerror = function(msg, url, line, col, err) {
    console.error('[HoseCalc Error]', msg, url, line, col, err);
    const el = document.getElementById('loadingMessage');
    if (el) el.textContent = 'エラー: ' + msg;
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('show');
};
window.addEventListener('unhandledrejection', function(e) {
    console.error('[HoseCalc Unhandled Promise]', e.reason);
});

// === Functions ===

function setOperation(op) {
    if (S.currentTool === op) { clearTool(); updateLayerCards(); return; }
    clearTool(); S.currentTool = op;
    const ind = document.getElementById('modeIndicator'), icon = document.getElementById('modeIcon'), text = document.getElementById('modeText');
    if (op === 'fire') { icon.textContent = 'local_fire_department'; text.textContent = '火点追加'; ind.className = 'mode-indicator show'; }
    else if (op === 'water') { icon.textContent = 'water_drop'; text.textContent = '水利追加'; ind.className = 'mode-indicator show water-mode'; }
    else if (op === 'hose') { icon.textContent = 'route'; text.textContent = 'ホース延長'; ind.className = 'mode-indicator show hose-mode'; document.getElementById('hosePanel').classList.add('active'); resetHoseLine(); }
    else if (op === 'measure') { icon.textContent = 'straighten'; text.textContent = '2点計測'; ind.className = 'mode-indicator show measure-mode'; document.getElementById('measurePanel').classList.add('active'); resetMeasure(); }
    updateLayerCards();
    closeSidePanel();
}

function clearAllDataConfirm() {
    closeSidePanel();
    if (!confirm('全てのデータ（火点・水利・ホースライン）を削除しますか？')) return;
    S.firePointEntities.forEach(e => S.viewer.entities.remove(e));
    S.firePoints = []; S.firePointEntities = []; S.selectedFirePoint = null;
    S.waterEntities.forEach(e => S.viewer.entities.remove(e));
    S.waterSources = []; S.waterEntities = []; S.selectedWater = null;
    S.confirmedLines.forEach(l => clearSimulationVisuals(l.id));
    S.confirmedLines = []; S.selectedHoseLine = null;
    closeAllPanels();
    clearStoredData();
    history.replaceState(null, '', window.location.pathname);
    S.viewer.scene.requestRender();
    showToast('全データを削除しました');
}

async function restoreData() {
    const restoredFromURL = await restoreFromURL();
    if (restoredFromURL) return;
    const data = loadAllData();
    if (!data) return;
    S.isRestoring = true;
    try {
        if (data.counters) { S.firePointIdCounter = data.counters.fire || 0; S.waterIdCounter = data.counters.water || 0; }
        (data.firePoints || []).forEach(p => addFirePoint(p.lon, p.lat, p.height));
        (data.waterSources || []).forEach(w => addWaterSource(w.type, w.name, w.lon, w.lat));
        (data.confirmedLines || []).forEach(l => {
            S.confirmedLines.push({ id: l.id, points: l.points });
            runSimulationForLine(l.id, l.points);
        });
        if (data.firePoints.length || data.waterSources.length || data.confirmedLines.length) showToast('前回のデータを復元しました');
        S.viewer.scene.requestRender();
    } finally { S.isRestoring = false; }
}

// === Expose to window ===
Object.assign(window, {
    setBasemap, setViewMode, toggleMapLayer, toggleHazardLayer, goToMyLocation,
    openSidePanel, closeSidePanel, closePanel, copyCoords, copyText, copyMarkerCoords,
    hideCoordPopup, hideMarkerPopup, showInfo, closeInfoModal,
    deleteSelectedFire, confirmWaterType,
    undoHosePoint, resetHoseLine, closeHosePanel, confirmHoseLine, deleteSelectedHose, onParamChange,
    resetMeasure, closeMeasurePanel,
    doSearch, _flyToSearch: flyToSearch,
    setOperation, clearAllDataConfirm, shareSimulation, traceTrailRoute
});

// === Boot ===
// ブラウザのレイアウト完了を確実に待ってからCesium初期化
// ESModule (type="module") はdeferredだがレイアウト完了とは限らない
function boot() {
    console.log('[HoseCalc] Boot: starting...');
    
    // コンテナのサイズ確認
    const container = document.getElementById('cesiumContainer');
    if (!container) {
        console.error('[HoseCalc] cesiumContainer not found');
        return;
    }
    console.log('[HoseCalc] Container size:', container.clientWidth, 'x', container.clientHeight);
    
    // コンテナが0サイズなら次のフレームまで待つ
    if (container.clientWidth === 0 || container.clientHeight === 0) {
        console.log('[HoseCalc] Container has 0 size, waiting for layout...');
        requestAnimationFrame(boot);
        return;
    }

    // Cesiumが読み込まれているか確認
    if (typeof Cesium === 'undefined') {
        console.error('[HoseCalc] Cesium not loaded');
        document.getElementById('loadingMessage').textContent = 'Cesiumライブラリの読み込みに失敗しました。';
        document.getElementById('loadingOverlay').classList.add('show');
        return;
    }
    console.log('[HoseCalc] Cesium version:', Cesium.VERSION);

    try {
        const viewer = initViewer();
        if (!viewer) {
            document.getElementById('loadingMessage').textContent = '地図の初期化に失敗しました。ページを再読み込みしてください。';
            document.getElementById('loadingOverlay').classList.add('show');
            return;
        }
        console.log('[HoseCalc] Viewer created, canvas:', viewer.canvas.width, 'x', viewer.canvas.height);
        
        showLoading(false);
        updateLayerCards();
        initEventHandlers();
        initLocation();
        setTimeout(() => restoreData(), 1500);
        console.log('[HoseCalc] Boot complete');
    } catch (e) {
        console.error('[HoseCalc] Boot failed:', e);
        document.getElementById('loadingMessage').textContent = 'エラー: ' + e.message;
        document.getElementById('loadingOverlay').classList.add('show');
    }
}

// DOMレイアウト完了を確実に待つ
if (document.readyState === 'complete') {
    // windowのloadイベントが既に発火済み
    requestAnimationFrame(boot);
} else {
    // loadイベントを待つ（全リソース+レイアウト完了保証）
    window.addEventListener('load', () => requestAnimationFrame(boot));
}
