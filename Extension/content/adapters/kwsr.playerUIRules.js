// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.playerUIRules.js
// -----------------------------------------------------------------------------
// Reglas de interfaz del reproductor alternativo para 2.2.0-beta.
//
// Principios:
// - SubtitleReader no reemplaza un reproductor que ya es accesible.
// - Los controles alternativos de KathWare aparecen solo como fallback.
// - El botón para alternar pistas de subtítulos queda eliminado de la beta.
// - El atajo "C" del reproductor alternativo también queda eliminado.
//
// Esta capa no toca el motor de lectura de subtítulos.
// -----------------------------------------------------------------------------

(() => {
  const KWSR = window.KWSR;
  if (!KWSR || !KWSR.overlay || KWSR.playerUIRules) return;

  const S = KWSR.state;
  const CFG = KWSR.CFG || {};
  const normalize = KWSR.utils?.normalize || (s => String(s || "").replace(/\s+/g, " ").trim());

  const OUR_UI =
    "#kathware-overlay-root," +
    "#kathware-overlay-panel," +
    "#kw-toast," +
    "#kwsr-live-region," +
    "#kathware-live-region";

  let observer = null;
  let scheduled = false;
  let lastAccessibleState = null;

  function isVisible(el) {
    try {
      if (!el || !(el instanceof Element)) return false;
      if (el.closest?.(OUR_UI)) return false;

      for (let node = el; node; node = node.parentElement) {
        if (node.hidden || node.inert || node.getAttribute("aria-hidden") === "true") return false;
        const cs = getComputedStyle(node);
        if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") return false;
        if (Number(cs.opacity || 1) < 0.05) return false;
      }

      const r = el.getBoundingClientRect();
      return r.width >= 10 && r.height >= 10;
    } catch {
      return false;
    }
  }

  function accessibleName(el) {
    try {
      const aria = normalize(el.getAttribute("aria-label") || "");
      if (aria) return aria;

      const labelledBy = normalize(el.getAttribute("aria-labelledby") || "");
      if (labelledBy) {
        const txt = labelledBy
          .split(/\s+/)
          .map(id => normalize(document.getElementById(id)?.textContent || ""))
          .filter(Boolean)
          .join(" ");
        if (txt) return txt;
      }

      const title = normalize(el.getAttribute("title") || "");
      if (title) return title;

      const text = normalize(el.innerText || el.textContent || "");
      if (text && text.length <= 100) return text;

      return "";
    } catch {
      return "";
    }
  }

  function isKeyboardInteractive(el) {
    try {
      if (el.matches(":disabled") || el.closest('[aria-disabled="true"]')) return false;
      // role no hace enfocable a un div; tabindex=-1 también excluye botones.
      if (el.tabIndex < 0) return false;
      return el.matches("button,input,select,textarea,a[href],[role='button'],[role='slider'],[role='switch'],[role='checkbox'],[role='radio']");
    } catch {
      return false;
    }
  }

  function playerRoot(video) {
    try {
      return document.querySelector("#video-player") ||
        video?.closest?.(
          "[data-testid*='player'],[id*='video-player'],[id*='player']," +
          "[class*='video-player'],[class*='VideoPlayer'],[class*='player'],[class*='Player']"
        ) ||
        video?.parentElement ||
        null;
    } catch {
      return null;
    }
  }

  function nearVideo(el, video, root) {
    try {
      if (root?.contains(el)) return true;
      if (!video) return false;

      const vr = video.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const margin = 70;

      return !(
        r.right < vr.left - margin ||
        r.left > vr.right + margin ||
        r.bottom < vr.top - margin ||
        r.top > vr.bottom + margin
      );
    } catch {
      return false;
    }
  }

  function getNativeControls(video) {
    const root = playerRoot(video);
    const scope = root || document;

    let all = [];
    try {
      all = Array.from(scope.querySelectorAll(
        "button,[role='button'],[role='slider'],[aria-controls],[aria-label],[tabindex],input[type='range']"
      ));
    } catch {}

    return all.filter(el => {
      if (!isVisible(el)) return false;
      if (!nearVideo(el, video, root)) return false;
      const name = accessibleName(el);
      return isKeyboardInteractive(el) && !!name && name !== "Control del reproductor";
    });
  }

  function nativePlayerAccessibility() {
    const video = S.currentVideo || KWSR.video?.getMainVideo?.();
    if (!video) {
      return { accessible: false, reason: "no-video", namedControls: 0 };
    }

    // El reproductor nativo del navegador ya tiene semántica y teclado propios.
    try {
      if (video.controls && isVisible(video)) {
        return { accessible: true, reason: "native-video-controls", namedControls: 1 };
      }
    } catch {}

    const controls = getNativeControls(video);
    const names = controls.map(accessibleName).filter(Boolean);
    const joined = names.join(" ").toLowerCase();

    const hasPlayback = /play|pause|reproduc|pausa/.test(joined);
    const hasSecondary = /volume|mute|sound|volumen|silenc|full|pantalla|seek|forward|back|retroced|avanz|subt|caption|audio|config|setting/.test(joined);

    // Tres controles con nombre y teclado, incluyendo reproducción y al menos
    // otra función del player, es una señal conservadora de player usable.
    const accessible = controls.length >= 3 && hasPlayback && hasSecondary;

    return {
      accessible,
      reason: accessible ? "named-keyboard-controls" : "insufficient-controls",
      namedControls: controls.length,
      names: CFG.debug ? names.slice(0, 20) : undefined
    };
  }

  function getFallbackControlsRow() {
    const panel = S.overlayPanel;
    if (!panel) return null;

    const play = panel.querySelector("button[aria-label='Reproducir']");
    if (!play) return null;

    return play.parentElement || null;
  }

  function removeSubtitleToggle() {
    const panel = S.overlayPanel;
    if (!panel) return false;

    const buttons = Array.from(panel.querySelectorAll("button"));
    let removed = false;

    for (const button of buttons) {
      const label = normalize(button.getAttribute("aria-label") || "").toLowerCase();
      if (label === "subtítulos" || label === "alternar pista de subtítulos") {
        button.remove();
        removed = true;
      }
    }

    return removed;
  }

  function syncFallbackPlayer() {
    removeSubtitleToggle();

    const row = getFallbackControlsRow();
    if (!row) return;

    if (row.id !== "kwsr-fallback-player-controls") row.id = "kwsr-fallback-player-controls";
    if (row.getAttribute("aria-label") !== "Controles alternativos del reproductor") {
      row.setAttribute("aria-label", "Controles alternativos del reproductor");
    }

    const info = nativePlayerAccessibility();
    const shouldShowFallback = !info.accessible;
    const wantedDisplay = shouldShowFallback ? "flex" : "none";

    if (row.style.display !== wantedDisplay) {
      if (!shouldShowFallback && row.contains(document.activeElement)) {
        S.overlayPanel?.querySelector("button[aria-label='Cerrar panel']")?.focus();
      }
      row.style.display = wantedDisplay;
    }

    const hidden = shouldShowFallback ? "false" : "true";
    if (row.getAttribute("aria-hidden") !== hidden) row.setAttribute("aria-hidden", hidden);

    if (CFG.debug && info.accessible !== lastAccessibleState) {
      console.log("[KathWare] fallback player UI", {
        nativeAccessible: info.accessible,
        reason: info.reason,
        namedControls: info.namedControls,
        names: info.names || []
      });
    }

    lastAccessibleState = info.accessible;
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      syncFallbackPlayer();
    });
  }

  function startObserver() {
    if (observer) return;

    try {
      observer = new MutationObserver(records => {
        if (records.some(record => !record.target.closest?.(OUR_UI))) scheduleSync();
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "aria-label", "aria-labelledby", "role", "tabindex", "controls", "hidden", "inert", "aria-hidden", "disabled", "aria-disabled"]
      });
    } catch {
      observer = null;
    }
  }

  // El overlay se crea lazy. Reaplicamos las reglas cada vez que se crea o abre.
  const originalEnsureOverlay = KWSR.overlay.ensureOverlay?.bind(KWSR.overlay);
  const originalSetPanelOpen = KWSR.overlay.setPanelOpen?.bind(KWSR.overlay);
  const originalUpdateStatus = KWSR.overlay.updateOverlayStatus?.bind(KWSR.overlay);
  const originalHandlePlayerHotkeys = KWSR.overlay.handlePlayerHotkeys?.bind(KWSR.overlay);

  if (originalEnsureOverlay) {
    KWSR.overlay.ensureOverlay = (...args) => {
      const result = originalEnsureOverlay(...args);
      syncFallbackPlayer();
      return result;
    };
  }

  if (originalSetPanelOpen) {
    KWSR.overlay.setPanelOpen = (open) => {
      const result = originalSetPanelOpen(open);
      syncFallbackPlayer();
      return result;
    };
  }

  if (originalUpdateStatus) {
    KWSR.overlay.updateOverlayStatus = (...args) => {
      const result = originalUpdateStatus(...args);
      syncFallbackPlayer();
      return result;
    };
  }

  if (originalHandlePlayerHotkeys) {
    KWSR.overlay.handlePlayerHotkeys = (event) => {
      // Dejar Enter/Espacio/flechas a los controles enfocados, incluso cuando
      // el resto del reproductor todavía necesita el fallback.
      if (event?.defaultPrevented || event?.target?.closest?.("button,a[href],input,select,textarea,[role='button'],[role='slider'],[role='menuitem'],[contenteditable='true']")) return false;
      const key = String(event?.key || "").toLowerCase();

      // Ya no existe control de alternar pistas en nuestro reproductor.
      if (key === "c" && !event?.ctrlKey && !event?.altKey && !event?.metaKey) {
        return false;
      }

      // Si el sitio ya tiene reproductor accesible, tampoco secuestramos sus teclas.
      if (nativePlayerAccessibility().accessible) return false;

      return originalHandlePlayerHotkeys(event);
    };
  }

  KWSR.playerUIRules = {
    accessibleName,
    getNativeControls,
    nativePlayerAccessibility,
    removeSubtitleToggle,
    syncFallbackPlayer,
    startObserver
  };

  startObserver();
  syncFallbackPlayer();
})();
