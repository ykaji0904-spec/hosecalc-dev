import S from './state.js';

export function showLoading(show, message, progress) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.toggle('show', show);
    if (message) document.getElementById('loadingMessage').textContent = message;
    if (progress !== undefined) document.getElementById('loadingProgress').style.width = progress + '%';
}

export function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

export function openSidePanel() {
    document.getElementById('sidePanelOverlay').classList.add('show');
    document.getElementById('sidePanel').classList.add('show');
}

export function closeSidePanel() {
    document.getElementById('sidePanelOverlay').classList.remove('show');
    document.getElementById('sidePanel').classList.remove('show');
}

export function updateLayerCards() {
    document.getElementById('layerBuildings').classList.toggle('active', S.layers.buildings);
    document.getElementById('layerTrails').classList.toggle('active', S.layers.trails);
    document.getElementById('layerFlood').classList.toggle('active', S.layers.flood);
    document.getElementById('layerTsunami').classList.toggle('active', S.layers.tsunami);
    document.getElementById('layerLandslide').classList.toggle('active', S.layers.landslide);
    ['opFire', 'opWater', 'opHose', 'opMeasure'].forEach(id => document.getElementById(id).classList.remove('active'));
    if (S.currentTool === 'fire') document.getElementById('opFire').classList.add('active');
    if (S.currentTool === 'water') document.getElementById('opWater').classList.add('active');
    if (S.currentTool === 'hose') document.getElementById('opHose').classList.add('active');
    if (S.currentTool === 'measure') document.getElementById('opMeasure').classList.add('active');
}

export function clearTool() {
    S.currentTool = null;
    document.getElementById('modeIndicator').className = 'mode-indicator';
    document.getElementById('hosePanel').classList.remove('active');
    document.getElementById('measurePanel').classList.remove('active');
}

export function closeAllPanels() {
    ['firePanel', 'waterPanel', 'hoseInfoPanel', 'hosePanel', 'measurePanel'].forEach(
        id => document.getElementById(id).classList.remove('active')
    );
    S.selectedFirePoint = null;
    S.selectedWater = null;
    hideCoordPopup();
}

export function closePanel(type) {
    document.getElementById(type + 'Panel').classList.remove('active');
    if (type === 'fire') S.selectedFirePoint = null;
    if (type === 'water') S.selectedWater = null;
    if (type === 'hoseInfo') S.selectedHoseLine = null;
}

export function showCoordPopup(lat, lon, x, y) {
    S.lastClickedCoords = { lat, lon };
    const popup = document.getElementById('coordPopup');
    document.getElementById('coordPopupValue').textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    popup.style.left = Math.min(x, window.innerWidth - 150) + 'px';
    popup.style.top = Math.min(y, window.innerHeight - 90) + 'px';
    popup.classList.add('show');
}

export function hideCoordPopup() {
    document.getElementById('coordPopup').classList.remove('show');
}

export function copyCoords() {
    if (S.lastClickedCoords) {
        navigator.clipboard.writeText(`${S.lastClickedCoords.lat.toFixed(6)}, ${S.lastClickedCoords.lon.toFixed(6)}`);
        showToast('座標をコピーしました');
        hideCoordPopup();
    }
}

export function copyText(el) {
    navigator.clipboard.writeText(el.textContent.replace('°', ''));
    showToast('コピーしました');
}

export function showMarkerInfo(name, lat, lon, height, screenPos) {
    const popup = document.getElementById('markerPopup');
    document.getElementById('markerPopupName').textContent = name;
    document.getElementById('markerPopupCoord').textContent = lat.toFixed(6) + ', ' + lon.toFixed(6);
    document.getElementById('markerPopupElev').textContent = '標高: ' + height.toFixed(1) + 'm';
    popup.style.left = Math.min(screenPos.x, window.innerWidth - 180) + 'px';
    popup.style.top = Math.max(10, screenPos.y - 100) + 'px';
    popup.classList.add('show');
    popup.markerData = { lat, lon };
}

export function hideMarkerPopup() {
    document.getElementById('markerPopup').classList.remove('show');
}

export function copyMarkerCoords() {
    const popup = document.getElementById('markerPopup');
    if (popup.markerData) {
        navigator.clipboard.writeText(popup.markerData.lat.toFixed(6) + ', ' + popup.markerData.lon.toFixed(6));
        showToast('座標をコピーしました');
        hideMarkerPopup();
    }
}

// Info modal
const INFO_CONTENT = {
    about: {
        title: 'HoseCalcについて',
        html: '<h3>概要</h3><p>林野火災などの際にホース延長シミュレーションを行うプラットフォームです。</p><h3>主な機能</h3><p>・リアルな地形データを使ったホース延長シミュレーション<br>・圧力損失と中継ポンプ位置の自動計算<br>・火点・水利ポイントの登録と管理<br>・洪水・津波・土砂災害ハザードマップの重畳表示<br>・登山道の表示</p><h3>対象ユーザー</h3><p>消防職員・消防団員・その他防災関係者</p><p style="color:rgba(255,255,255,0.4);margin-top:16px">開発: Y.K.</p>'
    },
    usage: {
        title: '使い方',
        html: '<h3>地図操作</h3><p>・ドラッグ: 地図の移動<br>・ピンチ/スクロール: ズーム<br>・右ドラッグ（PC）: 視点回転<br>・Ctrl+ドラッグ（PC）: 傾き調整<br>・ダブルタップ/長押し: 座標表示</p><h3>火点を登録する</h3><p>1. メニュー →「火点」を選択<br>2. 地図上の火災発生地点をタップ<br>3. 登録完了</p><h3>水利を登録する</h3><p>1. メニュー →「水利」を選択<br>2. 消火栓・防火水槽などの位置をタップ<br>3. 登録完了</p><h3>ホース延長シミュレーション</h3><p>1. メニュー →「ホース延長」を選択<br>2. 水利位置から順にタップしてルートを描画<br>3.「確定」ボタンで計算実行<br>4. 中継ポンプ位置と残圧が自動表示</p><h3>2点計測</h3><p>1. メニュー →「2点計測」を選択<br>2. 2点をタップ<br>3. 距離・高低差が表示</p>'
    },
    calc: {
        title: '計算方法',
        html: '<h3>パラメータ（初期値）</h3><div class="param-row"><span class="param-label">消防車送水圧</span><span class="param-value">1.2 MPa</span></div><div class="param-row"><span class="param-label">可搬ポンプ送水圧</span><span class="param-value">0.8 MPa</span></div><div class="param-row"><span class="param-label">中継受水圧</span><span class="param-value">0.15 MPa</span></div><div class="param-row"><span class="param-label">筒先必要圧</span><span class="param-value">0.4 MPa</span></div><div class="param-row"><span class="param-label">摩擦損失</span><span class="param-value">0.02 MPa/本</span></div><h3>圧力損失の計算式</h3><p>・摩擦損失 = 0.02 × ホース本数<br>・高低差損失 = 0.01 × 高低差(m)<br>　※上りはプラス（圧力低下）、下りはマイナス（圧力増加）</p><h3>ライン表示色</h3><div class="param-row"><span class="param-label">緑</span><span class="param-value">≥ 0.5 MPa</span></div><div class="param-row"><span class="param-label">黄</span><span class="param-value">0.3 〜 0.5 MPa</span></div><div class="param-row"><span class="param-label">赤</span><span class="param-value">< 0.3 MPa</span></div>'
    },
    source: {
        title: 'データソース',
        html: '<div class="param-row"><span class="param-label">衛星画像</span><span class="param-value">Cesium Ion</span></div><div class="param-row"><span class="param-label">地形</span><span class="param-value">Cesium World Terrain</span></div><div class="param-row"><span class="param-label">標準地図</span><span class="param-value">国土地理院</span></div><div class="param-row"><span class="param-label">登山道</span><span class="param-value">OpenStreetMap</span></div><div class="param-row"><span class="param-label">ハザードマップ</span><span class="param-value">国土交通省</span></div>'
    }
};

export function showInfo(type) {
    const item = INFO_CONTENT[type];
    if (!item) return;
    document.getElementById('infoModalTitle').textContent = item.title;
    document.getElementById('infoModalBody').innerHTML = item.html;
    document.getElementById('infoModalOverlay').classList.add('show');
}

export function closeInfoModal() {
    document.getElementById('infoModalOverlay').classList.remove('show');
}

// ガイドバナー
export function showGuideBanner(steps) {
    // steps: [{label, done, active}]
    let el = document.getElementById('guideBanner');
    if (!el) {
        el = document.createElement('div');
        el.id = 'guideBanner';
        document.body.appendChild(el);
    }
    el.innerHTML = `
        <div class="guide-banner-header">
            <span class="material-icons">timeline</span>
            登山道トレース
            <button class="guide-close" onclick="hideGuideBanner()">✕</button>
        </div>
        <div class="guide-steps">
            ${steps.map((s, i) => `
                <div class="guide-step ${s.done ? 'done' : ''} ${s.active ? 'active' : ''}">
                    <span class="guide-num">${s.done ? '✓' : i + 1}</span>
                    <span class="guide-label">${s.label}</span>
                </div>
            `).join('<div class="guide-arrow">→</div>')}
        </div>
    `;
    el.classList.add('show');
}

export function hideGuideBanner() {
    const el = document.getElementById('guideBanner');
    if (el) el.classList.remove('show');
    S.traceGuideActive = false;
}
