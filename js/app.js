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

// === Initialize ===

const viewer = initViewer();

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
    S.firePoints.forEach((_, i) => S.viewer.entities.remove(S.firePointEntities[i]));
    S.firePoints = []; S.firePointEntities = []; S.selectedFirePoint = null;
    S.waterSources.forEach((_, i) => S.viewer.entities.remove(S.waterEntities[i]));
    S.waterSources = []; S.waterEntities = []; S.selectedWater = null;
    S.confirmedLines.forEach(l => clearSimulationVisuals(l.id));
    S.confirmedLines = []; S.selectedHoseLine = null;
    closeAllPanels();
    clearStoredData();
    // Clear URL hash
    history.replaceState(null, '', window.location.pathname);
    S.viewer.scene.requestRender();
    showToast('全データを削除しました');
}

async function restoreData() {
    // URL共有データがあればそちらを優先
    const restoredFromURL = await restoreFromURL();
    if (restoredFromURL) return;

    // なければlocalStorageから復元
    const data = loadAllData();
    if (!data) return;

    S.isRestoring = true;
    try {
        if (data.counters) {
            S.firePointIdCounter = data.counters.fire || 0;
            S.waterIdCounter = data.counters.water || 0;
        }
        (data.firePoints || []).forEach(p => addFirePoint(p.lon, p.lat, p.height));
        (data.waterSources || []).forEach(w => addWaterSource(w.type, w.name, w.lon, w.lat));
        (data.confirmedLines || []).forEach(l => {
            S.confirmedLines.push({ id: l.id, points: l.points });
            runSimulationForLine(l.id, l.points);
        });
        if (data.firePoints.length || data.waterSources.length || data.confirmedLines.length) {
            showToast('前回のデータを復元しました');
        }
        S.viewer.scene.requestRender();
    } finally {
        S.isRestoring = false;
    }
}

// === Expose functions to HTML onclick handlers ===

Object.assign(window, {
    // Map
    setBasemap, setViewMode, toggleMapLayer, toggleHazardLayer, goToMyLocation,
    // UI
    openSidePanel, closeSidePanel, closePanel, copyCoords, copyText, copyMarkerCoords,
    hideCoordPopup, hideMarkerPopup, showInfo, closeInfoModal,
    // Fire
    deleteSelectedFire,
    // Water
    confirmWaterType,
    // Hose
    undoHosePoint, resetHoseLine, closeHosePanel, confirmHoseLine, deleteSelectedHose, onParamChange,
    // Measure
    resetMeasure, closeMeasurePanel,
    // Search
    doSearch, _flyToSearch: flyToSearch,
    // Operations
    setOperation,
    // Data
    clearAllDataConfirm,
    // Share
    shareSimulation
});

// === Boot ===

showLoading(false);
updateLayerCards();
initEventHandlers();
initLocation();
setTimeout(() => restoreData(), 1500);
