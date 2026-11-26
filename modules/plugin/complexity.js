/* ==========================================================================
   FlowLab Plugin — Analizzatore di Complessità & Operazioni (modules/plugin/complexity.js)
   Plugin autonomo registrato tramite `FlowLabPlugins.register(...)`.
   Permette di scegliere quale Funzione o Metodo profilare (inclusi i moduli
   importati con parametri vettoriali o strutture dati) e calcola sia la
   complessità asintotica O(n) sia il conteggio dinamico delle operazioni.
   ========================================================================== */
'use strict';

(() => {
  if (typeof FlowLabPlugins === 'undefined' || !FlowLabPlugins.register) return;

  const ICON_COMPLEXITY_SVG = '<svg viewBox="0 0 24 24"><path d="M4 19h16M6 16l4-5 4 3 5-7"/><circle cx="19" cy="7" r="1.5"/></svg>';

  function arrayDimsSuffix(p) {
    if (!p || !p.array) return '';
    const d = Math.max(1, Number(p.dims) || 1);
    return '[' + ','.repeat(d - 1) + ']';
  }

  function formatFuncSignature(prog, fn) {
    const params = (fn.params || []).map((p) => `${p.name}: ${ExprLib.typeName(p.type)}${arrayDimsSuffix(p)}`).join(', ');
    const rets = ModelLib.rets(fn);
    const retStr = rets.length ? ' → ' + rets.map((r) => `${ExprLib.typeName(r.type)}${arrayDimsSuffix(r)}`).join(', ') : '';
    const cls = ModelLib.hasClasses(prog) && fn.cls ? ModelLib.classOf(prog, fn) : null;
    const prefix = cls && fn !== prog.functions[0] ? `${cls.name}.` : '';
    return `${prefix}${fn.name}(${params})${retStr}`;
  }

  function buildSampleInputsForFunc(fn) {
    const params = fn.params || [];
    if (!params.length) return '';
    return params.map((p) => {
      if (p.array) {
        const d = Math.max(1, Number(p.dims) || 1);
        if (d === 2) return '{{1, 2, 3}, {4, 5, 6}, {7, 8, 9}}';
        if (d === 3) return '{{{1, 2}, {3, 4}}, {{5, 6}, {7, 8}}}';
        if (d >= 4) {
          let lit = '{1, 2}';
          for (let k = 1; k < d; k++) lit = `{${lit}, ${lit}}`;
          return lit;
        }
        return '{12, 5, 8, 1, 19, 3}';
      }
      const b = ExprLib.splitType(p.type).base;
      if (/^(ArrayList|Stack|Queue)$/i.test(b)) return '{10, 20, 30, 40}';
      if (/^String$/i.test(b)) return '"esempio"';
      if (/^Boolean$/i.test(b)) return 'true';
      if (/^(n|dim|len|size)$/i.test(p.name)) return '6';
      return '8';
    }).join('\n');
  }

  function analyzeStaticComplexity(prog, targetFn) {
    let totalBlocks = 0;
    let maxLoopDepth = 0;
    let hasRecursion = false;
    let totalLoops = 0;
    let totalBranches = 0;

    const walkDepth = (list, depth) => {
      for (const s of list || []) {
        totalBlocks++;
        if (s.kind === 'while' || s.kind === 'for' || s.kind === 'do') {
          totalLoops++;
          const nd = depth + 1;
          if (nd > maxLoopDepth) maxLoopDepth = nd;
          walkDepth(s.body, nd);
        } else if (s.kind === 'if') {
          totalBranches++;
          walkDepth(s.then, depth);
          walkDepth(s.else, depth);
        } else if (s.kind === 'try') {
          totalBranches++;
          walkDepth(s.body, depth);
          for (const c of s.catches || []) walkDepth(c.body, depth);
          walkDepth(s.finally, depth);
        }
      }
    };

    const funcsToInspect = targetFn ? [targetFn] : (prog && prog.functions) || [];
    for (const f of funcsToInspect) {
      walkDepth(f.body, 0);
      if (f.name && f.name.toLowerCase() !== 'main') {
        const re = new RegExp(`(^|[^\\w.])${f.name}\\s*\\(`, 'i');
        ModelLib.walk(f.body, (s) => {
          for (const k of ['expression', 'start', 'end']) {
            if (typeof s[k] === 'string' && re.test(s[k])) hasRecursion = true;
          }
        });
      }
    }

    let bigO = 'O(1)';
    let bigODesc = L('pa.cxBigOConst');
    if (hasRecursion) {
      bigO = maxLoopDepth > 0 ? 'O(n · f(n))' : 'O(n) / O(2ⁿ)';
      bigODesc = L('pa.cxBigORec');
    } else if (maxLoopDepth === 1) {
      bigO = 'O(n)';
      bigODesc = L('pa.cxBigOLinear');
    } else if (maxLoopDepth === 2) {
      bigO = 'O(n²)';
      bigODesc = L('pa.cxBigOQuad');
    } else if (maxLoopDepth >= 3) {
      bigO = `O(n^${maxLoopDepth})`;
      bigODesc = L('pa.cxBigOPoly', { k: maxLoopDepth });
    }

    return {
      totalBlocks,
      maxLoopDepth,
      totalLoops,
      totalBranches,
      hasRecursion,
      bigO,
      bigODesc
    };
  }

  FlowLabPlugins.register({
    id: 'complexity-analyzer',
    getName: () => L('pa.cxName'),
    getDesc: () => L('pa.cxDesc'),
    getShortLabel: () => L('pa.cxShort'),
    version: '1.1',
    author: 'FlowLab Team',
    iconSvg: ICON_COMPLEXITY_SVG,
    showInDock: true,
    dockBtnId: 'plugBtnComplexity',
    preinstalled: true,
    defaultInstalled: true,
    defaultEnabled: false,

    onOpen(ctx) {
      if (!ctx.ui || !ctx.ui.openModal || !ctx.ui.h || !ctx.prog) return;
      const { openModal, h } = ctx.ui;
      const prog = ctx.prog;
      const fl = ctx.flowlab;

      const testableFuncs = prog.functions
        .map((fn, fi) => ({ fn, fi }))
        .filter(({ fn }) => !fn.abstract && !fn.ctor);

      let curFi = (fl && fl.state && typeof fl.state.fi === 'number' && !prog.functions[fl.state.fi].abstract && !prog.functions[fl.state.fi].ctor)
        ? fl.state.fi
        : 0;
      const curFn = () => prog.functions[curFi] || prog.functions[0];

      const fnSelect = h('select', { class: 'fsel', id: 'cxFuncSelect' });
      for (const { fn, fi } of testableFuncs) {
        const mod = ModelLib.moduleOfFunc(prog, fn);
        const label = formatFuncSignature(prog, fn) + (mod ? ` [${mod.name}]` : '');
        fnSelect.append(h('option', { value: String(fi), selected: fi === curFi ? 'selected' : null }, label));
      }

      const paramHintEl = h('p', { class: 'muted small', style: 'margin:4px 0 0;' });
      const staticBannerBox = h('div', { class: 'cx-static-banner' });
      const benchInput = h('textarea', { rows: 2, class: 'mono', placeholder: L('pa.cxInputPh') });
      const dynamicBox = h('div', { class: 'cx-dyn-box' });

      const renderStatic = () => {
        staticBannerBox.innerHTML = '';
        const stInfo = analyzeStaticComplexity(prog, curFn());
        staticBannerBox.append(
          h('div', { class: 'cx-bigo mono' }, stInfo.bigO),
          h('div', { class: 'cx-bigo-info' },
            h('strong', null, stInfo.bigODesc),
            h('span', { class: 'muted small' },
              L('pa.cxStaticSummary', {
                blocks: stInfo.totalBlocks,
                loops: stInfo.totalLoops,
                depth: stInfo.maxLoopDepth,
                branches: stInfo.totalBranches
              })
            )
          )
        );
      };

      const renderDynamic = (res) => {
        dynamicBox.innerHTML = '';
        const s = res.stats;
        const metrics = [
          [L('pa.cxMetricSteps'), s.steps],
          [L('pa.cxMetricComparisons'), s.comparisons],
          [L('pa.cxMetricLoops'), s.loopIterations],
          [L('pa.cxMetricAssigns'), s.assignments],
          [L('pa.cxMetricCalls'), `${s.calls} (stack max: ${s.maxDepth})`],
          [L('pa.cxMetricMem'), `${s.memCells} ${L('pa.cxCellsUnit')}`]
        ];

        const grid = h('div', { class: 'cx-grid' },
          ...metrics.map(([label, val]) =>
            h('div', { class: 'cx-stat' },
              h('span', { class: 'cx-stat-val mono' }, String(val)),
              h('span', { class: 'cx-stat-lbl muted small' }, label)
            )
          )
        );

        const tot = Math.max(1, s.steps);
        const barsData = [
          [L('pa.cxBarDecl'), s.byKind.declare],
          [L('pa.cxBarAssign'), s.byKind.assign],
          [L('pa.cxBarIf'), s.byKind.if],
          [L('pa.cxBarLoop'), s.byKind.loop],
          [L('pa.cxBarIo'), s.byKind.io],
          [L('pa.cxBarCall'), s.byKind.call]
        ];

        const bars = h('div', { class: 'cx-bars' },
          ...barsData.map(([label, count]) => {
            const pct = Math.min(100, Math.round((count / tot) * 100));
            return h('div', { class: 'cx-bar-row' },
              h('span', { class: 'cx-bar-lbl small' }, label),
              h('div', { class: 'cx-bar-track' }, h('div', { class: 'cx-bar-fill', style: `width:${pct}%` })),
              h('span', { class: 'cx-bar-num mono small' }, `${count} (${pct}%)`)
            );
          })
        );

        dynamicBox.append(
          res.error ? h('p', { class: 'cx-note warn small' }, `⚠ ${res.error}`) : null,
          grid,
          h('h4', { class: 'cx-subh' }, L('pa.cxBreakdownTitle')),
          bars
        );
      };

      const onTargetChange = () => {
        const fn = curFn();
        const params = fn.params || [];
        if (params.length > 0) {
          const sig = params.map((p, i) => `${i + 1}) ${p.name}: ${ExprLib.typeName(p.type)}${arrayDimsSuffix(p)}`).join(' · ');
          paramHintEl.textContent = L('pa.paramsHint', { count: params.length, sig });
          benchInput.value = buildSampleInputsForFunc(fn);
        } else {
          paramHintEl.textContent = L('pa.noParamsHint');
          benchInput.value = '';
        }
        renderStatic();
        renderDynamic(ctx.runHeadless(prog, benchInput.value, { funcIndex: curFi }));
      };

      fnSelect.addEventListener('change', () => {
        curFi = Number(fnSelect.value) || 0;
        onTargetChange();
      });

      onTargetChange();

      const body = h('div', { class: 'fields cx-dialog' },
        h('p', { class: 'help' }, L('pa.cxIntro')),
        h('label', { class: 'field' },
          h('span', { class: 'flabel' }, L('pa.targetFuncLbl')),
          fnSelect,
          paramHintEl
        ),
        h('h3', { class: 'modh' }, L('pa.cxStaticTitle')),
        staticBannerBox,
        h('h3', { class: 'modh' }, L('pa.cxDynamicTitle')),
        h('div', { class: 'cx-bench-bar' },
          benchInput,
          h('button', {
            type: 'button',
            class: 'btn small primary',
            id: 'cxRunProfileBtn',
            onclick: () => renderDynamic(ctx.runHeadless(prog, benchInput.value, { funcIndex: curFi }))
          }, '▶ ' + L('pa.cxRunProfile'))
        ),
        dynamicBox
      );

      openModal({
        title: L('pa.cxName'),
        body,
        wide: true,
        okText: L('win.close'),
        noCancel: true
      });
    }
  });
})();
