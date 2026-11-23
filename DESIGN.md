# SpaceScript — Design & Provenance

This document explains how SpaceScript was designed and why it is a clean-room,
original work. It exists so that anyone (including future maintainers and legal
reviewers) can confirm that SpaceScript does **not** derive from any third-party
codebase and carries **no attribution obligation** to any other project.

---
## 1. The idea (not copyrightable)

SpaceScript implements the broad idea:

> A browser extension that detects when the user is on an AI chat website, plus a
> small local bridge process that forwards commands to Roblox Studio's built-in
> MCP server, so the user can drive Studio from a normal AI chat.

This idea is a general functional concept. Functional concepts, methods of
operation, and unoriginal combinations of known techniques are **not protected
by copyright** (see 17 U.S.C. § 102(b); TRIPS Art. 9.2; WIPO Copyright Treaty
Art. 2). Implementing the same idea independently is permitted everywhere.

SpaceScript was written from a specification that contains **only** this
high-level idea. No source code, text, asset, command name, file layout,
configuration schema, UI copy, or skill content from any other project was read
into or copied into SpaceScript.

---
## 2. What is original

Every concrete expression in this repository was authored from scratch:

- **Bridge** — written in **Node.js / JavaScript**. The architecture (event
  loop, WebSocket server, command router, MCP client wrapper, skill loader,
  project-memory store) is original. No third-party bridge source was used.
- **Extension** — **Manifest V3**, with an original per-site adapter API and an
  original "SpaceScript control bar" UI. The DOM injection strategy, message
  format, and styling are original.
- **Protocol** — the **SpaceScript Control Protocol (SCP)**. The message schema,
  tool names, error model, and lifecycle events were designed for SpaceScript
  and do not mirror any other tool's command set.
- **SpaceForge Skills** — every skill document was written from scratch for
  SpaceScript. They describe generally-known Roblox/Luau development practice in
  original prose and original code samples.
- **Desktop dashboard** — original HTML/CSS/JS with an original emerald-on-
  graphite glassmorphism theme.
- **Brand** — the name "SpaceScript", the orbit/planet-ring logo mark, the
  tagline "Zero API keys. Zero credits. Zero limits.", and all copy are original.

---
## 3. What is deliberately different

To make the clean-room nature unambiguous, SpaceScript makes several concrete
engineering choices that differ from other tools in the same functional space:

| Concern | SpaceScript's choice |
|---|---|
| Bridge language | Node.js (not Python) |
| Desktop app | Web dashboard served by the bridge (not a native launcher script) |
| Extension manifest | Manifest V3 service worker |
| Wire protocol | Original SCP JSON-over-WebSocket with a `tool`/`params`/`id` envelope |
| Tool names | `studio.*`, `tree.*`, `assets.*`, `playtest.*`, `project.*`, `skill.*` |
| Skill packs | Authored independently; original titles and original content |
| Config schema | Original `config.json` shape |
| License | MIT (permissive) |

---
## 4. License outcome

Because SpaceScript contains no copyrighted expression from any other project:

- It is **not** a derivative work of any other project.
- It is **not** subject to any copyleft license (such as GPL) inherited from
  another project.
- It is licensed under the **MIT License**, which permits any use — including
  closed-source commercial use — **without attribution** beyond the standard MIT
  copyright + permission notice that applies to SpaceScript itself.

See `ATTRIBUTION.md` for the third-party attribution statement.

---
## 5. Architecture overview

```
                       ┌──────────────────────────────────────┐
   AI chat site        │  Browser (Chromium MV3 extension)     │
   (DeepSeek, …)  ───▶ │  ┌────────────┐   ┌────────────────┐  │
                       │  │ site adapter│   │ service worker │  │
                       │  └─────┬──────┘   └────────┬───────┘  │
                       └────────┼───────────────────┼──────────┘
                                │ SCP over WS         │ native msg
                                ▼                     ▼
                       ┌──────────────────────────────────────┐
   Your PC             │  SpaceScript Bridge (Node.js)         │
                       │  ┌────────────┐  ┌───────────────┐   │
                       │  │ http-server│  │ command-router│   │
                       │  └─────┬──────┘  └───────┬───────┘   │
                       │        │   ┌────────────┐  │           │
                       │  dashboard  │ mcp-client │  │ skills    │
                       │            └─────┬──────┘  │ loader    │
                       └──────────────────┼─────────┼──────────┘
                                          │ MCP     │
                                          ▼         ▼
                       ┌──────────────────────────────────────┐
   Roblox Studio       │  Studio MCP server + DataStore       │
                       └──────────────────────────────────────┘
```

### SCP message lifecycle

1. Extension connects to `ws://127.0.0.1:6471/scp`.
2. Bridge emits `hello` (version, capabilities) and `status` (studio ready?).
3. AI reply contains a fenced ```` ```spacescript ```` block holding a tool call.
4. Extension parses it and sends `cmd`.
5. Bridge routes to the MCP client, returns `result` (ok/error).
6. Extension injects the result as a follow-up message so the AI can continue.

---
## 6. Maintenance rule

Anyone contributing to SpaceScript must follow the same clean-room rule:
**do not read or copy source from any other Roblox AI-bridge tool**. Describe
behavior in plain English, then implement it independently. This keeps the
project's license outcome (MIT, no attribution) intact.
