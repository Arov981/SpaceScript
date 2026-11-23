//
// SpaceScript HTTP + WebSocket server.
// - Serves the desktop dashboard (desktop-ui/).
// - Exposes a small REST API (/health, /status, /api/skills, /api/memory).
// - Speaks the SpaceScript Control Protocol (SCP) over a minimal RFC 6455
//   WebSocket at /scp. Zero external dependencies.
//
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

export function createHttpServer({ cfg, root, router, skills, memory, mcp }) {
  const clients = new Set();

  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/health')
      return json(res, 200, { ok: true, version: cfg.version, studio: mcp.ready, toolCount: mcp.tools.length });
    if (url.pathname === '/status')
      return json(res, 200, { ok: true, studio: mcp.ready, tools: mcp.tools.map(t => t.name) });
    if (url.pathname === '/api/skills' && req.method === 'GET')
      return json(res, 200, skills.list());
    if (url.pathname === '/api/memory' && req.method === 'GET')
      return json(res, 200, await memory.all());
    if (url.pathname === '/api/memory' && req.method === 'POST') {
      const body = await readJson(req);
      if (!body || !body.key) return json(res, 400, { error: 'key required' });
      await memory.set(body.key, body.value);
      return json(res, 200, { ok: true });
    }

    // Static dashboard
    const p = url.pathname === '/' ? '/desktop-ui/index.html' : url.pathname;
    const filePath = join(root, p);
    if (!filePath.startsWith(root)) return json(res, 403, { error: 'forbidden' });
    try {
      const data = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      json(res, 404, { error: 'not found', path: p });
    }
  });

  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/scp') { socket.destroy(); return; }
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const accept = createHash('sha1').update(key + WS_GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
    );

    const peer = new Peer(socket, async (msg) => {
      if (msg && msg.type === 'cmd') {
        try {
          const out = await router.handle(msg.tool, msg.params || {}, msg.id);
          return { type: 'result', id: msg.id, ok: true, data: out };
        } catch (err) {
          return { type: 'result', id: msg.id, ok: false, error: String(err.message || err) };
        }
      }
      return null;
    });

    clients.add(peer);
    peer.send({ type: 'hello', version: cfg.version, capabilities: ['cmd', 'status', 'skill'] });
    peer.send({
      type: 'status',
      level: mcp.ready ? 'ok' : 'warn',
      msg: mcp.ready ? 'Roblox Studio ready' : 'Studio not ready — open a place and enable MCP'
    });
    socket.on('error', () => clients.delete(peer));
    socket.on('close', () => clients.delete(peer));
  });

  function broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const c of clients) c.sendRaw(frame(0x1, Buffer.from(data, 'utf8')));
  }

  server.broadcast = broadcast;
  return server;
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(data);
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

// Minimal RFC 6455 WebSocket peer (text frames only; masked client frames handled).
class Peer {
  constructor(socket, onMessage) {
    this.socket = socket;
    this.onMessage = onMessage;
    this._buf = Buffer.alloc(0);
    socket.on('data', (chunk) => this._onData(chunk));
  }
  _onData(chunk) {
    this._buf = Buffer.concat([this._buf, chunk]);
    while (this._buf.length >= 2) {
      const consumed = this._parseFrame();
      if (consumed === 0) break;
      this._buf = this._buf.subarray(consumed);
    }
  }
  _parseFrame() {
    const b = this._buf;
    if (b.length < 2) return 0;
    const b0 = b[0], b1 = b[1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let ptr = 2;
    if (len === 126) { if (b.length < 4) return 0; len = b.readUInt16BE(2); ptr = 4; }
    else if (len === 127) { if (b.length < 10) return 0; len = Number(b.readBigUInt64BE(2)); ptr = 10; }
    let mask = Buffer.alloc(0);
    if (masked) { if (b.length < ptr + 4) return 0; mask = b.subarray(ptr, ptr + 4); ptr += 4; }
    if (b.length < ptr + len) return 0;
    let payload = b.subarray(ptr, ptr + len);
    if (masked) {
      const u = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) u[i] = payload[i] ^ mask[i & 3];
      payload = u;
    }
    if (opcode === 0x8) { this.sendRaw(frame(0x8, payload)); try { this.socket.end(); } catch {} return ptr + len; }
    if (opcode === 0x9) { this.sendRaw(frame(0xA, payload)); return ptr + len; }
    if (opcode === 0xA) return ptr + len;
    if (opcode === 0x1) {
      const text = payload.toString('utf8');
      try {
        const msg = JSON.parse(text);
        Promise.resolve(this.onMessage(msg)).then(reply => { if (reply) this.send(reply); }).catch(() => {});
      } catch { /* ignore non-JSON text */ }
      return ptr + len;
    }
    return ptr + len;
  }
  send(obj) { this.sendRaw(frame(0x1, Buffer.from(JSON.stringify(obj), 'utf8'))); }
  sendRaw(buf) { try { this.socket.write(buf); } catch {} }
}

function frame(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}
