#!/usr/bin/env node
//
// SpaceScript Bridge — entry point.
// Wires together the MCP client, HTTP/WebSocket server, command router,
// skills loader, and persistent project memory.
//
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

import { createHttpServer } from './http-server.js';
import { McpClient } from './mcp-client.js';
import { CommandRouter } from './command-router.js';
import { SkillsLoader } from './skills-loader.js';
import { ProjectMemory } from './project-memory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadConfig() {
  return JSON.parse(readFileSync(join(root, 'config.json'), 'utf8'));
}

function banner(cfg) {
  const line = '─'.repeat(56);
  console.log('\n' + line);
  console.log('  SpaceScript Bridge              v' + cfg.version);
  console.log(line);
  console.log('  dashboard   http://' + cfg.bridge.host + ':' + cfg.bridge.port);
  console.log('  mcp         ' + (cfg.mcp.endpoint || '(auto-discovery)'));
  console.log('  skills      ' + cfg.skills.dir);
  console.log(line + '\n');
}

async function main() {
  const cfg = loadConfig();
  banner(cfg);

  const memory = new ProjectMemory(root, cfg.memory);
  await memory.init();

  const skills = new SkillsLoader(join(root, cfg.skills.dir));
  await skills.init();
  console.log('  loaded ' + skills.list().length + ' SpaceForge skills');

  const mcp = new McpClient(cfg.mcp);
  const router = new CommandRouter({ mcp, skills, memory, aliases: cfg.toolAliases });

  const server = createHttpServer({ cfg, root, router, skills, memory, mcp });

  mcp.on('status', (level, msg) => server.broadcast({ type: 'status', level, msg }));

  server.listen(cfg.bridge.port, cfg.bridge.host, () => {
    console.log('  bridge listening on http://%s:%s\n', cfg.bridge.host, cfg.bridge.port);
    mcp.connect().catch(err => console.error('  mcp connect failed:', err.message));
  });
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
