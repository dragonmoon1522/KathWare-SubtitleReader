// Mensajería y popup simulados. Ninguna prueba abre GitHub ni publica un issue.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fixture } = require('./helpers/selector-dom.cjs');
const extension = path.join(__dirname, '../Extension');
const reportContext = { URL };
vm.runInNewContext(fs.readFileSync(path.join(extension, 'popup/report.js'), 'utf8'), reportContext);
const report = overrides => ({ mensaje: 'Activé los subtítulos y no se leen.', fecha: '2026-11-17', version: '3.0.0-beta',
  platform: 'crunchyroll', modoNarrador: 'lector', url: 'https://www.crunchyroll.com/watch/example?token=private#session', ua: 'Browser', ...overrides });

test('the issue draft preserves comments and removes URL credentials, query and fragments', () => {
  const result = reportContext.KWSRReport.prepareIssue(report({
    url: 'https://user:password@example.com/watch/episode?token=secret#access',
    diagnostic: { platform: 'crunchyroll', lastVisualText: 'Visitar https://example.com/watch?signature=private' },
    logs: [{ msg: 'Fuente https://example.com/stream?token=secret' }]
  }));
  const url = new URL(result.url), body = url.searchParams.get('body');
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.pathname, '/dragonmoon1522/KathWare-SubtitleReader/issues/new');
  assert.ok(body.includes('Activé los subtítulos y no se leen.'));
  for (const value of ['password', 'token=', 'signature=', '#access']) assert.ok(!body.includes(value), value);
});

test('long technical data is summarized without truncating comments or producing an oversized URL', () => {
  const message = 'Pasos: activar y reproducir. '.repeat(12);
  const result = reportContext.KWSRReport.prepareIssue(report({ mensaje: message,
    diagnostic: { platform: 'crunchyroll', selectorSearch: { attempted: 60, total: 60,
      checked: Array.from({ length: 60 }, (_, i) => ({ selector: `.un-selector-largo-${i}`, usable: false })) } },
    logs: Array.from({ length: 100 }, (_, i) => ({ msg: `${i} ` + 'Texto técnico '.repeat(200) }))
  }));
  assert.ok(result.url.length <= 7500);
  assert.ok(result.body.includes(message.trim()));
  assert.equal(result.trimmed, true);
});

test('a comment that cannot fit is rejected intact instead of being silently truncated', () => {
  assert.throws(() => reportContext.KWSRReport.prepareIssue(report({ mensaje: '字'.repeat(3000) })), /comentario.*extenso/);
});

function contentFixture() {
  const f = fixture(), writes = [];
  let listener;
  f.KWSR.version = '3.0.0-beta';
  f.KWSR.CFG.debug = false;
  f.KWSR.getDebugLogs = () => [{ msg: 'Registro de esta pestaña.' }];
  f.KWSR.api = { runtime: { onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: { set(value) { writes.push(value); } } } };
  f.KWSR.overlay = {};
  f.load('content/adapters/kwsr.betaTools.js'); f.load('content/core/kwsr.hotkeys.js');
  return { ...f, writes, send(message) { let response; const pending = listener(message, {}, data => { response = data; });
    assert.equal(pending, false); return response; } };
}

test('status and reports without technical opt-in do not return subtitle text or logs', () => {
  const f = contentFixture(); f.KWSR.state.lastEmitText = 'Texto privado del subtítulo.';
  for (const message of [{ action: 'getSubtitleStatus' }, { action: 'getDiagnostics', includeTechnical: false }]) {
    const result = f.send(message);
    assert.equal(result.status, 'ok'); assert.ok(result.support);
    assert.equal(result.logs, undefined); assert.equal(result.diagnostic, undefined);
    assert.ok(!JSON.stringify(result).includes('Texto privado'));
  }
});

test('technical opt-in obtains the actual tab diagnostic, selector search and its own recent logs', () => {
  const f = contentFixture(); f.start();
  const result = f.send({ action: 'getDiagnostics', includeTechnical: true });
  assert.equal(result.diagnostic.platform, 'crunchyroll');
  assert.equal(result.diagnostic.selectorSearch.status, 'waiting');
  assert.equal(result.logs[0].msg, 'Registro de esta pestaña.');
});

test('debug can be enabled through extension messaging without changing activation or output mode', () => {
  const f = contentFixture(), mode = f.KWSR.state.modoNarradorGlobal;
  const result = f.send({ action: 'setDebug', enabled: true });
  assert.equal(result.support.debug, true);
  assert.equal(f.KWSR.state.modoNarradorGlobal, mode);
  assert.equal(f.writes[0].debugVisual, true);
});

function popupFixture({ technical = false, available = true, creationFails = false } = {}) {
  const f = fixture('example.org'), opened = [], messages = [], reads = [];
  for (const [id, tag] of Object.entries({ modoNarrador: 'select', reporteError: 'textarea', enviarReporte: 'button',
    permitirEnvioLogs: 'input', alternarDebug: 'button', compatibilidad: 'p', estadoReporte: 'p' })) f.node(tag, { id });
  const node = id => f.document.getElementById(id);
  node('modoNarrador').value = 'lector'; node('reporteError').value = 'Comentarios de la usuaria.';
  node('permitirEnvioLogs').checked = technical;
  const support = { platform: 'crunchyroll', modoNarrador: 'sintetizador', debug: false, extensionActiva: true,
    videoFound: true, selectorSearch: { status: 'waiting', total: 60, attempted: 60 } };
  const api = {
    runtime: { getManifest: () => ({ version_name: '3.0.0-beta' }) },
    storage: { local: {
      get(keys, cb) { reads.push(keys); cb({ modoNarrador: 'lector', debug: false }); },
      set(data, cb) { cb?.(); }
    } },
    tabs: {
      query(opts, cb) { cb([{ id: 42, url: 'https://www.crunchyroll.com/watch/example?token=secret' }]); },
      sendMessage(id, message, cb) {
        messages.push({ id, ...message });
        if (!available) { api.runtime.lastError = { message: 'No receiver' }; cb(); delete api.runtime.lastError; return; }
        if (message.action === 'setDebug') support.debug = message.enabled;
        cb({ status: 'ok', support, pageUrl: 'https://www.crunchyroll.com/watch/current?token=private',
          diagnostic: { platform: 'crunchyroll', selectorSearch: support.selectorSearch }, logs: [{ msg: 'Registro actual.' }] });
      },
      create(options, cb) {
        if (creationFails) api.runtime.lastError = { message: 'Creation failed' };
        else opened.push(options.url);
        cb?.(); delete api.runtime.lastError;
      }
    }
  };
  Object.assign(f.context, { chrome: api, URL, navigator: { userAgent: 'Test Browser' } });
  f.load('popup/report.js'); f.load('popup/popup.js');
  f.handlers.get('DOMContentLoaded')();
  return { ...f, opened, messages, reads, node, click(id) { node(id).events.get('click')(); } };
}

test('a failed search offers help without declaring a site incompatible or opening a report automatically', () => {
  const f = popupFixture();
  assert.match(f.node('compatibilidad').textContent, /Todavía no se detectaron/);
  assert.deepEqual(f.opened, []);
  assert.ok(f.messages.every(message => message.action !== 'setDebug'));
});

test('the popup toggles debug in the current tab through an accessible pressed button', () => {
  const f = popupFixture(); f.click('alternarDebug');
  assert.equal(f.node('alternarDebug').getAttribute('aria-pressed'), 'true');
  assert.ok(f.messages.some(message => message.id === 42 && message.action === 'setDebug' && message.enabled));
});

test('a report without technical opt-in uses the live mode and omits all returned diagnostic data', () => {
  const f = popupFixture(); f.click('enviarReporte');
  const body = new URL(f.opened[0]).searchParams.get('body');
  assert.ok(body.includes('Comentarios de la usuaria.'));
  assert.ok(body.includes('sintetizador'));
  assert.ok(!body.includes('Registro actual.'));
  assert.ok(!body.includes('## Diagnóstico'));
  assert.ok(!body.includes('token='));
  assert.ok(f.messages.some(message => message.action === 'getDiagnostics' && message.includeTechnical === false));
  assert.ok(f.reads.every(keys => !keys.includes('kathLogs')));
});

test('a report with opt-in includes current-tab logs and remains a GitHub draft', () => {
  const f = popupFixture({ technical: true }); f.click('enviarReporte');
  const url = new URL(f.opened[0]), body = url.searchParams.get('body');
  assert.ok(body.includes('Registro actual.')); assert.ok(body.includes('## Diagnóstico'));
  assert.equal(url.pathname, '/dragonmoon1522/KathWare-SubtitleReader/issues/new');
  assert.ok(f.messages.filter(message => message.action === 'getDiagnostics').every(message => message.id === 42));
});

test('missing diagnostics preserve the comment and do not open an empty technical report', () => {
  const f = popupFixture({ technical: true, available: false }); f.click('enviarReporte');
  assert.deepEqual(f.opened, []);
  assert.equal(f.node('reporteError').value, 'Comentarios de la usuaria.');
  assert.equal(f.node('enviarReporte').disabled, false);
  assert.match(f.node('estadoReporte').textContent, /No se pudo obtener/);
});

test('failure to open GitHub does not discard the user comment', () => {
  const f = popupFixture({ creationFails: true }); f.click('enviarReporte');
  assert.deepEqual(f.opened, []);
  assert.equal(f.node('reporteError').value, 'Comentarios de la usuaria.');
  assert.match(f.node('estadoReporte').textContent, /No se pudo abrir GitHub/);
});

test('a missing comment keeps keyboard focus on the description and does not open GitHub', () => {
  const f = popupFixture(); f.node('reporteError').value = ''; f.click('enviarReporte');
  assert.equal(f.document.activeElement, f.node('reporteError'));
  assert.deepEqual(f.opened, []);
});

test('the popup HTML exposes status messages, the debug toggle and its local helper', () => {
  const html = fs.readFileSync(path.join(extension, 'popup/popup.html'), 'utf8');
  assert.match(html, /id="alternarDebug"[^>]*aria-pressed="false"/);
  assert.match(html, /id="compatibilidad"[^>]*role="status"/);
  assert.match(html, /id="estadoReporte"[^>]*role="status"/);
  assert.ok(html.indexOf('src="report.js"') < html.indexOf('src="popup.js"'));
});

test('debug logs are bounded, local to each page and collected only while debug is enabled', () => {
  function boot() {
    const context = { window: {}, console: { log() {}, warn() {}, error() {} }, Date };
    vm.runInNewContext(fs.readFileSync(path.join(extension, 'content/core/kwsr.bootstrap.js'), 'utf8'), context);
    return context.window.KWSR;
  }
  const first = boot(), second = boot();
  first.log('No registrar'); assert.equal(first.getDebugLogs().length, 0);
  first.CFG.debug = true;
  for (let i = 0; i < 130; i++) first.log(`Evento ${i}`);
  assert.equal(first.getDebugLogs().length, 100);
  assert.equal(first.getDebugLogs()[0].msg, 'Evento 30');
  assert.equal(second.getDebugLogs().length, 0);
  first.CFG.debug = false; first.log('No registrar después');
  assert.equal(first.getDebugLogs().at(-1).msg, 'Evento 129');
});
