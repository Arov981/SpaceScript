# Changelog

All notable changes to SpaceScript are documented here.

SpaceScript follows [Semantic Versioning](https://semver.org/).

## [Unreleased] / 1.0.0

### Added — Core
- Original browser extension (Manifest V3) with a per-site adapter system and an injectable "SpaceScript" control bar.
- Original local bridge (Node.js) speaking the SpaceScript Control Protocol (SCP) over WebSocket and exposing a small HTTP API + web dashboard.
- MCP client that connects to Roblox Studio's built-in MCP server and translates SCP tool calls into MCP calls.
- Persistent on-place project memory (key/value store written into the place, survives across sessions).

### Added — SpaceForge Skills
Seven original Luau game-development skill packs, all written from scratch:
1. Combat & VFX
2. NPC AI & Bosses
3. Economy & Progression Loops
4. Data Architecture (Networking, DataStore, Module layout)
5. Lighting & Spatial Audio
6. Performance Tuning
7. SpaceForge Starter Preset Pack (one-click game templates)

### Added — Desktop Dashboard
- Web dashboard served by the bridge at `http://localhost:6471`.
- Live activity inspector, session log, skill browser, and a one-click "apply skill" launcher.
- Emerald / graphite glassmorphism theme.

### Added — Launchers
- `start.bat` for Windows (auto-installs Node if missing).
- `start.command` for macOS.

### Added — Docs
- `docs/PROTOCOL.md` — full SCP spec.
- `docs/PROVIDERS.md` — supported AI providers and known quirks.
- `docs/SETUP.md` — step-by-step install.

### License
- Released under the **MIT License**. No third-party attribution required. See `ATTRIBUTION.md`.
