// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.overlay.js
// -----------------------------------------------------------------------------
//
// Este módulo crea la UI flotante (overlay) dentro de la página:
//
// 1) "Pill" (botón redondo) con texto "KW"
//    - Sirve para abrir/cerrar el panel
//
// 2) "Panel" (caja)
//    - Muestra estado (ON/OFF, modo, plataforma, motor efectivo)
//    - Muestra el último subtítulo leído (solo feedback visual)
//    - Este archivo agrega el ajuste de modo; ttsSettings suma voz y velocidad.
//    - Modo de lectura: desactivado / sintetizador / lector.
//
//    - Incluye controles accesibles del reproductor (play/pause/seek/vol/etc.)
//
// IMPORTANTE (creación cuando hace falta):
// - Este overlay NO se crea automáticamente al cargar la página.
// - Se crea recién cuando el pipeline llama a ensureOverlay() (cuando el usuario activa ON).
//
// DECISIÓN IMPORTANTE (para evitar confusión / bugs):
// - NO hay selector TRACK/VISUAL en el overlay.
// - NO hay selector de pista (trackIndex).
// - El motor se elige en pipeline automáticamente (TRACK si es usable, si no VISUAL).
//
// ACCESIBILIDAD:
// - Botones con aria-label.
// - Panel simple, controlable por teclado.
// - No interferimos cuando el usuario está escribiendo (inputs/textarea/etc.).
//
// SEGURIDAD (MV3 / recarga de extensión):
// - A veces Chrome invalida el "contexto" del content-script si la extensión se recarga
//   pero la pestaña NO se recargó.
// - Blindamos los handlers con safeExtCall() y mostramos un toast.
//
// NOTA SOBRE "NO LEERNOS A NOSOTROS":
// - Todo el overlay vive dentro de #kathware-overlay-root.
// - El motor VISUAL debe excluir este root para NO auto-leerse.
// -----------------------------------------------------------------------------

// PARA UBICARTE
// Construye el panel flotante y el botón KW dentro de la página.
// overlay = panel sobre la página; foco = elemento que recibe el teclado.
// ensureOverlay crea el panel; playerUIRules decide si hace falta su barra.
//

(() => {
  const KWSR = window.KWSR;
  if (!KWSR || KWSR.overlay) return;

  const S = KWSR.state;
  const CFG = KWSR.CFG;

  // Helpers básicos (si utils no está por alguna razón, ponemos fallback)
  const clamp = KWSR.utils?.clamp || ((n, min, max) => Math.min(max, Math.max(min, n)));
  const isTyping =
    KWSR.utils?.isTyping ||
    (() => {
      const ae = document.activeElement;
      if (!ae) return false;
      const tag = (ae.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (ae.isContentEditable) return true;
      return false;
    });

  // -----------------------------------------------------------------------------
  // 1) Manejo de error: "Extension context invalidated"
  // -----------------------------------------------------------------------------
  function isContextInvalidatedError(err) {
    const msg = String(err?.message || err || "");
    return (
      msg.includes("Extension context invalidated") ||
      msg.includes("context invalidated") ||
      msg.includes("message channel closed") ||
      msg.includes("The message port closed")
    );
  }

  function notifyReloadNeeded() {
    try {
      KWSR.toast?.notify?.("⚠️ La extensión se recargó. Recargá la página (F5) y probá de nuevo.");
    } catch {}

    // Ocultamos UI para evitar interacción con un content-script “zombie”
    try { if (S.overlayPanel) S.overlayPanel.style.display = "none"; } catch {}
    try { if (S.overlayRoot)  S.overlayRoot.style.display  = "none"; } catch {}
  }

  function safeExtCall(fn) {
    try {
      // En MV3: si chrome.runtime existe pero runtime.id no, suele ser invalidación
      if (typeof chrome !== "undefined" && chrome?.runtime && !chrome.runtime.id) {
        throw new Error("Extension context invalidated.");
      }
      return fn();
    } catch (e) {
      if (isContextInvalidatedError(e)) {
        notifyReloadNeeded();
        return;
      }
      throw e;
    }
  }

  // -----------------------------------------------------------------------------
  // 2) Construcción del overlay (root + panel + pill)
  // -----------------------------------------------------------------------------
  function ensureOverlay() {
    if (S.overlayRoot) {
      mountOverlay();
      return;
    }

    // Root: contenedor fijo, arriba de todo (zIndex máximo)
    const root = document.createElement("div");
    root.id = "kathware-overlay-root";
    Object.assign(root.style, {
      position: "fixed",
      right: "14px",
      bottom: "14px",
      zIndex: "2147483647",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      display: "none"
    });

    // Panel
    const panel = document.createElement("div");
    panel.id = "kathware-overlay-panel";
    Object.assign(panel.style, {
      display: "none",
      marginBottom: "10px",
      padding: "12px 14px",
      borderRadius: "12px",
      background: "rgba(0,0,0,0.80)",
      color: "#fff",
      maxWidth: "min(520px, 85vw)",
      boxShadow: "0 10px 28px rgba(0,0,0,0.30)",
      backdropFilter: "blur(6px)"
    });

    // Status
    const status = document.createElement("div");
    Object.assign(status.style, {
      opacity: ".92",
      fontSize: "13px",
      marginBottom: "8px"
    });

    // Texto: último subtítulo leído (feedback visual)
    const text = document.createElement("div");
    text.setAttribute("aria-label", "Último subtítulo detectado");
    Object.assign(text.style, {
      whiteSpace: "pre-wrap",
      fontSize: "16px",
      lineHeight: "1.35",
      padding: "8px 10px",
      borderRadius: "10px",
      background: "rgba(255,255,255,0.10)"
    });

    // Row: modo de lectura (único setting expuesto)
    const settingsRow = document.createElement("div");
    Object.assign(settingsRow.style, {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "8px",
      marginTop: "10px"
    });

    const modoLabel = document.createElement("div");
    modoLabel.textContent = "Modo de lectura";
    Object.assign(modoLabel.style, { fontSize: "13px", opacity: ".9" });

    const modoSelect = document.createElement("select");
    modoSelect.setAttribute("aria-label", "Modo de lectura");
    modoSelect.innerHTML = `
      <option value="lector">Lector</option>
      <option value="sintetizador">Voz</option>
      <option value="off">Desactivado</option>
    `;
    Object.assign(modoSelect.style, {
      width: "100%",
      padding: "8px 10px",
      borderRadius: "10px",
      border: "0",
      outline: "none"
    });

    settingsRow.append(modoLabel, modoSelect);

    // Ayuda hotkeys (texto fijo, no interactivo)
    const hotkeys = document.createElement("div");
    hotkeys.setAttribute("aria-label", "Atajos de teclado");
    Object.assign(hotkeys.style, {
      marginTop: "10px",
      fontSize: "13px",
      opacity: ".9",
      lineHeight: "1.35"
    });
    hotkeys.textContent =
      "Atajos: Alt+Shift+K (ON/OFF) · Alt+Shift+L (cambiar modo) · Alt+Shift+O (abrir/cerrar panel)";

    // Controles del reproductor (botones)
    const controlsRow = document.createElement("div");
    controlsRow.id = "kwsr-fallback-player-controls";
    Object.assign(controlsRow.style, {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      marginTop: "10px"
    });

    const mkBtn = (label, onClick, aria) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (aria) b.setAttribute("aria-label", aria);
      Object.assign(b.style, {
        padding: "7px 10px",
        borderRadius: "10px",
        border: "0",
        cursor: "pointer",
        background: "rgba(255,255,255,0.14)",
        color: "#fff"
      });
      b.addEventListener("click", onClick);
      b.addEventListener("keydown", (e) => {
        // Enter/Espacio activan (a veces sitios interceptan space raro)
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          try { b.click(); } catch {}
        }
      });
      return b;
    };

    // Nota: CFG.seekBig/seekSmall deberían existir en CFG default.
    // Si no existen, esto devuelve NaN -> seekBy lo clampa, pero igual no mueve.
    // (Micro-fix opcional: setear defaults en CFG al cargar.)
    const btnPlay  = mkBtn("▶️", () => S.currentVideo?.play?.(), "Reproducir");
    const btnPause = mkBtn("⏸️", () => S.currentVideo?.pause?.(), "Pausar");
    const btnBack  = mkBtn("⏪", () => seekBy(-CFG.seekBig), "Atrasar 10 segundos");
    const btnFwd   = mkBtn("⏩", () => seekBy(+CFG.seekBig), "Adelantar 10 segundos");
    const btnMute  = mkBtn("M",   () => toggleMute(), "Silenciar / Activar sonido");
    const btnFull  = mkBtn("⛶",  () => requestFull(), "Pantalla completa");
    const btnClose = mkBtn("Cerrar", () => setPanelOpen(false), "Cerrar panel");

    controlsRow.append(btnPlay, btnPause, btnBack, btnFwd, btnMute, btnFull);

    // Composición del panel (orden: status -> texto -> modo -> hotkeys -> controles)
    panel.append(status, text, settingsRow, hotkeys, controlsRow, btnClose);

    // Pill
    const pill = document.createElement("button");
    pill.type = "button";
    pill.setAttribute("aria-label", "Abrir KathWare SubtitleReader");
    pill.textContent = "KW";
    Object.assign(pill.style, {
      width: "46px",
      height: "46px",
      borderRadius: "999px",
      border: "0",
      cursor: "pointer",
      background: "rgba(0,0,0,0.80)",
      color: "#fff",
      fontWeight: "800",
      letterSpacing: ".5px",
      boxShadow: "0 10px 28px rgba(0,0,0,0.30)"
    });

    pill.addEventListener("click", () => {
      const open = panel.style.display !== "none";
      setPanelOpen(!open);
    });

    root.append(panel, pill);

    // Guardamos referencias
    S.overlayRoot = root;
    S.overlayPanel = panel;
    S.overlayPill = pill;
    S.overlayStatus = status;
    S.overlayText = text;
    S.overlayModoSelect = modoSelect;
    mountOverlay();

    // -----------------------------------------------------------------------------
    // 3) Listener de modo (blindado con safeExtCall)
    // -----------------------------------------------------------------------------
    modoSelect.addEventListener("change", () => {
      safeExtCall(() => {
        S.modoNarradorGlobal = modoSelect.value;

        // Persistimos para popup / próximas cargas
        try { KWSR.api?.storage?.local?.set?.({ modoNarrador: S.modoNarradorGlobal }); } catch {}

        // Si apaga, detenemos lectura al toque
        if (S.modoNarradorGlobal === "off") {
          try { KWSR.voice?.detenerLectura?.(); } catch {}
        }

        updateOverlayStatus();
      });
    });
  }

  // -----------------------------------------------------------------------------
  // 3) Mostrar / ocultar overlay y panel
  // -----------------------------------------------------------------------------
  function mountOverlay() {
    const root = S.overlayRoot;
    if (!root) return;
    // Un overlay fuera del elemento fullscreen queda detrás de la capa superior que usa el navegador.
    const fullscreen = document.fullscreenElement;
    const host = fullscreen && !fullscreen.matches("video,audio")
      ? fullscreen : document.documentElement;
    if (root.parentElement !== host) host.appendChild(root);
  }

  document.addEventListener("fullscreenchange", mountOverlay);

  function setOverlayVisible(visible) {
    if (!S.overlayRoot) return;
    mountOverlay();
    S.overlayRoot.style.display = visible ? "block" : "none";
    if (!visible) {
      try { S.overlayPanel.style.display = "none"; } catch {}
    }
  }

  function setPanelOpen(open) {
    ensureOverlay();
    setOverlayVisible(true);
    S.overlayPanel.style.display = open ? "block" : "none";
  }

  function updateOverlayText(t) {
    if (!S.overlayRoot) return;

    const str = String(t ?? "");

    // Si no querés feedback visual, poné CFG.overlayShowText = false
    if (CFG.overlayShowText === false) {
      S.overlayText.textContent = "";
      return;
    }

    S.overlayText.textContent = str;

    // Si querés abrir panel al llegar subtítulos:
    if (CFG.autoOpenPanelOnSubs && str.trim()) setPanelOpen(true);
  }

  // -----------------------------------------------------------------------------
  // 4) Status (simple y “verdadero”)
  // -----------------------------------------------------------------------------
  function updateOverlayStatus() {
    if (!S.overlayRoot) return;
    mountOverlay();

    const p = KWSR.platforms?.getPlatform?.() || "generic";
    const label = KWSR.platforms?.platformLabel?.(p) || "Sitio";

    const enabled = S.extensionActiva ? "🟢 ON" : "🔴 OFF";

    const modeEmoji =
      S.modoNarradorGlobal === "lector" ? "🧏" :
      S.modoNarradorGlobal === "sintetizador" ? "🗣️" : "🙊";

    // Motor efectivo (info, no editable desde overlay)
    const engine =
      (S.effectiveFuente === "track") ? "🎛️ TRACK" :
      (S.effectiveFuente === "visual") ? "👀 VISUAL" :
      "🤖 AUTO";

    if (S.overlayModoSelect) S.overlayModoSelect.value = S.modoNarradorGlobal || "lector";

    S.overlayStatus.textContent = `${enabled} ${modeEmoji} | ${engine} | ${label}`;
  }

  // -----------------------------------------------------------------------------
  // 5) “API” que el pipeline espera (compat): no rompemos llamadas viejas
  // -----------------------------------------------------------------------------
  function updateOverlayTracksList() {
    // Ya NO hay selector de pista.
    // Dejamos esta función como “compat” para que pipeline pueda llamarla sin romper.
  }

  // -----------------------------------------------------------------------------
  // 6) Helpers del reproductor (botones + hotkeys)
  // -----------------------------------------------------------------------------
  function seekBy(delta) {
    const v = S.currentVideo;
    if (!v) return;

    try {
      const d = Number(delta || 0);
      if (!Number.isFinite(d) || d === 0) return;

      const dur = Number.isFinite(v.duration) ? v.duration : (v.currentTime + d);
      v.currentTime = clamp((v.currentTime || 0) + d, 0, dur);
    } catch {}
  }

  function toggleMute() {
    const v = S.currentVideo;
    if (!v) return;
    try { v.muted = !v.muted; } catch {}
  }

  function requestFull() {
    const v = S.currentVideo;
    if (!v) return;

    try {
      KWSR.toast?.notify?.("⚠️ En pantalla completa la lectura automática puede fallar.");
    } catch {}

    try { v.requestFullscreen?.(); } catch {}
  }

  function toggleCaptions() {
    const v = S.currentVideo;
    if (!v?.textTracks?.length) {
      try { KWSR.toast?.notify?.("⚠️ No hay pistas de subtítulos para alternar."); } catch {}
      return;
    }

    const t = S.currentTrack || KWSR.track?.pickBestTrack?.(v);
    if (!t) return;

    try {
      if (t.mode === "showing") t.mode = "hidden";
      else t.mode = "showing";

      S.currentTrack = t;
      updateOverlayStatus();

      try { KWSR.toast?.notify?.(`CC: ${t.mode === "showing" ? "ON" : "OFF"}`); } catch {}
    } catch {}
  }

  function handlePlayerHotkeys(e) {
    if (!S.extensionActiva) return false;
    if (isTyping()) return false;

    // No chocamos con combinaciones del sistema/lectores
    if (e.ctrlKey || e.altKey || e.metaKey) return false;

    const panelOpen = S.overlayPanel && S.overlayPanel.style.display !== "none";

    // Player hotkeys solo si el panel está abierto, salvo plataformas “difíciles”
    const p = KWSR.platforms?.getPlatform?.() || "generic";
    const caps = KWSR.platforms?.platformCapabilities?.(p) || { nonAccessibleFixes: false };
    if (!panelOpen && !caps.nonAccessibleFixes) return false;

    const key = (e.key || "").toLowerCase();

    if (key === "k" || key === " ") {
      e.preventDefault();
      const v = S.currentVideo;
      if (!v) return true;
      try { v.paused ? v.play() : v.pause(); } catch {}
      return true;
    }

    if (key === "arrowleft")  { e.preventDefault(); seekBy(e.shiftKey ? -(CFG.seekBig || 10) : -(CFG.seekSmall || 5)); return true; }
    if (key === "arrowright") { e.preventDefault(); seekBy(e.shiftKey ? +(CFG.seekBig || 10) : +(CFG.seekSmall || 5)); return true; }
    if (key === "j") { e.preventDefault(); seekBy(-(CFG.seekBig || 10)); return true; }
    if (key === "l") { e.preventDefault(); seekBy( +(CFG.seekBig || 10)); return true; }
    if (key === "m") { e.preventDefault(); toggleMute(); return true; }
    if (key === "c") { e.preventDefault(); toggleCaptions(); return true; }
    if (key === "f") { e.preventDefault(); requestFull(); return true; }

    if (key === "arrowup") {
      e.preventDefault();
      const v = S.currentVideo;
      if (!v) return true;
      try { v.volume = clamp((v.volume ?? 1) + (CFG.volStep || 0.05), 0, 1); } catch {}
      return true;
    }

    if (key === "arrowdown") {
      e.preventDefault();
      const v = S.currentVideo;
      if (!v) return true;
      try { v.volume = clamp((v.volume ?? 1) - (CFG.volStep || 0.05), 0, 1); } catch {}
      return true;
    }

    return false;
  }

  // Export público
  KWSR.overlay = {
    ensureOverlay,
    setOverlayVisible,
    setPanelOpen,
    updateOverlayText,
    updateOverlayTracksList, // compat
    updateOverlayStatus,
    handlePlayerHotkeys
  };

})();
