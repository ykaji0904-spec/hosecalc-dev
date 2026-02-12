import S from './state.js';
import { showLoading, showToast } from './ui.js';

export async function doSearch() {
    const q = document.getElementById('searchInput').value.trim();
    if (!q) return;
    showLoading(true, '検索中...', 50);
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=jp&limit=5`);
        const data = await res.json();
        const sr = document.getElementById('searchResults');
        sr.innerHTML = data.length === 0
            ? '<div class="search-result-item"><span class="search-result-name">結果なし</span></div>'
            : data.map(r => `<div class="search-result-item" onclick="window._flyToSearch(${r.lon},${r.lat})"><div class="search-result-name">${r.display_name.split(',')[0]}</div><div class="search-result-address">${r.display_name}</div></div>`).join('');
        sr.classList.add('show');
    } catch (e) { showToast('検索エラー'); }
    showLoading(false);
}

export function flyToSearch(lon, lat) {
    S.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1500), duration: 1.5 });
    document.getElementById('searchResults').classList.remove('show');
}
