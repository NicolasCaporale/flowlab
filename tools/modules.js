// Writes the modules of the FlowLab library to modules/<topic>/<Name>.fprg and the list to modules/README.md
// A module is a normal .fprg program: its classes are imported into another program,
// its Main is only for testing it and is not imported.
// Usage: node tools/modules.js
const fs = require('fs'), path = require('path');
global.ExprLib = require('../src/expr.js');
const M = global.ModelLib = require('../src/model.js');
const S = M.makeStmt;

const X = {
  decl: (name, type, size) => S('declare', { name, type, array: size != null, size: size != null ? String(size) : '' }),
  set: (variable, expression) => S('assign', { variable, expression }),
  out: (expression, newline = true) => S('output', { expression, newline }),
  call: (expression) => S('call', { expression }),
  if: (expression, then, els) => S('if', { expression, then: then || [], else: els || [] }),
  while: (expression, body) => S('while', { expression, body }),
  for: (variable, start, end, body, dec) => S('for', { variable, start, end, direction: dec ? 'dec' : 'inc', step: '1', body }),
  note: (text) => S('comment', { text }),
  throw: (expression) => S('throw', { expression }),
  try: (body, catches) => S('try', { body, catches: catches.map(([type, variable, b]) => M.makeCatch({ type, variable, body: b })), hasFinally: false, finally: [] }),
};
/* checks with exceptions, as in Java: a position outside the list, an empty stack or queue */
const badIndex = () => X.if('i < 0 or i >= count', [X.throw('new IndexOutOfRange("Index " & i & " out of bounds for length " & count)')]);

/* module: name, about, classes { Name: { tparams, attrs: [[name, type, vis, opts]], x, y } }, methods, test Main */
function module_({ name, about, mainClass, main, classes, methods }) {
  const p = M.newProgram();
  p.attrs.name = name; p.attrs.about = about; p.attrs.authors = 'FlowLab';
  p.functions[0].body = main;
  const mc = M.wrapInClass(p);
  mc.name = mainClass; Object.assign(mc, { x: 40, y: 360 });
  for (const [cn, c] of Object.entries(classes)) {
    p.classes.push(M.makeClass(cn, { tparams: c.tparams || [], x: c.x, y: c.y, attributes: (c.attrs || []).map(([n, t, vis, o]) => M.makeAttribute(Object.assign({ name: n, type: t, visibility: vis || 'private' }, o || {}))) }));
  }
  for (const m of methods) {
    const c = p.classes.find((k) => k.name === m.cls);
    const f = M.makeFunction(m.ctor ? c.name : m.name, { params: (m.params || []).map(([n, t, a]) => ({ name: n, type: t, array: !!a })), body: m.body || [], cls: c.id, visibility: m.vis || 'public', static: !!m.static, ctor: !!m.ctor });
    if (m.ret) M.setRets(f, [{ name: m.ret[0], type: m.ret[1] }]);
    p.functions.push(f);
  }
  return p;
}

/* module of functions only (program with functions): name, about, functions [{ name, params, ret, body }], test Main */
function functionsModule({ name, about, funcs, main }) {
  const p = M.newProgram();
  p.attrs.name = name; p.attrs.about = about; p.attrs.authors = 'FlowLab';
  p.functions[0].body = main;
  for (const fn of funcs) {
    const f = M.makeFunction(fn.name, { params: (fn.params || []).map(([n, t, arr]) => ({ name: n, type: t, array: !!arr })), body: fn.body || [] });
    if (fn.ret) M.setRets(f, [{ name: fn.ret[0], type: fn.ret[1], array: !!fn.ret[2] }]);
    p.functions.push(f);
  }
  return p;
}

/* growth of the internal array as in java.util.ArrayList: new capacity = old + old / 2 */
const grow = (cls) => ({ cls, name: 'grow', vis: 'private', body: [
  X.note('Full array: a bigger one is created (one and a half times, like the Java ArrayList) and the items are copied'),
  X.decl('newCapacity, k', 'Integer'),
  X.set('newCapacity', 'Size(items) + Int(Size(items) / 2)'),
  X.if('newCapacity < Size(items) + 1', [X.set('newCapacity', 'Size(items) + 1')]),
  X.decl('bigger', 'T', 'newCapacity'),
  X.for('k', '0', 'count - 1', [X.set('bigger[k]', 'items[k]')]),
  X.set('items', 'bigger'),
] });

const MODULES = [
  {
    topic: 'data_structures', id: 'ArrayList',
    make: () => module_({
      name: 'ArrayList',
      about: 'List of items of type T that grows by itself, like java.util.ArrayList. Internally it uses an array: when it is full it creates one one and a half times bigger and copies the items. A position outside the list throws IndexOutOfRange, a negative capacity InvalidArgument, as in Java.',
      mainClass: 'ArrayListTest',
      classes: { ArrayList: { tparams: ['T'], x: 40, y: 40, attrs: [['items', 'T', 'private', { array: true, size: '10' }], ['count', 'Integer', 'private', { init: '0' }]] } },
      methods: [
        { cls: 'ArrayList', ctor: true, body: [X.note('Empty list with initial capacity 10, like new ArrayList<>() in Java')] },
        { cls: 'ArrayList', ctor: true, params: [['initialCapacity', 'Integer']], body: [
          X.note('Empty list with an internal array of initialCapacity places, like new ArrayList<>(n) in Java'),
          X.if('initialCapacity < 0', [X.throw('new InvalidArgument("Illegal Capacity: " & initialCapacity)')]),
          X.decl('bigger', 'T', 'initialCapacity'), X.set('items', 'bigger')] },
        { cls: 'ArrayList', ctor: true, params: [['other', 'ArrayList<T>']], body: [
          X.note('Copy of the items of another list, like new ArrayList<>(other) in Java'),
          X.decl('k', 'Integer'), X.decl('bigger', 'T', 'other.count'),
          X.for('k', '0', 'other.count - 1', [X.set('bigger[k]', 'other.items[k]')]),
          X.set('items', 'bigger'), X.set('count', 'other.count')] },
        { cls: 'ArrayList', name: 'add', params: [['x', 'T']], body: [
          X.if('count = Size(items)', [X.call('grow()')]),
          X.set('items[count]', 'x'), X.set('count', 'count + 1')] },
        { cls: 'ArrayList', name: 'add', params: [['i', 'Integer'], ['x', 'T']], body: [
          X.note('Inserts x at position i: the items from i on move one place forward'),
          X.if('i < 0 or i > count', [X.throw('new IndexOutOfRange("Index: " & i & ", Size: " & count)')]),
          X.decl('k', 'Integer'),
          X.if('count = Size(items)', [X.call('grow()')]),
          X.for('k', 'count - 1', 'i', [X.set('items[k + 1]', 'items[k]')], true),
          X.set('items[i]', 'x'), X.set('count', 'count + 1')] },
        { cls: 'ArrayList', name: 'get', params: [['i', 'Integer']], ret: ['item', 'T'], body: [badIndex(), X.decl('item', 'T'), X.set('item', 'items[i]')] },
        { cls: 'ArrayList', name: 'set', params: [['i', 'Integer'], ['x', 'T']], body: [badIndex(), X.set('items[i]', 'x')] },
        { cls: 'ArrayList', name: 'remove', params: [['i', 'Integer']], ret: ['removed', 'T'], body: [
          X.note('Removes the item at position i: the following ones move one place back'),
          badIndex(),
          X.decl('removed', 'T'), X.decl('k', 'Integer'),
          X.set('removed', 'items[i]'),
          X.for('k', 'i', 'count - 2', [X.set('items[k]', 'items[k + 1]')]),
          X.set('count', 'count - 1')] },
        { cls: 'ArrayList', name: 'size', ret: ['n', 'Integer'], body: [X.decl('n', 'Integer'), X.set('n', 'count')] },
        { cls: 'ArrayList', name: 'isEmpty', ret: ['empty', 'Boolean'], body: [X.decl('empty', 'Boolean'), X.set('empty', 'count = 0')] },
        { cls: 'ArrayList', name: 'indexOf', params: [['x', 'T']], ret: ['position', 'Integer'], body: [
          X.decl('position, k', 'Integer'), X.set('position', '-1'), X.set('k', '0'),
          X.while('position = -1 and k < count', [X.if('items[k] = x', [X.set('position', 'k')]), X.set('k', 'k + 1')])] },
        { cls: 'ArrayList', name: 'contains', params: [['x', 'T']], ret: ['found', 'Boolean'], body: [X.decl('found', 'Boolean'), X.set('found', 'indexOf(x) >= 0')] },
        { cls: 'ArrayList', name: 'clear', body: [X.set('count', '0')] },
        grow('ArrayList'),
      ],
      main: [
        X.note('Test of the module: this Main is not imported'),
        X.decl('squares', 'ArrayList<Integer>'), X.decl('i', 'Integer'),
        X.set('squares', 'new ArrayList<Integer>()'),
        X.for('i', '1', '15', [X.call('squares.add(i * i)')]),
        X.out('"Items: " & squares.size() & ", the third is " & squares.get(2)'),
        X.call('squares.remove(0)'), X.call('squares.add(0, 100)'),
        X.out('"Now the first is " & squares.get(0) & ", the second " & squares.get(1)'),
        X.out('"Contains 49? " & squares.contains(49) & " at position " & squares.indexOf(49)'),
        X.decl('names', 'ArrayList<String>'), X.set('names', 'new ArrayList<String>(0)'),
        X.call('names.add("Ada")'), X.call('names.add("Alan")'),
        X.out('"Names: " & names.get(0) & " and " & names.get(1)'),
        X.decl('copyList', 'ArrayList<Integer>'), X.set('copyList', 'new ArrayList<Integer>(squares)'),
        X.call('copyList.set(0, -1)'),
        X.out('"Copy: " & copyList.get(0) & " " & copyList.get(1) & ", original: " & squares.get(0) & ", items " & copyList.size()'),
        X.note('A position outside the list and a negative capacity: exceptions, as in Java'),
        X.try([X.out('squares.get(20)')], [['IndexOutOfRange', 'e', [X.out('"Error: " & e.message')]]]),
        X.try([X.set('names', 'new ArrayList<String>(-1)')], [['InvalidArgument', 'e', [X.out('"Error: " & e.message')]]]),
      ],
    }),
  },
  {
    topic: 'data_structures', id: 'Stack',
    make: () => module_({
      name: 'Stack',
      about: 'Stack (LIFO) of items of type T, like java.util.Stack: the last item inserted with push is the first removed with pop. It uses an array that grows when it is full. pop and peek on an empty stack throw EmptyStack, as in Java.',
      mainClass: 'StackTest',
      classes: { Stack: { tparams: ['T'], x: 40, y: 40, attrs: [['items', 'T', 'private', { array: true, size: '10' }], ['count', 'Integer', 'private', { init: '0' }]] } },
      methods: [
        { cls: 'Stack', ctor: true, body: [X.note('Empty stack, like new Stack<>() in Java')] },
        { cls: 'Stack', name: 'push', params: [['x', 'T']], body: [X.if('count = Size(items)', [X.call('grow()')]), X.set('items[count]', 'x'), X.set('count', 'count + 1')] },
        { cls: 'Stack', name: 'pop', ret: ['top', 'T'], body: [X.if('count = 0', [X.throw('new EmptyStack("The stack is empty")')]), X.decl('top', 'T'), X.set('count', 'count - 1'), X.set('top', 'items[count]')] },
        { cls: 'Stack', name: 'peek', ret: ['top', 'T'], body: [X.if('count = 0', [X.throw('new EmptyStack("The stack is empty")')]), X.decl('top', 'T'), X.set('top', 'items[count - 1]')] },
        { cls: 'Stack', name: 'size', ret: ['n', 'Integer'], body: [X.decl('n', 'Integer'), X.set('n', 'count')] },
        { cls: 'Stack', name: 'isEmpty', ret: ['empty', 'Boolean'], body: [X.decl('empty', 'Boolean'), X.set('empty', 'count = 0')] },
        grow('Stack'),
      ],
      main: [
        X.note('Test of the module: this Main is not imported'),
        X.decl('tower', 'Stack<String>'), X.set('tower', 'new Stack<String>()'),
        X.call('tower.push("first")'), X.call('tower.push("second")'), X.call('tower.push("third")'),
        X.out('"On top: " & tower.peek()'),
        X.while('not tower.isEmpty()', [X.out('tower.pop()')]),
        X.note('pop on the empty stack: EmptyStack, as in Java'),
        X.try([X.out('tower.pop()')], [['EmptyStack', 'e', [X.out('"The stack is empty: nothing to pop"')]]]),
      ],
    }),
  },
  {
    topic: 'data_structures', id: 'Queue',
    make: () => module_({
      name: 'Queue',
      about: 'Queue (FIFO) of items of type T, like java.util.Queue: the items leave in the order they entered. It is a linked list of Node<T> nodes. remove and peek on an empty queue throw NoSuchElement, as remove() and element() in Java.',
      mainClass: 'QueueTest',
      classes: {
        Queue: { tparams: ['T'], x: 40, y: 40, attrs: [['head', 'Node<T>'], ['last', 'Node<T>'], ['count', 'Integer', 'private', { init: '0' }]] },
        Node: { tparams: ['T'], x: 40, y: 330, attrs: [['value', 'T', 'public'], ['next', 'Node<T>', 'public']] },
      },
      methods: [
        { cls: 'Node', ctor: true, params: [['v', 'T']], body: [X.set('value', 'v'), X.set('next', 'null')] },
        { cls: 'Queue', ctor: true, body: [X.note('Empty queue, like new LinkedList<>() in Java')] },
        { cls: 'Queue', ctor: true, params: [['other', 'Queue<T>']], body: [
          X.note('Copy of the items of another queue, in the same order, like new LinkedList<>(other) in Java'),
          X.decl('n', 'Node<T>'), X.set('n', 'other.head'),
          X.while('n != null', [X.call('add(n.value)'), X.set('n', 'n.next')])] },
        { cls: 'Queue', name: 'add', params: [['x', 'T']], body: [
          X.decl('n', 'Node<T>'), X.set('n', 'new Node<T>(x)'),
          X.if('last = null', [X.set('head', 'n')], [X.set('last.next', 'n')]),
          X.set('last', 'n'), X.set('count', 'count + 1')] },
        { cls: 'Queue', name: 'remove', ret: ['first', 'T'], body: [
          X.note('Removes and returns the first item of the line'),
          X.if('count = 0', [X.throw('new NoSuchElement("The queue is empty")')]),
          X.decl('first', 'T'), X.set('first', 'head.value'), X.set('head', 'head.next'),
          X.if('head = null', [X.set('last', 'null')]), X.set('count', 'count - 1')] },
        { cls: 'Queue', name: 'peek', ret: ['first', 'T'], body: [
          X.note('First item, without removing it; on an empty queue NoSuchElement, like element() in Java'),
          X.if('count = 0', [X.throw('new NoSuchElement("The queue is empty")')]), X.decl('first', 'T'), X.set('first', 'head.value')] },
        { cls: 'Queue', name: 'size', ret: ['n', 'Integer'], body: [X.decl('n', 'Integer'), X.set('n', 'count')] },
        { cls: 'Queue', name: 'isEmpty', ret: ['empty', 'Boolean'], body: [X.decl('empty', 'Boolean'), X.set('empty', 'count = 0')] },
      ],
      main: [
        X.note('Test of the module: this Main is not imported'),
        X.decl('line', 'Queue<Integer>'), X.decl('i', 'Integer'), X.set('line', 'new Queue<Integer>()'),
        X.for('i', '1', '5', [X.call('line.add(i * 10)')]),
        X.out('"First in the queue: " & line.peek() & " of " & line.size()'),
        X.decl('copyList', 'Queue<Integer>'), X.set('copyList', 'new Queue<Integer>(line)'), X.call('copyList.remove()'),
        X.out('"The copy has " & copyList.size() & " items, the queue " & line.size()'),
        X.while('not line.isEmpty()', [X.out('line.remove() & " "', false)]),
        X.out('""'),
        X.note('remove on the empty queue: NoSuchElement, as in Java'),
        X.try([X.out('line.remove()')], [['NoSuchElement', 'e', [X.out('"The queue is empty: nothing to remove"')]]]),
      ],
    }),
  },
  {
    topic: 'sorting_algorithms', id: 'Sorting',
    make: () => functionsModule({
      name: 'Sorting',
      about: 'Functions to sort an array of integers in increasing order: bubbleSort(v, n), selectionSort(v, n) and insertionSort(v, n), where n is the number of items to sort.',
      funcs: [
        { name: 'bubbleSort', params: [['v', 'Integer', true], ['n', 'Integer']], body: [
          X.note('Compares neighbouring items and swaps them: at each pass the largest goes to the end'),
          X.decl('i, j, t', 'Integer'),
          X.for('i', '0', 'n - 2', [X.for('j', '0', 'n - 2 - i', [X.if('v[j] > v[j + 1]', [X.set('t', 'v[j]'), X.set('v[j]', 'v[j + 1]'), X.set('v[j + 1]', 't')])])])] },
        { name: 'selectionSort', params: [['v', 'Integer', true], ['n', 'Integer']], body: [
          X.note('Finds the minimum of the unsorted part and puts it in its place'),
          X.decl('i, j, m, t', 'Integer'),
          X.for('i', '0', 'n - 2', [X.set('m', 'i'), X.for('j', 'i + 1', 'n - 1', [X.if('v[j] < v[m]', [X.set('m', 'j')])]), X.set('t', 'v[i]'), X.set('v[i]', 'v[m]'), X.set('v[m]', 't')])] },
        { name: 'insertionSort', params: [['v', 'Integer', true], ['n', 'Integer']], body: [
          X.note('Inserts each item in its place in the already sorted part, moving the larger ones forward'),
          X.decl('i, j, x', 'Integer'),
          X.for('i', '1', 'n - 1', [X.set('x', 'v[i]'), X.set('j', 'i - 1'), X.while('j >= 0 and v[j] > x', [X.set('v[j + 1]', 'v[j]'), X.set('j', 'j - 1')]), X.set('v[j + 1]', 'x')])] },
      ],
      main: [
        X.note('Test of the module: this Main is not imported'),
        X.decl('v', 'Integer', 8), X.decl('i', 'Integer'),
        X.for('i', '0', '7', [X.set('v[i]', '(i * 37 + 11) mod 50')]),
        X.call('insertionSort(v, 8)'),
        X.for('i', '0', '7', [X.out('v[i] & " "', false)]), X.out('""'),
      ],
    }),
  },
  {
    topic: 'searching_algorithms', id: 'Search',
    make: () => functionsModule({
      name: 'Search',
      about: 'Functions to search for a value x in an array of integers: linearSearch(v, n, x) for any array and binarySearch(v, n, x) for a sorted array. They return the position of the value or -1 if it is not there.',
      funcs: [
        { name: 'linearSearch', params: [['v', 'Integer', true], ['n', 'Integer'], ['x', 'Integer']], ret: ['position', 'Integer'], body: [
          X.note('Checks the items one after the other'),
          X.decl('position, i', 'Integer'), X.set('position', '-1'), X.set('i', '0'),
          X.while('position = -1 and i < n', [X.if('v[i] = x', [X.set('position', 'i')]), X.set('i', 'i + 1')])] },
        { name: 'binarySearch', params: [['v', 'Integer', true], ['n', 'Integer'], ['x', 'Integer']], ret: ['position', 'Integer'], body: [
          X.note('The array must be sorted: at each step the part to search is halved'),
          X.decl('position, low, high, mid', 'Integer'),
          X.set('position', '-1'), X.set('low', '0'), X.set('high', 'n - 1'),
          X.while('position = -1 and low <= high', [
            X.set('mid', 'Int((low + high) / 2)'),
            X.if('v[mid] = x', [X.set('position', 'mid')], [X.if('v[mid] < x', [X.set('low', 'mid + 1')], [X.set('high', 'mid - 1')])])])] },
      ],
      main: [
        X.note('Test of the module: this Main is not imported'),
        X.decl('v', 'Integer', 6), X.decl('i', 'Integer'),
        X.for('i', '0', '5', [X.set('v[i]', 'i * 3')]),
        X.out('"15 is at position " & binarySearch(v, 6, 15) & ", 7 at position " & linearSearch(v, 6, 7)'),
      ],
    }),
  },
  {
    topic: 'strings', id: 'Strings',
    make: () => functionsModule({
      name: 'Strings',
      about: 'Functions on strings, like the methods of String in Java: Substring(s, beginIndex, endIndex), IndexOf, Contains, StartsWith, EndsWith, ToUpper, ToLower, Trim, Replace, Split (an array of strings) and IsDigit, IsLetter for a character. Positions start from 0. In the generated code they become the functions of each language.',
      funcs: [
        { name: 'Substring', params: [['s', 'String'], ['beginIndex', 'Integer'], ['endIndex', 'Integer']], ret: ['sub', 'String'], body: [
          X.note('The characters from beginIndex to endIndex, endIndex excluded, as in Java: Substring("hello", 1, 3) = "el"'),
          X.if('beginIndex < 0 or endIndex > Len(s) or beginIndex > endIndex', [X.throw('new IndexOutOfRange("Range [" & beginIndex & ", " & endIndex & ") out of bounds for length " & Len(s))')]),
          X.decl('sub', 'String'), X.decl('i', 'Integer'), X.set('sub', '""'),
          X.for('i', 'beginIndex', 'endIndex - 1', [X.set('sub', 'sub & Char(s, i)')])] },
        { name: 'IndexOf', params: [['s', 'String'], ['t', 'String']], ret: ['position', 'Integer'], body: [
          X.note('Position of the first t in s, -1 if it is not there'),
          X.decl('position, i, k', 'Integer'), X.set('position', '-1'), X.set('i', '0'),
          X.while('position = -1 and i <= Len(s) - Len(t)', [
            X.set('k', '0'),
            X.while('k < Len(t) and Char(s, i + k) = Char(t, k)', [X.set('k', 'k + 1')]),
            X.if('k = Len(t)', [X.set('position', 'i')]),
            X.set('i', 'i + 1')])] },
        { name: 'Contains', params: [['s', 'String'], ['t', 'String']], ret: ['found', 'Boolean'], body: [X.decl('found', 'Boolean'), X.set('found', 'IndexOf(s, t) >= 0')] },
        { name: 'StartsWith', params: [['s', 'String'], ['t', 'String']], ret: ['result', 'Boolean'], body: [X.decl('result', 'Boolean'), X.set('result', 'Len(t) <= Len(s) and Substring(s, 0, Len(t)) = t')] },
        { name: 'EndsWith', params: [['s', 'String'], ['t', 'String']], ret: ['result', 'Boolean'], body: [X.decl('result', 'Boolean'), X.set('result', 'Len(t) <= Len(s) and Substring(s, Len(s) - Len(t), Len(s)) = t')] },
        { name: 'ToUpper', params: [['s', 'String']], ret: ['r', 'String'], body: [
          X.note('Lowercase letters (also the accented ones) become uppercase: the code of the character goes down by 32'),
          X.decl('r', 'String'), X.decl('i, c', 'Integer'), X.set('r', '""'),
          X.for('i', '0', 'Len(s) - 1', [X.set('c', 'ToCode(Char(s, i))'),
            X.if('(c >= 97 and c <= 122) or (c >= 224 and c <= 254 and c != 247)', [X.set('c', 'c - 32')]),
            X.set('r', 'r & ToChar(c)')])] },
        { name: 'ToLower', params: [['s', 'String']], ret: ['r', 'String'], body: [
          X.note('Uppercase letters (also the accented ones) become lowercase: the code of the character goes up by 32'),
          X.decl('r', 'String'), X.decl('i, c', 'Integer'), X.set('r', '""'),
          X.for('i', '0', 'Len(s) - 1', [X.set('c', 'ToCode(Char(s, i))'),
            X.if('(c >= 65 and c <= 90) or (c >= 192 and c <= 222 and c != 215)', [X.set('c', 'c + 32')]),
            X.set('r', 'r & ToChar(c)')])] },
        { name: 'Trim', params: [['s', 'String']], ret: ['r', 'String'], body: [
          X.note('Without the spaces (and tabs, new lines) at the beginning and at the end'),
          X.decl('r', 'String'), X.decl('a, b', 'Integer'), X.set('a', '0'), X.set('b', 'Len(s) - 1'),
          X.while('a <= b and ToCode(Char(s, a)) <= 32', [X.set('a', 'a + 1')]),
          X.while('b >= a and ToCode(Char(s, b)) <= 32', [X.set('b', 'b - 1')]),
          X.set('r', 'Substring(s, a, b + 1)')] },
        { name: 'Replace', params: [['s', 'String'], ['target', 'String'], ['replacement', 'String']], ret: ['r', 'String'], body: [
          X.note('Every target in s replaced by replacement, from left to right'),
          X.decl('r', 'String'), X.decl('i', 'Integer'), X.set('i', '0'),
          X.if('Len(target) = 0', [
            X.note('An empty target: replacement between all the characters, as in Java'),
            X.set('r', 'replacement'), X.for('i', '0', 'Len(s) - 1', [X.set('r', 'r & Char(s, i) & replacement')])], [
            X.set('r', '""'),
            X.while('i < Len(s)', [
              X.if('i <= Len(s) - Len(target) and Substring(s, i, i + Len(target)) = target', [X.set('r', 'r & replacement'), X.set('i', 'i + Len(target)')], [X.set('r', 'r & Char(s, i)'), X.set('i', 'i + 1')])])])] },
        { name: 'Split', params: [['s', 'String'], ['separator', 'String']], ret: ['parts', 'String', true], body: [
          X.note('The pieces of s between the separators, also the empty ones: Split("a;b;;c", ";") = {"a", "b", "", "c"}'),
          X.if('Len(separator) = 0', [X.throw('new InvalidArgument("The separator is empty")')]),
          X.decl('count, i, k, start', 'Integer'), X.set('count', '1'), X.set('i', '0'),
          X.while('i <= Len(s) - Len(separator)', [
            X.if('Substring(s, i, i + Len(separator)) = separator', [X.set('count', 'count + 1'), X.set('i', 'i + Len(separator)')], [X.set('i', 'i + 1')])]),
          X.decl('parts', 'String', 'count'),
          X.set('k', '0'), X.set('start', '0'), X.set('i', '0'),
          X.while('i <= Len(s) - Len(separator)', [
            X.if('Substring(s, i, i + Len(separator)) = separator', [X.set('parts[k]', 'Substring(s, start, i)'), X.set('k', 'k + 1'), X.set('i', 'i + Len(separator)'), X.set('start', 'i')], [X.set('i', 'i + 1')])]),
          X.set('parts[k]', 'Substring(s, start, Len(s))')] },
        { name: 'IsDigit', params: [['c', 'String']], ret: ['result', 'Boolean'], body: [
          X.note('True if c is a single digit character, 0 to 9'),
          X.decl('result', 'Boolean'), X.set('result', 'Len(c) = 1 and ToCode(c) >= 48 and ToCode(c) <= 57')] },
        { name: 'IsLetter', params: [['c', 'String']], ret: ['result', 'Boolean'], body: [
          X.note('True if c is a single letter, also accented'),
          X.decl('result', 'Boolean'), X.decl('x', 'Integer'), X.set('x', '0'),
          X.if('Len(c) = 1', [X.set('x', 'ToCode(c)')]),
          X.set('result', '(x >= 65 and x <= 90) or (x >= 97 and x <= 122) or (x >= 192 and x <= 255 and x != 215 and x != 247)')] },
      ],
      main: [
        X.note('Test of the module: this Main is not imported'),
        X.decl('s, t', 'String'), X.decl('i', 'Integer'), X.decl('parts', 'String', 1),
        X.set('s', '"  Hello, World!  "'), X.set('t', 'Trim(s)'),
        X.out('"[" & t & "] " & Len(t)'),
        X.out('Substring(t, 0, 5) & " " & IndexOf(t, "World") & " " & IndexOf(t, "xyz")'),
        X.out('Contains(t, "lo, W") & " " & StartsWith(t, "Hello") & " " & EndsWith(t, "?")'),
        X.out('ToUpper(t) & " " & ToLower("ABC def")'),
        X.out('Replace("banana", "na", "NA") & " " & Replace("ab", "", "-")'),
        X.set('parts', 'Split("Rossi;7;;8", ";")'),
        X.for('i', '0', 'Size(parts) - 1', [X.out('"[" & parts[i] & "]"', false)]), X.out('" " & Size(parts)'),
        X.out('IsDigit("7") & " " & IsDigit("a") & " " & IsLetter("x") & " " & IsLetter("?") & " " & IsDigit("12")'),
        X.note('Positions outside the string: IndexOutOfRange, as in Java'),
        X.try([X.out('Substring("abc", 2, 5)')], [['IndexOutOfRange', 'e', [X.out('"Error: " & e.message')]]]),
      ],
    }),
  },
];

/* name shown for a topic: the folder name, data_structures -> "Data structures" */
const topicTitle = (t) => { const x = t.replace(/[_-]+/g, ' ').trim(); return x[0].toUpperCase() + x.slice(1); };
module.exports = { MODULES, topicTitle };

if (require.main === module) {
  const root = path.join(__dirname, '../modules');
  const stamp = Buffer.from('flowlab;modules;2026-11-17 08:00:00 AM;1').toString('base64');
  const rows = [];
  for (const m of MODULES) {
    const p = m.make();
    p.attrs.created = stamp;
    const xml = M.serializeFprg(p)
      .replace(/<attribute name="saved" value="[^"]*"\/>/, '<attribute name="saved" value="2026-11-17 08:00:00 AM"/>')
      .replace(/<attribute name="edited" value="[^"]*"\/>/, `<attribute name="edited" value="${stamp}"/>`);
    fs.mkdirSync(path.join(root, m.topic), { recursive: true });
    fs.writeFileSync(path.join(root, m.topic, m.id + '.fprg'), xml);
    const cls = M.hasClasses(p) ? p.classes.filter((c) => c !== M.mainClass(p)).map((c) => '`' + M.classTitle(c) + '`').join(', ') : p.functions.slice(1).map((f) => '`' + f.name + '()`').join(', ');
    rows.push(`| ${topicTitle(m.topic)} | [${m.id}](${m.topic}/${m.id}.fprg) | ${cls} | ${p.attrs.about} |`);
  }
  fs.writeFileSync(path.join(root, 'README.md'), `# Modules

The module library of FlowLab, divided by topic. A module is a normal \`.fprg\` program:
its classes or functions are imported into another program (button «Import module») and used like those
written by hand, but they stay read-only. The Main of the module is only for testing it and is not imported.
Anyone can write a module, even a student: it is enough to save a program with the classes to reuse.

| Topic | Module | Classes or functions | Description |
|---|---|---|---|
${rows.join('\n')}

In the generated code the library modules that have an equivalent in the language use the classes
already available (for example \`java.util.ArrayList\`, \`list\` in Python, \`std::vector\` in C++), and the
functions of Strings become those of each language (\`s.substring(a, b)\` in Java, \`s[a:b]\` in Python); the other
modules become classes or functions written in the code.

Each subfolder is a topic: its name, with spaces written as \`_\`, is the one shown in FlowLab
(\`data_structures\` becomes «Data structures»). The description of each module is the one written in
Program properties › Description. In FlowLab other module collections can be added: the GitHub link
of a folder organised the same way is enough.

This folder is regenerated with \`node tools/modules.js\`.
`);
  console.log(MODULES.length, 'modules written to', root);
}
