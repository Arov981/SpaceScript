//
// SpaceScript service worker.
// Owns the single WebSocket connection to the local bridge, routes SCP
// command/result traffic between content scripts and the bridge, and
// broadcasts status to the popup and every open tab.
//
const BRIDGE_WS = 'ws://127.0.0.1:6471/scp';
const BRIDGE_HTTP = 'http://127.0.0.1:6471';

let ws = null;
let wsReady = false;
let pending = new Map();        // id -> { resolve, reject }
let status = { level: 'grey', msg: 'Bridge offline' };
let seq = 1;

function nextId() { return 'c' + seq++ + '_' + Date.now().toString(36); }

const BADGE_COLORS = { ok: '#10b981', warn: '#f59e0b', err: '#ef4444', grey: '#64748b' };

function setStatus(level, msg) {
  status = { level, msg };
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[level] || BADGE_COLORS.grey });
  chrome.action.setBadgeText({ text: ' ' });
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs) {
      chrome.tabs.sendMessage(t.id, { kind: 'status', level, msg }).catch(() => {});
    }
  });
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  try {
    ws = new WebSocket(BRIDGE_WS);
  } catch {
    scheduleReconnect();
    return;
  }
  ws.onopen = () => {
    wsReady = true;
    setStatus('warn', 'Bridge connected — waiting for Studio');
  };
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === 'hello') return;
    if (msg.type === 'status') {
      setStatus(mapLevel(msg.level), msg.msg);
      return;
    }
    if (msg.type === 'result') {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p.resolve({ ok: !!msg.ok, data: msg.data, error: msg.error });
      }
    }
  };
  ws.onclose = () => {
    wsReady = false;
    failPending('bridge closed');
    setStatus('grey', 'Bridge offline — run start.bat / start.command');
    scheduleReconnect();
  };
  ws.onerror = () => { try { ws.close(); } catch {} };
}

function scheduleReconnect() { setTimeout(connect, 2500); }

function mapLevel(l) {
  if (l === 'ok') return 'ok';
  if (l === 'warn') return 'warn';
  return 'err';
}

function failPending(reason) {
  for (const [, p] of pending) p.reject(new Error(reason));
  pending.clear();
}

function callTool(tool, params, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    if (!wsReady) { reject(new Error('Bridge is offline')); return; }
    const id = nextId();
    const t = setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error('timeout')); }
    }, timeoutMs);
    pending.set(id, {
      resolve: (r) => { clearTimeout(t); resolve(r); },
      reject: (e) => { clearTimeout(t); reject(e); }
    });
    ws.send(JSON.stringify({ type: 'cmd', id, tool, params: params || {} }));
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.kind === 'scp') {
    callTool(msg.tool, msg.params, msg.timeoutMs)
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;             // async response
  }
  if (msg.kind === 'status') {
    sendResponse({ ok: true, status });
    return false;
  }
  if (msg.kind === 'health') {
    fetch(BRIDGE_HTTP + '/health')
      .then((r) => r.json())
      .then((j) => sendResponse({ ok: true, health: j }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.kind === 'reconnect') {
    try { ws && ws.close(); } catch {}
    connect();
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

connect();
