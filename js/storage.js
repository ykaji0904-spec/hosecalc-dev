import S from './state.js';

const STORAGE_KEY = 'hosecalc_data';

export function saveAllData() {
    if (S.isRestoring) return;
    try {
        const data = {
            firePoints: S.firePoints.map(p => ({ id: p.id, lon: p.lon, lat: p.lat, height: p.height })),
            waterSources: S.waterSources.map(w => ({ id: w.id, type: w.type, name: w.name, lon: w.lon, lat: w.lat })),
            confirmedLines: S.confirmedLines.map(l => ({ id: l.id, points: l.points.map(p => ({ lon: p.lon, lat: p.lat, height: p.height })) })),
            counters: { fire: S.firePointIdCounter, water: S.waterIdCounter }
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { console.warn('Save failed:', e); }
}

export function loadAllData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) { console.warn('Load failed:', e); return null; }
}

export function clearStoredData() {
    localStorage.removeItem(STORAGE_KEY);
}
