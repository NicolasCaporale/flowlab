/* ==========================================================================
   FlowLab Plugin — Confronta Algoritmi & Grafico Prestazioni (modules/plugin/benchmark.js)
   Plugin autonomo registrato tramite `FlowLabPlugins.register(...)`.
   Preinstallato ma NON preattivato di default (`defaultInstalled: true, defaultEnabled: false`).
   Esegue due funzioni/algoritmi (es. linearSearch vs binarySearch, oppure
   bubbleSort vs insertionSort) al crescere della dimensione N dell'input e
   disegna il grafico SVG delle curve di crescita + tabella comparativa.
   ========================================================================== */
'use strict';

(() => {
  if (typeof FlowLabPlugins === 'undefined' || !FlowLabPlugins.register) return;

  const ICON_BENCHMARK_SVG = '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 16l4-5 4 2 5-7"/><path d="M7 19l5-2 4-3 4-3" stroke-dasharray="2 2"/></svg>';

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

  /* Genera un vettore deterministico di dimensione N secondo la distribuzione scelta */
  function makeDatasetArray(n, mode) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      if (mode === 'sorted') {
        arr.push(i * 3 + 2);
      } else if (mode === 'reverse') {
        arr.push((n - i) * 3);
      } else {
        // Pseudo-random deterministico così Algoritmo A e Algoritmo B ricevono gli stessi identici dati
        arr.push(((i * 37 + 13) * 17) % (n * 4 + 11));
      }
    }
    return arr;
  }

  /* Genera un letterale array a `dims` dimensioni di lato `n` */
  function makeMultiDimArrayStr(n, dims, mode) {
    if (dims <= 1) {
      return '{' + makeDatasetArray(n, mode).join(', ') + '}';
    }
    const side = Math.max(1, Math.min(n, dims === 2 ? 24 : 6));
    const build = (d, seed) => {
      if (d === dims - 1) {
        const row = makeDatasetArray(side, mode).map((v, i) => v + seed * (i + 1));
        return '{' + row.join(', ') + '}';
      }
      const parts = [];
      for (let i = 0; i < side; i++) parts.push(build(d + 1, seed * side + i + 1));
      return '{' + parts.join(', ') + '}';
    };
    return build(0, 0);
  }

  /* Costruisce l'input testuale per una funzione `fn` alla dimensione `n` */
  function buildInputForSize(fn, n, datasetMode) {
    const params = fn.params || [];
    const arr = makeDatasetArray(n, datasetMode);
    const arrStr = '{' + arr.join(', ') + '}';

    if (!params.length) {
      // Per Main o funzioni senza parametri che leggono N e poi N valori da Input
      return [String(n), ...arr.map(String)].join('\n');
    }

    const lines = [];
    params.forEach((p, idx) => {
      const b = ExprLib.splitType(p.type).base;
      if (p.array) {
        const d = Math.max(1, Number(p.dims) || 1);
        lines.push(makeMultiDimArrayStr(n, d, datasetMode));
      } else if (/^(ArrayList|Stack|Queue)$/i.test(b)) {
        lines.push(arrStr);
      } else if (/^Integer$/i.test(b)) {
        // Se è il parametro dimensione (n) subito dopo un array, passa N
        if (idx > 0 && params[idx - 1].array && /^(n|dim|len|length|size)$/i.test(p.name)) {
          lines.push(String(n));
        } else if (idx >= 1 && params.some((x) => x.array)) {
          // Parametro elemento da cercare (es. x in linearSearch / binarySearch):
          // usiamo l'ultimo elemento dell'array (o un valore assente) per misurare il comportamento reale
          const targetVal = arr.length ? arr[arr.length - 1] : n;
          lines.push(String(targetVal));
        } else {
          lines.push(String(n));
        }
      } else if (/^Real$/i.test(b)) {
        lines.push(String(n));
      } else if (/^String$/i.test(b)) {
        lines.push(`"${'a'.repeat(Math.min(n, 50))}"`);
      } else if (/^Boolean$/i.test(b)) {
        lines.push('true');
      } else {
        lines.push(String(n));
      }
    });
    return lines.join('\n');
  }

  /* Disegna il grafico SVG cartesiano a due curve */
  function buildBenchmarkSvg(points, labelA, labelB, metricLabel) {
    const W = 620, H = 250;
    const padL = 54, padR = 24, padT = 26, padB = 38;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const maxVal = Math.max(
      1,
      ...points.map((p) => Math.max(p.valA || 0, p.valB != null ? p.valB : 0))
    );

    const xAt = (i) => (points.length <= 1 ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW);
    const yAt = (v) => padT + plotH - (Math.min(maxVal, Math.max(0, v)) / maxVal) * plotH;

    let gridSvg = '';
    const ticks = 4;
    for (let t = 0; t <= ticks; t++) {
      const val = Math.round((maxVal * t) / ticks);
      const y = yAt(val);
      gridSvg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--line-soft)" stroke-width="1"/>`;
      gridSvg += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="var(--muted)" font-family="var(--font-mono)">${val}</text>`;
    }

    points.forEach((pt, i) => {
      const x = xAt(i);
      gridSvg += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="var(--line-soft)" stroke-width="1" stroke-dasharray="3 3"/>`;
      gridSvg += `<text x="${x}" y="${H - 12}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--ink)" font-family="var(--font-mono)">N=${pt.n}</text>`;
    });

    const pathA = points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(pt.valA).toFixed(1)}`).join(' ');
    const dotsA = points.map((pt, i) => {
      const cx = xAt(i).toFixed(1), cy = yAt(pt.valA).toFixed(1);
      return `<circle cx="${cx}" cy="${cy}" r="4.5" fill="#0c6c80" stroke="var(--paper)" stroke-width="1.5"><title>${labelA} (N=${pt.n}): ${pt.valA}</title></circle>` +
        `<text x="${cx}" y="${Math.max(14, cy - 8)}" text-anchor="middle" font-size="10" font-weight="700" fill="#0c6c80" font-family="var(--font-mono)">${pt.valA}</text>`;
    }).join('');

    let pathB = '', dotsB = '';
    const hasB = points.some((pt) => pt.valB != null);
    if (hasB) {
      pathB = `<path d="${points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(pt.valB).toFixed(1)}`).join(' ')}" fill="none" stroke="#d9822b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      dotsB = points.map((pt, i) => {
        const cx = xAt(i).toFixed(1), cy = yAt(pt.valB).toFixed(1);
        return `<circle cx="${cx}" cy="${cy}" r="4.5" fill="#d9822b" stroke="var(--paper)" stroke-width="1.5"><title>${labelB} (N=${pt.n}): ${pt.valB}</title></circle>` +
          `<text x="${cx}" y="${Math.min(padT + plotH - 4, Number(cy) + 14)}" text-anchor="middle" font-size="10" font-weight="700" fill="#d9822b" font-family="var(--font-mono)">${pt.valB}</text>`;
      }).join('');
    }

    return `<svg class="bm-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${metricLabel}">
      <rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="var(--paper)" stroke="var(--line)"/>
      ${gridSvg}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="var(--line)" stroke-width="1.5"/>
      <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="var(--line)" stroke-width="1.5"/>
      <path d="${pathA}" fill="none" stroke="#0c6c80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${pathB}
      ${dotsA}
      ${dotsB}
    </svg>`;
  }

  FlowLabPlugins.register({
    id: 'algorithm-benchmark',
    getName: () => L('pa.bmName'),
    getDesc: () => L('pa.bmDesc'),
    getShortLabel: () => L('pa.bmShort'),
    version: '1.0',
    author: 'FlowLab Team',
    iconSvg: ICON_BENCHMARK_SVG,
    showInDock: true,
    dockBtnId: 'plugBtnBenchmark',
    // Preinstallato nella lista "Plugin installati", ma NON preattivato (spunta disattivata di default)
    preinstalled: true,
    defaultInstalled: true,
    defaultEnabled: false,

    onOpen(ctx) {
      if (!ctx.ui || !ctx.ui.openModal || !ctx.ui.h || !ctx.prog) return;
      const { openModal, h, toast } = ctx.ui;
      const prog = ctx.prog;

      const testableFuncs = prog.functions
        .map((fn, fi) => ({ fn, fi }))
        .filter(({ fn }) => !fn.abstract && !fn.ctor);

      // Sceglie di default due funzioni confrontabili (es. due funzioni non-Main se presenti)
      const nonMain = testableFuncs.filter((x) => x.fi > 0);
      let fiA = nonMain.length >= 1 ? nonMain[0].fi : 0;
      let fiB = nonMain.length >= 2 ? nonMain[1].fi : (testableFuncs.length > 1 ? testableFuncs[1].fi : -1);

      const selA = h('select', { class: 'fsel', id: 'bmFuncA' });
      const selB = h('select', { class: 'fsel', id: 'bmFuncB' });
      selB.append(h('option', { value: '-1', selected: fiB === -1 ? 'selected' : null }, L('pa.bmNoneOption')));

      for (const { fn, fi } of testableFuncs) {
        const mod = ModelLib.moduleOfFunc(prog, fn);
        const label = formatFuncSignature(prog, fn) + (mod ? ` [${mod.name}]` : '');
        selA.append(h('option', { value: String(fi), selected: fi === fiA ? 'selected' : null }, label));
        selB.append(h('option', { value: String(fi), selected: fi === fiB ? 'selected' : null }, label));
      }

      const selDataset = h('select', { class: 'fsel', id: 'bmDatasetMode' },
        h('option', { value: 'sorted' }, L('pa.bmDataSorted')),
        h('option', { value: 'random' }, L('pa.bmDataRandom')),
        h('option', { value: 'reverse' }, L('pa.bmDataReverse'))
      );

      const selMetric = h('select', { class: 'fsel', id: 'bmMetricMode' },
        h('option', { value: 'steps' }, L('pa.cxMetricSteps')),
        h('option', { value: 'comparisons' }, L('pa.cxMetricComparisons')),
        h('option', { value: 'assignments' }, L('pa.cxMetricAssigns')),
        h('option', { value: 'loopIterations' }, L('pa.cxMetricLoops'))
      );

      const sizesInput = h('input', {
        type: 'text',
        class: 'mono',
        id: 'bmSizesInput',
        value: '4, 8, 16, 32, 48'
      });

      const chartBox = h('div', { class: 'bm-chart-box' });
      const verdictBar = h('div', { class: 'bm-verdict', hidden: true });
      const tableBox = h('div', { class: 'bm-table-box' });

      const runComparison = () => {
        const idxA = Number(selA.value) || 0;
        const idxB = Number(selB.value);
        const fnA = prog.functions[idxA] || prog.functions[0];
        const fnB = idxB >= 0 ? prog.functions[idxB] : null;
        const dataMode = selDataset.value;
        const metricKey = selMetric.value;
        const metricLabel = selMetric.options[selMetric.selectedIndex].textContent;

        const sizes = sizesInput.value
          .split(/[,\s]+/)
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n) && n >= 1 && n <= 300)
          .slice(0, 8);

        if (!sizes.length) {
          if (toast) toast(L('pa.bmInvalidSizes'), 'warn');
          return;
        }

        const points = sizes.map((n) => {
          const inA = buildInputForSize(fnA, n, dataMode);
          const rA = ctx.runHeadless(prog, inA, { funcIndex: idxA, maxSteps: 60000 });
          let rB = null;
          if (fnB) {
            const inB = buildInputForSize(fnB, n, dataMode);
            rB = ctx.runHeadless(prog, inB, { funcIndex: idxB, maxSteps: 60000 });
          }
          return {
            n,
            valA: rA.stats[metricKey] || 0,
            errA: rA.error,
            valB: rB ? (rB.stats[metricKey] || 0) : null,
            errB: rB ? rB.error : null
          };
        });

        const nameA = fnA.name || 'Main';
        const nameB = fnB ? fnB.name : '';

        chartBox.innerHTML = '';
        const legend = h('div', { class: 'bm-legend' },
          h('span', { class: 'bm-leg-item' }, h('i', { class: 'bm-dot a' }), h('strong', null, nameA)),
          fnB ? h('span', { class: 'bm-leg-item' }, h('i', { class: 'bm-dot b' }), h('strong', null, nameB)) : null,
          h('span', { class: 'grow' }),
          h('span', { class: 'muted small' }, metricLabel)
        );
        const svgWrap = h('div', { html: buildBenchmarkSvg(points, nameA, nameB, metricLabel) });
        chartBox.append(legend, svgWrap);

        // Verdetto sull'ultima dimensione N
        const last = points[points.length - 1];
        if (fnB && last && last.valA !== last.valB) {
          verdictBar.hidden = false;
          const winner = last.valA < last.valB ? nameA : nameB;
          const loser = last.valA < last.valB ? nameB : nameA;
          const minV = Math.min(last.valA, last.valB);
          const maxV = Math.max(1, Math.max(last.valA, last.valB));
          const pct = Math.round(((maxV - minV) / maxV) * 100);
          verdictBar.textContent = L('pa.bmVerdictText', {
            n: last.n,
            winner,
            pct,
            loser,
            min: minV,
            max: maxV
          });
        } else {
          verdictBar.hidden = true;
        }

        // Tabella comparativa
        tableBox.innerHTML = '';
        const tbl = h('table', { class: 'ref bm-table' },
          h('thead', null,
            h('tr', null,
              h('th', null, 'N'),
              h('th', null, `${nameA} (${metricLabel})`),
              fnB ? h('th', null, `${nameB} (${metricLabel})`) : null,
              fnB ? h('th', null, L('pa.bmDiffCol')) : null
            )
          ),
          h('tbody', null,
            ...points.map((pt) => {
              const diff = pt.valB != null ? pt.valA - pt.valB : 0;
              const diffTxt = pt.valB == null ? '' : (diff === 0 ? '=' : (diff > 0 ? `+${diff}` : String(diff)));
              return h('tr', null,
                h('td', { class: 'mono' }, String(pt.n)),
                h('td', { class: 'mono' }, String(pt.valA)),
                fnB ? h('td', { class: 'mono' }, String(pt.valB)) : null,
                fnB ? h('td', { class: 'mono muted' }, diffTxt) : null
              );
            })
          )
        );
        tableBox.append(tbl);
      };

      selA.addEventListener('change', runComparison);
      selB.addEventListener('change', runComparison);
      selDataset.addEventListener('change', runComparison);
      selMetric.addEventListener('change', runComparison);

      runComparison();

      const body = h('div', { class: 'fields bm-dialog' },
        h('p', { class: 'help' }, L('pa.bmIntro')),
        h('div', { class: 'ag-form-row' },
          h('label', { class: 'field' }, h('span', { class: 'flabel' }, L('pa.bmAlgoALbl')), selA),
          h('label', { class: 'field' }, h('span', { class: 'flabel' }, L('pa.bmAlgoBLbl')), selB)
        ),
        h('div', { class: 'bm-controls-row' },
          h('label', { class: 'field' }, h('span', { class: 'flabel' }, L('pa.bmDatasetLbl')), selDataset),
          h('label', { class: 'field' }, h('span', { class: 'flabel' }, L('pa.bmMetricLbl')), selMetric),
          h('label', { class: 'field' }, h('span', { class: 'flabel' }, L('pa.bmSizesLbl')), sizesInput),
          h('button', {
            type: 'button',
            class: 'btn small primary',
            id: 'bmRunBtn',
            onclick: runComparison
          }, '▶ ' + L('pa.bmRunBtn'))
        ),
        verdictBar,
        chartBox,
        tableBox
      );

      openModal({
        title: L('pa.bmName'),
        body,
        wide: true,
        okText: L('win.close'),
        noCancel: true
      });
    }
  });
})();
