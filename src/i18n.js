/* ==========================================================================
   FlowLab — user interface languages.
   Every text has a neutral id (L('ui.newClass'), L('run.varHasNoValue', { name })).
   The texts live in languages/<code>.json: the files in the repository folder are
   built into the page (they work offline); others can be added to the folder on
   GitHub and are fetched from there when chosen. Missing texts fall back to English.
   Changing language reloads the page, so tables built at startup use the new language.
   ========================================================================== */
'use strict';

const I18n = (() => {
  const REMOTE = 'https://api.github.com/repos/nicvac/flowlab/contents/languages';
  const RAW = 'https://raw.githubusercontent.com/nicvac/flowlab/main/languages/';
  const store = {
    get(k) { try { const v = localStorage.getItem('flowlab:' + k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('flowlab:' + k, JSON.stringify(v)); } catch (e) { /* storage not available */ } },
  };
  // languages built into the page (languages/*.json), plus those downloaded from GitHub
  const packs = Object.assign({}, typeof LANGUAGES !== 'undefined' ? LANGUAGES : {});
  // in Node the language files are read from the folder
  if (typeof LANGUAGES === 'undefined' && typeof require !== 'undefined' && typeof window === 'undefined') {
    try {
      const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '..', 'languages');
      for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) packs[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch (e) { /* no language files */ }
  }
  if (typeof window !== 'undefined') for (const code of store.get('langs') || []) { const p = store.get('langpack:' + code); if (p && !packs[code]) packs[code] = p; }
  const EN = packs.en || { strings: {}, keys: {}, shortcuts: {}, code: {} };
  let lang = 'en';
  if (typeof window !== 'undefined') {
    const saved = store.get('uiLanguage');
    if (saved && packs[saved]) lang = saved;
    else {
      // the first time: the first browser language that FlowLab has, otherwise English
      const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
      const hit = prefs.map((l) => String(l).toLowerCase().split('-')[0]).find((l) => packs[l]);
      lang = hit || 'en';
    }
  } else lang = packs.it && typeof process !== 'undefined' && process.env.FLOWLAB_LANG ? process.env.FLOWLAB_LANG : 'en';
  if (!packs[lang]) lang = 'en';
  const P = packs[lang] || EN;
  const missing = new Set();
  const fill = (text, params) => (params ? text.replace(/\{(\w+)\}/g, (m, k) => (params[k] === undefined ? m : String(params[k]))) : text);
  /* text of an id: in the chosen language, otherwise in English, otherwise the id itself */
  function L(id, params) {
    let text = P.strings && P.strings[id];
    if (text == null) { missing.add(id); text = EN.strings[id]; }
    return fill(text == null ? id : text, params);
  }
  /* section of the language file (keys, shortcuts, code): value of a name, English as fallback */
  const part = (sec) => (name, params) => {
    const v = (P[sec] && P[sec][name] != null ? P[sec][name] : EN[sec] && EN[sec][name]);
    return v == null ? name : fill(v, params);
  };
  const code = part('code');
  /* key names in texts built by the program: Shift+K → Maiusc+K */
  function keys(t) {
    if (t == null || !P.keys) return t;
    return String(t).replace(/\b(Shift|Enter|Del|Esc|Tab|PgDn|PgUp|wheel)\b/g, (m) => P.keys[m] || m);
  }
  /* letter of the keyboard shortcut of a block kind (declare → D) */
  const shortcut = (kind) => (P.shortcuts && P.shortcuts[kind]) || (EN.shortcuts && EN.shortcuts[kind]) || '';
  /* languages to offer: built in, downloaded, and (when asked) those listed on GitHub */
  const available = () => Object.entries(packs).map(([c, p]) => ({ code: c, name: p.name || c })).sort((a, b) => a.name.localeCompare(b.name));
  async function remote() {
    const r = await fetch(REMOTE, { cache: 'no-cache' });
    if (!r.ok) throw new Error('GitHub ' + r.status);
    return (await r.json()).filter((f) => /^[a-z]{2,3}(-[a-z]+)?\.json$/i.test(f.name)).map((f) => f.name.replace(/\.json$/i, ''));
  }
  async function set(code) {
    if (!packs[code]) {
      const r = await fetch(RAW + code + '.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('GitHub ' + r.status);
      const p = await r.json();
      if (!p || typeof p.strings !== 'object') throw new Error('not a FlowLab language file');
      store.set('langpack:' + code, p);
      store.set('langs', [...new Set([...(store.get('langs') || []), code])]);
    }
    store.set('uiLanguage', code);
    location.reload();
  }
  /* fixed texts of the page (body.html): data-t="id" for the text, data-t-title, data-t-aria-label… for attributes */
  function translateDom(root) {
    document.documentElement.lang = lang;
    for (const el of root.querySelectorAll('[data-t]')) el.textContent = L(el.dataset.t);
    for (const a of ['title', 'aria-label', 'placeholder']) {
      for (const el of root.querySelectorAll(`[data-t-${a}]`)) el.setAttribute(a, L(el.getAttribute(`data-t-${a}`)));
    }
  }
  return { get lang() { return lang; }, get name() { return P.name || lang; }, L, code, keys, shortcut, available, remote, set, translateDom, missing, packs };
})();
const L = I18n.L;
// in Node (tests and tools): English, or FLOWLAB_LANG
if (typeof module !== 'undefined') { module.exports = I18n; global.I18n = I18n; global.L = L; }
