// HoseCalc Configuration
export const CESIUM_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlNTEzZDliYi1lMTk0LTQ5NDQtODI1Zi00YjA1OGQyOGJmNmMiLCJpZCI6Mzg1NDQ0LCJpYXQiOjE3NzAxNzg5ODN9.7k1GwpDCERKghsJ2sdCKZZGBMSbJ4Ksbwlj47ejipy4';

export const DEFAULT_POSITION = { lon: 132.4553, lat: 34.3853, height: 5000 };

export const HOSE_PARAMS_DEFAULT = {
    pumpOutputMPa: 1.2,
    relayOutputMPa: 0.8,
    minInletPressureMPa: 0.15,
    nozzleRequiredMPa: 0.4,
    lossPerHoseMPa: 0.02,
    hoseLengthM: 20
};

export const OVERPASS_SERVERS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

export const TRAIL_RADIUS = 0.0675; // ~7.5km

export const HAZARD_URLS = {
    flood: 'https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png',
    tsunami: 'https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png',
    landslide: 'https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png'
};

export const WATER_TYPE_NAMES = {
    hydrant: '消火栓', tank: '防火水槽', natural: '自然水利', other: 'その他'
};

export const WATER_TYPE_COLORS = {
    hydrant: '#2196f3', tank: '#9c27b0', natural: '#00bcd4', other: '#607d8b'
};

export const GSI_TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
