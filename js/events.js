import S from './state.js';
import { showCoordPopup, hideCoordPopup, showMarkerInfo } from './ui.js';
import { selectFirePoint, addFirePoint } from './fire.js';
import { selectWater, showWaterPicker, hideWaterPicker } from './water.js';
import { addHosePoint, selectHoseLine } from './hose.js';
import { addMeasurePoint, resetMeasure } from './measure.js';

export function initEventHandlers() {
    const handler = new Cesium.ScreenSpaceEventHandler(S.viewer.scene.canvas);

    // Long press start
    handler.setInputAction(function (click) {
        hideCoordPopup();
        S.longPressStartPos = { x: click.position.x, y: click.position.y };
        S.longPressTimer = setTimeout(async () => {
            if (!S.longPressStartPos) return;
            const ray = S.viewer.camera.getPickRay(click.position);
            const cartesian = S.viewer.scene.globe.pick(ray, S.viewer.scene);
            if (cartesian) {
                const carto = Cesium.Cartographic.fromCartesian(cartesian);
                showCoordPopup(Cesium.Math.toDegrees(carto.latitude), Cesium.Math.toDegrees(carto.longitude), click.position.x, click.position.y);
            }
            S.longPressStartPos = null;
        }, 800);
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    // Cancel long press on move
    handler.setInputAction(function (movement) {
        if (S.longPressTimer && S.longPressStartPos) {
            const dx = movement.endPosition.x - S.longPressStartPos.x;
            const dy = movement.endPosition.y - S.longPressStartPos.y;
            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                clearTimeout(S.longPressTimer);
                S.longPressTimer = null;
                S.longPressStartPos = null;
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Long press end
    handler.setInputAction(function () {
        if (S.longPressTimer) { clearTimeout(S.longPressTimer); S.longPressTimer = null; }
        S.longPressStartPos = null;
    }, Cesium.ScreenSpaceEventType.LEFT_UP);

    // Double click → coord popup
    handler.setInputAction(async function (click) {
        const ray = S.viewer.camera.getPickRay(click.position);
        const cartesian = S.viewer.scene.globe.pick(ray, S.viewer.scene);
        if (cartesian) {
            const carto = Cesium.Cartographic.fromCartesian(cartesian);
            showCoordPopup(Cesium.Math.toDegrees(carto.latitude), Cesium.Math.toDegrees(carto.longitude), click.position.x, click.position.y);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // Main click handler
    handler.setInputAction(async function (click) {
        if (S.longPressTimer) { clearTimeout(S.longPressTimer); S.longPressTimer = null; }
        const picked = S.viewer.scene.pick(click.position);

        if (picked && picked.id) {
            let pickedId = '';
            let entity = null;
            if (typeof picked.id === 'string') { pickedId = picked.id; }
            else if (picked.id.id && typeof picked.id.id === 'string') { pickedId = picked.id.id; entity = picked.id; }

            // ホース延長・計測モード中はfire/waterタップをポイント追加として扱う
            if (S.currentTool === 'hose' || S.currentTool === 'measure') {
                if (pickedId.startsWith('fire-') || pickedId.startsWith('water-')) {
                    // エンティティの位置を取得してポイント追加へフォールスルー
                    // (下のtool action部分で処理される)
                } else if (pickedId.startsWith('relay-') || pickedId.startsWith('start-') || pickedId.startsWith('end-')) {
                    const data = entity.markerData || entity.relayData;
                    if (data) showMarkerInfo(data.name, data.lat, data.lon, data.height, click.position);
                    return;
                }
                // それ以外もフォールスルー（ポイント追加）
            } else {
                // 通常モード: エンティティ選択
                if (pickedId.startsWith('relay-') || pickedId.startsWith('start-') || pickedId.startsWith('end-')) {
                    const data = entity.markerData || entity.relayData;
                    if (data) showMarkerInfo(data.name, data.lat, data.lon, data.height, click.position);
                    return;
                }
                if (pickedId.startsWith('fire-')) { selectFirePoint(pickedId); return; }
                if (pickedId.startsWith('water-')) { selectWater(pickedId); return; }
                if (pickedId.startsWith('hose-')) {
                    const lineId = pickedId.split('-seg-')[0];
                    selectHoseLine(lineId);
                    return;
                }
            }
        }

        // No entity picked → tool action
        const ray = S.viewer.camera.getPickRay(click.position);
        const cartesian = S.viewer.scene.globe.pick(ray, S.viewer.scene);
        if (!cartesian) return;
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(carto.longitude), lat = Cesium.Math.toDegrees(carto.latitude);
        let height = 0;
        try {
            const u = await Cesium.sampleTerrainMostDetailed(S.viewer.terrainProvider, [Cesium.Cartographic.fromDegrees(lon, lat)]);
            height = u[0].height || 0;
        } catch (e) { height = carto.height || 0; }

        if (S.currentTool === 'fire') { const id = addFirePoint(lon, lat, height); selectFirePoint(id); }
        else if (S.currentTool === 'water') { S.pendingWaterCoords = { lon, lat }; showWaterPicker(click.position.x, click.position.y); }
        else if (S.currentTool === 'hose') { addHosePoint(lon, lat, height, cartesian); }
        else if (S.currentTool === 'measure') { if (S.measurePoints.length >= 2) resetMeasure(); addMeasurePoint(lon, lat, height, cartesian); }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Close search results on outside click
    document.addEventListener('click', e => {
        if (!e.target.closest('.search-box') && !e.target.closest('.search-results')) {
            document.getElementById('searchResults').classList.remove('show');
        }
        if (!e.target.closest('.water-picker') && !e.target.closest('#cesiumContainer')) {
            hideWaterPicker();
        }
    });
}
