// ====================================================
// KathWare SubtitleReader - Console Stable
// Version: 2.1.1-console-stable
// ====================================================

(() => {
  "use strict";

  const OLD = window.__KATHWARE_SUBTITLE_READER_CONSOLE__;
  if (OLD?.destroy) OLD.destroy();

  const KWSR = {
    version: "2.1.1-console-stable",
    enabled: true,
    readerMode: "lector", // lector | voz | off
    debug: false,

    liveRegion: null,
    visualObserver: null,
    timers: [],

    lastTrackText: "",
    lastVisualRaw: "",
    lastEmittedFp: "",
    lastEmittedAt: 0,

    pendingVisualText: "",
    visualSettleTimer: null,

    visualBuffer: "",
    visualFlushTimer: null,

    visualSpokenContext: "",

    settleMs: 120,
    repeatBlockMs: 4000,
    softFlushMs: 1400,
    emergencyLimit: 140,
    minFlushWords: 4,
    spokenContextLimit: 900,
  };

  const log = (...args) => {
    if (KWSR.debug) console.log("[KWSR]", ...args);
  };

  const normalize = text =>
    String(text || "")
      .replace(/\u200b/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.!?…:;])/g, "$1")
      .trim();

  const fp = text =>
    normalize(text)
      .toLowerCase()
      .replace(/[.,;:!?¿¡"“”'()[\]{}…]/g, "")
      .trim();

  const wordsOf = text =>
    normalize(text).split(/\s+/).filter(Boolean);

  const wordCount = text => wordsOf(text).length;

  function collapseRepeatedText(text) {
    text = normalize(text);
    if (!text) return "";

    const words = text.split(" ");
    if (words.length >= 4 && words.length % 2 === 0) {
      const half = words.length / 2;
      const a = words.slice(0, half).join(" ");
      const b = words.slice(half).join(" ");
      if (fp(a) && fp(a) === fp(b)) return normalize(a);
    }

    return text;
  }

  function createLiveRegion() {
    const live = document.createElement("div");
    live.id = "kwsr-console-live-region";
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");
    live.setAttribute("role", "status");

    Object.assign(live.style, {
      position: "fixed",
      left: "-9999px",
      width: "1px",
      height: "1px",
      overflow: "hidden",
    });

    document.documentElement.appendChild(live);
    KWSR.liveRegion = live;
  }

  function rememberSpoken(text) {
    text = normalize(text);
    if (!text) return;

    KWSR.visualSpokenContext = normalize(`${KWSR.visualSpokenContext} ${text}`);

    if (KWSR.visualSpokenContext.length > KWSR.spokenContextLimit) {
      KWSR.visualSpokenContext = KWSR.visualSpokenContext.slice(
        -KWSR.spokenContextLimit
      );
    }
  }

  function emit(text, source) {
    text = normalize(text);
    if (!KWSR.enabled || !text || KWSR.readerMode === "off") return;

    const currentFp = fp(text);
    const now = Date.now();

    if (
      currentFp === KWSR.lastEmittedFp &&
      now - KWSR.lastEmittedAt < KWSR.repeatBlockMs
    ) {
      return;
    }

    KWSR.lastEmittedFp = currentFp;
    KWSR.lastEmittedAt = now;

    if (KWSR.readerMode === "lector") {
      KWSR.liveRegion.textContent = "";
      setTimeout(() => {
        KWSR.liveRegion.textContent = text;
      }, 25);
    }

    if (KWSR.readerMode === "voz" && "speechSynthesis" in window) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = document.documentElement.lang || "es-ES";
      speechSynthesis.speak(utterance);
    }

    rememberSpoken(text);
    log(`${source}:`, text);
  }

  function isVisible(el) {
    if (!el?.getBoundingClientRect) return false;

    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 8) return false;

    const cs = getComputedStyle(el);
    return (
      cs.display !== "none" &&
      cs.visibility !== "hidden" &&
      Number(cs.opacity) !== 0
    );
  }

  function isBadNode(el) {
    if (!el) return true;

    const tag = (el.tagName || "").toUpperCase();

    if (["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "LABEL"].includes(tag)) {
      return true;
    }

    if (el.closest?.(`
      button,
      a,
      input,
      select,
      textarea,
      [role="button"],
      [role="slider"],
      [role="menu"],
      [role="dialog"],
      .ytp-chrome-bottom,
      .ytp-progress-bar,
      .ytp-tooltip,
      .ytp-popup,
      .ytp-settings-menu
    `)) {
      return true;
    }

    const sig = `${el.id || ""} ${el.className || ""}`.toLowerCase();

    return /control|button|slider|settings|menu|tooltip|toast|popup|volume|quality|speed|seek|progress|ad|advert/.test(sig);
  }

  function isBadText(text) {
  return /control deslizante|barra deslizante|configuración del proyecto|botón|subtítulos desactivados|volumen|velocidad|calidad|audio|shopping|copiar vínculo|información|vistas|hace \d+|reproducir combinación|bahasa indonesia|bahasa melayu|english \[cc\]|español \(latinoamérica\)|opciones de audio|estilo de subtítulos|se reanudó la reproducción|se pausó la reproducción/i.test(text);
}

  function findVideos(root = document, out = new Set()) {
    try {
      root.querySelectorAll("video").forEach(v => out.add(v));
      root.querySelectorAll("*").forEach(el => {
        if (el.shadowRoot) findVideos(el.shadowRoot, out);
      });
    } catch (_) {}

    return [...out];
  }

  function getMainVideo() {
    return findVideos()
      .map(video => {
        const r = video.getBoundingClientRect();
        return { video, area: r.width * r.height };
      })
      .filter(x => x.area > 1000)
      .sort((a, b) => b.area - a.area)[0]?.video || null;
  }

  function pickBestTrack(video) {
    if (!video?.textTracks?.length) return null;

    const tracks = [...video.textTracks].filter(t =>
      ["subtitles", "captions"].includes(t.kind)
    );

    const usable = tracks.find(t => {
      try {
        return t.cues && t.cues.length;
      } catch (_) {
        return false;
      }
    });

    if (usable) {
      try {
        usable.mode = "hidden";
      } catch (_) {}
    }

    return usable || null;
  }

  function readTrack() {
    if (!KWSR.enabled) return false;

    const video = getMainVideo();
    const track = pickBestTrack(video);

    if (!track) return false;

    let text = "";

    try {
      text = normalize([...track.activeCues].map(c => c.text).join(" "));
    } catch (_) {}

    if (!text || text === KWSR.lastTrackText) return !!text;

    KWSR.lastTrackText = text;
    emit(text, "TRACK");

    return true;
  }

  const VISUAL_RENDERERS = [
    {
      name: "YouTube",
      mode: "incrementalTimed",
      stable: [
        "#ytp-caption-window-container",
        ".ytp-caption-window-container",
      ],
      inner: [
        ".ytp-caption-segment",
        ".caption-visual-line",
      ],
    },
    {
      name: "Video.js / Percipio",
      mode: "settled",
      stable: [
        ".vjs-text-track-display",
      ],
      inner: [
        ".vjs-text-track-cue",
        ".vjs-text-track-cue *",
      ],
    },
    {
      name: "Training / LMS generic",
      mode: "incrementalTimed",
      stable: [
        "[class*='caption']",
        "[class*='Caption']",
        "[class*='subtitle']",
        "[class*='Subtitle']",
        "[class*='text-track']",
        "[class*='textTrack']",
        "[data-testid*='caption']",
        "[data-testid*='subtitle']",
        "[aria-live='polite']",
        "[role='status']",
      ],
      inner: [
        "span",
        "div",
        "p",
      ],
    },
    {
      name: "PlayKit / Kaltura",
      mode: "settled",
      stable: [
        ".playkit-subtitles",
        ".playkit-captions",
        ".playkit-subtitle",
      ],
      inner: [
        ".playkit-subtitle",
        ".playkit-subtitles *",
      ],
    },
    {
  name: "Disney / Hive",
  mode: "settled",
  stable: [
    "timed-text-override-region",
    ".timed-text-override-region",
    ".DxcOverlay",
    "DISNEY-WEB-PLAYER",
  ],
  inner: [
    ".hive-subtitle-renderer-wrapper",
    ".hive-subtitle-renderer-line",
    "[class*='subtitle']",
    "[class*='caption']",
    "[class*='timed-text']",
    "span",
    "div",
  ],
},
    {
      name: "THEOplayer / Flow-like",
      mode: "incrementalTimed",
      stable: [
        ".theoplayer-texttracks",
        "[class*='theoplayer'][class*='texttrack']",
      ],
      inner: [
        ".theoplayer-texttracks *",
        "[class*='texttrack']",
      ],
    },
    {
      name: "Netflix-like",
      mode: "settled",
      stable: [
        ".player-timedtext",
        ".player-timedtext-text-container",
        "[data-uia*='subtitle']",
        "[data-uia*='caption']",
      ],
      inner: [
        ".player-timedtext-text",
        ".player-timedtext span",
        "[data-uia*='subtitle'] span",
      ],
    },
  ];

  function getNodeText(el, renderer) {
    if (!el || !isVisible(el) || isBadNode(el)) return "";

    const parts = [];

    for (const sel of renderer.inner) {
      try {
        el.querySelectorAll(sel).forEach(node => {
          if (!isVisible(node) || isBadNode(node)) return;

          const text = normalize(node.innerText || node.textContent);
          if (!text || isBadText(text)) return;

          parts.push(text);
        });
      } catch (_) {}
    }

    const unique = [...new Set(parts)];

    if (unique.length) {
      return collapseRepeatedText(normalize(unique.join(" ")));
    }

    const text = normalize(el.innerText || el.textContent);
    if (!text || isBadText(text)) return "";

    return collapseRepeatedText(text);
  }

// Busca elementos también dentro de shadowRoot.
// Algunas plataformas esconden el reproductor en "cajitas cerradas".
// Si no entramos ahí, SubtitleReader mira la puerta pero no ve los subtítulos.
function queryAllDeep(root, selector, out = []) {
  try {
    root.querySelectorAll(selector).forEach(el => out.push(el));

    root.querySelectorAll("*").forEach(el => {
      if (el.shadowRoot) {
        queryAllDeep(el.shadowRoot, selector, out);
      }
    });
  } catch (_) {}

  return out;
}
  
function pickVisual() {
    const candidates = [];
    const isYouTube = location.hostname.includes("youtube.com");

    for (const renderer of VISUAL_RENDERERS) {
      if (isYouTube && renderer.name !== "YouTube") continue;

      for (const sel of renderer.stable) {
        try {
          queryAllDeep(document, sel).forEach(el => {
            const text = getNodeText(el, renderer);
            if (!text) return;
            if (text.length < 2 || text.length > 600) return;

            const r = el.getBoundingClientRect();

            let score = Math.min(text.length, 180);
            score += r.bottom > window.innerHeight * 0.45 ? 50 : 0;
            score += renderer.name === "Training / LMS generic" ? 20 : 90;

            candidates.push({ el, renderer, text, score, selector: sel });
          });
        } catch (_) {}
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  }

  function hasHardBoundary(text) {
    return /[.!?…:]\s*$/.test(normalize(text));
  }

  function hasSoftBoundary(text) {
    return /[,;]\s*$/.test(normalize(text));
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

    if (fp(previous).includes(fp(current))) {
      return "";
    }

    return current;
  }

  function removeAlreadySpoken(delta) {
    delta = normalize(delta);
    if (!delta) return "";

    const context = normalize(`${KWSR.visualSpokenContext} ${KWSR.visualBuffer}`);
    if (!context) return delta;

    if (fp(context).includes(fp(delta))) {
      return "";
    }

    const deltaWords = wordsOf(delta);

    for (let cut = 1; cut < deltaWords.length; cut++) {
      const candidate = normalize(deltaWords.slice(cut).join(" "));
      if (!candidate) continue;

      if (!fp(context).includes(fp(candidate))) {
        return candidate;
      }
    }

    return delta;
  }

  function flushVisual(reason = "flush") {
    clearTimeout(KWSR.visualFlushTimer);
    KWSR.visualFlushTimer = null;

    const text = normalize(KWSR.visualBuffer);
    KWSR.visualBuffer = "";

    if (!text) return;

    emit(text, `VISUAL:${reason}`);
  }

  function queueVisualDelta(delta) {
    delta = removeAlreadySpoken(delta);
    if (!delta) return;

    KWSR.visualBuffer = normalize(`${KWSR.visualBuffer} ${delta}`);

    clearTimeout(KWSR.visualFlushTimer);

    const words = wordCount(KWSR.visualBuffer);

    if (hasHardBoundary(KWSR.visualBuffer) && words >= 3) {
      flushVisual("sentence");
      return;
    }

    if (
      hasSoftBoundary(KWSR.visualBuffer) &&
      KWSR.visualBuffer.length >= 45 &&
      words >= KWSR.minFlushWords
    ) {
      flushVisual("soft");
      return;
    }

    if (
      KWSR.visualBuffer.length >= KWSR.emergencyLimit &&
      words >= KWSR.minFlushWords
    ) {
      flushVisual("limit");
      return;
    }

    KWSR.visualFlushTimer = setTimeout(() => {
      if (wordCount(KWSR.visualBuffer) >= KWSR.minFlushWords) {
        flushVisual("pause");
      }
    }, KWSR.softFlushMs);
  }

  function handleSettledVisual(current, picked) {
    clearTimeout(KWSR.visualSettleTimer);
    KWSR.pendingVisualText = current;

    KWSR.visualSettleTimer = setTimeout(() => {
      const text = normalize(KWSR.pendingVisualText);
      if (!text) return;

      if (text === KWSR.lastVisualRaw || fp(text) === fp(KWSR.lastVisualRaw)) {
        return;
      }

      KWSR.lastVisualRaw = text;

      log(`VISUAL RAW (${picked.renderer.name}):`, text);
      emit(text, `VISUAL:${picked.renderer.name}`);
    }, KWSR.settleMs);
  }

  function handleIncrementalVisual(current, picked) {
    const previous = KWSR.lastVisualRaw;
    let delta = getDelta(previous, current);

    KWSR.lastVisualRaw = current;

    if (!delta) return true;

    if (previous && fp(delta) === fp(current)) {
      log("VISUAL DELTA descartado por repetición completa:", delta);
      return true;
    }

    delta = removeAlreadySpoken(delta);

    if (!delta) return true;

    log(`VISUAL RAW (${picked.renderer.name}):`, current);
    log("VISUAL DELTA:", delta);

    queueVisualDelta(delta);

    return true;
  }

  function readVisual() {
    if (!KWSR.enabled) return false;

    const picked = pickVisual();
    if (!picked) return false;

    const current = normalize(picked.text);
    if (!current) return false;

    if (picked.renderer.mode === "settled") {
      handleSettledVisual(current, picked);
      return true;
    }

    handleIncrementalVisual(current, picked);
    return true;
  }

  function tick() {
    if (!KWSR.enabled) return;

    const trackWorked = readTrack();

    if (!trackWorked) {
      readVisual();
    }
  }

  function resetReadingState() {
    KWSR.lastTrackText = "";
    KWSR.lastVisualRaw = "";
    KWSR.pendingVisualText = "";
    KWSR.visualBuffer = "";
    KWSR.visualSpokenContext = "";

    clearTimeout(KWSR.visualSettleTimer);
    clearTimeout(KWSR.visualFlushTimer);

    KWSR.visualSettleTimer = null;
    KWSR.visualFlushTimer = null;
  }

  function bindHotkeys() {
    KWSR.keyHandler = e => {
      if (!e.shiftKey || !e.altKey) return;

      const key = e.key.toLowerCase();

      if (key === "k") {
        KWSR.enabled = !KWSR.enabled;
        resetReadingState();
        log(KWSR.enabled ? "Activado" : "Desactivado");
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (key === "l") {
        KWSR.readerMode =
          KWSR.readerMode === "lector" ? "voz" :
          KWSR.readerMode === "voz" ? "off" :
          "lector";

        resetReadingState();
        log("Salida:", KWSR.readerMode);
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (key === "d") {
        KWSR.debug = !KWSR.debug;
        console.log("[KWSR] Debug:", KWSR.debug ? "ON" : "OFF");
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (key === "o") {
        console.log("[KWSR] Estado:", {
          version: KWSR.version,
          enabled: KWSR.enabled,
          readerMode: KWSR.readerMode,
          debug: KWSR.debug,
          lastTrackText: KWSR.lastTrackText,
          lastVisualRaw: KWSR.lastVisualRaw,
          visualBuffer: KWSR.visualBuffer,
          visualSpokenContext: KWSR.visualSpokenContext,
          pickedVisual: pickVisual()?.renderer?.name || null,
        });

        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    };

    document.addEventListener("keydown", KWSR.keyHandler, true);
  }

  function installObserver() {
    const obs = new MutationObserver(() => {
      if (KWSR.enabled) readVisual();
    });

    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    KWSR.visualObserver = obs;
  }

  function setTimer(fn, ms) {
    const id = setInterval(fn, ms);
    KWSR.timers.push(id);
  }

  function destroy() {
    KWSR.timers.forEach(clearInterval);
    KWSR.timers.length = 0;

    clearTimeout(KWSR.visualSettleTimer);
    clearTimeout(KWSR.visualFlushTimer);

    try {
      KWSR.visualObserver?.disconnect();
    } catch (_) {}

    try {
      document.removeEventListener("keydown", KWSR.keyHandler, true);
    } catch (_) {}

    try {
      KWSR.liveRegion?.remove();
    } catch (_) {}

    log("Destruido");
  }

  createLiveRegion();
  bindHotkeys();
  installObserver();
  setTimer(tick, 650);

  window.__KATHWARE_SUBTITLE_READER_CONSOLE__ = {
    KWSR,
    destroy,
    tick,
    readTrack,
    readVisual,
    flushVisual,
    pickVisual,
  };

  console.log("[KWSR] Iniciado", KWSR.version);
  console.log("[KWSR] Atajos: Alt+Shift+K ON/OFF | Alt+Shift+L lector/voz/off | Alt+Shift+O estado | Alt+Shift+D debug");
})();
