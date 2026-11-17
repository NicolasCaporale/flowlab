// Examples for the Node tests: the .fprg files of examples/<language>/ (FLOWLAB_LANG, otherwise English)
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
if (typeof DOMParser === 'undefined') global.DOMParser = new JSDOM('').window.DOMParser;
const M = require('../src/model.js');
const dir = path.join(__dirname, '..', 'examples', process.env.FLOWLAB_LANG && fs.existsSync(path.join(__dirname, '..', 'examples', process.env.FLOWLAB_LANG)) ? process.env.FLOWLAB_LANG : 'en');
const list = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')).map((e) => ({ id: e.id, title: e.title, tags: e.tags, make: () => M.parseFprg(fs.readFileSync(path.join(dir, e.id + '.fprg'), 'utf8')) }));
module.exports = { list, get: (id) => list.find((e) => e.id === id) };
