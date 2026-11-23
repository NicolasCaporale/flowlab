// Shift+Enter confirms a dialog from any field (also a text area and with the suggestions open)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'it-IT', viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + process.cwd() + '/dist/FlowLab.html'); await page.waitForTimeout(300);
await page.evaluate(() => { localStorage.clear(); const S = ModelLib.makeStmt, p = FlowLab.state.prog; p.functions[0].body = [S('declare', { name: 'N, V, i', type: 'Integer' })]; FlowLab.render(); });
const wait = (ms = 150) => page.waitForTimeout(ms);
const ok = (name, cond) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`);
const n = () => page.evaluate(() => FlowLab.state.prog.functions[0].body.length);
// new assignment: Shift+Enter from the first field
await page.locator('#chart .shape[data-kind=declare]').click(); await page.keyboard.press('a'); await wait();
await page.fill('.modal #f_variable', 'N'); await page.fill('.modal #f_expression', '3');
await page.locator('.modal #f_variable').focus(); await page.keyboard.press('Shift+Enter'); await wait(200);
ok('Maiusc+Invio dal primo campo aggiunge il blocco', (await page.locator('.modal').count()) === 0 && (await n()) === 2);
// with the suggestions of the autocompletion open
await page.locator('#chart .shape[data-kind=assign]').click(); await page.keyboard.press('a'); await wait();
await page.fill('.modal #f_variable', 'V'); await page.locator('.modal #f_expression').fill('N'); await page.locator('.modal #f_expression').press('End'); await wait();
await page.keyboard.press('Shift+Enter'); await wait(200);
ok('anche con i suggerimenti aperti: ' + await n(), (await page.locator('.modal').count()) === 0 && (await n()) === 3 && (await page.evaluate(() => FlowLab.state.prog.functions[0].body[2].expression)) === 'N');
// a text area (comment): Enter goes to a new line, Shift+Enter confirms
await page.locator('#chart .shape[data-kind=assign]').last().click(); await page.keyboard.press('/'); await wait();
await page.locator('.modal textarea').fill('riga 1'); await page.locator('.modal textarea').press('Enter'); await page.keyboard.type('riga 2');
await page.keyboard.press('Shift+Enter'); await wait(200);
ok('commento su due righe confermato: ' + JSON.stringify(await page.evaluate(() => FlowLab.state.prog.functions[0].body.at(-1).text)), (await page.evaluate(() => FlowLab.state.prog.functions[0].body.at(-1).text)) === 'riga 1\nriga 2');
// an error keeps the dialog open
await page.locator('#chart .shape[data-kind=assign]').first().click(); await page.keyboard.press('a'); await wait();
await page.keyboard.press('Shift+Enter'); await wait(150);
ok('campi vuoti: il dialogo resta aperto', (await page.locator('.modal').count()) === 1);
ok('suggerimento sul pulsante: ' + await page.locator('.modal .btn.primary').getAttribute('title'), /Maiusc\+Invio/.test(await page.locator('.modal .btn.primary').getAttribute('title')));
console.log('ERR', errs);
await browser.close();
