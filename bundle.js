var HoseCalc = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // js/config.js
  var CESIUM_TOKEN, DEFAULT_POSITION, HOSE_PARAMS_DEFAULT, OVERPASS_SERVERS, TRAIL_RADIUS, HAZARD_URLS, WATER_TYPE_NAMES, WATER_TYPE_COLORS, GSI_TILE_URL;
  var init_config = __esm({
    "js/config.js"() {
      CESIUM_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlNTEzZDliYi1lMTk0LTQ5NDQtODI1Zi00YjA1OGQyOGJmNmMiLCJpZCI6Mzg1NDQ0LCJpYXQiOjE3NzAxNzg5ODN9.7k1GwpDCERKghsJ2sdCKZZGBMSbJ4Ksbwlj47ejipy4";
      DEFAULT_POSITION = { lon: 132.4553, lat: 34.3853, height: 5e3 };
      HOSE_PARAMS_DEFAULT = {
        pumpOutputMPa: 1.2,
        relayOutputMPa: 0.8,
        minInletPressureMPa: 0.15,
        nozzleRequiredMPa: 0.4,
        lossPerHoseMPa: 0.02,
        hoseLengthM: 20
      };
      OVERPASS_SERVERS = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
      ];
      TRAIL_RADIUS = 0.0675;
      HAZARD_URLS = {
        flood: "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png",
        tsunami: "https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png",
        landslide: "https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png"
      };
      WATER_TYPE_NAMES = {
        hydrant: "\u6D88\u706B\u6813",
        tank: "\u9632\u706B\u6C34\u69FD",
        natural: "\u81EA\u7136\u6C34\u5229",
        other: "\u305D\u306E\u4ED6"
      };
      WATER_TYPE_COLORS = {
        hydrant: "#2196f3",
        tank: "#9c27b0",
        natural: "#00bcd4",
        other: "#607d8b"
      };
      GSI_TILE_URL = "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png";
    }
  });

  // js/state.js
  var S, state_default;
  var init_state = __esm({
    "js/state.js"() {
      init_config();
      S = {
        viewer: null,
        layers: { buildings: false, trails: false, flood: false, tsunami: false, landslide: false },
        currentTool: null,
        osmBuildingsTileset: null,
        trailEntities: [],
        trailLoadActive: false,
        hazardLayers: { flood: null, tsunami: null, landslide: null },
        stdLayer: null,
        satelliteLayer: null,
        currentBasemap: "satellite",
        myLocationEntity: null,
        myLocationCoords: null,
        firePoints: [],
        firePointEntities: [],
        selectedFirePoint: null,
        firePointIdCounter: 0,
        waterSources: [],
        waterEntities: [],
        selectedWater: null,
        waterIdCounter: 0,
        pendingWaterCoords: null,
        hosePoints: [],
        hoseMarkers: [],
        hoseLine: null,
        confirmedLines: [],
        selectedHoseLine: null,
        hoseSimState: {
          markersByLineId: /* @__PURE__ */ new Map(),
          relayMarkersByLine: /* @__PURE__ */ new Map(),
          colorizedLinesByLine: /* @__PURE__ */ new Map(),
          startEndMarkersByLine: /* @__PURE__ */ new Map()
        },
        hoseParams: { ...HOSE_PARAMS_DEFAULT },
        measurePoints: [],
        measureMarkers: [],
        measureLine: null,
        lastClickedCoords: null,
        longPressTimer: null,
        longPressStartPos: null,
        isRestoring: false
      };
      state_default = S;
    }
  });

  // js/ui.js
  function showLoading(show, message, progress) {
    const overlay = document.getElementById("loadingOverlay");
    overlay.classList.toggle("show", show);
    if (message) document.getElementById("loadingMessage").textContent = message;
    if (progress !== void 0) document.getElementById("loadingProgress").style.width = progress + "%";
  }
  function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.remove("show");
    void t.offsetWidth;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2500);
  }
  function openSidePanel() {
    document.getElementById("sidePanelOverlay").classList.add("show");
    document.getElementById("sidePanel").classList.add("show");
  }
  function closeSidePanel() {
    document.getElementById("sidePanelOverlay").classList.remove("show");
    document.getElementById("sidePanel").classList.remove("show");
  }
  function updateLayerCards() {
    document.getElementById("layerBuildings").classList.toggle("active", state_default.layers.buildings);
    document.getElementById("layerTrails").classList.toggle("active", state_default.layers.trails);
    document.getElementById("layerFlood").classList.toggle("active", state_default.layers.flood);
    document.getElementById("layerTsunami").classList.toggle("active", state_default.layers.tsunami);
    document.getElementById("layerLandslide").classList.toggle("active", state_default.layers.landslide);
    ["opFire", "opWater", "opHose", "opMeasure"].forEach((id) => document.getElementById(id).classList.remove("active"));
    if (state_default.currentTool === "fire") document.getElementById("opFire").classList.add("active");
    if (state_default.currentTool === "water") document.getElementById("opWater").classList.add("active");
    if (state_default.currentTool === "hose") document.getElementById("opHose").classList.add("active");
    if (state_default.currentTool === "measure") document.getElementById("opMeasure").classList.add("active");
  }
  function clearTool() {
    state_default.currentTool = null;
    document.getElementById("modeIndicator").className = "mode-indicator";
    document.getElementById("hosePanel").classList.remove("active");
    document.getElementById("measurePanel").classList.remove("active");
  }
  function closeAllPanels() {
    ["firePanel", "waterPanel", "hoseInfoPanel", "hosePanel", "measurePanel"].forEach(
      (id) => document.getElementById(id).classList.remove("active")
    );
    state_default.selectedFirePoint = null;
    state_default.selectedWater = null;
    hideCoordPopup();
  }
  function closePanel(type) {
    document.getElementById(type + "Panel").classList.remove("active");
    if (type === "fire") state_default.selectedFirePoint = null;
    if (type === "water") state_default.selectedWater = null;
    if (type === "hoseInfo") state_default.selectedHoseLine = null;
  }
  function showCoordPopup(lat, lon, x, y) {
    state_default.lastClickedCoords = { lat, lon };
    const popup = document.getElementById("coordPopup");
    document.getElementById("coordPopupValue").textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    popup.style.left = Math.min(x, window.innerWidth - 150) + "px";
    popup.style.top = Math.min(y, window.innerHeight - 90) + "px";
    popup.classList.add("show");
  }
  function hideCoordPopup() {
    document.getElementById("coordPopup").classList.remove("show");
  }
  function copyCoords() {
    if (state_default.lastClickedCoords) {
      navigator.clipboard.writeText(`${state_default.lastClickedCoords.lat.toFixed(6)}, ${state_default.lastClickedCoords.lon.toFixed(6)}`);
      showToast("\u5EA7\u6A19\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F");
      hideCoordPopup();
    }
  }
  function copyText(el) {
    navigator.clipboard.writeText(el.textContent.replace("\xB0", ""));
    showToast("\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F");
  }
  function showMarkerInfo(name, lat, lon, height, screenPos) {
    const popup = document.getElementById("markerPopup");
    document.getElementById("markerPopupName").textContent = name;
    document.getElementById("markerPopupCoord").textContent = lat.toFixed(6) + ", " + lon.toFixed(6);
    document.getElementById("markerPopupElev").textContent = "\u6A19\u9AD8: " + height.toFixed(1) + "m";
    popup.style.left = Math.min(screenPos.x, window.innerWidth - 180) + "px";
    popup.style.top = Math.max(10, screenPos.y - 100) + "px";
    popup.classList.add("show");
    popup.markerData = { lat, lon };
  }
  function hideMarkerPopup() {
    document.getElementById("markerPopup").classList.remove("show");
  }
  function copyMarkerCoords() {
    const popup = document.getElementById("markerPopup");
    if (popup.markerData) {
      navigator.clipboard.writeText(popup.markerData.lat.toFixed(6) + ", " + popup.markerData.lon.toFixed(6));
      showToast("\u5EA7\u6A19\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F");
      hideMarkerPopup();
    }
  }
  function showInfo(type) {
    const item = INFO_CONTENT[type];
    if (!item) return;
    document.getElementById("infoModalTitle").textContent = item.title;
    document.getElementById("infoModalBody").innerHTML = item.html;
    document.getElementById("infoModalOverlay").classList.add("show");
  }
  function closeInfoModal() {
    document.getElementById("infoModalOverlay").classList.remove("show");
  }
  var INFO_CONTENT;
  var init_ui = __esm({
    "js/ui.js"() {
      init_state();
      INFO_CONTENT = {
        about: {
          title: "HoseCalc\u306B\u3064\u3044\u3066",
          html: '<h3>\u6982\u8981</h3><p>\u6797\u91CE\u706B\u707D\u306A\u3069\u306E\u969B\u306B\u30DB\u30FC\u30B9\u5EF6\u9577\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u3092\u884C\u3046\u30D7\u30E9\u30C3\u30C8\u30D5\u30A9\u30FC\u30E0\u3067\u3059\u3002</p><h3>\u4E3B\u306A\u6A5F\u80FD</h3><p>\u30FB\u30EA\u30A2\u30EB\u306A\u5730\u5F62\u30C7\u30FC\u30BF\u3092\u4F7F\u3063\u305F\u30DB\u30FC\u30B9\u5EF6\u9577\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3<br>\u30FB\u5727\u529B\u640D\u5931\u3068\u4E2D\u7D99\u30DD\u30F3\u30D7\u4F4D\u7F6E\u306E\u81EA\u52D5\u8A08\u7B97<br>\u30FB\u706B\u70B9\u30FB\u6C34\u5229\u30DD\u30A4\u30F3\u30C8\u306E\u767B\u9332\u3068\u7BA1\u7406<br>\u30FB\u6D2A\u6C34\u30FB\u6D25\u6CE2\u30FB\u571F\u7802\u707D\u5BB3\u30CF\u30B6\u30FC\u30C9\u30DE\u30C3\u30D7\u306E\u91CD\u7573\u8868\u793A<br>\u30FB\u767B\u5C71\u9053\u306E\u8868\u793A</p><h3>\u5BFE\u8C61\u30E6\u30FC\u30B6\u30FC</h3><p>\u6D88\u9632\u8077\u54E1\u30FB\u6D88\u9632\u56E3\u54E1\u30FB\u305D\u306E\u4ED6\u9632\u707D\u95A2\u4FC2\u8005</p><p style="color:rgba(255,255,255,0.4);margin-top:16px">\u958B\u767A: Y.K.</p>'
        },
        usage: {
          title: "\u4F7F\u3044\u65B9",
          html: "<h3>\u5730\u56F3\u64CD\u4F5C</h3><p>\u30FB\u30C9\u30E9\u30C3\u30B0: \u5730\u56F3\u306E\u79FB\u52D5<br>\u30FB\u30D4\u30F3\u30C1/\u30B9\u30AF\u30ED\u30FC\u30EB: \u30BA\u30FC\u30E0<br>\u30FB\u53F3\u30C9\u30E9\u30C3\u30B0\uFF08PC\uFF09: \u8996\u70B9\u56DE\u8EE2<br>\u30FBCtrl+\u30C9\u30E9\u30C3\u30B0\uFF08PC\uFF09: \u50BE\u304D\u8ABF\u6574<br>\u30FB\u30C0\u30D6\u30EB\u30BF\u30C3\u30D7/\u9577\u62BC\u3057: \u5EA7\u6A19\u8868\u793A</p><h3>\u706B\u70B9\u3092\u767B\u9332\u3059\u308B</h3><p>1. \u30E1\u30CB\u30E5\u30FC \u2192\u300C\u706B\u70B9\u300D\u3092\u9078\u629E<br>2. \u5730\u56F3\u4E0A\u306E\u706B\u707D\u767A\u751F\u5730\u70B9\u3092\u30BF\u30C3\u30D7<br>3. \u767B\u9332\u5B8C\u4E86</p><h3>\u6C34\u5229\u3092\u767B\u9332\u3059\u308B</h3><p>1. \u30E1\u30CB\u30E5\u30FC \u2192\u300C\u6C34\u5229\u300D\u3092\u9078\u629E<br>2. \u6D88\u706B\u6813\u30FB\u9632\u706B\u6C34\u69FD\u306A\u3069\u306E\u4F4D\u7F6E\u3092\u30BF\u30C3\u30D7<br>3. \u767B\u9332\u5B8C\u4E86</p><h3>\u30DB\u30FC\u30B9\u5EF6\u9577\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3</h3><p>1. \u30E1\u30CB\u30E5\u30FC \u2192\u300C\u30DB\u30FC\u30B9\u5EF6\u9577\u300D\u3092\u9078\u629E<br>2. \u6C34\u5229\u4F4D\u7F6E\u304B\u3089\u9806\u306B\u30BF\u30C3\u30D7\u3057\u3066\u30EB\u30FC\u30C8\u3092\u63CF\u753B<br>3.\u300C\u78BA\u5B9A\u300D\u30DC\u30BF\u30F3\u3067\u8A08\u7B97\u5B9F\u884C<br>4. \u4E2D\u7D99\u30DD\u30F3\u30D7\u4F4D\u7F6E\u3068\u6B8B\u5727\u304C\u81EA\u52D5\u8868\u793A</p><h3>2\u70B9\u8A08\u6E2C</h3><p>1. \u30E1\u30CB\u30E5\u30FC \u2192\u300C2\u70B9\u8A08\u6E2C\u300D\u3092\u9078\u629E<br>2. 2\u70B9\u3092\u30BF\u30C3\u30D7<br>3. \u8DDD\u96E2\u30FB\u9AD8\u4F4E\u5DEE\u304C\u8868\u793A</p>"
        },
        calc: {
          title: "\u8A08\u7B97\u65B9\u6CD5",
          html: '<h3>\u30D1\u30E9\u30E1\u30FC\u30BF\uFF08\u521D\u671F\u5024\uFF09</h3><div class="param-row"><span class="param-label">\u6D88\u9632\u8ECA\u9001\u6C34\u5727</span><span class="param-value">1.2 MPa</span></div><div class="param-row"><span class="param-label">\u53EF\u642C\u30DD\u30F3\u30D7\u9001\u6C34\u5727</span><span class="param-value">0.8 MPa</span></div><div class="param-row"><span class="param-label">\u4E2D\u7D99\u53D7\u6C34\u5727</span><span class="param-value">0.15 MPa</span></div><div class="param-row"><span class="param-label">\u7B52\u5148\u5FC5\u8981\u5727</span><span class="param-value">0.4 MPa</span></div><div class="param-row"><span class="param-label">\u6469\u64E6\u640D\u5931</span><span class="param-value">0.02 MPa/\u672C</span></div><h3>\u5727\u529B\u640D\u5931\u306E\u8A08\u7B97\u5F0F</h3><p>\u30FB\u6469\u64E6\u640D\u5931 = 0.02 \xD7 \u30DB\u30FC\u30B9\u672C\u6570<br>\u30FB\u9AD8\u4F4E\u5DEE\u640D\u5931 = 0.01 \xD7 \u9AD8\u4F4E\u5DEE(m)<br>\u3000\u203B\u4E0A\u308A\u306F\u30D7\u30E9\u30B9\uFF08\u5727\u529B\u4F4E\u4E0B\uFF09\u3001\u4E0B\u308A\u306F\u30DE\u30A4\u30CA\u30B9\uFF08\u5727\u529B\u5897\u52A0\uFF09</p><h3>\u30E9\u30A4\u30F3\u8868\u793A\u8272</h3><div class="param-row"><span class="param-label">\u7DD1</span><span class="param-value">\u2265 0.5 MPa</span></div><div class="param-row"><span class="param-label">\u9EC4</span><span class="param-value">0.3 \u301C 0.5 MPa</span></div><div class="param-row"><span class="param-label">\u8D64</span><span class="param-value">< 0.3 MPa</span></div>'
        },
        source: {
          title: "\u30C7\u30FC\u30BF\u30BD\u30FC\u30B9",
          html: '<div class="param-row"><span class="param-label">\u885B\u661F\u753B\u50CF</span><span class="param-value">Cesium Ion</span></div><div class="param-row"><span class="param-label">\u5730\u5F62</span><span class="param-value">Cesium World Terrain</span></div><div class="param-row"><span class="param-label">\u6A19\u6E96\u5730\u56F3</span><span class="param-value">\u56FD\u571F\u5730\u7406\u9662</span></div><div class="param-row"><span class="param-label">\u767B\u5C71\u9053</span><span class="param-value">OpenStreetMap</span></div><div class="param-row"><span class="param-label">\u30CF\u30B6\u30FC\u30C9\u30DE\u30C3\u30D7</span><span class="param-value">\u56FD\u571F\u4EA4\u901A\u7701</span></div>'
        }
      };
    }
  });

  // js/trails.js
  var trails_exports = {};
  __export(trails_exports, {
    loadTrails: () => loadTrails
  });
  async function loadTrails() {
    if (state_default.trailLoadActive) return;
    const c = state_default.viewer.camera.positionCartographic;
    const lat = Cesium.Math.toDegrees(c.latitude), lon = Cesium.Math.toDegrees(c.longitude);
    const radius = TRAIL_RADIUS;
    state_default.trailLoadActive = true;
    showLoading(true, "\u767B\u5C71\u9053\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D...", 30);
    let success = false;
    for (const server of OVERPASS_SERVERS) {
      if (success) break;
      try {
        const bbox = `${lat - radius},${lon - radius},${lat + radius},${lon + radius}`;
        const query = `[out:json][timeout:30];(way["highway"="path"](${bbox});way["highway"="track"](${bbox}););out body;>;out skel qt;`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25e3);
        showLoading(true, "\u30B5\u30FC\u30D0\u30FC\u306B\u63A5\u7D9A\u4E2D...", 50);
        const res = await fetch(server, {
          method: "POST",
          body: "data=" + encodeURIComponent(query),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!res.ok) continue;
        showLoading(true, "\u30C7\u30FC\u30BF\u3092\u51E6\u7406\u4E2D...", 70);
        const data = await res.json();
        if (!data.elements) continue;
        const nodes = /* @__PURE__ */ new Map();
        data.elements.forEach((e) => {
          if (e.type === "node") nodes.set(e.id, [e.lon, e.lat]);
        });
        const ways = data.elements.filter((e) => e.type === "way");
        showLoading(true, `${ways.length}\u672C\u306E\u767B\u5C71\u9053\u3092\u63CF\u753B\u4E2D...`, 85);
        ways.forEach((way) => {
          if (state_default.trailEntities.some((e) => e.osmId === way.id)) return;
          const pos = way.nodes.filter((nid) => nodes.has(nid)).map((nid) => {
            const n = nodes.get(nid);
            return Cesium.Cartesian3.fromDegrees(n[0], n[1]);
          });
          if (pos.length >= 2) {
            const e = state_default.viewer.entities.add({ polyline: { positions: pos, width: 3, material: Cesium.Color.LIGHTGREEN.withAlpha(0.8), clampToGround: true } });
            e.show = state_default.layers.trails;
            e.osmId = way.id;
            state_default.trailEntities.push(e);
          }
        });
        state_default.viewer.scene.requestRender();
        showLoading(true, "\u5B8C\u4E86", 100);
        if (ways.length > 0) showToast(`\u767B\u5C71\u9053 ${ways.length}\u672C`);
        else showToast("\u3053\u306E\u7BC4\u56F2\u306B\u767B\u5C71\u9053\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093");
        success = true;
      } catch (e) {
        console.log("Trail server failed:", server, e.message);
      }
    }
    if (!success) showToast("\u767B\u5C71\u9053\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\uFF08\u5F8C\u3067\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\uFF09");
    state_default.trailLoadActive = false;
    setTimeout(() => showLoading(false), 300);
  }
  var init_trails = __esm({
    "js/trails.js"() {
      init_state();
      init_config();
      init_ui();
    }
  });

  // js/app.js
  init_state();

  // js/map.js
  init_state();
  init_config();
  init_ui();
  function initViewer() {
    console.log("[HoseCalc:map] Setting Cesium Ion token...");
    Cesium.Ion.defaultAccessToken = CESIUM_TOKEN;
    console.log("[HoseCalc:map] Creating Viewer...");
    try {
      state_default.viewer = new Cesium.Viewer("cesiumContainer", {
        imageryProvider: new Cesium.IonImageryProvider({ assetId: 2 }),
        terrainProvider: Cesium.createWorldTerrain({ requestWaterMask: false, requestVertexNormals: false }),
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        requestRenderMode: false,
        msaaSamples: 1
      });
      console.log("[HoseCalc:map] Viewer created with Ion imagery");
    } catch (e1) {
      console.warn("[HoseCalc:map] Ion imagery failed, trying OSM fallback:", e1.message);
      try {
        state_default.viewer = new Cesium.Viewer("cesiumContainer", {
          imageryProvider: new Cesium.UrlTemplateImageryProvider({
            url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            maximumLevel: 19,
            credit: "\xA9 OpenStreetMap contributors"
          }),
          terrainProvider: Cesium.createWorldTerrain({ requestWaterMask: false, requestVertexNormals: false }),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          requestRenderMode: false,
          msaaSamples: 1
        });
        console.log("[HoseCalc:map] Viewer created with OSM fallback");
      } catch (e2) {
        console.error("[HoseCalc:map] All viewer creation failed:", e2.message);
        return null;
      }
    }
    const v = state_default.viewer;
    if (!v) return null;
    v.scene.globe.tileCacheSize = 1e3;
    v.scene.globe.maximumScreenSpaceError = 4;
    v.scene.fog.enabled = false;
    v.scene.skyAtmosphere.show = false;
    v.scene.globe.showGroundAtmosphere = false;
    const ctrl = v.scene.screenSpaceCameraController;
    ctrl.enableRotate = true;
    ctrl.enableTranslate = true;
    ctrl.enableZoom = true;
    ctrl.enableTilt = true;
    ctrl.enableLook = true;
    ctrl.inertiaSpin = 0.5;
    ctrl.inertiaTranslate = 0.5;
    ctrl.inertiaZoom = 0.5;
    v.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(DEFAULT_POSITION.lon, DEFAULT_POSITION.lat, DEFAULT_POSITION.height)
    });
    state_default.satelliteLayer = v.imageryLayers.get(0);
    state_default.stdLayer = v.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({ url: GSI_TILE_URL, maximumLevel: 18 })
    );
    state_default.stdLayer.show = false;
    v.resize();
    v.scene.requestRender();
    window.addEventListener("resize", () => {
      v.resize();
      v.scene.requestRender();
    });
    let kicks = 0;
    const kickInterval = setInterval(() => {
      v.resize();
      v.scene.requestRender();
      kicks++;
      if (kicks > 15) clearInterval(kickInterval);
    }, 300);
    v.camera.moveEnd.addEventListener(updateScaleBar);
    setTimeout(updateScaleBar, 3e3);
    console.log("[HoseCalc:map] initViewer complete, canvas:", v.canvas.width, "x", v.canvas.height);
    return v;
  }
  function setBasemap(type) {
    document.querySelectorAll(".map-type-btn").forEach((b) => b.classList.remove("active"));
    if (type === "satellite") {
      document.getElementById("mapBtnSatellite").classList.add("active");
      if (state_default.satelliteLayer) state_default.satelliteLayer.show = true;
      if (state_default.stdLayer) state_default.stdLayer.show = false;
    } else {
      document.getElementById("mapBtnStd").classList.add("active");
      if (state_default.satelliteLayer) state_default.satelliteLayer.show = false;
      if (state_default.stdLayer) state_default.stdLayer.show = true;
    }
    state_default.currentBasemap = type;
    updateCredit();
  }
  function updateCredit() {
    const l = state_default.layers;
    if (l.flood || l.tsunami || l.landslide) document.getElementById("creditBar").textContent = "\xA9 \u56FD\u571F\u4EA4\u901A\u7701\u30CF\u30B6\u30FC\u30C9\u30DE\u30C3\u30D7";
    else if (state_default.currentBasemap === "std") document.getElementById("creditBar").textContent = "\xA9 \u56FD\u571F\u5730\u7406\u9662";
    else document.getElementById("creditBar").textContent = "\xA9 Cesium Ion";
  }
  function setViewMode(mode) {
    document.querySelectorAll(".view-btn").forEach((b) => b.classList.remove("active"));
    document.querySelector(`.view-btn[onclick*="${mode}"]`).classList.add("active");
    state_default.viewer.scene.mode = mode === "2d" ? Cesium.SceneMode.SCENE2D : Cesium.SceneMode.SCENE3D;
  }
  async function init3DBuildings() {
    try {
      state_default.osmBuildingsTileset = state_default.viewer.scene.primitives.add(
        new Cesium.Cesium3DTileset({ url: Cesium.IonResource.fromAssetId(96188) })
      );
      state_default.osmBuildingsTileset.show = state_default.layers.buildings;
    } catch (e) {
      console.warn("Buildings:", e);
    }
  }
  function toggleMapLayer(layer) {
    state_default.layers[layer] = !state_default.layers[layer];
    if (layer === "buildings") {
      if (state_default.layers.buildings && !state_default.osmBuildingsTileset) init3DBuildings();
      else if (state_default.osmBuildingsTileset) state_default.osmBuildingsTileset.show = state_default.layers.buildings;
    }
    if (layer === "trails") {
      state_default.trailEntities.forEach((e) => e.show = state_default.layers.trails);
      if (state_default.layers.trails) {
        Promise.resolve().then(() => (init_trails(), trails_exports)).then((m) => m.loadTrails());
      }
    }
    updateLayerCards();
  }
  function toggleHazardLayer(layer) {
    const wasOn = state_default.layers[layer];
    ["flood", "tsunami", "landslide"].forEach((h) => {
      state_default.layers[h] = false;
      if (state_default.hazardLayers[h]) {
        state_default.viewer.imageryLayers.remove(state_default.hazardLayers[h]);
        state_default.hazardLayers[h] = null;
      }
    });
    if (!wasOn) {
      state_default.layers[layer] = true;
      const url = HAZARD_URLS[layer];
      if (url) {
        state_default.hazardLayers[layer] = state_default.viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({ url, maximumLevel: 17 })
        );
        state_default.hazardLayers[layer].alpha = 0.6;
      }
    }
    updateLayerCards();
    updateCredit();
  }
  function goToMyLocation() {
    if (!navigator.geolocation) {
      document.getElementById("myLocationText").textContent = "\u975E\u5BFE\u5FDC";
      return;
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      state_default.myLocationCoords = { lat, lon };
      document.getElementById("myLocationText").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      state_default.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1e3), duration: 1.5 });
      if (state_default.myLocationEntity) state_default.viewer.entities.remove(state_default.myLocationEntity);
      state_default.myLocationEntity = state_default.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        billboard: { image: createMyLocationIcon(), width: 24, height: 24, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND }
      });
    }, () => {
      document.getElementById("myLocationText").textContent = "\u53D6\u5F97\u5931\u6557";
    });
  }
  function createMyLocationIcon() {
    const c = document.createElement("canvas");
    c.width = 24;
    c.height = 24;
    const ctx = c.getContext("2d");
    ctx.beginPath();
    ctx.arc(12, 12, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#4ade80";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(12, 12, 5, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
    return c.toDataURL();
  }
  function updateScaleBar() {
    try {
      const v = state_default.viewer;
      const width = v.canvas.clientWidth;
      if (width === 0) return;
      const left = v.scene.camera.getPickRay(new Cesium.Cartesian2(width * 0.3, v.canvas.clientHeight / 2));
      const right = v.scene.camera.getPickRay(new Cesium.Cartesian2(width * 0.7, v.canvas.clientHeight / 2));
      if (!left || !right) return;
      const leftPos = v.scene.globe.pick(left, v.scene);
      const rightPos = v.scene.globe.pick(right, v.scene);
      if (!leftPos || !rightPos) return;
      const distance = Cesium.Cartesian3.distance(leftPos, rightPos) / 2;
      let scaleValue = distance * (60 / (width * 0.2));
      const scales = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5];
      let best = scales[0];
      for (const s of scales) {
        if (scaleValue >= s) best = s;
      }
      const scaleWidth = Math.round(60 * (best / scaleValue));
      document.getElementById("scaleLine").style.width = Math.max(30, Math.min(80, scaleWidth)) + "px";
      document.getElementById("scaleText").textContent = best >= 1e3 ? best / 1e3 + "km" : best + "m";
    } catch (e) {
    }
  }
  function initLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        state_default.myLocationCoords = { lat, lon };
        document.getElementById("myLocationText").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        if (state_default.myLocationEntity) state_default.viewer.entities.remove(state_default.myLocationEntity);
        state_default.myLocationEntity = state_default.viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          billboard: { image: createMyLocationIcon(), width: 24, height: 24, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND }
        });
      }, () => {
        document.getElementById("myLocationText").textContent = "\u53D6\u5F97\u5931\u6557";
      }, { timeout: 1e4 });
    }
  }

  // js/app.js
  init_ui();

  // js/fire.js
  init_state();
  init_ui();

  // js/storage.js
  init_state();
  var STORAGE_KEY = "hosecalc_data";
  function saveAllData() {
    if (state_default.isRestoring) return;
    try {
      const data = {
        firePoints: state_default.firePoints.map((p) => ({ id: p.id, lon: p.lon, lat: p.lat, height: p.height })),
        waterSources: state_default.waterSources.map((w) => ({ id: w.id, type: w.type, name: w.name, lon: w.lon, lat: w.lat })),
        confirmedLines: state_default.confirmedLines.map((l) => ({ id: l.id, points: l.points.map((p) => ({ lon: p.lon, lat: p.lat, height: p.height })) })),
        counters: { fire: state_default.firePointIdCounter, water: state_default.waterIdCounter }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Save failed:", e);
    }
  }
  function loadAllData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Load failed:", e);
      return null;
    }
  }
  function clearStoredData() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // js/fire.js
  function createFireIcon() {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext("2d");
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#f44336";
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u{1F525}", 16, 16);
    return c.toDataURL();
  }
  function addFirePoint(lon, lat, height) {
    const id = `fire-${++state_default.firePointIdCounter}`;
    state_default.firePoints.push({ id, lon, lat, height });
    const e = state_default.viewer.entities.add({
      id,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      billboard: { image: createFireIcon(), width: 32, height: 32, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND }
    });
    state_default.firePointEntities.push(e);
    if (!state_default.isRestoring) saveAllData();
    return id;
  }
  function selectFirePoint(id) {
    const f = state_default.firePoints.find((p) => p.id === id);
    if (!f) return;
    closeAllPanels();
    state_default.selectedFirePoint = f;
    document.getElementById("fireLat").textContent = f.lat.toFixed(6) + "\xB0";
    document.getElementById("fireLon").textContent = f.lon.toFixed(6) + "\xB0";
    document.getElementById("fireElev").textContent = f.height.toFixed(1) + "m";
    document.getElementById("firePanel").classList.add("active");
  }
  function deleteSelectedFire() {
    if (!state_default.selectedFirePoint) return;
    const idx = state_default.firePoints.findIndex((p) => p.id === state_default.selectedFirePoint.id);
    if (idx >= 0) {
      state_default.firePoints.splice(idx, 1);
      state_default.viewer.entities.remove(state_default.firePointEntities[idx]);
      state_default.firePointEntities.splice(idx, 1);
    }
    document.getElementById("firePanel").classList.remove("active");
    state_default.selectedFirePoint = null;
    saveAllData();
  }

  // js/water.js
  init_state();
  init_config();
  init_ui();
  var WATER_ICONS = { hydrant: "\u{1F4A7}", tank: "\u{1FAA3}", natural: "\u{1F30A}", other: "\u{1F4A7}" };
  function createWaterIcon(type) {
    const c = document.createElement("canvas");
    c.width = 28;
    c.height = 28;
    const ctx = c.getContext("2d");
    ctx.beginPath();
    ctx.arc(14, 14, 12, 0, Math.PI * 2);
    ctx.fillStyle = WATER_TYPE_COLORS[type] || "#2196f3";
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(WATER_ICONS[type] || "\u{1F4A7}", 14, 14);
    return c.toDataURL();
  }
  function addWaterSource(type, name, lon, lat) {
    const id = `water-${++state_default.waterIdCounter}`;
    const w = { id, type, name, lon, lat };
    state_default.waterSources.push(w);
    const e = state_default.viewer.entities.add({
      id,
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      billboard: { image: createWaterIcon(type), width: 28, height: 28, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND }
    });
    state_default.waterEntities.push(e);
    if (!state_default.isRestoring) saveAllData();
    return id;
  }
  function selectWater(id) {
    const w = state_default.waterSources.find((s) => s.id === id);
    if (!w) return;
    closeAllPanels();
    state_default.selectedWater = w;
    document.getElementById("waterType").textContent = WATER_TYPE_NAMES[w.type] || w.type;
    document.getElementById("waterLat").textContent = w.lat.toFixed(6) + "\xB0";
    document.getElementById("waterLon").textContent = w.lon.toFixed(6) + "\xB0";
    document.getElementById("waterPanel").classList.add("active");
  }
  function showWaterPicker(x, y) {
    const picker = document.getElementById("waterPicker");
    picker.style.left = Math.min(x, window.innerWidth - 200) + "px";
    picker.style.top = Math.max(10, y - 160) + "px";
    picker.classList.add("show");
  }
  function hideWaterPicker() {
    document.getElementById("waterPicker").classList.remove("show");
  }
  function confirmWaterType(type) {
    hideWaterPicker();
    if (!state_default.pendingWaterCoords) return;
    const name = WATER_TYPE_NAMES[type] + "#" + (state_default.waterIdCounter + 1);
    const id = addWaterSource(type, name, state_default.pendingWaterCoords.lon, state_default.pendingWaterCoords.lat);
    selectWater(id);
    state_default.pendingWaterCoords = null;
  }

  // js/hose.js
  init_state();

  // js/utils.js
  init_state();
  function geodesicDistance(lon1, lat1, lon2, lat2) {
    return new Cesium.EllipsoidGeodesic(
      Cesium.Cartographic.fromDegrees(lon1, lat1),
      Cesium.Cartographic.fromDegrees(lon2, lat2)
    ).surfaceDistance;
  }
  function formatDistance(m) {
    return m >= 1e3 ? (m / 1e3).toFixed(2) + "km" : m.toFixed(0) + "m";
  }
  function calcLossForDistance(dist, dh, params) {
    const hoses = dist / params.hoseLengthM;
    const frictionLoss = hoses * params.lossPerHoseMPa;
    const elevLoss = dh * 0.01;
    return frictionLoss + elevLoss;
  }
  function interpolatePath(points, interval) {
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

  // js/hose.js
  init_ui();
  function addHosePoint(lon, lat, height, cartesian) {
    state_default.hosePoints.push({ lon, lat, height, cartesian });
    const m = state_default.viewer.entities.add({
      position: cartesian,
      point: { pixelSize: 8, color: Cesium.Color.ORANGE, outlineColor: Cesium.Color.WHITE, outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND }
    });
    state_default.hoseMarkers.push(m);
    updateHoseLine();
    updateHosePanel();
    state_default.viewer.scene.requestRender();
  }
  function updateHoseLine() {
    if (state_default.hoseLine) state_default.viewer.entities.remove(state_default.hoseLine);
    state_default.hoseLine = null;
    if (state_default.hosePoints.length >= 2) {
      state_default.hoseLine = state_default.viewer.entities.add({
        polyline: { positions: state_default.hosePoints.map((p) => p.cartesian), width: 4, material: Cesium.Color.ORANGE.withAlpha(0.9), clampToGround: true }
      });
    }
  }
  function updateHosePanel() {
    if (state_default.hosePoints.length < 2) {
      document.getElementById("hoseTotalDist").textContent = "0m";
      document.getElementById("hoseTotalCount").textContent = "0\u672C";
      document.getElementById("hoseElevInfo").textContent = "-";
      return;
    }
    let totalDist = 0;
    for (let i = 1; i < state_default.hosePoints.length; i++) {
      totalDist += geodesicDistance(state_default.hosePoints[i - 1].lon, state_default.hosePoints[i - 1].lat, state_default.hosePoints[i].lon, state_default.hosePoints[i].lat);
    }
    const totalHose = Math.ceil(totalDist / 20);
    const elevDiff = state_default.hosePoints[state_default.hosePoints.length - 1].height - state_default.hosePoints[0].height;
    document.getElementById("hoseTotalDist").textContent = formatDistance(totalDist);
    document.getElementById("hoseTotalCount").textContent = totalHose + "\u672C";
    document.getElementById("hoseElevInfo").textContent = (elevDiff >= 0 ? "+" : "") + elevDiff.toFixed(0) + "m";
  }
  function undoHosePoint() {
    if (state_default.hosePoints.length === 0) return;
    state_default.hosePoints.pop();
    if (state_default.hoseMarkers.length > 0) state_default.viewer.entities.remove(state_default.hoseMarkers.pop());
    updateHoseLine();
    updateHosePanel();
    state_default.viewer.scene.requestRender();
  }
  function resetHoseLine() {
    state_default.hosePoints = [];
    state_default.hoseMarkers.forEach((m) => state_default.viewer.entities.remove(m));
    state_default.hoseMarkers = [];
    if (state_default.hoseLine) {
      state_default.viewer.entities.remove(state_default.hoseLine);
      state_default.hoseLine = null;
    }
    updateHosePanel();
    document.getElementById("hoseHint").textContent = "\u9023\u7D9A\u30BF\u30C3\u30D7\u3067\u30DD\u30A4\u30F3\u30C8\u8FFD\u52A0";
  }
  function closeHosePanel() {
    document.getElementById("hosePanel").classList.remove("active");
    resetHoseLine();
    clearTool();
  }
  function confirmHoseLine() {
    if (state_default.hosePoints.length < 2) {
      showToast("2\u70B9\u4EE5\u4E0A\u5FC5\u8981\u3067\u3059");
      return;
    }
    const lineId = "hose-" + Date.now();
    const pathLLH = state_default.hosePoints.map((p) => ({ lon: p.lon, lat: p.lat, height: p.height }));
    state_default.confirmedLines.push({ id: lineId, points: [...state_default.hosePoints].map((p) => ({ lon: p.lon, lat: p.lat, height: p.height })) });
    if (state_default.hoseLine) state_default.viewer.entities.remove(state_default.hoseLine);
    state_default.hoseLine = null;
    state_default.hoseMarkers.forEach((m) => state_default.viewer.entities.remove(m));
    state_default.hoseMarkers = [];
    runSimulationForLine(lineId, pathLLH);
    state_default.hosePoints = [];
    document.getElementById("hosePanel").classList.remove("active");
    document.getElementById("hoseInfoPanel").classList.add("active");
    clearTool();
    state_default.viewer.scene.requestRender();
    saveAllData();
    showToast("\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u5B8C\u4E86");
  }
  function selectHoseLine(id) {
    const line = state_default.confirmedLines.find((l) => l.id === id);
    if (!line) return;
    closeAllPanels();
    state_default.selectedHoseLine = id;
    const pathLLH = line.points.map((p) => ({ lon: p.lon, lat: p.lat, height: p.height }));
    runSimulationForLine(id, pathLLH);
    document.getElementById("hoseInfoPanel").classList.add("active");
  }
  function deleteSelectedHose() {
    if (!state_default.selectedHoseLine) return;
    const idx = state_default.confirmedLines.findIndex((l) => l.id === state_default.selectedHoseLine);
    if (idx >= 0) state_default.confirmedLines.splice(idx, 1);
    clearSimulationVisuals(state_default.selectedHoseLine);
    document.getElementById("hoseInfoPanel").classList.remove("active");
    state_default.selectedHoseLine = null;
    state_default.viewer.scene.requestRender();
    saveAllData();
  }
  function onParamChange() {
    if (state_default.selectedHoseLine) {
      const line = state_default.confirmedLines.find((l) => l.id === state_default.selectedHoseLine);
      if (line) runSimulationForLine(state_default.selectedHoseLine, line.points.map((p) => ({ lon: p.lon, lat: p.lat, height: p.height })));
    }
  }
  function readParamsFromUI() {
    state_default.hoseParams.pumpOutputMPa = parseFloat(document.getElementById("paramPumpOut").value) || 1.2;
    state_default.hoseParams.relayOutputMPa = parseFloat(document.getElementById("paramRelayOut").value) || 0.8;
    state_default.hoseParams.minInletPressureMPa = parseFloat(document.getElementById("paramInlet").value) || 0.15;
    state_default.hoseParams.nozzleRequiredMPa = parseFloat(document.getElementById("paramNozzle").value) || 0.4;
    state_default.hoseParams.lossPerHoseMPa = parseFloat(document.getElementById("paramLossPerHose").value) || 0.02;
  }
  function clearSimulationVisuals(lineId) {
    const ss = state_default.hoseSimState;
    (ss.markersByLineId.get(lineId) || []).forEach((e) => state_default.viewer.entities.remove(e));
    ss.markersByLineId.delete(lineId);
    (ss.relayMarkersByLine.get(lineId) || []).forEach((e) => state_default.viewer.entities.remove(e));
    ss.relayMarkersByLine.delete(lineId);
    (ss.colorizedLinesByLine.get(lineId) || []).forEach((e) => state_default.viewer.entities.remove(e));
    ss.colorizedLinesByLine.delete(lineId);
    (ss.startEndMarkersByLine.get(lineId) || []).forEach((e) => state_default.viewer.entities.remove(e));
    ss.startEndMarkersByLine.delete(lineId);
  }
  function computeRelayPositions(interpolated, params) {
    const relays = [];
    let currentPressure = params.pumpOutputMPa;
    let lastRelayIdx = 0;
    for (let i = 1; i < interpolated.length; i++) {
      const dist = interpolated[i].distFromStart - interpolated[lastRelayIdx].distFromStart;
      const dh = interpolated[i].height - interpolated[lastRelayIdx].height;
      const loss = calcLossForDistance(dist, dh, params);
      const remain = currentPressure - loss;
      if (remain < params.minInletPressureMPa) {
        const relayIdx = i - 1 > lastRelayIdx ? i - 1 : i;
        relays.push({ index: relayIdx, lon: interpolated[relayIdx].lon, lat: interpolated[relayIdx].lat, height: interpolated[relayIdx].height });
        lastRelayIdx = relayIdx;
        currentPressure = params.relayOutputMPa;
      }
    }
    return relays;
  }
  function computePumpSegments(interpolated, relays, params) {
    const segments = [];
    const relayIndices = [0, ...relays.map((r) => r.index)];
    for (let p = 0; p < relayIndices.length; p++) {
      const startIdx = relayIndices[p];
      const endIdx = p < relayIndices.length - 1 ? relayIndices[p + 1] : interpolated.length - 1;
      const dist = interpolated[endIdx].distFromStart - interpolated[startIdx].distFromStart;
      const dh = interpolated[endIdx].height - interpolated[startIdx].height;
      const hoses = Math.ceil(dist / params.hoseLengthM);
      const loss = calcLossForDistance(dist, dh, params);
      const outputP = p === 0 ? params.pumpOutputMPa : params.relayOutputMPa;
      const remain = outputP - loss;
      const pumpLabel = p === 0 ? "\u6D88\u9632\u8ECA" : `P${p + 1}`;
      const nextLabel = p < relayIndices.length - 1 ? `P${p + 2}` : "\u7B52\u5148";
      segments.push({ pumpLabel, nextLabel, distance: dist, hoses, elevation: dh, loss, remainingPressure: remain });
    }
    return segments;
  }
  function runSimulationForLine(lineId, pathLLH) {
    readParamsFromUI();
    clearSimulationVisuals(lineId);
    const interpolated = interpolatePath(pathLLH, 10);
    const params = state_default.hoseParams;
    const relays = computeRelayPositions(interpolated, params);
    const pumpSegments = computePumpSegments(interpolated, relays, params);
    const totalDist = interpolated[interpolated.length - 1].distFromStart;
    const totalHoses = Math.ceil(totalDist / params.hoseLengthM);
    const endPressure = pumpSegments.length > 0 ? pumpSegments[pumpSegments.length - 1].remainingPressure : params.pumpOutputMPa;
    renderStartEndMarkers(lineId, pathLLH);
    renderRelayMarkers(lineId, relays);
    renderColorizedLines(lineId, interpolated, relays, pumpSegments);
    updateHoseInfoPanel({ totalLengthM: totalDist, totalHoses20m: totalHoses, endPressureMPa: endPressure, totalPumps: relays.length + 1, pumpSegments });
    state_default.viewer.scene.requestRender();
  }
  function renderStartEndMarkers(lineId, pathLLH) {
    const prev = state_default.hoseSimState.startEndMarkersByLine.get(lineId) || [];
    prev.forEach((e) => state_default.viewer.entities.remove(e));
    const markers = [];
    if (pathLLH.length >= 1) {
      const start = pathLLH[0];
      const e = state_default.viewer.entities.add({
        id: "start-" + lineId,
        position: Cesium.Cartesian3.fromDegrees(start.lon, start.lat, start.height || 0),
        point: { pixelSize: 14, color: Cesium.Color.RED, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
        label: { text: "\u{1F692}", font: "bold 12px sans-serif", fillColor: Cesium.Color.WHITE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -12) }
      });
      e.markerData = { name: "\u6D88\u9632\u8ECA\uFF08P1\uFF09", lat: start.lat, lon: start.lon, height: start.height || 0 };
      markers.push(e);
    }
    if (pathLLH.length >= 2) {
      const end = pathLLH[pathLLH.length - 1];
      const e = state_default.viewer.entities.add({
        id: "end-" + lineId,
        position: Cesium.Cartesian3.fromDegrees(end.lon, end.lat, end.height || 0),
        point: { pixelSize: 12, color: Cesium.Color.BLUE, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
        label: { text: "\u7B52\u5148", font: "bold 11px sans-serif", fillColor: Cesium.Color.WHITE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -12) }
      });
      e.markerData = { name: "\u7B52\u5148", lat: end.lat, lon: end.lon, height: end.height || 0 };
      markers.push(e);
    }
    state_default.hoseSimState.startEndMarkersByLine.set(lineId, markers);
  }
  function renderRelayMarkers(lineId, relays) {
    const prev = state_default.hoseSimState.relayMarkersByLine.get(lineId) || [];
    prev.forEach((e) => state_default.viewer.entities.remove(e));
    const markers = relays.map((r, i) => {
      const e = state_default.viewer.entities.add({
        id: "relay-" + lineId + "-" + i,
        position: Cesium.Cartesian3.fromDegrees(r.lon, r.lat, r.height || 0),
        point: { pixelSize: 12, color: Cesium.Color.ORANGE, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
        label: { text: "P" + (i + 2), font: "bold 11px sans-serif", fillColor: Cesium.Color.WHITE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -12) }
      });
      e.relayData = { name: "P" + (i + 2), lat: r.lat, lon: r.lon, height: r.height || 0 };
      return e;
    });
    state_default.hoseSimState.relayMarkersByLine.set(lineId, markers);
  }
  function renderColorizedLines(lineId, interpolated, relays, pumpSegments) {
    const prev = state_default.hoseSimState.colorizedLinesByLine.get(lineId) || [];
    prev.forEach((e) => state_default.viewer.entities.remove(e));
    const lines = [];
    const params = state_default.hoseParams;
    for (let p = 0; p < pumpSegments.length; p++) {
      let startIdx, endIdx;
      if (p === 0) {
        startIdx = 0;
        endIdx = relays.length > 0 ? relays[0].index : interpolated.length - 1;
      } else if (p <= relays.length) {
        startIdx = relays[p - 1].index;
        endIdx = p < relays.length ? relays[p].index : interpolated.length - 1;
      } else continue;
      const startPressure = p === 0 ? params.pumpOutputMPa : params.relayOutputMPa;
      const startDist = interpolated[startIdx].distFromStart;
      const startHeight = interpolated[startIdx].height || 0;
      let currentColorStart = startIdx;
      let currentColor = null;
      for (let i = startIdx; i <= endIdx; i++) {
        const dist = interpolated[i].distFromStart - startDist;
        const dh = (interpolated[i].height || 0) - startHeight;
        const loss = calcLossForDistance(dist, dh, params);
        const pressure = startPressure - loss;
        const newColor = pressure >= 0.5 ? "green" : pressure >= 0.3 ? "yellow" : "red";
        if (currentColor !== null && newColor !== currentColor) {
          lines.push(createColorSegment(lineId, p, currentColorStart, i, interpolated, currentColor));
          currentColorStart = i;
        }
        currentColor = newColor;
      }
      if (currentColorStart < endIdx) {
        lines.push(createColorSegment(lineId, p, currentColorStart, endIdx, interpolated, currentColor));
      }
    }
    state_default.hoseSimState.colorizedLinesByLine.set(lineId, lines.filter(Boolean));
    setTimeout(() => state_default.viewer.scene.requestRender(), 100);
  }
  function createColorSegment(lineId, pumpIdx, startIdx, endIdx, interpolated, color) {
    const positions = [];
    for (let j = startIdx; j <= endIdx; j++) {
      if (interpolated[j]) positions.push(Cesium.Cartesian3.fromDegrees(interpolated[j].lon, interpolated[j].lat, interpolated[j].height || 0));
    }
    if (positions.length < 2) return null;
    const cesiumColor = color === "green" ? Cesium.Color.LIMEGREEN : color === "yellow" ? Cesium.Color.YELLOW : Cesium.Color.RED;
    return state_default.viewer.entities.add({
      id: lineId + "-seg-" + pumpIdx + "-" + startIdx,
      polyline: { positions, width: 5, material: cesiumColor.withAlpha(0.9), clampToGround: true }
    });
  }
  function updateHoseInfoPanel(data) {
    document.getElementById("hoseInfoDist").textContent = formatDistance(data.totalLengthM);
    document.getElementById("hoseInfoCount").textContent = data.totalHoses20m + "\u672C";
    const endPEl = document.getElementById("hoseInfoEndP");
    endPEl.textContent = data.endPressureMPa.toFixed(2) + " MPa";
    endPEl.className = data.endPressureMPa >= state_default.hoseParams.nozzleRequiredMPa ? "panel-stat-value ok" : data.endPressureMPa >= state_default.hoseParams.minInletPressureMPa ? "panel-stat-value highlight" : "panel-stat-value warning";
    document.getElementById("hoseInfoRelay").textContent = data.totalPumps - 1 + "\u53F0";
    if (data.pumpSegments) {
      const tbody = document.getElementById("segmentTableBody");
      let html = "";
      for (const seg of data.pumpSegments) {
        const colorClass = seg.remainingPressure >= 0.4 ? "green" : seg.remainingPressure >= 0.2 ? "yellow" : "red";
        const elevClass = seg.elevation >= 0 ? "elev-up" : "elev-down";
        const elevStr = seg.elevation >= 0 ? "+" + seg.elevation.toFixed(0) : seg.elevation.toFixed(0);
        html += `<tr class="${colorClass}"><td>${seg.pumpLabel}\u2192${seg.nextLabel}</td><td>${seg.distance.toFixed(0)}m</td><td>${seg.hoses}\u672C</td><td class="${elevClass}">${elevStr}m</td><td>${seg.loss.toFixed(2)}</td><td>${seg.remainingPressure.toFixed(2)}</td></tr>`;
      }
      tbody.innerHTML = html;
    }
  }

  // js/measure.js
  init_state();
  init_ui();
  function addMeasurePoint(lon, lat, height, cartesian) {
    state_default.measurePoints.push({ lon, lat, height, cartesian });
    const m = state_default.viewer.entities.add({
      position: cartesian,
      point: { pixelSize: 10, color: Cesium.Color.CYAN, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND }
    });
    state_default.measureMarkers.push(m);
    if (state_default.measurePoints.length === 2) {
      state_default.measureLine = state_default.viewer.entities.add({
        polyline: { positions: [state_default.measurePoints[0].cartesian, state_default.measurePoints[1].cartesian], width: 3, material: Cesium.Color.CYAN.withAlpha(0.8), clampToGround: true }
      });
      const dist = geodesicDistance(state_default.measurePoints[0].lon, state_default.measurePoints[0].lat, state_default.measurePoints[1].lon, state_default.measurePoints[1].lat);
      const straight = Cesium.Cartesian3.distance(state_default.measurePoints[0].cartesian, state_default.measurePoints[1].cartesian);
      const elev = state_default.measurePoints[1].height - state_default.measurePoints[0].height;
      document.getElementById("measureDistance").textContent = formatDistance(dist);
      document.getElementById("measureStraight").textContent = formatDistance(straight);
      document.getElementById("measureElev").textContent = (elev >= 0 ? "+" : "") + elev.toFixed(1) + "m";
      document.getElementById("measureHint").textContent = "\u8A08\u6E2C\u5B8C\u4E86";
      document.getElementById("measurePanel").classList.add("active");
      showToast("\u8A08\u6E2C\u5B8C\u4E86");
    }
  }
  function resetMeasure() {
    state_default.measurePoints = [];
    state_default.measureMarkers.forEach((e) => state_default.viewer.entities.remove(e));
    state_default.measureMarkers = [];
    if (state_default.measureLine) {
      state_default.viewer.entities.remove(state_default.measureLine);
      state_default.measureLine = null;
    }
    document.getElementById("measureDistance").textContent = "-";
    document.getElementById("measureStraight").textContent = "-";
    document.getElementById("measureElev").textContent = "-";
    document.getElementById("measureHint").textContent = "2\u70B9\u3092\u30BF\u30C3\u30D7\u3057\u3066\u8A08\u6E2C";
  }
  function closeMeasurePanel() {
    document.getElementById("measurePanel").classList.remove("active");
    resetMeasure();
    clearTool();
  }

  // js/search.js
  init_state();
  init_ui();
  async function doSearch() {
    const q = document.getElementById("searchInput").value.trim();
    if (!q) return;
    showLoading(true, "\u691C\u7D22\u4E2D...", 50);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=jp&limit=5`);
      const data = await res.json();
      const sr = document.getElementById("searchResults");
      sr.innerHTML = data.length === 0 ? '<div class="search-result-item"><span class="search-result-name">\u7D50\u679C\u306A\u3057</span></div>' : data.map((r) => `<div class="search-result-item" onclick="window._flyToSearch(${r.lon},${r.lat})"><div class="search-result-name">${r.display_name.split(",")[0]}</div><div class="search-result-address">${r.display_name}</div></div>`).join("");
      sr.classList.add("show");
    } catch (e) {
      showToast("\u691C\u7D22\u30A8\u30E9\u30FC");
    }
    showLoading(false);
  }
  function flyToSearch(lon, lat) {
    state_default.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1500), duration: 1.5 });
    document.getElementById("searchResults").classList.remove("show");
  }

  // js/share.js
  init_state();
  init_ui();
  function roundCoord(v, decimals = 5) {
    return Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
  function buildShareData() {
    const carto = state_default.viewer.camera.positionCartographic;
    const data = {
      v: 1,
      c: [roundCoord(Cesium.Math.toDegrees(carto.longitude)), roundCoord(Cesium.Math.toDegrees(carto.latitude)), Math.round(carto.height)],
      f: state_default.firePoints.map((p) => [roundCoord(p.lon), roundCoord(p.lat), Math.round(p.height)]),
      w: state_default.waterSources.map((w) => ({ t: w.type, x: roundCoord(w.lon), y: roundCoord(w.lat) })),
      l: state_default.confirmedLines.map((line) => ({
        p: line.points.map((p) => [roundCoord(p.lon), roundCoord(p.lat), Math.round(p.height)])
      })),
      pr: {
        po: state_default.hoseParams.pumpOutputMPa,
        ro: state_default.hoseParams.relayOutputMPa,
        mi: state_default.hoseParams.minInletPressureMPa,
        nr: state_default.hoseParams.nozzleRequiredMPa,
        lh: state_default.hoseParams.lossPerHoseMPa
      }
    };
    return data;
  }
  async function compressData(jsonStr) {
    try {
      if (typeof CompressionStream !== "undefined") {
        const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream("deflate"));
        const buf = await new Response(stream).arrayBuffer();
        return arrayBufferToBase64Url(buf);
      }
    } catch (e) {
      console.warn("CompressionStream failed, falling back:", e);
    }
    return btoa(unescape(encodeURIComponent(jsonStr))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  async function decompressData(encoded) {
    try {
      const buf = base64UrlToArrayBuffer(encoded);
      if (typeof DecompressionStream !== "undefined") {
        try {
          const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("deflate"));
          const text = await new Response(stream).text();
          return JSON.parse(text);
        } catch (e) {
        }
      }
      const jsonStr = decodeURIComponent(escape(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))));
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Decompress failed:", e);
      return null;
    }
  }
  function arrayBufferToBase64Url(buf) {
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function base64UrlToArrayBuffer(str) {
    const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
    const binary = atob(padded);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    return buf.buffer;
  }
  async function shareSimulation() {
    if (state_default.confirmedLines.length === 0 && state_default.firePoints.length === 0 && state_default.waterSources.length === 0) {
      showToast("\u5171\u6709\u3059\u308B\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093");
      return;
    }
    try {
      const data = buildShareData();
      const jsonStr = JSON.stringify(data);
      const encoded = await compressData(jsonStr);
      const url = `${window.location.origin}${window.location.pathname}#d=${encoded}`;
      if (navigator.share) {
        try {
          await navigator.share({
            title: "HoseCalc \u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u7D50\u679C",
            text: `\u30DB\u30FC\u30B9\u5EF6\u9577\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\uFF08${state_default.confirmedLines.length}\u30E9\u30A4\u30F3\uFF09`,
            url
          });
          return;
        } catch (e) {
        }
      }
      await navigator.clipboard.writeText(url);
      showToast("\u5171\u6709URL\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F");
      history.replaceState(null, "", `#d=${encoded}`);
    } catch (e) {
      console.error("Share failed:", e);
      showToast("\u5171\u6709\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    }
  }
  async function restoreFromURL() {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith("#d=")) return false;
    const encoded = hash.substring(3);
    if (!encoded) return false;
    const data = await decompressData(encoded);
    if (!data || data.v !== 1) return false;
    state_default.isRestoring = true;
    try {
      if (data.pr) {
        if (data.pr.po) state_default.hoseParams.pumpOutputMPa = data.pr.po;
        if (data.pr.ro) state_default.hoseParams.relayOutputMPa = data.pr.ro;
        if (data.pr.mi) state_default.hoseParams.minInletPressureMPa = data.pr.mi;
        if (data.pr.nr) state_default.hoseParams.nozzleRequiredMPa = data.pr.nr;
        if (data.pr.lh) state_default.hoseParams.lossPerHoseMPa = data.pr.lh;
        document.getElementById("paramPumpOut").value = state_default.hoseParams.pumpOutputMPa;
        document.getElementById("paramRelayOut").value = state_default.hoseParams.relayOutputMPa;
        document.getElementById("paramInlet").value = state_default.hoseParams.minInletPressureMPa;
        document.getElementById("paramNozzle").value = state_default.hoseParams.nozzleRequiredMPa;
        document.getElementById("paramLossPerHose").value = state_default.hoseParams.lossPerHoseMPa;
      }
      (data.f || []).forEach((p) => addFirePoint(p[0], p[1], p[2]));
      (data.w || []).forEach((w) => addWaterSource(w.t, "", w.x, w.y));
      (data.l || []).forEach((line) => {
        const lineId = "hose-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
        const points = line.p.map((p) => ({ lon: p[0], lat: p[1], height: p[2] }));
        state_default.confirmedLines.push({ id: lineId, points });
        runSimulationForLine(lineId, points);
      });
      if (data.c) {
        state_default.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(data.c[0], data.c[1], data.c[2]),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
          duration: 1.5
        });
      }
      const lineCount = (data.l || []).length;
      showToast(`\u5171\u6709\u30C7\u30FC\u30BF\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F\uFF08${lineCount}\u30E9\u30A4\u30F3\uFF09`);
    } finally {
      state_default.isRestoring = false;
    }
    return true;
  }

  // js/events.js
  init_state();
  init_ui();
  function initEventHandlers() {
    const handler = new Cesium.ScreenSpaceEventHandler(state_default.viewer.scene.canvas);
    handler.setInputAction(function(click) {
      hideCoordPopup();
      state_default.longPressStartPos = { x: click.position.x, y: click.position.y };
      state_default.longPressTimer = setTimeout(async () => {
        if (!state_default.longPressStartPos) return;
        const ray = state_default.viewer.camera.getPickRay(click.position);
        const cartesian = state_default.viewer.scene.globe.pick(ray, state_default.viewer.scene);
        if (cartesian) {
          const carto = Cesium.Cartographic.fromCartesian(cartesian);
          showCoordPopup(Cesium.Math.toDegrees(carto.latitude), Cesium.Math.toDegrees(carto.longitude), click.position.x, click.position.y);
        }
        state_default.longPressStartPos = null;
      }, 800);
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
    handler.setInputAction(function(movement) {
      if (state_default.longPressTimer && state_default.longPressStartPos) {
        const dx = movement.endPosition.x - state_default.longPressStartPos.x;
        const dy = movement.endPosition.y - state_default.longPressStartPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
          clearTimeout(state_default.longPressTimer);
          state_default.longPressTimer = null;
          state_default.longPressStartPos = null;
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    handler.setInputAction(function() {
      if (state_default.longPressTimer) {
        clearTimeout(state_default.longPressTimer);
        state_default.longPressTimer = null;
      }
      state_default.longPressStartPos = null;
    }, Cesium.ScreenSpaceEventType.LEFT_UP);
    handler.setInputAction(async function(click) {
      const ray = state_default.viewer.camera.getPickRay(click.position);
      const cartesian = state_default.viewer.scene.globe.pick(ray, state_default.viewer.scene);
      if (cartesian) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        showCoordPopup(Cesium.Math.toDegrees(carto.latitude), Cesium.Math.toDegrees(carto.longitude), click.position.x, click.position.y);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    handler.setInputAction(async function(click) {
      if (state_default.longPressTimer) {
        clearTimeout(state_default.longPressTimer);
        state_default.longPressTimer = null;
      }
      const picked = state_default.viewer.scene.pick(click.position);
      if (picked && picked.id) {
        let pickedId = "";
        let entity = null;
        if (typeof picked.id === "string") {
          pickedId = picked.id;
        } else if (picked.id.id && typeof picked.id.id === "string") {
          pickedId = picked.id.id;
          entity = picked.id;
        }
        if (pickedId.startsWith("relay-") || pickedId.startsWith("start-") || pickedId.startsWith("end-")) {
          const data = entity.markerData || entity.relayData;
          if (data) showMarkerInfo(data.name, data.lat, data.lon, data.height, click.position);
          return;
        }
        if (pickedId.startsWith("fire-")) {
          selectFirePoint(pickedId);
          return;
        }
        if (pickedId.startsWith("water-")) {
          selectWater(pickedId);
          return;
        }
        if (pickedId.startsWith("hose-")) {
          const lineId = pickedId.split("-seg-")[0];
          selectHoseLine(lineId);
          return;
        }
      }
      const ray = state_default.viewer.camera.getPickRay(click.position);
      const cartesian = state_default.viewer.scene.globe.pick(ray, state_default.viewer.scene);
      if (!cartesian) return;
      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lon = Cesium.Math.toDegrees(carto.longitude), lat = Cesium.Math.toDegrees(carto.latitude);
      let height = 0;
      try {
        const u = await Cesium.sampleTerrainMostDetailed(state_default.viewer.terrainProvider, [Cesium.Cartographic.fromDegrees(lon, lat)]);
        height = u[0].height || 0;
      } catch (e) {
        height = carto.height || 0;
      }
      if (state_default.currentTool === "fire") {
        const id = addFirePoint(lon, lat, height);
        selectFirePoint(id);
      } else if (state_default.currentTool === "water") {
        state_default.pendingWaterCoords = { lon, lat };
        showWaterPicker(click.position.x, click.position.y);
      } else if (state_default.currentTool === "hose") {
        addHosePoint(lon, lat, height, cartesian);
      } else if (state_default.currentTool === "measure") {
        if (state_default.measurePoints.length >= 2) resetMeasure();
        addMeasurePoint(lon, lat, height, cartesian);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-box") && !e.target.closest(".search-results")) {
        document.getElementById("searchResults").classList.remove("show");
      }
      if (!e.target.closest(".water-picker") && !e.target.closest("#cesiumContainer")) {
        hideWaterPicker();
      }
    });
  }

  // js/app.js
  window.onerror = function(msg, url, line, col, err) {
    console.error("[HoseCalc Error]", msg, url, line, col, err);
    const el = document.getElementById("loadingMessage");
    if (el) el.textContent = "\u30A8\u30E9\u30FC: " + msg;
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) overlay.classList.add("show");
  };
  window.addEventListener("unhandledrejection", function(e) {
    console.error("[HoseCalc Unhandled Promise]", e.reason);
  });
  function setOperation(op) {
    if (state_default.currentTool === op) {
      clearTool();
      updateLayerCards();
      return;
    }
    clearTool();
    state_default.currentTool = op;
    const ind = document.getElementById("modeIndicator"), icon = document.getElementById("modeIcon"), text = document.getElementById("modeText");
    if (op === "fire") {
      icon.textContent = "local_fire_department";
      text.textContent = "\u706B\u70B9\u8FFD\u52A0";
      ind.className = "mode-indicator show";
    } else if (op === "water") {
      icon.textContent = "water_drop";
      text.textContent = "\u6C34\u5229\u8FFD\u52A0";
      ind.className = "mode-indicator show water-mode";
    } else if (op === "hose") {
      icon.textContent = "route";
      text.textContent = "\u30DB\u30FC\u30B9\u5EF6\u9577";
      ind.className = "mode-indicator show hose-mode";
      document.getElementById("hosePanel").classList.add("active");
      resetHoseLine();
    } else if (op === "measure") {
      icon.textContent = "straighten";
      text.textContent = "2\u70B9\u8A08\u6E2C";
      ind.className = "mode-indicator show measure-mode";
      document.getElementById("measurePanel").classList.add("active");
      resetMeasure();
    }
    updateLayerCards();
    closeSidePanel();
  }
  function clearAllDataConfirm() {
    closeSidePanel();
    if (!confirm("\u5168\u3066\u306E\u30C7\u30FC\u30BF\uFF08\u706B\u70B9\u30FB\u6C34\u5229\u30FB\u30DB\u30FC\u30B9\u30E9\u30A4\u30F3\uFF09\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F")) return;
    state_default.firePoints.forEach((_, i) => state_default.viewer.entities.remove(state_default.firePointEntities[i]));
    state_default.firePoints = [];
    state_default.firePointEntities = [];
    state_default.selectedFirePoint = null;
    state_default.waterSources.forEach((_, i) => state_default.viewer.entities.remove(state_default.waterEntities[i]));
    state_default.waterSources = [];
    state_default.waterEntities = [];
    state_default.selectedWater = null;
    state_default.confirmedLines.forEach((l) => clearSimulationVisuals(l.id));
    state_default.confirmedLines = [];
    state_default.selectedHoseLine = null;
    closeAllPanels();
    clearStoredData();
    history.replaceState(null, "", window.location.pathname);
    state_default.viewer.scene.requestRender();
    showToast("\u5168\u30C7\u30FC\u30BF\u3092\u524A\u9664\u3057\u307E\u3057\u305F");
  }
  async function restoreData() {
    const restoredFromURL = await restoreFromURL();
    if (restoredFromURL) return;
    const data = loadAllData();
    if (!data) return;
    state_default.isRestoring = true;
    try {
      if (data.counters) {
        state_default.firePointIdCounter = data.counters.fire || 0;
        state_default.waterIdCounter = data.counters.water || 0;
      }
      (data.firePoints || []).forEach((p) => addFirePoint(p.lon, p.lat, p.height));
      (data.waterSources || []).forEach((w) => addWaterSource(w.type, w.name, w.lon, w.lat));
      (data.confirmedLines || []).forEach((l) => {
        state_default.confirmedLines.push({ id: l.id, points: l.points });
        runSimulationForLine(l.id, l.points);
      });
      if (data.firePoints.length || data.waterSources.length || data.confirmedLines.length) showToast("\u524D\u56DE\u306E\u30C7\u30FC\u30BF\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F");
      state_default.viewer.scene.requestRender();
    } finally {
      state_default.isRestoring = false;
    }
  }
  Object.assign(window, {
    setBasemap,
    setViewMode,
    toggleMapLayer,
    toggleHazardLayer,
    goToMyLocation,
    openSidePanel,
    closeSidePanel,
    closePanel,
    copyCoords,
    copyText,
    copyMarkerCoords,
    hideCoordPopup,
    hideMarkerPopup,
    showInfo,
    closeInfoModal,
    deleteSelectedFire,
    confirmWaterType,
    undoHosePoint,
    resetHoseLine,
    closeHosePanel,
    confirmHoseLine,
    deleteSelectedHose,
    onParamChange,
    resetMeasure,
    closeMeasurePanel,
    doSearch,
    _flyToSearch: flyToSearch,
    setOperation,
    clearAllDataConfirm,
    shareSimulation
  });
  function boot() {
    console.log("[HoseCalc] Boot: starting...");
    const container = document.getElementById("cesiumContainer");
    if (!container) {
      console.error("[HoseCalc] cesiumContainer not found");
      return;
    }
    console.log("[HoseCalc] Container size:", container.clientWidth, "x", container.clientHeight);
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      console.log("[HoseCalc] Container has 0 size, waiting for layout...");
      requestAnimationFrame(boot);
      return;
    }
    if (typeof Cesium === "undefined") {
      console.error("[HoseCalc] Cesium not loaded");
      document.getElementById("loadingMessage").textContent = "Cesium\u30E9\u30A4\u30D6\u30E9\u30EA\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002";
      document.getElementById("loadingOverlay").classList.add("show");
      return;
    }
    console.log("[HoseCalc] Cesium version:", Cesium.VERSION);
    try {
      const viewer = initViewer();
      if (!viewer) {
        document.getElementById("loadingMessage").textContent = "\u5730\u56F3\u306E\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u30DA\u30FC\u30B8\u3092\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
        document.getElementById("loadingOverlay").classList.add("show");
        return;
      }
      console.log("[HoseCalc] Viewer created, canvas:", viewer.canvas.width, "x", viewer.canvas.height);
      showLoading(false);
      updateLayerCards();
      initEventHandlers();
      initLocation();
      setTimeout(() => restoreData(), 1500);
      console.log("[HoseCalc] Boot complete");
    } catch (e) {
      console.error("[HoseCalc] Boot failed:", e);
      document.getElementById("loadingMessage").textContent = "\u30A8\u30E9\u30FC: " + e.message;
      document.getElementById("loadingOverlay").classList.add("show");
    }
  }
  if (document.readyState === "complete") {
    requestAnimationFrame(boot);
  } else {
    window.addEventListener("load", () => requestAnimationFrame(boot));
  }
})();
