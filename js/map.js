import S from './state.js';
import { CESIUM_TOKEN, DEFAULT_POSITION, GSI_TILE_URL, HAZARD_URLS } from './config.js';
import { updateLayerCards, showToast } from './ui.js';

export function initViewer() {
    Cesium.Ion.defaultAccessToken = CESIUM_TOKEN;

    try {
        S.viewer = new Cesium.Viewer('cesiumContainer', {
            imageryProvider: new Cesium.IonImageryProvider({ assetId: 2 }),
            terrainProvider: Cesium.createWorldTerrain({ requestWaterMask: false, requestVertexNormals: false }),
            baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
            navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false,
            infoBox: false, selectionIndicator: false,
            requestRenderMode: false, msaaSamples: 1
        });
    } catch (e) {
        console.error('Cesium Viewer init failed:', e);
        return null;
    }

    const v = S.viewer;

    // Globe rendering settings - PCの大画面でも素早くタイルを表示
    v.scene.globe.tileCacheSize = 1000;
    v.scene.globe.maximumScreenSpaceError = 4; // PC: 2は厳しすぎる→4で高速化
    v.scene.fog.enabled = false;
    v.scene.skyAtmosphere.show = false;
    v.scene.globe.showGroundAtmosphere = false;

    // Camera controls
    v.scene.screenSpaceCameraController.enableRotate = true;
    v.scene.screenSpaceCameraController.enableTranslate = true;
    v.scene.screenSpaceCameraController.enableZoom = true;
    v.scene.screenSpaceCameraController.enableTilt = true;
    v.scene.screenSpaceCameraController.enableLook = true;
    v.scene.screenSpaceCameraController.inertiaSpin = 0.5;
    v.scene.screenSpaceCameraController.inertiaTranslate = 0.5;
    v.scene.screenSpaceCameraController.inertiaZoom = 0.5;

    // Initial camera position
    v.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(DEFAULT_POSITION.lon, DEFAULT_POSITION.lat, DEFAULT_POSITION.height)
    });

    // Basemap layers
    S.satelliteLayer = v.imageryLayers.get(0);
    S.stdLayer = v.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({ url: GSI_TILE_URL, maximumLevel: 18 })
    );
    S.stdLayer.show = false;

    // Force resize to ensure container dimensions are correct (ESModule defer fix)
    v.resize();
    v.scene.requestRender();

    // Re-resize on window resize
    window.addEventListener('resize', () => {
        v.resize();
        v.scene.requestRender();
    });

    // Force multiple render passes during initial tile load
    let renderKicks = 0;
    const renderInterval = setInterval(() => {
        v.scene.requestRender();
        renderKicks++;
        if (renderKicks > 10) clearInterval(renderInterval);
    }, 500);

    // Scale bar
    v.camera.moveEnd.addEventListener(updateScaleBar);
    setTimeout(updateScaleBar, 3000);

    return v;
}

export function setBasemap(type) {
    document.querySelectorAll('.map-type-btn').forEach(b => b.classList.remove('active'));
    if (type === 'satellite') {
        document.getElementById('mapBtnSatellite').classList.add('active');
        if (S.satelliteLayer) S.satelliteLayer.show = true;
        if (S.stdLayer) S.stdLayer.show = false;
    } else {
        document.getElementById('mapBtnStd').classList.add('active');
        if (S.satelliteLayer) S.satelliteLayer.show = false;
        if (S.stdLayer) S.stdLayer.show = true;
    }
    S.currentBasemap = type;
    updateCredit();
}

export function updateCredit() {
    const l = S.layers;
    if (l.flood || l.tsunami || l.landslide) document.getElementById('creditBar').textContent = '© 国土交通省ハザードマップ';
    else if (S.currentBasemap === 'std') document.getElementById('creditBar').textContent = '© 国土地理院';
    else document.getElementById('creditBar').textContent = '© Cesium Ion';
}

export function setViewMode(mode) {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.view-btn[onclick*="${mode}"]`).classList.add('active');
    S.viewer.scene.mode = mode === '2d' ? Cesium.SceneMode.SCENE2D : Cesium.SceneMode.SCENE3D;
}

export async function init3DBuildings() {
    try {
        S.osmBuildingsTileset = S.viewer.scene.primitives.add(
            new Cesium.Cesium3DTileset({ url: Cesium.IonResource.fromAssetId(96188) })
        );
        S.osmBuildingsTileset.show = S.layers.buildings;
    } catch (e) { console.warn('Buildings:', e); }
}

export function toggleMapLayer(layer) {
    S.layers[layer] = !S.layers[layer];
    if (layer === 'buildings') {
        if (S.layers.buildings && !S.osmBuildingsTileset) init3DBuildings();
        else if (S.osmBuildingsTileset) S.osmBuildingsTileset.show = S.layers.buildings;
    }
    if (layer === 'trails') {
        S.trailEntities.forEach(e => e.show = S.layers.trails);
        if (S.layers.trails) {
            import('./trails.js').then(m => m.loadTrails());
        }
    }
    updateLayerCards();
}

export function toggleHazardLayer(layer) {
    const wasOn = S.layers[layer];
    ['flood', 'tsunami', 'landslide'].forEach(h => {
        S.layers[h] = false;
        if (S.hazardLayers[h]) {
            S.viewer.imageryLayers.remove(S.hazardLayers[h]);
            S.hazardLayers[h] = null;
        }
    });
    if (!wasOn) {
        S.layers[layer] = true;
        const url = HAZARD_URLS[layer];
        if (url) {
            S.hazardLayers[layer] = S.viewer.imageryLayers.addImageryProvider(
                new Cesium.UrlTemplateImageryProvider({ url, maximumLevel: 17 })
            );
            S.hazardLayers[layer].alpha = 0.6;
        }
    }
    updateLayerCards();
    updateCredit();
}

export function goToMyLocation() {
    if (!navigator.geolocation) { document.getElementById('myLocationText').textContent = '非対応'; return; }
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        S.myLocationCoords = { lat, lon };
        document.getElementById('myLocationText').textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        S.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1000), duration: 1.5 });
        if (S.myLocationEntity) S.viewer.entities.remove(S.myLocationEntity);
        S.myLocationEntity = S.viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lon, lat),
            billboard: { image: createMyLocationIcon(), width: 24, height: 24, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND }
        });
    }, () => { document.getElementById('myLocationText').textContent = '取得失敗'; });
}

function createMyLocationIcon() {
    const c = document.createElement('canvas'); c.width = 24; c.height = 24;
    const ctx = c.getContext('2d');
    ctx.beginPath(); ctx.arc(12, 12, 10, 0, Math.PI * 2); ctx.fillStyle = '#4ade80'; ctx.fill();
    ctx.beginPath(); ctx.arc(12, 12, 5, 0, Math.PI * 2); ctx.fillStyle = 'white'; ctx.fill();
    return c.toDataURL();
}

function updateScaleBar() {
    try {
        const v = S.viewer;
        const width = v.canvas.clientWidth;
        if (width === 0) return; // Container not yet sized
        const left = v.scene.camera.getPickRay(new Cesium.Cartesian2(width * 0.3, v.canvas.clientHeight / 2));
        const right = v.scene.camera.getPickRay(new Cesium.Cartesian2(width * 0.7, v.canvas.clientHeight / 2));
        if (!left || !right) return;
        const leftPos = v.scene.globe.pick(left, v.scene);
        const rightPos = v.scene.globe.pick(right, v.scene);
        if (!leftPos || !rightPos) return;
        const distance = Cesium.Cartesian3.distance(leftPos, rightPos) / 2;
        let scaleValue = distance * (60 / (width * 0.2));
        const scales = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
        let best = scales[0];
        for (const s of scales) { if (scaleValue >= s) best = s; }
        const scaleWidth = Math.round(60 * (best / scaleValue));
        document.getElementById('scaleLine').style.width = Math.max(30, Math.min(80, scaleWidth)) + 'px';
        document.getElementById('scaleText').textContent = best >= 1000 ? (best / 1000) + 'km' : best + 'm';
    } catch (e) { }
}

export function initLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude, lon = pos.coords.longitude;
            S.myLocationCoords = { lat, lon };
            document.getElementById('myLocationText').textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
            if (S.myLocationEntity) S.viewer.entities.remove(S.myLocationEntity);
            S.myLocationEntity = S.viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(lon, lat),
                billboard: { image: createMyLocationIcon(), width: 24, height: 24, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND }
            });
        }, () => { document.getElementById('myLocationText').textContent = '取得失敗'; }, { timeout: 10000 });
    }
}
