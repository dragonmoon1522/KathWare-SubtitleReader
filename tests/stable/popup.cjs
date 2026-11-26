// KWSR_STABLE_ROOT debe apuntar al checkout de main que se va a empaquetar.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.KWSR_STABLE_ROOT;
if (!root) throw new Error('Indicá KWSR_STABLE_ROOT para probar el popup estable.');
const source = fs.readFileSync(path.join(root, 'Extension/popup/popup.js'), 'utf8');

function prepare({ include = false, tab = { id: 9, url: 'https://user:secret@vix.com/watch/123?token=private#session' } } = {}) {
  const nodes = new Map(), opened = [], storedReads = [];
  for (const id of ['modoNarrador','reporteError','enviarReporte','permitirEnvioLogs']) {
    nodes.set(id, { value: id === 'modoNarrador' ? 'lector' : 'No leyó el subtítulo.', checked: include,
      handlers:{}, addEventListener(name,fn) { this.handlers[name] = fn; } });
  }
  const logs = [
    { tabId:9, tabUrl:'https://vix.com/watch/123?old=1', msg:'Registro de esta página.' },
    { tabId:8, tabUrl:'https://vix.com/watch/123', msg:'No adjuntar otra pestaña.' },
    { tabId:9, tabUrl:'https://example.invalid/other', msg:'No adjuntar una página anterior.' },
    { msg:'Registro sin origen.' }
  ];
  const api = { runtime:{ getManifest:() => ({version:'3.0.0',version_name:'3.0.0'}) },
    tabs:{ query:(query,cb) => cb(tab ? [tab] : []), create:({url}) => opened.push(url) },
    storage:{ local:{ get:(keys,cb) => { storedReads.push(keys); cb({ kathLogs:logs }); }, set() {} } } };
  const document = { getElementById:id => nodes.get(id), addEventListener:(name,fn) => fn() };
  vm.runInNewContext(source, { document, chrome:api, navigator:{ userAgent:'Fixture browser' }, URL, console,
    alert:message => { throw new Error(message); } });
  nodes.get('enviarReporte').handlers.click();
  assert.equal(opened.length, 1);
  return { url:new URL(opened[0]), storedReads };
}

test('stable reports open a reviewable issue without URL credentials or query tokens', () => {
  const f = prepare(), body = f.url.searchParams.get('body');
  assert.equal(f.url.origin, 'https://github.com');
  assert.match(body, /URL: https:\/\/vix.com\/watch\/123/);
  assert.match(body, /Plataforma: vix/);
  assert.doesNotMatch(body, /secret|token=private|#session|Logs/);
  assert.equal(f.storedReads.filter(x => x === 'kathLogs').length, 0);
});

test('technical attachments include only stored records from this tab and page', () => {
  const f = prepare({ include:true }), body = f.url.searchParams.get('body');
  assert.match(body, /Registro de esta página/);
  assert.doesNotMatch(body, /No adjuntar|Registro sin origen/);
});

test('an unavailable page never attaches unidentified historical records', () => {
  const f = prepare({ include:true, tab:null });
  assert.doesNotMatch(f.url.searchParams.get('body'), /Logs|Registro sin origen/);
});
