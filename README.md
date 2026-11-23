# SpaceScript

**Turn any AI chat into a Roblox Studio agent. Zero API keys. Zero credits. Zero limits.**

SpaceScript is a free, open-source bridge that lets you drive Roblox Studio from a normal AI chat (DeepSeek, ChatGPT, Gemini, Claude, Grok, Mistral, Kimi, GLM, Qwen, Arena, Meta AI, and more). You type what you want to build in plain language; the AI reads and edits your scripts, runs Luau, inspects the game tree, inserts assets, controls play-testing, and remembers your project across sessions — all from the browser tab you already use.

No API key. No terminal. No coding required. No attribution required.

```
AI chat (in your browser)  ->  SpaceScript Extension  ->  SpaceScript Bridge (your PC)  ->  Roblox Studio (MCP)
```

---

## Why SpaceScript

SpaceScript was built from a blank page. It is a **clean-room implementation**: the only thing it shares with other Roblox AI-bridge tools is the *idea* (browser extension + local bridge + Studio MCP). Every line of code, every UI element, every command name, every skill document, and the entire protocol were written from scratch. It ships under the **MIT License**, so you can use it, fork it, ship it inside a paid product, and **never credit anyone**.

| | SpaceScript |
|---|---|
| License | MIT (permissive, no copyleft, no attribution) |
| Bridge runtime | Node.js (cross-platform, no Python install) |
| Extension | Manifest V3 (Chrome / Edge / Brave) |
| Protocol | SpaceScript Control Protocol (SCP) — original JSON-over-WS |
| Desktop dashboard | Web UI served by the bridge (any browser) |
| Skills | SpaceForge Skills — 7 original Luau game-dev skill packs |

---

## How it works

1. **The extension** lives inside supported AI chat pages. It injects a small "SpaceScript" control bar above the chat composer.
2. **The bridge** is a tiny local server you run on your PC (`start.bat` on Windows, `start.command` on macOS). It opens a WebSocket the extension connects to.
3. **Roblox Studio** exposes its built-in MCP server. The bridge talks MCP to Studio and translates commands to and from the AI.
4. When you click **Start session** and type a request, the AI emits SpaceScript tool calls inside its replies. The extension routes them to the bridge, the bridge runs them against Studio, and the results are posted back into the chat for the AI to keep working.

---

## Quick start

### 1. Load the extension

- Go to `edge://extensions` (Edge) or `chrome://extensions` (Chrome / Brave).
- Turn on **Developer mode**.
- Click **Load unpacked** and select the `spacescript-extension` folder.

### 2. Enable Studio as an MCP server

Open Roblox Studio, load a place, then:
- Top bar → **Assistant AI** → `...` → **Manage MCP Servers** → **Enable Studio as MCP Server**.

### 3. Run the bridge

- **Windows:** double-click `start.bat`.
- **macOS:** double-click `start.command`. The first run shows a security warning (normal for any downloaded script); click **Done**, then **System Settings → Privacy & Security → Open Anyway**.

A small dashboard window opens — that means the bridge is running. You can also open the dashboard at `http://localhost:6471` in any browser.

### 4. Start a session

Open any supported AI chat site, start a new chat, and click **Start session** on the SpaceScript bar. Then just describe what you want to build.

---

## What the AI can do

- Read and write any Script / LocalScript / ModuleScript
- Run Luau snippets directly inside Studio
- Walk the game tree (list, find, create, rename, delete instances)
- Insert models, meshes, and assets from the Creator Store
- Capture Studio screenshots and feed them back to vision-capable AIs
- Start / stop play-testing
- Remember your project across sessions with persistent on-place memory
- Apply a **SpaceForge Skill** (Combat & VFX, NPC AI & Bosses, Economy & Progression, Data Architecture, Lighting & Audio, Performance Tuning) in one click

---
## Status dots

| Dot | Meaning |
|---|---|
| Green | Bridge + Studio ready (a place is open) |
| Amber | Bridge is up but Studio isn't ready yet — open a place or enable MCP |
| Grey | Bridge offline — run the launcher |

---
## Requirements

- Windows 10/11 or macOS 12+
- Roblox Studio with MCP support
- Chrome, Edge, or Brave (Chromium 110+)
- Node.js 18+ (download from nodejs.org, or let `start.bat` install it for you on Windows)

---
## Repository layout

```
SpaceScript/
├── README.md               You are here
├── LICENSE                  MIT
├── DESIGN.md                Clean-room provenance + architecture
├── ATTRIBUTION.md           Third-party attribution statement
├── CHANGELOG.md
├── config.json              Bridge configuration
├── package.json
├── start.bat                Windows launcher
├── start.command            macOS launcher
├── bridge/                  Local bridge server (Node.js)
├── spacescript-extension/   Browser extension (MV3)
├── skills/                  SpaceForge Skills (original Luau dev skill packs)
├── desktop-ui/              Web dashboard served by the bridge
└── docs/                    PROTOCOL, PROVIDERS, SETUP
```

---
## License

MIT — see [LICENSE](LICENSE). Use it freely, including in closed-source commercial products. No attribution required.

See [ATTRIBUTION.md](ATTRIBUTION.md) for the full third-party attribution statement (short version: none required).
