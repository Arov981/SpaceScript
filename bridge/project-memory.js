//
// SpaceScript persistent project memory.
// A simple key/value store persisted to a local JSON file under
// .spaceforge-memory/. Survives across sessions so the AI can remember
// the project's conventions, modules, and decisions.
//
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export class ProjectMemory {
  constructor(root, cfg) {
    this.dir = join(root, cfg.dir);
    this.file = join(this.dir, cfg.file || 'memory.json');
    this.max = cfg.maxEntries || 2000;
    this.data = new Map();
  }

  async init() {
    try { await mkdir(this.dir, { recursive: true }); } catch {}
    try {
      const raw = await readFile(this.file, 'utf8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) for (const { key, value } of arr) this.data.set(key, value);
    } catch {
      this.data = new Map();
    }
  }

  async _persist() {
    const arr = [...this.data.entries()].slice(-this.max).map(([key, value]) => ({ key, value }));
    await writeFile(this.file, JSON.stringify(arr, null, 2), 'utf8');
  }

  get(key) {
    return { key, value: this.data.has(key) ? this.data.get(key) : null };
  }

  async set(key, value) {
    this.data.set(key, value);
    await this._persist();
    return { ok: true };
  }

  all() {
    return [...this.data.entries()].slice(-200).map(([key, value]) => ({ key, value }));
  }
}
