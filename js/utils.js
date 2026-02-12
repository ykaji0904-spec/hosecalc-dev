import S from './state.js';

export function geodesicDistance(lon1, lat1, lon2, lat2) {
    return new Cesium.EllipsoidGeodesic(
        Cesium.Cartographic.fromDegrees(lon1, lat1),
        Cesium.Cartographic.fromDegrees(lon2, lat2)
    ).surfaceDistance;
}

export function formatDistance(m) {
    return m >= 1000 ? (m / 1000).toFixed(2) + 'km' : m.toFixed(0) + 'm';
}

export function calcLossForDistance(dist, dh, params) {
    const hoses = dist / params.hoseLengthM;
    const frictionLoss = hoses * params.lossPerHoseMPa;
    const elevLoss = dh * 0.01;
    return frictionLoss + elevLoss;
}

export function interpolatePath(points, interval) {
    const result = [];
    let cumulative = 0;
    result.push({ ...points[0], distFromStart: 0 });
    for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1], p2 = points[i];
        const segDist = geodesicDistance(p1.lon, p1.lat, p2.lon, p2.lat);
        const segElev = (p2.height || 0) - (p1.height || 0);
        const steps = Math.ceil(segDist / interval);
        for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            cumulative += segDist / steps;
            result.push({
                lon: p1.lon + (p2.lon - p1.lon) * t,
                lat: p1.lat + (p2.lat - p1.lat) * t,
                height: (p1.height || 0) + segElev * t,
                distFromStart: cumulative
            });
        }
    }
    return result;
}
