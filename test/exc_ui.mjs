// Eccezioni: blocchi Try e Throw dal menu e dalla tastiera, dialoghi, esecuzione passo passo, eccezioni dell'utente
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + process.cwd() + '/dist/FlowLab.html'); await page.waitForTimeout(300);
await page.evaluate(() => { localStorage.clear(); const s = document.querySelector('#speed'); s.value = 0; s.dispatchEvent(new Event('input')); });
const wait = (ms = 150) => page.waitForTimeout(ms);
const ok = (name, cond) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`);
const out = async () => (await page.innerText('#conOut')).split('\n').filter((l) => l && !/^(▶|■)/.test(l)).join(' | ');
const load = async (f) => { await page.evaluate((x) => FlowLab.loadText(x, 'p.fprg'), fs.readFileSync(f, 'utf8')); await wait(250); };

// 1. programma con Try/Catch/Finally (vista Funzioni)
await load('test/out/excfun.fprg');
ok('rami Catch e Finally nel diagramma: ' + await page.locator('#chart .shape[data-kind=catch]').count() + ' Catch, ' + await page.locator('#chart .shape[data-kind=finally]').count() + ' Finally', (await page.locator('#chart .shape[data-kind=catch]').count()) >= 6 && (await page.locator('#chart .shape[data-kind=finally]').count()) === 3);
await page.click('#runBtn'); await wait(700);
ok('esecuzione: ' + await out(), (await out()).includes('indice non valido | conversione non valida | finally 1') && (await out()).includes('esterno: interna | ok 14'));
// passo passo: il cursore passa sulle intestazioni dei Catch
const seen = new Set(), labels = [];
await page.click('#stepBtn'); await wait(40);
for (let i = 0; i < 120 && (await page.evaluate(() => FlowLab.run.state)) === 'paused'; i++) {
  const id = await page.evaluate(() => FlowLab.run.curId); if (id) seen.add(String(id).replace(/^s\d+:/, '').replace(/:s\d+$/, ''));
  const lab = await page.evaluate(() => { const l = document.querySelector('#chart .exc-lab'); return l && document.querySelector('#chart .trail-path.exc') ? l.textContent : null; });
  if (lab) labels.push(lab);
  await page.click('#stepBtn'); await wait(15);
}
ok('freccia rossa dell\'eccezione: ' + labels.join(' | '), labels.some((l) => /Eccezione da media\(\)/.test(l)) && labels.some((l) => /DivisionePerZero → Finally, poi prosegue/.test(l)) && labels.some((l) => /IndiceNonValido/.test(l)));
ok('passo passo su Catch e Finally: ' + [...seen].filter((x) => /catch|finally/.test(x)).join(', '), seen.has('catch') && seen.has('finally'));
ok('errori: ' + errs.length, errs.length === 0);

// 2. un Try nuovo dalla tastiera (T) dopo il blocco selezionato
await page.evaluate(() => FlowLab.loadExample('media')); await wait(200);
await page.locator('#chart .shape[data-kind=declare]').first().click(); await wait(60);
await page.keyboard.press('t'); await wait(200);
ok('dialogo del Try: ' + await page.locator('.modal h2').textContent(), (await page.locator('.modal h2').textContent()) === 'Nuovo blocco: Try' && (await page.locator('.modal .catchrow').count()) === 1);
const types = await page.locator('.modal .catchrow select').first().locator('option').allTextContents();
ok('tipi di eccezione: ' + types.join(', '), types.includes('Eccezione') && types.includes('DivisionePerZero') && types.includes('IndiceNonValido'));
await page.click('.modal button:has-text("+ Aggiungi Catch")'); await wait(60);
await page.locator('.modal .catchrow').nth(1).locator('select').selectOption('DivisionePerZero');
await page.click('.modal footer .btn.primary'); await wait(120);
ok('Catch irraggiungibile: ' + await page.locator('.modal .formerr').textContent(), /non verrebbe mai eseguito/.test(await page.locator('.modal .formerr').textContent()));
await page.locator('.modal .catchrow').nth(1).locator('button[aria-label="Sposta su"]').click(); await wait(60);
await page.locator('.modal label:has-text("Finally")').click();
await page.click('.modal footer .btn.primary'); await wait(200);
const t = await page.evaluate(() => { let r = null; ModelLib.walk(FlowLab.state.prog.functions[0].body, (s) => { if (s.kind === 'try') r = { c: s.catches.map((c) => c.type + ' ' + c.variable), f: s.hasFinally }; }); return r; });
ok('Try creato: ' + JSON.stringify(t), t && t.c.join() === 'DivisionePerZero e,Eccezione e' && t.f);
await page.screenshot({ path: 'test/exc1_try.png' });
// doppio clic sull'intestazione di un Catch: si modifica il Try
await page.locator('#chart .shape[data-kind=catch]').first().dblclick(); await wait(150);
ok('doppio clic sul Catch apre il Try', (await page.locator('.modal h2').textContent()) === 'Try');
await page.keyboard.press('Escape'); await wait(80);
// Throw con Maiusc+T: scelta rapida del tipo
await page.locator('#chart .shape[data-kind=try]').click(); await wait(60);
await page.keyboard.press('Shift+T'); await wait(200);
ok('dialogo del Throw: ' + await page.inputValue('#f_expression'), (await page.inputValue('#f_expression')) === 'new Eccezione("")');
await page.selectOption('#f_exctype', 'ConversioneNonValida'); await wait(50);
await page.fill('#f_expression', (await page.inputValue('#f_expression')).replace('("")', '("prova")'));
ok('tipo cambiato: ' + await page.inputValue('#f_expression'), (await page.inputValue('#f_expression')) === 'new ConversioneNonValida("prova")');
await page.click('.modal footer .btn.primary'); await wait(200);
// eccezione non gestita: il programma si ferma con il tipo e il messaggio
await page.evaluate(() => { const p = FlowLab.state.prog; p.functions[0].body = [ModelLib.makeStmt('throw', { expression: 'new ConversioneNonValida("prova")' })]; FlowLab.render(); });
await page.click('#runBtn'); await wait(400);
ok('non gestita: ' + await out(), /Eccezione non gestita: ConversioneNonValida — prova/.test(await out()));

// 3. vista Oggetti: eccezione dell'utente
await load('test/out/excoo.fprg');
await page.evaluate(() => FlowLab.showUml()); await wait(150);
const box = await page.locator('.ubox:has(.uname:text-is("SaldoInsufficiente"))').textContent();
ok('UML: ' + box.match(/«[^»]+»/)?.[0], /«eredita da Eccezione»/.test(box));
await page.locator('.ubox:has(.uname:text-is("SaldoInsufficiente")) .uhit.head').dblclick(); await wait(150);
ok('classe madre: ' + await page.$eval('#f_cpar', (s) => s.value), (await page.$eval('#f_cpar', (s) => s.value)) === 'Eccezione' && (await page.locator('#f_cpar option').allTextContents()).includes('DivisionePerZero (eccezione predefinita)'));
await page.keyboard.press('Escape'); await wait(80);
await page.evaluate(() => FlowLab.showFunc(0)); await wait(150);
await page.click('#runBtn'); await wait(600);
ok('esecuzione: ' + await out(), (await out()).includes('saldo insufficiente: mancano 430 (prelievo troppo grande) | saldo: 70 | generica: importo negativo'));
await page.evaluate(() => FlowLab.setTab('code')); await page.selectOption('#langSel', 'java'); await wait(200);
const java = await page.locator('#codeOut').innerText();
ok('Java: throws e catch', /void preleva\(int x\) throws Exception/.test(java) && /catch \(SaldoInsufficiente e\)/.test(java) && /class SaldoInsufficiente extends Exception/.test(java));
// salvataggio: formato esteso
const xml = await page.evaluate(() => FlowLab.serialize());
ok('nel file: <try>, <catch>, <finally>, <throw>', /<try>/.test(xml) && /<catch type="SaldoInsufficiente" variable="e">/.test(xml) && /<finally>/.test(xml) && /<throw expression=/.test(xml));
console.log('ERR', errs);
await browser.close();
