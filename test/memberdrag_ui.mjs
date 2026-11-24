// Class diagram: attributes and methods dragged to another class or to another place of the same class
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'it-IT', viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + process.cwd() + '/dist/FlowLab.html'); await page.waitForTimeout(300);
await page.evaluate(() => localStorage.clear());
const wait = (ms = 150) => page.waitForTimeout(ms);
const ok = (name, cond) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`);
await page.evaluate(() => {
  FlowLab.loadExample('times_table');
  const M = ModelLib, p = FlowLab.state.prog;
  M.wrapInClass(p);
  const A = M.makeClass('Auto', { x: 60, y: 300, attributes: [M.makeAttribute({ name: 'targa', type: 'String' }), M.makeAttribute({ name: 'km', type: 'Integer' }), M.makeAttribute({ name: 'colore', type: 'String' })] });
  const B = M.makeClass('Garage', { x: 520, y: 300, attributes: [M.makeAttribute({ name: 'posti', type: 'Integer' })] });
  const C = M.makeClass('Moto', { x: 520, y: 60, attributes: [M.makeAttribute({ name: 'km', type: 'Integer' })] });
  p.classes.push(A, B, C);
  const mk = (c, name, extra) => M.makeFunction(name, Object.assign({ cls: c.id, visibility: 'public', static: false, ctor: false }, extra || {}));
  p.functions.push(mk(A, 'Auto', { ctor: true }), mk(A, 'descrivi'), mk(A, 'ripara'), mk(B, 'apri'));
  FlowLab.setView('objects'); FlowLab.showUml(); FlowLab.render();
});
await wait(300);
const rows = (cls) => page.evaluate((n) => { const p = FlowLab.state.prog, c = p.classes.find((k) => k.name === n); return { a: c.attributes.map((x) => x.name).join(','), m: ModelLib.membersOf(p, c).map((f) => f.name).join(',') }; }, cls);
const rowBox = (cls, text) => page.evaluate(([n, t]) => {
  const c = FlowLab.state.prog.classes.find((k) => k.name === n);
  const r = [...document.querySelectorAll(`#chart .ubox[data-cls="${c.id}"] .urow`)].find((x) => x.querySelector('.umem').textContent.includes(t));
  const b = r.getBoundingClientRect(); return { x: b.x + 30, y: b.y + b.height / 2, h: b.height };
}, [cls, text]);
const drag = async (from, to, shot) => {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 10); await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2); await page.mouse.move(to.x, to.y); await wait(80);
  if (shot) await page.screenshot({ path: shot });
  await page.mouse.up(); await wait(250);
};
const toast = async () => (await page.locator('.toast').last().textContent().catch(() => '')) || '';

// attribute km of Auto onto Garage, before posti
const p0 = await rowBox('Garage', 'posti');
await drag(await rowBox('Auto', 'colore'), { x: p0.x, y: p0.y - p0.h / 3 }, 'test/memberdrag1.png');
ok('attributo in Garage: ' + JSON.stringify(await rows('Garage')) + ' ' + JSON.stringify(await rows('Auto')), (await rows('Garage')).a === 'colore,posti' && (await rows('Auto')).a === 'targa,km');
ok('messaggio: ' + await toast(), /colore spostato in Garage/.test(await toast()));
// undo
await page.keyboard.press('Control+z'); await wait(200);
ok('annullato: ' + (await rows('Auto')).a, (await rows('Auto')).a === 'targa,km,colore' && (await rows('Garage')).a === 'posti');
// same name: refused
await drag(await rowBox('Auto', 'km'), await rowBox('Moto', 'km'));
ok('nome già presente: ' + await toast(), (await rows('Moto')).a === 'km' && (await rows('Auto')).a === 'targa,km,colore' && /ha già un attributo km/.test(await toast()));
// reorder inside the class: colore at the top
const t0 = await rowBox('Auto', 'targa');
await drag(await rowBox('Auto', 'colore'), { x: t0.x, y: t0.y - t0.h / 3 });
ok('riordinato: ' + (await rows('Auto')).a, (await rows('Auto')).a === 'colore,targa,km');
// method ripara onto Garage (at the end)
const g = await rowBox('Garage', 'apri');
await drag(await rowBox('Auto', 'ripara'), { x: g.x, y: g.y + g.h / 3 }, 'test/memberdrag2.png');
ok('metodo in Garage: ' + JSON.stringify(await rows('Garage')), (await rows('Garage')).m === 'apri,ripara' && (await rows('Auto')).m === 'Auto,descrivi');
// the constructor stays in its class
await drag(await rowBox('Auto', 'Auto('), g);
ok('costruttore: ' + await toast(), (await rows('Auto')).m === 'Auto,descrivi' && /costruttore/.test(await toast()));
// the Main is not dragged: the class moves
const before = await page.evaluate(() => FlowLab.state.prog.classes[0].x);
const mn = await rowBox('Tabellina', 'Main');
await drag(mn, { x: mn.x + 60, y: mn.y });
ok('Main: si sposta la classe', (await page.evaluate(() => FlowLab.state.prog.classes[0].x)) === before + 60 && (await rows('Tabellina')).m === 'Main');
// dragging the header still moves the class
console.log('ERR', errs);
await browser.close();
