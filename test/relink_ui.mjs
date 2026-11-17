// Finestre degli oggetti che seguono i riferimenti: testa passa da Nodo#1 a Nodo#2 → si apre anche Nodo#2
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'it-IT', viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + process.cwd() + '/dist/FlowLab.html'); await page.waitForTimeout(300);
await page.evaluate(() => { localStorage.clear(); FlowLab.loadExample('linked_list'); });
const wait = (ms = 120) => page.waitForTimeout(ms);
const ok = (name, cond) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`);
await wait(200);
await page.click('.tabw[data-tab=vars] [role=tab]');
const step = async () => { await page.click('#stepBtn'); await wait(60); };
const titles = () => page.$$eval('.ovwin .fwin-title', (t) => t.map((x) => x.textContent));
// fino a quando lista ha un valore
await step();
for (let i = 0; i < 20 && !(await page.locator('#varsBody .ov-link.obj').count()); i++) await step();
await page.locator('#varsBody .ov-link.obj').first().click(); await wait(150);
// fino al primo nodo in testa
const testa = () => page.locator('.ovwin[data-key^="obj:"] tr:has(td:text-is("testa")) .ov-link.obj');
for (let i = 0; i < 40 && !(await testa().count()); i++) await step();
await testa().first().click(); await wait(150);
ok('aperti: ' + (await titles()).join(', '), (await titles()).join() === 'Lista#1,Nodo#1');
// passo passo fino al secondo aggiungiInTesta: testa → Nodo#2
for (let i = 0; i < 40 && !(await titles()).includes('Nodo#2'); i++) await step();
ok('testa passa a Nodo#2: aperti ' + (await titles()).join(', '), (await titles()).join() === 'Lista#1,Nodo#1,Nodo#2');
await wait(200);
const links = await page.evaluate(() => {
  const wins = [...document.querySelectorAll('.ovwin')].map((w) => ({ t: w.querySelector('.fwin-title').textContent, r: w.getBoundingClientRect() }));
  // per ogni connettore: in quale finestra sta la riga di partenza (il rettangolo evidenziato)
  return [...document.querySelectorAll('.wlinks .wlink')].map((g) => { const s = g.querySelector('.wl-src'); if (!s) return 'fuori vista'; const x = +s.getAttribute('x') + 4, y = +s.getAttribute('y') + 4; const w = wins.find((k) => x >= k.r.left && x <= k.r.right && y >= k.r.top && y <= k.r.bottom); return w ? w.t : 'Variabili'; });
});
ok('connettori in partenza da: ' + links.join(', '), links.filter((x) => x === 'Lista#1').length === 1 && links.filter((x) => x === 'Nodo#2').length === 1);
await page.screenshot({ path: 'test/relink.png' });
// ancora un nodo: si apre Nodo#3, Nodo#2 si collega a Nodo#3.prossimo
for (let i = 0; i < 40 && !(await titles()).includes('Nodo#3'); i++) await step();
ok('terzo nodo: ' + (await titles()).join(', '), (await titles()).join() === 'Lista#1,Nodo#1,Nodo#2,Nodo#3');
await wait(200);
await page.screenshot({ path: 'test/relink3.png' });
// una vista (finestra in primo piano) sopra le righe e i connettori: li copre
await page.evaluate(() => { const w = FlowLab.openView(); const r = document.querySelector('#varsBody').getBoundingClientRect(); w.win.style.left = (r.left - 300) + 'px'; w.win.style.top = '120px'; w.win.style.width = '500px'; w.win.style.height = '500px'; });
await wait(300);
const masked = await page.evaluate(() => {
  const aw = document.querySelector('.auxwin').getBoundingClientRect();
  return [...document.querySelectorAll('.wlinks .wlink')].map((g) => { const m = g.getAttribute('mask'); if (!m) return false; const id = m.slice(5, -1); return [...document.querySelectorAll(`#${id} rect[fill="#000"]`)].some((r) => Math.abs(+r.getAttribute('x') - aw.left) < 1 && Math.abs(+r.getAttribute('width') - aw.width) < 1); });
});
ok('connettori coperti dalla vista in primo piano: ' + masked.join(', '), masked.length > 0 && masked.every(Boolean));
// la finestra di un oggetto portata in primo piano sopra la vista: i suoi connettori non sono coperti dalla vista
await page.evaluate(() => document.querySelector('.ovwin').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await wait(200);
const top = await page.evaluate(() => { const ws = [...document.querySelectorAll('.ovwin')]; const z = Math.max(...ws.map((w) => +getComputedStyle(w).zIndex)); return z > +getComputedStyle(document.querySelector('.auxwin')).zIndex; });
ok('finestra dell\'oggetto sopra la vista', top);
await page.screenshot({ path: 'test/relink4.png' });
console.log('ERR', errs);
await browser.close();
