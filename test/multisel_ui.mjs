// Multiple selection of blocks: Shift+click, Ctrl+click, Shift+arrows, Ctrl+A; copy, cut, paste, delete, duplicate, move
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'it-IT', viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + process.cwd() + '/dist/FlowLab.html'); await page.waitForTimeout(300);
await page.evaluate(() => { localStorage.clear(); FlowLab.loadExample('grade_average'); }); await page.waitForTimeout(300);
const wait = (ms = 120) => page.waitForTimeout(ms);
const ok = (name, cond) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`);
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
const body = () => page.evaluate(() => FlowLab.state.prog.functions[0].body.map((s) => s.kind));
const selected = () => page.evaluate(() => [...document.querySelectorAll('#chart .shape.sel')].map((g) => g.dataset.kind));
const top = (i) => page.locator(`#chart .shape[data-id="${'X'}"]`);
const shapeOf = async (i) => page.locator(`#chart .shape[data-id="${await page.evaluate((k) => FlowLab.state.prog.functions[0].body[k].id, i)}"]`);
const b0 = await body();
console.log('corpo:', b0.join(' '));
// 1. Shift+click: from the 1st to the 4th block of the Main
await (await shapeOf(0)).click(); await wait();
await (await shapeOf(3)).click({ modifiers: ['Shift'] }); await wait();
ok('Shift+clic: ' + (await selected()).join(' '), (await selected()).length === 4);
// copy and paste after the last block
await page.keyboard.press(`${mod}+c`); await wait();
await (await shapeOf(b0.length - 1)).click(); await wait();
await page.keyboard.press(`${mod}+v`); await wait(200);
let b1 = await body();
ok(`Copia e incolla: ${b0.length} → ${b1.length} blocchi, incollati selezionati ${(await selected()).length}`, b1.length === b0.length + 4 && JSON.stringify(b1.slice(-4)) === JSON.stringify(b0.slice(0, 4)) && (await selected()).length === 4);
// delete the 4 pasted (still selected)
await page.keyboard.press('Delete'); await wait(200);
ok('Canc sui 4 blocchi: ' + (await body()).length, (await body()).length === b0.length);
// 2. Ctrl+click: two non contiguous blocks, then copy: paste inserts both in order
await (await shapeOf(0)).click(); await wait();
await (await shapeOf(2)).click({ modifiers: [mod] }); await wait();
ok('Ctrl+clic: ' + (await selected()).join(' '), (await selected()).length === 2);
await (await shapeOf(2)).click({ modifiers: [mod] }); await wait();
ok('Ctrl+clic di nuovo lo toglie: ' + (await selected()).join(' '), (await selected()).length === 1);
// 3. Shift+ArrowDown grows the selection; Alt+ArrowDown moves it; Ctrl+D duplicates it
await (await shapeOf(1)).click(); await wait();
await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Shift+ArrowDown'); await wait();
ok('Maiusc+↓ due volte: ' + (await selected()).join(' '), (await selected()).length === 3);
const ids0 = await page.evaluate(() => FlowLab.state.prog.functions[0].body.map((s) => s.id));
await page.keyboard.press('Alt+ArrowDown'); await wait(200);
const ids1 = await page.evaluate(() => FlowLab.state.prog.functions[0].body.map((s) => s.id));
ok('Alt+↓ sposta i tre blocchi insieme', JSON.stringify(ids1) === JSON.stringify([ids0[0], ids0[4], ids0[1], ids0[2], ids0[3], ...ids0.slice(5)]));
await page.keyboard.press(`${mod}+z`); await wait(200);
await page.evaluate(() => {}); 
await (await shapeOf(1)).click(); await page.keyboard.press('Shift+ArrowDown'); await wait();
await page.keyboard.press(`${mod}+d`); await wait(200);
ok('Ctrl+D duplica i due blocchi: ' + (await body()).length, (await body()).length === b0.length + 2);
await page.keyboard.press(`${mod}+z`); await wait(200);
// 4. Shift+click from a block inside the For to one outside: the whole For is taken
const forId = await page.evaluate(() => FlowLab.state.prog.functions[0].body.find((s) => s.kind === 'for').id);
const inside = await page.evaluate((fid) => ModelLib.findStmt(FlowLab.state.prog, fid).stmt.body[0].id, forId);
await page.locator(`#chart .shape[data-id="${inside}"]`).click(); await wait();
await (await shapeOf(0)).click({ modifiers: ['Shift'] }); await wait();
const sk = await page.evaluate(() => [...document.querySelectorAll('#chart .shape.sel')].map((g) => g.dataset.id));
ok('dentro e fuori dal Per: preso tutto il Per (' + sk.length + ' blocchi)', sk.includes(forId) && !sk.includes(inside));
// 5. right click inside the selection keeps it; «Copia» from the menu copies all
await page.locator(`#chart .shape[data-id="${forId}"]`).click({ button: 'right' }); await wait();
ok('tasto destro nella selezione: resta ' + (await selected()).length, (await selected()).length === sk.length);
await page.locator('.ctxmenu button', { hasText: 'Taglia' }).click(); await wait(200);
ok('Taglia dal menu: ' + (await body()).length + ' blocchi', (await body()).length === b0.length - sk.length);
await page.keyboard.press(`${mod}+z`); await wait(200);
// 6. Ctrl+A and Esc
await (await shapeOf(0)).click(); await page.keyboard.press(`${mod}+a`); await wait();
ok('Ctrl+A: ' + (await selected()).length, (await selected()).length === b0.length);
await page.keyboard.press('Escape'); await wait();
ok('Esc: resta un blocco', (await selected()).length === 1);
// paste menu on an arrow: «Paste here (N blocks)»
await (await shapeOf(0)).click(); await (await shapeOf(1)).click({ modifiers: ['Shift'] }); await page.keyboard.press(`${mod}+c`); await wait();
await page.locator('#chart .ins').nth(1).click({ force: true }); await wait(200);
ok('menu della freccia: ' + await page.locator('.pastebtn').textContent(), /2 blocchi/.test(await page.locator('.pastebtn').textContent()));
await page.keyboard.press('Escape'); await wait();
// 7. rectangle drawn with the mouse on the empty sheet: the blocks all inside it
const r1 = await (await shapeOf(1)).boundingBox(), r3 = await (await shapeOf(3)).boundingBox();
const x0 = Math.min(r1.x, r3.x) - 60, y0 = r1.y - 8, x1 = Math.max(r1.x + r1.width, r3.x + r3.width) + 60, y1 = r3.y + r3.height + 8;
await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await page.mouse.move(x1, y1, { steps: 4 });
ok('rettangolo visibile durante il trascinamento', (await page.locator('.selband').count()) === 1);
await page.mouse.up(); await wait(150);
ok('rettangolo: ' + (await selected()).join(' '), JSON.stringify(await selected()) === JSON.stringify(['declare', 'output', 'input']) && (await page.locator('.selband').count()) === 0);
await page.keyboard.press(`${mod}+c`); await wait();
ok('copiati dal rettangolo: ' + await page.evaluate(() => FlowLab.state.clip ? FlowLab.state.clip.length : 0), (await page.evaluate(() => FlowLab.state.clip.length)) === 3);
// Shift + rectangle adds to the selection
await (await shapeOf(0)).click(); await wait();
await page.keyboard.down('Shift');
await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 6 }); await page.mouse.up(); await wait(150);
await page.keyboard.up('Shift');
ok('Maiusc + rettangolo aggiunge: ' + (await selected()).length, (await selected()).length === 4);
// a click on the empty sheet clears it
await page.mouse.click(x0, y1 + 40); await wait();
ok('clic sul foglio vuoto: nessuna selezione', (await selected()).length === 0);
console.log('ERR', errs);
await browser.close();
