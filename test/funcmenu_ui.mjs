// Menu of the diagram selector: the functions of the program first, then one group for each module, opened with +
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'it-IT', viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.route(/github(usercontent)?\.com/, (r) => r.abort());
await page.goto('file://' + process.cwd() + '/dist/FlowLab.html'); await page.waitForTimeout(300);
await page.evaluate(() => localStorage.clear());
const wait = (ms = 150) => page.waitForTimeout(ms);
const ok = (name, cond) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`);
const items = () => page.$$eval('#pop .fmenu > *', (es) => es.map((e) => (e.classList.contains('fmod') ? '[' + e.querySelector('.fplus').textContent + '] ' + e.querySelector('.ftxt').textContent : (e.getAttribute('aria-checked') === 'true' ? '✓' : '') + e.textContent.replace('✓', ''))));

await page.evaluate(() => FlowLab.loadExample('times_table')); await wait(200);
// two modules imported, then a function of the program
for (const name of ['Strings', 'Search']) {
  await page.keyboard.press('Control+i'); await wait(200);
  await page.waitForFunction(() => ![...document.querySelectorAll('.modsrc')].some((d) => /Caricamento/.test(d.innerText)), null, { timeout: 30000 });
  await page.evaluate(() => document.querySelectorAll('.modal details').forEach((d) => { d.open = true; })); await wait(100);
  await page.locator('.modsrc .modrow', { hasText: name }).locator('button').click(); await wait(250);
}
await page.evaluate(() => { const M = ModelLib, p = FlowLab.state.prog; p.functions.push(M.makeFunction('doppio', { params: [{ name: 'x', type: 'Integer' }] })); FlowLab.render(); });
const opts = await page.$$eval('#funcSel > *', (es) => es.map((e) => (e.tagName === 'OPTGROUP' ? 'G:' + e.label : e.textContent)));
ok('ordine nel select: ' + opts.join(' | '), opts[0].startsWith('Inizio') && opts[1].startsWith('doppio') && opts.indexOf('G:modulo Strings') > 0 && opts.slice(0, opts.indexOf('G:modulo Strings')).every((o) => !o.startsWith('G:')));

await page.click('#funcSel'); await wait(200);
let it = await items();
ok('menu chiuso: ' + it.join(' | '), it.includes('[+] modulo Strings') && it.includes('[+] modulo Search') && !it.some((x) => /Substring/.test(x)));
await page.screenshot({ path: 'test/funcmenu1.png', clip: { x: 0, y: 40, width: 760, height: 360 } });
await page.click('#pop .fmod[data-mod=Strings]'); await wait(150);
it = await items();
ok('aperto Strings: ' + it.slice(0, 8).join(' | '), it.includes('[−] modulo Strings') && it.some((x) => x.startsWith('Substring(s, beginIndex, endIndex)')) && !it.some((x) => /· modulo/.test(x)));
await page.screenshot({ path: 'test/funcmenu2.png', clip: { x: 0, y: 40, width: 760, height: 620 } });
// choose a function of the module
await page.click('#pop .fitem:has-text("Split(s, separator)")'); await wait(200);
ok('scelta Split: ' + await page.locator('#funcSel option:checked').textContent() + ', menu chiuso ' + await page.locator('#pop').isHidden(), /^Split/.test(await page.locator('#funcSel option:checked').textContent()) && await page.locator('#pop').isHidden());
// keyboard: Enter opens, Left closes the module of the current function, Esc closes the menu
await page.focus('#funcSel'); await page.keyboard.press('Enter'); await wait(150);
ok('focus sulla voce corrente: ' + await page.evaluate(() => document.activeElement.textContent), /Split/.test(await page.evaluate(() => document.activeElement.textContent)));
await page.keyboard.press('ArrowLeft'); await wait(120);
it = await items();
ok('freccia sinistra chiude il modulo: ' + await page.evaluate(() => document.activeElement.textContent), it.includes('[+] modulo Strings'));
await page.keyboard.press('ArrowRight'); await wait(120);
ok('freccia destra lo riapre', (await items()).includes('[−] modulo Strings'));
await page.keyboard.press('Escape'); await wait(120);
ok('Esc chiude', await page.locator('#pop').isHidden());
// a second click on the selector closes the menu
await page.click('#funcSel'); await wait(150); await page.click('#funcSel'); await wait(150);
ok('secondo clic chiude', await page.locator('#pop').isHidden());
// objects view: the classes of the modules after those of the program, collapsed
// a new session: the modules are closed again
await page.reload(); await wait(400);
await page.evaluate(() => FlowLab.loadExample('times_table')); await wait(200);
for (const name of ['ArrayList', 'Strings']) {
  await page.keyboard.press('Control+i'); await wait(250);
  await page.evaluate(() => document.querySelectorAll('.modal details').forEach((d) => { d.open = true; })); await wait(100);
  await page.locator('.modsrc .modrow', { hasText: name }).locator('button').click(); await wait(250);
}
await page.evaluate(() => FlowLab.showFunc(0)); await wait(150);
await page.click('#funcSel'); await wait(150);
it = await items();
ok('oggetti, chiuso: ' + it.join(' | '), it.includes('[+] modulo Strings') && it.includes('[+] modulo ArrayList') && !it.some((x) => /Substring/.test(x)));
await page.click('#pop .fmod[data-mod=Strings]'); await wait(150);
it = await items();
ok('oggetti, aperto Strings: ' + it.slice(0, 6).join(' | '), it.includes('[−] modulo Strings') && it.some((x) => x.startsWith('Substring(s, beginIndex, endIndex)')) && !it.some((x) => /new ArrayList/.test(x)));
await page.keyboard.press('Escape');
console.log('ERR', errs);
await browser.close();
