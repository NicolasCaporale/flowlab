/* ==========================================================================
   FlowLab Plugin — Linter & Controllo Qualità Diagramma (src/linter.js)
   Plugin autonomo registrato tramite `FlowLabPlugins.register(...)`.
   Analizza l'AST delle espressioni tramite `ExprLib.parseExpr`, `ExprLib.parseLValueList`
   e `ExprLib.parseArrayLit` per individuare errori reali senza falsi positivi.
   ========================================================================== */
'use strict';

(() => {
  if (typeof FlowLabPlugins === 'undefined' || !FlowLabPlugins.register) return;

  const ICON_LINTER_SVG = '<svg viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>';

  const BLOCK_NAMES = {
    declare: 'Dichiara',
    const: 'Costante',
    assign: 'Assegna',
    input: 'Input',
    output: 'Output',
    if: 'Se (If)',
    while: 'Mentre (While)',
    for: 'Per (For)',
    do: 'Fai-mentre (Do)',
    call: 'Chiama',
    try: 'Prova (Try)',
    throw: 'Lancia (Throw)',
    open: 'Apri file',
    read: 'Leggi da file',
    write: 'Scrivi su file',
    close: 'Chiudi file'
  };

  /* Estrae tutte le variabili lette da un nodo AST restituito da ExprLib.parseExpr */
  function collectReadVarsFromAst(node, outSet, classNames) {
    if (!node || typeof node !== 'object') return;
    switch (node.k) {
      case 'var': {
        const low = String(node.name || '').toLowerCase();
        if (low && (!classNames || !classNames.has(low))) {
          outSet.add(low);
        }
        if (Array.isArray(node.indices)) {
          for (const ix of node.indices) collectReadVarsFromAst(ix, outSet, classNames);
        }
        break;
      }
      case 'member': {
        collectReadVarsFromAst(node.obj, outSet, classNames);
        if (Array.isArray(node.indices)) {
          for (const ix of node.indices) collectReadVarsFromAst(ix, outSet, classNames);
        }
        break;
      }
      case 'mcall': {
        collectReadVarsFromAst(node.obj, outSet, classNames);
        if (Array.isArray(node.args)) {
          for (const a of node.args) collectReadVarsFromAst(a, outSet, classNames);
        }
        break;
      }
      case 'call':
      case 'new':
      case 'supercall': {
        if (Array.isArray(node.args)) {
          for (const a of node.args) collectReadVarsFromAst(a, outSet, classNames);
        }
        break;
      }
      case 'bin': {
        collectReadVarsFromAst(node.l, outSet, classNames);
        collectReadVarsFromAst(node.r, outSet, classNames);
        break;
      }
      case 'un':
      case 'par': {
        collectReadVarsFromAst(node.e, outSet, classNames);
        break;
      }
    }
  }

  function extractVarsFromExpr(exprStr, classNames) {
    const out = new Set();
    if (!exprStr || !String(exprStr).trim()) return out;
    try {
      const ast = ExprLib.parseExpr(String(exprStr));
      collectReadVarsFromAst(ast, out, classNames);
    } catch (e) { /* syntax errors reported separately */ }
    return out;
  }

  function inspectProgramQuality(prog) {
    const issues = [];
    if (!prog || !Array.isArray(prog.functions)) return issues;

    const isOO = ModelLib.hasClasses(prog);
    const classNames = new Set([
      ...((prog.classes || []).map((c) => c.name.toLowerCase())),
      ...((ModelLib.EXC_CLASSES || []).map((c) => c.name.toLowerCase()))
    ]);

    prog.functions.forEach((fn, fi) => {
      if (fn.abstract) return;
      const fnLabel = fn.name || 'Main';
      const declared = new Map(); // lowName -> { name, stmtId, initialized, used, isRet }
      const classAttrs = new Set();

      if (isOO) {
        const cls = ModelLib.classOf(prog, fn);
        if (cls) {
          ModelLib.chainOf(prog, cls).forEach((c) => {
            (c.attributes || []).forEach((a) => {
              if (a.name) classAttrs.add(a.name.toLowerCase());
            });
          });
        }
      }

      for (const p of fn.params || []) {
        if (p.name) {
          declared.set(p.name.toLowerCase(), {
            name: p.name,
            stmtId: null,
            initialized: true,
            used: true,
            isRet: false
          });
        }
      }

      for (const r of ModelLib.rets(fn)) {
        if (r.name) {
          declared.set(r.name.toLowerCase(), {
            name: r.name,
            stmtId: null,
            initialized: false,
            used: true,
            isRet: true
          });
        }
      }

      const addIssue = (severity, stmtId, msg) => {
        issues.push({ severity, fi, fnLabel, stmtId, msg });
      };

      const checkExprSyntax = (exprStr, stmtId, label) => {
        if (!String(exprStr || '').trim()) {
          addIssue('error', stmtId, L('pa.ltEmptyExpr', { block: label }));
          return null;
        }
        try {
          return ExprLib.parseExpr(String(exprStr));
        } catch (e) {
          addIssue('error', stmtId, `${label}: ${e.message}`);
          return null;
        }
      };

      const markReadFromAst = (astNode, stmtId) => {
        if (!astNode) return;
        const vars = new Set();
        collectReadVarsFromAst(astNode, vars, classNames);
        for (const v of vars) {
          if (classAttrs.has(v) || classNames.has(v)) continue;
          const info = declared.get(v);
          if (!info) {
            addIssue('error', stmtId, L('pa.ltUndeclaredVar', { name: v }));
          } else {
            info.used = true;
            if (!info.initialized) {
              addIssue('warn', stmtId, L('pa.ltUninitializedVar', { name: info.name }));
            }
          }
        }
      };

      const checkAndMarkExpr = (exprStr, stmtId, label) => {
        const ast = checkExprSyntax(exprStr, stmtId, label);
        if (ast) markReadFromAst(ast, stmtId);
        return ast;
      };

      /* Gestisce una scrittura su un LValue (assign, input, read) */
      const processLValueWrite = (lv, stmtId) => {
        if (!lv) return;
        if (lv.k === 'var') {
          const low = lv.name.toLowerCase();
          if (Array.isArray(lv.indices) && lv.indices.length) {
            for (const ix of lv.indices) markReadFromAst(ix, stmtId);
          }
          if (!classAttrs.has(low)) {
            const info = declared.get(low);
            if (!info) {
              addIssue('error', stmtId, L('pa.ltUndeclaredVar', { name: lv.name }));
            } else {
              info.initialized = true;
              if (Array.isArray(lv.indices) && lv.indices.length) info.used = true;
            }
          }
        } else if (lv.k === 'member') {
          markReadFromAst(lv.obj, stmtId);
          if (Array.isArray(lv.indices)) {
            for (const ix of lv.indices) markReadFromAst(ix, stmtId);
          }
        }
      };

      /* Raccoglie tutte le variabili modificate all'interno del corpo di un ciclo */
      const collectModifiedVars = (list, outSet) => {
        for (const s of list || []) {
          if (s.kind === 'assign' || s.kind === 'input' || s.kind === 'read') {
            try {
              const lvs = ExprLib.parseLValueList(String(s.variable || ''));
              for (const lv of lvs) {
                if (lv.k === 'var') outSet.add(lv.name.toLowerCase());
                else if (lv.k === 'member') collectReadVarsFromAst(lv.obj, outSet, classNames);
              }
            } catch (e) {
              const m = String(s.variable || '').trim().match(/^([A-Za-z_]\w*)/);
              if (m) outSet.add(m[1].toLowerCase());
            }
          } else if (s.kind === 'for') {
            const m = String(s.variable || '').trim().match(/^([A-Za-z_]\w*)/);
            if (m) outSet.add(m[1].toLowerCase());
          } else if (s.kind === 'call') {
            for (const v of extractVarsFromExpr(s.expression, classNames)) outSet.add(v);
          }
          for (const b of ['then', 'else', 'body', 'finally']) {
            if (Array.isArray(s[b])) collectModifiedVars(s[b], outSet);
          }
          if (Array.isArray(s.catches)) {
            for (const c of s.catches) collectModifiedVars(c.body, outSet);
          }
        }
      };

      const walkStmts = (list) => {
        for (const s of list || []) {
          const bName = BLOCK_NAMES[s.kind] || s.kind;
          switch (s.kind) {
            case 'declare': {
              const names = String(s.name || '').split(',').map((x) => x.trim()).filter(Boolean);
              if (!names.length) addIssue('error', s.id, L('pa.ltEmptyExpr', { block: bName }));

              let hasInit = false;
              if (s.array) {
                const sz = String(s.size || '').trim();
                const inStr = String(s.init || '').trim();
                if (!sz && !inStr) {
                  addIssue('error', s.id, L('pa.ltEmptyExpr', { block: bName }));
                }
                if (sz) {
                  for (const dimExpr of ExprLib.splitTop(sz)) {
                    checkAndMarkExpr(dimExpr, s.id, bName);
                  }
                }
                if (inStr) {
                  hasInit = true;
                  try {
                    const lit = ExprLib.parseArrayLit(inStr);
                    for (const leaf of lit.leaves) checkAndMarkExpr(leaf, s.id, bName);
                  } catch (e) {
                    addIssue('error', s.id, `${bName}: ${e.message}`);
                  }
                }
              } else if (String(s.init || '').trim()) {
                hasInit = true;
                checkAndMarkExpr(s.init, s.id, bName);
              }

              for (const nm of names) {
                const low = nm.toLowerCase();
                const prev = declared.get(low);
                declared.set(low, {
                  name: nm,
                  stmtId: s.id,
                  initialized: hasInit || !!s.array || (prev ? prev.initialized : false),
                  used: prev && prev.isRet ? true : false,
                  isRet: prev ? prev.isRet : false
                });
              }
              break;
            }
            case 'const': {
              const nm = String(s.name || '').trim();
              if (!nm) addIssue('error', s.id, L('pa.ltEmptyExpr', { block: bName }));
              checkAndMarkExpr(s.expression, s.id, bName);
              if (nm) {
                declared.set(nm.toLowerCase(), {
                  name: nm,
                  stmtId: s.id,
                  initialized: true,
                  used: false,
                  isRet: false
                });
              }
              break;
            }
            case 'assign': {
              checkAndMarkExpr(s.expression, s.id, bName);
              // Se nel lato destro c'è una chiamata di funzione con argomenti array/oggetti, questi sono usati
              if (!String(s.variable || '').trim()) {
                addIssue('error', s.id, L('pa.ltEmptyExpr', { block: bName }));
              } else {
                try {
                  const lvs = ExprLib.parseLValueList(s.variable);
                  for (const lv of lvs) processLValueWrite(lv, s.id);
                } catch (e) {
                  addIssue('error', s.id, `${bName}: ${e.message}`);
                }
              }
              break;
            }
            case 'input':
            case 'read': {
              if (!String(s.variable || '').trim()) {
                addIssue('error', s.id, L('pa.ltEmptyExpr', { block: bName }));
              } else {
                try {
                  const lv = ExprLib.parseLValue(s.variable);
                  processLValueWrite(lv, s.id);
                } catch (e) {
                  addIssue('error', s.id, `${bName}: ${e.message}`);
                }
              }
              break;
            }
            case 'output':
            case 'write':
            case 'throw':
            case 'open':
            case 'call': {
              checkAndMarkExpr(s.expression, s.id, bName);
              break;
            }
            case 'if': {
              checkAndMarkExpr(s.expression, s.id, bName);
              if ((!s.then || !s.then.length) && (!s.else || !s.else.length)) {
                addIssue('info', s.id, L('pa.ltEmptyIf'));
              }
              walkStmts(s.then);
              walkStmts(s.else);
              break;
            }
            case 'while':
            case 'do': {
              if (s.kind === 'while') checkAndMarkExpr(s.expression, s.id, bName);
              if (!s.body || !s.body.length) {
                addIssue('warn', s.id, L('pa.ltEmptyLoop', { block: bName }));
              } else {
                const condVars = [...extractVarsFromExpr(s.expression, classNames)];
                const modVars = new Set();
                collectModifiedVars(s.body, modVars);
                if (condVars.length && !condVars.some((v) => modVars.has(v))) {
                  addIssue('warn', s.id, L('pa.ltInfiniteLoopRisk', { vars: condVars.join(', ') }));
                }
              }
              walkStmts(s.body);
              if (s.kind === 'do') checkAndMarkExpr(s.expression, s.id, bName);
              break;
            }
            case 'for': {
              const vName = String(s.variable || '').trim();
              if (!vName) {
                addIssue('error', s.id, L('pa.ltEmptyExpr', { block: bName }));
              } else {
                const low = vName.toLowerCase();
                if (!classAttrs.has(low)) {
                  const info = declared.get(low);
                  if (!info) addIssue('error', s.id, L('pa.ltUndeclaredVar', { name: vName }));
                  else { info.initialized = true; info.used = true; }
                }
              }
              checkAndMarkExpr(s.start, s.id, bName);
              checkAndMarkExpr(s.end, s.id, bName);
              if (String(s.step || '').trim() && String(s.step).trim() !== '1') {
                checkAndMarkExpr(s.step, s.id, bName);
              }
              if (!s.body || !s.body.length) {
                addIssue('info', s.id, L('pa.ltEmptyLoop', { block: bName }));
              }
              walkStmts(s.body);
              break;
            }
            case 'try': {
              if (!s.body || !s.body.length) addIssue('info', s.id, L('pa.ltEmptyTry'));
              walkStmts(s.body);
              for (const c of s.catches || []) {
                const cv = String(c.variable || '').trim().toLowerCase();
                if (cv) {
                  declared.set(cv, {
                    name: c.variable,
                    stmtId: s.id,
                    initialized: true,
                    used: true,
                    isRet: false
                  });
                }
                walkStmts(c.body);
              }
              if (s.hasFinally) walkStmts(s.finally);
              break;
            }
          }
        }
      };

      walkStmts(fn.body);

      for (const info of declared.values()) {
        if (info.isRet && !info.initialized) {
          addIssue('warn', null, L('pa.ltReturnNotSet', { name: info.name, fn: fnLabel }));
        } else if (!info.isRet && !info.used && info.stmtId) {
          addIssue('warn', info.stmtId, L('pa.ltUnusedVar', { name: info.name }));
        }
      }
    });

    return issues;
  }

  function jumpToDiagramBlock(fi, stmtId) {
    const fl = window.FlowLab;
    if (!fl) return;
    if (typeof fl.showFunc === 'function') fl.showFunc(fi);
    if (stmtId && fl.state) {
      fl.state.sel = stmtId;
      fl.render();
      setTimeout(() => {
        const el = document.querySelector(`#chart .shape[data-id="${CSS.escape(stmtId)}"]`);
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }, 60);
    }
  }

  FlowLabPlugins.register({
    id: 'diagram-linter',
    getName: () => L('pa.ltName'),
    getDesc: () => L('pa.ltDesc'),
    getShortLabel: () => L('pa.ltShort'),
    version: '1.0',
    author: 'FlowLab Team',
    iconSvg: ICON_LINTER_SVG,
    showInDock: true,
    dockBtnId: 'plugBtnLinter',
    preinstalled: true,
    defaultInstalled: true,
    defaultEnabled: false,

    onOpen(ctx) {
      if (!ctx.ui || !ctx.ui.openModal || !ctx.ui.h || !ctx.prog) return;
      const { openModal, h } = ctx.ui;
      const prog = ctx.prog;

      let closeIt = null;
      const listBox = h('div', { class: 'lt-list' });
      const summaryBanner = h('div', { class: 'lt-banner' });

      const runInspection = () => {
        listBox.innerHTML = '';
        const issues = inspectProgramQuality(ctx.prog || prog);
        const errCount = issues.filter((x) => x.severity === 'error').length;
        const warnCount = issues.filter((x) => x.severity === 'warn').length;
        const infoCount = issues.filter((x) => x.severity === 'info').length;

        if (!issues.length) {
          summaryBanner.className = 'lt-banner ok';
          summaryBanner.textContent = '✓ ' + L('pa.ltCleanBanner');
          listBox.append(h('p', { class: 'plug-empty muted small' }, L('pa.ltCleanHint')));
          return;
        }

        summaryBanner.className = 'lt-banner ' + (errCount ? 'err' : 'warn');
        summaryBanner.textContent = L('pa.ltSummaryBanner', {
          errors: errCount,
          warns: warnCount,
          infos: infoCount
        });

        for (const it of issues) {
          const sevLabel = it.severity === 'error'
            ? L('pa.ltSevError')
            : (it.severity === 'warn' ? L('pa.ltSevWarn') : L('pa.ltSevInfo'));

          const jumpBtn = h('button', {
            type: 'button',
            class: 'btn small',
            onclick: () => {
              if (closeIt) closeIt();
              jumpToDiagramBlock(it.fi, it.stmtId);
            }
          }, L('pa.ltJumpBtn'));

          const row = h('div', { class: 'lt-row ' + it.severity },
            h('span', { class: 'lt-badge ' + it.severity }, sevLabel),
            h('div', { class: 'lt-info' },
              h('strong', { class: 'mono small' }, it.fnLabel + '()'),
              h('span', null, it.msg)
            ),
            jumpBtn
          );
          listBox.append(row);
        }
      };

      runInspection();

      const body = h('div', { class: 'fields lt-dialog' },
        h('p', { class: 'help' }, L('pa.ltIntro')),
        h('div', { class: 'ag-toolbar' },
          summaryBanner,
          h('button', { type: 'button', class: 'btn small', onclick: runInspection }, '↻ ' + L('pa.ltRescanBtn'))
        ),
        listBox
      );

      closeIt = openModal({
        title: L('pa.ltName'),
        body,
        wide: true,
        okText: L('win.close'),
        noCancel: true
      }).close;
    }
  });
})();
