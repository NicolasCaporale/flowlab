/* ==========================================================================
   FlowLab Plugin — Visualizzatore Forme & Disegno 2D (modules/plugin/canvas.js)
   Plugin autonomo registrato tramite `FlowLabPlugins.register(...)`.
   Preinstallato ma disabilitato di default (`defaultInstalled: true, defaultEnabled: false`).
   Ispeziona gli oggetti creati dal programma (es. `Disegno` / `Drawing`,
   `Rettangolo` / `Rectangle`, `Quadrato` / `Square`, `Cerchio` / `Circle`,
   `Triangolo` / `Triangle`, `Ellisse` / `Ellipse`, `Rombo`, `Poligono`,
   `Punto` / `Point`, `Segmento` / `Line`), oppure le variabili e l'output,
   e li disegna in scala reale su un canvas SVG tecnico interattivo con
   griglia quadrettata, quote delle dimensioni, area e perimetro.
   ========================================================================== */
'use strict';

(() => {
  if (typeof FlowLabPlugins === 'undefined' || !FlowLabPlugins.register) return;

  const ICON_CANVAS_SVG = '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="10" height="8" rx="1.5"/><circle cx="16.5" cy="15.5" r="4.5"/><path d="M9 19l3.5-6 3.5 6z"/></svg>';

  const PALETTE = [
    { stroke: '#0c6c80', fill: 'rgba(12, 108, 128, 0.16)', badge: '#0c6c80' },
    { stroke: '#7c3aed', fill: 'rgba(124, 58, 237, 0.16)', badge: '#7c3aed' },
    { stroke: '#d9822b', fill: 'rgba(217, 130, 43, 0.17)', badge: '#d9822b' },
    { stroke: '#15803d', fill: 'rgba(21, 128, 61, 0.16)', badge: '#15803d' },
    { stroke: '#be123c', fill: 'rgba(190, 18, 60, 0.15)', badge: '#be123c' },
    { stroke: '#0369a1', fill: 'rgba(3, 105, 161, 0.16)', badge: '#0369a1' },
    { stroke: '#b45309', fill: 'rgba(180, 83, 9, 0.16)', badge: '#b45309' },
    { stroke: '#4f46e5', fill: 'rgba(79, 70, 229, 0.16)', badge: '#4f46e5' }
  ];

  const round2 = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0';
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.00$/, '');
  };

  const escSvg = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  /* Legge un campo scalare (numero o stringa) da un oggetto runtime di FlowLab */
  function getObjFieldVal(obj, names) {
    if (!obj || !obj.fields) return undefined;
    for (const nm of names) {
      const cell = obj.fields.get(nm.toLowerCase());
      if (cell && !cell.array && cell.value !== undefined) {
        return cell.value.v;
      }
    }
    return undefined;
  }

  function getObjFieldNum(obj, names) {
    const v = getObjFieldVal(obj, names);
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function getObjFieldStr(obj, names) {
    const v = getObjFieldVal(obj, names);
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  }

  function getObjFieldObj(obj, names) {
    if (!obj || !obj.fields) return null;
    for (const nm of names) {
      const cell = obj.fields.get(nm.toLowerCase());
      if (cell && !cell.array && cell.value && cell.value.t === 'Object' && cell.value.v) {
        return cell.value.v;
      }
    }
    return null;
  }

  /* Converte un oggetto runtime di FlowLab in un descrittore geometrico normalizzato, se è una forma */
  function parseShapeFromRuntimeObject(obj, varHint = '') {
    if (!obj || !obj.cls || !obj.fields) return null;
    const clsName = String(obj.cls.name || '');
    const clsLow = clsName.toLowerCase();
    const customLabel = getObjFieldStr(obj, ['nome', 'name', 'etichetta', 'label', 'titolo', 'title']);
    const labelLow = (customLabel || '').toLowerCase();
    const posX = getObjFieldNum(obj, ['x', 'cx', 'posx']);
    const posY = getObjFieldNum(obj, ['y', 'cy', 'posy']);

    // 1. Cerchio / Circle / Circonferenza
    const r = getObjFieldNum(obj, ['raggio', 'radius', 'r']);
    if ((/cerchio|circle|circonferenza|disco/i.test(clsLow) || /cerchio|circle/i.test(labelLow)) && r != null && r > 0) {
      const area = Math.PI * r * r;
      const perimeter = 2 * Math.PI * r;
      return {
        kind: 'circle',
        className: clsName,
        title: customLabel ? `${clsName} (${customLabel})` : clsName,
        r,
        w: r * 2,
        h: r * 2,
        x: posX,
        y: posY,
        area,
        perimeter,
        dimsText: `r = ${round2(r)} (⌀ = ${round2(r * 2)})`,
        formulaText: `A = π·r² = ${round2(area)} · P = 2π·r = ${round2(perimeter)}`
      };
    }

    // 2. Quadrato / Square (anche quando eredita da Rettangolo con base e altezza)
    const side = getObjFieldNum(obj, ['lato', 'side', 'l']);
    const base = getObjFieldNum(obj, ['base', 'width', 'larghezza', 'w', 'b']);
    const height = getObjFieldNum(obj, ['altezza', 'height', 'h']);
    const isSquareClass = /quadrato|square/i.test(clsLow) || /quadrato|square/i.test(labelLow);

    if (isSquareClass) {
      const s = side != null && side > 0 ? side : (base != null && base > 0 ? base : (height != null && height > 0 ? height : null));
      if (s != null && s > 0) {
        const area = s * s;
        const perimeter = 4 * s;
        return {
          kind: 'square',
          className: clsName,
          title: customLabel ? `${clsName} (${customLabel})` : clsName,
          side: s,
          w: s,
          h: s,
          x: posX,
          y: posY,
          area,
          perimeter,
          dimsText: `l = ${round2(s)}`,
          formulaText: `A = l² = ${round2(area)} · P = 4·l = ${round2(perimeter)}`
        };
      }
    }

    // 3. Triangolo / Triangle
    if (/triangolo|triangle/i.test(clsLow) || /triangolo|triangle/i.test(labelLow)) {
      const tb = base != null && base > 0 ? base : (side != null && side > 0 ? side : 4);
      const th = height != null && height > 0 ? height : (tb * Math.sqrt(3)) / 2;
      const l1 = getObjFieldNum(obj, ['lato1', 'a', 'side1']) || tb;
      const l2 = getObjFieldNum(obj, ['lato2', 'b', 'side2']) || Math.hypot(tb / 2, th);
      const l3 = getObjFieldNum(obj, ['lato3', 'c', 'side3']) || Math.hypot(tb / 2, th);
      const area = (tb * th) / 2;
      const perimeter = l1 + l2 + l3;
      return {
        kind: 'triangle',
        className: clsName,
        title: customLabel ? `${clsName} (${customLabel})` : clsName,
        w: tb,
        h: th,
        x: posX,
        y: posY,
        area,
        perimeter,
        dimsText: `b = ${round2(tb)}, h = ${round2(th)}`,
        formulaText: `A = (b·h)/2 = ${round2(area)} · P = ${round2(perimeter)}`
      };
    }

    // 4. Rettangolo / Rectangle
    if ((/rettangolo|rectangle|rect/i.test(clsLow) || /rettangolo|rectangle/i.test(labelLow) || (base != null && height != null)) && base != null && height != null && base > 0 && height > 0) {
      const area = base * height;
      const perimeter = 2 * (base + height);
      const isSq = Math.abs(base - height) < 1e-9 && isSquareClass;
      return {
        kind: isSq ? 'square' : 'rect',
        className: clsName,
        title: customLabel ? `${clsName} (${customLabel})` : clsName,
        w: base,
        h: height,
        side: isSq ? base : undefined,
        x: posX,
        y: posY,
        area,
        perimeter,
        dimsText: `b = ${round2(base)}, h = ${round2(height)}`,
        formulaText: `A = b·h = ${round2(area)} · P = 2·(b+h) = ${round2(perimeter)}`
      };
    }

    // 5. Quadrato definito solo tramite attributo `lato`/`side`
    if (side != null && side > 0 && !/poligono|polygon|esagono|pentagono|ottagono|rombo/i.test(clsLow)) {
      const area = side * side;
      const perimeter = 4 * side;
      return {
        kind: 'square',
        className: clsName,
        title: customLabel ? `${clsName} (${customLabel})` : clsName,
        side,
        w: side,
        h: side,
        x: posX,
        y: posY,
        area,
        perimeter,
        dimsText: `l = ${round2(side)}`,
        formulaText: `A = l² = ${round2(area)} · P = 4·l = ${round2(perimeter)}`
      };
    }

    // 6. Cerchio definito solo tramite attributo `raggio`/`radius`
    if (r != null && r > 0 && !/poligono|polygon|esagono|pentagono|ottagono/i.test(clsLow)) {
      const area = Math.PI * r * r;
      const perimeter = 2 * Math.PI * r;
      return {
        kind: 'circle',
        className: clsName,
        title: customLabel ? `${clsName} (${customLabel})` : clsName,
        r,
        w: r * 2,
        h: r * 2,
        x: posX,
        y: posY,
        area,
        perimeter,
        dimsText: `r = ${round2(r)} (⌀ = ${round2(r * 2)})`,
        formulaText: `A = π·r² = ${round2(area)} · P = 2π·r = ${round2(perimeter)}`
      };
    }

    // 7. Ellisse / Ellipse
    const rx = getObjFieldNum(obj, ['rx', 'semiassex', 'semiasse_x', 'a']);
    const ry = getObjFieldNum(obj, ['ry', 'semiassey', 'semiasse_y', 'b']);
    if ((/ellisse|ellipse/i.test(clsLow) || (rx != null && ry != null)) && rx != null && ry != null && rx > 0 && ry > 0) {
      const area = Math.PI * rx * ry;
      const perimeter = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
      return {
        kind: 'ellipse',
        className: clsName,
        title: customLabel ? `${clsName} (${customLabel})` : clsName,
        rx,
        ry,
        w: rx * 2,
        h: ry * 2,
        x: posX,
        y: posY,
        area,
        perimeter,
        dimsText: `rx = ${round2(rx)}, ry = ${round2(ry)}`,
        formulaText: `A = π·rx·ry = ${round2(area)}`
      };
    }

    // 8. Rombo / Rhombus
    const d1 = getObjFieldNum(obj, ['d1', 'diagonalemaggiore', 'diag1', 'd']);
    const d2 = getObjFieldNum(obj, ['d2', 'diagonaleminore', 'diag2']);
    if ((/rombo|rhombus/i.test(clsLow) || (d1 != null && d2 != null)) && d1 != null && d2 != null && d1 > 0 && d2 > 0) {
      const area = (d1 * d2) / 2;
      const sideR = Math.hypot(d1 / 2, d2 / 2);
      const perimeter = 4 * sideR;
      return {
        kind: 'rhombus',
        className: clsName,
        title: customLabel ? `${clsName} (${customLabel})` : clsName,
        w: d1,
        h: d2,
        x: posX,
        y: posY,
        area,
        perimeter,
        dimsText: `d₁ = ${round2(d1)}, d₂ = ${round2(d2)}`,
        formulaText: `A = (d₁·d₂)/2 = ${round2(area)} · P = ${round2(perimeter)}`
      };
    }

    // 9. Poligono regolare (Pentagono, Esagono, Ottagono, Poligono)
    if (/poligono|polygon|pentagono|pentagon|esagono|hexagon|ottagono|octagon/i.test(clsLow)) {
      let sides = getObjFieldNum(obj, ['lati', 'sides', 'nlati', 'n']) || 6;
      if (/pentagon/i.test(clsLow)) sides = 5;
      else if (/esagon|hexagon/i.test(clsLow)) sides = 6;
      else if (/ottagon|octagon/i.test(clsLow)) sides = 8;
      sides = Math.max(3, Math.min(20, Math.round(sides)));
      const sLen = side != null && side > 0 ? side : (r != null && r > 0 ? 2 * r * Math.sin(Math.PI / sides) : 3);
      const circumR = sLen / (2 * Math.sin(Math.PI / sides));
      const perimeter = sides * sLen;
      const apothem = sLen / (2 * Math.tan(Math.PI / sides));
      const area = (perimeter * apothem) / 2;
      return {
        kind: 'polygon',
        className: clsName,
        title: customLabel ? `${clsName} (${customLabel})` : clsName,
        sides,
        side: sLen,
        r: circumR,
        w: circumR * 2,
        h: circumR * 2,
        x: posX,
        y: posY,
        area,
        perimeter,
        dimsText: `${sides} lati · l = ${round2(sLen)}`,
        formulaText: `A = ${round2(area)} · P = ${round2(perimeter)}`
      };
    }

    // 10. Segmento / Linea (con x1,y1,x2,y2 o due punti p1,p2)
    if (/segmento|segment|linea|line|vettore|vector/i.test(clsLow)) {
      let x1 = getObjFieldNum(obj, ['x1', 'ax', 'startx']);
      let y1 = getObjFieldNum(obj, ['y1', 'ay', 'starty']);
      let x2 = getObjFieldNum(obj, ['x2', 'bx', 'endx']);
      let y2 = getObjFieldNum(obj, ['y2', 'by', 'endy']);
      const p1 = getObjFieldObj(obj, ['p1', 'a', 'inizio', 'start', 'origine']);
      const p2 = getObjFieldObj(obj, ['p2', 'b', 'fine', 'end', 'dest']);
      if (p1) {
        x1 = getObjFieldNum(p1, ['x']) ?? x1;
        y1 = getObjFieldNum(p1, ['y']) ?? y1;
      }
      if (p2) {
        x2 = getObjFieldNum(p2, ['x']) ?? x2;
        y2 = getObjFieldNum(p2, ['y']) ?? y2;
      }
      if (x1 != null && y1 != null && x2 != null && y2 != null) {
        const len = Math.hypot(x2 - x1, y2 - y1);
        return {
          kind: 'segment',
          className: clsName,
          title: customLabel ? `${clsName} (${customLabel})` : clsName,
          x1,
          y1,
          x2,
          y2,
          w: Math.max(1, Math.abs(x2 - x1)),
          h: Math.max(1, Math.abs(y2 - y1)),
          x: (x1 + x2) / 2,
          y: (y1 + y2) / 2,
          area: 0,
          perimeter: len,
          dimsText: `(${round2(x1)}, ${round2(y1)}) → (${round2(x2)}, ${round2(y2)})`,
          formulaText: `L = ${round2(len)}`
        };
      }
    }

    // 11. Punto / Point
    if ((/punto|point|coord/i.test(clsLow) || (obj.fields.size === 2 && posX != null && posY != null)) && posX != null && posY != null) {
      return {
        kind: 'point',
        className: clsName,
        title: customLabel ? `${clsName} (${customLabel})` : (varHint ? `${clsName} ${varHint}` : clsName),
        x: posX,
        y: posY,
        w: 1,
        h: 1,
        area: 0,
        perimeter: 0,
        dimsText: `(${round2(posX)}, ${round2(posY)})`,
        formulaText: `x = ${round2(posX)}, y = ${round2(posY)}`
      };
    }

    return null;
  }

  /* Esplora ricorsivamente le variabili e gli oggetti in memoria per raccogliere tutte le forme */
  function collectShapesFromFrames(frames) {
    const shapes = [];
    const seenObjIds = new Set();

    const visitObject = (obj, hintName) => {
      if (!obj || typeof obj !== 'object') return;
      const oid = obj.id || obj;
      if (seenObjIds.has(oid)) return;
      seenObjIds.add(oid);

      const directShape = parseShapeFromRuntimeObject(obj, hintName);
      if (directShape) {
        shapes.push(directShape);
        return;
      }

      if (!obj.fields) return;

      // Controlla se è un contenitore (es. Disegno / Drawing / ArrayList / Scena) con un contatore di elementi
      const countLimit = getObjFieldNum(obj, ['quante', 'count', 'n', 'size', 'num', 'lunghezza']);

      for (const [fKey, fCell] of obj.fields.entries()) {
        if (!fCell) continue;
        if (fCell.array && Array.isArray(fCell.items)) {
          const maxItems = (countLimit != null && countLimit >= 0 && countLimit <= fCell.items.length)
            ? countLimit
            : fCell.items.length;
          for (let i = 0; i < maxItems; i++) {
            const it = fCell.items[i];
            if (it && it.t === 'Object' && it.v) {
              visitObject(it.v, `${fKey}[${i}]`);
            }
          }
        } else if (fCell.value && fCell.value.t === 'Object' && fCell.value.v) {
          visitObject(fCell.value.v, fKey);
        }
      }
    };

    for (const fr of frames || []) {
      if (!fr) continue;
      if (fr.thisObj) visitObject(fr.thisObj, 'this');
      if (!fr.vars) continue;
      for (const [vKey, cell] of fr.vars.entries()) {
        if (!cell) continue;
        if (cell.array && Array.isArray(cell.items)) {
          cell.items.forEach((it, idx) => {
            if (it && it.t === 'Object' && it.v) visitObject(it.v, `${vKey}[${idx}]`);
          });
        } else if (cell.value && cell.value.t === 'Object' && cell.value.v) {
          visitObject(cell.value.v, cell.name || vKey);
        }
      }
    }

    // Fallback procedurale: se non ci sono oggetti OOP, controlla se il programma ha variabili scalari geometriche (es. base + altezza, raggio, lato)
    if (!shapes.length && frames && frames.length) {
      const scalarMap = new Map();
      for (const fr of frames) {
        if (!fr || !fr.vars) continue;
        for (const [k, cell] of fr.vars.entries()) {
          if (cell && !cell.array && cell.value && (cell.value.t === 'Integer' || cell.value.t === 'Real')) {
            scalarMap.set(k.toLowerCase(), Number(cell.value.v));
          }
        }
      }
      const getS = (names) => {
        for (const n of names) {
          if (scalarMap.has(n)) {
            const v = scalarMap.get(n);
            if (Number.isFinite(v) && v > 0) return v;
          }
        }
        return null;
      };
      const b = getS(['base', 'larghezza', 'width']);
      const h = getS(['altezza', 'height']);
      const l = getS(['lato', 'side']);
      const r = getS(['raggio', 'radius']);
      if (b != null && h != null) {
        shapes.push({
          kind: 'rect',
          className: 'Rettangolo',
          title: 'Rettangolo',
          w: b,
          h,
          area: b * h,
          perimeter: 2 * (b + h),
          dimsText: `b = ${round2(b)}, h = ${round2(h)}`,
          formulaText: `A = ${round2(b * h)} · P = ${round2(2 * (b + h))}`
        });
      }
      if (l != null) {
        shapes.push({
          kind: 'square',
          className: 'Quadrato',
          title: 'Quadrato',
          side: l,
          w: l,
          h: l,
          area: l * l,
          perimeter: 4 * l,
          dimsText: `l = ${round2(l)}`,
          formulaText: `A = ${round2(l * l)} · P = ${round2(4 * l)}`
        });
      }
      if (r != null) {
        shapes.push({
          kind: 'circle',
          className: 'Cerchio',
          title: 'Cerchio',
          r,
          w: r * 2,
          h: r * 2,
          area: Math.PI * r * r,
          perimeter: 2 * Math.PI * r,
          dimsText: `r = ${round2(r)}`,
          formulaText: `A = ${round2(Math.PI * r * r)} · P = ${round2(2 * Math.PI * r)}`
        });
      }
    }

    return shapes;
  }

  /* Fallback statico sull'AST: estrae espressioni `new Rettangolo(3, 2)`, `new Quadrato(4)`, `new Cerchio(1.5)` */
  function collectShapesFromProgramAst(prog) {
    const shapes = [];
    if (!prog || !Array.isArray(prog.functions)) return shapes;

    const scanExprText = (txt) => {
      if (!txt) return;
      const re = /\bnew\s+([A-Za-z_]\w*)\s*\(([^()]*)\)/g;
      let m;
      while ((m = re.exec(txt)) !== null) {
        const clsName = m[1];
        const low = clsName.toLowerCase();
        const nums = m[2]
          .split(',')
          .map((s) => parseFloat(s.trim()))
          .filter((n) => Number.isFinite(n));
        if (/rettangolo|rectangle/i.test(low) && nums.length >= 2 && nums[0] > 0 && nums[1] > 0) {
          const [b, h] = nums;
          shapes.push({
            kind: 'rect',
            className: clsName,
            title: clsName,
            w: b,
            h,
            area: b * h,
            perimeter: 2 * (b + h),
            dimsText: `b = ${round2(b)}, h = ${round2(h)}`,
            formulaText: `A = ${round2(b * h)} · P = ${round2(2 * (b + h))}`
          });
        } else if (/quadrato|square/i.test(low) && nums.length >= 1 && nums[0] > 0) {
          const s = nums[0];
          shapes.push({
            kind: 'square',
            className: clsName,
            title: clsName,
            side: s,
            w: s,
            h: s,
            area: s * s,
            perimeter: 4 * s,
            dimsText: `l = ${round2(s)}`,
            formulaText: `A = ${round2(s * s)} · P = ${round2(4 * s)}`
          });
        } else if (/cerchio|circle/i.test(low) && nums.length >= 1 && nums[0] > 0) {
          const r = nums[0];
          shapes.push({
            kind: 'circle',
            className: clsName,
            title: clsName,
            r,
            w: r * 2,
            h: r * 2,
            area: Math.PI * r * r,
            perimeter: 2 * Math.PI * r,
            dimsText: `r = ${round2(r)}`,
            formulaText: `A = ${round2(Math.PI * r * r)} · P = ${round2(2 * Math.PI * r)}`
          });
        } else if (/triangolo|triangle/i.test(low) && nums.length >= 2 && nums[0] > 0 && nums[1] > 0) {
          const [b, h] = nums;
          const hyp = Math.hypot(b / 2, h);
          shapes.push({
            kind: 'triangle',
            className: clsName,
            title: clsName,
            w: b,
            h,
            area: (b * h) / 2,
            perimeter: b + 2 * hyp,
            dimsText: `b = ${round2(b)}, h = ${round2(h)}`,
            formulaText: `A = ${round2((b * h) / 2)} · P = ${round2(b + 2 * hyp)}`
          });
        }
      }
    };

    for (const fn of prog.functions) {
      ModelLib.walk(fn.body, (stmt) => {
        scanExprText(stmt.expression);
        scanExprText(stmt.init);
      });
    }
    return shapes;
  }

  /* Disegna una singola forma centrata in (cx, cy) con fattore di scala `scale` (px per unità) */
  function renderShapeSvgElement(sh, idx, cx, cy, scale, pal, showLabels, selectedIdx) {
    const isSel = selectedIdx === idx;
    const sw = Math.max(18, (sh.w || 1) * scale);
    const shH = Math.max(18, (sh.h || 1) * scale);
    const x0 = cx - sw / 2;
    const y0 = cy - shH / 2;

    let bodySvg = '';
    let quotesSvg = '';

    if (sh.kind === 'circle') {
      const rPx = sw / 2;
      bodySvg = `<circle class="cv-shape-body" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rPx.toFixed(1)}" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="2.4"/>`;
      if (showLabels) {
        // Centro e vettore raggio
        quotesSvg += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.6" fill="${pal.stroke}"/>`;
        quotesSvg += `<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(cx + rPx).toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${pal.stroke}" stroke-width="1.6" stroke-dasharray="3 2"/>`;
        quotesSvg += `<text x="${(cx + rPx / 2).toFixed(1)}" y="${(cy - 6).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${pal.stroke}" font-family="var(--font-mono)">r = ${round2(sh.r)}</text>`;
      }
    } else if (sh.kind === 'ellipse') {
      const rxPx = sw / 2;
      const ryPx = shH / 2;
      bodySvg = `<ellipse class="cv-shape-body" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rxPx.toFixed(1)}" ry="${ryPx.toFixed(1)}" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="2.4"/>`;
      if (showLabels) {
        quotesSvg += `<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(cx + rxPx).toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${pal.stroke}" stroke-width="1.4" stroke-dasharray="3 2"/>`;
        quotesSvg += `<text x="${cx.toFixed(1)}" y="${(cy - 5).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${pal.stroke}" font-family="var(--font-mono)">${escSvg(sh.dimsText)}</text>`;
      }
    } else if (sh.kind === 'triangle') {
      const pts = `${cx.toFixed(1)},${y0.toFixed(1)} ${(x0 + sw).toFixed(1)},${(y0 + shH).toFixed(1)} ${x0.toFixed(1)},${(y0 + shH).toFixed(1)}`;
      bodySvg = `<polygon class="cv-shape-body" points="${pts}" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="2.4" stroke-linejoin="round"/>`;
      if (showLabels) {
        quotesSvg += `<line x1="${cx.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(y0 + shH).toFixed(1)}" stroke="${pal.stroke}" stroke-width="1.3" stroke-dasharray="3 2"/>`;
        quotesSvg += `<text x="${cx.toFixed(1)}" y="${(y0 + shH + 14).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${pal.stroke}" font-family="var(--font-mono)">b = ${round2(sh.w)}</text>`;
        quotesSvg += `<text x="${(cx + 6).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="start" font-size="10.5" font-weight="700" fill="${pal.stroke}" font-family="var(--font-mono)">h = ${round2(sh.h)}</text>`;
      }
    } else if (sh.kind === 'rhombus') {
      const pts = `${cx.toFixed(1)},${y0.toFixed(1)} ${(x0 + sw).toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${(y0 + shH).toFixed(1)} ${x0.toFixed(1)},${cy.toFixed(1)}`;
      bodySvg = `<polygon class="cv-shape-body" points="${pts}" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="2.4" stroke-linejoin="round"/>`;
      if (showLabels) {
        quotesSvg += `<line x1="${x0.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(x0 + sw).toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${pal.stroke}" stroke-width="1.2" stroke-dasharray="3 2"/>`;
        quotesSvg += `<line x1="${cx.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(y0 + shH).toFixed(1)}" stroke="${pal.stroke}" stroke-width="1.2" stroke-dasharray="3 2"/>`;
        quotesSvg += `<text x="${cx.toFixed(1)}" y="${(y0 + shH + 14).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${pal.stroke}" font-family="var(--font-mono)">${escSvg(sh.dimsText)}</text>`;
      }
    } else if (sh.kind === 'polygon') {
      const n = sh.sides || 6;
      const rPx = sw / 2;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        pts.push(`${(cx + rPx * Math.cos(ang)).toFixed(1)},${(cy + rPx * Math.sin(ang)).toFixed(1)}`);
      }
      bodySvg = `<polygon class="cv-shape-body" points="${pts.join(' ')}" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="2.4" stroke-linejoin="round"/>`;
      if (showLabels) {
        quotesSvg += `<text x="${cx.toFixed(1)}" y="${(y0 + shH + 14).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${pal.stroke}" font-family="var(--font-mono)">${escSvg(sh.dimsText)}</text>`;
      }
    } else if (sh.kind === 'point') {
      bodySvg = `<circle class="cv-shape-body" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="${pal.stroke}" stroke="var(--paper)" stroke-width="2"/>`;
      if (showLabels) {
        quotesSvg += `<text x="${cx.toFixed(1)}" y="${(cy - 10).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${pal.stroke}" font-family="var(--font-mono)">${escSvg(sh.dimsText)}</text>`;
      }
    } else if (sh.kind === 'segment') {
      bodySvg = `<line class="cv-shape-body" x1="${x0.toFixed(1)}" y1="${(y0 + shH).toFixed(1)}" x2="${(x0 + sw).toFixed(1)}" y2="${y0.toFixed(1)}" stroke="${pal.stroke}" stroke-width="3" stroke-linecap="round"/>` +
        `<circle cx="${x0.toFixed(1)}" cy="${(y0 + shH).toFixed(1)}" r="4" fill="${pal.stroke}"/>` +
        `<circle cx="${(x0 + sw).toFixed(1)}" cy="${y0.toFixed(1)}" r="4" fill="${pal.stroke}"/>`;
      if (showLabels) {
        quotesSvg += `<text x="${cx.toFixed(1)}" y="${(y0 + shH + 15).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${pal.stroke}" font-family="var(--font-mono)">${escSvg(sh.formulaText)}</text>`;
      }
    } else {
      // Rettangolo o Quadrato
      bodySvg = `<rect class="cv-shape-body" x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${sw.toFixed(1)}" height="${shH.toFixed(1)}" rx="3" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="2.4"/>`;
      if (showLabels) {
        const sqMark = Math.min(8, sw * 0.18, shH * 0.18);
        quotesSvg += `<path d="M ${(x0 + sqMark).toFixed(1)} ${(y0 + shH).toFixed(1)} V ${(y0 + shH - sqMark).toFixed(1)} H ${x0.toFixed(1)}" fill="none" stroke="${pal.stroke}" stroke-width="1.2" opacity="0.75"/>`;
        if (sh.kind === 'square') {
          quotesSvg += `<text x="${cx.toFixed(1)}" y="${(y0 + shH + 14).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${pal.stroke}" font-family="var(--font-mono)">l = ${round2(sh.w)}</text>`;
          quotesSvg += `<text x="${(x0 + sw + 6).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="start" font-size="10.5" font-weight="600" fill="${pal.stroke}" font-family="var(--font-mono)">${round2(sh.h)}</text>`;
        } else {
          quotesSvg += `<text x="${cx.toFixed(1)}" y="${(y0 + shH + 14).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${pal.stroke}" font-family="var(--font-mono)">b = ${round2(sh.w)}</text>`;
          quotesSvg += `<text x="${(x0 + sw + 6).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="start" font-size="11" font-weight="700" fill="${pal.stroke}" font-family="var(--font-mono)">h = ${round2(sh.h)}</text>`;
        }
      }
    }

    return `<g class="cv-shape-group${isSel ? ' selected' : ''}" data-shape-idx="${idx}">
      ${bodySvg}
      ${quotesSvg}
    </g>`;
  }

  /* Costruisce l'intero canvas SVG in base alla modalità: 'gallery', 'cartesian' o 'overlay' */
  function buildShapesCanvasSvg(shapes, opts) {
    const { mode = 'gallery', showGrid = true, showLabels = true, selectedIdx = -1 } = opts || {};
    const W = 680, H = 290;

    let gridDef = '';
    if (showGrid) {
      gridDef = `<defs>
        <pattern id="cvSmallGrid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 16" fill="none" stroke="var(--line-soft)" stroke-width="0.7"/>
        </pattern>
        <pattern id="cvMajorGrid" width="80" height="80" patternUnits="userSpaceOnUse">
          <rect width="80" height="80" fill="url(#cvSmallGrid)"/>
          <path d="M 80 0 L 0 0 0 80" fill="none" stroke="var(--line)" stroke-width="1"/>
        </pattern>
      </defs>
      <rect x="0" y="0" width="${W}" height="${H}" fill="url(#cvMajorGrid)"/>`;
    } else {
      gridDef = `<rect x="0" y="0" width="${W}" height="${H}" fill="var(--paper)"/>`;
    }

    if (!shapes.length) {
      return `<svg class="cv-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${gridDef}</svg>`;
    }

    // Modalità 1: GALLERIA IN SCALA (affiancate in proporzione reale)
    if (mode === 'gallery') {
      const n = shapes.length;
      const maxDim = Math.max(1, ...shapes.map((s) => Math.max(s.w || 1, s.h || 1)));
      const slotW = (W - 36) / n;
      const availW = Math.max(44, slotW - 44);
      const availH = 148;
      const scale = Math.min(availW / maxDim, availH / maxDim);

      let itemsSvg = '';
      shapes.forEach((sh, idx) => {
        const pal = PALETTE[idx % PALETTE.length];
        const cx = 18 + slotW * idx + slotW / 2;
        const cy = 132;

        // Intestazione della forma sopra
        itemsSvg += `<text x="${cx.toFixed(1)}" y="26" text-anchor="middle" font-size="12" font-weight="700" fill="${pal.stroke}" font-family="var(--font-ui)">#${idx + 1} · ${escSvg(sh.title)}</text>`;

        // Forma geometrica in scala
        itemsSvg += renderShapeSvgElement(sh, idx, cx, cy, scale, pal, showLabels, selectedIdx);

        // Riepilogo Area e Perimetro sotto
        itemsSvg += `<rect x="${(cx - Math.min(slotW * 0.44, 88)).toFixed(1)}" y="242" width="${(Math.min(slotW * 0.88, 176)).toFixed(1)}" height="34" rx="7" fill="var(--paper)" stroke="var(--line)"/>`;
        itemsSvg += `<text x="${cx.toFixed(1)}" y="256" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--ink)" font-family="var(--font-mono)">A = ${round2(sh.area)}</text>`;
        itemsSvg += `<text x="${cx.toFixed(1)}" y="270" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="var(--font-mono)">P = ${round2(sh.perimeter)}</text>`;
      });

      // Barra di scala metrica in basso a sinistra
      const unitPx = scale;
      const barUnits = unitPx >= 45 ? 1 : (unitPx * 2 >= 40 ? 2 : 5);
      const barPx = barUnits * unitPx;
      const scaleLegend = `<g transform="translate(16, 218)">
        <line x1="0" y1="0" x2="${barPx.toFixed(1)}" y2="0" stroke="var(--muted)" stroke-width="2"/>
        <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--muted)" stroke-width="2"/>
        <line x1="${barPx.toFixed(1)}" y1="-4" x2="${barPx.toFixed(1)}" y2="4" stroke="var(--muted)" stroke-width="2"/>
        <text x="${(barPx / 2).toFixed(1)}" y="-5" text-anchor="middle" font-size="9.5" font-weight="600" fill="var(--muted)" font-family="var(--font-mono)">${barUnits} u</text>
      </g>`;

      return `<svg class="cv-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        ${gridDef}
        ${itemsSvg}
        ${scaleLegend}
      </svg>`;
    }

    // Modalità 2: PIANO CARTESIANO (X / Y)
    if (mode === 'cartesian') {
      const originX = 76;
      const originY = H - 42;
      const plotW = W - originX - 36;
      const plotH = originY - 28;

      // Calcola coordinate logiche per ogni forma (se non ha x,y propri, le dispone lungo l'asse X)
      let curAutoX = 0;
      const placed = shapes.map((sh) => {
        const w = sh.w || 1;
        const h = sh.h || 1;
        let lx, ly;
        if (sh.x != null && sh.y != null) {
          lx = sh.x;
          ly = sh.y;
        } else {
          lx = curAutoX + w / 2 + 0.5;
          ly = h / 2 + 0.5;
          curAutoX += w + 1;
        }
        return { sh, lx, ly, maxX: lx + w / 2, maxY: ly + h / 2 };
      });

      const maxLogicalX = Math.max(4, ...placed.map((p) => p.maxX + 0.5));
      const maxLogicalY = Math.max(4, ...placed.map((p) => p.maxY + 0.5));
      const scale = Math.min(plotW / maxLogicalX, plotH / maxLogicalY);

      let axesSvg = `<line x1="${originX}" y1="18" x2="${originX}" y2="${originY + 12}" stroke="var(--ink)" stroke-width="1.6"/>`;
      axesSvg += `<line x1="${originX - 12}" y1="${originY}" x2="${W - 18}" y2="${originY}" stroke="var(--ink)" stroke-width="1.6"/>`;
      axesSvg += `<text x="${W - 16}" y="${originY - 6}" text-anchor="end" font-size="11" font-weight="700" fill="var(--ink)" font-family="var(--font-mono)">X</text>`;
      axesSvg += `<text x="${originX + 8}" y="26" text-anchor="start" font-size="11" font-weight="700" fill="var(--ink)" font-family="var(--font-mono)">Y</text>`;

      const stepUnit = maxLogicalX > 16 ? 2 : 1;
      for (let u = 0; u <= Math.floor(maxLogicalX); u += stepUnit) {
        const px = originX + u * scale;
        axesSvg += `<line x1="${px.toFixed(1)}" y1="${originY - 3}" x2="${px.toFixed(1)}" y2="${originY + 4}" stroke="var(--ink)" stroke-width="1.2"/>`;
        axesSvg += `<text x="${px.toFixed(1)}" y="${originY + 16}" text-anchor="middle" font-size="9.5" fill="var(--muted)" font-family="var(--font-mono)">${u}</text>`;
      }
      for (let u = stepUnit; u <= Math.floor(maxLogicalY); u += stepUnit) {
        const py = originY - u * scale;
        axesSvg += `<line x1="${originX - 4}" y1="${py.toFixed(1)}" x2="${originX + 3}" y2="${py.toFixed(1)}" stroke="var(--ink)" stroke-width="1.2"/>`;
        axesSvg += `<text x="${originX - 8}" y="${(py + 3).toFixed(1)}" text-anchor="end" font-size="9.5" fill="var(--muted)" font-family="var(--font-mono)">${u}</text>`;
      }

      let shapesSvg = '';
      placed.forEach(({ sh, lx, ly }, idx) => {
        const pal = PALETTE[idx % PALETTE.length];
        const cx = originX + lx * scale;
        const cy = originY - ly * scale;
        shapesSvg += renderShapeSvgElement(sh, idx, cx, cy, scale, pal, showLabels, selectedIdx);
      });

      return `<svg class="cv-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        ${gridDef}
        ${axesSvg}
        ${shapesSvg}
      </svg>`;
    }

    // Modalità 3: SOVRAPPOSTE (confronto diretto delle dimensioni dal più grande al più piccolo)
    const maxDim = Math.max(1, ...shapes.map((s) => Math.max(s.w || 1, s.h || 1)));
    const scale = Math.min((W - 120) / maxDim, (H - 76) / maxDim);
    const ordered = shapes
      .map((sh, idx) => ({ sh, idx }))
      .sort((a, b) => (b.sh.area || 0) - (a.sh.area || 0));

    let overlaySvg = '';
    ordered.forEach(({ sh, idx }) => {
      const pal = PALETTE[idx % PALETTE.length];
      overlaySvg += renderShapeSvgElement(sh, idx, W / 2, H / 2, scale, pal, showLabels, selectedIdx);
    });

    return `<svg class="cv-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${gridDef}
      ${overlaySvg}
    </svg>`;
  }

  FlowLabPlugins.register({
    id: 'shapes-canvas',
    getName: () => L('pa.cvName'),
    getDesc: () => L('pa.cvDesc'),
    getShortLabel: () => L('pa.cvShort'),
    version: '1.0',
    author: 'FlowLab Team',
    iconSvg: ICON_CANVAS_SVG,
    showInDock: true,
    dockBtnId: 'plugBtnCanvas',
    // Preinstallato nella lista "Plugin installati", ma NON preattivato (spunta disattivata di default)
    preinstalled: true,
    defaultInstalled: true,
    defaultEnabled: false,

    onOpen(ctx) {
      if (!ctx.ui || !ctx.ui.openModal || !ctx.ui.h || !ctx.prog) return;
      const { openModal, h, toast } = ctx.ui;
      const fl = ctx.flowlab;

      let viewMode = 'gallery';
      let showGrid = true;
      let showLabels = true;
      let selectedIdx = -1;
      let currentShapes = [];
      let lastSvgMarkup = '';

      const modeSelect = h('select', { class: 'fsel', id: 'cvModeSelect' },
        h('option', { value: 'gallery' }, L('pa.cvModeGallery')),
        h('option', { value: 'cartesian' }, L('pa.cvModeCartesian')),
        h('option', { value: 'overlay' }, L('pa.cvModeOverlay'))
      );

      const chkGrid = h('input', { type: 'checkbox', checked: 'checked' });
      chkGrid.checked = true;
      const chkLabels = h('input', { type: 'checkbox', checked: 'checked' });
      chkLabels.checked = true;

      const inputField = h('input', {
        type: 'text',
        class: 'mono',
        style: 'flex:1;min-width:140px;',
        placeholder: L('pa.cvInputPh')
      });

      const summaryBar = h('div', { class: 'cv-summary', hidden: true });
      const stageWrap = h('div', { class: 'cv-stage-wrap' });
      const cardsBox = h('div', { class: 'cv-cards' });

      const redrawCanvasAndCards = () => {
        stageWrap.innerHTML = '';
        cardsBox.innerHTML = '';

        if (!currentShapes.length) {
          summaryBar.hidden = true;
          const loadExBtn = h('button', {
            type: 'button',
            class: 'btn small primary',
            onclick: () => {
              const langCode = (typeof I18n !== 'undefined' && I18n.lang === 'en') ? 'en' : 'it';
              const list = (typeof EXAMPLES !== 'undefined' && EXAMPLES[langCode]) || [];
              const ex = list.find((e) => e.id === 'shapes');
              if (ex && fl && typeof fl.loadText === 'function') {
                fl.loadText(ex.text, ex.title);
                executeAndExtract();
              }
            }
          }, L('pa.cvLoadShapesExBtn'));

          stageWrap.append(
            h('div', { class: 'cv-empty' },
              h('strong', null, L('pa.cvNoShapesTitle')),
              h('p', { class: 'muted small', style: 'max-width:480px;margin:0;' }, L('pa.cvNoShapesHint')),
              loadExBtn
            )
          );
          return;
        }

        const totalArea = currentShapes.reduce((acc, s) => acc + (s.area || 0), 0);
        const totalPerim = currentShapes.reduce((acc, s) => acc + (s.perimeter || 0), 0);
        summaryBar.hidden = false;
        summaryBar.textContent = L('pa.cvSummaryText', {
          count: currentShapes.length,
          area: round2(totalArea),
          perimeter: round2(totalPerim)
        });

        lastSvgMarkup = buildShapesCanvasSvg(currentShapes, {
          mode: viewMode,
          showGrid,
          showLabels,
          selectedIdx
        });
        stageWrap.innerHTML = lastSvgMarkup;

        stageWrap.querySelectorAll('.cv-shape-group').forEach((g) => {
          g.addEventListener('click', () => {
            const idx = Number(g.getAttribute('data-shape-idx'));
            selectedIdx = selectedIdx === idx ? -1 : idx;
            redrawCanvasAndCards();
          });
        });

        currentShapes.forEach((sh, idx) => {
          const pal = PALETTE[idx % PALETTE.length];
          const pct = totalArea > 0 ? Math.min(100, Math.round(((sh.area || 0) / totalArea) * 100)) : 0;

          const card = h('div', {
            class: 'cv-card' + (selectedIdx === idx ? ' selected' : ''),
            onclick: () => {
              selectedIdx = selectedIdx === idx ? -1 : idx;
              redrawCanvasAndCards();
            }
          },
            h('div', { class: 'cv-card-head' },
              h('span', { class: 'cv-swatch', style: `background:${pal.stroke}` }),
              h('strong', null, `#${idx + 1} · ${sh.title}`)
            ),
            h('div', { class: 'mono small muted' }, `${L('pa.cvDimsLbl')}: ${sh.dimsText}`),
            h('div', { class: 'cv-card-metrics mono' },
              h('span', null, h('strong', null, L('pa.cvAreaLbl') + ': '), round2(sh.area)),
              h('span', null, h('strong', null, L('pa.cvPerimLbl') + ': '), round2(sh.perimeter))
            ),
            totalArea > 0 ? h('div', { class: 'cv-bar-track', title: `${L('pa.cvShareLbl')}: ${pct}%` },
              h('div', { class: 'cv-bar-fill', style: `width:${pct}%;background:${pal.stroke}` })
            ) : null
          );
          cardsBox.append(card);
        });
      };

      const executeAndExtract = () => {
        const prog = ctx.prog;
        let shapes = [];

        // 1. Se il debugger di FlowLab è attualmente in esecuzione o in pausa, legge prima gli oggetti live dallo stack
        if (fl && fl.run && fl.run.interp && Array.isArray(fl.run.interp.stack) && fl.run.interp.stack.length) {
          shapes = collectShapesFromFrames(fl.run.interp.stack);
        }

        // 2. Altrimenti esegue il programma in modalità headless e ispeziona il frame finale
        if (!shapes.length) {
          const res = ctx.runHeadless(prog, inputField.value.trim().replace(/,\s*/g, '\n'), { maxSteps: 40000 });
          const frames = [];
          if (res.mainFrame) frames.push(res.mainFrame);
          if (res.interp && Array.isArray(res.interp.stack)) {
            for (const fr of res.interp.stack) {
              if (!frames.includes(fr)) frames.push(fr);
            }
          }
          shapes = collectShapesFromFrames(frames);
        }

        // 3. Fallback statico sull'AST se il programma non è ancora stato eseguito completamente
        if (!shapes.length) {
          shapes = collectShapesFromProgramAst(prog);
        }

        currentShapes = shapes;
        if (selectedIdx >= currentShapes.length) selectedIdx = -1;
        redrawCanvasAndCards();
      };

      const exportSvgFile = () => {
        if (!lastSvgMarkup || !currentShapes.length) return;
        const cleanSvg = lastSvgMarkup
          .replace(/var\(--paper\)/g, '#ffffff')
          .replace(/var\(--line-soft\)/g, '#eef2f6')
          .replace(/var\(--line\)/g, '#d5dde5')
          .replace(/var\(--ink\)/g, '#1c252c')
          .replace(/var\(--muted\)/g, '#63727e')
          .replace(/var\(--font-mono\)/g, 'monospace')
          .replace(/var\(--font-ui\)/g, 'sans-serif');
        const blob = new Blob([cleanSvg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ((ctx.prog && ctx.prog.attrs && ctx.prog.attrs.name) || 'disegno') + '.svg';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        if (toast) toast(L('pa.cvExportedToast'), 'ok');
      };

      modeSelect.addEventListener('change', () => {
        viewMode = modeSelect.value;
        redrawCanvasAndCards();
      });
      chkGrid.addEventListener('change', () => {
        showGrid = chkGrid.checked;
        redrawCanvasAndCards();
      });
      chkLabels.addEventListener('change', () => {
        showLabels = chkLabels.checked;
        redrawCanvasAndCards();
      });

      executeAndExtract();

      const body = h('div', { class: 'fields cv-dialog' },
        h('p', { class: 'help' }, L('pa.cvIntro')),
        h('div', { class: 'cv-toolbar' },
          modeSelect,
          h('label', { class: 'cv-check-lbl' }, chkGrid, h('span', null, L('pa.cvShowGrid'))),
          h('label', { class: 'cv-check-lbl' }, chkLabels, h('span', null, L('pa.cvShowLabels'))),
          inputField,
          h('button', { type: 'button', class: 'btn small primary', id: 'cvRunDrawBtn', onclick: executeAndExtract }, '▶ ' + L('pa.cvRunDrawBtn')),
          h('button', { type: 'button', class: 'btn small', id: 'cvExportSvgBtn', onclick: exportSvgFile }, L('pa.cvExportSvgBtn'))
        ),
        summaryBar,
        stageWrap,
        cardsBox
      );

      openModal({
        title: L('pa.cvName'),
        body,
        wide: true,
        okText: L('win.close'),
        noCancel: true
      });
    }
  });
})();
