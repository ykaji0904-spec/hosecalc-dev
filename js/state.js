import { HOSE_PARAMS_DEFAULT } from './config.js';

const S = {
    viewer: null,
    layers: { buildings: false, trails: false, flood: false, tsunami: false, landslide: false },
    currentTool: null,
    osmBuildingsTileset: null,
    trailEntities: [],
    trailLoadActive: false,
    hazardLayers: { flood: null, tsunami: null, landslide: null },
    stdLayer: null, satelliteLayer: null, currentBasemap: 'satellite',
    myLocationEntity: null, myLocationCoords: null,
    firePoints: [], firePointEntities: [], selectedFirePoint: null, firePointIdCounter: 0,
    waterSources: [], waterEntities: [], selectedWater: null, waterIdCounter: 0, pendingWaterCoords: null,
    hosePoints: [], hoseMarkers: [], hoseLine: null, confirmedLines: [], selectedHoseLine: null,
    hoseSimState: {
        markersByLineId: new Map(), relayMarkersByLine: new Map(),
        colorizedLinesByLine: new Map(), startEndMarkersByLine: new Map()
    },
    hoseParams: { ...HOSE_PARAMS_DEFAULT },
    measurePoints: [], measureMarkers: [], measureLine: null,
    lastClickedCoords: null, longPressTimer: null, longPressStartPos: null,
    isRestoring: false
};

export default S;
