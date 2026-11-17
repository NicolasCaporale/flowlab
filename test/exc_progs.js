// Programmi con eccezioni usati dai test (vista Funzioni e vista Oggetti)
const M = require('../src/model.js');
const { oo, out, set, decl, call } = require('./oo_progs.js');
const S = M.makeStmt;
const tryS = (body, catches, fin) => S('try', { body, catches: catches.map(([type, variable, b]) => M.makeCatch({ type, variable, body: b })), hasFinally: !!fin, finally: fin || [] });
const thr = (e) => S('throw', { expression: e });
const iff = (e, then, els) => S('if', { expression: e, then, else: els || [] });
const fn = (name, params, rets, body) => { const f = M.makeFunction(name, { params: params.map(([n, t, a]) => ({ name: n, type: t, array: !!a })), body }); if (rets) M.setRets(f, rets.map(([n, t]) => ({ name: n, type: t }))); return f; };

/* vista Funzioni: errori di esecuzione catturati, Throw di eccezioni predefinite, Finally, risalita dalle funzioni */
function excfun() {
  const p = M.newProgram();
  p.attrs.name = 'Eccezioni';
  p.functions[0].body = [
    decl('v', 'Integer', 3), decl('i, x', 'Integer'), decl('r', 'Real'),
    tryS([set('i', '5'), set('v[i]', '1'), out('"non arriva qui"')], [['IndexOutOfRange', 'e', [out('"indice non valido"')]]]),
    tryS([set('x', 'ToInteger("12a")')], [['DivisionByZero', 'e', [out('"no"')]], ['InvalidConversion', 'e', [out('"conversione non valida"')]]], [out('"finally 1"')]),
    set('r', '1.5'),
    tryS([set('r', 'media(0)')], [['Exception', 'e', [out('"catturata: " & e.message')]]]),
    out('"r resta " & r'),
    tryS([set('x', 'controlla(-3)'), out('"no"')], [['Exception', 'err', [out('"controlla: " & err.message')]]], [out('"finally 2"')]),
    tryS([tryS([thr('new DivisionByZero("interna")')], [['IndexOutOfRange', 'e', [out('"no"')]]], [out('"finally interno"')])], [['DivisionByZero', 'e', [out('"esterno: " & e.message')]]]),
    set('x', 'controlla(7)'), out('"ok " & x'),
  ];
  p.functions.push(
    fn('media', [['n', 'Integer']], [['m', 'Real']], [decl('m', 'Real'), iff('n = 0', [thr('new Exception("nessun voto")')]), set('m', '10 / n')]),
    fn('controlla', [['n', 'Integer']], [['k', 'Integer']], [decl('k', 'Integer'), iff('n < 0', [thr('new Exception("negativo: " & n)')]), set('k', 'n * 2')]),
  );
  return p;
}

/* vista Oggetti: eccezione dell'utente che eredita da Exception, cattura per tipo e per classe madre */
function excoo() {
  const p = oo([
    decl('c', 'Conto'),
    set('c', 'new Conto(100)'),
    tryS([call('c.preleva(30)'), call('c.preleva(500)'), out('"no"')], [['SaldoInsufficiente', 'e', [out('"saldo insufficiente: mancano " & e.mancano & " (" & e.message & ")"')]]], [out('"saldo: " & c.saldo')]),
    tryS([call('c.preleva(-1)')], [['SaldoInsufficiente', 'e', [out('"no"')]], ['Exception', 'e', [out('"generica: " & e.message')]]]),
    tryS([call('c.preleva(1000)')], [['Exception', 'e', [out('"anche come Exception: " & e.message')]]]),
  ], [
    { name: 'Conto', attributes: [{ name: 'saldo', type: 'Integer', visibility: 'public' }] },
    { name: 'SaldoInsufficiente', parent: 'Exception', attributes: [{ name: 'mancano', type: 'Integer', visibility: 'public' }] },
  ], [
    { cls: 'Conto', ctor: true, params: [['s', 'Integer']], body: [set('saldo', 's')] },
    { cls: 'Conto', name: 'preleva', params: [['x', 'Integer']], body: [
      iff('x < 0', [thr('new Exception("importo negativo")')]),
      iff('x > saldo', [thr('new SaldoInsufficiente(x - saldo)')]),
      set('saldo', 'saldo - x')] },
    { cls: 'SaldoInsufficiente', ctor: true, params: [['m', 'Integer']], body: [call('super("prelievo troppo grande")'), set('mancano', 'm')] },
  ]);
  return p;
}
module.exports = { excfun, excoo };
