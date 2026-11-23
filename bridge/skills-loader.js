//
// SpaceForge skills loader.
// Reads the original Luau game-development skill packs from skills/*.md,
// parses a small front-matter header, and exposes them to the bridge and
// dashboard.
//
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export class SkillsLoader {
  constructor(dir) {
    this.dir = dir;
    this.skills = [];
  }

  async init() {
    this.skills = [];
    let entries = [];
    try { entries = await readdir(this.dir); } catch { this.skills = []; return; }
    for (const name of entries.filter(n => n.endsWith('.md'))) {
      if (name.toLowerCase() === 'readme.md') continue;
      const path = join(this.dir, name);
      try { this.skills.push(parse(await readFile(path, 'utf8'))); } catch { /* skip unreadable */ }
    }
    this.skills.sort((a, b) => a.id.localeCompare(b.id));
  }

  list() {
    return this.skills.map(s => ({ id: s.id, title: s.title, summary: s.summary, tags: s.tags }));
  }

  get(id) {
    return this.skills.find(s => s.id === id) || null;
  }
}

function parse(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta = {};
  let body = raw;
  if (m) {
    body = m[2];
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i > -1) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  const tags = meta.tags ? meta.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  return {
    id: meta.id || slug(meta.title) || 'skill',
    title: meta.title || 'Untitled skill',
    summary: meta.summary || '',
    tags,
    body: body.trim()
  };
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
