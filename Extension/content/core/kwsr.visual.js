// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.visual.js
// -----------------------------------------------------------------------------
//
// QUÉ HACE ESTE ARCHIVO
// ---------------------
// Este módulo lee subtítulos VISUALES del DOM.
//
// Traducción a idioma humano:
// - mira lo que aparece en pantalla
// - junta el texto del subtítulo
// - intenta evitar basura o duplicados
// - le pasa el resultado final a KWSR.voice
//
// Este archivo NO:
// - usa textTracks
// - habla por sí solo
// - crea paneles ni interfaz
//
// -----------------------------------------------------------------------------
//
// PROBLEMA DIFÍCIL DE NETFLIX / MAX
// ---------------------------------
// Netflix y Max hacen cosas raras con el DOM.
//
// A veces pasa esto:
//
// 1. subtítulo viejo
// 2. un instante donde conviven viejo + nuevo
// 3. subtítulo nuevo
//
// Si leemos "todo lo que haya" sin pensar,
// terminamos repitiendo o mezclando frases.
//
// Pero también existe otro caso:
//
// 1. un subtítulo real de dos líneas
//
// Si tratamos eso como "viejo + nuevo",
// rompemos la frase.
//
// Entonces la clave es:
// - detectar cuándo varias líneas son un subtítulo real
// - detectar cuándo son una transición fea
//
// -----------------------------------------------------------------------------
//
// IDEA GENERAL
// ------------
// Para Netflix/Max:
//
// - leemos varias partes visibles del contenedor
// - armamos un texto unido
// - si ese texto unido contiene al subtítulo anterior,
//   probablemente sea una transición vieja+nueva
// - en ese caso, intentamos quedarnos solo con la parte nueva
//
// Si NO parece transición, usamos el texto completo unido.
//
// -----------------------------------------------------------------------------


(() => {
  // ---------------------------------------------------------------------------
  // Arranque seguro
  // ---------------------------------------------------------------------------
  const KWSR = window.KWSR;
  if (!KWSR || KWSR.visual) return;

  const S = KWSR.state;
  const CFG = KWSR.CFG;
  const normalize = KWSR.utils?.normalize || ((x) => String(x ?? "").trim());

  const DEBUG = () => !!(CFG?.debug && CFG?.debugVisual);

  // ---------------------------------------------------------------------------
  // Helpers de plataforma
  // ---------------------------------------------------------------------------
  function platform() {
    return KWSR.platforms?.getPlatform?.() || "generic";
  }

  function caps() {
    const p = platform();
    return KWSR.platforms?.platformCapabilities?.(p) || {};
  }

  // ---------------------------------------------------------------------------
  // Evitar leer nuestra propia UI
  // ---------------------------------------------------------------------------
  function isInsideKathWareUI(node) {
    try {
      const el = node?.nodeType === 1 ? node : node?.parentElement;
      if (!el || !el.closest) return false;

      return !!el.closest(
        "#kathware-overlay-root," +
        "#kathware-overlay-panel," +
        "#kw-toast," +
        "#kwsr-live-region," +
        "#kathware-live-region"
      );
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Detectar menús de idioma / audio / subtítulos
  // ---------------------------------------------------------------------------
  function isLanguageMenuText(text) {
    const t = normalize(text);
    if (!t) return false;

    const lower = t.toLowerCase();

    const strong =
      lower.includes("audio") ||
      lower.includes("subtítulos") ||
      lower.includes("subtitulos") ||
      lower.includes("subtitles") ||
      lower.includes("[cc]") ||
      lower.includes("cc ");

    if (!strong) return false;

    const hits = [
      "english","deutsch","español","espanol","français","francais","italiano","português","portugues",
      "polski","magyar","dansk","norsk","svenska","suomi","türkçe","turkce","čeština","cestina",
      "română","romana","slovenčina","slovencina","nederlands","ελληνικά","日本語","한국어",
      "chinese","简体","繁體","粵語","bokmål","brasil","canada"
    ].reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);

    if (hits >= 3) return true;
    if (t.length > 160 && strong) return true;

    return false;
  }

  // ---------------------------------------------------------------------------
  // Filtro general anti-basura
  // ---------------------------------------------------------------------------
  function looksLikeNoise(node, text) {
    const t = normalize(text);
    if (!t) return true;

    if (isInsideKathWareUI(node)) return true;
    if (isLanguageMenuText(t)) return true;

    const tag = (node?.tagName || "").toUpperCase();
    if (["A", "BUTTON", "INPUT", "TEXTAREA", "SELECT", "LABEL"].includes(tag)) {
      return true;
    }

    if (t.length < 2 || t.length > 420) return true;

    const cls = ((node?.className || "") + " " + (node?.id || "")).toLowerCase();
    if (/toast|snack|tooltip|popover|modal|dialog|notif|banner|sr-only|screenreader-only/.test(cls)) {
      return true;
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Ver si un elemento está visible
  // ---------------------------------------------------------------------------
  function isVisible(el) {
    try {
      if (!el || !(el instanceof Element)) return false;
      if (isInsideKathWareUI(el)) return false;

      const style = window.getComputedStyle(el);
      if (!style) return false;
      if (style.display === "none" || style.visibility === "hidden") return false;

      const opacity = parseFloat(style.opacity || "1");
      if (opacity <= 0.01) return false;

      const r = el.getBoundingClientRect?.();
      if (!r) return true;
      if (r.width < 2 && r.height < 2) return false;

      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Selectores por plataforma
  // ---------------------------------------------------------------------------
  function getSelectors() {
    const p = platform();
    return KWSR.platforms?.platformSelectors?.(p) || [];
  }

  function getFreshNodesBySelector(sel) {
    try {
      return Array.from(document.querySelectorAll(sel)).filter(n => !isInsideKathWareUI(n));
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Clave del contenedor
  // ---------------------------------------------------------------------------
  function containerKeyForNode(n) {
    try {
      const el = n?.nodeType === 1 ? n : n?.parentElement;
      if (!el) return "no-el";
      if (isInsideKathWareUI(el)) return "kathware-ui";

      const wrap =
        el.closest?.(
          "[data-testid*='cue']," +
          "[data-uia*='subtitle']," +
          "[data-uia*='captions']," +
          "[class*='caption']," +
          "[class*='subtitle']," +
          "[class*='timedtext']"
        ) || el;

      const tag = (wrap.tagName || "").toLowerCase();
      const tid = wrap.getAttribute("data-testid") || "";
      const uia = wrap.getAttribute("data-uia") || "";
      const cls = String(wrap.className || "").slice(0, 120);

      return `${tag}|${tid}|${uia}|${cls}`;
    } catch {
      return "key-err";
    }
  }

  // ---------------------------------------------------------------------------
  // Unir partes de texto
  // ---------------------------------------------------------------------------
  function smartJoinLines(parts) {
    if (!parts || !parts.length) return "";

    let out = "";

    for (let i = 0; i < parts.length; i++) {
      const chunk = normalize(parts[i]);
      if (!chunk) continue;

      if (!out) {
        out = chunk;
        continue;
      }

      const prev = out;
      const lastChar = prev.slice(-1);
      const firstChar = chunk.slice(0, 1);

      const needSpace =
        /[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(lastChar) &&
        /[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(firstChar);

      const strongPunct = /[.!?…]$/.test(prev.trim());

      out = prev.trim() + (strongPunct || needSpace ? " " : "") + chunk;
    }

    return normalize(out);
  }

  // ---------------------------------------------------------------------------
  // Fingerprints
  // ---------------------------------------------------------------------------
  // Sirven para comparar texto "casi igual" sin que pequeñas diferencias
  // de espacios o puntuación nos engañen.
  // ---------------------------------------------------------------------------
  function fpStrict(text) {
    return normalize(text)
      .replace(/\u00A0/g, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function fpLoose(text) {
    return normalize(text)
      .replace(/\u00A0/g, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[\/|·•–—]+/g, " ")
      .replace(/[.,;:!?¡¿"“”'’()\[\]{}]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  // ---------------------------------------------------------------------------
  // Detectar si una lista de partes parece tener el texto anterior al principio
  // ---------------------------------------------------------------------------
  // Ejemplo:
  // prev = "hola conan"
  // joined = "hola conan hola profesor agasa como esta"
  //
  // Eso huele a transición vieja+nueva.
  // ---------------------------------------------------------------------------
  function joinedContainsPrevious(prevText, joinedText) {
    const prev = fpLoose(prevText || "");
    const joined = fpLoose(joinedText || "");

    if (!prev || !joined) return false;
    if (prev === joined) return false;
    if (joined.length <= prev.length) return false;

    if (joined.startsWith(prev + " ")) return true;
    if (joined.includes(" " + prev + " ")) return true;

    return false;
  }

  // ---------------------------------------------------------------------------
  // Intentar recortar la parte nueva cuando el texto unido arranca con el viejo
  // ---------------------------------------------------------------------------
  // Ejemplo:
  // prev   = "hola conan"
  // joined = "hola conan hola profesor agasa como esta"
  //
  // devuelve:
  // "hola profesor agasa como esta"
  // ---------------------------------------------------------------------------
  function subtractPreviousFromJoined(prevText, joinedText) {
    const prevRaw = normalize(prevText || "");
    const joinedRaw = normalize(joinedText || "");

    if (!prevRaw || !joinedRaw) return "";
    if (joinedRaw === prevRaw) return "";

    const prevLoose = fpLoose(prevRaw);
    const joinedLoose = fpLoose(joinedRaw);

    if (!prevLoose || !joinedLoose) return "";
    if (!joinedContainsPrevious(prevRaw, joinedRaw)) return "";

    // Intento simple y bastante seguro:
    // si joinedRaw empieza literalmente con prevRaw, cortamos por ahí.
    if (joinedRaw.startsWith(prevRaw)) {
      const tail = normalize(joinedRaw.slice(prevRaw.length));
      if (tail) return tail;
    }

    // Fallback más flexible:
    // si hay varias partes separadas por doble espacio o estructura similar,
    // intentamos recuperar la cola final desde la última mitad "nueva".
    //
    // No es perfecto, pero es bastante mejor que comer subtítulos enteros.
    const prevWords = prevLoose.split(" ").filter(Boolean);
    const joinedWords = joinedLoose.split(" ").filter(Boolean);

    if (!prevWords.length || joinedWords.length <= prevWords.length) return "";

    const remainingLooseWords = joinedWords.slice(prevWords.length);
    if (!remainingLooseWords.length) return "";

    // Como no podemos reconstruir exactamente puntuación desde loose,
    // usamos una estrategia conservadora:
    // buscar una coincidencia aproximada del último tramo del prev en el joined real.
    const anchor = prevRaw.slice(Math.max(0, prevRaw.length - 12)).trim();
    if (anchor) {
      const idx = joinedRaw.indexOf(anchor);
      if (idx >= 0) {
        const afterAnchor = normalize(joinedRaw.slice(idx + anchor.length));
        if (afterAnchor && afterAnchor !== prevRaw) return afterAnchor;
      }
    }

    return "";
  }

  // ---------------------------------------------------------------------------
  // Leer texto desde nodos
  // ---------------------------------------------------------------------------
  // En Netflix/Max devolvemos metadata extra para poder decidir mejor después.
  // ---------------------------------------------------------------------------
  function readTextFromNodes(nodes, p) {
    if (!nodes?.length) {
      return {
        text: "",
        key: "",
        joinedText: "",
        lineParts: [],
        lineCount: 0
      };
    }

    // -------------------------------------------------------------------------
    // Netflix / Max
    // -------------------------------------------------------------------------
    if (p === "netflix" || p === "max") {
      for (const n of nodes) {
        const el = n?.nodeType === 1 ? n : n?.parentElement;
        if (!el) continue;
        if (isInsideKathWareUI(el)) continue;

        const cont = el.closest?.(".player-timedtext-text-container") || el;
        const key = containerKeyForNode(cont);

        let lineParts = [];

        try {
          const candidates = Array.from(cont.querySelectorAll("span, div")).filter(child => {
            if (!child) return false;
            if (child === cont) return false;
            if (!isVisible(child)) return false;

            const txt = normalize(child.innerText || child.textContent || "");
            if (!txt) return false;
            if (looksLikeNoise(child, txt)) return false;

            return true;
          });

          const seen = new Set();
          for (const child of candidates) {
            const txt = normalize(child.innerText || child.textContent || "");
            if (!txt) continue;
            if (seen.has(txt)) continue;
            seen.add(txt);
            lineParts.push(txt);
          }
        } catch {
          lineParts = [];
        }

        if (lineParts.length) {
          const joinedText = smartJoinLines(lineParts);
          if (joinedText && !isLanguageMenuText(joinedText) && !looksLikeNoise(cont, joinedText)) {
            return {
              text: joinedText,
              key,
              joinedText,
              lineParts,
              lineCount: lineParts.length
            };
          }
        }

        // Fallback: leer todo el contenedor
        let raw = "";
        try {
          raw = cont.innerText || cont.textContent || "";
        } catch {}

        const t = normalize(raw);
        if (!t) continue;
        if (isLanguageMenuText(t)) continue;
        if (looksLikeNoise(cont, t)) continue;

        return {
          text: t,
          key,
          joinedText: t,
          lineParts: t ? [t] : [],
          lineCount: t ? 1 : 0
        };
      }

      return {
        text: "",
        key: "",
        joinedText: "",
        lineParts: [],
        lineCount: 0
      };
    }

    // -------------------------------------------------------------------------
    // Resto de plataformas
    // -------------------------------------------------------------------------
    const parts = [];
    let key = "";

    for (const n of nodes) {
      if (!n) continue;
      if (isInsideKathWareUI(n)) continue;

      if (p === "disney" && !isVisible(n)) continue;

      const t = normalize(n.textContent);
      if (!t) continue;

      if (p === "disney" && isLanguageMenuText(t)) continue;
      if (looksLikeNoise(n, t)) continue;

      if (!key) key = containerKeyForNode(n);
      parts.push(t);
    }

    if (!parts.length) {
      return {
        text: "",
        key: "",
        joinedText: "",
        lineParts: [],
        lineCount: 0
      };
    }

    const joined = smartJoinLines(parts).replace(/\s+/g, " ").trim();

    return {
      text: joined,
      key: key || "no-key",
      joinedText: joined,
      lineParts: parts,
      lineCount: parts.length
    };
  }

  // ---------------------------------------------------------------------------
  // Elegir mejor selector
  // ---------------------------------------------------------------------------
  function pickBestSelector(p) {
    const selectors = getSelectors();

    for (const sel of selectors) {
      const nodes = getFreshNodesBySelector(sel);
      if (!nodes.length) continue;

      const { text } = readTextFromNodes(nodes, p);
      if (text) return sel;
    }

    return "";
  }

  // ---------------------------------------------------------------------------
  // Tiempo del video
  // ---------------------------------------------------------------------------
  function getVideoTimeSec() {
    try {
      const v = S.currentVideo || KWSR.video?.getMainVideo?.();
      if (!v) return null;

      const t = Number(v.currentTime || 0);
      return Number.isFinite(t) ? t : null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Frenar observer
  // ---------------------------------------------------------------------------
  function stopVisualObserver() {
    try {
      S.visualObserver?.disconnect?.();
    } catch {}

    S.visualObserver = null;
    S.visualObserverActive = false;

    S._visualScheduled = false;
    S.visualDirty = false;
    S.visualDirtyAt = 0;
  }

  // ---------------------------------------------------------------------------
  // Resetear memoria visual
  // ---------------------------------------------------------------------------
  function resetVisualDedupe() {
    S._visualLastAt = 0;
    S._visualLastText = "";
    S._visualLastKey = "";
    S._visualLastStrict = "";
    S._visualLastLoose = "";
    S._visualLastVideoTimeSec = null;

    S._visualCueActive = false;
    S._visualCueSince = 0;
    S._visualLastEmptyAt = 0;

    S.lastVisualSeen = "";
  }

  // ---------------------------------------------------------------------------
  // Programar lectura para el próximo frame
  // ---------------------------------------------------------------------------
  function requestVisualFrame(reasonNode) {
    if (S._visualScheduled) return;

    S._visualScheduled = true;

    requestAnimationFrame(() => {
      S._visualScheduled = false;
      pollVisualTick(true, reasonNode);
    });
  }

  // ---------------------------------------------------------------------------
  // Marcar que hay algo nuevo
  // ---------------------------------------------------------------------------
  function scheduleVisualRead(reasonNode) {
    if (S.effectiveFuente !== "visual") return;
    if (reasonNode && isInsideKathWareUI(reasonNode)) return;

    const p = platform();

    if (p === "disney" && reasonNode) {
      try {
        const el = reasonNode.nodeType === 1 ? reasonNode : reasonNode.parentElement;
        if (el && !el.closest?.(".hive-subtitle-renderer-line,[class*='hive-subtitle-renderer-line']")) {
          return;
        }
      } catch {}
    }

    S.visualDirty = true;
    S.visualDirtyAt = performance.now();
    requestVisualFrame(reasonNode);
  }

  // ---------------------------------------------------------------------------
  // Iniciar modo visual
  // ---------------------------------------------------------------------------
  function startVisual() {
    const p = platform();

    S.visualSelectors = getSelectors();
    S.visualSelectorUsed = pickBestSelector(p);

    stopVisualObserver();

    const useDocObserver = !!caps().visualDocObserver;

    try {
      S.visualObserver = new MutationObserver((mutations) => {
        if (!mutations || !mutations.length) return;

        let reasonNode = null;

        for (const m of mutations) {
          if (m.target) {
            reasonNode = m.target;
            break;
          }
          if (m.addedNodes && m.addedNodes[0]) {
            reasonNode = m.addedNodes[0];
            break;
          }
        }

        if (reasonNode && isInsideKathWareUI(reasonNode)) return;
        scheduleVisualRead(reasonNode);
      });

      const target = useDocObserver
        ? document.documentElement
        : (document.body || document.documentElement);

      S.visualObserver.observe(target, {
        childList: true,
        subtree: true,
        characterData: true
      });

      S.visualObserverActive = true;

      if (DEBUG()) {
        KWSR.log?.("VISUAL start", {
          platform: p,
          selector: S.visualSelectorUsed,
          docObserver: useDocObserver
        });
      }
    } catch (e) {
      S.visualObserverActive = false;
      if (DEBUG()) {
        KWSR.warn?.("VISUAL observer failed", { err: String(e?.message || e) });
      }
    }

    KWSR.overlay?.updateOverlayStatus?.();
  }

  // ---------------------------------------------------------------------------
  // TICK PRINCIPAL
  // ---------------------------------------------------------------------------
  function pollVisualTick(fromObserver = false, reasonNode = null) {
    if (!KWSR.voice?.shouldReadNow?.()) return;
    if (S.effectiveFuente !== "visual") return;

    if (!fromObserver && S.visualObserverActive) return;

    if (fromObserver) {
      if (!S.visualDirty) return;
      S.visualDirty = false;
    }

    if (reasonNode && isInsideKathWareUI(reasonNode)) return;

    const p = platform();
    const isRerenderPlatform = (p === "netflix" || p === "max");

    if (!S.visualSelectors) {
      S.visualSelectors = getSelectors();
    }

    if (!S.visualSelectorUsed) {
      S.visualSelectorUsed = pickBestSelector(p);
      if (!S.visualSelectorUsed) return;
    }

    const nodes = getFreshNodesBySelector(S.visualSelectorUsed);
    const {
      text,
      key,
      joinedText,
      lineParts,
      lineCount
    } = readTextFromNodes(nodes, p);

    // Si no hay texto, marcamos que no hay cue activo
    if (!text) {
      S._visualCueActive = false;
      S._visualLastEmptyAt = performance.now();
      return;
    }

    // -------------------------------------------------------------------------
    // Elegir texto efectivo
    // -------------------------------------------------------------------------
    // Normalmente usamos el texto completo.
    // Pero si parece transición "viejo + nuevo", intentamos recortar
    // la parte nueva y usar esa.
    // -------------------------------------------------------------------------
    let effectiveText = text;

    if (
      isRerenderPlatform &&
      S._visualLastText &&
      lineCount >= 2 &&
      joinedContainsPrevious(S._visualLastText, joinedText)
    ) {
      const tail = subtractPreviousFromJoined(S._visualLastText, joinedText);

      if (tail && tail !== S._visualLastText) {
        effectiveText = tail;

        if (DEBUG()) {
          KWSR.log?.("VISUAL overlap-tail", {
            prev: S._visualLastText,
            joinedText,
            tail
          });
        }
      }
    }

    const strict = fpStrict(effectiveText);
    const loose = fpLoose(effectiveText);

    const tNow = getVideoTimeSec();
    const lastT = (typeof S._visualLastVideoTimeSec === "number")
      ? S._visualLastVideoTimeSec
      : null;

    const lastStrict = S._visualLastStrict || "";
    const lastLoose = S._visualLastLoose || "";

    const sameStrict = strict && strict === lastStrict;
    const sameLoose = loose && loose === lastLoose;
    const sameTextish = sameStrict || sameLoose;

    const sameKey = key && key === (S._visualLastKey || "");
    const now = performance.now();

    // -------------------------------------------------------------------------
    // Cue-lock: solo para igualdad real
    // -------------------------------------------------------------------------
    if (isRerenderPlatform && S._visualCueActive && sameTextish) {
      if (DEBUG()) {
        KWSR.log?.("VISUAL cue-lock", {
          text: effectiveText,
          key
        });
      }

      if (tNow != null) {
        S._visualLastVideoTimeSec = tNow;
      }

      return;
    }

    // -------------------------------------------------------------------------
    // Gate por tiempo del video: solo igualdad real
    // -------------------------------------------------------------------------
    if (isRerenderPlatform && tNow != null && lastT != null && sameTextish) {
      const dtVideo = Math.abs(tNow - lastT);
      const gate = (p === "max") ? 0.40 : 0.35;

      if (dtVideo < gate) {
        S._visualLastVideoTimeSec = tNow;
        S._visualLastStrict = strict;
        S._visualLastLoose = loose;

        if (DEBUG()) {
          KWSR.log?.("VISUAL dedupe (videoTime+exact)", {
            dtVideo,
            gate,
            text: effectiveText
          });
        }

        return;
      }
    }

    // -------------------------------------------------------------------------
    // Dedupe temporal normal
    // -------------------------------------------------------------------------
    const minRepeatMs = isRerenderPlatform ? 950 : 700;
    const allowRepeatAfterMs = isRerenderPlatform ? 2200 : 1700;

    if ((sameStrict || sameLoose) && sameKey) {
      const dt = now - (S._visualLastAt || 0);

      if (dt < minRepeatMs) {
        if (DEBUG()) {
          KWSR.log?.("VISUAL dedupe (fast)", {
            dt: Math.round(dt),
            text: effectiveText
          });
        }
        return;
      }

      if (!isRerenderPlatform && dt < allowRepeatAfterMs) {
        if (DEBUG()) {
          KWSR.log?.("VISUAL dedupe (grey)", {
            dt: Math.round(dt),
            text: effectiveText
          });
        }
        return;
      }
    }

    if (!fromObserver && strict && strict === S.lastVisualSeen) return;
    S.lastVisualSeen = strict || effectiveText;

    // Guardar nuevo estado
    S._visualLastText = effectiveText;
    S._visualLastKey = key || "";
    S._visualLastAt = now;
    S._visualLastStrict = strict;
    S._visualLastLoose = loose;
    S._visualCueActive = true;
    S._visualCueSince = now;

    if (tNow != null) {
      S._visualLastVideoTimeSec = tNow;
    }

    if (DEBUG()) {
      KWSR.log?.("VISUAL speak", {
        selector: S.visualSelectorUsed,
        key,
        fromObserver,
        rawText: text,
        effectiveText,
        joinedText,
        lineParts
      });
    }

    KWSR.voice?.leerTextoAccesible?.(effectiveText);
  }

  // ---------------------------------------------------------------------------
  // Re-evaluar selector
  // ---------------------------------------------------------------------------
  function visualReselectTick() {
    const p = platform();
    const next = pickBestSelector(p);

    if (next && next !== (S.visualSelectorUsed || "")) {
      S.visualSelectorUsed = next;
      startVisual();
    }
  }

  // ---------------------------------------------------------------------------
  // Export público
  // ---------------------------------------------------------------------------
  KWSR.visual = {
    startVisual,
    stopVisualObserver,
    pollVisualTick,
    visualReselectTick,
    resetVisualDedupe
  };

})();