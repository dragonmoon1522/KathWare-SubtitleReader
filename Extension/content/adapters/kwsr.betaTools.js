// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.betaTools.js
// -----------------------------------------------------------------------------
// Herramientas de prueba para 3.0.0-beta.
//
// Añade a la interfaz existente:
// - nombres de controles accesibles y textuales;
// - Debug ON/OFF;
// - Reiniciar lectura;
// - diagnóstico resumido en consola;
// - reinicio al cambiar pantalla completa.
//
// Atajos adicionales:
// - Alt+Shift+D = activar/desactivar debug.
// - Alt+Shift+R = reiniciar pipeline de lectura.
// -----------------------------------------------------------------------------

// PARA UBICARTE
// Agrega diagnóstico, debug y reinicio al panel de la beta.
// debug = mensajes para investigar; diagnóstico = foto del estado actual.
// Buscá getDebugState para los datos y printDebugState para imprimirlos.
//

(() => {
  const KWSR = window.KWSR;
  if (!KWSR || !KWSR.overlay || KWSR.betaTools) return;

  const S = KWSR.state;
  const CFG = KWSR.CFG || {};

  function notify(text) {
    try { KWSR.toast?.notify?.(text); } catch {}
  }

  function platform() {
    return KWSR.platforms?.getPlatform?.() || "generic";
  }

  function getVideoDebug() {
    const v = S.currentVideo || KWSR.video?.getMainVideo?.();
    if (!v) return { found: false };

    let tracks = [];
    try {
      tracks = Array.from(v.textTracks || []).map((t, index) => ({
        index,
        kind: t.kind || "",
        label: t.label || "",
        language: t.language || "",
        mode: t.mode || "",
        activeCues: Number(t.activeCues?.length || 0),
        cues: Number(t.cues?.length || 0)
      }));
    } catch {}

    return {
      found: true,
      paused: !!v.paused,
      ended: !!v.ended,
      currentTime: Number(v.currentTime || 0),
      duration: Number.isFinite(v.duration) ? Number(v.duration) : null,
      muted: !!v.muted,
      volume: Number(v.volume ?? 1),
      currentSrc: String(v.currentSrc || v.src || ""),
      textTracks: tracks
    };
  }

  function getDebugState() {
    let shadowCandidate = null;
    try {
      const c = KWSR.openShadowCaptions?.getCandidate?.();
      if (c) shadowCandidate = { text: c.text || "", score: c.score || 0 };
    } catch {}

    let liveCandidate = null;
    try {
      const c = KWSR.consoleRenderers?.getRendererText?.(platform());
      if (c?.text) liveCandidate = c;
    } catch {}

    return {
      version: KWSR.version,
      flowReaderRevision: KWSR.consoleRenderers?.flowReaderRevision || null,
      youtubeReaderRevision: KWSR.consoleRenderers?.youtubeReaderRevision || null,
      flowTiming: platform() === "flow" ? KWSR.flowTiming?.getReport?.() || null : null,
      platform: platform(),
      extensionActiva: !!S.extensionActiva,
      modoNarrador: S.modoNarradorGlobal,
      fuenteConfigurada: S.fuenteSubGlobal,
      fuenteEfectiva: S.effectiveFuente,
      visualSelectorUsed: S.visualSelectorUsed || "",
      visualObserverActive: !!S.visualObserverActive,
      currentTrack: S.currentTrack ? {
        kind: S.currentTrack.kind || "",
        label: S.currentTrack.label || "",
        language: S.currentTrack.language || "",
        mode: S.currentTrack.mode || ""
      } : null,
      debug: !!CFG.debug,
      debugVisual: !!CFG.debugVisual,
      liveCandidate,
      groupedLineCandidate: platform() === "vix" ? KWSR.visual?.getGroupedLineCandidate?.() : null,
      lastVisualText: S._visualLastText || "",
      lastEmittedText: S.lastEmitText || "",
      shadowCandidate,
      video: getVideoDebug(),
      url: location.href,
      at: new Date().toISOString()
    };
  }

  function printDebugState(reason = "manual") {
    const data = getDebugState();
    console.log(`[KWSR DEBUG] ${reason} ${JSON.stringify(data)}`);
    return data;
  }

  function setDebug(value) {
    const on = Boolean(value);
    CFG.debug = on;
    CFG.debugVisual = on;

    try {
      KWSR.api?.storage?.local?.set?.({
        debug: on,
        debugVisual: on
      });
    } catch {}

    notify(`Debug ${on ? "activado" : "desactivado"}`);
    printDebugState(on ? "debug-on" : "debug-off");
    updateAccessibleStatus();
  }

  function toggleDebug() {
    setDebug(!CFG.debug);
  }

  function restartReading(reason = "manual") {
    try { KWSR.voice?.detenerLectura?.(); } catch {}
    try { KWSR.pipeline?.restartPipeline?.(); } catch {}

    notify("Lectura reiniciada");

    if (CFG.debug) {
      setTimeout(() => printDebugState(`restart:${reason}`), 100);
    }

    updateAccessibleStatus();
  }

  function updateAccessibleStatus() {
    if (!S.overlayStatus) return;

    const label = KWSR.platforms?.platformLabel?.(platform()) || "Sitio";
    const enabled = S.extensionActiva ? "activado" : "desactivado";
    const mode =
      S.modoNarradorGlobal === "lector" ? "lector de pantalla" :
      S.modoNarradorGlobal === "sintetizador" ? "voz del navegador" :
      "silencio";
    const engine =
      S.effectiveFuente === "track" ? "TRACK" :
      S.effectiveFuente === "visual" ? "VISUAL" :
      "AUTO";

    S.overlayStatus.textContent =
      `SubtitleReader ${enabled}. Salida: ${mode}. Motor: ${engine}. ` +
      `Plataforma: ${label}. Debug: ${CFG.debug ? "activado" : "desactivado"}.`;
  }

  function makeButton(label, ariaLabel, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.setAttribute("aria-label", ariaLabel || label);
    Object.assign(b.style, {
      padding: "7px 10px",
      borderRadius: "10px",
      border: "0",
      cursor: "pointer",
      background: "rgba(255,255,255,0.14)",
      color: "#fff"
    });
    b.addEventListener("click", onClick);
    return b;
  }

  function flowTimingMessage(data) {
    if (data.phase === "matched") {
      const seconds = (data.caption.observedAfterAudioMarkMs / 1000).toFixed(1).replace(".", ",");
      return `Flow mostró «${data.word}» aproximadamente ${seconds} segundos después de tu marca del audio. El diagnóstico contiene los tiempos de salida.`;
    }
    if (data.phase === "already-visible") return "La palabra ya estaba en el subtítulo al marcar. Su llegada anterior no se puede medir: repetí con otra palabra distintiva.";
    if (data.phase === "invalid") return "Medición interrumpida o no disponible. Repetí con un video de Flow reproduciéndose, sin pausarlo ni avanzar.";
    if (data.phase === "not-found") return "No se encontró esa palabra durante los 30 segundos de medición. Revisá la palabra o repetí la prueba.";
    if (data.phase === "history-incomplete") return "El registro se llenó antes de identificar la palabra. Repetí la marca y escribila antes.";
    if (data.phase === "waiting") return `Esperando que aparezca «${data.word}» en el subtítulo de Flow. Dejá el video reproduciéndose.`;
    if (data.phase === "need-word") return "Marca de audio registrada. Escribí la palabra que acabás de escuchar y presioná Enter. Dejá el video reproduciéndose.";
    return "Al escuchar una palabra distintiva en el audio original del video, pulsá Alt+Shift+M. Después escribila y presioná Enter.";
  }

  function markFlowAudio() {
    const result = KWSR.flowTiming?.markAudio?.();
    if (!result) return;
    KWSR.overlay?.setPanelOpen?.(true);
    const input = document.querySelector("#kwsr-flow-timing-word");
    if (input) {
      input.value = "";
      if (result.running) input.focus();
    }
    const status = document.querySelector("#kwsr-flow-timing-status");
    if (status) status.textContent = flowTimingMessage(result);
  }

  function addFlowTimingTools(tools) {
    if (platform() !== "flow" || !KWSR.flowTiming) return;
    const section = document.createElement("div");
    section.setAttribute("role", "group");
    section.setAttribute("aria-label", "Medir atraso de Flow");
    const label = document.createElement("label");
    label.setAttribute("for", "kwsr-flow-timing-word");
    label.textContent = "Palabra distintiva escuchada en el audio del video";
    const input = document.createElement("input");
    input.id = "kwsr-flow-timing-word";
    input.type = "text";
    input.maxLength = 80;
    const status = document.createElement("p");
    status.id = "kwsr-flow-timing-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = flowTimingMessage({ phase: "idle" });
    const submit = () => KWSR.flowTiming.setWord(input.value);
    input.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      submit();
    });
    section.append(
      makeButton("Marcar audio de Flow", "Marcar una palabra escuchada ahora en el audio de Flow", markFlowAudio),
      label, input,
      makeButton("Buscar palabra marcada", "Buscar la palabra marcada en el subtítulo de Flow", submit),
      status
    );
    tools.append(section);
    let lastPrinted = "";
    KWSR.flowTiming.setListener(data => {
      const message = flowTimingMessage(data);
      if (status.textContent !== message) status.textContent = message;
      const signature = JSON.stringify([data.phase, data.caption, data.output]);
      if (["matched", "already-visible", "invalid", "not-found", "history-incomplete"].includes(data.phase) && signature !== lastPrinted) {
        lastPrinted = signature;
        console.log(`[KWSR FLOW TIMING] ${JSON.stringify(data)}`);
      }
    });
  }

  function enhanceOverlay() {
    const panel = S.overlayPanel;
    if (!panel || panel.dataset.kwsrBetaEnhanced === "1") {
      updateAccessibleStatus();
      return;
    }

    panel.dataset.kwsrBetaEnhanced = "1";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Controles de KathWare SubtitleReader");

    // Reemplazamos símbolos por nombres textuales. El aria-label se conserva.
    const labels = {
      "Reproducir": "Reproducir",
      "Pausar": "Pausar",
      "Atrasar 10 segundos": "Retroceder 10 segundos",
      "Adelantar 10 segundos": "Avanzar 10 segundos",
      "Silenciar / Activar sonido": "Silenciar o activar sonido",
      "Subtítulos": "Subtítulos",
      "Pantalla completa": "Pantalla completa",
      "Cerrar panel": "Cerrar"
    };

    panel.querySelectorAll("button[aria-label]").forEach((button) => {
      const aria = button.getAttribute("aria-label") || "";
      if (labels[aria]) button.textContent = labels[aria];
    });

    let tools = panel.querySelector("#kwsr-beta-tools");
    if (!tools) {
      tools = document.createElement("div");
      tools.id = "kwsr-beta-tools";
      tools.setAttribute("role", "group");
      tools.setAttribute("aria-label", "Herramientas de prueba");
      Object.assign(tools.style, {
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        marginTop: "10px"
      });

      tools.append(
        makeButton("Debug", "Activar o desactivar debug", toggleDebug),
        makeButton("Diagnóstico", "Mostrar diagnóstico en consola", () => {
          printDebugState("button");
          notify("Diagnóstico enviado a la consola");
        }),
        makeButton("Reiniciar lectura", "Reiniciar lectura de subtítulos", () => restartReading("button"))
      );

      addFlowTimingTools(tools);

      panel.appendChild(tools);
    }

    const hotkeys = panel.querySelector("[aria-label='Atajos de teclado']");
    if (hotkeys) {
      hotkeys.textContent =
        "Atajos: Alt+Shift+K activar/desactivar; Alt+Shift+L cambiar salida; " +
        "Alt+Shift+O abrir/cerrar panel; Alt+Shift+D debug; Alt+Shift+R reiniciar lectura." +
        (platform() === "flow" ? " Alt+Shift+M marcar audio para medir el atraso de Flow." : "");
    }

    // Si el módulo original vuelve a escribir el status, lo corregimos a texto simple.
    if (S.overlayStatus && !S.overlayStatus.__kwsrBetaObserver) {
      const statusObserver = new MutationObserver(() => {
        const current = S.overlayStatus?.textContent || "";
        if (/ON|OFF|TRACK|VISUAL|AUTO/.test(current) && !current.startsWith("SubtitleReader ")) {
          updateAccessibleStatus();
        }
      });
      statusObserver.observe(S.overlayStatus, { childList: true, characterData: true, subtree: true });
      S.overlayStatus.__kwsrBetaObserver = statusObserver;
    }

    updateAccessibleStatus();
  }

  const originalEnsureOverlay = KWSR.overlay.ensureOverlay?.bind(KWSR.overlay);
  const originalUpdateStatus = KWSR.overlay.updateOverlayStatus?.bind(KWSR.overlay);
  const originalSetPanelOpen = KWSR.overlay.setPanelOpen?.bind(KWSR.overlay);

  KWSR.overlay.ensureOverlay = (...args) => {
    const result = originalEnsureOverlay?.(...args);
    enhanceOverlay();
    return result;
  };

  KWSR.overlay.updateOverlayStatus = (...args) => {
    const result = originalUpdateStatus?.(...args);
    enhanceOverlay();
    updateAccessibleStatus();
    return result;
  };

  KWSR.overlay.setPanelOpen = (open) => {
    const result = originalSetPanelOpen?.(open);
    if (open) enhanceOverlay();
    return result;
  };

  function handleBetaHotkeys(e) {
    if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;

    const key = String(e.key || "").toLowerCase();
    const flowMark = key === "m" && platform() === "flow" && S.extensionActiva && KWSR.flowTiming;
    if (key !== "d" && key !== "r" && !flowMark) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    if (flowMark) {
      markFlowAudio();
      return;
    }

    if (key === "d") {
      toggleDebug();
      return;
    }

    if (key === "r") {
      restartReading("hotkey");
    }
  }

  document.addEventListener("keydown", handleBetaHotkeys, true);

  document.addEventListener("fullscreenchange", () => {
    if (!S.extensionActiva) return;
    setTimeout(() => restartReading("fullscreenchange"), 80);
  });

  KWSR.betaTools = {
    toggleDebug,
    setDebug,
    getDebugState,
    printDebugState,
    restartReading,
    enhanceOverlay,
    updateAccessibleStatus
  };
})();
