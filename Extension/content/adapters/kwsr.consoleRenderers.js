// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.consoleRenderers.js
// -----------------------------------------------------------------------------
// Capa de compatibilidad para 2.2.0-beta.
//
// Porta a la extensión comportamientos ya validados en la consola sin hacer
// todavía el refactor estructural previsto para 3.0.0.
//
// Incluye:
// - YouTube: lectura visual incremental por frases.
// - Flow / THEOplayer: lectura visual incremental por frases.
// - Selectores visuales ya probados para Video.js / Percipio y PlayKit / Kaltura.
//
// La arquitectura de motores por tipo de renderizado queda para 3.0.0.
// -----------------------------------------------------------------------------

(() => {
  const KWSR = window.KWSR;
  if (!KWSR || !KWSR.visual || KWSR.consoleRenderers) return;

  const S = KWSR.state;
  const CFG = KWSR.CFG || {};
  const normalize = KWSR.utils?.normalize || ((x) => String(x ?? "").replace(/\s+/g, " ").trim());

  KWSR.version = "2.2.0-beta";

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
    const current = normalize(picked.text);
    state.activeRenderer = picked.renderer || p;

    if (!current) return false;

    const previous = state.lastRaw;
    let delta = getDelta(previous, current);
    state.lastRaw = current;

    if (!delta) return true;

    // Si cambió completamente el cue, terminamos primero la frase anterior.
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

  function resetLiveState() {
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
    livePoll,
    flush,
    getRendererText,
    getDelta,
    resetLiveState
  };
})();
