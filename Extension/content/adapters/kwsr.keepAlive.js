// Mantiene disponibles los controles que el reproductor oculta por inactividad.
// Cuando el foco está dentro del reproductor del video principal, despierta sus
// controles y protege la visibilidad de las barras durante la navegación.
(() => {
  const KWSR = window.KWSR;
  if (!KWSR || KWSR.keepAlive) return;
  const S = KWSR.state;
  const ROOTS = "#video-player,#movie_player,.theoplayer-container,.video-js,.jwplayer,[data-shaka-player-container],[data-player],media-player";
  const PLAYER_HINT = "[id*='player' i],[class*='player' i],[data-testid*='player' i]";
  const BARS = "#controls,.ytp-chrome-bottom,.ytp-chrome-top,.theoplayer-control-bar,.vjs-control-bar,.jw-controlbar,.shaka-controls-container,[data-player-controls],[class*='control-bar' i],[class*='controlbar' i],[class*='player-controls' i],[data-testid*='controls' i],[role='toolbar']";
  const CONTROLS = "button,a[href],input,select,[role='button'],[role='slider'],[role='switch']";
  const EXCLUDE = "#kathware-overlay-root,[hidden],[inert],[aria-hidden='true'],[role='menu'],[role='dialog'],[role='listbox'],dialog,[popover]";
  const PIN = "data-kwsr-focus-controls";
  const NAV_KEYS = new Set(["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

  let pinned = new Set();
  let lastTickAt = -Infinity;
  let focusRefresh = 0;

  const video = () => (S.currentVideo?.isConnected !== false && S.currentVideo) || KWSR.video?.getMainVideo?.();

  function playerRoot(v) {
    if (!v) return null;
    const known = v.closest(ROOTS);
    if (known && known !== document.body && known !== document.documentElement) return known;
    // No confundir el contenedor inmediato del video con el que incluye la barra.
    let hint = null;
    for (let el = v.parentElement; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (!el.matches(PLAYER_HINT)) continue;
      hint ||= el;
      if (el.querySelector(BARS)) return el;
    }
    const parent = v.parentElement;
    return hint || (parent && parent !== document.body && parent !== document.documentElement ? parent : v);
  }

  function setPinned(targets) {
    for (const el of pinned) if (!targets.has(el)) el.removeAttribute(PIN);
    for (const el of targets) if (!el.hasAttribute(PIN)) el.setAttribute(PIN, "");
    pinned = targets;
  }

  function clearFocus() {
    if (pinned.size) setPinned(new Set());
  }

  function syncFocus(v, root) {
    const active = document.activeElement;
    if (!S.extensionActiva || !document.hasFocus() || !active || !root?.contains(active) ||
        active.closest("#kathware-overlay-root") ||
        (document.fullscreenElement && !document.fullscreenElement.contains(v))) {
      clearFocus();
      return false;
    }
    const targets = new Set();
    const addPath = el => {
      if (!el || el.closest(EXCLUDE)) return;
      for (let node = el; node && node !== root; node = node.parentElement) targets.add(node);
    };
    for (const bar of root.querySelectorAll(BARS)) {
      if (bar.querySelector(CONTROLS)) addPath(bar);
    }
    // Si la barra no tiene una clase reconocida, al menos sostener el control
    // que ya recibió el foco y sus envoltorios, sin abrir paneles cerrados.
    if (active.matches(CONTROLS)) addPath(active);
    setPinned(targets);
    return true;
  }

  function fire(el, type, x, y) {
    if (type === "pointermove") {
      if (window.PointerEvent) {
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerType: "mouse" }));
      }
    } else {
      el.dispatchEvent(new MouseEvent(type, { bubbles: type !== "mouseenter", clientX: x, clientY: y }));
    }
  }

  function tick(force = false, onlyFocused = false) {
    if (!S.extensionActiva) {
      clearFocus();
      return false;
    }
    const v = video();
    const root = playerRoot(v);
    const focused = syncFocus(v, root);
    if (onlyFocused && !focused) return false;
    const p = KWSR.platforms?.getPlatform?.() || "generic";
    if (!v || (!focused && !KWSR.platforms?.platformCapabilities?.(p)?.keepAlive)) return false;

    const now = performance.now();
    // Un Tab puede generar keydown y focusin en el mismo momento.
    if (now - lastTickAt < (force ? 35 : 300)) return focused;
    const r = v.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) return focused;
    lastTickAt = now;

    const x = r.left + r.width * 0.5;
    const y = r.top + r.height * 0.9;
    if (focused || p === "vix") {
      const hit = document.elementFromPoint(x, y);
      const target = hit && root.contains(hit) && !hit.closest("#kathware-overlay-root") ? hit : v;
      // El evento ya burbujea por el reproductor. No hay que reenviarlo a sus padres.
      fire(target, "mousemove", x, y);
      fire(target, "pointermove", x, y);
    } else {
      // Conservar los avisos periódicos para los renderizadores que ya los usaban.
      for (const el of new Set([v, v.parentElement, root, document, window].filter(Boolean))) {
        for (const type of ["mousemove", "mouseover", "mouseenter", "pointermove"]) fire(el, type, x, y);
      }
    }
    return focused;
  }

  document.addEventListener("focusin", () => tick(true, true), true);
  document.addEventListener("focusout", () => {
    if (!pinned.size || focusRefresh) return;
    // Al pasar entre botones, activeElement puede ser body durante focusout.
    // Esperar a que se asiente el foco para no ocultar el destino del Tab.
    focusRefresh = requestAnimationFrame(() => {
      focusRefresh = 0;
      const v = video();
      syncFocus(v, playerRoot(v));
    });
  }, true);
  document.addEventListener("keydown", event => {
    if (!S.extensionActiva || !NAV_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    tick(true, true);
  }, true);
  document.addEventListener("fullscreenchange", () => {
    if (!S.extensionActiva) return;
    const v = video();
    syncFocus(v, playerRoot(v));
  });
  window.addEventListener("blur", clearFocus);

  KWSR.keepAlive = { tick, playerRoot, clearFocus };
})();
