// ====================================================
// KathWare SubtitleReader - Console Integrated
// Version: 2.1.3-console-integrated
// Consola de prueba con funciones cercanas a la extensión:
// - lectura de subtítulos
// - anuncios accesibles de estado
// - panel básico
// - controles de video
// - motores por tipo de renderizador/contenedor
// ====================================================

(() => {
  "use strict";

  const OLD = window.__KATHWARE_SUBTITLE_READER_CONSOLE__;
  if (OLD?.destroy) OLD.destroy();

  const KWSR = {
    version: "2.1.2-console-integrated",

    enabled: true,
    readerMode: "lector", // lector | voz | off
    debug: false,

    liveRegion: null,
    statusRegion: null,
    panel: null,
    visualObserver: null,
    keyHandler: null,
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
    rollingSettleMs: 750,
    repeatBlockMs: 4000,

    softFlushMs: 1400,
    liveFlushMs: 850,

    emergencyLimit: 140,
    minFlushWords: 4,
    liveMinWords: 3,

    spokenContextLimit: 900,
  };

  const log = (...args) => {
    if (KWSR.debug) console.log("[KWSR]", ...args);
  };

  const normalize = text =>
    String(text || "")
      .replace(/\u200b/g, "")
      .replace(/>>+/g, " ")
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

  function createLiveRegions() {
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

    const status = document.createElement("div");
    status.id = "kwsr-console-status-region";
    status.setAttribute("aria-live", "assertive");
    status.setAttribute("aria-atomic", "true");
    status.setAttribute("role", "status");

    Object.assign(status.style, {
      position: "fixed",
      left: "-9999px",
      width: "1px",
      height: "1px",
      overflow: "hidden",
    });

    document.documentElement.appendChild(live);
    document.documentElement.appendChild(status);

    KWSR.liveRegion = live;
    KWSR.statusRegion = status;
  }

  function speakThroughLiveRegion(region, text) {
    if (!region) return;
    region.textContent = "";
    setTimeout(() => {
      region.textContent = normalize(text);
    }, 25);
  }

  function announceStatus(text) {
    text = normalize(text);
    if (!text) return;

    speakThroughLiveRegion(KWSR.statusRegion, text);
    log(text);
    updatePanel();
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
      speakThroughLiveRegion(KWSR.liveRegion, text);
    }

    if (KWSR.readerMode === "voz" && "speechSynthesis" in window) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = document.documentElement.lang || "es-ES";
      speechSynthesis.speak(utterance);
    }

    rememberSpoken(text);
    log(`${source}:`, text);
    updatePanel(text, source);
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

  function queryAllDeep(root, selector, out = []) {
    try {
      root.querySelectorAll(selector).forEach(el => out.push(el));

      root.querySelectorAll("*").forEach(el => {
        if (el.shadowRoot) queryAllDeep(el.shadowRoot, selector, out);
      });
    } catch (_) {}

    return out;
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
        return t.activeCues && t.activeCues.length;
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
    emit(text, "STANDARD:textTracks");

    return true;
  }

  const VISUAL_RENDERERS = [
    {
      name: "YouTube captions",
      mode: "liveIncremental",
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
      name: "THEOplayer / Flow-like",
      mode: "liveIncremental",
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
      name: "Netflix-like renderer",
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
    {
      name: "Generic caption container",
      mode: "liveIncremental",
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

  function pickVisual() {
    const candidates = [];
    const isYouTube = location.hostname.includes("youtube.com");

    for (const renderer of VISUAL_RENDERERS) {
      if (isYouTube && renderer.name !== "YouTube captions") continue;

      for (const sel of renderer.stable) {
        try {
          queryAllDeep(document, sel).forEach(el => {
            const text = getNodeText(el, renderer);
            if (!text) return;
            if (text.length < 2 || text.length > 700) return;

            const r = el.getBoundingClientRect();

            let score = Math.min(text.length, 180);
            score += r.bottom > window.innerHeight * 0.45 ? 50 : 0;
            score += renderer.name === "Generic caption container" ? 20 : 90;

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

    if (fp(previous).includes(fp(current))) return "";

    return current;
  }

  function removeAlreadySpoken(delta) {
    delta = normalize(delta);
    if (!delta) return "";

    const context = normalize(`${KWSR.visualSpokenContext} ${KWSR.visualBuffer}`);
    if (!context) return delta;

    if (fp(context).includes(fp(delta))) return "";

    const deltaWords = wordsOf(delta);

    for (let cut = 1; cut < deltaWords.length; cut++) {
      const candidate = normalize(deltaWords.slice(cut).join(" "));
      if (!candidate) continue;

      if (!fp(context).includes(fp(candidate))) return candidate;
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

  function queueVisualDelta(delta, rendererName = "") {
    delta = normalize(delta);
    if (!delta) return;

    const isLiveRenderer =
      rendererName === "YouTube captions" ||
      rendererName === "THEOplayer / Flow-like" ||
      rendererName === "Generic caption container";

    if (!isLiveRenderer) {
      delta = removeAlreadySpoken(delta);
    }

    if (!delta) return;

    const flushMs = isLiveRenderer ? KWSR.liveFlushMs : KWSR.softFlushMs;
    const minWords = isLiveRenderer ? KWSR.liveMinWords : KWSR.minFlushWords;

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
      words >= minWords
    ) {
      flushVisual("soft");
      return;
    }

    if (
      KWSR.visualBuffer.length >= KWSR.emergencyLimit &&
      words >= minWords
    ) {
      flushVisual("limit");
      return;
    }

    KWSR.visualFlushTimer = setTimeout(() => {
      if (wordCount(KWSR.visualBuffer) >= minWords) {
        flushVisual("pause");
      }
    }, flushMs);
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

      const clean = removeAlreadySpoken(text);
      if (!clean) return;

      log(`VISUAL RAW (${picked.renderer.name}):`, text);
      emit(clean, `VISUAL:${picked.renderer.name}`);
    }, KWSR.settleMs);
  }

  function handleLiveIncrementalVisual(current, picked) {
    const previous = KWSR.lastVisualRaw;
    let delta = getDelta(previous, current);

    KWSR.lastVisualRaw = current;

    if (!delta) return true;

    if (
      previous &&
      fp(delta) === fp(current) &&
      fp(previous).includes(fp(current))
    ) {
      log("VISUAL DELTA descartado por repetición completa:", delta);
      return true;
    }

    log(`VISUAL RAW (${picked.renderer.name}):`, current);
    log("VISUAL DELTA:", delta);

    queueVisualDelta(delta, picked.renderer.name);

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

    handleLiveIncrementalVisual(current, picked);
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

  function restartEngine() {
  resetReadingState();

  try {
    speechSynthesis?.cancel?.();
  } catch (_) {}

  // Fuerza una nueva detección inmediatamente
  tick();

  announceStatus("Motor reiniciado");

  if (KWSR.debug) {
    console.log("[KWSR] Motor reiniciado");
    console.log(getState());
  }
}
  
  

function setEnabled(value) {
    KWSR.enabled = Boolean(value);
    resetReadingState();
    announceStatus(KWSR.enabled ? "SubtitleReader activado" : "SubtitleReader desactivado");
  }

  function cycleReaderMode() {
    KWSR.readerMode =
      KWSR.readerMode === "lector" ? "voz" :
      KWSR.readerMode === "voz" ? "off" :
      "lector";

    resetReadingState();

    const label =
      KWSR.readerMode === "lector" ? "lector de pantalla" :
      KWSR.readerMode === "voz" ? "voz del navegador" :
      "silencio";

    announceStatus(`Salida: ${label}`);
  }

  function toggleDebug() {
    KWSR.debug = !KWSR.debug;
    announceStatus(`Debug ${KWSR.debug ? "activado" : "desactivado"}`);
    console.log("[KWSR] Debug:", KWSR.debug ? "ON" : "OFF");
  }

  function getState() {
    return {
      version: KWSR.version,
      enabled: KWSR.enabled,
      readerMode: KWSR.readerMode,
      debug: KWSR.debug,
      lastTrackText: KWSR.lastTrackText,
      lastVisualRaw: KWSR.lastVisualRaw,
      visualBuffer: KWSR.visualBuffer,
      visualSpokenContext: KWSR.visualSpokenContext,
      pickedVisual: pickVisual()?.renderer?.name || null,
      mainVideo: !!getMainVideo(),
    };
  }

  function announceState() {
    const picked = pickVisual();
    const video = getMainVideo();

    const mode =
      KWSR.readerMode === "lector" ? "lector de pantalla" :
      KWSR.readerMode === "voz" ? "voz del navegador" :
      "silencio";

    const status = [
      `KathWare SubtitleReader ${KWSR.enabled ? "activado" : "desactivado"}`,
      `Salida: ${mode}`,
      picked ? `Renderizador: ${picked.renderer.name}` : "Sin renderizador visual detectado",
      video ? "Video detectado" : "Video no detectado",
      KWSR.debug ? "Debug activado" : "Debug desactivado",
    ].join(". ");

    console.log("[KWSR] Estado:", getState());
    announceStatus(status);
  }

  function playPauseVideo() {
    const video = getMainVideo();
    if (!video) {
      announceStatus("No se encontró video principal");
      return;
    }

    if (video.paused) {
      video.play()
        .then(() => announceStatus("Reproducción iniciada"))
        .catch(() => announceStatus("No se pudo iniciar la reproducción"));
    } else {
      video.pause();
      announceStatus("Reproducción pausada");
    }
  }

  function toggleMute() {
    const video = getMainVideo();
    if (!video) {
      announceStatus("No se encontró video principal");
      return;
    }

    video.muted = !video.muted;
    announceStatus(video.muted ? "Video silenciado" : "Video con sonido");
  }

  function seekVideo(seconds) {
    const video = getMainVideo();
    if (!video) {
      announceStatus("No se encontró video principal");
      return;
    }

    try {
      video.currentTime = Math.max(0, video.currentTime + seconds);
      announceStatus(seconds > 0 ? "Avanzando" : "Retrocediendo");
    } catch (_) {
      announceStatus("No se pudo cambiar la posición del video");
    }
  }

  function toggleFullscreen() {
    const video = getMainVideo();
    const target =
      video?.closest?.("[class*='player'], [class*='video'], main, body") ||
      video ||
      document.documentElement;

    if (!document.fullscreenElement) {
      target.requestFullscreen?.()
        .then(() => announceStatus("Pantalla completa activada"))
        .catch(() => announceStatus("No se pudo activar pantalla completa"));
    } else {
      document.exitFullscreen?.()
        .then(() => announceStatus("Pantalla completa desactivada"))
        .catch(() => announceStatus("No se pudo salir de pantalla completa"));
    }
  }

  function createButton(text, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = text;
    btn.addEventListener("click", onClick);
    Object.assign(btn.style, {
      margin: "2px",
      padding: "6px 8px",
      fontSize: "13px",
      cursor: "pointer",
    });
    return btn;
  }

  function createPanel() {
    const panel = document.createElement("section");
    panel.id = "kwsr-console-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "KathWare SubtitleReader consola");

    Object.assign(panel.style, {
      position: "fixed",
      zIndex: "2147483647",
      right: "12px",
      bottom: "12px",
      maxWidth: "360px",
      background: "rgba(0, 0, 0, 0.88)",
      color: "#fff",
      padding: "10px",
      borderRadius: "10px",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      lineHeight: "1.4",
      boxShadow: "0 4px 16px rgba(0,0,0,.35)",
    });

    const title = document.createElement("h2");
    title.textContent = "KathWare SubtitleReader";
    Object.assign(title.style, {
      fontSize: "16px",
      margin: "0 0 6px",
    });

    const status = document.createElement("p");
    status.id = "kwsr-console-panel-status";
    status.textContent = "Iniciando...";
    Object.assign(status.style, {
      margin: "0 0 6px",
    });

    const last = document.createElement("p");
    last.id = "kwsr-console-panel-last";
    last.textContent = "Último subtítulo: ninguno";
    Object.assign(last.style, {
      margin: "0 0 6px",
      maxHeight: "80px",
      overflow: "auto",
    });

    const controls = document.createElement("div");

    controls.appendChild(createButton("Activar/desactivar", () => setEnabled(!KWSR.enabled)));
    controls.appendChild(createButton("Cambiar salida", cycleReaderMode));
    controls.appendChild(createButton("Estado", announceState));
    controls.appendChild(createButton("Play/Pausa", playPauseVideo));
    controls.appendChild(createButton("Retroceder", () => seekVideo(-10)));
    controls.appendChild(createButton("Avanzar", () => seekVideo(10)));
    controls.appendChild(createButton("Silenciar", toggleMute));
    controls.appendChild(createButton("Pantalla completa", toggleFullscreen));
    controls.appendChild(createButton("Debug", toggleDebug));

    panel.appendChild(title);
    panel.appendChild(status);
    panel.appendChild(last);
    panel.appendChild(controls);

    document.documentElement.appendChild(panel);
    KWSR.panel = panel;

    updatePanel();
  }

  function updatePanel(lastText = "", source = "") {
    if (!KWSR.panel) return;

    const status = KWSR.panel.querySelector("#kwsr-console-panel-status");
    const last = KWSR.panel.querySelector("#kwsr-console-panel-last");

    const picked = pickVisual();
    const mode =
      KWSR.readerMode === "lector" ? "lector" :
      KWSR.readerMode === "voz" ? "voz" :
      "silencio";

    if (status) {
      status.textContent =
        `Estado: ${KWSR.enabled ? "activo" : "apagado"}. ` +
        `Salida: ${mode}. ` +
        `Renderizador: ${picked?.renderer?.name || "no detectado"}.`;
    }

    if (lastText && last) {
      last.textContent = `Último subtítulo (${source}): ${lastText}`;
    }
  }

  function bindHotkeys() {
    KWSR.keyHandler = e => {
      if (!e.shiftKey || !e.altKey) return;

      const key = e.key.toLowerCase();

      if (key === "k") {
        setEnabled(!KWSR.enabled);
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (key === "l") {
        cycleReaderMode();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (key === "d") {
        toggleDebug();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (key === "o") {
        announceState();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (key === "p") {
        playPauseVideo();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (key === "m") {
        toggleMute();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (key === "f") {
        toggleFullscreen();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (key === "arrowleft") {
        seekVideo(-10);
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (key === "arrowright") {
        seekVideo(10);
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (key === "r") {
  restartEngine();
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

  function installFullscreenWatcher() {
    document.addEventListener("fullscreenchange", () => {
      resetReadingState();
      announceStatus(
        document.fullscreenElement
          ? "Pantalla completa detectada. Reiniciando lectura."
          : "Salida de pantalla completa detectada. Reiniciando lectura."
      );
    });
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
      speechSynthesis?.cancel?.();
    } catch (_) {}

    try {
      KWSR.liveRegion?.remove();
      KWSR.statusRegion?.remove();
      KWSR.panel?.remove();
    } catch (_) {}

    console.log("[KWSR] Destruido");
  }

  createLiveRegions();
  createPanel();
  bindHotkeys();
  installObserver();
  installFullscreenWatcher();
  setTimer(tick, 650);

  window.__KATHWARE_SUBTITLE_READER_CONSOLE__ = {
    KWSR,
    destroy,
    tick,
    readTrack,
    readVisual,
    flushVisual,
    pickVisual,
    getMainVideo,
    getState,
    announceState,
    setEnabled,
    cycleReaderMode,
    playPauseVideo,
    toggleMute,
    seekVideo,
    toggleFullscreen,
restartEngine,
  };

  announceStatus("KathWare SubtitleReader iniciado");
  console.log("[KWSR] Iniciado", KWSR.version);
  console.log("[KWSR] Atajos: Alt+Shift+K ON/OFF | Alt+Shift+L salida | Alt+Shift+O estado | Alt+Shift+D debug | Alt+Shift+P play/pausa | Alt+Shift+M mute | Alt+Shift+F pantalla completa | Alt+Shift+Flechas avanzar/retroceder");
})();
