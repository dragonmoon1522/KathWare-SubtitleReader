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
  const DISPLAY = "--kwsr-focus-display";
  const NAV_KEYS = new Set(["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

  let pinned = new Map();
  let lastTickAt = -Infinity;
  let focusRefresh = 0;
  let focusObserver = null;
  let observedRoot = null;
  let hoveredRoot = null;
  const knownDisplay = new WeakMap();

  const video = () => (S.currentVideo?.isConnected !== false && S.currentVideo) || KWSR.video?.getMainVideo?.();

  function playerRoot(v) {
    if (!v) return null;
    const known = v.closest(ROOTS);
    // A veces el video mismo se llama "video-player". Sus botones son hermanos,
    // no hijos: seguimos buscando la caja que puede contener las dos cosas.
    if (known && known !== v && known !== document.body && known !== document.documentElement) return known;
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

  function controlBar(el, root = playerRoot(video())) {
    const bar = el?.closest(BARS);
    if (!bar || !root?.contains(bar) || bar.closest(EXCLUDE)) return null;
    for (let node = bar; node && node !== root; node = node.parentElement) {
      const display = getComputedStyle(node).display;
      if (display && display !== "none") knownDisplay.set(node, display);
    }
    return bar;
  }

  function setPinned(targets) {
    for (const [el, saved] of pinned) {
      if (targets.has(el)) continue;
      el.removeAttribute(PIN);
      if (saved.value) el.style.setProperty(DISPLAY, saved.value, saved.priority);
      else el.style.removeProperty(DISPLAY);
      pinned.delete(el);
    }
    for (const el of targets) {
      if (pinned.has(el)) continue;
      let display = getComputedStyle(el).display;
      if (display === "none") display = knownDisplay.get(el);
      if (!display) continue;
      knownDisplay.set(el, display);
      // Guardamos una foto pequeña del estilo. Al salir, devolvemos lo que había.
      pinned.set(el, { value: el.style.getPropertyValue(DISPLAY), priority: el.style.getPropertyPriority(DISPLAY) });
      el.style.setProperty(DISPLAY, display || "block");
      el.setAttribute(PIN, "");
    }
  }

  function clearFocus() {
    if (pinned.size) setPinned(new Set());
    focusObserver?.disconnect();
    observedRoot = null;
    hoveredRoot = null;
  }

  function refreshFocus() {
    if (focusRefresh) return;
    // Tab primero suelta un botón y después llega al siguiente. Esperamos ese
    // paso cortito para no apagar la barra en el medio del recorrido.
    focusRefresh = requestAnimationFrame(() => {
      focusRefresh = 0;
      const v = video();
      syncFocus(v, playerRoot(v));
    });
  }

  function observeFocus(root) {
    if (observedRoot === root) return;
    focusObserver ||= new MutationObserver(refreshFocus);
    focusObserver.disconnect();
    observedRoot = root;
    focusObserver.observe(root, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden"]
    });
  }

  function syncFocus(v, root) {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    // Nuestro panel también pertenece al video actual, aunque esté fuera de su
    // caja. Elegir una voz no debe hacer desaparecer los controles de la película.
    const ownControls = !!active?.closest("#kathware-overlay-root");
    const full = document.fullscreenElement;
    if (!S.extensionActiva || !document.hasFocus() || !v || !root || !active ||
        (!root.contains(active) && !ownControls) ||
        (full && !full.contains(v) && !full.shadowRoot?.contains(v))) {
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
    observeFocus(root);
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
    if (!v || !document.hasFocus() ||
        (!focused && !force && !KWSR.platforms?.platformCapabilities?.(p)?.keepAlive)) return false;

    const now = performance.now();
    // Un Tab puede generar keydown y focusin en el mismo momento.
    if (now - lastTickAt < (force ? 35 : 300)) return focused;
    const r = v.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) return focused;
    lastTickAt = now;

    const x = r.left + r.width * 0.5;
    const y = r.top + r.height * 0.9;
    if (focused || force || p === "vix") {
      const hit = document.elementFromPoint(x, y);
      const target = hit && root.contains(hit) && !hit.closest("#kathware-overlay-root") ? hit : v;
      // El evento ya burbujea por el reproductor. No hay que reenviarlo a sus padres.
      if (hoveredRoot !== root) {
        fire(target, "mouseover", x, y);
        fire(root, "mouseenter", x, y);
        hoveredRoot = root;
      }
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
    if (pinned.size) refreshFocus();
  }, true);
  document.addEventListener("keydown", event => {
    if (!S.extensionActiva || !NAV_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    // Antes del Tab despertamos la barra: así sus botones pueden ser el próximo
    // destino. Shift+Tab pasa por el mismo camino y conserva su dirección normal.
    tick(true, event.key !== "Tab");
  }, true);
  document.addEventListener("fullscreenchange", () => {
    if (!S.extensionActiva) return;
    const v = video();
    syncFocus(v, playerRoot(v));
  });
  window.addEventListener("blur", clearFocus);

  KWSR.keepAlive = { tick, playerRoot, controlBar, clearFocus };
})();
