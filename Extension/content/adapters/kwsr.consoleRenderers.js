// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.consoleRenderers.js
// -----------------------------------------------------------------------------
// Capa de compatibilidad para 3.0.0-beta.
//
// Porta a la extensión comportamientos ya validados en la consola sin hacer
// todavía el refactor estructural, reservado para una versión posterior.
//
// Incluye:
// - YouTube: lectura visual incremental por frases.
// - Flow / THEOplayer: lectura visual incremental por frases.
// - Selectores visuales ya probados para Video.js / Percipio y PlayKit / Kaltura.
//
// La arquitectura de motores por tipo de renderizado queda para otra entrega.
// -----------------------------------------------------------------------------

// PARA UBICARTE
// Lee el texto que va creciendo en YouTube y Flow, evitando repetir lo anterior.
// delta = parte nueva; buffer = texto guardado hasta enviarlo a lectura.
// Ejemplo: "Hola" pasa a "Hola María"; la parte nueva es "María".
//

(() => {
  const KWSR = window.KWSR;
  if (!KWSR || !KWSR.visual || KWSR.consoleRenderers) return;

  const S = KWSR.state;
  const CFG = KWSR.CFG || {};
  const normalize = KWSR.utils?.normalize || ((x) => String(x ?? "").replace(/\s+/g, " ").trim());

  const LIVE_PLATFORMS = new Set(["youtube", "flow"]);

  const RENDERERS = {
    youtube: {
      name: "YouTube captions",
      selectors: [
        ".ytp-caption-window-container .ytp-caption-segment",
        ".captions-text .caption-visual-line .ytp-caption-segment",
        ".captions-text .caption-visual-line"
      ]
    },
    flow: {
      name: "THEOplayer / Flow-like",
      selectors: [
        ".theoplayer-texttracks .theoplayer-texttrack-cue",
        ".theoplayer-texttracks .theoplayer-texttrack-line",
        ".theoplayer-texttracks [class*='texttrack'] [class*='cue']",
        ".theoplayer-texttracks [class*='ttml'] [class*='cue']",
        ".theoplayer-texttracks span"
      ]
    }
  };

  const state = {
    observer: null,
    scheduled: false,
    lastRaw: "",
    buffer: "",
    flushTimer: null,
    activeRenderer: ""
  };

  // Flow puede completar una palabra mientras desplaza la línea anterior.
  // words conserva también lo pendiente que ya salió de pantalla; rawStart
  // ubica la línea visible y sentCount separa las palabras ya entregadas.
  const flow = {
    raw: "", words: [], rawStart: 0, sentCount: 0,
    settleTimer: null, limitTimer: null, since: 0
  };
  const FLOW_READER_REVISION = 2;
  const FLOW_SETTLE_MS = 350;
  const FLOW_LIMIT_MS = 850;

  function clearFlowTimers() {
    clearTimeout(flow.settleTimer);
    clearTimeout(flow.limitTimer);
    flow.settleTimer = flow.limitTimer = null;
  }

  function resetFlow() {
    clearFlowTimers();
    flow.raw = "";
    flow.words = [];
    flow.rawStart = flow.sentCount = 0;
  }

  function cleanFlowText(text) {
    // > y >> son marcas de cambio de hablante que también llegan por partes.
    return normalize(normalize(text).replace(/(^|\s)>+(?=\s|$)/g, " "));
  }

  function flowWordMatches(previous, current, canGrow = false) {
    const before = fp(previous);
    const after = fp(current);
    return before === after || (canGrow && before && after.startsWith(before) && !/[.!?…:;,]$/.test(previous));
  }

  // Alineamos el final anterior con el principio actual. La última palabra
  // anterior puede crecer: «EL DO» y «EL DOLOR» siguen siendo la misma línea.
  // No buscamos coincidencias en mitad del texto nuevo.
  function flowOverlap(previous, current) {
    for (let size = Math.min(previous.length, current.length); size > 0; size--) {
      const start = previous.length - size;
      if (previous.slice(start).every((word, i) => flowWordMatches(word, current[i], size > 1 && i === size - 1))) {
        return start;
      }
    }
    // Una corrección dentro de la misma línea puede no conservar todo el final.
    // Antes preferimos el solapamiento completo, aunque repita la primera palabra.
    if (flowWordMatches(previous[0], current[0], previous.length === 1)) return 0;
    return -1;
  }

  function trimFlowHistory() {
    // Lo ya leído y fuera de pantalla no hace falta para la próxima comparación.
    const count = Math.min(flow.rawStart, flow.sentCount);
    if (!count) return;
    flow.words = flow.words.slice(count);
    flow.rawStart -= count;
    flow.sentCount -= count;
  }

  function flushFlow(reason, completeOnly = false) {
    if (completeOnly) {
      clearTimeout(flow.limitTimer);
      flow.limitTimer = null;
    } else {
      clearFlowTimers();
    }
    if (!S.extensionActiva || S.effectiveFuente !== "visual" || platform() !== "flow" || !KWSR.voice?.shouldReadNow?.()) {
      resetFlow();
      return;
    }
    // Durante escritura continua, la última palabra puede estar incompleta.
    // Enviamos hasta el último espacio; tras una pausa enviamos también el final.
    const end = flow.words.length - (completeOnly ? 1 : 0);
    if (end <= flow.sentCount) return;
    const text = flow.words.slice(flow.sentCount, end).join(" ");
    flow.sentCount = end;
    trimFlowHistory();
    if (CFG.debug) {
      KWSR.log?.(`CONSOLE RENDERER flush ${JSON.stringify({ renderer: RENDERERS.flow.name, revision: FLOW_READER_REVISION, reason, text, pendingMs: Date.now() - flow.since })}`);
    }
    KWSR.voice?.leerTextoAccesible?.(text);
  }

  function pollFlow(picked) {
    const current = cleanFlowText(picked.text);
    if (!current) {
      if (flow.raw) flushFlow("cue-end");
      resetFlow();
      return false;
    }
    if (current === flow.raw) return true;
    const oldWords = wordsOf(flow.raw);
    const newWords = wordsOf(current);
    const overlap = oldWords.length ? flowOverlap(oldWords, newWords) : -1;
    if (oldWords.length && overlap < 0) {
      flushFlow("cue-change");
      resetFlow();
    }
    const start = overlap < 0 ? 0 : flow.rawStart + overlap;
    const updated = [...flow.words.slice(0, start), ...newWords];
    // Si el origen completa una palabra después de haberla leído, repetimos
    // solo desde esa corrección; el prefijo sin cambios no vuelve a salir.
    for (let i = start; i < Math.min(flow.sentCount, updated.length); i++) {
      if (fp(flow.words[i]) !== fp(updated[i])) {
        flow.sentCount = i;
        break;
      }
    }
    flow.words = updated;
    flow.rawStart = start;
    flow.sentCount = Math.min(flow.sentCount, updated.length);
    flow.raw = current;
    trimFlowHistory();
    if (CFG.debug) {
      KWSR.log?.(`CONSOLE RENDERER live ${JSON.stringify({ renderer: picked.renderer, revision: FLOW_READER_REVISION, selector: picked.selector, raw: normalize(picked.text), pending: flow.words.slice(flow.sentCount).join(" ") })}`);
    }
    clearTimeout(flow.settleTimer);
    flow.settleTimer = setTimeout(() => flushFlow("pause"), FLOW_SETTLE_MS);
    // Este reloj no se reinicia con cada letra. Así no esperamos indefinidamente.
    if (!flow.limitTimer) {
      flow.since = Date.now();
      flow.limitTimer = setTimeout(() => flushFlow("continuous", true), FLOW_LIMIT_MS);
    }
    return true;
  }

  const originalStart = KWSR.visual.startVisual?.bind(KWSR.visual);
  const originalStop = KWSR.visual.stopVisualObserver?.bind(KWSR.visual);
  const originalPoll = KWSR.visual.pollVisualTick?.bind(KWSR.visual);
  const originalReselect = KWSR.visual.visualReselectTick?.bind(KWSR.visual);
  const originalReset = KWSR.visual.resetVisualDedupe?.bind(KWSR.visual);

  function platform() {
    return KWSR.platforms?.getPlatform?.() || "generic";
  }

  function wordsOf(text) {
    return normalize(text).split(/\s+/).filter(Boolean);
  }

  function fp(text) {
    return normalize(text)
      .toLowerCase()
      .replace(/[.,;:!?¿¡"“”'’()\[\]{}…]/g, "")
      .trim();
  }

  function isVisible(el) {
    try {
      if (!el || !(el instanceof Element)) return false;
      if (el.closest?.("#kathware-overlay-root,#kathware-overlay-panel,#kw-toast,#kwsr-live-region,#kathware-live-region")) return false;

      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (Number(style.opacity || 1) <= 0.01) return false;

      const r = el.getBoundingClientRect();
      return r.width >= 2 && r.height >= 2;
    } catch {
      return false;
    }
  }

  function looksLikeNoise(el, text) {
    const t = normalize(text);
    if (!t || t.length < 1 || t.length > 500) return true;

    const tag = (el?.tagName || "").toUpperCase();
    if (["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "LABEL", "OPTION"].includes(tag)) return true;

    try {
      if (el.closest?.("button,a,input,select,textarea,[role='button'],[role='slider'],[role='menu'],[role='dialog']")) return true;
    } catch {}

    const sig = `${el?.id || ""} ${el?.className || ""}`.toLowerCase();
    if (/control|settings|menu|tooltip|toast|popup|volume|quality|speed|seek|progress|advert/.test(sig)) return true;

    return /subtítulos desactivados|subtitulos desactivados|opciones de audio|estilo de subtítulos|english \[cc\]|español \(latinoamérica\)/i.test(t);
  }

  function getRendererText(p) {
    const renderer = RENDERERS[p];
    if (!renderer) return { text: "", renderer: "" };

    for (const selector of renderer.selectors) {
      let nodes = [];
      try { nodes = Array.from(document.querySelectorAll(selector)); } catch {}
      if (!nodes.length) continue;

      const parts = [];
      const seen = new Set();

      for (const el of nodes) {
        if (!isVisible(el)) continue;
        const text = normalize(el.innerText || el.textContent || "");
        if (!text || looksLikeNoise(el, text)) continue;

        const key = fp(text);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        parts.push(text);
      }

      if (parts.length) {
        return {
          text: normalize(parts.join(" ")),
          renderer: renderer.name,
          selector
        };
      }
    }

    return { text: "", renderer: renderer.name };
  }

  // Compara el texto anterior con el actual y devuelve solo la parte nueva.
  // Las coincidencias parciales ayudan cuando el sitio desplaza líneas ya mostradas.
  function getDelta(previous, current) {
    previous = normalize(previous);
    current = normalize(current);

    if (!previous) return current;
    if (!current || current === previous) return "";
    if (fp(current) === fp(previous)) return "";

    const prevWords = wordsOf(previous);
    const currWords = wordsOf(current);

    if (current.startsWith(previous)) {
      return normalize(currWords.slice(prevWords.length).join(" "));
    }

    const maxOverlap = Math.min(prevWords.length, currWords.length);

    for (let size = maxOverlap; size >= 2; size--) {
      const prevTail = fp(prevWords.slice(-size).join(" "));

      for (let start = 0; start <= currWords.length - size; start++) {
        const currChunk = fp(currWords.slice(start, start + size).join(" "));
        if (prevTail && prevTail === currChunk) {
          return normalize(currWords.slice(start + size).join(" "));
        }
      }
    }

    if (fp(previous).includes(fp(current))) return "";
    return current;
  }

  function hasHardBoundary(text) {
    return /[.!?…:]\s*$/.test(normalize(text));
  }

  function hasSoftBoundary(text) {
    return /[,;]\s*$/.test(normalize(text));
  }

  function clearFlushTimer() {
    if (state.flushTimer) clearTimeout(state.flushTimer);
    state.flushTimer = null;
  }

  // Envía lo acumulado a la capa de voz y vacía el texto pendiente.
  // Si no hay texto, termina sin anunciar nada. reason explica por qué se envió.
  function flush(reason = "flush") {
    clearFlushTimer();

    const text = normalize(state.buffer);
    state.buffer = "";
    if (!text) return;

    if (CFG.debug) {
      KWSR.log?.("CONSOLE RENDERER flush", {
        renderer: state.activeRenderer,
        reason,
        text
      });
    }

    KWSR.voice?.leerTextoAccesible?.(text);
  }

  // Guarda texto nuevo y decide cuándo enviarlo.
  // Puede salir antes por puntuación o longitud; si no, espera una pausa.
  function queueDelta(delta) {
    delta = normalize(delta);
    if (!delta) return;

    state.buffer = normalize(`${state.buffer} ${delta}`);
    clearFlushTimer();

    const wordCount = wordsOf(state.buffer).length;

    if (hasHardBoundary(state.buffer) && wordCount >= 3) {
      flush("sentence");
      return;
    }

    if (hasSoftBoundary(state.buffer) && state.buffer.length >= 45 && wordCount >= 3) {
      flush("soft");
      return;
    }

    if (state.buffer.length >= 140 && wordCount >= 3) {
      flush("limit");
      return;
    }

    // Cada llegada de texto nuevo reinicia esta espera de 850 milisegundos.
    // Al cumplirse, se lee lo guardado aunque sea una sola palabra, como «Sí».
    state.flushTimer = setTimeout(() => {
      flush("pause");
    }, 850);
  }

  function livePoll() {
    if (!S.extensionActiva) return false;
    if (S.effectiveFuente !== "visual") return false;
    if (!KWSR.voice?.shouldReadNow?.()) return false;

    const p = platform();
    if (!LIVE_PLATFORMS.has(p)) return false;

    const picked = getRendererText(p);
    if (p === "flow") return pollFlow(picked);
    const current = normalize(picked.text);
    state.activeRenderer = picked.renderer || p;

    if (!current) return false;

    const previous = state.lastRaw;
    let delta = getDelta(previous, current);
    state.lastRaw = current;

    if (!delta) return true;

    // Si cambió completamente el subtítulo, terminamos primero la frase anterior.
    if (previous && fp(delta) === fp(current) && state.buffer) {
      flush("cue-change");
    }

    if (CFG.debug) {
      KWSR.log?.("CONSOLE RENDERER live", {
        renderer: state.activeRenderer,
        selector: picked.selector || "",
        raw: current,
        delta
      });
    }

    queueDelta(delta);
    return true;
  }

  function scheduleLivePoll() {
    if (state.scheduled) return;
    state.scheduled = true;

    requestAnimationFrame(() => {
      state.scheduled = false;
      livePoll();
    });
  }

  function installLiveObserver() {
    try { state.observer?.disconnect?.(); } catch {}
    state.observer = null;

    try {
      state.observer = new MutationObserver(() => scheduleLivePoll());
      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
      });
      S.visualObserver = state.observer;
      S.visualObserverActive = true;
    } catch (e) {
      S.visualObserverActive = false;
      if (CFG.debug) KWSR.warn?.("CONSOLE RENDERER observer failed", String(e?.message || e));
    }
  }

  // Cancela la espera y borra el texto pendiente al reiniciar este lector.
  // Así el contenido anterior no se mezcla con una nueva sesión.
  function resetLiveState() {
    resetFlow();
    clearFlushTimer();
    state.lastRaw = "";
    state.buffer = "";
    state.activeRenderer = "";
  }

  // Extiende la lista 2.x con renderizadores ya probados en consola.
  // No cambia la arquitectura: solo suma selectores de compatibilidad.
  const originalPlatformSelectors = KWSR.platforms?.platformSelectors?.bind(KWSR.platforms);
  if (originalPlatformSelectors) {
    KWSR.platforms.platformSelectors = (p) => {
      const base = originalPlatformSelectors(p) || [];

      if (["disney", "netflix", "max", "youtube", "flow", "vix"].includes(p)) {
        return base;
      }

      const compat = [
        ".vjs-text-track-display .vjs-text-track-cue",
        ".vjs-text-track-display .vjs-text-track-cue *",
        ".playkit-subtitles .playkit-subtitle",
        ".playkit-captions .playkit-subtitle",
        ".playkit-subtitle",
        ".theoplayer-texttracks .theoplayer-texttrack-cue",
        ".theoplayer-texttracks .theoplayer-texttrack-line",
        ".theoplayer-texttracks [class*='texttrack'] [class*='cue']"
      ];

      return [...new Set([...compat, ...base])];
    };
  }

  KWSR.visual.startVisual = () => {
    const p = platform();

    if (!LIVE_PLATFORMS.has(p)) {
      resetLiveState();
      return originalStart?.();
    }

    try { originalStop?.(); } catch {}
    resetLiveState();
    S.visualSelectorUsed = `console:${RENDERERS[p]?.name || p}`;
    installLiveObserver();
    livePoll();
    KWSR.overlay?.updateOverlayStatus?.();
  };

  KWSR.visual.stopVisualObserver = () => {
    try { state.observer?.disconnect?.(); } catch {}
    state.observer = null;
    resetLiveState();
    return originalStop?.();
  };

  KWSR.visual.pollVisualTick = (...args) => {
    if (LIVE_PLATFORMS.has(platform())) return livePoll();
    return originalPoll?.(...args);
  };

  KWSR.visual.visualReselectTick = (...args) => {
    if (LIVE_PLATFORMS.has(platform())) return livePoll();
    return originalReselect?.(...args);
  };

  KWSR.visual.resetVisualDedupe = (...args) => {
    resetLiveState();
    return originalReset?.(...args);
  };

  KWSR.consoleRenderers = {
    flowReaderRevision: FLOW_READER_REVISION,
    livePoll,
    flush,
    getRendererText,
    getDelta,
    resetLiveState
  };
})();
