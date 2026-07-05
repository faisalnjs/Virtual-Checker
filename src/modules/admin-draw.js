import * as ui from "/src/modules/ui.js";
import storage from '/src/modules/storage.js';
import * as themes from '/src/themes/themes.js';
import HTTPSockBroadcast from 'httpsock/broadcast.mjs';

var domain = null;
var broadcaster = null;
var connected = false;
var reconnectInterval = null;
var period = null;
var sessionKey = null;

const startLiveDrawingsButton = document.querySelector('[start-live-drawings]');
const stopLiveDrawingsButton = document.querySelector('[stop-live-drawings]');
const saveLiveDrawingsButton = document.querySelector('[save-live-drawings]');
const hideSeatCodesButton = document.getElementById('hide-seat-codes');
const liveDrawingPeriods = document.getElementById('live-drawing-periods');

var hideSeatCodes = false;
export var liveDrawingSessions = {};
export var previousLiveDrawingSessions = {};

var delay = ms => new Promise(res => setTimeout(res, ms));

export async function connect(drawDomain) {
    console.log('Connecting...')
    period = document.getElementById('period-input').value;
    try {
        if (!domain) domain = drawDomain;
        if (!broadcaster) {
            connected = false;
            await fetch(`${domain}/${period}/unlock`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    usr: storage.get('usr') || '',
                    pwd: storage.get('pwd') || '',
                })
            }).then(async (res) => {
                const responseJSON = await res.json();
                if (!res.ok) throw new Error(responseJSON.error || 'Failed to unlock the room.');
                return responseJSON;
            }).then((response) => {
                console.log(`Room ${period} unlocked successfully.`);
                ui.modeless('<i class="bi bi-unlock"></i>', 'Started');
                sessionKey = response.sessionKey;
                updateSession(response.sessionKey, response.strokes);
                connected = false;
                broadcaster = new HTTPSockBroadcast({
                    server: `${domain}/${period}?noBroadcast=true`,
                    cert: './certs/chain.pem',
                    auth: {
                        username: storage.get('usr') || '',
                        password: storage.get('pwd') || ''
                    },
                    callback: async (response) => {
                        if (!connected) {
                            console.log('🟢 Connected to Live Drawings server!');
                            connected = true;
                            clearInterval(reconnectInterval);
                            reconnectInterval = setInterval(() => {
                                connect(domain);
                            }, 5000);
                        }
                        var responseJSON = JSON.parse(response);
                        updateSession(responseJSON.sessionKey, responseJSON.strokes);
                    },
                    close: (e) => close(e, true),
                    error: (e) => close(e, true)
                });
                connected = false;
            }).catch((error) => {
                console.error('Error unlocking the room:', error);
                throw error;
            });
        }
        try {
            broadcaster.sendQuiet({ type: 'session' });
        } catch (error) {
            console.warn('Live Drawings server ping failed:', error);
        }
    } catch (error) {
        if (storage.get("developer")) {
            alert(`Error @ admin-draw.js: ${error.message}`);
        } else {
            ui.reportBugModal(null, String(error.stack));
        }
        throw error;
    }
}

async function updateSession(sessionKey, strokes = []) {
    stopLiveDrawingsButton?.removeAttribute('hidden');
    stopLiveDrawingsButton?.removeAttribute('disabled');
    hideSeatCodesButton?.parentElement?.removeAttribute('hidden');
    saveLiveDrawingsButton?.parentElement?.removeAttribute('hidden');
    liveDrawingPeriods?.removeAttribute('hidden');
    if (!strokes.length) return;
    var newSeatCodes = [];
    for (const stroke of strokes) {
        if (!liveDrawingSessions[stroke.seatCode]) {
            liveDrawingSessions[stroke.seatCode] = { wrapper: null, canvas: null, strokes: [] };
            newSeatCodes.push(stroke.seatCode);
        }
        liveDrawingSessions[stroke.seatCode].strokes = [];
    }
    for (const stroke of strokes) liveDrawingSessions[stroke.seatCode].strokes.push(stroke);
    for (const seatCode in liveDrawingSessions) {
        const sessionStrokes = liveDrawingSessions[seatCode].strokes;
        liveDrawingSessions[seatCode].strokes = (sessionStrokes || []).map(s => ({ stroke: JSON.parse(s.stroke) || s, timestamp: s.created || s.timestamp || Date.now(), id: s.id || 0 })).sort((a, b) => { const ta = Number(a.timestamp || 0), tb = Number(b.timestamp || 0); if (ta !== tb) return ta - tb; return Number(a.id || 0) - Number(b.id || 0); });
    }
    var period = sessionKey.split('::')[1];
    var group = document.querySelector(`[data-period="${period}"]`);
    if (!group) {
        group = document.createElement('div');
        group.className = 'sessions';
        group.setAttribute('data-period', period);
        liveDrawingPeriods?.appendChild(group);
    }
    for (const seatCode in liveDrawingSessions) {
        if (newSeatCodes.includes(seatCode)) {
            updateSingleSession(group, seatCode, [], liveDrawingSessions[seatCode].strokes);
            continue;
        }
        const oldStrokes = previousLiveDrawingSessions[seatCode]?.strokes || [];
        const mappedStrokes = (previousLiveDrawingSessions[seatCode]?.strokes || []).map(s => s.id);
        const newStrokes = (liveDrawingSessions[seatCode].strokes || []).filter(s => {
            return !mappedStrokes.includes(s.id);
        });
        if (!newStrokes.length) continue;
        updateSingleSession(group, seatCode, oldStrokes, newStrokes);
    }
    for (const seatCode in liveDrawingSessions) previousLiveDrawingSessions[seatCode] = { ...liveDrawingSessions[seatCode], strokes: [...(liveDrawingSessions[seatCode].strokes || [])] };
}

/* createWebSocket = function () {
    try {
    const usr = storage.get('usr') || '';
    const pwd = storage.get('pwd') || '';
    const params = new URLSearchParams({ role: 'admin', usr, pwd }).toString();
    if (ws && ws.connected) return;
    if (ws) ws.disconnect();
    if (typeof io === 'undefined') return;
    ws = io(`${domain}/ws`, { query: Object.fromEntries(new URLSearchParams(params)), transports: ['websocket'] });
    ws.on('connect', () => {
        reconnectAttempts = 0;
        setTimeout(() => {
        var currentPeriod = getExtendedPeriod();
        if ((currentPeriod != -1) && courses.flatMap(course => JSON.parse(course.periods).map(period => { return { period, name: course.name } })).some(coursePeriod => coursePeriod.period === (currentPeriod + 1))) {
            document.getElementById("period-input").value = getExtendedPeriod() + 1;
        } else if (document.querySelectorAll('#live-drawing-periods .sessions').length) {
            document.getElementById("period-input").value = Array.from(document.querySelectorAll('#live-drawing-periods .sessions')).sort((a, b) => b.children.length - a.children.length)[0].getAttribute('data-period');
        }
        document.getElementById("period-input").addEventListener("change", syncLiveDrawingPeriod);
        syncLiveDrawingPeriod();
        refreshSavedLiveDrawingSessions();
        active = true;
        ui.stopLoader();
        }, 1000);
    });
    ws.on('studentDraw', (data) => {
        const { sessionKey, meta, stroke, timestamp, id } = data;
        if ((meta.source || 'unknown') !== 'clicker') return;
        if (!liveDrawingSessions[sessionKey]) createSession({ data }, sessionKey);
        const info = liveDrawingSessions[sessionKey];
        info.strokes = info.strokes || [];
        info.strokes.push({ stroke, timestamp: timestamp || Date.now(), id: id || 0 });
        info.strokes.sort((a, b) => {
        const firstStrokeTime = Number(a.timestamp || 0);
        const secondStrokeTime = Number(b.timestamp || 0);
        if (firstStrokeTime !== secondStrokeTime) return firstStrokeTime - secondStrokeTime;
        return (Number(a.id || 0) - Number(b.id || 0));
        });
        renderStrokesIntoSession(sessionKey, info.strokes);
        info.wrapper.querySelectorAll('.meta').forEach(el => el.style.display = hideSeatCodes ? 'none' : 'block');
    });
    ws.on('sessionSync', (data) => {
        if (!data || !data.data || !data.data.meta || !data.data.meta.source || !data.data.meta.seatCode || !data.data.strokes || !Array.isArray(data.data.strokes) || !data.data.strokes.length) return;
        const sessionKey = data.sessionKey;
        const normalized = (data.data.strokes || []).map(s => ({ stroke: s.stroke || s, timestamp: s.created || s.timestamp || Date.now(), id: s.id || 0 }));
        normalized.sort((a, b) => { const ta = Number(a.timestamp || 0), tb = Number(b.timestamp || 0); if (ta !== tb) return ta - tb; return Number(a.id || 0) - Number(b.id || 0); });
        data.data.strokes = normalized.map(s => ({ stroke: s.stroke, timestamp: s.timestamp, id: s.id }));
        if (!liveDrawingSessions[sessionKey]) {
        createSession(data, sessionKey);
        } else {
        const info = liveDrawingSessions[sessionKey];
        info.strokes = info.strokes || [];
        const merged = info.strokes.concat(data.data.strokes.map(s => ({ stroke: s.stroke, timestamp: s.timestamp, id: s.id })));
        merged.sort((a, b) => { const ta = Number(a.timestamp || 0), tb = Number(b.timestamp || 0); if (ta !== tb) return ta - tb; return Number(a.id || 0) - Number(b.id || 0); });
        info.strokes = merged;
        renderStrokesIntoSession(sessionKey, info.strokes);
        }
    });
    ws.on('studentUndo', (data) => {
        const { sessionKey, strokeId } = data;
        const info = liveDrawingSessions[sessionKey];
        if (!info) return;
        info.strokes = info.strokes || [];
        info.strokes = info.strokes.filter(s => {
        const stroke = s.stroke || s;
        if (!stroke) return true;
        if (Array.isArray(stroke)) return !stroke.some(i => (i && i.id && String(i.id) === String(strokeId)));
        if (stroke && stroke.id && String(stroke.id) === String(strokeId)) return false;
        return true;
        });
        renderStrokesIntoSession(sessionKey, info.strokes);
    });
    ws.on('studentClear', (data) => {
        const { sessionKey } = data;
        const info = liveDrawingSessions[sessionKey];
        if (!info) return;
        info.strokes = [];
        renderStrokesIntoSession(sessionKey, info.strokes || []);
    });
    ws.on('resetPeriod', (data) => {
        const period = String(data.period);
        Object.values(liveDrawingSessions).forEach(info => {
        const seatCode = info?.meta?.seatCode?.toString?.() || '';
        if (seatCode && seatCode.startsWith(period)) {
            if (info && info.canvas) {
            const context = info.canvas.getContext('2d');
            context.clearRect(0, 0, info.canvas.width, info.canvas.height);
            info.strokes = [];
            }
        }
        });
    });
    ws.on('disconnect', () => {
        scheduleAdminReconnect();
    });
    ws.on('error', (err) => {
        console.error(err);
        ws.disconnect();
    });
    } catch (e) {
    scheduleAdminReconnect();
    }
} */

// export function getOrCreateGroup(period) {
//     let el = document.querySelector(`[data-period="${period}"]`);
//     if (el) return el;
//     el = document.createElement('div');
//     el.className = 'sessions';
//     el.setAttribute('data-period', period);
//     (liveDrawingPeriods || document.getElementById('saved-live-drawings')).appendChild(el);
//     return el;
// }

async function updateSingleSession(group, seatCode, oldStrokes = [], newStrokes = []) {
    if (!liveDrawingSessions[seatCode].wrapper) {
        const sessionDiv = document.createElement('div');
        sessionDiv.className = 'session';
        sessionDiv.innerHTML = `<span class="meta">${seatCode}</span><div class="canvas-wrapper"></div><div class="overlays"></div>`;
        group.appendChild(sessionDiv);
        liveDrawingSessions[seatCode].wrapper = sessionDiv;
        liveDrawingSessions[seatCode].canvas = null;
        sessionDiv.querySelector('.meta').addEventListener('click', () => {
            sessionDiv.classList.toggle('collapsed');
            const wrap = sessionDiv.querySelector('.canvas-wrapper');
            wrap.style.display = wrap.style.display === 'none' ? 'flex' : 'none';
        });
        const overlays = sessionDiv.querySelector('.overlays');
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggle-seat-code-button';
        toggleBtn.setAttribute('square', '');
        toggleBtn.setAttribute('tooltip', 'Show/Hide Seat Code');
        toggleBtn.innerHTML = '<i class="bi bi-eye"></i>';
        toggleBtn.addEventListener('click', () => {
            const hideMeta = liveDrawingSessions[seatCode].wrapper.querySelector('.meta').style.opacity === '1';
            liveDrawingSessions[seatCode].wrapper.querySelectorAll('.meta').forEach(el => el.style.opacity = hideMeta ? '0' : '1');
            if (!hideMeta) {
                hideSeatCodes = false;
                hideSeatCodesButton.checked = false;
            }
            if (Array.from(document.querySelectorAll('.session .meta')).every(el => el.style.opacity === '0')) hideSeatCodesButton.checked = true;
        });
        overlays.appendChild(toggleBtn);
    }
    if ((liveDrawingSessions[seatCode].strokes || []).length) await renderStrokesIntoSession(seatCode, oldStrokes, newStrokes);
}

async function renderStrokesIntoSession(seatCode, oldStrokes = [], newStrokes = [], image = null) {
    var canvas = liveDrawingSessions[seatCode].canvas;
    if (!canvas) {
        var canvasElement = document.createElement('canvas');
        canvasElement.width = 300;
        canvasElement.height = 200;
        canvasElement.style.width = '300px';
        canvasElement.style.height = '200px';
        canvasElement.style.padding = '0';
        canvasElement.style.borderRadius = '0.5rem';
        canvasElement.style.backgroundColor = themes.getCurrentTheme().surfaceColor;
        canvasElement.style.touchAction = 'none';
        liveDrawingSessions[seatCode].wrapper.querySelector('.canvas-wrapper').appendChild(canvasElement);
        canvas = canvasElement;
        liveDrawingSessions[seatCode].canvas = canvas;
    }
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (image) {
        var img = new Image();
        img.onload = function () {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = image;
    } else if (Array.isArray(oldStrokes) && Array.isArray(newStrokes)) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let lines = [];
        [...oldStrokes, ...newStrokes].forEach(seg => {
            if (seg.stroke && seg.stroke.from && seg.stroke.to) {
                const f = seg.stroke.from, t = seg.stroke.to;
                minX = Math.min(minX, f.x, t.x);
                minY = Math.min(minY, f.y, t.y);
                maxX = Math.max(maxX, f.x, t.x);
                maxY = Math.max(maxY, f.y, t.y);
                lines.push({ from: f, to: t, width: seg.stroke.width || 3, color: themes.getCurrentTheme().textColor, animate: newStrokes.includes(seg) });
            }
            if (seg.stroke && seg.stroke.clear) lines = [];
        });
        if (lines.length === 0) return;
        if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return;
        const srcW = (maxX - minX) || 1;
        const srcH = (maxY - minY) || 1;
        const padding = 10;
        const scale = Math.min((canvas.width - padding * 2) / srcW, (canvas.height - padding * 2) / srcH);
        const offsetX = (canvas.width - srcW * scale) / 2 - minX * scale;
        const offsetY = (canvas.height - srcH * scale) / 2 - minY * scale;
        for (const line of lines) {
            if (line.animate) await delay(10);
            context.beginPath();
            context.moveTo(line.from.x * scale + offsetX, line.from.y * scale + offsetY);
            context.lineTo(line.to.x * scale + offsetX, line.to.y * scale + offsetY);
            context.lineWidth = Math.max(1, (line.width || 3) * scale * 0.9);
            context.strokeStyle = themes.getCurrentTheme().textColor;
            context.stroke();
        }
    }
}

hideSeatCodesButton?.addEventListener('change', (e) => {
    hideSeatCodes = !!e.target.checked;
    document.querySelectorAll('.session .meta').forEach(el => el.style.opacity = hideSeatCodes ? '0' : '1');
    // document.querySelectorAll('.session #toggle-seat-code-button').forEach(btn => btn.style.display = hideSeatCodes ? 'flex' : 'none');
});

saveLiveDrawingsButton?.addEventListener('click', async () => {
    const images = [];
    Object.keys(liveDrawingSessions).forEach(sessionKey => {
        const info = liveDrawingSessions[sessionKey];
        if (!info || !info.canvas) return;
        try {
            const dataUrl = info.canvas.toDataURL('image/png');
            images.push({ dataUrl, sessionKey });
        } catch (e) {
            console.warn('Failed to read canvas for', sessionKey, e);
        }
    });
    if (images.length === 0) {
        ui.toast('No drawings available to save.', 3000, 'warning', 'bi bi-exclamation-triangle-fill');
        return;
    }
    const saveSession = await fetch(domain + '/draw/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            images,
            meta: {
                created: new Date().toISOString(),
                period: document.getElementById('period-input').value || null,
                name: `Live Drawing Session - Period ${document.getElementById('period-input').value || 0} - ${new Date().toLocaleString()}`,
            },
            usr: storage.get('usr'),
            pwd: storage.get('pwd')
        })
    });
    const saveSessionJSON = await saveSession.json();
    ui.toast(saveSessionJSON.ok ? (saveSessionJSON.message || 'Saved all drawings.') : (saveSessionJSON.error || 'Save failed.'), 5000, saveSessionJSON.ok ? 'success' : 'error', saveSessionJSON.ok ? 'bi bi-check-lg' : 'bi bi-exclamation-triangle-fill');
    refreshSavedLiveDrawingSessions();
});

document.getElementById('reset-live-drawings')?.addEventListener('click', async () => {
    ui.modal({
        title: `Reset Period ${period} Drawings?`,
        body: `<p>Clear all drawings for ${Object.keys(liveDrawingSessions).length} seat code${(Object.keys(liveDrawingSessions).length === 1) ? '' : 's'}? This cannot be undone.</p>`,
        buttons: [
            {
                text: 'Cancel',
                class: 'cancel-button',
                close: true,
            },
            {
                text: 'Continue',
                class: 'submit-button',
                onclick: async () => {
                    broadcaster.sendQuiet({
                        type: 'message',
                        to: sessionKey,
                        content: 'clear',
                    });
                    ui.toast('Drawings cleared.', 3000, 'success', 'bi bi-check-lg');
                },
                close: true,
            },
        ],
    });
});

async function refreshSavedLiveDrawingSessions() {
    const refreshSessions = await fetch(domain + '/draw/sessions?usr=' + encodeURIComponent(storage.get('usr')) + '&pwd=' + encodeURIComponent(storage.get('pwd')));
    const refreshSessionsJSON = await refreshSessions.json();
    document.querySelector('.saved-live-drawing-sessions').innerHTML = '';
    if (refreshSessionsJSON.sessions && refreshSessionsJSON.sessions.length) {
        document.getElementById('no-saved-live-drawing-sessions').setAttribute('hidden', '');
        document.querySelector('.saved-live-drawing-sessions').removeAttribute('hidden');
        refreshSessionsJSON.sessions = refreshSessionsJSON.sessions.sort((a, b) => b.created - a.created);
        refreshSessionsJSON.sessions.forEach(session => {
            document.querySelector('.saved-live-drawing-sessions').innerHTML += `<div class="enhanced-item" id="${session.id}">
              <span class="sessionName">${session.name}</span>
              <span class="actions">
                <button class="icon" data-open-session tooltip="Open Session">
                  <i class="bi bi-box-arrow-up-right"></i>
                </button>
              </span>
            </div>`;
        });
        refreshSessionsJSON.sessions.forEach(session => {
            document.querySelector(`.saved-live-drawing-sessions [id='${session.id}'] [data-open-session]`).addEventListener('click', async () => {
                window.open(`/admin/session?id=${session.id}`, '_blank');
            });
        });
    } else {
        document.getElementById('no-saved-live-drawing-sessions').removeAttribute('hidden');
        document.querySelector('.saved-live-drawing-sessions').setAttribute('hidden', '');
    }
}

document.querySelector('[refresh-live-drawing-saved-sessions]')?.addEventListener('click', async () => {
    await refreshSavedLiveDrawingSessions();
    ui.toast('Saved sessions refreshed.', 3000, 'success', 'bi bi-check-lg');
});

function syncLiveDrawingPeriod() {
    const period = document.getElementById('period-input').value;
    document.querySelectorAll('[data-period]').forEach(sessions => {
        sessions.style.display = (sessions.getAttribute('data-period') === period) ? 'grid' : 'none';
    });
}

export async function close(err = null, retry = false) {
    stopLiveDrawingsButton?.setAttribute('hidden', '');
    stopLiveDrawingsButton?.setAttribute('disabled', '');
    hideSeatCodesButton?.parentElement?.setAttribute('hidden', '');
    saveLiveDrawingsButton?.parentElement?.setAttribute('hidden', '');
    liveDrawingPeriods?.setAttribute('hidden', '');
    startLiveDrawingsButton.removeAttribute('hidden');
    startLiveDrawingsButton.removeAttribute('disabled');
    document.getElementById('period-input')?.removeAttribute('disabled');
    try {
        if (!retry) {
            reconnectInterval && clearInterval(reconnectInterval);
            reconnectInterval = null;
            console.log('Live Drawings server connection closed');
        } else if (connected) {
            console.log('Server disconnected, retrying', err || '');
            if (!reconnectInterval) reconnectInterval = setInterval(() => {
                connect(domain);
            }, 5000);
        } else {
            ui.view('draw-session-closed');
        }
        connected = false;
        broadcaster = null;
    } catch (error) {
        if (storage.get("developer")) {
            alert(`Error @ admin-draw.js: ${error.message}`);
        } else {
            ui.reportBugModal(null, String(error.stack));
        }
        throw error;
    }
    await fetch(`${domain}/${period}/lock`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            usr: storage.get('usr') || '',
            pwd: storage.get('pwd') || '',
        })
    }).then(async (res) => {
        const responseJSON = await res.json();
        if (!res.ok) throw new Error(responseJSON.error || 'Failed to lock the room.');
        return responseJSON;
    }).then(() => {
        console.log(`Room ${period} locked successfully.`);
        ui.modeless('<i class="bi bi-lock"></i>', 'Ended');
    }).catch((error) => {
        console.error('Error locking the room:', error);
        throw error;
    });
}

window.addEventListener('beforeunload', async (event) => {
    if (connected) {
        event.preventDefault();
        event.returnValue = '';
        await close();
    }
});