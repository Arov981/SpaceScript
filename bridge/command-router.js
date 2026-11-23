//
// SpaceScript command router.
// Maps SCP tool calls to either a local handler (skills, memory, status)
// or a forwarded MCP call against Roblox Studio.
//
export class CommandRouter {
  constructor({ mcp, skills, memory, aliases }) {
    this.mcp = mcp;
    this.skills = skills;
    this.memory = memory;
    this.aliases = aliases || {};
  }

  async handle(tool, params, id) {
    // --- Local tools (never forwarded to MCP) ---
    switch (tool) {
      case 'skill.list':
        return this.skills.list();
      case 'skill.get':
        return this.skills.get(params.id);
      case 'skill.apply': {
        const s = this.skills.get(params.id);
        if (!s) throw new Error('unknown skill: ' + params.id);
        return { id: s.id, title: s.title, prompt: s.body, tags: s.tags };
      }
      case 'project.memory.get':
        return this.memory.get(params.key);
      case 'project.memory.set':
        await this.memory.set(params.key, params.value);
        return { ok: true };
      case 'project.memory.all':
        return this.memory.all();
      case 'system.status':
        return { studio: this.mcp.ready, tools: this.mcp.tools.map(t => t.name) };
      default:
        break;
    }

    // --- MCP-forwarded tools ---
    const mcpName = this.aliases[tool] || tool;
    if (!this.mcp.ready) throw new Error('Roblox Studio MCP is not ready');
    return await this.mcp.callTool(mcpName, params);
  }
}
