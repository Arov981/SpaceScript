//
// SpaceScript content script.
// Injects the SpaceScript control bar into supported AI chat sites, watches
// the transcript for ```spacescript tool-call blocks, routes them to the
// bridge via the service worker, and posts the results back into the chat.
//
(() => {
  'use strict';

  const SYSTEM_PROMPT =
    'SpaceScript v1.0.0 — You are operating Roblox Studio through the SpaceScript bridge. ' +
    'To call a tool, emit a fenced code block tagged `spacescript` containing a single JSON object: ' +
    '{"tool":"<name>","params":{...}}. Wait for the result message before continuing. ' +
    'Available tools include studio.read_script, studio.write_script, studio.run_luau, ' +
    'studio.screenshot, tree.list, tree.find, tree.create, tree.delete, assets.insert, ' +
    'playtest.start, playtest.stop, project.memory.get, project.memory.set, ' +
    'skill.list, skill.get, skill.apply, system.status. ' +
    'Make one tool call per turn unless batching is clearly required. ' +
    'Prefer readable Luau and idiomatic Roblox patterns.';

  const TOOL_RE = /```spacescript\s*\n([\s\S]*?)```/gi;

  const state = { active: false, primed: false, lastSignature: '', inFlight: false };
  let barRoot = null;
  let observer = null;
  let lastUrl = location.href;

  // ---------------- Boot ----------------
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectBar);
  else injectBar();
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      state.primed = false;
      setTimeout(injectBar, 800);
    }
  }, 1500);

  // ---------------- UI ----------------
  function injectBar() {
    if (document.getElementById('spacescript-bar')) return;
    const anchor = findBarAnchor();
    if (!anchor) { setTimeout(injectBar, 1200); return; }

    barRoot = document.createElement('div');
    barRoot.id = 'spacescript-bar';
    barRoot.innerHTML = `
      <span class="ss-dot" data-level="grey"></span>
      <span class="ss-title">SpaceScript</span>
      <button class="ss-btn ss-start" type="button">Start session</button>
      <button class="ss-btn ss-new" type="button">+ New agent chat</button>
      <select class="ss-skill" title="Apply a SpaceForge skill">
        <option value="">Skills…</option>
      </select>
      <span class="ss-msg">Checking bridge…</span>
    `;
    anchor.parentElement.insertBefore(barRoot, anchor);

    barRoot.querySelector('.ss-start').addEventListener('click', onStart);
    barRoot.querySelector('.ss-new').addEventListener('click', onNewChat);
    const sel = barRoot.querySelector('.ss-skill');
    sel.addEventListener('change', (e) => { if (e.target.value) applySkill(e.target.value); e.target.value = ''; });

    refreshStatus();
    loadSkills(sel);
    observeTranscript();
  }

  function findBarAnchor() {
    const composer = findComposer();
    if (!composer) return null;
    return composer.closest('form') || composer.parentElement;
  }

  function findComposer() {
    return document.querySelector(
      'div[contenteditable="true"][role="textbox"], ' +
      'div[contenteditable="true"], ' +
      'textarea'
    );
  }

  function findSendButton() {
    const composer = findComposer();
    const form = composer && composer.closest('form');
    if (form) {
      const b = form.querySelector('button[type="submit"], button:last-of-type');
      if (b && b.offsetParent !== null) return b;
    }
    const btns = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
    return btns[btns.length - 1] || null;
  }

  // ---------------- Session ----------------
  async function onStart() {
    if (state.active) { stopSession(); return; }
    const health = await sendBg({ kind: 'health' });
    if (!health || !health.ok) { setMsg('Bridge offline — run start.bat / start.command'); return; }
    state.active = true;
    barRoot.querySelector('.ss-start').textContent = 'Stop session';
    setMsg('Session active');
    if (!state.primed) {
      state.primed = true;
      await typeAndSend(SYSTEM_PROMPT);
    }
  }

  function stopSession() {
    state.active = false;
    if (barRoot) barRoot.querySelector('.ss-start').textContent = 'Start session';
    setMsg('Session stopped');
  }

  function onNewChat() {
    const btn = document.querySelector('a[href*="new" i], button[aria-label*="new chat" i], button[aria-label*="new" i]');
    if (btn) btn.click(); else location.href = location.pathname;
    state.primed = false;
  }

  // ---------------- Transcript watcher ----------------
  function observeTranscript() {
    if (observer) return;
    observer = new MutationObserver(() => { if (state.active && !state.inFlight) scanReplies(); });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function scanReplies() {
    const blocks = document.querySelectorAll(
      'article, [data-message-author-role="assistant"], div[class*="message" i], [role="article"]'
    );
    if (!blocks.length) return;
    const last = blocks[blocks.length - 1];
    const text = last.innerText || '';
    if (!text || text === state.lastSignature) return;
    const matches = [...text.matchAll(TOOL_RE)];
    if (!matches.length) return;
    state.lastSignature = text;
    state.inFlight = true;
    handleToolCalls(last, matches).finally(() => { state.inFlight = false; });
  }

  async function handleToolCalls(replyEl, matches) {
    for (const m of matches) {
      let call;
      try { call = JSON.parse(m[1].trim()); } catch { continue; }
      renderChip(replyEl, call.tool, 'running');
      const res = await sendBg({ kind: 'scp', tool: call.tool, params: call.params || {} });
      if (res && res.ok) {
        renderChip(replyEl, call.tool, 'ok');
        await typeAndSend(formatResult(call, res.data));
      } else {
        renderChip(replyEl, call.tool, 'err');
        await typeAndSend('[SpaceScript] ' + call.tool + ' failed: ' + (res ? res.error : 'unknown error'));
      }
    }
  }

  function formatResult(call, data) {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    return '[SpaceScript result for ' + call.tool + ']\n' + body;
  }

  function renderChip(replyEl, tool, status) {
    const chip = document.createElement('span');
    chip.className = 'ss-chip ss-chip-' + status;
    chip.textContent = tool;
    replyEl.appendChild(chip);
  }

  // ---------------- Composer typing ----------------
  async function typeAndSend(text) {
    const composer = findComposer();
    if (!composer) return;
    composer.focus();
    await sleep(60);
    const tag = composer.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') {
      const proto = tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set;
      if (setter) setter.call(composer, text); else composer.value = text;
      composer.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      try { document.execCommand('selectAll'); } catch {}
      const ok = document.execCommand('insertText', false, text);
      if (!ok) {
        composer.textContent = text;
        composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      }
    }
    await sleep(140);
    const btn = findSendButton();
    if (btn) btn.click();
  }

  // ---------------- Skills ----------------
  async function loadSkills(sel) {
    try {
      const res = await fetch('http://127.0.0.1:6471/api/skills');
      const skills = await res.json();
      for (const s of skills) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.title;
        sel.appendChild(opt);
      }
    } catch { /* bridge offline — skills will populate once it's up */ }
  }

  async function applySkill(id) {
    const res = await sendBg({ kind: 'scp', tool: 'skill.apply', params: { id } });
    if (res && res.ok) {
      await typeAndSend('[SpaceScript skill: ' + res.data.title + ']\n' + res.data.prompt);
    } else {
      setMsg('Skill failed: ' + (res ? res.error : 'unknown'));
    }
  }

  // ---------------- Helpers ----------------
  function sendBg(msg) {
    return new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => resolve(r)));
  }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function setMsg(t) { const m = barRoot && barRoot.querySelector('.ss-msg'); if (m) m.textContent = t; }

  function refreshStatus() {
    sendBg({ kind: 'status' }).then((r) => {
      if (!r || !r.ok) return;
      const dot = barRoot && barRoot.querySelector('.ss-dot');
      if (dot) dot.dataset.level = r.status.level;
      setMsg(r.status.msg);
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.kind === 'status') {
      const dot = barRoot && barRoot.querySelector('.ss-dot');
      if (dot) dot.dataset.level = msg.level;
      setMsg(msg.msg);
    }
  });
})();
