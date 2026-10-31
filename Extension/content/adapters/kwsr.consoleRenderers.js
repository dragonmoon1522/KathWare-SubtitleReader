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

  // YouTube conserva la frase pendiente para actualizar palabras y puntuación
  // antes de leerla; los índices separan el texto visible del que ya se entregó.
  const state = {
    observer: null,
    scheduled: false,
    lastRaw: "",
    words: [], rawStart: 0, sentCount: 0,
    flushTimer: null,
    limitTimer: null, limitDue: null, since: 0,
    gapTimer: null, emptySince: null
  };
  const YOUTUBE_READER_REVISION = 1;
  const YOUTUBE_PAUSE_MS = 850;
  const YOUTUBE_LIMIT_MS = 850;
  const YOUTUBE_GAP_MS = 250;

  // Flow puede completar una palabra mientras desplaza la línea anterior.
  // words conserva también lo pendiente que ya salió de pantalla; rawStart
  // ubica la línea visible y sentCount separa las palabras ya entregadas.
  const flow = {
    raw: "", words: [], rawStart: 0, sentCount: 0,
    settleTimer: null, limitTimer: null, limitDue: null, since: 0,
    gapTimer: null, emptySince: null
  };
  const FLOW_READER_REVISION = 3;
  const FLOW_SETTLE_MS = 350;
  const FLOW_LIMIT_MS = 850;
  const FLOW_GAP_MS = 250;

  function logFlow(event, data) {
    if (CFG.debug) {
      KWSR.log?.(`CONSOLE RENDERER ${event} ${JSON.stringify({ renderer: RENDERERS.flow.name, revision: FLOW_READER_REVISION, ...data })}`);
    }
  }

  function clearFlowTimers(preserveLimit = false) {
    clearTimeout(flow.settleTimer);
    clearTimeout(flow.limitTimer);
    flow.settleTimer = flow.limitTimer = null;
    if (!preserveLimit) flow.limitDue = null;
  }

  function resetFlow(reason = "manual") {
    if (flow.raw) logFlow("reset", { reason, raw: flow.raw, pending: flow.words.slice(flow.sentCount).join(" ") });
    clearFlowTimers();
    clearTimeout(flow.gapTimer);
    flow.gapTimer = flow.emptySince = null;
    flow.raw = "";
    flow.words = [];
    flow.rawStart = flow.sentCount = 0;
  }

  function cleanFlowText(text) {
    // > y >> son marcas de cambio de hablante que también llegan por partes.
    return normalize(normalize(text).replace(/(^|\s)>+(?=\s|$)/g, " "));
  }

  function captionWordMatches(previous, current, canGrow = false) {
    const before = fp(previous);
    const after = fp(current);
    return before === after || (canGrow && before && after.startsWith(before) && !/[.!?…:;,]$/.test(previous));
  }

  // Alineamos el final anterior con el principio actual. La última palabra
  // anterior puede crecer: «EL DO» y «EL DOLOR» siguen siendo la misma línea.
  // No buscamos coincidencias en mitad del texto nuevo.
  function captionOverlap(previous, current) {
    for (let size = Math.min(previous.length, current.length); size > 0; size--) {
      const start = previous.length - size;
      if (previous.slice(start).every((word, i) => captionWordMatches(word, current[i], size > 1 && i === size - 1))) {
        return start;
      }
    }
    // Una corrección dentro de la misma línea puede no conservar todo el final.
    // Antes preferimos el solapamiento completo, aunque repita la primera palabra.
    if (captionWordMatches(previous[0], current[0], previous.length === 1)) return 0;
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
      flow.limitTimer = flow.limitDue = null;
    } else {
      clearFlowTimers();
    }
    if (!S.extensionActiva || S.effectiveFuente !== "visual" || platform() !== "flow" || !KWSR.voice?.shouldReadNow?.()) {
      resetFlow("inactive");
      return;
    }
    // Durante escritura continua, la última palabra puede estar incompleta.
    // Enviamos hasta el último espacio; tras una pausa enviamos también el final.
    const end = flow.words.length - (completeOnly ? 1 : 0);
    if (end <= flow.sentCount) return;
    const text = flow.words.slice(flow.sentCount, end).join(" ");
    flow.sentCount = end;
    trimFlowHistory();
    logFlow("flush", { reason, text, pendingMs: Date.now() - flow.since });
    try { KWSR.flowTiming?.noteOutput?.("adapter", text); } catch {}
    KWSR.voice?.leerTextoAccesible?.(text);
  }

  function queueFlowDelivery() {
    clearTimeout(flow.settleTimer);
    flow.settleTimer = null;
    if (flow.sentCount >= flow.words.length) {
      clearFlowTimers();
      return;
    }
    flow.settleTimer = setTimeout(() => flushFlow("pause"), FLOW_SETTLE_MS);
    if (flow.limitTimer === null) {
      // Un recambio breve del DOM suspende la entrega, pero no reinicia el
      // plazo de 850 ms que ya estaba corriendo para estas palabras.
      if (flow.limitDue === null) {
        flow.since = Date.now();
        flow.limitDue = flow.since + FLOW_LIMIT_MS;
      }
      flow.limitTimer = setTimeout(() => flushFlow("continuous", true), Math.max(0, flow.limitDue - Date.now()));
    }
  }

  function pollFlow(picked) {
    const current = cleanFlowText(picked.text);
    if (!current) {
      // El reproductor puede retirar los nodos antes de colocar sus reemplazos.
      // Confirmamos que el vacío persiste antes de olvidar lo ya leído.
      if (flow.raw && flow.emptySince === null) {
        clearFlowTimers(true);
        flow.emptySince = Date.now();
        logFlow("gap", { phase: "start", raw: flow.raw });
        flow.gapTimer = setTimeout(() => {
          flow.gapTimer = null;
          if (!S.extensionActiva || S.effectiveFuente !== "visual" || platform() !== "flow" || !KWSR.voice?.shouldReadNow?.()) {
            resetFlow("inactive");
            return;
          }
          // Releer el DOM evita confirmar un vacío si el texto volvió antes
          // que el observador o el sondeo pudieran avisarnos.
          const next = getRendererText("flow");
          if (cleanFlowText(next.text)) {
            pollFlow(next);
            return;
          }
          logFlow("gap", { phase: "confirmed", gapMs: Date.now() - flow.emptySince });
          flushFlow("cue-end");
          resetFlow("empty-gap");
        }, FLOW_GAP_MS);
      }
      return false;
    }
    const hadGap = flow.emptySince !== null;
    if (hadGap) {
      clearTimeout(flow.gapTimer);
      flow.gapTimer = null;
      logFlow("gap", { phase: "restored", gapMs: Date.now() - flow.emptySince });
      flow.emptySince = null;
    }
    if (current === flow.raw) {
      if (hadGap) queueFlowDelivery();
      return true;
    }
    const oldWords = wordsOf(flow.raw);
    const newWords = wordsOf(current);
    const overlap = oldWords.length ? captionOverlap(oldWords, newWords) : -1;
    if (oldWords.length && overlap < 0) {
      flushFlow("cue-change");
      resetFlow("cue-change");
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
    logFlow("live", { selector: picked.selector, raw: normalize(picked.text), pending: flow.words.slice(flow.sentCount).join(" ") });
    queueFlowDelivery();
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
        // En YouTube dos segmentos distintos pueden repetir una palabra de
        // forma intencional («arriba, abajo, arriba»), o contener solo una coma.
        if (p !== "youtube" && (!key || seen.has(key))) continue;
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

  function cleanYouTubeText(text) {
    return normalize(normalize(text).replace(/\s+([,.;:!?…])/g, "$1").replace(/^[,.;:!?…]+\s*/, ""));
  }

  function logYouTube(event, data) {
    if (CFG.debug) {
      KWSR.log?.(`CONSOLE RENDERER ${event} ${JSON.stringify({ renderer: RENDERERS.youtube.name, revision: YOUTUBE_READER_REVISION, ...data })}`);
    }
  }

  // Se conserva esta utilidad de diagnóstico. La lectura usa las palabras
  // pendientes completas, para poder corregirlas sin concatenar sus versiones.
  function getDelta(previous, current) {
    previous = cleanYouTubeText(previous);
    current = cleanYouTubeText(current);
    if (!previous) return current;
    if (!current || current === previous) return "";
    const prev = wordsOf(previous), curr = wordsOf(current);
    const start = captionOverlap(prev, curr);
    if (start < 0) return current;
    const count = Math.min(prev.length - start, curr.length);
    for (let i = 0; i < count; i++) {
      if (prev[start + i] !== curr[i]) return curr.slice(i).join(" ");
    }
    return curr.slice(count).join(" ");
  }

  function clearFlushTimer(preserveLimit = false) {
    clearTimeout(state.flushTimer);
    clearTimeout(state.limitTimer);
    state.flushTimer = state.limitTimer = null;
    if (!preserveLimit) state.limitDue = null;
  }

  function resetYouTube(reason = "manual") {
    if (state.lastRaw) logYouTube("reset", { reason });
    clearFlushTimer();
    clearTimeout(state.gapTimer);
    state.gapTimer = state.emptySince = null;
    state.lastRaw = "";
    state.words = [];
    state.rawStart = state.sentCount = 0;
  }

  function trimYouTubeHistory() {
    const count = Math.min(state.rawStart, state.sentCount);
    if (!count) return;
    state.words = state.words.slice(count);
    state.rawStart -= count;
    state.sentCount -= count;
  }

  // Entrega un prefijo de las palabras pendientes. Un plazo continuo conserva
  // el temporizador de pausa para que la última palabra no quede sin entregar.
  function flush(reason = "flush", end = state.words.length) {
    if (reason === "continuous") {
      clearTimeout(state.limitTimer);
      state.limitTimer = state.limitDue = null;
    } else {
      clearFlushTimer();
    }
    if (!S.extensionActiva || S.effectiveFuente !== "visual" || platform() !== "youtube" || !KWSR.voice?.shouldReadNow?.()) {
      resetYouTube("inactive");
      return;
    }
    if (end <= state.sentCount) return;
    const text = cleanYouTubeText(state.words.slice(state.sentCount, end).join(" "));
    state.sentCount = end;
    trimYouTubeHistory();
    if (!text) return;
    logYouTube("flush", { reason, text, pendingMs: Date.now() - state.since });
    KWSR.voice?.leerTextoAccesible?.(text);
  }

  function youtubeBoundary() {
    let boundary = null;
    for (let i = state.sentCount; i < state.words.length; i++) {
      const word = state.words[i];
      const length = state.words.slice(state.sentCount, i + 1).join(" ").length;
      if (/[.!?…:]["”’')]*$/.test(word)) {
        boundary = { end: i + 1, reason: "sentence" };
      } else if (/[,;]["”’')]*$/.test(word) && length >= 45 && i - state.sentCount >= 2) {
        boundary = { end: i + 1, reason: "soft" };
      }
      if (length >= 140 && i - state.sentCount >= 2) {
        // Preferir una pausa natural; con texto continuo, no cortar la última
        // palabra visible porque todavía puede estar en formación.
        return boundary || (i < state.words.length - 1 ? { end: i + 1, reason: "limit" } : null);
      }
    }
    return boundary;
  }

  function queueYouTubeDelivery() {
    clearTimeout(state.flushTimer);
    state.flushTimer = null;
    if (state.sentCount < state.words.length && state.limitDue === null) state.since = Date.now();
    const boundary = youtubeBoundary();
    if (boundary) flush(boundary.reason, boundary.end);
    if (state.sentCount >= state.words.length) return;
    state.flushTimer = setTimeout(() => flush("pause"), YOUTUBE_PAUSE_MS);
    // Este límite se inicia con la primera palabra pendiente y no se reinicia
    // al llegar más palabras. La pausa por sí sola podía demorar toda la frase.
    if (state.limitTimer === null) {
      if (state.limitDue === null) {
        state.since = Date.now();
        state.limitDue = state.since + YOUTUBE_LIMIT_MS;
      }
      state.limitTimer = setTimeout(() => flush("continuous", state.words.length - 1), Math.max(0, state.limitDue - Date.now()));
    }
  }

  function pollYouTube(picked) {
    const current = cleanYouTubeText(picked.text);
    if (!current) {
      if (state.lastRaw && state.emptySince === null) {
        clearFlushTimer(true);
        state.emptySince = Date.now();
        logYouTube("gap", { phase: "start" });
        state.gapTimer = setTimeout(() => {
          state.gapTimer = null;
          if (!S.extensionActiva || S.effectiveFuente !== "visual" || platform() !== "youtube" || !KWSR.voice?.shouldReadNow?.()) {
            resetYouTube("inactive");
            return;
          }
          const next = getRendererText("youtube");
          if (cleanYouTubeText(next.text)) return pollYouTube(next);
          logYouTube("gap", { phase: "confirmed", gapMs: Date.now() - state.emptySince });
          flush("cue-end");
          resetYouTube("empty-gap");
        }, YOUTUBE_GAP_MS);
      }
      return false;
    }
    const hadGap = state.emptySince !== null;
    if (hadGap) {
      clearTimeout(state.gapTimer);
      state.gapTimer = null;
      logYouTube("gap", { phase: "restored", gapMs: Date.now() - state.emptySince });
      state.emptySince = null;
    }
    if (current === state.lastRaw) {
      if (hadGap) queueYouTubeDelivery();
      return true;
    }
    const prev = wordsOf(state.lastRaw), curr = wordsOf(current);
    const overlap = prev.length ? captionOverlap(prev, curr) : -1;
    if (prev.length && overlap < 0) {
      flush("cue-change");
      resetYouTube("cue-change");
    }
    const start = overlap < 0 ? 0 : state.rawStart + overlap;
    const updated = [...state.words.slice(0, start), ...curr];
    for (let i = start; i < Math.min(state.sentCount, updated.length); i++) {
      if (fp(state.words[i]) !== fp(updated[i])) {
        state.sentCount = i;
        break;
      }
    }
    state.words = updated;
    state.rawStart = start;
    state.sentCount = Math.min(state.sentCount, updated.length);
    state.lastRaw = current;
    trimYouTubeHistory();
    logYouTube("live", { selector: picked.selector || "", raw: normalize(picked.text), pending: state.words.slice(state.sentCount).join(" ") });
    queueYouTubeDelivery();
    return true;
  }

  function livePoll() {
    if (!S.extensionActiva || S.effectiveFuente !== "visual" || !KWSR.voice?.shouldReadNow?.()) return false;
    const p = platform();
    if (!LIVE_PLATFORMS.has(p)) return false;
    const picked = getRendererText(p);
    return p === "flow" ? pollFlow(picked) : pollYouTube(picked);
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
  function resetLiveState(reason = "manual") {
    resetFlow(reason);
    resetYouTube(reason);
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
      resetLiveState("platform-change");
      return originalStart?.();
    }

    try { originalStop?.(); } catch {}
    resetLiveState("start");
    S.visualSelectorUsed = `console:${RENDERERS[p]?.name || p}`;
    installLiveObserver();
    livePoll();
    KWSR.overlay?.updateOverlayStatus?.();
  };

  KWSR.visual.stopVisualObserver = () => {
    try { state.observer?.disconnect?.(); } catch {}
    state.observer = null;
    resetLiveState("stop");
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
    resetLiveState("dedupe-reset");
    return originalReset?.(...args);
  };

  KWSR.consoleRenderers = {
    flowReaderRevision: FLOW_READER_REVISION,
    youtubeReaderRevision: YOUTUBE_READER_REVISION,
    livePoll,
    flush,
    getRendererText,
    getDelta,
    resetLiveState
  };
})();
