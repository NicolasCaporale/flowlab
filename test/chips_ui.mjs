// Suggested variables under a field: at most two rows, the others in the «…» list
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'it-IT', viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + process.cwd() + '/dist/FlowLab.html'); await page.waitForTimeout(300);
const wait = (ms = 150) => page.waitForTimeout(ms);
const ok = (name, cond) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`);
const names = ['DISTANZA_MAX_PIEDI_M', 'MAGGIORE_ETA', 'distanzaM', 'tempoSereno', 'etaAnni', 'vicino', 'maggiorenne', 'piove', 'usaAutomobile', 'contatoreLungo', 'sommaParziale', 'indiceRiga', 'indiceColonna', 'ultimoValore'];
await page.evaluate((ns) => { localStorage.clear(); const S = ModelLib.makeStmt, p = FlowLab.state.prog; p.functions[0].body = [S('declare', { name: ns.join(', '), type: 'Integer' }), S('assign', { variable: 'vicino', expression: '1' })]; FlowLab.render(); }, names);
await page.locator('#chart .shape[data-kind=assign]').dblclick(); await wait(300);
const rows = await page.evaluate(() => [...document.querySelectorAll('.modal .chips')].map((c) => { const vis = [...c.querySelectorAll('.chip')].filter((b) => !b.hidden); return { rows: new Set(vis.map((b) => b.offsetTop)).size, more: !!c.querySelector('.chip.more:not([hidden])'), last: vis[vis.length - 1].textContent, hidden: [...c.querySelectorAll('.chip:not(.more)')].filter((b) => b.hidden).length }; }));
ok('due righe con «…» in fondo: ' + JSON.stringify(rows), rows.every((r) => r.rows <= 2 && r.more && r.last === '…' && r.hidden > 0));
// the «…» of the expression: list of the others, a choice goes into the field
await page.fill('.modal #f_expression', ''); await page.locator('.modal #f_expression').focus();
await page.locator('.modal .chips').nth(1).locator('.chip.more').click(); await wait();
const items = await page.locator('#pop .chipmenu button').allTextContents();
ok('lista delle altre: ' + items.join(', '), items.length === rows[1].hidden);
await page.locator('#pop .chipmenu button').last().click(); await wait();
ok('scelta nel campo: ' + await page.inputValue('.modal #f_expression'), (await page.inputValue('.modal #f_expression')) === items[items.length - 1] && (await page.locator('.modal').count()) === 1);
// a wider dialog shows more chips (they follow the size)
await page.screenshot({ path: 'test/chips.png', clip: await page.locator('.modal').boundingBox() });
// few variables: no «…»
await page.keyboard.press('Escape'); await wait(); await page.keyboard.press('Escape'); await wait();
await page.evaluate(() => { const S = ModelLib.makeStmt, p = FlowLab.state.prog; p.functions[0].body = [S('declare', { name: 'a, b', type: 'Integer' }), S('assign', { variable: 'a', expression: '1' })]; FlowLab.render(); });
await page.locator('#chart .shape[data-kind=assign]').dblclick(); await wait(300);
ok('poche variabili: niente «…»', (await page.locator('.modal .chip.more:not([hidden])').count()) === 0);
console.log('ERR', errs);
await browser.close();
