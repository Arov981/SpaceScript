//
// SpaceScript MCP client.
// Speaks JSON-RPC 2.0 over HTTP (+SSE) to Roblox Studio's built-in MCP
// server. Auto-discovers the local MCP endpoint if not configured.
//
import { EventEmitter } from 'node:events';

export class McpClient extends EventEmitter {
  constructor(cfg) {
    super();
    this.cfg = cfg;
    this.endpoint = cfg.endpoint || null;
    this.tools = [];
    this.ready = false;
    this._nextId = 1;
    this._retryTimer = null;
  }

  async connect() {
    if (!this.endpoint && this.cfg.discovery?.enabled) {
      this.endpoint = await this._discover();
    }
    if (!this.endpoint) {
      this._setStatus('warn', 'No Studio MCP endpoint found — open a place and enable Studio as MCP Server');
      this._scheduleRetry();
      return;
    }
    try {
      await this._initialize();
      await this.listTools();
      this.ready = true;
      this._cancelRetry();
      this._setStatus('ok', 'Connected to Roblox Studio MCP');
    } catch (err) {
      this.ready = false;
      this._setStatus('warn', 'Studio MCP not ready: ' + err.message);
      this._scheduleRetry();
    }
  }

  _setStatus(level, msg) { this.emit('status', level, msg); }

  _scheduleRetry() {
    if (this._retryTimer) return;
    this._retryTimer = setInterval(() => { this.connect(); }, this.cfg.reconnectMs || 3000);
  }
  _cancelRetry() {
    if (this._retryTimer) { clearInterval(this._retryTimer); this._retryTimer = null; }
  }

  async _discover() {
    const ports = this.cfg.discovery?.probePorts || [];
    for (const port of ports) {
      const url = `http://127.0.0.1:${port}/mcp`;
      try {
        await this._rpc(url, 'initialize', this._initParams(), 1500);
        return url;
      } catch { /* try next port */ }
    }
    return null;
  }

  _initParams() {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'SpaceScript', version: '1.0.0' }
    };
  }

  async _initialize() {
    await this._rpc(this.endpoint, 'initialize', this._initParams(), this.cfg.connectTimeoutMs || 4000);
    try { await this._rpc(this.endpoint, 'notifications/initialized', null, 2000); } catch { /* not all servers require */ }
  }

  async listTools() {
    const res = await this._rpc(this.endpoint, 'tools/list', {});
    this.tools = (res && res.tools) || [];
    return this.tools;
  }

  async callTool(name, params) {
    if (!this.ready) throw new Error('Studio MCP is not ready');
    const res = await this._rpc(this.endpoint, 'tools/call', { name, arguments: params || {} }, this.cfg.requestTimeoutMs || 30000);
    return res;
  }

  _rpc(url, method, params, timeoutMs) {
    const id = method === 'notifications/initialized' ? undefined : this._nextId++;
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params: params || undefined });
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body,
      signal: ctrl.signal
    }).then(async r => {
      clearTimeout(t);
      if (!r.ok) throw new Error('MCP HTTP ' + r.status);
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('text/event-stream')) return await this._readSse(r, id);
      return await r.json();
    }).then(json => {
      if (id === undefined) return null;            // notification
      if (json && json.error) throw new Error(json.error.message || 'MCP error');
      return json ? json.result : null;
    }).catch(err => { clearTimeout(t); throw err; });
  }

  async _readSse(response, expectedId) {
    const reader = response.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, idx); buf = buf.slice(idx + 2);
        const data = block.split('\n')
          .filter(l => l.startsWith('data:'))
          .map(l => l.slice(5).trim())
          .join('\n');
        if (!data) continue;
        try {
          const json = JSON.parse(data);
          if (json && json.id === expectedId) return json;
        } catch { /* ignore non-JSON keepalives */ }
      }
    }
    return null;
  }
}
