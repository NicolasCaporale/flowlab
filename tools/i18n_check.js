// Checks the language files (languages/<code>.json) against the source code and against English:
// - texts used in the code (L('id'), data-t="id" in body.html) that English does not have
// - texts of English missing in each language (they are shown in English) and texts no longer used
// Usage: node tools/i18n_check.js [--strict]   (--strict: missing texts in any language are an error)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const langs = Object.fromEntries(fs.readdirSync(path.join(root, 'languages')).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), JSON.parse(read('languages/' + f))]));
const en = langs.en;
if (!en) { console.error('languages/en.json is missing'); process.exit(1); }
// ids used in the code
const used = new Set(), usedCode = new Set();
const jsDirs = ['src', 'modules/plugin'];
for (const dir of jsDirs) {
  const fullDir = path.join(root, dir);
  if (!fs.existsSync(fullDir)) continue;
  for (const f of fs.readdirSync(fullDir).filter((x) => x.endsWith('.js') && x !== 'i18n.js')) {
    const s = read(dir + '/' + f);
    for (const m of s.matchAll(/\bL\('([a-z]+\.[A-Za-z0-9]+)'/g)) used.add(m[1]);
    if (f === 'codegen.js') {
      for (const m of s.matchAll(/\bC\('([A-Za-z0-9.]*[A-Za-z0-9])'/g)) usedCode.add(m[1]);
      for (const m of s.matchAll(/\bPS\('([A-Za-z0-9.]*[A-Za-z0-9])'/g)) usedCode.add('pseudo.' + m[1]);
    }
  }
}
for (const m of read('src/body.html').matchAll(/data-t(?:-[a-z-]+)?="([a-z]+\.[A-Za-z0-9]+)"/g)) used.add(m[1]);
let errors = 0;
const report = (title, list, isError) => { if (!list.length) return; if (isError) errors += list.length; console.log(`${isError ? 'ERROR' : 'warning'} ${title} (${list.length}): ${list.slice(0, 20).join(', ')}${list.length > 20 ? ' …' : ''}`); };
report('texts used in the code but not in en.json', [...used].filter((id) => !(id in en.strings)), true);
report('code texts used in codegen.js but not in en.json', [...usedCode].filter((id) => !(id in en.code)), true);
report('texts in en.json no longer used in the code', Object.keys(en.strings).filter((id) => !used.has(id)), false);
const strict = process.argv.includes('--strict');
for (const [code, p] of Object.entries(langs)) {
  if (!p.name) report(`${code}.json: "name" is missing`, ['name'], true);
  for (const sec of ['strings', 'code', 'shortcuts']) {
    const miss = Object.keys(en[sec] || {}).filter((k) => !p[sec] || !(k in p[sec]));
    const extra = Object.keys(p[sec] || {}).filter((k) => !(k in (en[sec] || {})));
    // Italian and English must be complete; the other languages fall back to English
    report(`${code}.json: ${sec} missing`, miss, strict || code === 'it' || code === 'en');
    report(`${code}.json: ${sec} not in en.json`, extra, false);
  }
  // the placeholders {name} are values given by the code: only those of English and Italian exist
  const ph = (t) => (t || '').match(/\{\w+\}/g) || [];
  const bad = Object.entries(p.strings || {}).filter(([k, v]) => en.strings[k] != null && ph(v).some((x) => !ph(en.strings[k]).includes(x) && !ph(langs.it && langs.it.strings[k]).includes(x))).map(([k]) => k);
  report(`${code}.json: unknown placeholders`, bad, true);
  // two blocks cannot have the same shortcut
  const sc = Object.values(p.shortcuts || {}); const dup = sc.filter((v, i) => sc.indexOf(v) !== i);
  report(`${code}.json: shortcuts used twice`, dup, true);
}
console.log(errors ? `${errors} errors` : `ok: ${Object.keys(langs).join(', ')} · ${used.size} texts, ${usedCode.size} code texts`);
process.exit(errors ? 1 : 0);
