/* ==========================================================================
   FlowLab — Motore & Gestore Centrale dei Plugin (src/plugins.js)
   Questo file contiene SOLO il sistema di gestione dei plugin:
   - Registro dei plugin (`FlowLabPlugins.register(...)`)
   - Persistenza dello stato `{ installed, enabled }` e dei plugin custom (`.js`)
   - Finestra di dialogo «Plugin di FlowLab»
   - Barra rapida in basso a destra (`#pluginDock`)
   - Servizio condiviso di esecuzione headless (`ctx.runHeadless`) con supporto
     completo a:
     • Esecuzione di singole funzioni o metodi con parametri (anche da moduli)
     • Vettori e matrici 1D/2D/3D (`{1, 2, 3}` o `[1, 2, 3]`)
     • Strutture dati (`ArrayList<T>`, `Stack<T>`, `Queue<T>`) e oggetti OOP
     • Valori di ritorno (singoli, multipli, array) e modifiche in-place sui vettori
   ========================================================================== */
'use strict';

const Plugins = (() => {
  const PLUGIN_STORE_KEY = 'flowlab:plugins:v5';
  const CUSTOM_PLUGIN_STORE_KEY = 'flowlab:customPlugins';
  const ICON_DEFAULT_SVG = '<svg viewBox="0 0 24 24"><path d="M9 3v4M15 3v4M7 7h10a2 2 0 0 1 2 2v3a7 7 0 0 1-14 0V9a2 2 0 0 1 2-2zM12 19v3"/></svg>';

  const pluginRegistry = new Map();
  let uiHelpers = null;
  let initialized = false;

  const $ = (s, el) => (el || document).querySelector(s);

  /* ==========================================================================
     1. STATO E REGISTRO DEI PLUGIN
     ========================================================================== */
  function loadPluginStates() {
    try {
      const raw = localStorage.getItem(PLUGIN_STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) { /* storage unavailable */ }
    return {};
  }

  function savePluginStates(states) {
    try {
      localStorage.setItem(PLUGIN_STORE_KEY, JSON.stringify(states));
    } catch (e) { /* storage unavailable */ }
  }

  function getPluginState(id) {
    const p = pluginRegistry.get(id);
    const states = loadPluginStates();
    if (states[id] && typeof states[id] === 'object') {
      return {
        installed: states[id].installed !== undefined ? !!states[id].installed : (p ? !!p.defaultInstalled : true),
        enabled: states[id].enabled !== undefined ? !!states[id].enabled : (p ? !!p.defaultEnabled : true)
      };
    }
    return {
      installed: p ? !!p.defaultInstalled : true,
      enabled: p ? !!p.defaultEnabled : true
    };
  }

  function setPluginState(id, patch) {
    const cur = getPluginState(id);
    const next = {
      installed: patch.installed !== undefined ? !!patch.installed : cur.installed,
      enabled: patch.enabled !== undefined ? !!patch.enabled : cur.enabled
    };
    if (!next.installed) next.enabled = false;
    const states = loadPluginStates();
    states[id] = next;
    savePluginStates(states);
    applyPluginState(id);
    renderDock();
    return next;
  }

  function getPluginContext() {
    return {
      get flowlab() { return window.FlowLab; },
      get prog() { return window.FlowLab && window.FlowLab.state && window.FlowLab.state.prog; },
      ui: uiHelpers,
      runHeadless: runProgramHeadless,
      formatCell: formatRuntimeCell,
      L: typeof L === 'function' ? L : (k) => k
    };
  }

  function applyPluginState(id) {
    const p = pluginRegistry.get(id);
    if (!p || !initialized) return;
    const st = getPluginState(id);
    const active = st.installed && st.enabled;
    const ctx = getPluginContext();
    if (active) {
      if (!p._inited && typeof p.onInit === 'function') {
        p._inited = true;
        p.onInit(ctx);
      }
      if (typeof p.onEnable === 'function') p.onEnable(ctx);
    } else {
      if (typeof p.onDisable === 'function') p.onDisable(ctx);
    }
  }

  /* Barra rapida in basso a destra (#pluginDock) per i plugin attivi */
  function renderDock() {
    const dock = $('#pluginDock');
    if (!dock) return;
    dock.innerHTML = '';
    let count = 0;

    for (const p of pluginRegistry.values()) {
      if (!p.showInDock) continue;
      const st = getPluginState(p.id);
      if (!st.installed || !st.enabled) continue;
      count++;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'plug-fab';
      btn.id = p.dockBtnId || `plugDockBtn_${p.id}`;
      const fullTitle = p.getName();
      const shortTxt = p.getShortLabel();
      btn.title = fullTitle;
      btn.setAttribute('aria-label', fullTitle);
      btn.innerHTML = `${p.iconSvg || ICON_DEFAULT_SVG}<span class="plug-fab-lbl">${shortTxt}</span>`;
      btn.addEventListener('click', () => {
        if (typeof p.onOpen === 'function') p.onOpen(getPluginContext());
      });
      dock.appendChild(btn);
    }
    dock.hidden = count === 0;
  }

  let loadingCustomFromStorage = false;

  function registerPlugin(def) {
    if (!def || !def.id) throw new Error('Plugin id is required');
    const id = String(def.id);
    if (loadingCustomFromStorage && pluginRegistry.has(id) && pluginRegistry.get(id).preinstalled) {
      return pluginRegistry.get(id);
    }
    const plugin = {
      id,
      getName: typeof def.getName === 'function' ? def.getName : () => def.name || def.id,
      getDesc: typeof def.getDesc === 'function' ? def.getDesc : () => def.description || def.desc || '',
      getShortLabel: typeof def.getShortLabel === 'function'
        ? def.getShortLabel
        : () => def.shortLabel || (def.dock && def.dock.label) || def.name || def.id,
      version: def.version || '1.0',
      author: def.author || 'FlowLab',
      icon: def.icon || '',
      iconSvg: def.iconSvg || (def.dock && def.dock.iconSvg) || '',
      showInDock: def.showInDock !== undefined ? !!def.showInDock : !!(def.shortLabel || def.dock),
      dockBtnId: def.dockBtnId || '',
      preinstalled: !!def.preinstalled,
      defaultInstalled: def.defaultInstalled !== undefined ? !!def.defaultInstalled : true,
      defaultEnabled: def.defaultEnabled !== undefined ? !!def.defaultEnabled : true,
      onInit: def.onInit || null,
      onEnable: def.onEnable || null,
      onDisable: def.onDisable || null,
      onOpen: def.onOpen || null,
      _inited: false
    };
    pluginRegistry.set(plugin.id, plugin);
    if (initialized) {
      applyPluginState(plugin.id);
      renderDock();
    }
    return plugin;
  }

  function loadCustomPluginsFromStorage() {
    try {
      const raw = localStorage.getItem(CUSTOM_PLUGIN_STORE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return;
      loadingCustomFromStorage = true;
      for (const item of list) {
        if (item && item.code) {
          try {
            // eslint-disable-next-line no-new-func
            new Function('FlowLabPlugins', 'FlowLab', item.code)(window.FlowLabPlugins, window.FlowLab);
          } catch (e) { /* ignore broken custom plugin at startup */ }
        }
      }
    } catch (e) { /* ignore */ } finally {
      loadingCustomFromStorage = false;
    }
  }

  function saveCustomPluginSource(name, code) {
    try {
      const raw = localStorage.getItem(CUSTOM_PLUGIN_STORE_KEY);
      const list = Array.isArray(raw ? JSON.parse(raw) : null) ? JSON.parse(raw) : [];
      const filtered = list.filter((x) => x && x.name !== name);
      filtered.push({ name, code });
      localStorage.setItem(CUSTOM_PLUGIN_STORE_KEY, JSON.stringify(filtered));
    } catch (e) { /* ignore */ }
  }

  /* ==========================================================================
     2. FINESTRA DI DIALOGO «PLUGIN DI FLOWLAB»
     ========================================================================== */
  function openPluginDialog() {
    if (!uiHelpers || !uiHelpers.openModal || !uiHelpers.h) return;
    const { openModal, h, toast } = uiHelpers;
    let closeIt = null;

    const installedBox = h('div', { class: 'plug-list', id: 'installedPluginsList' });
    const catalogBox = h('div', { class: 'plug-list', id: 'availablePluginsList' });

    const makeIcon = (p) => {
      const iconUrl = typeof p.icon === 'function' ? p.icon() : p.icon;
      if (iconUrl) {
        return h('div', { class: 'plug-icon' }, h('img', { src: iconUrl, alt: '', draggable: 'false' }));
      }
      if (p.iconSvg) {
        return h('div', { class: 'plug-icon plug-icon-svg', html: p.iconSvg });
      }
      return h('div', { class: 'plug-icon plug-icon-svg', html: ICON_DEFAULT_SVG });
    };

    const draw = () => {
      installedBox.innerHTML = '';
      catalogBox.innerHTML = '';

      const allPlugins = [...pluginRegistry.values()];
      const installed = allPlugins.filter((p) => getPluginState(p.id).installed);
      const available = allPlugins.filter((p) => !getPluginState(p.id).installed);

      if (!installed.length) {
        installedBox.append(h('p', { class: 'plug-empty muted small' }, L('pa.noInstalledPlugins')));
      } else {
        for (const p of installed) {
          const st = getPluginState(p.id);
          const name = p.getName();
          const chk = h('input', {
            type: 'checkbox',
            class: 'plug-checkbox',
            'aria-label': L('pa.toggleAria', { name }),
            checked: st.enabled ? 'checked' : null
          });
          chk.checked = st.enabled;
          chk.addEventListener('change', () => {
            const next = setPluginState(p.id, { enabled: chk.checked });
            if (toast) toast(next.enabled ? L('pa.pluginEnabledToast', { name }) : L('pa.pluginDisabledToast', { name }), 'ok');
            draw();
          });

          const statusBadge = h('span', { class: 'plug-badge ' + (st.enabled ? 'on' : 'off') },
            st.enabled ? L('pa.badgeActive') : L('pa.badgeDisabled'));
          const preBadge = p.preinstalled ? h('span', { class: 'ptag' }, L('pa.badgePreinstalled')) : null;

          const openBtn = st.enabled && typeof p.onOpen === 'function'
            ? h('button', {
                type: 'button',
                class: 'btn small',
                onclick: () => { if (closeIt) closeIt(); p.onOpen(getPluginContext()); }
              }, L('pa.openPlugin'))
            : null;

          const removeBtn = h('button', {
            type: 'button',
            class: 'btn small danger plug-remove',
            onclick: () => {
              setPluginState(p.id, { installed: false, enabled: false });
              if (toast) toast(L('pa.pluginRemovedToast', { name }), 'ok');
              draw();
            }
          }, L('pa.removePlugin'));

          const card = h('div', { class: 'plug-card' + (st.enabled ? ' active' : ' disabled'), 'data-plugin-id': p.id },
            h('label', { class: 'plug-check', title: L('pa.toggleAria', { name }) }, chk),
            makeIcon(p),
            h('div', { class: 'plug-info' },
              h('div', { class: 'plug-head' },
                h('strong', { class: 'plug-name' }, name),
                h('span', { class: 'plug-ver mono muted small' }, 'v' + p.version),
                preBadge,
                statusBadge
              ),
              h('p', { class: 'plug-desc muted small' }, p.getDesc())
            ),
            h('div', { class: 'plug-actions' }, openBtn, removeBtn)
          );
          installedBox.append(card);
        }
      }

      if (!available.length) {
        catalogBox.append(h('p', { class: 'plug-empty muted small' }, L('pa.allCatalogInstalled')));
      } else {
        for (const p of available) {
          const name = p.getName();
          const preBadge = p.preinstalled ? h('span', { class: 'ptag' }, L('pa.badgePreinstalled')) : null;
          const installBtn = h('button', {
            type: 'button',
            class: 'btn small primary plug-install',
            onclick: () => {
              setPluginState(p.id, { installed: true, enabled: true });
              if (toast) toast(L('pa.pluginInstalledToast', { name }), 'ok');
              draw();
            }
          }, L('pa.installPlugin'));

          const card = h('div', { class: 'plug-card available', 'data-plugin-id': p.id },
            makeIcon(p),
            h('div', { class: 'plug-info' },
              h('div', { class: 'plug-head' },
                h('strong', { class: 'plug-name' }, name),
                h('span', { class: 'plug-ver mono muted small' }, 'v' + p.version),
                preBadge
              ),
              h('p', { class: 'plug-desc muted small' }, p.getDesc())
            ),
            h('div', { class: 'plug-actions' }, installBtn)
          );
          catalogBox.append(card);
        }
      }
    };

    const executeAndInstallPluginCode = (code, sourceName, onDone) => {
      const beforeIds = new Set(pluginRegistry.keys());
      // eslint-disable-next-line no-new-func
      new Function('FlowLabPlugins', 'FlowLab', code)(window.FlowLabPlugins, window.FlowLab);
      // Cerca il nuovo plugin registrato (o l'ultimo registrato se era un aggiornamento di uno già presente)
      let addedId = [...pluginRegistry.keys()].find((k) => !beforeIds.has(k));
      if (!addedId) {
        const match = code.match(/\bid\s*:\s*['"`]([^'"`]+)['"`]/);
        if (match && pluginRegistry.has(match[1])) addedId = match[1];
      }
      if (addedId) {
        setPluginState(addedId, { installed: true, enabled: true });
        saveCustomPluginSource(sourceName, code);
        const p = pluginRegistry.get(addedId);
        if (toast) toast(L('pa.pluginInstalledToast', { name: p ? p.getName() : addedId }), 'ok');
      } else {
        const cleanName = String(sourceName).replace(/^.*[/:]/, '').replace(/\.js$/i, '') || 'plugin';
        const fallbackId = 'custom-' + cleanName.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
        const p = registerPlugin({
          id: fallbackId,
          name: cleanName,
          description: sourceName,
          version: '1.0',
          defaultInstalled: true,
          defaultEnabled: true
        });
        setPluginState(p.id, { installed: true, enabled: true });
        saveCustomPluginSource(sourceName, code);
        if (toast) toast(L('pa.pluginInstalledToast', { name: p.getName() }), 'ok');
      }
      draw();
      if (typeof onDone === 'function') onDone();
    };

    const importPluginFile = () => {
      const inp = h('input', { type: 'file', accept: '.js,text/javascript,application/javascript', hidden: true });
      inp.addEventListener('change', () => {
        const file = inp.files && inp.files[0];
        if (!file) return;
        const r = new FileReader();
        r.onload = () => {
          try {
            executeAndInstallPluginCode(String(r.result || ''), file.name);
          } catch (err) {
            if (toast) toast(L('pa.pluginFileError', { message: err.message }), 'error');
          }
        };
        r.readAsText(file);
      });
      document.body.append(inp);
      inp.click();
      setTimeout(() => inp.remove(), 60000);
    };

    /* Converte un link GitHub a un file .js in URL raw, oppure estrae { owner, repo, ref, path } se è un repo/cartella */
    const parseGithubPluginTarget = (rawUrlStr) => {
      let s = String(rawUrlStr || '').trim();
      if (!s) return null;
      // Supporta anche la forma breve "owner/repo/path/file.js" o "owner/repo"
      if (!/^https?:\/\//i.test(s) && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.test(s)) {
        const parts = s.replace(/^\/+|\/+$/g, '').split('/');
        if (parts.length === 2) {
          s = `https://github.com/${parts[0]}/${parts[1]}`;
        } else if (parts.length > 2 && /\.js$/i.test(parts[parts.length - 1])) {
          return {
            kind: 'file',
            rawUrl: `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/HEAD/${parts.slice(2).join('/')}`,
            name: parts[parts.length - 1]
          };
        }
      }
      // 1. Link diretto a un file su GitHub (blob o raw)
      let m = s.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)\/(?:blob|raw)\/([^?#]+)$/i);
      if (m) {
        const repo = m[2].replace(/\.git$/i, '');
        const rest = m[3].replace(/[?#].*$/, '');
        const fileName = decodeURIComponent(rest.split('/').pop() || 'plugin.js');
        return {
          kind: 'file',
          rawUrl: `https://raw.githubusercontent.com/${m[1]}/${repo}/${rest}`,
          name: fileName
        };
      }
      // 2. Link già su raw.githubusercontent.com
      m = s.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/\s]+)\/([^/\s]+)\/(.+)$/i);
      if (m) {
        const rest = m[3].replace(/[?#].*$/, '');
        const fileName = decodeURIComponent(rest.split('/').pop() || 'plugin.js');
        return { kind: 'file', rawUrl: s.split(/[?#]/)[0], name: fileName };
      }
      // 3. Link a un GitHub Gist
      m = s.match(/^https?:\/\/gist\.github\.com\/([^/\s]+)\/([0-9a-f]+)(?:\/raw)?\/?$/i);
      if (m) {
        return { kind: 'file', rawUrl: `https://gist.githubusercontent.com/${m[1]}/${m[2]}/raw`, name: `gist-${m[2].slice(0, 7)}.js` };
      }
      // 4. Link a un repository o cartella GitHub: https://github.com/owner/repo[/tree/branch[/folder]]
      m = s.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)(?:\/tree\/([^/\s]+)(?:\/([^?#\s]*))?)?\/?(?:[?#].*)?$/i);
      if (m) {
        return {
          kind: 'repo',
          owner: m[1],
          repo: m[2].replace(/\.git$/i, ''),
          ref: m[3] || 'HEAD',
          path: (m[4] || '').replace(/\/+$/, '')
        };
      }
      // 5. Qualsiasi altro URL diretto a un file .js
      if (/^https?:\/\/.+\.js(?:[?#].*)?$/i.test(s)) {
        const clean = s.split(/[?#]/)[0];
        return { kind: 'file', rawUrl: s, name: decodeURIComponent(clean.split('/').pop() || 'plugin.js') };
      }
      return null;
    };

    const ghUrlInput = h('input', {
      type: 'text',
      id: 'ghPluginUrlInput',
      class: 'mono',
      placeholder: L('pa.ghPluginUrlPh')
    });
    const ghFilesBox = h('div', { class: 'plug-gh-files', hidden: true });

    const downloadAndInstallJsUrl = async (rawUrl, displayName) => {
      if (!/\.js$/i.test(displayName) && !/gist\.githubusercontent\.com/i.test(rawUrl)) {
        if (toast) toast(L('pa.ghMustBeJsFile'), 'warn');
        return;
      }
      if (toast) toast(L('pa.ghDownloadingPlugin', { name: displayName }));
      try {
        const res = await fetch(rawUrl, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const code = await res.text();
        executeAndInstallPluginCode(code, displayName, () => {
          ghUrlInput.value = '';
          ghFilesBox.hidden = true;
          ghFilesBox.innerHTML = '';
        });
      } catch (err) {
        if (toast) toast(L('pa.pluginFileError', { message: err.message }), 'error');
      }
    };

    const importPluginFromGithub = async () => {
      const raw = ghUrlInput.value.trim();
      if (!raw) {
        if (toast) toast(L('pa.ghEmptyUrlWarn'), 'warn');
        return;
      }
      const target = parseGithubPluginTarget(raw);
      if (!target) {
        if (toast) toast(L('pa.ghInvalidUrlWarn'), 'warn');
        return;
      }
      if (target.kind === 'file') {
        await downloadAndInstallJsUrl(target.rawUrl, target.name);
        return;
      }

      // È un repository o una cartella su GitHub: cerchiamo i file .js al suo interno
      ghFilesBox.hidden = false;
      ghFilesBox.innerHTML = '';
      ghFilesBox.append(h('p', { class: 'muted small' }, L('pa.ghSearchingRepo')));

      try {
        const apiUrl = `https://api.github.com/repos/${target.owner}/${target.repo}/git/trees/${encodeURIComponent(target.ref)}?recursive=1`;
        const r = await fetch(apiUrl, { cache: 'no-cache' });
        if (!r.ok) throw new Error(r.status === 404 ? L('pa.ghRepoNotFound') : `GitHub HTTP ${r.status}`);
        const data = await r.json();
        const pre = target.path ? target.path + '/' : '';
        const jsFiles = ((data && data.tree) || [])
          .filter((x) => x.type === 'blob' && /\.js$/i.test(x.path) && x.path.startsWith(pre))
          .map((x) => x.path);

        ghFilesBox.innerHTML = '';
        if (!jsFiles.length) {
          ghFilesBox.append(h('p', { class: 'muted small' }, L('pa.ghNoJsInRepo')));
          return;
        }

        // Se c'è un solo file .js nella repo/cartella indicata, lo installa direttamente!
        if (jsFiles.length === 1) {
          const onlyPath = jsFiles[0];
          const rawFileUrl = `https://raw.githubusercontent.com/${target.owner}/${target.repo}/${target.ref}/${onlyPath.split('/').map(encodeURIComponent).join('/')}`;
          await downloadAndInstallJsUrl(rawFileUrl, onlyPath.split('/').pop());
          return;
        }

        // Se ci sono più file .js nella repo, mostra l'elenco per scegliere quale .js importare
        ghFilesBox.append(h('p', { class: 'small', style: 'margin:0 0 6px;font-weight:600;' },
          L('pa.ghChooseJsFromRepo', { repo: `${target.owner}/${target.repo}`, count: jsFiles.length })));
        for (const p of jsFiles) {
          const fName = p.split('/').pop();
          const rawFileUrl = `https://raw.githubusercontent.com/${target.owner}/${target.repo}/${target.ref}/${p.split('/').map(encodeURIComponent).join('/')}`;
          ghFilesBox.append(
            h('div', { class: 'plug-gh-row' },
              h('span', { class: 'mono small plug-gh-path' }, p),
              h('button', {
                type: 'button',
                class: 'btn small primary',
                onclick: () => downloadAndInstallJsUrl(rawFileUrl, fName)
              }, L('pa.installPlugin'))
            )
          );
        }
      } catch (err) {
        ghFilesBox.innerHTML = '';
        ghFilesBox.append(h('p', { class: 'ag-err-txt small' }, L('pa.pluginFileError', { message: err.message })));
      }
    };

    ghUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        importPluginFromGithub();
      }
    });

    draw();

    const body = h('div', { class: 'fields plug-dialog' },
      h('p', { class: 'help' }, L('pa.pluginsIntro')),
      h('h3', { class: 'modh' }, L('pa.installedPlugins')),
      installedBox,
      h('h3', { class: 'modh' }, L('pa.availablePlugins')),
      catalogBox,
      h('h3', { class: 'modh' }, L('pa.futurePluginsTitle')),
      h('div', { class: 'plug-install-box' },
        h('div', { class: 'plug-gh-bar' },
          h('label', { class: 'field', style: 'flex:1;margin:0;' },
            h('span', { class: 'flabel' }, L('pa.ghPluginUrlLbl')),
            ghUrlInput
          ),
          h('button', { type: 'button', class: 'btn small primary', id: 'loadPluginGhBtn', onclick: importPluginFromGithub }, L('pa.ghInstallBtn'))
        ),
        ghFilesBox,
        h('div', { class: 'plug-future' },
          h('p', { class: 'muted small' }, L('pa.futurePluginsHint')),
          h('button', { type: 'button', class: 'btn small', id: 'loadPluginFileBtn', onclick: importPluginFile }, L('pa.loadPluginFile'))
        )
      )
    );

    closeIt = openModal({
      title: L('pa.pluginsDialogTitle'),
      body,
      wide: true,
      okText: L('win.close'),
      noCancel: true
    }).close;
  }

  /* ==========================================================================
     3. PARSING E FORMATTAZIONE DI VETTORI, STRUTTURE DATI E PARAMETRI
     ========================================================================== */

  /* Converte parentesi quadre `[1, 2, 3]` in graffe `{1, 2, 3}` (formato array di FlowLab) */
  function normalizeArrayBraces(raw) {
    let s = String(raw || '').trim();
    if (!s) return '{}';
    // Sostituisce [ e ] fuori dalle virgolette con { e }
    let out = '', q = null;
    for (const ch of s) {
      if (q) { out += ch; if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; out += ch; continue; }
      if (ch === '[') out += '{';
      else if (ch === ']') out += '}';
      else out += ch;
    }
    out = out.trim();
    if (!out.startsWith('{') || ExprLib.splitTop(out).length > 1) {
      // Se l'utente ha scritto "4, 1, 9", "4 1 9" oppure "{1, 2}, {3, 4}" senza graffe esterne, aggiungiamo le graffe
      if (!out.includes(',') && /\s+/.test(out)) {
        out = out.split(/\s+/).join(', ');
      }
      out = '{' + out + '}';
    }
    return out;
  }

  /* Inferisce un tipo primitivo concreto da un valore testuale (utile per parametri generici <T>) */
  function inferConcreteTypeFromLiteral(raw, fallback = 'Integer') {
    const s = String(raw || '').trim();
    if (!s) return fallback;
    const unwrapped = s.replace(/^[{\[\s]+|[}\]\s]+$/g, '').split(',')[0].trim();
    if (!unwrapped) return fallback;
    if (/^["']/.test(unwrapped)) return 'String';
    if (/^(true|false)$/i.test(unwrapped)) return 'Boolean';
    if (/^[+-]?\d+\.\d+/.test(unwrapped)) return 'Real';
    if (/^[+-]?\d+$/.test(unwrapped)) return 'Integer';
    return fallback;
  }

  /* Formatta il contenuto di una cella di memoria (scalare, array 1D/2D/3D+, ArrayList, Stack, Queue o oggetto) */
  function formatRuntimeCell(cell) {
    if (!cell) return '';
    if (cell.array && Array.isArray(cell.items)) {
      const dims = cell.dims || [cell.items.length];
      const fmtVal = (v) => (v === undefined ? '?' : ExprLib.fmtValue(v));
      const buildNested = (depth, offset, stride) => {
        const len = dims[depth] || 0;
        if (depth === dims.length - 1) {
          const leaves = [];
          for (let i = 0; i < len; i++) leaves.push(fmtVal(cell.items[offset + i]));
          return '{' + leaves.join(', ') + '}';
        }
        const subStride = stride / len;
        const parts = [];
        for (let i = 0; i < len; i++) {
          parts.push(buildNested(depth + 1, offset + i * subStride, subStride));
        }
        return '{' + parts.join(', ') + '}';
      };
      const total = dims.reduce((a, b) => a * b, 1);
      return buildNested(0, 0, total);
    }
    const v = cell.value;
    if (v === undefined) return '';
    if (v.t === 'Object' && v.v && v.v.fields) {
      const obj = v.v;
      const clsName = (obj.cls && obj.cls.name) || '';
      // Formattazione leggibile per ArrayList, Stack, Queue e Liste collegate
      if (/^(ArrayList|Stack)$/i.test(clsName) && obj.fields.has('items') && obj.fields.has('count')) {
        const itemsCell = obj.fields.get('items');
        const countCell = obj.fields.get('count');
        const n = (countCell && countCell.value && countCell.value.v) || 0;
        const slice = (itemsCell && itemsCell.items ? itemsCell.items.slice(0, n) : []).map((x) => (x ? ExprLib.fmtValue(x) : '?'));
        return '{' + slice.join(', ') + '}';
      }
      if (/^Queue$/i.test(clsName) && obj.fields.has('items') && obj.fields.has('count') && obj.fields.has('head')) {
        const itemsCell = obj.fields.get('items');
        const countCell = obj.fields.get('count');
        const headCell = obj.fields.get('head');
        const n = (countCell && countCell.value && countCell.value.v) || 0;
        const head = (headCell && headCell.value && headCell.value.v) || 0;
        const arr = (itemsCell && itemsCell.items) || [];
        const cap = arr.length || 1;
        const out = [];
        for (let i = 0; i < n; i++) {
          const item = arr[(head + i) % cap];
          out.push(item ? ExprLib.fmtValue(item) : '?');
        }
        return '{' + out.join(', ') + '}';
      }
      // Oggetto generico: mostra gli attributi principali
      const pairs = [];
      for (const [k, fCell] of obj.fields.entries()) {
        pairs.push(`${k}=${formatRuntimeCell(fCell)}`);
      }
      return `${clsName}{${pairs.join(', ')}}`;
    }
    return ExprLib.fmtValue(v);
  }

  /* Espande righe con `{1, 2, 3}` o `[1, 2, 3]` in singoli valori per i blocchi Input in ciclo */
  function buildExpandedInputQueue(lines) {
    const queue = [];
    for (const line of lines) {
      const s = String(line).trim();
      if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
        try {
          const lit = ExprLib.parseArrayLit(normalizeArrayBraces(s));
          for (const leaf of lit.leaves) {
            queue.push(String(leaf).trim().replace(/^"(.*)"$/, '$1'));
          }
          continue;
        } catch (e) { /* fallback to raw line */ }
      }
      queue.push(s);
    }
    return queue;
  }

  /* Divide l'input testuale in righe logiche, mantenendo unite eventuali matrici `{ {1, 2},\n {3, 4} }` su più righe */
  function splitLogicalInputLines(rawInputText) {
    const rawLines = String(rawInputText || '').split(/\r?\n/);
    const out = [];
    let buf = '';
    let depth = 0;
    let quote = null;

    for (const raw of rawLines) {
      const line = raw.trim();
      if (!line && depth === 0) continue;
      buf = buf ? buf + ' ' + line : line;
      for (const ch of line) {
        if (quote) {
          if (ch === quote) quote = null;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quote = ch;
          continue;
        }
        if (ch === '{' || ch === '[') depth++;
        else if (ch === '}' || ch === ']') depth = Math.max(0, depth - 1);
      }
      if (depth === 0 && buf) {
        out.push(buf);
        buf = '';
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  /* Costruisce o adatta un letterale array `{...}` affinché abbia esattamente `targetDims` dimensioni */
  function coerceArrayLitToDims(rawVal, pType, targetDims) {
    const dimsCount = Math.max(1, Number(targetDims) || 1);
    const defaultLeaf = /^String$/i.test(pType) ? '"a"' : (/^Boolean$/i.test(pType) ? 'false' : '1');
    const quoteLeafIfNeeded = (lf) => {
      const t = String(lf || '').trim();
      if (!t) return defaultLeaf;
      if (/^String$/i.test(pType) && !/^["']/.test(t)) {
        return `"${t.replace(/"/g, '')}"`;
      }
      return t;
    };

    const buildFromLeaves = (leaves, shape) => {
      let idx = 0;
      const walk = (d) => {
        const len = shape[d];
        if (d === shape.length - 1) {
          const row = [];
          for (let i = 0; i < len; i++) {
            const val = idx < leaves.length ? leaves[idx++] : (leaves.length ? leaves[idx++ % leaves.length] : defaultLeaf);
            row.push(quoteLeafIfNeeded(val));
          }
          return '{' + row.join(', ') + '}';
        }
        const sub = [];
        for (let i = 0; i < len; i++) sub.push(walk(d + 1));
        return '{' + sub.join(', ') + '}';
      };
      return walk(0);
    };

    const trimmed = String(rawVal || '').trim();
    if (!trimmed) {
      const defaultSide = dimsCount === 1 ? 3 : 2;
      const shape = Array(dimsCount).fill(defaultSide);
      const total = Math.pow(defaultSide, dimsCount);
      const leaves = Array.from({ length: total }, (_, i) =>
        /^String$/i.test(pType) ? `"s${i + 1}"` : (/^Boolean$/i.test(pType) ? (i % 2 === 0 ? 'true' : 'false') : String(i + 1))
      );
      return buildFromLeaves(leaves, shape);
    }

    const arrLit = normalizeArrayBraces(trimmed);
    try {
      const parsed = ExprLib.parseArrayLit(arrLit);
      const leaves = (parsed.leaves || []).map(quoteLeafIfNeeded);
      if (parsed.dims.length === dimsCount) {
        return buildFromLeaves(leaves, parsed.dims);
      }
      // Se il numero di dimensioni nell'input non coincide (es. 1D passato a una matrice 2D o cubo 3D), riadatta automaticamente
      if (dimsCount === 1) {
        return '{' + (leaves.length ? leaves : [defaultLeaf]).join(', ') + '}';
      }
      if (dimsCount === 2) {
        const side = Math.max(2, Math.ceil(Math.sqrt(Math.max(1, leaves.length))));
        return buildFromLeaves(leaves, [side, side]);
      }
      const side = Math.max(2, Math.round(Math.pow(Math.max(1, leaves.length), 1 / dimsCount)));
      return buildFromLeaves(leaves, Array(dimsCount).fill(side));
    } catch (e) {
      const fallbackShape = Array(dimsCount).fill(2);
      return buildFromLeaves([defaultLeaf], fallbackShape);
    }
  }

  /* Costruisce un Main sintetico in `progCopy` per invocare una specifica funzione/metodo `targetFn`
     con parametri (scalari, array 1D/2D/3D+, ArrayList, Stack, Queue, oggetti) */
  function prepareSyntheticCallMain(progCopy, targetFn, rawInputText) {
    const S = ModelLib.makeStmt;
    const rawLines = splitLogicalInputLines(rawInputText);

    const params = targetFn.params || [];
    let argTexts = rawLines.slice();
    // Se la funzione ha un solo parametro array 2D+ e l'utente ha scritto le righe della matrice su più linee (es. "{1, 2}\n{3, 4}")
    if (params.length === 1 && params[0].array && (Number(params[0].dims) || 1) >= 2 && rawLines.length > 1) {
      argTexts = ['{' + rawLines.map((l) => normalizeArrayBraces(l)).join(', ') + '}'];
    } else if (rawLines.length === 1 && params.length > 1) {
      // Se l'utente ha scritto tutti i parametri su una sola riga separati da virgola: "{1, 2, 3}, 3, 2"
      const split = ExprLib.splitTop(rawLines[0]);
      if (split.length >= params.length - 1) argTexts = split;
    }

    // Auto-compilazione intelligente della dimensione `n` (o `r, c`) dopo un array se l'utente l'ha omessa
    if (argTexts.length < params.length) {
      for (let i = 0; i < params.length - 1; i++) {
        if (params[i].array && !params[i + 1].array && /^Integer$/i.test(params[i + 1].type) && /^(n|dim|len|length|size|r|c|rows|cols|righe|colonne)$/i.test(params[i + 1].name)) {
          try {
            const pDims = Math.max(1, Number(params[i].dims) || 1);
            const coerced = coerceArrayLitToDims(argTexts[i], params[i].type, pDims);
            const lit = ExprLib.parseArrayLit(coerced);
            if (lit.dims && lit.dims.length) {
              argTexts.splice(i + 1, 0, String(lit.dims[0]));
              if (argTexts.length === params.length) break;
            }
          } catch (e) { /* ignore */ }
        }
      }
    }

    // Risolve eventuali tipi generici <T> della funzione
    const tparamSet = new Set([
      ...(targetFn.tparams || []).map((t) => t.toLowerCase()),
      ...((progCopy.classes || []).flatMap((c) => c.tparams || []).map((t) => t.toLowerCase()))
    ]);
    const tmap = {};
    params.forEach((p, idx) => {
      const base = ExprLib.splitType(p.type).base.toLowerCase();
      if (tparamSet.has(base) && !tmap[base] && argTexts[idx]) {
        tmap[base] = inferConcreteTypeFromLiteral(argTexts[idx], 'Integer');
      }
    });
    const resolveT = (t) => ExprLib.substType(t, tmap);

    const body = [];
    const argNames = [];

    params.forEach((p, idx) => {
      const argVar = `__arg_${idx}`;
      argNames.push(argVar);
      const rawVal = argTexts[idx] !== undefined ? argTexts[idx].trim() : '';
      let pType = resolveT(p.type || 'Integer');
      if (tparamSet.has(ExprLib.splitType(pType).base.toLowerCase())) {
        pType = inferConcreteTypeFromLiteral(rawVal, 'Integer');
      }

      if (p.array) {
        const pDims = Math.max(1, Number(p.dims) || 1);
        const finalLit = coerceArrayLitToDims(rawVal, pType, pDims);
        body.push(S('declare', { name: argVar, type: pType, array: true, size: '', init: finalLit }));
        return;
      }

      const splitP = ExprLib.splitType(pType);
      const baseName = splitP.base;

      // Supporto diretto per strutture dati (ArrayList<T>, Stack<T>, Queue<T>) da input `{10, 20, 30}`
      if (/^(ArrayList|Stack|Queue)$/i.test(baseName)) {
        const elemType = splitP.args[0] || inferConcreteTypeFromLiteral(rawVal, 'Integer');
        const fullType = ExprLib.joinType(baseName, [elemType]);
        body.push(S('declare', { name: argVar, type: fullType, array: false, size: '', init: '' }));
        if (/^new\s+/i.test(rawVal)) {
          body.push(S('assign', { variable: argVar, expression: rawVal }));
        } else {
          body.push(S('assign', { variable: argVar, expression: `new ${fullType}()` }));
          if (rawVal) {
            const norm = normalizeArrayBraces(rawVal);
            try {
              const lit = ExprLib.parseArrayLit(norm);
              const method = /^Stack$/i.test(baseName) ? 'push' : 'add';
              for (let leaf of lit.leaves) {
                leaf = leaf.trim();
                if (/^String$/i.test(elemType) && leaf && !/^["']/.test(leaf)) leaf = `"${leaf}"`;
                if (leaf) body.push(S('call', { expression: `${argVar}.${method}(${leaf})` }));
              }
            } catch (e) { /* empty structure */ }
          }
        }
        return;
      }

      // Oggetto di una classe utente
      const isUserClass = (progCopy.classes || []).some((c) => c.name.toLowerCase() === baseName.toLowerCase());
      if (isUserClass) {
        body.push(S('declare', { name: argVar, type: pType, array: false, size: '', init: '' }));
        let expr = rawVal || `new ${pType}()`;
        if (!/^new\s+/i.test(expr) && expr !== 'null') {
          const cleanArgs = expr.replace(/^[{\[\s]+|[}\]\s]+$/g, '');
          expr = `new ${pType}(${cleanArgs})`;
        }
        body.push(S('assign', { variable: argVar, expression: expr }));
        return;
      }

      // Tipo primitivo (Integer, Real, String, Boolean)
      let initExpr = rawVal;
      if (!initExpr) {
        initExpr = /^String$/i.test(pType) ? '""' : (/^Boolean$/i.test(pType) ? 'false' : '0');
      } else if (/^String$/i.test(pType) && !/^["']/.test(initExpr)) {
        try {
          ExprLib.parseExpr(initExpr);
          // Se è un singolo identificatore non tra virgolette, lo quotiamo come testo
          if (/^[A-Za-z_]\w*$/.test(initExpr)) initExpr = `"${initExpr}"`;
        } catch (e) {
          initExpr = `"${initExpr.replace(/"/g, '')}"`;
        }
      }
      body.push(S('declare', { name: argVar, type: pType, array: false, size: '', init: initExpr }));
    });

    // Gestione chiamata a funzione globale/statica o metodo d'istanza
    let callTarget = targetFn.name;
    if (ModelLib.hasClasses(progCopy) && targetFn.cls) {
      const cls = ModelLib.classOf(progCopy, targetFn);
      const mainCls = ModelLib.mainClass(progCopy);
      if (cls && cls !== mainCls) {
        if (targetFn.static) {
          callTarget = `${cls.name}.${targetFn.name}`;
        } else if (!targetFn.ctor) {
          const selfType = (cls.tparams && cls.tparams.length)
            ? ExprLib.joinType(cls.name, cls.tparams.map((t) => tmap[t.toLowerCase()] || 'Integer'))
            : cls.name;
          body.unshift(
            S('declare', { name: '__self', type: selfType, array: false, size: '', init: '' }),
            S('assign', { variable: '__self', expression: `new ${selfType}()` })
          );
          callTarget = `__self.${targetFn.name}`;
        }
      }
    }

    const callExpr = `${callTarget}(${argNames.join(', ')})`;
    const rets = ModelLib.rets(targetFn);
    const retNames = [];

    if (rets.length > 0) {
      rets.forEach((r, idx) => {
        const rv = `__ret_${idx}`;
        retNames.push(rv);
        let rType = resolveT(r.type || 'Integer');
        if (tparamSet.has(ExprLib.splitType(rType).base.toLowerCase())) rType = 'Integer';
        body.push(S('declare', {
          name: rv,
          type: rType,
          array: !!r.array,
          size: r.array ? Array(r.dims || 1).fill('1').join(', ') : '',
          init: ''
        }));
      });
      body.push(S('assign', { variable: retNames.join(', '), expression: callExpr }));
    } else {
      body.push(S('call', { expression: callExpr }));
    }

    progCopy.functions[0].body = body;
    // Eventuali righe extra dopo i parametri restano disponibili per eventuali blocchi Input
    const remainingInputs = rawLines.slice(params.length);
    return { argNames, retNames, remainingInputs };
  }

  /* ==========================================================================
     4. SERVIZIO DI ESECUZIONE HEADLESS (`ctx.runHeadless`)
     ========================================================================== */
  function runProgramHeadless(progSource, rawInputText, maxStepsOrOpts = 25000) {
    const opts = typeof maxStepsOrOpts === 'object' && maxStepsOrOpts !== null
      ? maxStepsOrOpts
      : { maxSteps: Number(maxStepsOrOpts) || 25000 };
    const maxSteps = opts.maxSteps || 25000;

    const fl = window.FlowLab;
    const prog = JSON.parse(JSON.stringify(progSource || (fl && fl.state && fl.state.prog)));

    let targetFi = 0;
    if (opts.funcIndex != null && prog.functions[opts.funcIndex]) {
      targetFi = opts.funcIndex;
    } else if (opts.funcId) {
      const idx = prog.functions.findIndex((f) => f.id === opts.funcId);
      if (idx >= 0) targetFi = idx;
    } else if (opts.funcName) {
      const idx = prog.functions.findIndex((f) => f.name.toLowerCase() === String(opts.funcName).toLowerCase());
      if (idx >= 0) targetFi = idx;
    }

    const targetFn = prog.functions[targetFi] || prog.functions[0];
    const isDirectFuncCall = targetFi > 0 || (targetFn.params && targetFn.params.length > 0) || ModelLib.rets(targetFn).length > 0;

    let synthInfo = null;
    let inputQueue = [];
    if (isDirectFuncCall) {
      synthInfo = prepareSyntheticCallMain(prog, targetFn, rawInputText);
      inputQueue = buildExpandedInputQueue(synthInfo.remainingInputs);
    } else {
      const rawLines = String(rawInputText || '')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s, idx, arr) => !(idx === arr.length - 1 && s === ''));
      inputQueue = buildExpandedInputQueue(rawLines);
    }

    const vfsCopy = new Map(fl && fl.state && fl.state.vfs ? fl.state.vfs : []);
    const streams = { read: null, write: null };
    const outChunks = [];
    let currentLine = '';

    const env = {
      output: (t, nl) => {
        currentLine += String(t);
        if (nl) {
          outChunks.push(currentLine);
          currentLine = '';
        }
      },
      eof: () => {
        if (!streams.read) throw new ExprLib.FlowError('EOF(): file non aperto');
        return streams.read.pos >= streams.read.lines.length;
      },
      fileOpen: (name, mode) => {
        if (!String(name || '').trim()) throw new ExprLib.FlowError('Nome file vuoto');
        if (mode === 'read') {
          if (!vfsCopy.has(name)) throw new ExprLib.FlowError(`File "${name}" non trovato`, { exc: 'FileError' });
          const lines = String(vfsCopy.get(name)).split(/\r?\n/);
          if (lines.length && lines[lines.length - 1] === '') lines.pop();
          streams.read = { name, lines, pos: 0 };
        } else {
          streams.write = { name, lines: [] };
        }
      },
      fileClose: (mode) => {
        if (mode === 'write' && streams.write) {
          vfsCopy.set(streams.write.name, streams.write.lines.join('\n') + (streams.write.lines.length ? '\n' : ''));
        }
        streams[mode] = null;
      },
      fileRead: () => {
        const r = streams.read;
        if (!r || r.pos >= r.lines.length) throw new ExprLib.FlowError('Lettura oltre fine file', { exc: 'FileError' });
        return r.lines[r.pos++];
      },
      fileWrite: (s) => {
        if (!streams.write) throw new ExprLib.FlowError('Nessun file aperto in scrittura');
        streams.write.lines.push(String(s));
      }
    };

    const stats = {
      steps: 0,
      comparisons: 0,
      loopIterations: 0,
      assignments: 0,
      calls: 0,
      ioOps: 0,
      maxDepth: 1,
      memCells: 0,
      byKind: {
        declare: 0,
        assign: 0,
        if: 0,
        loop: 0,
        io: 0,
        call: 0
      }
    };

    const interp = new Interpreter(prog, env);
    const gen = interp.run();
    let pending;
    let inputIdx = 0;
    let error = null;
    let lastDepth = 0;
    let mainFrameRef = null;

    while (stats.steps < maxSteps) {
      let r;
      try {
        r = gen.next(pending);
        pending = undefined;
      } catch (e) {
        error = e.message || String(e);
        break;
      }
      if (r.done) break;
      const ev = r.value;
      if (!ev) continue;

      if (ev.frame && ev.frame.depth === 0 && !mainFrameRef) {
        mainFrameRef = ev.frame;
      }

      if (ev.type === 'branch') {
        stats.comparisons++;
        continue;
      }

      if (ev.type === 'input') {
        if (inputIdx >= inputQueue.length) {
          error = L('pa.agMissingInput', { name: ev.varName || '?' });
          break;
        }
        pending = inputQueue[inputIdx++];
        stats.assignments++;
        stats.ioOps++;
        stats.byKind.io++;
        continue;
      }

      if (ev.type === 'break') continue;

      if (ev.type === 'stmt') {
        // Se c'è un Main sintetico per chiamare una funzione, non contiamo i blocchi di setup di Main nelle statistiche della funzione
        const isSetupStmt = isDirectFuncCall && ev.frame && ev.frame.depth === 0;
        if (!isSetupStmt) {
          stats.steps++;
          const k = ev.stmt && ev.stmt.kind;
          const depth = ((ev.frame && ev.frame.depth) || 0) + 1;
          const adjDepth = isDirectFuncCall ? Math.max(1, depth - 1) : depth;
          if (adjDepth > stats.maxDepth) stats.maxDepth = adjDepth;
          if (depth > lastDepth) stats.calls++;
          lastDepth = depth;

          if (k === 'declare' || k === 'const') {
            stats.byKind.declare++;
            if (ev.stmt.init || k === 'const') stats.assignments++;
          } else if (k === 'assign') {
            stats.assignments++;
            stats.byKind.assign++;
          } else if (k === 'if') {
            stats.byKind.if++;
          } else if (k === 'while' || k === 'for' || k === 'do') {
            stats.comparisons++;
            stats.loopIterations++;
            stats.byKind.loop++;
          } else if (k === 'output' || k === 'open' || k === 'close' || k === 'read' || k === 'write') {
            stats.ioOps++;
            stats.byKind.io++;
            if (k === 'read') stats.assignments++;
          } else if (k === 'call') {
            stats.calls++;
            stats.byKind.call++;
          }
        } else {
          lastDepth = 1;
        }

        let curMem = 0;
        for (const fr of interp.stack) {
          if (fr.vars) {
            for (const cell of fr.vars.values()) {
              curMem += cell.array && Array.isArray(cell.items) ? Math.max(1, cell.items.length) : 1;
            }
          }
        }
        curMem += (interp.objCount || 0) * 2;
        if (curMem > stats.memCells) stats.memCells = curMem;
      }
    }

    if (stats.steps >= maxSteps && !error) {
      error = L('pa.agStepLimitExceeded', { max: maxSteps });
    }
    if (currentLine) outChunks.push(currentLine);

    // Se abbiamo eseguito una funzione/metodo: raccogliamo il valore di ritorno oppure i vettori/oggetti modificati in-place
    let returnText = '';
    if (!error && isDirectFuncCall && synthInfo && mainFrameRef && mainFrameRef.vars) {
      if (synthInfo.retNames.length > 0) {
        const retFormatted = synthInfo.retNames.map((rn) => formatRuntimeCell(mainFrameRef.vars.get(rn.toLowerCase())));
        returnText = retFormatted.join(', ');
        outChunks.push(returnText);
      } else if (outChunks.length === 0 && synthInfo.argNames.length > 0) {
        // Procedura void (es. bubbleSort(v, n)): mostra lo stato finale dei parametri array/oggetti modificati in-place
        const mutated = [];
        targetFn.params.forEach((p, idx) => {
          const cell = mainFrameRef.vars.get(synthInfo.argNames[idx].toLowerCase());
          if (cell && (p.array || (cell.value && cell.value.t === 'Object'))) {
            mutated.push(formatRuntimeCell(cell));
          }
        });
        if (mutated.length) {
          returnText = mutated.join('\n');
          outChunks.push(returnText);
        }
      }
    }

    return {
      ok: !error,
      error,
      returnText,
      outputLines: outChunks,
      outputText: outChunks.join('\n'),
      stats,
      mainFrame: mainFrameRef,
      interp
    };
  }

  function init(helpers) {
    uiHelpers = helpers || null;
    initialized = true;
    loadCustomPluginsFromStorage();
    for (const id of pluginRegistry.keys()) {
      applyPluginState(id);
    }
    renderDock();
  }

  const api = {
    init,
    register: registerPlugin,
    getState: getPluginState,
    setState: setPluginState,
    openDialog: openPluginDialog,
    runHeadless: runProgramHeadless,
    formatCell: formatRuntimeCell,
    get ui() { return uiHelpers; },
    list: () => [...pluginRegistry.values()].map((p) => ({
      id: p.id,
      name: p.getName(),
      description: p.getDesc(),
      version: p.version,
      preinstalled: p.preinstalled,
      ...getPluginState(p.id)
    }))
  };

  if (typeof window !== 'undefined') {
    window.FlowLabPlugins = api;
  }

  return api;
})();
