/* ==========================================================================
   FlowLab Plugin — Correttore Automatico & Test Suite (modules/plugin/autograder.js)
   Plugin autonomo registrato tramite `FlowLabPlugins.register(...)`.
   Supporta:
   - Test di `Main` (con blocchi Input, inclusi vettori `{1, 2, 3}`)
   - Test diretto di qualsiasi Funzione o Metodo (anche da moduli importati!)
     passando i parametri (vettori, matrici, ArrayList, Stack, Queue, oggetti)
     e verificando il valore restituito o il vettore modificato in-place.
   ========================================================================== */
'use strict';

(() => {
  if (typeof FlowLabPlugins === 'undefined' || !FlowLabPlugins.register) return;

  const AUTOGRADER_STORE_KEY = 'flowlab:autograderTests';
  const ICON_AUTOGRADER_SVG = '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v5.5L5 17.5A2 2 0 0 0 6.7 20.5h10.6A2 2 0 0 0 19 17.5L14 8.5V3"/><path d="M7.5 14.5h9"/></svg>';

  function progTestKey(prog, fn) {
    const pName = (prog && prog.attrs && prog.attrs.name) || 'Program';
    const fName = (fn && fn.name) || 'Main';
    return `${String(pName).trim().toLowerCase()}::${String(fName).trim().toLowerCase()}`;
  }

  function loadTestCases(prog, fn) {
    try {
      const raw = localStorage.getItem(AUTOGRADER_STORE_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const key = progTestKey(prog, fn);
      if (Array.isArray(map[key]) && map[key].length) return map[key];
    } catch (e) { /* ignore */ }
    return [];
  }

  function saveTestCases(prog, fn, list) {
    try {
      const raw = localStorage.getItem(AUTOGRADER_STORE_KEY);
      const map = (raw && JSON.parse(raw)) || {};
      map[progTestKey(prog, fn)] = list;
      localStorage.setItem(AUTOGRADER_STORE_KEY, JSON.stringify(map));
    } catch (e) { /* ignore */ }
  }

  function arrayDimsSuffix(p) {
    if (!p || !p.array) return '';
    const d = Math.max(1, Number(p.dims) || 1);
    return '[' + ','.repeat(d - 1) + ']';
  }

  /* Formatta la firma leggibile di una funzione/metodo */
  function formatFuncSignature(prog, fn) {
    const params = (fn.params || []).map((p) => `${p.name}: ${ExprLib.typeName(p.type)}${arrayDimsSuffix(p)}`).join(', ');
    const rets = ModelLib.rets(fn);
    const retStr = rets.length ? ' → ' + rets.map((r) => `${ExprLib.typeName(r.type)}${arrayDimsSuffix(r)}`).join(', ') : '';
    const cls = ModelLib.hasClasses(prog) && fn.cls ? ModelLib.classOf(prog, fn) : null;
    const prefix = cls && fn !== prog.functions[0] ? `${cls.name}.` : '';
    return `${prefix}${fn.name}(${params})${retStr}`;
  }

  /* Genera un placeholder di esempio mirato sui parametri della funzione selezionata */
  function buildParamPlaceholder(fn) {
    const params = fn.params || [];
    if (!params.length) return L('pa.agInputsPh');
    const sampleLines = params.map((p) => {
      if (p.array) {
        const d = Math.max(1, Number(p.dims) || 1);
        const suf = arrayDimsSuffix(p);
        if (d === 2) return `{{1, 2, 3}, {4, 5, 6}, {7, 8, 9}}   (${p.name}: ${ExprLib.typeName(p.type)}${suf})`;
        if (d === 3) return `{{{1, 2}, {3, 4}}, {{5, 6}, {7, 8}}}   (${p.name}: ${ExprLib.typeName(p.type)}${suf})`;
        if (d >= 4) {
          let lit = '{1, 2}';
          for (let k = 1; k < d; k++) lit = `{${lit}, ${lit}}`;
          return `${lit}   (${p.name}: ${ExprLib.typeName(p.type)}${suf})`;
        }
        return `{10, 20, 30}   (${p.name}: ${ExprLib.typeName(p.type)}${suf})`;
      }
      const b = ExprLib.splitType(p.type).base;
      if (/^(ArrayList|Stack|Queue)$/i.test(b)) return `{10, 20, 30}   (${p.name}: ${p.type})`;
      if (/^String$/i.test(b)) return `"testo"   (${p.name})`;
      if (/^Boolean$/i.test(b)) return `true   (${p.name})`;
      return `3   (${p.name}: ${ExprLib.typeName(p.type)})`;
    });
    return sampleLines.join('\n');
  }

  function normArrayOutput(s) {
    return String(s || '')
      .replace(/\[/g, '{')
      .replace(/\]/g, '}')
      .replace(/\{\s+/g, '{')
      .replace(/\s+\}/g, '}')
      .replace(/\s*,\s*/g, ', ')
      .trim();
  }

  function compareTestOutput(actualText, expectedText) {
    const norm = (s) => normArrayOutput(String(s || '').replace(/\r\n/g, '\n'));
    const act = norm(actualText);
    const exp = norm(expectedText);
    if (!exp) return act === '';
    if (act === exp) return true;
    // Confronto per vettori scritti senza graffe (es. "1, 4, 7, 9" o "1 4 7 9" vs "{1, 4, 7, 9}")
    if ('{' + exp + '}' === act || '{' + exp.split(/\s+/).join(', ') + '}' === act) return true;
    const actLines = act.split('\n').map((l) => l.trim()).filter(Boolean);
    const expLines = exp.split('\n').map((l) => l.trim()).filter(Boolean);
    if (actLines.join('\n') === expLines.join('\n')) return true;
    if (expLines.length === 1 && actLines.length >= 1) {
      const lastLine = actLines[actLines.length - 1];
      if (
        lastLine === expLines[0] ||
        lastLine === '{' + expLines[0] + '}' ||
        lastLine.endsWith(' ' + expLines[0]) ||
        lastLine.endsWith('=' + expLines[0]) ||
        lastLine.endsWith(': ' + expLines[0])
      ) {
        return true;
      }
    }
    return false;
  }

  FlowLabPlugins.register({
    id: 'autograder',
    getName: () => L('pa.agName'),
    getDesc: () => L('pa.agDesc'),
    getShortLabel: () => L('pa.agShort'),
    version: '1.1',
    author: 'FlowLab Team',
    iconSvg: ICON_AUTOGRADER_SVG,
    showInDock: true,
    dockBtnId: 'plugBtnAutograder',
    preinstalled: true,
    defaultInstalled: true,
    defaultEnabled: false,

    onOpen(ctx) {
      if (!ctx.ui || !ctx.ui.openModal || !ctx.ui.h || !ctx.prog) return;
      const { openModal, h, toast } = ctx.ui;
      const prog = ctx.prog;
      const fl = ctx.flowlab;

      const testableFuncs = prog.functions
        .map((fn, fi) => ({ fn, fi }))
        .filter(({ fn }) => !fn.abstract && !fn.ctor);

      let curFi = (fl && fl.state && typeof fl.state.fi === 'number' && !prog.functions[fl.state.fi].abstract && !prog.functions[fl.state.fi].ctor)
        ? fl.state.fi
        : 0;
      const curFn = () => prog.functions[curFi] || prog.functions[0];

      let tests = loadTestCases(prog, curFn());
      let lastResults = [];

      const fnSelect = h('select', { class: 'fsel', id: 'agFuncSelect' });
      for (const { fn, fi } of testableFuncs) {
        const mod = ModelLib.moduleOfFunc(prog, fn);
        const label = formatFuncSignature(prog, fn) + (mod ? ` [${mod.name}]` : '');
        fnSelect.append(h('option', { value: String(fi), selected: fi === curFi ? 'selected' : null }, label));
      }

      const paramHintEl = h('p', { class: 'muted small', style: 'margin:4px 0 0;' });
      const listBox = h('div', { class: 'ag-list' });
      const summaryBar = h('div', { class: 'ag-summary', hidden: true });

      const inName = h('input', { type: 'text', placeholder: L('pa.agCaseNamePh') });
      const inInputs = h('textarea', { rows: 3, class: 'mono', placeholder: buildParamPlaceholder(curFn()) });
      const inExpected = h('textarea', { rows: 3, class: 'mono', placeholder: L('pa.agExpectedPh') });

      const updateFuncHint = () => {
        const fn = curFn();
        const params = fn.params || [];
        inInputs.placeholder = buildParamPlaceholder(fn);
        if (params.length > 0) {
          const sig = params.map((p, i) => `${i + 1}) ${p.name}: ${ExprLib.typeName(p.type)}${arrayDimsSuffix(p)}`).join(' · ');
          paramHintEl.textContent = L('pa.paramsHint', { count: params.length, sig });
        } else {
          paramHintEl.textContent = L('pa.noParamsHint');
        }
      };

      const drawTests = () => {
        listBox.innerHTML = '';
        if (!tests.length) {
          listBox.append(h('p', { class: 'plug-empty muted small' }, L('pa.agNoCases')));
          summaryBar.hidden = true;
          return;
        }

        tests.forEach((tc, idx) => {
          const res = lastResults[idx] || null;
          let badge = null;
          if (res) {
            badge = h('span', { class: 'plug-badge ' + (res.passed ? 'on' : 'err') },
              res.passed ? L('pa.agPassed') : L('pa.agFailed'));
          }

          const delBtn = h('button', {
            type: 'button',
            class: 'btn small danger',
            onclick: () => {
              tests.splice(idx, 1);
              lastResults.splice(idx, 1);
              saveTestCases(prog, curFn(), tests);
              drawTests();
            }
          }, L('pa.removePlugin'));

          const inStr = String(tc.inputs || '').trim() ? tc.inputs.replace(/\r?\n/g, ' ↵ ') : '—';
          const expStr = String(tc.expected || '').trim() ? tc.expected.replace(/\r?\n/g, ' ↵ ') : '—';

          const card = h('div', { class: 'ag-card' + (res ? (res.passed ? ' pass' : ' fail') : '') },
            h('div', { class: 'ag-card-head' },
              h('strong', null, `#${idx + 1} · ${tc.name || L('pa.agCaseDefault', { n: idx + 1 })}`),
              badge,
              h('span', { class: 'grow' }),
              res ? h('span', { class: 'muted small mono' }, `${res.steps} ${L('pa.cxStepsUnit')}`) : null,
              delBtn
            ),
            h('div', { class: 'ag-io-grid mono small' },
              h('div', null, h('span', { class: 'muted' }, L('pa.agInputCol') + ': '), inStr),
              h('div', null, h('span', { class: 'muted' }, L('pa.agExpectedCol') + ': '), expStr),
              res ? h('div', { class: 'ag-actual' },
                h('span', { class: 'muted' }, L('pa.agActualCol') + ': '),
                res.error ? h('span', { class: 'ag-err-txt' }, res.error) : (res.output.replace(/\r?\n/g, ' ↵ ') || '—')
              ) : null
            )
          );
          listBox.append(card);
        });
      };

      fnSelect.addEventListener('change', () => {
        curFi = Number(fnSelect.value) || 0;
        tests = loadTestCases(prog, curFn());
        lastResults = [];
        summaryBar.hidden = true;
        updateFuncHint();
        drawTests();
      });

      const runAllTests = () => {
        if (!tests.length) {
          if (toast) toast(L('pa.agNoCases'), 'warn');
          return;
        }
        lastResults = tests.map((tc) => {
          const r = ctx.runHeadless(ctx.prog, tc.inputs, { funcIndex: curFi });
          const passed = r.ok && compareTestOutput(r.outputText, tc.expected);
          return {
            passed,
            output: r.outputText,
            error: r.error,
            steps: r.stats.steps
          };
        });
        const passedCount = lastResults.filter((r) => r.passed).length;
        summaryBar.hidden = false;
        summaryBar.className = 'ag-summary ' + (passedCount === tests.length ? 'all-pass' : 'some-fail');
        summaryBar.textContent = L('pa.agSummaryText', { passed: passedCount, total: tests.length });
        drawTests();
      };

      const autoFillExpected = () => {
        const r = ctx.runHeadless(ctx.prog, inInputs.value, { funcIndex: curFi });
        if (!r.ok) {
          if (toast) toast(r.error, 'error');
          return;
        }
        inExpected.value = r.outputText;
        if (toast) toast(L('pa.agAutoFilledToast'), 'ok');
      };

      const addTestCase = () => {
        const name = inName.value.trim() || L('pa.agCaseDefault', { n: tests.length + 1 });
        const inputs = inInputs.value;
        const expected = inExpected.value.trim();
        if (!expected && !inputs.trim()) {
          if (toast) toast(L('pa.agWriteInputOrExpected'), 'warn');
          return;
        }
        tests.push({ name, inputs, expected });
        saveTestCases(prog, curFn(), tests);
        inName.value = '';
        inInputs.value = '';
        inExpected.value = '';
        lastResults = [];
        drawTests();
      };

      updateFuncHint();
      drawTests();

      const body = h('div', { class: 'fields ag-dialog' },
        h('p', { class: 'help' }, L('pa.agIntro')),
        h('label', { class: 'field' },
          h('span', { class: 'flabel' }, L('pa.targetFuncLbl')),
          fnSelect,
          paramHintEl
        ),
        h('div', { class: 'ag-toolbar' },
          h('h3', { class: 'modh' }, L('pa.agCasesTitle')),
          h('span', { class: 'grow' }),
          h('button', { type: 'button', class: 'btn small primary', id: 'agRunAllBtn', onclick: runAllTests }, '▶ ' + L('pa.agRunAll'))
        ),
        summaryBar,
        listBox,
        h('h3', { class: 'modh' }, L('pa.agAddTitle')),
        h('div', { class: 'ag-form' },
          h('label', { class: 'field' }, h('span', { class: 'flabel' }, L('pa.agCaseNameLbl')), inName),
          h('div', { class: 'ag-form-row' },
            h('label', { class: 'field' }, h('span', { class: 'flabel' }, L('pa.agInputsLbl')), inInputs),
            h('label', { class: 'field' }, h('span', { class: 'flabel' }, L('pa.agExpectedLbl')), inExpected)
          ),
          h('div', { class: 'ag-form-actions' },
            h('button', { type: 'button', class: 'btn small', onclick: autoFillExpected }, L('pa.agCaptureOutput')),
            h('button', { type: 'button', class: 'btn small primary', id: 'agAddCaseBtn', onclick: addTestCase }, '+ ' + L('pa.agAddBtn'))
          )
        )
      );

      openModal({
        title: L('pa.agName'),
        body,
        wide: true,
        okText: L('win.close'),
        noCancel: true
      });
    }
  });
})();
