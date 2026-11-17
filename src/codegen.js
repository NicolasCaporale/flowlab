/* ==========================================================================
   FlowLab — source code generators
   Pseudocode (in the chosen language), Python, C++, Java, C#, JavaScript.
   All start from the syntax tree of the expressions and from a static
   type inference, so divisions, concatenations and string comparisons
   are translated correctly in every language.
   ========================================================================== */
'use strict';
if (typeof I18n === 'undefined' && typeof require !== 'undefined') require('./i18n.js');
/* texts of the generated code (comments, messages, pseudocode words) from the language file */
const C = (id, p) => I18n.code(id, p);

const _CE = (typeof module !== 'undefined') ? require('./expr.js') : ExprLib;
const _CM = (typeof module !== 'undefined') ? require('./model.js') : ModelLib;

const P = { or: 1, and: 2, notLow: 3, rel: 4, add: 5, mul: 6, un: 7, pow: 8, atom: 10 };
const REL = ['==', '!=', '<', '<=', '>', '>='];

/* ------------------- Generics and native classes of the modules -------------------
   GEN is set at every generation: the classes of the library modules that
   have an equivalent in the language (native) are not written in the code, the
   language's own are used; the type parameters (T) stay types. */
let GEN = { native: new Map(), skip: new Set(), tparams: new Set(), helpers: new Set() };
const isTP = (t) => GEN.tparams.has(String(t).toLowerCase());
const nativeOf = (base) => GEN.native.get(String(base).toLowerCase()) || null;
const need = (h) => GEN.helpers.add(h);
const Wp = (x) => (x.p < P.atom ? `(${x.s})` : x.s);
/* *altra in C++ (l'oggetto puntato) */
const deref = (a) => (/^[\w.>-]+$/.test(a) ? '*' + a : `*(${a})`);
/* constructor with an integer: initial capacity; with an object: copy */
const isCap = (ty) => ty[0] === 'Integer';
const rel = (s) => ({ s, p: P.rel });
/* for each module: type, constructor and methods in the various languages (o = object, a = arguments {s, p}) */
const NATIVE = {
  'data_structures/ArrayList': {
    cls: 'ArrayList',
    java: { type: (t) => `ArrayList<${t[0]}>`, ctor: (t, a) => `new ArrayList<>(${a})` },
    python: { ctor: (t, a, ty) => (!a || isCap(ty) ? '[]' : `list(${a})`), m: {
      add: (o, a) => (a.length === 2 ? `${o}.insert(${a[0].s}, ${a[1].s})` : `${o}.append(${a[0].s})`),
      get: (o, a) => `${o}[${a[0].s}]`, set: (o, a) => `${o}[${a[0].s}] = ${a[1].s}`, remove: (o, a) => `${o}.pop(${a[0].s})`,
      size: (o) => `len(${o})`, isEmpty: (o) => rel(`len(${o}) == 0`), clear: (o) => `${o}.clear()`,
      indexOf: (o, a) => `(${o}.index(${Wp(a[0])}) if ${Wp(a[0])} in ${o} else -1)`, contains: (o, a) => rel(`${Wp(a[0])} in ${o}`) } },
    cpp: { type: (t) => `vector<${t[0]}>*`, ctor: (t, a, ty) => `new vector<${t ? t[0] : 'int'}>(${!a || isCap(ty) ? '' : deref(a)})`, m: {
      add: (o, a) => (a.length === 2 ? `${o}->insert(${o}->begin() + ${Wp(a[0])}, ${a[1].s})` : `${o}->push_back(${a[0].s})`),
      get: (o, a) => `(*${o})[${a[0].s}]`, set: (o, a) => `(*${o})[${a[0].s}] = ${a[1].s}`, remove: (o, a) => { need('removeAt'); return `removeAt(${o}, ${a[0].s})`; },
      size: (o) => ({ s: `(int) ${o}->size()`, p: P.un }), isEmpty: (o) => `${o}->empty()`, clear: (o) => `${o}->clear()`,
      indexOf: (o, a) => { need('indexOfItem'); return `indexOfItem(${o}, ${a[0].s})`; }, contains: (o, a) => { need('indexOfItem'); return rel(`indexOfItem(${o}, ${a[0].s}) >= 0`); } } },
    csharp: { type: (t) => `List<${t[0]}>`, ctor: (t, a) => `new List<${t ? t[0] : 'int'}>(${a})`, m: {
      add: (o, a) => (a.length === 2 ? `${o}.Insert(${a[0].s}, ${a[1].s})` : `${o}.Add(${a[0].s})`),
      get: (o, a) => `${o}[${a[0].s}]`, set: (o, a) => `${o}[${a[0].s}] = ${a[1].s}`, remove: (o, a) => { need('Helpers'); return `Helpers.RemoveAt(${o}, ${a[0].s})`; },
      size: (o) => `${o}.Count`, isEmpty: (o) => rel(`${o}.Count == 0`), clear: (o) => `${o}.Clear()`,
      indexOf: (o, a) => `${o}.IndexOf(${a[0].s})`, contains: (o, a) => `${o}.Contains(${a[0].s})` } },
    javascript: { ctor: (t, a, ty) => (!a || isCap(ty) ? '[]' : `[...${a}]`), m: {
      add: (o, a) => (a.length === 2 ? `${o}.splice(${a[0].s}, 0, ${a[1].s})` : `${o}.push(${a[0].s})`),
      get: (o, a) => `${o}[${a[0].s}]`, set: (o, a) => `${o}[${a[0].s}] = ${a[1].s}`, remove: (o, a) => `${o}.splice(${a[0].s}, 1)[0]`,
      size: (o) => `${o}.length`, isEmpty: (o) => rel(`${o}.length === 0`), clear: (o) => `${o}.length = 0`,
      indexOf: (o, a) => `${o}.indexOf(${a[0].s})`, contains: (o, a) => `${o}.includes(${a[0].s})` } },
  },
  'data_structures/Stack': {
    cls: 'Stack',
    java: { type: (t) => `Stack<${t[0]}>`, ctor: () => 'new Stack<>()' },
    python: { ctor: () => '[]', m: { push: (o, a) => `${o}.append(${a[0].s})`, pop: (o) => `${o}.pop()`, peek: (o) => `${o}[-1]`, size: (o) => `len(${o})`, isEmpty: (o) => rel(`len(${o}) == 0`) } },
    cpp: { type: (t) => { need('stack'); return `stack<${t[0]}>*`; }, ctor: (t) => { need('stack'); return `new stack<${t ? t[0] : 'int'}>()`; }, m: {
      push: (o, a) => `${o}->push(${a[0].s})`, pop: (o) => { need('popTop'); return `popTop(${o})`; }, peek: (o) => `${o}->top()`,
      size: (o) => ({ s: `(int) ${o}->size()`, p: P.un }), isEmpty: (o) => `${o}->empty()` } },
    csharp: { type: (t) => `Stack<${t[0]}>`, ctor: (t) => `new Stack<${t ? t[0] : 'int'}>()`, m: { push: (o, a) => `${o}.Push(${a[0].s})`, pop: (o) => `${o}.Pop()`, peek: (o) => `${o}.Peek()`, size: (o) => `${o}.Count`, isEmpty: (o) => rel(`${o}.Count == 0`) } },
    javascript: { ctor: () => '[]', m: { push: (o, a) => `${o}.push(${a[0].s})`, pop: (o) => `${o}.pop()`, peek: (o) => `${o}[${o}.length - 1]`, size: (o) => `${o}.length`, isEmpty: (o) => rel(`${o}.length === 0`) } },
  },
  'data_structures/Queue': {
    cls: 'Queue',
    java: { type: (t) => `Queue<${t[0]}>`, ctor: (t, a) => `new LinkedList<>(${a})` },
    python: { ctor: (t, a) => { need('deque'); return `deque(${a})`; }, m: { add: (o, a) => `${o}.append(${a[0].s})`, remove: (o) => `${o}.popleft()`, peek: (o) => `${o}[0]`, size: (o) => `len(${o})`, isEmpty: (o) => rel(`len(${o}) == 0`) } },
    cpp: { type: (t) => { need('queue'); return `queue<${t[0]}>*`; }, ctor: (t, a) => { need('queue'); return `new queue<${t ? t[0] : 'int'}>(${a ? deref(a) : ''})`; }, m: {
      add: (o, a) => `${o}->push(${a[0].s})`, remove: (o) => { need('popFront'); return `popFront(${o})`; }, peek: (o) => `${o}->front()`,
      size: (o) => ({ s: `(int) ${o}->size()`, p: P.un }), isEmpty: (o) => `${o}->empty()` } },
    csharp: { type: (t) => `Queue<${t[0]}>`, ctor: (t, a) => `new Queue<${t ? t[0] : 'int'}>(${a})`, m: { add: (o, a) => `${o}.Enqueue(${a[0].s})`, remove: (o) => `${o}.Dequeue()`, peek: (o) => `${o}.Peek()`, size: (o) => `${o}.Count`, isEmpty: (o) => rel(`${o}.Count == 0`) } },
    javascript: { ctor: (t, a) => (a ? `[...${a}]` : '[]'), m: { add: (o, a) => `${o}.push(${a[0].s})`, remove: (o) => `${o}.shift()`, peek: (o) => `${o}[0]`, size: (o) => `${o}.length`, isEmpty: (o) => rel(`${o}.length === 0`) } },
  },
};
/* prepares GEN for a program and a language */
function setupGen(prog, lang) {
  const native = new Map(), skip = new Set();
  const cs = _CM.hasClasses(prog) ? prog.classes : [];
  if (lang !== 'pseudo') for (const c of cs) {
    const src = c.module && c.module.src || '';
    const spec = src.startsWith('lib:') ? NATIVE[src.slice(4)] : null;
    if (!spec || !spec[lang]) continue;
    skip.add(c.id);
    if (c.name === spec.cls) native.set(c.name.toLowerCase(), spec);
  }
  const tps = [...cs.flatMap((c) => c.tparams || []), ...prog.functions.flatMap((f) => f.tparams || [])].map((t) => t.toLowerCase());
  GEN = { native, skip, tparams: new Set(tps), helpers: new Set(), bound: new Set(), boxed: new Set(), cur: null, exc: excInfo(prog), jthrows: new Map() };
  if (tps.length) analyzeGenerics(prog, lang);
  if (lang === 'java' && GEN.exc.used) analyzeThrows(prog);
}
/* ------------------------------ Exceptions ----------------------------------
   The predefined exceptions of FlowLab correspond to those of the languages; where the language
   throws nothing (division between reals by zero, checkIndex outside the array in JavaScript…) the code
   uses small check functions, only if the program catches that type of exception. */
const EXC_LANG = {
  java: { Exception: 'Exception', DivisionByZero: 'ArithmeticException', IndexOutOfRange: 'IndexOutOfBoundsException', InvalidConversion: 'NumberFormatException', NullReference: 'NullPointerException', FileError: 'java.io.IOException' },
  csharp: { Exception: 'Exception', DivisionByZero: 'DivideByZeroException', IndexOutOfRange: 'IndexOutOfRangeException', InvalidConversion: 'FormatException', NullReference: 'NullReferenceException', FileError: 'System.IO.IOException' },
  python: { Exception: 'Exception', DivisionByZero: 'ZeroDivisionError', IndexOutOfRange: 'IndexError', InvalidConversion: 'ValueError', NullReference: 'AttributeError', FileError: 'OSError' },
  cpp: { Exception: 'runtime_error', DivisionByZero: 'DivisionByZero', IndexOutOfRange: 'out_of_range', InvalidConversion: 'invalid_argument', NullReference: 'NullReference', FileError: 'FileError' },
  javascript: { Exception: 'Error', DivisionByZero: 'DivisionByZero', IndexOutOfRange: 'IndexOutOfRange', InvalidConversion: 'InvalidConversion', NullReference: 'NullReference', FileError: 'FileError' },
};
/* name of the exception in the language (the classes of the program stay as they are) */
const excL = (lang, name) => { const b = _CM.excClass(name); if (!b) return name; if ((lang === 'cpp' || lang === 'javascript') && EXC_LANG[lang][b.name] === b.name) need('exc:' + b.name); return EXC_LANG[lang][b.name]; };
/* parent class in the language (a class of the program can inherit from a predefined exception) */
const parentL = (lang, c) => (c.parent && _CM.excClass(c.parent) ? excL(lang, c.parent) : c.parent);
/* what the program uses: Try/Throw, and which runtime errors are caught */
function excInfo(prog) {
  const caught = new Set(); let used = false;
  for (const f of prog.functions) _CM.walk(f.body, (st) => {
    if (st.kind === 'throw') used = true;
    if (st.kind !== 'try') return;
    used = true;
    for (const c of st.catches || []) { const k = _CM.classByName(prog, c.type); for (const b of _CM.EXC_CLASSES) if (k && _CM.isSubclass(prog, b, k)) caught.add(b.name); }
  });
  return { used, div: caught.has('DivisionByZero'), idx: caught.has('IndexOutOfRange'), conv: caught.has('InvalidConversion') };
}
/* type of the thrown exception: new X(...) or the type of the variable */
function thrownType(node, sc) { const n = strip(node); if (!n) return null; if (n.k === 'new') return n.cls; const t = _CE.inferType(n, sc); return t && t !== 'Unknown' ? _CE.splitType(t).base : null; }
/* Java: checked exceptions (must be declared with throws): Exception, FileError and the classes of the program derived from them */
function jChecked(prog, name) {
  const k = _CM.classByName(prog, name); if (!k) return false;
  const b = _CM.chainOf(prog, k).find((x) => x.builtin);
  return !!b && (b.name === 'Exception' || b.name === 'FileError');
}
/* Java: for each function, the checked exceptions that can escape (not caught by a Try) */
function analyzeThrows(prog) {
  const oo = _CM.hasClasses(prog);
  const fl = prog.functions.filter((f) => !(oo && GEN.skip.has(f.cls)));
  const out = new Map(fl.map((f) => [f, new Set()])), scopes = new Map(fl.map((f) => [f, buildScope(prog, f)]));
  const caughtBy = (t, catches) => catches.some((ct) => _CM.isSubclass(prog, _CM.classByName(prog, t), _CM.classByName(prog, ct)));
  for (let changed = true, guard = 0; changed && guard < 30; guard++) {
    changed = false;
    for (const f of fl) {
      const sc = scopes.get(f), set = out.get(f);
      const add = (t, catches) => { if (!t || !jChecked(prog, t) || caughtBy(t, catches)) return; const k = _CM.classByName(prog, t).name; if (!set.has(k)) { set.add(k); changed = true; } };
      const visitExpr = (src, catches) => { const t = String(src || '').trim() && tryParse(src); if (t) walkNodes(t, (n) => { const g = calleeNode(n, sc, prog); if (g && out.has(g)) for (const x of out.get(g)) add(x, catches); }); };
      const visit = (stmts, catches) => {
        for (const st of stmts) {
          if (st.kind === 'try') {
            visit(st.body, [...catches, ...(st.catches || []).map((c) => c.type)]);
            for (const c of st.catches || []) visit(c.body, catches);
            if (st.hasFinally) visit(st.finally || [], catches);
            continue;
          }
          if (st.kind === 'throw') { const t = tryParse(st.expression); add(t && thrownType(t, sc), catches); }
          for (const src of exprSources(st)) visitExpr(src, catches);
          for (const arr of _CM.childArrays(st)) visit(arr, catches);
        }
      };
      visit(f.body, []);
      // a constructor without super(...) calls the one of the parent class
    }
    // an overridden method declares the same exceptions in the whole hierarchy (in Java an override cannot add any)
    if (oo) {
      const groups = new Map();
      for (const f of fl) {
        if (f.ctor || f.static) continue;
        const c = _CM.classOf(prog, f); if (!c) continue;
        const root = _CM.chainOf(prog, c).filter((k) => !k.builtin).pop();
        const key = root.id + ':' + f.name.toLowerCase() + '(' + OO.sig(f) + ')';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(f);
      }
      for (const g of groups.values()) {
        if (g.length < 2) continue;
        const all = new Set(g.flatMap((f) => [...out.get(f)]));
        for (const f of g) for (const x of all) if (!out.get(f).has(x)) { out.get(f).add(x); changed = true; }
      }
    }
  }
  GEN.jthrows = out;
}
/* Java: " throws …" of the function (with files there is already throws Exception) */
const jThrows = (f, files) => {
  if (files) return ' throws Exception';
  const set = GEN.jthrows.get(f);
  if (!set || !set.size) return '';
  if (set.has('Exception')) return ' throws Exception';
  return ' throws ' + [...set].map((n) => excL('java', n)).join(', ');
};

/* ---- generics: who owns a type parameter (the function or the class) ---- */
const FKEY = (f, t) => 'f:' + f.id + ':' + String(t).toLowerCase();
const CKEY = (c, t) => 'c:' + c.id + ':' + String(t).toLowerCase();
function tpKey(t, f, c) {
  if (!isTP(t)) return null;
  const low = String(t).toLowerCase(), has = (x) => (x.tparams || []).some((y) => y.toLowerCase() === low);
  if (f && has(f)) return FKEY(f, t);
  if (c && has(c)) return CKEY(c, t);
  return null;
}
/* T deve essere confrontabile (< > su T): Comparable in Java, IComparable in C# */
const isBound = (t, f, c) => { const k = tpKey(t, f, c); return !!k && GEN.bound.has(k); };
const boundHere = (t) => !!GEN.cur && isBound(t, GEN.cur.f, GEN.cur.c);
/* texts of the expressions of a block */
function exprSources(s) {
  switch (s.kind) {
    case 'declare': return [..._CE.splitTop(s.array ? s.size || '' : ''), s.init || ''];
    case 'const': case 'output': case 'write': case 'if': case 'while': case 'do': case 'call': case 'open': case 'throw': return [s.expression];
    case 'breakpoint': return s.always ? [] : [s.expression];
    case 'assign': return [..._CE.splitTop(s.variable), s.expression];
    case 'input': case 'read': return [s.variable];
    case 'for': return [s.variable, s.start, s.end, s.step];
  }
  return [];
}
function walkNodes(n, fn) {
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n)) { n.forEach((x) => walkNodes(x, fn)); return; }
  if (n.k) fn(n);
  for (const v of Object.values(n)) if (v && typeof v === 'object') walkNodes(v, fn);
}
/* function or method called by a node (call, mcall, new) */
function calleeNode(n, sc, prog) {
  const low = String(n.name || '').toLowerCase();
  if (n.k === 'call') { const e = sc.funcs.get(low); return e ? e.f : null; }
  if (n.k === 'mcall' && sc.methodHit && strip(n.obj).k !== 'super') { const c = sc.classRef(n.obj) || sc.objClass(n.obj); const h = c && sc.methodHit(c, low); return h ? h.f : null; }
  if (n.k === 'new' && sc.classNamed) { const c = sc.classNamed(n.cls); return c ? OO.ctors(prog, c).find((f) => f.params.length === n.args.length) || null : null; }
  return null;
}
/* analysis of the program: which T must be comparable and (Java) which arrays of base types are passed to T[] parameters */
function analyzeGenerics(prog, lang) {
  const oo = _CM.hasClasses(prog), cs = oo ? prog.classes.filter((c) => !GEN.skip.has(c.id)) : [];
  const info = prog.functions.filter((f) => !(oo && GEN.skip.has(f.cls))).map((f) => {
    const it = { f, c: oo ? _CM.classOf(prog, f) : null, sc: buildScope(prog, f), nodes: [], decls: [], assigns: [] };
    _CM.walk(f.body, (st) => {
      if (st.kind === 'declare') it.decls.push(st);
      if (st.kind === 'assign') it.assigns.push(st);
      for (const src of exprSources(st)) { const t = String(src || '').trim() && tryParse(src); if (t) walkNodes(t, (n) => it.nodes.push(n)); }
    });
    return it;
  });
  const bound = GEN.bound;
  // comparisons < <= > >= between values of type T
  for (const it of info) for (const n of it.nodes) {
    if (n.k !== 'bin' || !['<', '<=', '>', '>='].includes(n.op)) continue;
    for (const x of [n.l, n.r]) { const k = tpKey(_CE.inferType(x, it.sc), it.f, it.c); if (k) bound.add(k); }
  }
  // the constraint propagates: Pair<T> with comparable T, calls to generic functions with comparable T
  for (let changed = true, guard = 0; changed && guard < 20; guard++) {
    changed = false;
    const add = (k) => { if (k && !bound.has(k)) { bound.add(k); changed = true; } };
    const typeUse = (t, f, c) => {
      const g = _CE.splitType(t); if (!g.args.length) return;
      const k = _CM.classByName(prog, g.base);
      g.args.forEach((a, i) => { if (k && (k.tparams || [])[i] && bound.has(CKEY(k, k.tparams[i]))) add(tpKey(a, f, c)); typeUse(a, f, c); });
    };
    for (const it of info) [...it.f.params.map((p) => p.type), ..._CM.rets(it.f).map((r) => r.type), ...it.decls.map((d) => d.type)].forEach((t) => typeUse(t, it.f, it.c));
    for (const c of cs) for (const a of c.attributes) typeUse(a.type, null, c);
    for (const it of info) for (const n of it.nodes) {
      const g = calleeNode(n, it.sc, prog);
      if (!g || !(g.tparams || []).length) continue;
      g.params.forEach((p, i) => { if (n.args[i] && isBound(p.type, g, null)) add(tpKey(_CE.inferType(n.args[i], it.sc), it.f, it.c)); });
    }
  }
  if (lang === 'java') analyzeBoxing(prog, info, cs);
}
/* Java: an int array cannot be passed to a T[] parameter; those arrays become Integer[] (and those linked to them) */
function analyzeBoxing(prog, info, cs) {
  const parent = new Map();
  const find = (k) => { while (parent.has(k)) k = parent.get(k); return k; };
  const union = (a, b) => { if (!a || !b) return; const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  const elem = new Map(), sinks = [];
  const akey = (c, a) => 'attr:' + c.id + ':' + a.name.toLowerCase();
  for (const c of cs) for (const a of c.attributes) if (a.array) elem.set(akey(c, a), a.type);
  for (const it of info) {
    for (const p of it.f.params) if (p.array) { const k = it.f.id + ':' + p.name.toLowerCase(); elem.set(k, p.type); if (isTP(p.type)) sinks.push(k); }
    // returned arrays: the same array as the returned variable
    _CM.rets(it.f).forEach((r, i) => { if (!r.array) return; const k = 'ret:' + it.f.id + ':' + i; elem.set(k, r.type); if (isTP(r.type)) sinks.push(k); });
    for (const d of it.decls) if (d.array) for (const n of d.name.split(',').map((x) => x.trim()).filter(Boolean)) elem.set(it.f.id + ':' + n.toLowerCase(), d.type);
  }
  const slot = (node, it) => {
    const x = strip(node); if (!x || x.indices) return null;
    if (x.k === 'var') {
      const v = it.sc.vars.get(x.name.toLowerCase());
      if (v) return v.array ? it.f.id + ':' + x.name.toLowerCase() : null;
      const h = it.sc.implicitField && it.sc.implicitField(x.name);
      return h && h.attr.array ? akey(h.owner, h.attr) : null;
    }
    if (x.k === 'member' && it.sc.objClass) { const c = it.sc.objClass(x.obj); const h = c && it.sc.fieldHit(c, x.name.toLowerCase()); return h && h.attr.array ? akey(h.owner, h.attr) : null; }
    return null;
  };
  for (const it of info) {
    for (const n of it.nodes) {
      const g = calleeNode(n, it.sc, prog);
      if (g) g.params.forEach((p, i) => { if (p.array && n.args[i]) union(slot(n.args[i], it), g.id + ':' + p.name.toLowerCase()); });
    }
    // a ← b between arrays: the same array; a ← f(...) with f returning an array
    for (const st of it.assigns) {
      const tg = _CE.splitTop(st.variable).map(tryParse), r = tryParse(st.expression);
      if (!r) continue;
      if (tg.length === 1 && tg[0]) { const a = slot(tg[0], it), b = slot(r, it); if (a && b) union(a, b); }
      const g = calleeNode(strip(r), it.sc, prog);
      if (g) _CM.rets(g).forEach((rr, i) => { if (rr.array && tg[i]) union(slot(tg[i], it), 'ret:' + g.id + ':' + i); });
    }
    _CM.rets(it.f).forEach((r, i) => { if (!r.array) return; const v = it.sc.vars.get(r.name.toLowerCase()); const h = !v && it.sc.implicitField && it.sc.implicitField(r.name); union('ret:' + it.f.id + ':' + i, v ? it.f.id + ':' + r.name.toLowerCase() : h ? akey(h.owner, h.attr) : null); });
  }
  const roots = new Set(sinks.map(find));
  for (const [k, t] of elem) if (BOX_J[t] && t !== 'String' && roots.has(find(k))) GEN.boxed.add(k);
}
/* Java: element of an Integer[] array (equals is used for ==) */
const boxedElem = (n, sc) => { const x = strip(n); return !!x && x.k === 'var' && !!x.indices && !!sc.func && GEN.boxed.has(sc.func.id + ':' + x.name.toLowerCase()); };
/* during the assignment the expected type allows writing new ArrayList<Integer>() even if the diagram has new ArrayList() */
function withExpect(sc, t, fn) { const old = sc.expect; sc.expect = t; try { return fn(); } finally { sc.expect = old; } }

function buildScope(prog, func) {
  const vars = new Map();
  for (const p of func.params) vars.set(p.name.toLowerCase(), { type: p.type, array: p.array, dims: p.array ? (p.dims || 1) : 0, name: p.name });
  _CM.walk(func.body, (s) => {
    if (s.kind === 'const' && s.name.trim() && !vars.has(s.name.trim().toLowerCase())) vars.set(s.name.trim().toLowerCase(), { type: s.type, array: false, name: s.name.trim(), constant: true });
    if (s.kind === 'declare') for (const n of s.name.split(',').map((x) => x.trim()).filter(Boolean)) if (!vars.has(n.toLowerCase())) vars.set(n.toLowerCase(), { type: s.type, array: s.array, dims: s.array ? _CE.splitTop(s.size).length : 0, name: n });
    // variable of a Catch: the caught exception
    if (s.kind === 'try') for (const c of s.catches || []) if (c.variable && !vars.has(c.variable.toLowerCase())) vars.set(c.variable.toLowerCase(), { type: (_CM.classByName(prog, c.type) || { name: c.type }).name, array: false, dims: 0, name: c.variable, catchVar: true });
  });
  const funcs = new Map();
  const ooMode = _CM.hasClasses(prog);
  const cls = ooMode ? _CM.classOf(prog, func) : null;
  if (!ooMode) for (const f of prog.functions) funcs.set(f.name.toLowerCase(), { type: f.type, rets: _CM.rets(f), f, name: f.name });
  // methods with the name of a built-in function are called only with obj.name() or this.name()
  else for (const k of _CM.chainOf(prog, cls)) for (const f of _CM.membersOf(prog, k)) if (!f.ctor && !funcs.has(f.name.toLowerCase()) && !_CE.BUILTINS[f.name.toLowerCase()]) funcs.set(f.name.toLowerCase(), { type: f.type, rets: _CM.rets(f), f, name: f.name, owner: k });
  const sc = { vars, funcs, func, prog, cls, ooMode };
  if (ooMode) ooScope(prog, sc);
  // Functions view: of the objects there are only the exceptions (new Exception("…"), e.message)
  else sc.oo = (node) => (node.k === 'new' ? node.cls : node.k === 'member' && node.name.toLowerCase() === 'message' ? 'String' : undefined);
  return sc;
}

/* Tools for the classes: inherited attributes and methods, static accesses, types of the expressions */
function ooScope(prog, sc) {
  const classNamed = (n) => _CM.classByName(prog, _CE.splitType(n).base);
  // type of a member of a generic class: T replaced with the type of the object (ArrayList<Integer> -> Integer)
  const subst = (type, objNode, c) => {
    if (!(c.tparams || []).length) return type;
    const g = _CE.splitType(_CE.inferType(objNode, sc)); if (!g.args.length) return type;
    const map = {}; c.tparams.forEach((p, i) => { map[p.toLowerCase()] = g.args[i]; });
    return _CE.substType(type, map);
  };
  const fieldHit = (c, low) => { for (const k of _CM.chainOf(prog, c)) { const a = k.attributes.find((x) => x.name.toLowerCase() === low); if (a) return { attr: a, owner: k }; } return null; };
  const methodHit = (c, low) => { for (const k of _CM.chainOf(prog, c)) { const f = _CM.membersOf(prog, k).find((x) => !x.ctor && x.name.toLowerCase() === low); if (f) return { f, owner: k }; } return null; };
  const implicitField = (name) => { const low = String(name).toLowerCase(); return !sc.vars.has(low) && sc.cls ? fieldHit(sc.cls, low) : null; };
  const classRef = (node) => { const n = strip(node); if (!n || n.k !== 'var' || n.indices) return null; const low = n.name.toLowerCase(); if (sc.vars.has(low) || (sc.cls && fieldHit(sc.cls, low))) return null; return classNamed(n.name); };
  const objClass = (node) => { const r = classRef(node); if (r) return r; const n = strip(node); if (n && n.k === 'super') return classNamed(sc.cls && sc.cls.parent); return classNamed(_CE.inferType(node, sc)); };
  Object.assign(sc, {
    classNamed, fieldHit, methodHit, implicitField, classRef, objClass,
    oo(node) {
      switch (node.k) {
        case 'var': { const h = implicitField(node.name); return h ? h.attr.type : 'Unknown'; }
        case 'this': return sc.cls ? sc.cls.name : 'Unknown';
        case 'new': { const c = classNamed(node.cls); return c ? (node.targs && node.targs.length ? _CE.joinType(c.name, node.targs) : c.name) : node.cls; }
        case 'member': { const c = objClass(node.obj); const h = c && fieldHit(c, node.name.toLowerCase()); return h ? subst(h.attr.type, node.obj, c) : 'Unknown'; }
        case 'mcall': {
          const c = objClass(node.obj); const h = c && methodHit(c, node.name.toLowerCase());
          if (!h) return 'Unknown';
          const t = subst(h.f.type, node.obj, c);
          return (h.f.tparams || []).length ? _CE.substType(t, _CE.genericMap(h.f, node.args, sc)) : t;
        }
      }
      return undefined;
    },
  });
}

function tryParse(src) { try { return _CE.parseExpr(src); } catch (e) { return null; } }
const strip = (n) => (n && n.k === 'par' ? strip(n.e) : n);
/* targets of an assignment (more than one if the function returns several values) */
const targetsOf = (s) => _CE.splitTop(s.variable);
function isLiteralExpr(src) {
  const ok = (n) => !!n && (['num', 'str', 'bool'].includes(n.k) || (n.k === 'par' && ok(n.e)) || (n.k === 'un' && ok(n.e)) || (n.k === 'bin' && n.op !== '&' && ok(n.l) && ok(n.r)));
  return ok(tryParse(src));
}
/* function called on the right of a multiple assignment */
function calleeOf(s, sc) {
  const e = strip(tryParse(s.expression));
  if (e && e.k === 'mcall' && sc.objClass) { const c = sc.objClass(e.obj); const h = c && sc.methodHit(c, e.name.toLowerCase()); return h ? h.f : null; }
  const g = e && e.k === 'call' && sc.funcs.get(e.name.toLowerCase()); return g ? g.f : null;
}
/* name as it was declared (the .fprg format is case-insensitive, the languages are not) */
const vname = (n, sc) => { const v = sc.vars.get(String(n).toLowerCase()); return v ? v.name : n; };
const fname = (n, sc) => { const f = sc.funcs.get(String(n).toLowerCase()); return f ? f.name : n; };

/* ------------------------------ Classes -------------------------------------- */
const OO = {
  /* classes in order: the parent before the children; the main one as late as possible (or first) */
  ordered(prog, mainFirst) {
    const main = _CM.mainClass(prog);
    const out = [], done = new Set();
    const visit = (c) => { if (!c || c.builtin || done.has(c)) return; done.add(c); visit(_CM.classByName(prog, c.parent)); out.push(c); };
    const rest = prog.classes.filter((c) => c !== main && !GEN.skip.has(c.id));
    if (mainFirst) { visit(main); rest.forEach(visit); } else { rest.forEach(visit); visit(main); }
    return out;
  },
  methods: (prog, c) => _CM.membersOf(prog, c).filter((f) => !f.ctor),
  ctors: (prog, c) => _CM.membersOf(prog, c).filter((f) => f.ctor),
  isMain: (prog, f) => f === prog.functions[0],
  sig: (f) => f.params.map((p) => p.type.toLowerCase() + (p.array ? '[' + (p.dims || 1) : '')).join(','),
  /* does the method override a method of a parent class? */
  overrides(prog, f) {
    const c = _CM.classOf(prog, f);
    for (const k of _CM.chainOf(prog, c).slice(1)) if (OO.methods(prog, k).some((g) => !g.static && g.name.toLowerCase() === f.name.toLowerCase() && OO.sig(g) === OO.sig(f))) return true;
    return false;
  },
  /* is the method overridden in a subclass? */
  overridden(prog, f) {
    const c = _CM.classOf(prog, f);
    return prog.classes.some((k) => k !== c && _CM.isSubclass(prog, k, c) && OO.methods(prog, k).some((g) => !g.static && g.name.toLowerCase() === f.name.toLowerCase() && OO.sig(g) === OO.sig(f)));
  },
  hasChildren: (prog, c) => prog.classes.some((k) => k !== c && (k.parent || '').toLowerCase() === c.name.toLowerCase()),
  /* super(...) as the first block of the constructor: { args, rest } */
  splitSuper(f) {
    const i = f.body.findIndex((s) => s.kind !== 'comment');
    const first = f.body[i];
    if (first && first.kind === 'call') { const e = strip(tryParse(first.expression)); if (e && e.k === 'supercall') return { args: e.args, rest: f.body.filter((_, k) => k !== i) }; }
    return { args: null, rest: f.body };
  },
  classScope: (prog, c, isStatic) => buildScope(prog, { params: [], body: [], cls: c.id, static: isStatic }),
  /* groups of methods with the same name (overloading) */
  groups(list) { const m = new Map(); for (const f of list) { const k = f.name.toLowerCase(); if (!m.has(k)) m.set(k, []); m.get(k).push(f); } return [...m.values()]; },
  tag: (v) => C('vis.' + (v || 'public')),
};
/* Python and JavaScript have no overloading: a single method that chooses the version from the arguments */
function dispatchCond(f, group, n, test) {
  const conds = [test.len(f.params.length)];
  if (group.filter((g) => g.params.length === f.params.length).length > 1) f.params.forEach((p, i) => conds.push(test.type(p, i)));
  return conds.join(n);
}

/* --------------------------- Languages ----------------------------------- */
const LANGS = {};

function escStr(s, q) { return q + s.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), '\\' + q) + q; }

const idxBrackets = (nm, ix) => nm + ix.map((i) => `[${i}]`).join('');
const idxComma = (nm, ix) => `${nm}[${ix.join(', ')}]`;
/* Size(a) and Size(m, d): requested dimension (only as a number written in the program) and dims of the array */
function sizeInfo(n, sc) {
  const a = strip(n.args[0]); const dn = n.args[1] ? strip(n.args[1]) : null;
  let nd = 1;
  if (a && a.k === 'var') {
    const v = sc.vars.get(a.name.toLowerCase());
    if (v && v.dims) nd = v.dims;
    else if (!v && sc.implicitField) { const h = sc.implicitField(a.name); if (h && h.attr.array) nd = _CE.splitTop(h.attr.size).length; }
  } else if (a && a.k === 'member' && sc.objClass) {
    const c = sc.objClass(a.obj); const h = c && sc.fieldHit(c, a.name.toLowerCase());
    if (h && h.attr.array) nd = _CE.splitTop(h.attr.size).length;
  }
  return { d: dn && dn.k === 'num' ? dn.v : 0, nd };
}
const dimsOf = (s, E, sc) => _CE.splitTop(s.size).map((x) => E(x, sc));

/* Generic printing of expressions, with rules per language */
function exprPrinter(L) {
  function pr(n, sc) {
    switch (n.k) {
      case 'par': return pr(n.e, sc);
      case 'num': return { s: n.t === 'Real' ? (n.text && /[.eE]/.test(n.text) ? n.text : String(n.v) + '.0') : String(n.v), p: P.atom };
      case 'str': return { s: L.str(n.v), p: P.atom };
      case 'bool': return { s: n.v ? L.T : L.F, p: P.atom };
      case 'pi': L.use && L.use('pi'); return { s: L.pi, p: P.atom };
      case 'var': {
        let nm = vname(n.name, sc);
        // attribute used with its name alone inside a method
        const h = sc.implicitField && sc.implicitField(n.name);
        if (h) nm = L.field ? L.field(h, sc) : h.attr.name;
        return { s: n.indices ? (L.idx || idxBrackets)(nm, n.indices.map((ix) => pr(ix, sc).s)) : nm, p: P.atom };
      }
      case 'null': return { s: L.nul || 'null', p: P.atom };
      case 'this': return { s: L.self || 'this', p: P.atom };
      case 'new': {
        const c = sc.classNamed ? sc.classNamed(n.cls) : null; const nm = c ? c.name : n.cls;
        const a = n.args.map((x) => pr(x, sc).s).join(', ');
        // predefined exception: the class of the language
        if (_CM.excClass(n.cls) && EXC_LANG[L.lang]) { const t = excL(L.lang, n.cls); return { s: L.newObj ? L.newObj(t, a) : `new ${t}(${a})`, p: P.atom }; }
        // type arguments: those written, otherwise those of the variable being assigned
        let targs = n.targs && n.targs.length ? n.targs : null;
        const gen = c && (c.tparams || []).length;
        if (!targs && gen && sc.expect) { const g = _CE.splitType(sc.expect); if (g.base.toLowerCase() === c.name.toLowerCase() && g.args.length) targs = g.args; }
        const nat = c && L.lang && nativeOf(c.name);
        if (nat && nat[L.lang]) return { s: nat[L.lang].ctor(targs && L.targ ? targs.map(L.targ) : null, a, n.args.map((x) => _CE.inferType(x, sc))), p: P.atom };
        const full = gen && L.targ ? (targs ? `${nm}<${targs.map(L.targ).join(', ')}>` : nm + (L.diamond || '')) : nm;
        return { s: L.newObj ? L.newObj(full, a) : `new ${full}(${a})`, p: P.atom };
      }
      case 'supercall': { const a = n.args.map((x) => pr(x, sc).s).join(', '); return { s: L.superCtor ? L.superCtor(a, sc) : `super(${a})`, p: P.atom }; }
      case 'member': {
        // message of an exception: getMessage(), Message, str(e), what()…
        if (n.name.toLowerCase() === 'message' && L.excMsg && !n.indices) {
          const t = _CE.inferType(n.obj, sc);
          if (t && _CM.isExcClass(sc.prog, _CE.splitType(t).base)) { const o = pr(n.obj, sc); return { s: L.excMsg(o.p < P.atom ? `(${o.s})` : o.s), p: P.atom }; }
        }
        const ref = objRef(n.obj, sc);
        const c = ref.cls || (sc.objClass && sc.objClass(n.obj));
        const h = c && sc.fieldHit(c, n.name.toLowerCase());
        const nm = h ? h.attr.name : n.name;
        let s = ref.cls ? (L.staticSep ? L.staticSep(ref.cls.name, nm) : `${ref.cls.name}.${nm}`) : `${ref.s}${L.arrow || '.'}${nm}`;
        if (n.indices) s = (L.idx || idxBrackets)(s, n.indices.map((ix) => pr(ix, sc).s));
        return { s, p: P.atom };
      }
      case 'mcall': {
        let a = n.args.map((x) => pr(x, sc).s).join(', ');
        const o = strip(n.obj);
        if (o.k === 'super') {
          const par = sc.classNamed && sc.classNamed(sc.cls && sc.cls.parent); const h = par && sc.methodHit(par, n.name.toLowerCase());
          const nm = h ? h.f.name : n.name;
          return { s: L.superMethod ? L.superMethod(nm, a, par) : `super.${nm}(${a})`, p: P.atom };
        }
        const ref = objRef(n.obj, sc);
        const c = ref.cls || (sc.objClass && sc.objClass(n.obj));
        // method of a native class: the language's own is used
        const nat = c && !ref.cls && L.lang && nativeOf(c.name);
        const nm0 = nat && nat[L.lang] && nat[L.lang].m && (sc.methodHit(c, n.name.toLowerCase()) || {}).f;
        if (nm0 && nat[L.lang].m[nm0.name]) { const r = nat[L.lang].m[nm0.name](ref.s, n.args.map((x) => pr(x, sc))); return typeof r === 'string' ? { s: r, p: P.atom } : r; }
        const h = c && sc.methodHit(c, n.name.toLowerCase());
        const nm = h ? h.f.name : n.name;
        if (L.garg && h && (h.f.tparams || []).length) a = n.args.map((x) => L.garg(x, pr(x, sc).s)).join(', ');
        return { s: ref.cls ? `${L.staticSep ? L.staticSep(ref.cls.name, nm) : ref.cls.name + '.' + nm}(${a})` : `${ref.s}${L.arrow || '.'}${nm}(${a})`, p: P.atom };
      }
      case 'un':
        if (n.op === 'neg') { const e = pr(n.e, sc); return { s: '-' + (e.p < P.un ? `(${e.s})` : e.s), p: P.un }; }
        { const np = L.notPrec; const e = pr(n.e, sc); return { s: L.not + (e.p < np || (np === P.un && e.p === P.un && e.s[0] === '-') ? `(${e.s})` : e.s), p: np }; }
      case 'call': return L.call(n, sc, pr);
      case 'bin': return bin(n, sc);
    }
    return { s: '?', p: P.atom };
  }
  /* object to the left of the dot: a class (static access) or an expression */
  function objRef(objNode, sc) {
    const c = sc.classRef && sc.classRef(objNode);
    if (c) return { cls: c };
    const o = strip(objNode);
    if (o.k === 'this') return { s: L.self || 'this' };
    const e = pr(objNode, sc);
    return { s: e.p < P.atom ? `(${e.s})` : e.s };
  }
  function wrap(x, cond) { return cond ? `(${x.s})` : x.s; }
  function generic(n, sc, opText, prec, assoc) {
    const l = pr(n.l, sc), r = pr(n.r, sc);
    const ls = wrap(l, assoc === 'right' ? l.p <= prec : (assoc === 'none' ? l.p <= prec : l.p < prec));
    const rs = wrap(r, assoc === 'right' ? r.p < prec : r.p <= prec);
    return { s: `${ls} ${opText} ${rs}`, p: prec };
  }
  function bin(n, sc) {
    const op = n.op;
    if (L.bin) { const r = L.bin(n, sc, pr, generic); if (r) return r; }
    if (op === 'or') return generic(n, sc, L.or, P.or, 'left');
    if (op === 'and') return generic(n, sc, L.and, P.and, 'left');
    if (REL.includes(op)) return generic(n, sc, L.rel[op], P.rel, 'none');
    if (op === '+' || op === '-') return generic(n, sc, op, P.add, 'left');
    if (op === '*') return generic(n, sc, '*', P.mul, 'left');
    if (op === '/') return generic(n, sc, '/', P.mul, 'left');
    if (op === '%') return generic(n, sc, L.mod || '%', P.mul, 'left');
    if (op === '^') return generic(n, sc, L.pow, P.pow, 'right');
    return { s: '?', p: P.atom };
  }
  return pr;
}

/* Python and JavaScript: the methods of the class are called with self./this. or Class. (static) */
/* name to return: a variable, or an attribute (self.x / this.x / Class.x) */
function retName(name, sc, self) {
  const h = sc.implicitField && sc.implicitField(name);
  if (!h || !self) return h ? h.attr.name : name;
  return h.attr.static ? `${h.owner.name}.${h.attr.name}` : `${self}.${h.attr.name}`;
}
function ucall(entry, sc, self) {
  if (!sc.ooMode || !entry || !entry.owner) return '';
  return entry.f.static ? entry.owner.name + '.' : self + '.';
}
/* declaration followed at once by the assignment of the same variable: it becomes a
   declaration with an initial value (double a = 0.0;). Returns the expression or null. */
function initOf(s, next) {
  if (!next || next.kind !== 'assign' || s.array) return null;
  const names = s.name.split(',').map((x) => x.trim()).filter(Boolean);
  if (names.length !== 1) return null;
  const tg = targetsOf(next); if (tg.length !== 1) return null;
  const lv = strip(tryParse(tg[0]));
  const low = names[0].toLowerCase();
  if (!lv || lv.k !== 'var' || lv.indices || lv.name.toLowerCase() !== low) return null;
  const e = tryParse(next.expression); if (!e) return null;
  let uses = false; // a ← a + 1 cannot be merged
  const visit = (n) => { if (!n || typeof n !== 'object' || uses) return; if (n.k === 'var' && n.name.toLowerCase() === low) uses = true; Object.values(n).forEach(visit); };
  visit(e);
  return uses ? null : next.expression;
}
/* value for a real variable: a written integer (0, -3) becomes 0.0, -3.0 */
function asReal(src, type, E, sc) {
  const s = E(src, sc);
  if (type !== 'Real') return s;
  const n = strip(tryParse(src));
  const intLit = (x) => !!x && x.k === 'num' && x.t === 'Integer';
  return n && (intLit(n) || (n.k === 'un' && n.op === 'neg' && intLit(strip(n.e)))) ? s + '.0' : s;
}

/* type of a modifiable reference (variable, element, attribute) */
function lvTypeOf(v, sc) { const t = tryParse(v); const x = t && strip(t); return x ? _CE.inferType(x, sc) : 'String'; }

/* Flat list of the operands of a chain of & */
function concatParts(n) {
  n = strip(n);
  if (n.k === 'bin' && n.op === '&') return [...concatParts(n.l), ...concatParts(n.r)];
  return [n];
}

/* ------------------------------ Emitter ------------------------------- */
class Out {
  constructor(ind) { this.lines = []; this.lvl = 0; this.ind = ind || '    '; }
  line(s) { this.lines.push(s === '' ? '' : this.ind.repeat(this.lvl) + s); }
  in() { this.lvl++; } out() { this.lvl--; }
  text() { return this.lines.join('\n') + '\n'; }
}

/* ============================ PSEUDOCODE =============================== */
/* the words of the pseudocode come from the language file (code → pseudo.*) */
const PS = (id, p) => C('pseudo.' + id, p);
LANGS.pseudo = {
  label: PS('label'), ext: 'txt', comment: '//',
  // keywords to highlight: the uppercase words of the pseudocode texts
  get keywords() { return [...new Set(Object.keys((I18n.packs.en || {}).code || {}).filter((k) => k.startsWith('pseudo.')).flatMap((k) => (C(k).match(/\b[A-ZÀ-Ý]{2,}\b/g) || [])))].concat(['AND', 'OR', 'NOT', 'MOD']); },
  generate(prog) {
    const TIPO = { Integer: PS('type.Integer'), Real: PS('type.Real'), String: PS('type.String'), Boolean: PS('type.Boolean') };
    const L = {
      idx: idxComma, str: (s) => '"' + s + '"', T: PS('true'), F: PS('false'), pi: 'π', not: 'NOT ', notPrec: P.un, or: 'OR', and: 'AND', mod: 'MOD', pow: '^',
      rel: { '==': '=', '!=': '≠', '<': '<', '<=': '≤', '>': '>', '>=': '≥' },
      call: (n, sc, pr) => ({ s: `${_CE.BUILTIN_NAMES[n.name.toLowerCase()] && !sc.funcs.has(n.name.toLowerCase()) ? _CE.BUILTIN_NAMES[n.name.toLowerCase()] : fname(n.name, sc)}(${n.args.map((a) => pr(a, sc).s).join(', ')})`, p: P.atom }),
      nul: PS('null'), self: PS('this'), newObj: (c, a) => PS('new', { cls: c, args: a }), superCtor: (a) => `SUPER(${a})`, superMethod: (m, a) => `SUPER.${m}(${a})`,
      bin: (n, sc, pr, generic) => (n.op === '&' ? generic(n, sc, '&', P.add - 0.5, 'left') : null),
    };
    const pr = exprPrinter(L);
    const o = new Out('   ');
    const TP = (t) => { const g = _CE.splitType(t); const b = TIPO[g.base] || g.base; return g.args.length ? `${b}<${g.args.map(TP).join(', ')}>` : b; };
    // array shape of a parameter or a return value
    const shape = (x) => (x.array ? ((x.dims || 1) > 1 ? PS('arrayDims', { n: x.dims }) : PS('arrayOf')) + ' ' : '');
    const RT = (r) => shape(r) + TP(r.type);
    const E = (src, sc) => { const t = tryParse(src); return t ? pr(t, sc).s : src; };
    const block = (stmts, sc) => {
      for (const s of stmts) {
        switch (s.kind) {
          case 'const': o.line(`${PS('const')} ${s.name} : ${TP(s.type)} = ${E(s.expression, sc)}`); break;
          case 'declare': o.line(`${PS('declare')} ${s.array ? PS('declareArray', { names: s.name.split(',').map((x) => x.trim() + '[' + dimsOf(s, E, sc).join(', ') + ']').join(', '), type: TP(s.type) }) : `${s.name} : ${TP(s.type)}${String(s.init || '').trim() ? ' = ' + E(s.init, sc) : ''}`}`); break;
          case 'assign': o.line(`${targetsOf(s).map((x) => E(x, sc)).join(', ')} ← ${E(s.expression, sc)}`); break;
          case 'input': o.line(`${PS('read')} ${E(s.variable, sc)}`); break;
          case 'output': o.line(`${PS('write')} ${E(s.expression, sc)}${s.newline ? '' : '   // ' + PS('noNewline')}`); break;
          case 'if':
            o.line(PS('if', { cond: E(s.expression, sc) })); o.in(); block(s.then, sc); o.out();
            if (s.else.length) { o.line(PS('else')); o.in(); block(s.else, sc); o.out(); }
            o.line(PS('endIf')); break;
          case 'while': o.line(PS('while', { cond: E(s.expression, sc) })); o.in(); block(s.body, sc); o.out(); o.line(PS('endWhile')); break;
          case 'do': o.line(PS('repeat')); o.in(); block(s.body, sc); o.out(); o.line(PS('doWhile', { cond: E(s.expression, sc) })); break;
          case 'for': {
            const st = String(s.step).trim();
            o.line(PS('for', { v: E(s.variable, sc), from: E(s.start, sc), to: E(s.end, sc), back: s.direction === 'dec' ? ' ' + PS('backwards') : '', step: st && st !== '1' ? ' ' + PS('step') + ' ' + E(st, sc) : '' }));
            o.in(); block(s.body, sc); o.out(); o.line(PS('endFor')); break;
          }
          case 'call': o.line(`${PS('call')} ${/\(/.test(s.expression) ? E(s.expression, sc) : fname(s.expression.trim(), sc) + '()'}`); break;
          case 'comment': for (const l of String(s.text).split('\n')) o.line('// ' + l); break;
          case 'breakpoint': o.line(`// ${C('breakpoint')}${s.always ? '' : ' ' + PS('if', { cond: s.expression })}`); break;
          case 'open': o.line(PS('open', { file: E(s.expression, sc), mode: PS(s.mode === 'read' ? 'reading' : 'writing') })); break;
          case 'close': o.line(PS('close', { mode: PS(s.mode === 'read' ? 'reading' : 'writing') })); break;
          case 'read': o.line(PS('readFile', { v: E(s.variable, sc) })); break;
          case 'write': o.line(PS('writeFile', { e: E(s.expression, sc) })); break;
          case 'throw': o.line(`THROW ${E(s.expression, sc)}`); break;
          case 'try':
            o.line('TRY'); o.in(); block(s.body, sc); o.out();
            for (const c of s.catches || []) { o.line(`CATCH ${c.type} ${c.variable}`); o.in(); block(c.body, sc); o.out(); }
            if (s.hasFinally) { o.line('FINALLY'); o.in(); block(s.finally || [], sc); o.out(); }
            o.line(PS('endTry')); break;
        }
      }
    };
    const T = TP;
    const psig = (f) => f.params.map((p) => `${p.name} : ${shape(p)}${T(p.type)}`).join(', ');
    if (_CM.hasClasses(prog)) {
      const main = _CM.mainClass(prog);
      const V = (v) => _CM.VISIBILITY[v || 'public'];
      OO.ordered(prog, true).forEach((c, ci) => {
        if (ci) o.line('');
        o.line(`${PS(c.abstract ? 'abstractClass' : 'class')} ${_CM.classTitle(c)}${c.module ? '   // ' + C('fromModule', { name: c.module.name }) : ''}${c.parent ? ' ' + PS('inherits', { parent: c.parent }) : ''}${c === main ? '   // ' + C('mainClass') : ''}`);
        o.in();
        if (c.attributes.length) {
          o.line(PS('attributes')); o.in();
          for (const a of c.attributes) {
            const sc = OO.classScope(prog, c, a.static);
            o.line(`${V(a.visibility)} ${a.name}${a.array ? '[' + _CE.splitTop(a.size).map((x) => E(x, sc)).join(', ') + ']' : ''} : ${T(a.type)}${a.static ? ' ' + PS('static') : ''}${String(a.init || '').trim() ? ' = ' + E(a.init, sc) : ''}`);
          }
          o.out();
        }
        for (const f of [...OO.ctors(prog, c), ...OO.methods(prog, c)]) {
          const sc = buildScope(prog, f);
          const rl = _CM.rets(f);
          o.line('');
          const kw = PS(f.ctor ? 'constructor' : (f.static ? 'staticMethod' : f.abstract ? 'abstractMethod' : 'method'));
          const fnm = f.name + ((f.tparams || []).length ? `<${f.tparams.join(', ')}>` : '');
          if (f.abstract) { o.line(`${kw} ${V(f.visibility)} ${fnm}(${psig(f)})${rl.length ? ' : ' + rl.map(RT).join(', ') : ''}   // ${C('noBody')}`); continue; }
          o.line(`${kw} ${V(f.visibility)} ${fnm}(${psig(f)})${rl.length ? ' : ' + rl.map(RT).join(', ') : ''}`);
          o.in(); block(f.body, sc);
          if (rl.length) o.line(`${PS('return')} ${rl.map((r) => r.name).join(', ')}`);
          o.out(); o.line(PS(f.ctor ? 'endConstructor' : 'endMethod'));
        }
        o.out(); o.line(PS('endClass'));
      });
      return o.text();
    }
    prog.functions.forEach((f, i) => {
      const sc = buildScope(prog, f);
      if (i > 0) o.line('');
      if (i === 0) o.line(`${PS('algorithm')} ${prog.attrs.name ? prog.attrs.name.replace(/\s+/g, '_') : 'Main'}`);
      else {
        const ps = f.params.map((p) => `${p.name} : ${shape(p)}${TP(p.type)}`).join(', ');
        const rl = _CM.rets(f);
        const nm = f.name + ((f.tparams || []).length ? `<${f.tparams.join(', ')}>` : '');
        o.line(!rl.length ? `${PS('procedure')} ${nm}(${ps})` : `${PS('function')} ${nm}(${ps}) : ${rl.map(RT).join(', ')}`);
      }
      o.in(); block(f.body, sc);
      if (i > 0 && _CM.rets(f).length) o.line(`${PS('return')} ${_CM.rets(f).map((r) => r.name).join(', ')}`);
      o.out();
      o.line(i === 0 ? PS('end') : PS(!_CM.rets(f).length ? 'endProcedure' : 'endFunction'));
    });
    return o.text();
  },
};

/* =============================== PYTHON ================================== */
LANGS.python = {
  label: 'Python', ext: 'py', comment: '#',
  keywords: ['def', 'return', 'if', 'elif', 'else', 'while', 'for', 'in', 'range', 'and', 'or', 'not', 'True', 'False', 'import', 'break', 'print', 'input', 'int', 'float', 'str', 'len', 'None', 'pass', 'global', 'open', 'with', 'as', 'class', 'self', 'super', 'is', 'elif', 'staticmethod', 'isinstance', 'raise', 'type', 'args', 'abstractmethod', 'from'],
  generate(prog) {
    const used = new Set();
    const L = {
      str: (s) => escStr(s, '"'), T: 'True', F: 'False', pi: 'math.pi', use: (x) => used.add(x === 'pi' ? 'math' : x), not: 'not ', notPrec: P.notLow, or: 'or', and: 'and', pow: '**',
      rel: { '==': '==', '!=': '!=', '<': '<', '<=': '<=', '>': '>', '>=': '>=' },
      lang: 'python', nul: 'None', self: 'self', newObj: (c, a) => `${c}(${a})`, superCtor: (a) => `super().__init__(${a})`, superMethod: (m, a) => `super().${m}(${a})`,
      excMsg: (o) => `str(${o})`,
      // checked indices (Python would accept negative indices): only if the program catches IndexOutOfRange
      idx: GEN.exc.idx ? (nm, ix) => { used.add('checkIndex'); return ix.reduce((c, i) => `${c}[checkIndex(${c}, ${i})]`, nm); } : undefined,
      field: (h, sc) => (h.attr.static ? `${h.owner.name}.${h.attr.name}` : `self.${h.attr.name}`),
      bin(n, sc, pr, generic) {
        // comparison with None: is / is not
        if ((n.op === '==' || n.op === '!=') && (strip(n.l).k === 'null' || strip(n.r).k === 'null')) return generic(n, sc, n.op === '==' ? 'is' : 'is not', P.rel, 'none');
        if (n.op === '&') {
          const parts = concatParts(n).map((x) => { const t = _CE.inferType(x, sc); const e = pr(x, sc); return t === 'String' ? (e.p <= P.add ? `(${e.s})` : e.s) : `str(${e.s})`; });
          return { s: parts.join(' + '), p: P.add };
        }
        return null;
      },
      call(n, sc, pr) {
        const a = n.args.map((x) => pr(x, sc));
        const A = (i) => (a[i] ? a[i].s : '');
        const At = (i) => (a[i] ? (a[i].p < P.atom ? `(${a[i].s})` : a[i].s) : '');
        if (sc.funcs.has(n.name.toLowerCase())) return { s: `${ucall(sc.funcs.get(n.name.toLowerCase()), sc, 'self')}${fname(n.name, sc)}(${a.map((x) => x.s).join(', ')})`, p: P.atom };
        const low = n.name.toLowerCase();
        const M = (f) => { used.add('math'); return { s: `math.${f}(${A(0)})`, p: P.atom }; };
        switch (low) {
          case 'abs': return { s: `abs(${A(0)})`, p: P.atom };
          case 'arccos': return M('acos'); case 'arcsin': return M('asin'); case 'arctan': return M('atan');
          case 'cos': case 'sin': case 'tan': case 'cosh': case 'sinh': case 'tanh': case 'sqrt': case 'log10': return M(low);
          case 'arccosh': return M('acosh'); case 'arcsinh': return M('asinh'); case 'arctanh': return M('atanh');
          case 'ln': case 'log': return M('log');
          case 'int': return { s: `int(${A(0)})`, p: P.atom };
          case 'sgn': return { s: `((${A(0)} > 0) - (${A(0)} < 0))`, p: P.atom };
          case 'random': used.add('random'); return { s: `random.randrange(${A(0)})`, p: P.atom };
          case 'len': return { s: `len(${A(0)})`, p: P.atom };
          case 'size': return { s: `len(${A(0)}${'[0]'.repeat(sizeInfo(n, sc).d)})`, p: P.atom };
          case 'char': return { s: `${At(0)}[${A(1)}]`, p: P.atom };
          case 'tochar': return { s: `chr(${A(0)})`, p: P.atom };
          case 'tocode': return { s: `ord(${A(0)})`, p: P.atom };
          case 'tofixed': return { s: `"{:.{}f}".format(${A(0)}, ${A(1)})`, p: P.atom };
          case 'tointeger': return { s: `int(${A(0)})`, p: P.atom };
          case 'toreal': return { s: `float(${A(0)})`, p: P.atom };
          case 'tostring': return { s: `str(${A(0)})`, p: P.atom };
          case 'eof': used.add('eof'); return { s: 'end_of_file()', p: P.atom };
        }
        return { s: `${n.name}(${a.map((x) => x.s).join(', ')})`, p: P.atom };
      },
    };
    const pr = exprPrinter(L);
    const E = (src, sc) => { const t = tryParse(src); return t ? pr(t, sc).s : src; };
    const DEF = { Integer: '0', Real: '0.0', String: '""', Boolean: 'False' };
    const DEFT = (t) => DEF[t] || 'None';
    const CAST = { Integer: 'int(input())', Real: 'float(input())', String: 'input()', Boolean: 'input().strip().lower() == "true"' };
    const lvType = (v, sc) => lvTypeOf(v, sc);
    const body = new Out();
    const block = (stmts, sc, o) => {
      const start = o.lines.length;
      for (let si = 0; si < stmts.length; si++) {
        const s = stmts[si];
        switch (s.kind) {
          case 'const': o.line(`${vname(s.name.trim(), sc)} = ${E(s.expression, sc)}  # costante`); break;
          case 'declare': {
            if (!s.array && String(s.init || '').trim()) { for (const nm of s.name.split(',').map((x) => x.trim()).filter(Boolean)) o.line(`${nm} = ${asReal(s.init, s.type, E, sc)}`); break; }
            const init = initOf(s, stmts[si + 1]);
            if (init != null) { o.line(`${s.name.trim()} = ${withExpect(sc, s.type, () => asReal(init, s.type, E, sc))}`); si++; break; }
            for (const nm of s.name.split(',').map((x) => x.trim()).filter(Boolean)) {
              if (!s.array) { o.line(`${nm} = ${DEFT(s.type)}`); continue; }
              const D = dimsOf(s, E, sc);
              let init = `[${DEFT(s.type)}] * (${D[D.length - 1]})`;
              for (let k = D.length - 2; k >= 0; k--) init = `[${init} for _ in range(${D[k]})]`;
              o.line(`${nm} = ${init}`);
            }
            break;
          }
          case 'assign': { const tg = targetsOf(s); const lt = tg.length === 1 ? lvType(s.variable, sc) : null; o.line(`${tg.map((x) => E(x, sc)).join(', ')} = ${tg.length === 1 ? withExpect(sc, lt, () => asReal(s.expression, lt, E, sc)) : E(s.expression, sc)}`); break; }
          case 'input': o.line(`${E(s.variable, sc)} = ${CAST[lvType(s.variable, sc)]}`); break;
          case 'output': o.line(s.newline ? `print(${E(s.expression, sc)})` : `print(${E(s.expression, sc)}, end="")`); break;
          case 'if': {
            o.line(`if ${E(s.expression, sc)}:`); o.in(); block(s.then, sc, o); o.out();
            if (s.else.length === 1 && s.else[0].kind === 'if') {
              // elif chain
              let cur = s.else[0];
              for (;;) {
                o.line(`elif ${E(cur.expression, sc)}:`); o.in(); block(cur.then, sc, o); o.out();
                if (cur.else.length === 1 && cur.else[0].kind === 'if') { cur = cur.else[0]; continue; }
                if (cur.else.length) { o.line('else:'); o.in(); block(cur.else, sc, o); o.out(); }
                break;
              }
            } else if (s.else.length) { o.line('else:'); o.in(); block(s.else, sc, o); o.out(); }
            break;
          }
          case 'while': o.line(`while ${E(s.expression, sc)}:`); o.in(); block(s.body, sc, o); o.out(); break;
          case 'do': {
            o.line('while True:'); o.in(); block(s.body, sc, o);
            const t = tryParse(s.expression); const c = t ? pr(t, sc) : { s: s.expression, p: 0 };
            o.line(`if not ${c.p <= P.notLow ? '(' + c.s + ')' : c.s}:`); o.in(); o.line('break'); o.out(); o.out();
            break;
          }
          case 'for': {
            const step = String(s.step).trim() || '1';
            const isReal = lvType(s.variable, sc) === 'Real';
            if (isReal) {
              o.line(`${E(s.variable, sc)} = ${E(s.start, sc)}`);
              o.line(`while ${E(s.variable, sc)} ${s.direction === 'dec' ? '>=' : '<='} ${E(s.end, sc)}:`); o.in(); block(s.body, sc, o);
              o.line(`${E(s.variable, sc)} ${s.direction === 'dec' ? '-=' : '+='} ${E(step, sc)}`); o.out();
            } else {
              const endT = tryParse(s.end); const endP = endT ? pr(endT, sc) : { s: s.end, p: 0 };
              const endS = endP.p < P.add ? `(${endP.s})` : endP.s;
              const lim = s.direction === 'dec' ? `${endS} - 1` : `${endS} + 1`;
              const stepS = step === '1' ? '' : `, ${s.direction === 'dec' ? '-' : ''}${E(step, sc)}`;
              o.line(`for ${E(s.variable, sc)} in range(${E(s.start, sc)}, ${lim}${s.direction === 'dec' && step === '1' ? ', -1' : stepS}):`);
              o.in(); block(s.body, sc, o); o.out();
            }
            break;
          }
          case 'call': o.line(/\(/.test(s.expression) ? E(s.expression, sc) : fname(s.expression.trim(), sc) + '()'); break;
          case 'comment': for (const l of String(s.text).split('\n')) o.line('# ' + l); break;
          case 'breakpoint': o.line(`# ${C('breakpoint')}${s.always ? '' : ': ' + s.expression}`); break;
          case 'open': used.add('files'); o.line(s.mode === 'read' ? `file_in = open(${E(s.expression, sc)}, "r")` : `file_out = open(${E(s.expression, sc)}, "w")`); break;
          case 'close': used.add('files'); o.line(s.mode === 'read' ? 'file_in.close()' : 'file_out.close()'); break;
          case 'read': {
            used.add('files'); const t = lvType(s.variable, sc);
            const raw = 'file_in.readline().rstrip("\\n")';
            o.line(`${E(s.variable, sc)} = ${t === 'Integer' ? `int(${raw})` : t === 'Real' ? `float(${raw})` : t === 'Boolean' ? `${raw}.lower() == "true"` : raw}`);
            break;
          }
          case 'write': used.add('files'); o.line(`file_out.write(str(${E(s.expression, sc)}) + "\\n")`); break;
          case 'throw': o.line(`raise ${E(s.expression, sc)}`); break;
          case 'try':
            o.line('try:'); o.in(); block(s.body, sc, o); o.out();
            for (const c of s.catches || []) { o.line(`except ${excL('python', c.type)} as ${c.variable}:`); o.in(); block(c.body, sc, o); o.out(); }
            if (s.hasFinally) { o.line('finally:'); o.in(); block(s.finally || [], sc, o); o.out(); }
            break;
        }
      }
      if (o.lines.length === start) o.line('pass');
    };
    const pyArr = (D, def) => { let init = `[${def}] * (${D[D.length - 1]})`; for (let k = D.length - 2; k >= 0; k--) init = `[${init} for _ in range(${D[k]})]`; return init; };
    const head = () => {
      const hd = [];
      if (prog.attrs.name) hd.push(`# ${prog.attrs.name}`);
      if (used.has('math')) hd.push('import math');
      if (used.has('random')) hd.push('import random');
      if (used.has('abc')) hd.push('from abc import ABC, abstractmethod');
      if (GEN.helpers.has('deque')) hd.push('from collections import deque');
      if (hd.length) hd.push('');
      if (used.has('checkIndex')) hd.push('def checkIndex(v, i):', `    # ${C('indexCheckComment')}`, '    if i < 0 or i >= len(v):', `        raise IndexError("${C('index')}" + str(i) + "${C('outOfBounds')}")`, '    return i', '', '');
      if (used.has('eof')) hd.push('def end_of_file():', '    pos = file_in.tell()', '    line = file_in.readline()', '    file_in.seek(pos)', '    return line == ""', '', '');
      return hd.join('\n') + (hd.length ? '\n' : '');
    };
    if (_CM.hasClasses(prog)) {
      // ---------------- programma a oggetti ----------------
      const o = new Out();
      const main = _CM.mainClass(prog);
      const attrInit = (a, sc) => (a.array ? pyArr(_CE.splitTop(a.size).map((x) => E(x, sc)), DEFT(a.type)) : (String(a.init || '').trim() ? E(a.init, sc) : DEFT(a.type)));
      const pyType = { Integer: (x) => `type(${x}) is int`, Real: (x) => `isinstance(${x}, (int, float))`, String: (x) => `isinstance(${x}, str)`, Boolean: (x) => `isinstance(${x}, bool)` };
      const test = { len: (n) => `len(args) == ${n}`, type: (p, i) => (p.array ? `isinstance(args[${i}], list)` : isTP(p.type) ? 'True' : (pyType[p.type] || ((x) => `isinstance(${x}, ${_CE.splitType(p.type).base})`))(`args[${i}]`)) };
      for (const c of OO.ordered(prog, false)) {
        // abstract class: derives from ABC (if the parent does not already)
        const par = _CM.classByName(prog, c.parent);
        const bases = [...(c.parent ? [parentL('python', c)] : []), ...(c.abstract && !(par && _CM.chainOf(prog, par).some((k) => k.abstract)) ? ['ABC'] : [])];
        if (c.abstract) used.add('abc');
        o.line(`class ${c.name}${bases.length ? `(${bases.join(', ')})` : ''}:`); o.in();
        const start = o.lines.length;
        for (const a of c.attributes.filter((x) => x.static)) o.line(`${a.name} = ${attrInit(a, OO.classScope(prog, c, true))}  # ${C('static')}, ${OO.tag(a.visibility)}`);
        const inst = c.attributes.filter((x) => !x.static);
        const fieldLines = (out) => { const sc = OO.classScope(prog, c, false); for (const a of inst) out.line(`self.${a.name} = ${attrInit(a, sc)}${a.visibility !== 'public' ? '  # ' + OO.tag(a.visibility) : ''}`); };
        // body of a constructor: super, attributes, blocks
        const ctorBody = (f, out) => {
          const sp = OO.splitSuper(f); const sc = buildScope(prog, f);
          if (sp.args) out.line(`super().__init__(${sp.args.map((x) => pr(x, sc).s).join(', ')})`);
          else if (c.parent) out.line('super().__init__()');
          fieldLines(out);
          block(sp.rest, sc, out);
          if (out.lines[out.lines.length - 1].trim() === 'pass' && out.lines.length > 1 && /self\.|super\(\)/.test(out.lines[out.lines.length - 2])) out.lines.pop();
        };
        const methodBody = (f, out) => {
          if (f.abstract) { out.line(`raise NotImplementedError("${f.name}() è astratto: lo definiscono le sottoclassi")`); return; }
          const before = out.lines.length;
          const msc = buildScope(prog, f);
          block(f.body, msc, out);
          const rl = _CM.rets(f);
          if (rl.length) {
            if (out.lines.length === before + 1 && out.lines[out.lines.length - 1].trim() === 'pass') out.lines.pop();
            out.line(`return ${rl.map((r) => retName(r.name, msc, 'self')).join(', ')}`);
          }
        };
        const ctors = OO.ctors(prog, c);
        if (!ctors.length && (inst.length || c.parent)) {
          if (o.lines.length > start) o.line('');
          o.line('def __init__(self):'); o.in(); if (c.parent) o.line('super().__init__()'); fieldLines(o); o.out();
        }
        const emitGroup = (group, isCtor) => {
          if (o.lines.length > start) o.line('');
          const f0 = group[0];
          const isStatic = !isCtor && f0.static;
          const name = isCtor ? '__init__' : (OO.isMain(prog, f0) ? 'main' : f0.name);
          const note = (f) => ((f.visibility || 'public') !== 'public' ? '  # ' + OO.tag(f.visibility) : '');
          if (isStatic) o.line('@staticmethod');
          if (group.length === 1 && f0.abstract) {
            used.add('abc');
            o.line('@abstractmethod');
            o.line(`def ${name}(${['self', ...f0.params.map((x) => x.name)].join(', ')}):${note(f0)}`);
            o.in(); o.line('pass'); o.out();
            return;
          }
          if (group.length === 1) {
            o.line(`def ${name}(${[...(isStatic ? [] : ['self']), ...f0.params.map((x) => x.name)].join(', ')}):${note(f0)}`);
            o.in(); (isCtor ? ctorBody : methodBody)(f0, o); o.out();
            return;
          }
          // overloading: the version is chosen from the number and type of the arguments
          o.line(`def ${name}(${isStatic ? '' : 'self, '}*args):  # ${C('versions', { count: group.length })}${note(f0)}`); o.in();
          group.forEach((f, k) => {
            o.line(`${k ? 'elif' : 'if'} ${dispatchCond(f, group, ' and ', test)}:`); o.in();
            if (f.params.length) o.line(`${f.params.map((x) => x.name).join(', ')}${f.params.length === 1 ? ',' : ''} = args`);
            (isCtor ? ctorBody : methodBody)(f, o); o.out();
          });
          o.line('else:'); o.in(); o.line(`raise TypeError("${C('noVersion', { name: isCtor ? c.name : f0.name })}")`); o.out();
          o.out();
        };
        if (ctors.length) emitGroup(ctors, true);
        for (const g of OO.groups(OO.methods(prog, c))) emitGroup(g, false);
        if (o.lines.length === start) o.line('pass');
        o.out(); o.line(''); o.line('');
      }
      o.line(`${main.name}.main()`);
      return head() + o.text();
    }
    const funcs = new Out();
    prog.functions.slice(1).forEach((f) => {
      const sc = buildScope(prog, f);
      funcs.line(`def ${f.name}(${f.params.map((p) => p.name).join(', ')}):`);
      funcs.in();
      const before = funcs.lines.length;
      block(f.body, sc, funcs);
      const rl = _CM.rets(f);
      if (rl.length) {
        if (funcs.lines.length === before + 1 && funcs.lines[funcs.lines.length - 1].trim() === 'pass') funcs.lines.pop();
        funcs.line(`return ${rl.map((r) => r.name).join(', ')}`);
      }
      funcs.out(); funcs.line(''); funcs.line('');
    });
    const main = prog.functions[0];
    block(main.body, buildScope(prog, main), body);
    return head() + (funcs.lines.length ? funcs.text() : '') + '# Main\n' + body.text();
  },
};

/* ======================== C family (C++, Java, C#, JS) ================= */
function cFamily(cfg) {
  return {
    label: cfg.label, ext: cfg.ext, comment: '//', keywords: cfg.keywords,
    generate(prog) {
      const used = new Set();
      const L = {
        // indices checked only if the program catches IndexOutOfRange (C++ .at(), JavaScript checkIndex())
        idx: GEN.exc.idx && cfg.idxChk ? (nm, ix) => cfg.idxChk(nm, ix, used) : cfg.idx, str: (s) => cfg.strLit(s), T: 'true', F: 'false', pi: cfg.pi, use: () => used.add('pi'),
        not: '!', notPrec: P.un, or: '||', and: '&&', pow: '**',
        rel: { '==': cfg.eq || '==', '!=': cfg.neq || '!=', '<': '<', '<=': '<=', '>': '>', '>=': '>=' },
        lang: cfg.lang, targ: cfg.targ, diamond: cfg.diamond, garg: cfg.garg, excMsg: cfg.excMsg,
        nul: cfg.nul, self: cfg.self, arrow: cfg.arrow, staticSep: cfg.staticSep, newObj: cfg.newObj, superCtor: cfg.superCtor, superMethod: cfg.superMethod, field: cfg.field,
        bin(n, sc, pr) {
          const lt = _CE.inferType(n.l, sc), rt = _CE.inferType(n.r, sc);
          if (n.op === '&') {
            const parts = concatParts(n).map((x) => cfg.toStr(x, _CE.inferType(x, sc), pr(x, sc), used));
            if (cfg.concatPrefix && _CE.inferType(concatParts(n)[0], sc) !== 'String') parts.unshift(cfg.concatPrefix);
            return { s: parts.join(' + '), p: P.add };
          }
          // division and remainder by zero: where the language does not throw an exception, a check function
          if (GEN.exc.div && n.op === '/' && cfg.divFn) return { s: cfg.divFn(pr(n.l, sc).s, pr(n.r, sc).s, used), p: P.atom };
          if (GEN.exc.div && n.op === '%' && cfg.modFn && lt !== 'Real' && rt !== 'Real') return { s: cfg.modFn(pr(n.l, sc).s, pr(n.r, sc).s, used), p: P.atom };
          if (n.op === '/' && cfg.intDiv && lt !== 'Real' && rt !== 'Real') {
            const l = pr(n.l, sc), r = pr(n.r, sc);
            return { s: `(double) ${l.p < P.atom ? '(' + l.s + ')' : l.s} / ${r.p <= P.mul ? '(' + r.s + ')' : r.s}`, p: P.mul };
          }
          if (n.op === '%' && cfg.fmod && (lt === 'Real' || rt === 'Real')) return { s: `fmod(${pr(n.l, sc).s}, ${pr(n.r, sc).s})`, p: P.atom };
          if (n.op === '^' && cfg.powFn) {
            const s = `${cfg.powFn}(${pr(n.l, sc).s}, ${pr(n.r, sc).s})`;
            return _CE.inferType(n, sc) === 'Integer' && cfg.intCast ? { s: `${cfg.intCast}${s}`, p: P.un } : { s, p: P.atom };
          }
          if (n.op === '^') { // JavaScript **
            const l = pr(n.l, sc), r = pr(n.r, sc);
            return { s: `${l.p <= P.pow ? '(' + l.s + ')' : l.s} ** ${r.p < P.pow ? '(' + r.s + ')' : r.s}`, p: P.pow };
          }
          // comparisons between values of type T: equals / compareTo
          if (REL.includes(n.op) && cfg.cmpT && (isTP(lt) || isTP(rt) || (['==', '!='].includes(n.op) && boxedElem(n.l, sc) && boxedElem(n.r, sc)))) return cfg.cmpT(n.op, pr(n.l, sc), pr(n.r, sc));
          if (REL.includes(n.op) && lt === 'String' && rt === 'String' && cfg.strCmp) return cfg.strCmp(n.op, pr(n.l, sc), pr(n.r, sc));
          return null;
        },
        call(n, sc, pr) {
          const a = n.args.map((x) => pr(x, sc));
          const uf = sc.funcs.get(n.name.toLowerCase());
          if (uf && cfg.garg && (uf.f.tparams || []).length) a.forEach((x, i) => { x.s = cfg.garg(n.args[i], x.s); });
          if (sc.funcs.has(n.name.toLowerCase())) return { s: `${cfg.qualifyCalls ? ucall(sc.funcs.get(n.name.toLowerCase()), sc, 'this') : ''}${fname(n.name, sc)}(${a.map((x) => x.s).join(', ')})`, p: P.atom };
          const low = n.name.toLowerCase();
          const r = cfg.builtin(low, a, n, sc, used);
          if (r) return typeof r === 'string' ? { s: r, p: P.atom } : r;
          return { s: `${n.name}(${a.map((x) => x.s).join(', ')})`, p: P.atom };
        },
      };
      const pr = exprPrinter(L);
      const E = (src, sc) => { const t = tryParse(src); return t ? pr(t, sc).s : src; };
      const lvInfo = (v, sc) => ({ type: lvTypeOf(v, sc) });
      const blk = (o, stmts, sc) => { o.in(); block(o, stmts, sc); o.out(); };
      const unsupported = (o, what) => o.line(`// [${C('unsupported', { what, lang: cfg.label })}]`);
      function block(o, stmts, sc) {
        for (let si = 0; si < stmts.length; si++) {
          const s = stmts[si];
          switch (s.kind) {
            case 'const': o.line(cfg.constDecl(s.name.trim(), s.type, E(s.expression, sc), isLiteralExpr(s.expression))); break;
            case 'declare': {
              if (!s.array && String(s.init || '').trim() && cfg.declareInit) { for (const nm of s.name.split(',').map((x) => x.trim()).filter(Boolean)) o.line(cfg.declareInit(nm, s.type, withExpect(sc, s.type, () => asReal(s.init, s.type, E, sc)))); break; }
              const init = initOf(s, stmts[si + 1]);
              if (init != null && cfg.declareInit) { o.line(cfg.declareInit(s.name.trim(), s.type, withExpect(sc, s.type, () => asReal(init, s.type, E, sc)))); si++; break; }
              for (const nm of s.name.split(',').map((x) => x.trim()).filter(Boolean)) o.line(cfg.declare(nm, s.type, s.array, s.array ? dimsOf(s, E, sc) : null, used, sc));
              break;
            }
            case 'assign': {
              const tg = targetsOf(s);
              if (tg.length > 1) cfg.multiAssign(o, tg.map((x) => E(x, sc)), E(s.expression, sc), calleeOf(s, sc), sc, used);
              else { const lt = lvInfo(s.variable, sc).type; o.line(`${E(s.variable, sc)} = ${withExpect(sc, lt, () => asReal(s.expression, lt, E, sc))};`); }
              break;
            }
            case 'input': cfg.input(o, E(s.variable, sc), lvInfo(s.variable, sc).type, used); break;
            case 'output': {
              // in C++ << binds tighter than comparisons: cout << (a == b)
              const x = tryParse(s.expression); const ex = x ? pr(x, sc) : { s: s.expression, p: P.atom };
              o.line(cfg.output(cfg.wrapOut && ex.p <= P.rel ? `(${ex.s})` : ex.s, s.newline) + ';');
              break;
            }
            case 'if': {
              o.line(`if (${E(s.expression, sc)}) {`); blk(o, s.then, sc);
              let cur = s;
              while (cur.else.length === 1 && cur.else[0].kind === 'if') {
                cur = cur.else[0];
                o.line(`} else if (${E(cur.expression, sc)}) {`); blk(o, cur.then, sc);
              }
              if (cur.else.length) { o.line('} else {'); blk(o, cur.else, sc); }
              o.line('}');
              break;
            }
            case 'while': o.line(`while (${E(s.expression, sc)}) {`); blk(o, s.body, sc); o.line('}'); break;
            case 'do': o.line('do {'); blk(o, s.body, sc); o.line(`} while (${E(s.expression, sc)});`); break;
            case 'for': {
              const v = E(s.variable, sc), step = String(s.step).trim() || '1', dec = s.direction === 'dec';
              const inc = step === '1' ? (dec ? `${v}--` : `${v}++`) : `${v} ${dec ? '-=' : '+='} ${E(step, sc)}`;
              o.line(`for (${v} = ${E(s.start, sc)}; ${v} ${dec ? '>=' : '<='} ${E(s.end, sc)}; ${inc}) {`); blk(o, s.body, sc); o.line('}');
              break;
            }
            case 'call': o.line((/\(/.test(s.expression) ? E(s.expression, sc) : fname(s.expression.trim(), sc) + '()') + ';'); break;
            case 'comment': for (const l of String(s.text).split('\n')) o.line('// ' + l); break;
            case 'breakpoint': o.line(`// ${C('breakpoint')}${s.always ? '' : ': ' + s.expression}`); break;
            case 'open': case 'close': case 'read': case 'write':
              if (cfg.files) cfg.files(o, s, E, sc, lvInfo, used); else unsupported(o, `file: ${s.kind} ${s.expression || s.variable || s.mode}`);
              break;
            case 'throw': o.line(cfg.throwStmt ? cfg.throwStmt(s, E, sc, pr) : `throw ${E(s.expression, sc)};`); break;
            case 'try': {
              if (cfg.tryStmt) { cfg.tryStmt(o, s, sc, blk, used); break; }
              o.line('try {'); blk(o, s.body, sc);
              for (const c of s.catches || []) { o.line(`} catch (${excL(cfg.lang, c.type)} ${c.variable}) {`); blk(o, c.body, sc); }
              if (s.hasFinally) { o.line('} finally {'); blk(o, s.finally || [], sc); }
              o.line('}');
              break;
            }
          }
        }
      }
      const g = { block, E, pr, buildScope: (f) => buildScope(prog, f), used, Out };
      if (_CM.hasClasses(prog) && cfg.programOO) return cfg.programOO(prog, g);
      return cfg.program(prog, g);
    },
  };
}

const T_CPP = { Integer: 'int', Real: 'double', String: 'string', Boolean: 'bool', None: 'void' };
/* objects in C++ are pointers (created with new); T stays T; native ArrayList<int> becomes vector<int>* */
const tCpp = (t) => {
  const g = _CE.splitType(t);
  if (!g.args.length) return T_CPP[t] || (isTP(t) ? t : (_CM.excClass(t) ? excL('cpp', t) : t) + '*');
  const a = g.args.map(tCpp), n = nativeOf(g.base);
  return n && n.cpp ? n.cpp.type(a) : `${g.base}<${a.join(', ')}>*`;
};
const tplOf = (c) => ((c.tparams || []).length ? `template <${c.tparams.map((t) => 'typename ' + t).join(', ')}>` : '');
/* returned value: an array becomes a vector (nested for more dims) */
const cppRetT = (r) => (r.array ? 'vector<'.repeat(r.dims || 1) + tCpp(r.type) + '>'.repeat(r.dims || 1) : tCpp(r.type));
/* generic function: template <typename T> before the signature */
const tplF = (f) => ((f.tparams || []).length ? `template <${f.tparams.map((t) => 'typename ' + t).join(', ')}> ` : '');
const qualOf = (c) => ((c.tparams || []).length ? `${c.name}<${c.tparams.join(', ')}>` : c.name);
const CPP_HELPERS = {
  removeAt: [() => '// ' + C('removeAtComment'), 'template <typename T> T removeAt(vector<T>* v, int i) { T x = (*v)[i]; v->erase(v->begin() + i); return x; }'],
  indexOfItem: [() => '// ' + C('indexOfComment'), 'template <typename T, typename U> int indexOfItem(vector<T>* v, const U& x) { for (int i = 0; i < (int) v->size(); i++) if ((*v)[i] == x) return i; return -1; }'],
  popTop: [() => '// ' + C('popTopComment'), 'template <typename T> T popTop(stack<T>* s) { T x = s->top(); s->pop(); return x; }'],
  popFront: [() => '// ' + C('popFrontComment'), 'template <typename T> T popFront(queue<T>* q) { T x = q->front(); q->pop(); return x; }'],
};
function cppHeaderExtras(o) {
  if (GEN.helpers.has('stack')) o.line('#include <stack>');
  if (GEN.helpers.has('queue')) o.line('#include <queue>');
}
/* exceptions in C++: include, classes of the predefined exceptions that C++ does not have, check functions */
function cppExcIncludes(o, u) {
  if (!GEN.exc.used && !u.has('divide') && !u.has('conv')) return;
  o.line('#include <stdexcept>');
  if (u.has('excptr')) o.line('#include <exception>');
}
function cppExcHelpers(o, u) {
  const lines = [];
  for (const b of _CM.EXC_CLASSES) if (GEN.helpers.has('exc:' + b.name)) lines.push(`class ${b.name} : public runtime_error { public: using runtime_error::runtime_error; };`);
  if (u.has('divide')) lines.push('// ' + C('divRemComment'), `double divide(double a, double b) { if (b == 0) throw DivisionByZero("${C('divisionByZero')}"); return a / b; }`);
  if (u.has('remainderOf')) lines.push(`int remainderOf(int a, int b) { if (b == 0) throw DivisionByZero("${C('moduloByZero')}"); return a % b; }`);
  if (u.has('conv')) lines.push('// ' + C('convIntComment'),
    `int toInt(const string& s) { size_t n = 0; int v = stoi(s, &n); if (n != s.size()) throw invalid_argument("\\"" + s + "\\"${C('notInteger')}"); return v; }`,
    `double toReal(const string& s) { size_t n = 0; double v = stod(s, &n); if (n != s.size()) throw invalid_argument("\\"" + s + "\\"${C('notReal')}"); return v; }`);
  if (lines.length) { o.line(''); lines.forEach((l) => o.line(l)); }
}
/* JavaScript: classes of the predefined exceptions (except Exception = Error) and check functions */
function jsExcHelpers(u) {
  const lines = [];
  const add = (...l) => { if (lines.length) lines.push(''); lines.push(...l); };
  for (const b of _CM.EXC_CLASSES) if (GEN.helpers.has('exc:' + b.name)) add(`class ${b.name} extends Error {}`);
  if (u.has('divide')) add('// ' + C('divRemComment'), `function divide(a, b) { if (b === 0) throw new DivisionByZero("${C('divisionByZero')}"); return a / b; }`);
  if (u.has('remainderOf')) add(`function remainderOf(a, b) { if (b === 0) throw new DivisionByZero("${C('moduloByZero')}"); return a % b; }`);
  if (u.has('checkIndex')) add('// ' + C('indexCheckComment'), `function checkIndex(v, i) { if (i < 0 || i >= v.length) throw new IndexOutOfRange("${C('index')}" + i + "${C('outOfBounds')}"); return i; }`);
  if (u.has('conv')) add('// ' + C('convComment'), 'function toInt(s) { if (!/^\\s*[-+]?\\d+\\s*$/.test(s)) throw new InvalidConversion(\'"\' + s + \'"' + C('notInteger') + '\'); return parseInt(s); }',
    'function toReal(s) { const v = Number(s); if (String(s).trim() === "" || isNaN(v)) throw new InvalidConversion(\'"\' + s + \'"' + C('notReal') + '\'); return v; }');
  return lines;
}
function cppHelpers(o) {
  const hs = Object.keys(CPP_HELPERS).filter((k) => GEN.helpers.has(k));
  if (!hs.length) return;
  o.line('');
  for (const k of hs) CPP_HELPERS[k].forEach((l) => o.line(typeof l === 'function' ? l() : l));
}
const DEF_CPP = { Integer: '0', Real: '0.0', String: '""', Boolean: 'false' };
const usesFiles = (prog) => prog.functions.some((f) => { let u = false; _CM.walk(f.body, (s) => { if (['open', 'close', 'read', 'write'].includes(s.kind)) u = true; }); return u; });
const cap = (n) => n[0].toUpperCase() + n.slice(1);
/* parts of a C++ declaration: type and initialization (nested vectors for arrays) */
function cppParts(t, arr, D) {
  if (!arr) return { ty: tCpp(t), init: null };
  const ty = (k) => 'vector<'.repeat(D.length - k) + tCpp(t) + '>'.repeat(D.length - k);
  const init = (k) => (k === D.length - 1 ? D[k] : `${D[k]}, ${ty(k + 1)}(${init(k + 1)})`);
  return { ty: ty(0), args: init(0) };
}
LANGS.cpp = cFamily({
  lang: 'cpp', targ: (t) => tCpp(t),
  excMsg: (o) => `string(${o}->what())`,
  divFn: (a, b, used) => { used.add('divide'); need('exc:DivisionByZero'); return `divide(${a}, ${b})`; },
  modFn: (a, b, used) => { used.add('remainderOf'); need('exc:DivisionByZero'); return `remainderOf(${a}, ${b})`; },
  idxChk: (nm, ix) => ix.reduce((c, i) => `${c}.at(${i})`, nm),
  // Throw: the object is thrown (not the pointer), as is done in C++
  throwStmt(s, E, sc, pr) {
    const n = strip(tryParse(s.expression));
    if (n && n.k === 'new') { const t = _CM.excClass(n.cls) ? excL('cpp', n.cls) : ((sc.classNamed && sc.classNamed(n.cls)) || { name: n.cls }).name; return `throw ${t}(${n.args.map((a) => pr(a, sc).s).join(', ')});`; }
    return `throw *${E(s.expression, sc)};`;
  },
  // Catch: the exception is caught by reference and used through a pointer (like the other objects);
  // Finally does not exist in C++: everything is caught, the Finally runs and then the exception continues
  tryStmt(o, s, sc, blk, used) {
    const cats = s.catches || [];
    const inner = () => {
      o.line('try {'); blk(o, s.body, sc);
      for (const c of cats) {
        const T = _CM.excClass(c.type) && _CM.excClass(c.type).name === 'Exception' ? 'exception' : excL('cpp', c.type);
        o.line(`} catch (${T}& exc_) {`);
        if (new RegExp('\\b' + c.variable + '\\b', 'i').test(JSON.stringify(c.body))) { o.in(); o.line(`${T}* ${c.variable} = &exc_;`); o.out(); }
        blk(o, c.body, sc);
      }
      o.line('}');
    };
    if (!s.hasFinally) { inner(); return; }
    used.add('excptr');
    o.line('{'); o.in();
    o.line('exception_ptr pending = nullptr; // ' + C('finallyPending'));
    if (cats.length) { o.line('try {'); o.in(); inner(); o.out(); } else { o.line('try {'); blk(o, s.body, sc); }
    o.line('} catch (...) {'); o.in(); o.line('pending = current_exception();'); o.out(); o.line('}');
    o.line('// Finally'); o.out(); blk(o, s.finally || [], sc); o.in();
    o.line('if (pending) rethrow_exception(pending);');
    o.out(); o.line('}');
  },
  // generic functions: "text" is a const char*, with string("text") T becomes string
  garg: (node, s) => (strip(node) && strip(node).k === 'str' ? `string(${s})` : s),
  label: 'C++', ext: 'cpp', intDiv: true, fmod: true, powFn: 'pow', intCast: '(int) ', wrapOut: true,
  keywords: ['int', 'double', 'string', 'bool', 'void', 'return', 'if', 'else', 'while', 'for', 'do', 'true', 'false', 'using', 'namespace', 'std', 'include', 'cout', 'cin', 'endl', 'vector', 'const', 'main', 'class', 'public', 'private', 'protected', 'static', 'virtual', 'new', 'this', 'nullptr'],
  pi: 'PI',
  strLit: (s) => escStr(s, '"'),
  toStr(x, t, e, used) {
    if (t === 'String') return x.k === 'str' ? `string(${e.s})` : (e.p <= P.add ? `(${e.s})` : e.s);
    if (t === 'Boolean') return `string(${e.s} ? "true" : "false")`;
    if (t === 'Real') { used.add('fmt'); return `formatNum(${e.s})`; }
    return `to_string(${e.s})`;
  },
  builtin(low, a, n, sc, used) {
    const A = (i) => (a[i] ? a[i].s : '');
    const At = (i) => (a[i] ? (strip(n.args[i]).k === 'str' ? `string(${a[i].s})` : a[i].p < P.atom ? `(${a[i].s})` : a[i].s) : '');
    const map = { abs: 'abs', arccos: 'acos', arcsin: 'asin', arctan: 'atan', cos: 'cos', sin: 'sin', tan: 'tan', cosh: 'cosh', sinh: 'sinh', tanh: 'tanh', arccosh: 'acosh', arcsinh: 'asinh', arctanh: 'atanh', ln: 'log', log: 'log', log10: 'log10', sqrt: 'sqrt' };
    if (map[low]) return `${map[low]}(${A(0)})`;
    switch (low) {
      case 'int': return { s: `(int) ${At(0)}`, p: P.un };
      case 'sgn': return `((${A(0)} > 0) - (${A(0)} < 0))`;
      case 'random': used.add('rand'); return { s: `rand() % ${At(0)}`, p: P.mul };
      case 'len': return `(int) ${At(0)}.length()`;
      case 'size': return `(int) ${At(0)}${'[0]'.repeat(sizeInfo(n, sc).d)}.size()`;
      case 'char': return `string(1, ${At(0)}[${A(1)}])`;
      case 'tochar': return `string(1, (char) ${At(0)})`;
      case 'tocode': return `(int) ${At(0)}[0]`;
      case 'tofixed': used.add('fixed'); return `toDecimals(${A(0)}, ${A(1)})`;
      case 'tointeger': if (GEN.exc.conv) { used.add('conv'); return `toInt(${A(0)})`; } return `stoi(${A(0)})`;
      case 'toreal': if (GEN.exc.conv) { used.add('conv'); return `toReal(${A(0)})`; } return `stod(${A(0)})`;
      case 'tostring': { const t = _CE.inferType(n.args[0], sc); if (t === 'String') return A(0); if (t === 'Real') { used.add('fmt'); return `formatNum(${A(0)})`; } if (t === 'Boolean') return `string(${A(0)} ? "true" : "false")`; return `to_string(${A(0)})`; }
      case 'eof': return 'fileIn.peek() == EOF';
    }
    return null;
  },
  declare: (n, t, arr, D) => {
    if (!arr) return T_CPP[t] ? `${T_CPP[t]} ${n};` : isTP(t) ? `${t} ${n}{};` : `${tCpp(t)} ${n} = nullptr;`;
    const c = cppParts(t, arr, D);
    return `${c.ty} ${n}(${c.args});`;
  },
  constDecl: (n, t, e) => `const ${tCpp(t)} ${n} = ${e};`,
  declareInit: (n, t, e) => `${tCpp(t)} ${n} = ${e};`,
  nul: 'nullptr', self: 'this', arrow: '->', staticSep: (c, m) => `${c}::${m}`,
  superMethod: (m, a, par) => `${par ? par.name : 'Base'}::${m}(${a})`,
  input: (o, v, t) => { if (t === 'String') o.line(`getline(cin >> ws, ${v});`); else o.line(`cin >> ${v};`); },
  output: (e, nl) => `cout << ${e}${nl ? ' << endl' : ''}`,
  files(o, s, E, sc, lvInfo, used) {
    used.add('fstream');
    if (s.kind === 'open') o.line(s.mode === 'read' ? `fileIn.open(${E(s.expression, sc)});` : `fileOut.open(${E(s.expression, sc)});`);
    if (s.kind === 'close') o.line(s.mode === 'read' ? 'fileIn.close();' : 'fileOut.close();');
    if (s.kind === 'read') { const t = lvInfo(s.variable, sc).type; if (t === 'String') o.line(`getline(fileIn, ${E(s.variable, sc)});`); else { o.line(`fileIn >> ${E(s.variable, sc)};`); o.line('fileIn >> ws;'); } }
    if (s.kind === 'write') { const x = strip(tryParse(s.expression)); const low = x && x.k === 'bin' && (REL.includes(x.op) || x.op === 'and' || x.op === 'or'); o.line(`fileOut << ${low ? `(${E(s.expression, sc)})` : E(s.expression, sc)} << endl;`); }
  },
  multiAssign(o, tg, call, f, sc, used) { used.add('tuple'); o.line(`tie(${tg.join(', ')}) = ${call};`); },
  program(prog, g) {
    const o = new g.Out();
    const retT = (f) => { const rl = _CM.rets(f); if (rl.length > 1) { g.used.add('tuple'); return `tuple<${rl.map(cppRetT).join(', ')}>`; } return rl.length ? cppRetT(rl[0]) : 'void'; };
    const sig = (f) => `${tplF(f)}${retT(f)} ${f.name}(${f.params.map((p) => (p.array ? `${'vector<'.repeat(p.dims || 1)}${tCpp(p.type)}${'>'.repeat(p.dims || 1)}& ${p.name}` : `${tCpp(p.type)} ${p.name}`)).join(', ')})`;
    const fns = prog.functions.slice(1);
    const bodyOut = new g.Out();
    for (const f of fns) {
      const sc = g.buildScope(f);
      bodyOut.line(''); bodyOut.line(sig(f) + ' {'); bodyOut.in(); g.block(bodyOut, f.body, sc);
      const rl = _CM.rets(f);
      if (rl.length) { bodyOut.line(rl.length > 1 ? `return make_tuple(${rl.map((r) => r.name).join(', ')});` : `return ${rl[0].name};`); }
      bodyOut.out(); bodyOut.line('}');
    }
    const mainOut = new g.Out();
    mainOut.in(); g.block(mainOut, prog.functions[0].body, g.buildScope(prog.functions[0])); mainOut.out();
    const u = g.used;
    o.line('#include <iostream>'); o.line('#include <string>'); o.line('#include <vector>'); o.line('#include <cmath>');
    cppExcIncludes(o, u);
    if (u.has('rand')) { o.line('#include <cstdlib>'); o.line('#include <ctime>'); }
    if (u.has('fmt') || u.has('fixed')) { o.line('#include <sstream>'); o.line('#include <iomanip>'); }
    if (u.has('fstream')) o.line('#include <fstream>');
    if (u.has('tuple')) o.line('#include <tuple>');
    o.line(''); o.line('using namespace std;'); o.line('');
    if (u.has('pi')) o.line('const double PI = 3.14159265358979323846;');
    if (u.has('fstream')) { o.line('ifstream fileIn;'); o.line('ofstream fileOut;'); }
    if (u.has('fmt')) { o.line(''); o.line('string formatNum(double x) {'); o.line('    ostringstream s;'); o.line('    s << setprecision(15) << x;'); o.line('    return s.str();'); o.line('}'); }
    if (u.has('fixed')) { o.line(''); o.line('string toDecimals(double x, int cifre) {'); o.line('    ostringstream s;'); o.line('    s << fixed << setprecision(cifre) << x;'); o.line('    return s.str();'); o.line('}'); }
    cppExcHelpers(o, u);
    if (fns.length) { o.line(''); o.line('// ' + C('prototypes')); for (const f of fns) o.line(sig(f) + ';'); }
    o.line(''); o.line('int main() {');
    if (u.has('rand')) o.line('    srand(time(0));');
    o.line('    cout << boolalpha;');
    o.lines.push(...mainOut.lines);
    o.line('    return 0;'); o.line('}');
    o.lines.push(...bodyOut.lines);
    return o.text();
  },
  programOO(prog, g) {
    const main = _CM.mainClass(prog);
    const retT = (f) => { const rl = _CM.rets(f); if (rl.length > 1) { g.used.add('tuple'); return `tuple<${rl.map(cppRetT).join(', ')}>`; } return rl.length ? cppRetT(rl[0]) : 'void'; };
    const params = (f) => f.params.map((p) => (p.array ? `${'vector<'.repeat(p.dims || 1)}${tCpp(p.type)}${'>'.repeat(p.dims || 1)}& ${p.name}` : `${tCpp(p.type)} ${p.name}`)).join(', ');
    const decls = new g.Out(), statics = [], defs = new g.Out();
    const ordered = OO.ordered(prog, false);
    for (const c of ordered) {
      const poly = !!c.parent || OO.hasChildren(prog, c);
      const sec = { public: [], protected: [], private: [] };
      const vis = (v) => sec[v || 'public'];
      for (const f of OO.ctors(prog, c)) vis(f.visibility).push(`${c.name}(${params(f)});`);
      for (const a of c.attributes) {
        const sc = OO.classScope(prog, c, a.static);
        const pt = cppParts(a.type, a.array, a.array ? _CE.splitTop(a.size).map((x) => g.E(x, sc)) : null);
        const init = a.array ? `${pt.ty}(${pt.args})` : (String(a.init || '').trim() ? g.E(a.init, sc) : (DEF_CPP[a.type] || (isTP(a.type) ? a.type + '()' : 'nullptr')));
        if (a.static) { vis(a.visibility).push(`static ${pt.ty} ${a.name};`); statics.push(`${tplOf(c) ? tplOf(c) + ' ' : ''}${pt.ty} ${qualOf(c)}::${a.name} = ${init};`); }
        else vis(a.visibility).push(`${pt.ty} ${a.name} = ${init};`);
      }
      for (const f of OO.methods(prog, c)) {
        const nm = OO.isMain(prog, f) ? 'Main' : f.name;
        // abstract method: pure virtual, without definition
        vis(f.visibility).push(`${tplF(f)}${f.static ? 'static ' : (poly || f.abstract ? 'virtual ' : '')}${retT(f)} ${nm}(${params(f)})${f.abstract ? ' = 0' : ''};`);
      }
      decls.line('');
      if (tplOf(c)) decls.line(tplOf(c));
      // program exception without constructors: C++ still wants the message for runtime_error
      const excRoot = c.parent && _CM.excClass(c.parent);
      if (excRoot && !OO.ctors(prog, c).length) sec.public.unshift(`${c.name}() : ${parentL('cpp', c)}("") {}`);
      decls.line(`class ${c.name}${c.parent ? ' : public ' + parentL('cpp', c) : ''} {${c.abstract ? ' // ' + C('abstractClass') : ''}`);
      for (const v of ['public', 'protected', 'private']) if (sec[v].length) { decls.line(v + ':'); decls.in(); sec[v].forEach((l) => decls.line(l)); decls.out(); }
      decls.line('};');
      // definitions of constructors and methods
      for (const f of [...OO.ctors(prog, c), ...OO.methods(prog, c)]) {
        if (f.abstract) continue;
        const sc = g.buildScope(f);
        defs.line('');
        if (tplOf(c)) defs.line(tplOf(c));
        if (f.ctor) {
          const sp = OO.splitSuper(f);
          defs.line(`${qualOf(c)}::${c.name}(${params(f)})${sp.args ? ` : ${parentL('cpp', c)}(${sp.args.map((x) => g.pr(x, sc).s).join(', ')})` : (c.parent && _CM.excClass(c.parent) ? ` : ${parentL('cpp', c)}("")` : '')} {`);
          defs.in(); g.block(defs, sp.rest, sc); defs.out(); defs.line('}');
          continue;
        }
        defs.line(`${tplF(f)}${retT(f)} ${qualOf(c)}::${OO.isMain(prog, f) ? 'Main' : f.name}(${params(f)}) {`);
        defs.in(); g.block(defs, f.body, sc);
        const rl = _CM.rets(f);
        if (rl.length) { defs.line(rl.length > 1 ? `return make_tuple(${rl.map((r) => r.name).join(', ')});` : `return ${rl[0].name};`); }
        defs.out(); defs.line('}');
      }
    }
    const o = new g.Out(); const u = g.used;
    o.line('#include <iostream>'); o.line('#include <string>'); o.line('#include <vector>'); o.line('#include <cmath>');
    cppHeaderExtras(o); cppExcIncludes(o, u);
    if (u.has('rand')) { o.line('#include <cstdlib>'); o.line('#include <ctime>'); }
    if (u.has('fmt') || u.has('fixed')) { o.line('#include <sstream>'); o.line('#include <iomanip>'); }
    if (u.has('fstream')) o.line('#include <fstream>');
    if (u.has('tuple')) o.line('#include <tuple>');
    o.line(''); o.line('using namespace std;'); o.line('');
    if (u.has('pi')) o.line('const double PI = 3.14159265358979323846;');
    if (u.has('fstream')) { o.line('ifstream fileIn;'); o.line('ofstream fileOut;'); }
    if (u.has('fmt')) { o.line(''); o.line('string formatNum(double x) {'); o.line('    ostringstream s;'); o.line('    s << setprecision(15) << x;'); o.line('    return s.str();'); o.line('}'); }
    if (u.has('fixed')) { o.line(''); o.line('string toDecimals(double x, int cifre) {'); o.line('    ostringstream s;'); o.line('    s << fixed << setprecision(cifre) << x;'); o.line('    return s.str();'); o.line('}'); }
    cppHelpers(o); cppExcHelpers(o, u);
    o.line(''); o.line('// ' + C('cppClasses'));
    o.line(ordered.map((c) => `${tplOf(c) ? tplOf(c) + ' ' : ''}class ${c.name};`).join(' '));
    o.lines.push(...decls.lines);
    if (statics.length) { o.line(''); o.line('// ' + C('staticAttributes')); statics.forEach((l) => o.line(l)); }
    o.line(''); o.line('int main() {');
    if (u.has('rand')) o.line('    srand(time(0));');
    o.line('    cout << boolalpha;');
    o.line(`    ${main.name}::Main();`);
    o.line('    return 0;'); o.line('}');
    o.lines.push(...defs.lines);
    return o.text();
  },
});

const T_JAVA = { Integer: 'int', Real: 'double', String: 'String', Boolean: 'boolean', None: 'void' };
const BOX_J = { Integer: 'Integer', Real: 'Double', String: 'String', Boolean: 'Boolean' };
/* Java types: ArrayList<Integer> with the base types "boxed"; the native modules use the java.util classes */
const tJava = (t) => {
  const g = _CE.splitType(t);
  if (!g.args.length) return T_JAVA[t] || (_CM.excClass(t) ? excL('java', t) : t);
  const a = g.args.map((x) => BOX_J[x] || tJava(x)), n = nativeOf(g.base);
  return n && n.java ? n.java.type(a) : `${g.base}<${a.join(', ')}>`;
};
/* arrays of T in Java: new T[n] cannot be written */
/* (if T must be comparable the array is of Comparable) */
const newArrJava = (t, D, box) => {
  if (!isTP(t)) return `new ${box ? BOX_J[t] : tJava(t)}${D.map((d) => `[${d}]`).join('')}`;
  // in a generic function the real type of the elements is taken from a parameter (so the array can be returned)
  const f = GEN.cur && GEN.cur.f, low = String(t).toLowerCase();
  if (f && (f.tparams || []).some((x) => x.toLowerCase() === low)) {
    const pa = f.params.find((p) => p.array && (p.dims || 1) === 1 && p.type.toLowerCase() === low), ps = f.params.find((p) => !p.array && p.type.toLowerCase() === low);
    const cls = pa ? `${pa.name}.getClass().getComponentType()` : ps ? `${ps.name}.getClass()` : null;
    if (cls) return `(${t}${'[]'.repeat(D.length)}) java.lang.reflect.Array.newInstance(${cls}, ${D.join(', ')})`;
  }
  return `(${t}${'[]'.repeat(D.length)}) new ${boundHere(t) ? 'Comparable' : 'Object'}${D.map((d) => `[${d}]`).join('')}`;
};
/* array passed to a generic function: Integer[] instead of int[] */
const arrJ = (t, key) => (GEN.boxed.has(key) ? BOX_J[t] : tJava(t));
/* <T> or <T extends Comparable<T>> */
const jTP = (list, key) => `<${list.map((t) => (GEN.bound.has(key(t)) ? `${t} extends Comparable<${t}>` : t)).join(', ')}>`;
const jFunTP = (f) => ((f.tparams || []).length ? jTP(f.tparams, (t) => FKEY(f, t)) + ' ' : '');
const jClassTitle = (c) => ((c.tparams || []).length ? c.name + jTP(c.tparams, (t) => CKEY(c, t)) : c.name);
/* new T[n] cannot be written: (T[]) new Object[n] wants @SuppressWarnings */
const jUnchecked = (f) => { let u = false; if ((f.tparams || []).length) _CM.walk(f.body, (s) => { if (s.kind === 'declare' && s.array && tpKey(s.type, f, null)) u = true; }); return u; };
/* returned value: int[], Integer[] if it goes to a generic function, T[] */
const jRet = (f, r, i) => (r.array ? arrJ(r.type, 'ret:' + f.id + ':' + i) + '[]'.repeat(r.dims || 1) : tJava(r.type));
const jRetT = (f) => { const rl = _CM.rets(f); return rl.length ? jRet(f, rl[0], 0) : 'void'; };
const jParams = (f) => f.params.map((p) => `${p.array ? arrJ(p.type, f.id + ':' + p.name.toLowerCase()) : tJava(p.type)}${p.array ? '[]'.repeat(p.dims || 1) : ''} ${p.name}`).join(', ');
let J_PFX = ''; // from the other classes the Scanner and the files are in the main class
const DEF_C = { Integer: '0', Real: '0.0', String: '""', Boolean: 'false' };
LANGS.java = cFamily({
  lang: 'java', targ: (t) => BOX_J[t] || tJava(t), diamond: '<>',
  excMsg: (o) => `${o}.getMessage()`,
  // in Java division between reals by zero throws no exception: divide() checks it
  divFn: (a, b, used) => { used.add('divide'); return `${J_PFX}divide(${a}, ${b})`; },
  label: 'Java', ext: 'java', intDiv: true, powFn: 'Math.pow', intCast: '(int) ', concatPrefix: '""',
  keywords: ['public', 'static', 'void', 'class', 'int', 'double', 'String', 'boolean', 'return', 'if', 'else', 'while', 'for', 'do', 'true', 'false', 'new', 'import', 'Scanner', 'System', 'Math', 'private', 'protected', 'extends', 'this', 'super', 'null', 'final', 'record', 'throws', 'abstract'],
  pi: 'Math.PI',
  strLit: (s) => escStr(s, '"'),
  toStr: (x, t, e) => (e.p <= P.add ? `(${e.s})` : e.s),
  // values of type T (objects): methods of the object, as for Strings: a.equals(b), a.compareTo(b) < 0
  // (the comparison with null stays == / !=)
  cmpT(op, l, r) {
    if (l.s === 'null' || r.s === 'null') return null;
    const ls = l.p < P.atom ? `(${l.s})` : l.s;
    if (op === '==') return { s: `${ls}.equals(${r.s})`, p: P.atom };
    if (op === '!=') return { s: `!${ls}.equals(${r.s})`, p: P.un };
    return { s: `${ls}.compareTo(${r.s}) ${op} 0`, p: P.rel };
  },
  strCmp(op, l, r) {
    const ls = l.p < P.atom ? `(${l.s})` : l.s;
    if (op === '==') return { s: `${ls}.equals(${r.s})`, p: P.atom };
    if (op === '!=') return { s: `!${ls}.equals(${r.s})`, p: P.un };
    return { s: `${ls}.compareTo(${r.s}) ${op} 0`, p: P.rel };
  },
  builtin(low, a, n, sc) {
    const A = (i) => (a[i] ? a[i].s : ''); const At = (i) => (a[i] ? (a[i].p < P.atom ? `(${a[i].s})` : a[i].s) : '');
    const map = { abs: 'abs', arccos: 'acos', arcsin: 'asin', arctan: 'atan', cos: 'cos', sin: 'sin', tan: 'tan', cosh: 'cosh', sinh: 'sinh', tanh: 'tanh', ln: 'log', log: 'log', log10: 'log10', sqrt: 'sqrt' };
    if (map[low]) return `Math.${map[low]}(${A(0)})`;
    switch (low) {
      case 'arcsinh': return `Math.log(${At(0)} + Math.sqrt(${At(0)} * ${At(0)} + 1))`;
      case 'arccosh': return `Math.log(${At(0)} + Math.sqrt(${At(0)} * ${At(0)} - 1))`;
      case 'arctanh': return `0.5 * Math.log((1 + ${At(0)}) / (1 - ${At(0)}))`;
      case 'int': return { s: `(int) ${At(0)}`, p: P.un };
      case 'sgn': return { s: `(int) Math.signum(${A(0)})`, p: P.un };
      case 'random': return { s: `(int) (Math.random() * ${At(0)})`, p: P.un };
      case 'len': return `${At(0)}.length()`;
      case 'size': return `${At(0)}${'[0]'.repeat(sizeInfo(n, sc).d)}.length`;
      case 'char': return `String.valueOf(${At(0)}.charAt(${A(1)}))`;
      case 'tochar': return `String.valueOf((char) ${At(0)})`;
      case 'tocode': return { s: `(int) ${At(0)}.charAt(0)`, p: P.un };
      case 'tofixed': return `String.format(java.util.Locale.US, "%." + ${At(1)} + "f", ${A(0)})`;
      case 'tointeger': return `Integer.parseInt(${A(0)})`;
      case 'toreal': return `Double.parseDouble(${A(0)})`;
      case 'tostring': return `String.valueOf(${A(0)})`;
      case 'eof': return `!${J_PFX}fileIn.hasNextLine()`;
    }
    return null;
  },
  declare: (n, t, arr, D, used, sc) => {
    if (!arr) return `${tJava(t)} ${n} = ${DEF_C[t] || 'null'};`;
    const box = !!(sc && sc.func && GEN.boxed.has(sc.func.id + ':' + n.toLowerCase()));
    return `${box ? BOX_J[t] : tJava(t)}${'[]'.repeat(D.length)} ${n} = ${newArrJava(t, D, box)};`;
  },
  constDecl: (n, t, e) => `final ${tJava(t)} ${n} = ${e};`,
  declareInit: (n, t, e) => `${tJava(t)} ${n} = ${e};`,
  input: (o, v, t) => { const i = J_PFX + 'input'; o.line(`${v} = ${t === 'Integer' ? `Integer.parseInt(${i}.nextLine())` : t === 'Real' ? `Double.parseDouble(${i}.nextLine())` : t === 'Boolean' ? `Boolean.parseBoolean(${i}.nextLine())` : `${i}.nextLine()`};`); },
  nul: 'null', self: 'this',
  output: (e, nl) => `System.out.${nl ? 'println' : 'print'}(${e})`,
  files(o, s, E, sc, lvInfo, used) {
    used.add('files');
    const R = J_PFX + 'fileIn', W = J_PFX + 'fileOut';
    if (s.kind === 'open') o.line(s.mode === 'read' ? `${R} = new Scanner(new java.io.File(${E(s.expression, sc)}));` : `${W} = new java.io.PrintWriter(${E(s.expression, sc)});`);
    if (s.kind === 'close') o.line(s.mode === 'read' ? `${R}.close();` : `${W}.close();`);
    if (s.kind === 'read') { const t = lvInfo(s.variable, sc).type; o.line(`${E(s.variable, sc)} = ${t === 'Integer' ? `Integer.parseInt(${R}.nextLine())` : t === 'Real' ? `Double.parseDouble(${R}.nextLine())` : t === 'Boolean' ? `Boolean.parseBoolean(${R}.nextLine())` : `${R}.nextLine()`};`); }
    if (s.kind === 'write') o.line(`${W}.println(${E(s.expression, sc)});`);
  },
  multiAssign(o, tg, call, f, sc) {
    const rl = f ? _CM.rets(f) : [];
    const owner = f && sc.ooMode ? _CM.classOf(sc.prog, f) : null;
    const rec = (owner && owner !== sc.cls ? owner.name + '.' : '') + 'Risultato' + (f ? f.name[0].toUpperCase() + f.name.slice(1) : '');
    let k = 1; while (sc.vars.has('ris' + k) || (sc.tmpUsed && sc.tmpUsed.has('ris' + k))) k++;
    const tmp = 'ris' + k; (sc.tmpUsed = sc.tmpUsed || new Set()).add(tmp);
    o.line(`${rec} ${tmp} = ${call};`);
    tg.forEach((t, i) => o.line(`${t} = ${tmp}.${rl[i] ? rl[i].name : 'v' + i}();`));
  },
  program(prog, g) {
    const o = new g.Out();
    const inner = new g.Out(); inner.lvl = 1;
    const main = new g.Out(); main.lvl = 2;
    const recName = (f) => 'Risultato' + f.name[0].toUpperCase() + f.name.slice(1);
    const records = prog.functions.slice(1).filter((f) => _CM.rets(f).length > 1);
    GEN.cur = { f: prog.functions[0], c: null };
    g.block(main, prog.functions[0].body, g.buildScope(prog.functions[0]));
    for (const f of prog.functions.slice(1)) {
      GEN.cur = { f, c: null };
      const sc = g.buildScope(f);
      const rl = _CM.rets(f);
      inner.line('');
      if (jUnchecked(f)) inner.line('@SuppressWarnings("unchecked")');
      inner.line(`public static ${jFunTP(f)}${rl.length > 1 ? recName(f) : jRetT(f)} ${f.name}(${jParams(f)})${jThrows(f, g.used.has('files'))} {`);
      inner.in(); g.block(inner, f.body, sc);
      if (rl.length) { inner.line(rl.length > 1 ? `return new ${recName(f)}(${rl.map((r) => r.name).join(', ')});` : `return ${rl[0].name};`); }
      inner.out(); inner.line('}');
    }
    if (records.length) o.line('// ' + C('java16Functions'));
    o.line('import java.util.*;'); o.line('');
    o.line('public class Main {');
    o.line('    private static Scanner input = new Scanner(System.in);');
    for (const f of records) o.line(`    record ${recName(f)}(${_CM.rets(f).map((r, i) => `${jRet(f, r, i)} ${r.name}`).join(', ')}) {}`);
    if (g.used.has('files')) { o.line('    private static Scanner fileIn;'); o.line('    private static java.io.PrintWriter fileOut;'); }
    o.line('');
    o.line(`    public static void main(String[] args)${jThrows(prog.functions[0], g.used.has('files'))} {`);
    o.lines.push(...main.lines);
    o.line('    }');
    if (g.used.has('divide')) { o.line(''); o.line('    // ' + C('divisionComment')); o.line(`    static double divide(double a, double b) { if (b == 0) throw new ArithmeticException("${C('divisionByZero')}"); return a / b; }`); }
    o.lines.push(...inner.lines);
    o.line('}');
    return o.text();
  },
  programOO(prog, g) {
    const main = _CM.mainClass(prog);
    const files = usesFiles(prog);
    const thrOf = (f) => jThrows(f, files);
    const params = jParams;
    const recName = (f) => 'Risultato' + cap(f.name);
    const V = (v) => (v || 'public') + ' ';
    const parts = [];
    let records = false;
    for (const c of OO.ordered(prog, true)) {
      J_PFX = c === main ? '' : main.name + '.';
      const o = new g.Out(); o.lvl = 1;
      if (c === main) {
        o.line('static Scanner input = new Scanner(System.in);');
        if (files) { o.line('static Scanner fileIn;'); o.line('static java.io.PrintWriter fileOut;'); }
      }
      for (const f of OO.methods(prog, c)) if (_CM.rets(f).length > 1) { records = true; o.line(`record ${recName(f)}(${_CM.rets(f).map((r, i) => `${jRet(f, r, i)} ${r.name}`).join(', ')}) {}`); }
      for (const a of c.attributes) {
        GEN.cur = { f: null, c };
        const sc = OO.classScope(prog, c, a.static);
        const D = a.array ? _CE.splitTop(a.size).map((x) => g.E(x, sc)) : null;
        const box = a.array && GEN.boxed.has('attr:' + c.id + ':' + a.name.toLowerCase());
        const init = a.array ? ` = ${newArrJava(a.type, D, box)}` : (String(a.init || '').trim() ? ' = ' + g.E(a.init, sc) : (a.type === 'String' ? ' = ""' : ''));
        o.line(`${V(a.visibility)}${a.static ? 'static ' : ''}${box ? BOX_J[a.type] : tJava(a.type)}${a.array ? '[]'.repeat(D.length) : ''} ${a.name}${init};`);
      }
      for (const f of [...OO.ctors(prog, c), ...OO.methods(prog, c)]) {
        GEN.cur = { f, c };
        const sc = g.buildScope(f);
        const rl = _CM.rets(f);
        if (o.lines.length) o.line('');
        if (f.abstract) { o.line(`${V(f.visibility)}abstract ${jFunTP(f)}${rl.length > 1 ? recName(f) : jRetT(f)} ${f.name}(${params(f)})${thrOf(f)};`); continue; }
        const thr = thrOf(f);
        if (jUnchecked(f)) o.line('@SuppressWarnings("unchecked")');
        if (f.ctor) o.line(`${V(f.visibility)}${c.name}(${params(f)})${thr} {`);
        else if (OO.isMain(prog, f)) o.line(`public static void main(String[] args)${thr} {`);
        else o.line(`${V(f.visibility)}${f.static ? 'static ' : ''}${jFunTP(f)}${rl.length > 1 ? recName(f) : jRetT(f)} ${f.name}(${params(f)})${thr} {`);
        o.in(); g.block(o, f.body, sc);
        if (rl.length) { o.line(rl.length > 1 ? `return new ${recName(f)}(${rl.map((r) => r.name).join(', ')});` : `return ${rl[0].name};`); }
        o.out(); o.line('}');
      }
      parts.push({ c, lines: o.lines });
    }
    J_PFX = ''; GEN.cur = null;
    const o = new g.Out();
    if (records) o.line('// ' + C('java16Methods'));
    o.line('import java.util.*;');
    for (const { c, lines } of parts) {
      o.line('');
      if ((c.tparams || []).length) o.line('@SuppressWarnings("unchecked")');
      o.line(`${c === main ? 'public ' : ''}${c.abstract ? 'abstract ' : ''}class ${jClassTitle(c)}${c.parent ? ' extends ' + parentL('java', c) : ''} {`);
      o.lines.push(...lines);
      if (c === main && g.used.has('divide')) { o.line(''); o.line('    // ' + C('divisionComment')); o.line(`    static double divide(double a, double b) { if (b == 0) throw new ArithmeticException("${C('divisionByZero')}"); return a / b; }`); }
      o.line('}');
    }
    return o.text();
  },
});

const tCs = (t) => {
  const g = _CE.splitType(t);
  if (!g.args.length) return T_CPP[t] || (_CM.excClass(t) ? excL('csharp', t) : t);
  const a = g.args.map(tCs), n = nativeOf(g.base);
  return n && n.csharp ? n.csharp.type(a) : `${g.base}<${a.join(', ')}>`;
};
let CS_PFX = '';
const csRetT = (r) => tCs(r.type) + (r.array ? `[${','.repeat((r.dims || 1) - 1)}]` : '');
/* generic functions: Name<T>(...) where T : IComparable<T> */
const csTP = (f) => ((f.tparams || []).length ? `<${f.tparams.join(', ')}>` : '');
const csWhere = (list, key) => list.filter((t) => GEN.bound.has(key(t))).map((t) => ` where ${t} : IComparable<${t}>`).join('');
const csWhereF = (f) => csWhere(f.tparams || [], (t) => FKEY(f, t));
const csWhereC = (c) => csWhere(c.tparams || [], (t) => CKEY(c, t));
LANGS.csharp = cFamily({
  lang: 'csharp', targ: (t) => tCs(t),
  excMsg: (o) => `${o}.Message`,
  divFn: (a, b, used) => { used.add('divide'); return `${CS_PFX}Divide(${a}, ${b})`; },
  label: 'C#', ext: 'cs', intDiv: true, powFn: 'Math.Pow', intCast: '(int) ',
  keywords: ['using', 'class', 'static', 'void', 'int', 'double', 'string', 'bool', 'return', 'if', 'else', 'while', 'for', 'do', 'true', 'false', 'new', 'Console', 'Math', 'System', 'public', 'private', 'protected', 'this', 'base', 'null', 'virtual', 'override', 'const', 'abstract'],
  pi: 'Math.PI',
  strLit: (s) => escStr(s, '"'),
  concatPrefix: '""',
  toStr: (x, t, e) => (e.p <= P.add ? `(${e.s})` : e.s),
  // values of type T: methods of the object, a.Equals(b), a.CompareTo(b) < 0 (the comparison with null stays == / !=)
  cmpT(op, l, r) {
    if (l.s === 'null' || r.s === 'null') return null;
    const ls = l.p < P.atom ? `(${l.s})` : l.s;
    if (op === '==') return { s: `${ls}.Equals(${r.s})`, p: P.atom };
    if (op === '!=') return { s: `!${ls}.Equals(${r.s})`, p: P.un };
    return { s: `${ls}.CompareTo(${r.s}) ${op} 0`, p: P.rel };
  },
  strCmp(op, l, r) {
    if (op === '==' || op === '!=') return null;
    return { s: `string.Compare(${l.s}, ${r.s}, StringComparison.Ordinal) ${op} 0`, p: P.rel };
  },
  builtin(low, a, n, sc, used) {
    const A = (i) => (a[i] ? a[i].s : ''); const At = (i) => (a[i] ? (a[i].p < P.atom ? `(${a[i].s})` : a[i].s) : '');
    const map = { abs: 'Abs', arccos: 'Acos', arcsin: 'Asin', arctan: 'Atan', cos: 'Cos', sin: 'Sin', tan: 'Tan', cosh: 'Cosh', sinh: 'Sinh', tanh: 'Tanh', arccosh: 'Acosh', arcsinh: 'Asinh', arctanh: 'Atanh', ln: 'Log', log: 'Log', log10: 'Log10', sqrt: 'Sqrt', sgn: 'Sign' };
    if (map[low]) return `Math.${map[low]}(${A(0)})`;
    switch (low) {
      case 'int': return { s: `(int) ${At(0)}`, p: P.un };
      case 'random': used.add('rnd'); return `${CS_PFX}rnd.Next(${A(0)})`;
      case 'len': return `${At(0)}.Length`;
      case 'size': { const z = sizeInfo(n, sc); return z.nd > 1 ? `${At(0)}.GetLength(${z.d})` : `${At(0)}.Length`; }
      case 'char': return `${At(0)}[${A(1)}].ToString()`;
      case 'tochar': return `((char) ${At(0)}).ToString()`;
      case 'tocode': return { s: `(int) ${At(0)}[0]`, p: P.un };
      case 'tofixed': return `${At(0)}.ToString("F" + ${At(1)}, System.Globalization.CultureInfo.InvariantCulture)`;
      case 'tointeger': return `int.Parse(${A(0)})`;
      case 'toreal': return `double.Parse(${A(0)}, System.Globalization.CultureInfo.InvariantCulture)`;
      case 'tostring': return `Convert.ToString(${A(0)})`;
      case 'eof': return `${CS_PFX}fileIn.EndOfStream`;
    }
    return null;
  },
  idx: idxComma,
  declare: (n, t, arr, D) => (arr ? `${tCs(t)}[${','.repeat(D.length - 1)}] ${n} = new ${tCs(t)}[${D.join(', ')}];` : `${tCs(t)} ${n} = ${DEF_C[t] || (isTP(t) ? `default(${t})` : 'null')};`),
  // in C# const wants a value known at compile time; otherwise a normal variable
  constDecl: (n, t, e, lit) => (lit ? `const ${tCs(t)} ${n} = ${e};` : `${tCs(t)} ${n} = ${e}; // costante`),
  declareInit: (n, t, e) => `${tCs(t)} ${n} = ${e};`,
  nul: 'null', self: 'this', superMethod: (m, a) => `base.${m}(${a})`,
  input: (o, v, t) => o.line(`${v} = ${t === 'Integer' ? 'int.Parse(Console.ReadLine())' : t === 'Real' ? 'double.Parse(Console.ReadLine())' : t === 'Boolean' ? 'bool.Parse(Console.ReadLine())' : 'Console.ReadLine()'};`),
  output: (e, nl) => `Console.${nl ? 'WriteLine' : 'Write'}(${e})`,
  multiAssign(o, tg, call) { o.line(`(${tg.join(', ')}) = ${call};`); },
  files(o, s, E, sc, lvInfo, used) {
    used.add('files');
    const R = CS_PFX + 'fileIn', W = CS_PFX + 'fileOut';
    if (s.kind === 'open') o.line(s.mode === 'read' ? `${R} = new System.IO.StreamReader(${E(s.expression, sc)});` : `${W} = new System.IO.StreamWriter(${E(s.expression, sc)});`);
    if (s.kind === 'close') o.line(s.mode === 'read' ? `${R}.Close();` : `${W}.Close();`);
    if (s.kind === 'read') { const t = lvInfo(s.variable, sc).type; o.line(`${E(s.variable, sc)} = ${t === 'Integer' ? `int.Parse(${R}.ReadLine())` : t === 'Real' ? `double.Parse(${R}.ReadLine())` : t === 'Boolean' ? `bool.Parse(${R}.ReadLine())` : `${R}.ReadLine()`};`); }
    if (s.kind === 'write') o.line(`${W}.WriteLine(${E(s.expression, sc)});`);
  },
  program(prog, g) {
    const o = new g.Out();
    const inner = new g.Out(); inner.lvl = 1;
    const main = new g.Out(); main.lvl = 2;
    g.block(main, prog.functions[0].body, g.buildScope(prog.functions[0]));
    for (const f of prog.functions.slice(1)) {
      const sc = g.buildScope(f);
      inner.line('');
      const rl = _CM.rets(f);
      const rt = rl.length > 1 ? `(${rl.map(csRetT).join(', ')})` : rl.length ? csRetT(rl[0]) : 'void';
      inner.line(`static ${rt} ${f.name}${csTP(f)}(${f.params.map((p) => `${tCs(p.type)}${p.array ? `[${','.repeat((p.dims || 1) - 1)}]` : ''} ${p.name}`).join(', ')})${csWhereF(f)} {`);
      inner.in(); g.block(inner, f.body, sc);
      if (rl.length) { inner.line(rl.length > 1 ? `return (${rl.map((r) => r.name).join(', ')});` : `return ${rl[0].name};`); }
      inner.out(); inner.line('}');
    }
    o.line('using System;'); o.line('');
    o.line('class Program {');
    if (g.used.has('divide')) o.line(`    static double Divide(double a, double b) { if (b == 0) throw new DivideByZeroException("${C('divisionByZero')}"); return a / b; }`);
    if (g.used.has('rnd')) o.line('    static Random rnd = new Random();');
    if (g.used.has('files')) { o.line('    static System.IO.StreamReader fileIn;'); o.line('    static System.IO.StreamWriter fileOut;'); }
    o.line('    static void Main() {');
    o.lines.push(...main.lines);
    o.line('    }');
    o.lines.push(...inner.lines);
    o.line('}');
    return o.text();
  },
  programOO(prog, g) {
    const main = _CM.mainClass(prog);
    const params = (f) => f.params.map((p) => `${tCs(p.type)}${p.array ? `[${','.repeat((p.dims || 1) - 1)}]` : ''} ${p.name}`).join(', ');
    const V = (v) => (v || 'public') + ' ';
    const parts = [];
    for (const c of OO.ordered(prog, true)) {
      CS_PFX = c === main ? '' : main.name + '.';
      const o = new g.Out(); o.lvl = 1;
      for (const a of c.attributes) {
        const sc = OO.classScope(prog, c, a.static);
        const D = a.array ? _CE.splitTop(a.size).map((x) => g.E(x, sc)) : null;
        const init = a.array ? ` = new ${tCs(a.type)}[${D.join(', ')}]` : (String(a.init || '').trim() ? ' = ' + g.E(a.init, sc) : (a.type === 'String' ? ' = ""' : ''));
        o.line(`${V(a.visibility)}${a.static ? 'static ' : ''}${tCs(a.type)}${a.array ? `[${','.repeat(D.length - 1)}]` : ''} ${a.name}${init};`);
      }
      for (const f of [...OO.ctors(prog, c), ...OO.methods(prog, c)]) {
        const sc = g.buildScope(f);
        const rl = _CM.rets(f);
        if (o.lines.length) o.line('');
        let body = f.body;
        if (f.abstract) { o.line(`${V(f.visibility)}abstract ${rl.length > 1 ? `(${rl.map(csRetT).join(', ')})` : rl.length ? csRetT(rl[0]) : 'void'} ${f.name}${csTP(f)}(${params(f)})${csWhereF(f)};`); continue; }
        if (f.ctor) {
          const sp = OO.splitSuper(f); body = sp.rest;
          o.line(`${V(f.visibility)}${c.name}(${params(f)})${sp.args ? ` : base(${sp.args.map((x) => g.pr(x, sc).s).join(', ')})` : ''} {`);
        } else if (OO.isMain(prog, f)) o.line('public static void Main() {');
        else {
          // polymorphism: virtual in the parent class, override in the subclasses
          const vo = f.static ? 'static ' : OO.overrides(prog, f) ? 'override ' : OO.overridden(prog, f) ? 'virtual ' : '';
          const rt = rl.length > 1 ? `(${rl.map(csRetT).join(', ')})` : rl.length ? csRetT(rl[0]) : 'void';
          o.line(`${V(f.visibility)}${vo}${rt} ${f.name}${csTP(f)}(${params(f)})${csWhereF(f)} {`);
        }
        o.in(); g.block(o, body, sc);
        if (rl.length) { o.line(rl.length > 1 ? `return (${rl.map((r) => r.name).join(', ')});` : `return ${rl[0].name};`); }
        o.out(); o.line('}');
      }
      parts.push({ c, lines: o.lines });
    }
    CS_PFX = '';
    const o = new g.Out();
    o.line('using System;');
    if (GEN.native.size) o.line('using System.Collections.Generic;');
    if (GEN.helpers.has('Helpers')) {
      o.line(''); o.line('static class Helpers {');
      o.line('    // ' + C('removeAtComment'));
      o.line('    public static T RemoveAt<T>(List<T> lista, int i) { T x = lista[i]; lista.RemoveAt(i); return x; }');
      o.line('}');
    }
    for (const { c, lines } of parts) {
      o.line('');
      o.line(`${c.abstract ? 'abstract ' : ''}class ${_CM.classTitle(c)}${c.parent ? ' : ' + parentL('csharp', c) : ''}${csWhereC(c)} {`);
      if (c === main) {
        if (g.used.has('divide')) o.line(`    public static double Divide(double a, double b) { if (b == 0) throw new DivideByZeroException("${C('divisionByZero')}"); return a / b; }`);
        if (g.used.has('rnd')) o.line('    public static Random rnd = new Random();');
        if (g.used.has('files')) { o.line('    public static System.IO.StreamReader fileIn;'); o.line('    public static System.IO.StreamWriter fileOut;'); }
        if ((g.used.has('rnd') || g.used.has('files')) && lines.length) o.line('');
      }
      o.lines.push(...lines);
      o.line('}');
    }
    return o.text();
  },
});

LANGS.javascript = cFamily({
  lang: 'javascript',
  excMsg: (o) => `${o}.message`,
  divFn: (a, b, used) => { used.add('divide'); need('exc:DivisionByZero'); return `divide(${a}, ${b})`; },
  modFn: (a, b, used) => { used.add('remainderOf'); need('exc:DivisionByZero'); return `remainderOf(${a}, ${b})`; },
  idxChk: (nm, ix, used) => { used.add('checkIndex'); need('exc:IndexOutOfRange'); return ix.reduce((c, i) => `${c}[checkIndex(${c}, ${i})]`, nm); },
  // a single catch: the branch is chosen with instanceof; if none fits the exception continues
  tryStmt(o, s, sc, blk) {
    const cats = s.catches || [];
    o.line('try {'); blk(o, s.body, sc);
    if (cats.length) {
      o.line('} catch (exc_) {'); o.in();
      cats.forEach((c, i) => { o.line(`${i ? '} else if' : 'if'} (exc_ instanceof ${excL('javascript', c.type)}) {`); o.in(); o.line(`const ${c.variable} = exc_;`); o.out(); blk(o, c.body, sc); });
      o.line('} else {'); o.in(); o.line('throw exc_;'); o.out(); o.line('}');
      o.out();
    }
    if (s.hasFinally) { o.line('} finally {'); blk(o, s.finally || [], sc); }
    o.line('}');
  },
  label: 'JavaScript', ext: 'js',
  keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'do', 'true', 'false', 'new', 'Math', 'console', 'prompt', 'parseInt', 'parseFloat', 'String', 'Array', 'class', 'extends', 'constructor', 'static', 'this', 'super', 'null', 'throw', 'args', 'typeof', 'instanceof'],
  pi: 'Math.PI', eq: '===', neq: '!==', concatPrefix: '""',
  strLit: (s) => escStr(s, '"'),
  toStr: (x, t, e) => (e.p <= P.add ? `(${e.s})` : e.s),
  builtin(low, a, n, sc, used) {
    const A = (i) => (a[i] ? a[i].s : ''); const At = (i) => (a[i] ? (a[i].p < P.atom ? `(${a[i].s})` : a[i].s) : '');
    const map = { abs: 'abs', arccos: 'acos', arcsin: 'asin', arctan: 'atan', cos: 'cos', sin: 'sin', tan: 'tan', cosh: 'cosh', sinh: 'sinh', tanh: 'tanh', arccosh: 'acosh', arcsinh: 'asinh', arctanh: 'atanh', ln: 'log', log: 'log', log10: 'log10', sqrt: 'sqrt', sgn: 'sign', int: 'trunc' };
    if (map[low]) return `Math.${map[low]}(${A(0)})`;
    switch (low) {
      case 'random': return `Math.floor(Math.random() * ${At(0)})`;
      case 'len': return `${At(0)}.length`;
      case 'size': return `${At(0)}${'[0]'.repeat(sizeInfo(n, sc).d)}.length`;
      case 'char': return `${At(0)}.charAt(${A(1)})`;
      case 'tochar': return `String.fromCharCode(${A(0)})`;
      case 'tocode': return `${At(0)}.charCodeAt(0)`;
      case 'tofixed': return `${At(0)}.toFixed(${A(1)})`;
      case 'tointeger': if (GEN.exc.conv) { used.add('conv'); need('exc:InvalidConversion'); return `toInt(${A(0)})`; } return `parseInt(${A(0)})`;
      case 'toreal': if (GEN.exc.conv) { used.add('conv'); need('exc:InvalidConversion'); return `toReal(${A(0)})`; } return `parseFloat(${A(0)})`;
      case 'tostring': return `String(${A(0)})`;
    }
    return null;
  },
  declare: (n, t, arr, D, used) => { if (!arr) return `let ${n};`; if (D.length === 1) return `let ${n} = new Array(${D[0]});`; used.add('createArray'); return `let ${n} = createArray([${D.join(', ')}]);`; },
  constDecl: (n, t, e) => `const ${n} = ${e};`,
  declareInit: (n, t, e) => `let ${n} = ${e};`,
  nul: 'null', self: 'this', qualifyCalls: true,
  field: (h) => (h.attr.static ? `${h.owner.name}.${h.attr.name}` : `this.${h.attr.name}`),
  input: (o, v, t) => o.line(`${v} = ${t === 'Integer' ? 'parseInt(prompt())' : t === 'Real' ? 'parseFloat(prompt())' : t === 'Boolean' ? 'prompt() === "true"' : 'prompt()'};`),
  output: (e, nl) => `output(${e}, ${nl})`,
  multiAssign(o, tg, call) { o.line(`[${tg.join(', ')}] = ${call};`); },
  program(prog, g) {
    const o = new g.Out();
    o.line('// ' + C('browserIO'));
    o.line('let currentLine = "";');
    o.line('function output(value, newLine) {');
    o.line('    currentLine += String(value);');
    o.line('    if (newLine) { console.log(currentLine); currentLine = ""; }');
    o.line('}');
    const helpAt = o.lines.length;
    for (const f of prog.functions.slice(1)) {
      const sc = g.buildScope(f);
      o.line('');
      o.line(`function ${f.name}(${f.params.map((p) => p.name).join(', ')}) {`);
      o.in(); g.block(o, f.body, sc);
      const rl = _CM.rets(f);
      if (rl.length) { o.line(rl.length > 1 ? `return [${rl.map((r) => r.name).join(', ')}];` : `return ${rl[0].name};`); }
      o.out(); o.line('}');
    }
    o.line(''); o.line('// Main');
    g.block(o, prog.functions[0].body, g.buildScope(prog.functions[0]));
    o.line('if (currentLine) console.log(currentLine);');
    { const hl = jsExcHelpers(g.used); if (hl.length) o.lines.splice(helpAt, 0, '', ...hl); }
    if (g.used.has('createArray')) {
      o.line('');
      o.line('// ' + C('createArrayComment'));
      o.line('function createArray(dims) {');
      o.line('    if (dims.length === 1) return new Array(dims[0]);');
      o.line('    return Array.from({ length: dims[0] }, () => createArray(dims.slice(1)));');
      o.line('}');
    }
    return o.text();
  },
  programOO(prog, g) {
    const main = _CM.mainClass(prog);
    const DEF_JS = { Integer: '0', Real: '0', String: '""', Boolean: 'false' };
    const o = new g.Out();
    o.line('// ' + C('browserIO'));
    o.line('let currentLine = "";');
    o.line('function output(value, newLine) {');
    o.line('    currentLine += String(value);');
    o.line('    if (newLine) { console.log(currentLine); currentLine = ""; }');
    o.line('}');
    const ooHelpAt = o.lines.length;
    const test = {
      len: (n) => `args.length === ${n}`,
      type: (p, i) => { const a = `args[${i}]`; if (p.array) return `Array.isArray(${a})`; if (isTP(p.type)) return 'true'; return { Integer: `Number.isInteger(${a})`, Real: `typeof ${a} === "number"`, String: `typeof ${a} === "string"`, Boolean: `typeof ${a} === "boolean"` }[p.type] || `${a} instanceof ${_CE.splitType(p.type).base}`; },
    };
    let multiDim = false;
    for (const c of OO.ordered(prog, false)) {
      o.line('');
      o.line(`class ${c.name}${c.parent ? ' extends ' + parentL('javascript', c) : ''} {${c.abstract ? ' // ' + C('abstractClassNoObjects') : ''}`); o.in();
      const start = o.lines.length;
      for (const a of c.attributes) {
        const sc = OO.classScope(prog, c, a.static);
        let init;
        if (a.array) { const D = _CE.splitTop(a.size).map((x) => g.E(x, sc)); if (D.length > 1) multiDim = true; init = D.length > 1 ? `createArray([${D.join(', ')}], ${DEF_JS[a.type] || 'null'})` : `new Array(${D[0]}).fill(${DEF_JS[a.type] || 'null'})`; }
        else init = String(a.init || '').trim() ? g.E(a.init, sc) : (DEF_JS[a.type] || 'null');
        o.line(`${a.static ? 'static ' : ''}${a.name} = ${init};${a.visibility !== 'public' ? ' // ' + OO.tag(a.visibility) : ''}`);
      }
      // body of a constructor: in a subclass super(...) must be called before using this
      const ctorBody = (f) => { const sc = g.buildScope(f); const sp = OO.splitSuper(f); if (c.parent && !sp.args) o.line('super();'); g.block(o, f.body, sc); };
      const methodBody = (f) => { if (f.abstract) { o.line(`throw new Error("${C('isAbstract', { name: f.name })}");`); return; } const msc = g.buildScope(f); g.block(o, f.body, msc); const rl = _CM.rets(f); const rn = (r) => retName(r.name, msc, 'this'); if (rl.length) o.line(rl.length > 1 ? `return [${rl.map(rn).join(', ')}];` : `return ${rn(rl[0])};`); };
      const emit = (group, isCtor) => {
        if (o.lines.length > start) o.line('');
        const f0 = group[0];
        const head = isCtor ? 'constructor' : `${f0.static ? 'static ' : ''}${OO.isMain(prog, f0) ? 'main' : f0.name}`;
        const note = ((f0.visibility || 'public') !== 'public' ? ' // ' + OO.tag(f0.visibility) : '') + (group.length === 1 && f0.abstract ? ' // ' + C('abstract') : '');
        if (group.length === 1) { o.line(`${head}(${f0.params.map((p) => p.name).join(', ')}) {${note}`); o.in(); (isCtor ? ctorBody : methodBody)(f0); o.out(); o.line('}'); return; }
        o.line(`${head}(...args) { // ${C('versions', { count: group.length })}${note}`); o.in();
        group.forEach((f, k) => {
          o.line(`${k ? '} else if' : 'if'} (${dispatchCond(f, group, ' && ', test)}) {`); o.in();
          if (f.params.length) o.line(`let [${f.params.map((p) => p.name).join(', ')}] = args;`);
          (isCtor ? ctorBody : methodBody)(f); o.out();
        });
        o.line('} else {'); o.in(); o.line(`throw new Error("${C('noVersion', { name: isCtor ? c.name : f0.name })}");`); o.out(); o.line('}');
        o.out(); o.line('}');
      };
      const ctors = OO.ctors(prog, c);
      if (ctors.length) emit(ctors, true);
      for (const gr of OO.groups(OO.methods(prog, c))) emit(gr, false);
      o.out(); o.line('}');
    }
    { const hl = jsExcHelpers(g.used); if (hl.length) o.lines.splice(ooHelpAt, 0, '', ...hl); }
    o.line(''); o.line('// Main');
    o.line(`${main.name}.main();`);
    o.line('if (currentLine) console.log(currentLine);');
    if (g.used.has('createArray') || multiDim) {
      o.line('');
      o.line('// ' + C('createArrayComment'));
      o.line('function createArray(dims, value) {');
      o.line('    if (dims.length === 1) return new Array(dims[0]).fill(value);');
      o.line('    return Array.from({ length: dims[0] }, () => createArray(dims.slice(1), value));');
      o.line('}');
    }
    return o.text();
  },
});

// The declarations of the "for" loop in C++/Java/C#/JS use variables already declared.
const CodeGen = {
  LANGS,
  /* variables and types visible in a function (used by the editor's autocompletion) */
  scopeFor: (prog, f) => buildScope(prog, f),
  generate(prog, lang) {
    try { setupGen(prog, lang); return LANGS[lang].generate(prog); } catch (e) { return `// Impossibile generare il codice: ${e.message}\n`; }
  },
};
if (typeof module !== 'undefined') module.exports = CodeGen;
