import S from './state.js';
import { showToast } from './ui.js';
import { addFirePoint } from './fire.js';
import { addWaterSource } from './water.js';
import { runSimulationForLine } from './hose.js';

// === Encode/Decode ===

function roundCoord(v, decimals = 5) { return Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals); }

function buildShareData() {
    const carto = S.viewer.camera.positionCartographic;
    const data = {
        v: 1,
        c: [roundCoord(Cesium.Math.toDegrees(carto.longitude)), roundCoord(Cesium.Math.toDegrees(carto.latitude)), Math.round(carto.height)],
        f: S.firePoints.map(p => [roundCoord(p.lon), roundCoord(p.lat), Math.round(p.height)]),
        w: S.waterSources.map(w => ({ t: w.type, x: roundCoord(w.lon), y: roundCoord(w.lat) })),
        l: S.confirmedLines.map(line => ({
            p: line.points.map(p => [roundCoord(p.lon), roundCoord(p.lat), Math.round(p.height)])
        })),
        pr: {
            po: S.hoseParams.pumpOutputMPa,
            ro: S.hoseParams.relayOutputMPa,
            mi: S.hoseParams.minInletPressureMPa,
            nr: S.hoseParams.nozzleRequiredMPa,
            lh: S.hoseParams.lossPerHoseMPa
        }
    };
    return data;
}

// Compress using CompressionStream API (modern browsers)
async function compressData(jsonStr) {
    try {
        if (typeof CompressionStream !== 'undefined') {
            const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('deflate'));
            const buf = await new Response(stream).arrayBuffer();
            return arrayBufferToBase64Url(buf);
        }
    } catch (e) { console.warn('CompressionStream failed, falling back:', e); }
    // Fallback: plain base64url
    return btoa(unescape(encodeURIComponent(jsonStr))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decompressData(encoded) {
    try {
        // Try deflate decompression first
        const buf = base64UrlToArrayBuffer(encoded);
        if (typeof DecompressionStream !== 'undefined') {
            try {
                const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('deflate'));
                const text = await new Response(stream).text();
                return JSON.parse(text);
            } catch (e) { /* not compressed, try plain */ }
        }
        // Fallback: plain base64url
        const jsonStr = decodeURIComponent(escape(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))));
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('Decompress failed:', e);
        return null;
    }
}

function arrayBufferToBase64Url(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToArrayBuffer(str) {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    const binary = atob(padded);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    return buf.buffer;
}

// === Share ===

export async function shareSimulation() {
    if (S.confirmedLines.length === 0 && S.firePoints.length === 0 && S.waterSources.length === 0) {
        showToast('共有するデータがありません');
        return;
    }

    try {
        const data = buildShareData();
        const jsonStr = JSON.stringify(data);
        const encoded = await compressData(jsonStr);
        const url = `${window.location.origin}${window.location.pathname}#d=${encoded}`;

        // Try native share API first (mobile)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'HoseCalc シミュレーション結果',
                    text: `ホース延長シミュレーション（${S.confirmedLines.length}ライン）`,
                    url: url
                });
                return;
            } catch (e) { /* user cancelled or not supported, fall through to clipboard */ }
        }

        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(url);
        showToast('共有URLをコピーしました');

        // Also update browser URL without reload
        history.replaceState(null, '', `#d=${encoded}`);
    } catch (e) {
        console.error('Share failed:', e);
        showToast('共有に失敗しました');
    }
}

// === Restore from URL ===

export async function restoreFromURL() {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#d=')) return false;

    const encoded = hash.substring(3);
    if (!encoded) return false;

    const data = await decompressData(encoded);
    if (!data || data.v !== 1) return false;

    S.isRestoring = true;
    try {
        // Set params
        if (data.pr) {
            if (data.pr.po) S.hoseParams.pumpOutputMPa = data.pr.po;
            if (data.pr.ro) S.hoseParams.relayOutputMPa = data.pr.ro;
            if (data.pr.mi) S.hoseParams.minInletPressureMPa = data.pr.mi;
            if (data.pr.nr) S.hoseParams.nozzleRequiredMPa = data.pr.nr;
            if (data.pr.lh) S.hoseParams.lossPerHoseMPa = data.pr.lh;
            // Update UI inputs
            document.getElementById('paramPumpOut').value = S.hoseParams.pumpOutputMPa;
            document.getElementById('paramRelayOut').value = S.hoseParams.relayOutputMPa;
            document.getElementById('paramInlet').value = S.hoseParams.minInletPressureMPa;
            document.getElementById('paramNozzle').value = S.hoseParams.nozzleRequiredMPa;
            document.getElementById('paramLossPerHose').value = S.hoseParams.lossPerHoseMPa;
        }

        // Restore fire points
        (data.f || []).forEach(p => addFirePoint(p[0], p[1], p[2]));

        // Restore water sources
        (data.w || []).forEach(w => addWaterSource(w.t, '', w.x, w.y));

        // Restore hose lines + run simulations
        (data.l || []).forEach(line => {
            const lineId = 'hose-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
            const points = line.p.map(p => ({ lon: p[0], lat: p[1], height: p[2] }));
            S.confirmedLines.push({ id: lineId, points });
            runSimulationForLine(lineId, points);
        });

        // Fly to shared camera position
        if (data.c) {
            S.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(data.c[0], data.c[1], data.c[2]),
                orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
                duration: 1.5
            });
        }

        const lineCount = (data.l || []).length;
        showToast(`共有データを復元しました（${lineCount}ライン）`);
    } finally {
        S.isRestoring = false;
    }
    return true;
}
