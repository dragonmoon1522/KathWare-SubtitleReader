// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.visual.js
// -----------------------------------------------------------------------------
//
// QUÉ HACE ESTE ARCHIVO
// ---------------------
// Este módulo se encarga de leer subtítulos VISUALES.
// Eso significa:
//
// - NO lee pistas de video.textTracks
// - NO decide cómo hablarlos
// - NO crea interfaz
//
// Solo hace esto:
// 1. Busca subtítulos dibujados en pantalla (en el DOM)
// 2. Junta el texto visible
// 3. Evita leer basura, menús o duplicados
// 4. Le pasa el texto final a KWSR.voice
//
// IDEA SIMPLE
// -----------
// Pantalla -> este archivo mira
// Texto -> este archivo limpia
// Voz -> otro módulo lo habla
//
// -----------------------------------------------------------------------------
//
// PROBLEMA REAL QUE RESUELVE
// --------------------------
// En plataformas como Netflix y Max, el subtítulo puede verse quieto,
// PERO el DOM internamente cambia muchas veces.
//
// Ejemplo:
//
// 1. "Hola, Conan."
// 2. Netflix re-renderiza el mismo bloque
// 3. Parece nuevo para el código
// 4. Si no filtramos bien, se vuelve a leer
//
// Peor todavía: a veces aparece un estado intermedio:
//
// 1. "Hola, Conan."
// 2. "Hola, Conan. Hola profesor Agasa, cómo está?"
// 3. "Hola profesor Agasa, cómo está?"
//
// Ese paso 2 NO es un subtítulo real estable.
// Es una transición fea del DOM.
// Este archivo intenta ignorar ese estado intermedio.
//
// -----------------------------------------------------------------------------
//
// REGLAS IMPORTANTES
// ------------------
// - Este módulo NO habla directo.
// - Este módulo NO debe leer nuestra propia UI.
// - Este módulo NO debe leer menús de audio/subtítulos.
// - Este módulo NO debe releer el mismo cue por re-render.
//
// -----------------------------------------------------------------------------
//
// NOTA PARA MI YO DEL FUTURO
// --------------------------
// Si algo falla en Netflix, casi seguro el problema está en UNA de estas 3 cosas:
//
// 1. selector equivocado
// 2. snapshot de contenedor que mezcla cue viejo + nuevo
// 3. dedupe insuficiente
//
// -----------------------------------------------------------------------------


(() => {
  // ---------------------------------------------------------------------------
  // Arranque seguro del módulo
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
  // Detectar texto de menús de idioma / audio / subtítulos
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
  // Clave de contenedor
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
  // Leer texto desde nodos
  // ---------------------------------------------------------------------------
  // IMPORTANTE:
  // Para Netflix/Max devolvemos también un poco de metadata:
  //
  // - joinedText: todo lo encontrado junto
  // - lineCount: cuántas partes distintas vimos
  //
  // Eso sirve para detectar mejor las transiciones raras.
  // ---------------------------------------------------------------------------
  function readTextFromNodes(nodes, p) {
    if (!nodes?.length) {
      return { text: "", key: "", joinedText: "", lineCount: 0 };
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

        const key = containerKeyForNode(cont);

        // Si vimos varias partes distintas, armamos un "joinedText"
        // con todo, pero elegimos como texto principal la ÚLTIMA parte.
        //
        // ¿Por qué?
        // Porque en Netflix muchas veces:
        // - arriba queda residuo del cue viejo
        // - abajo aparece el nuevo
        if (lineParts.length >= 2) {
          const joinedText = smartJoinLines(lineParts);
          const lastLine = normalize(lineParts[lineParts.length - 1]);

          if (lastLine && !isLanguageMenuText(lastLine) && !looksLikeNoise(cont, lastLine)) {
            return {
              text: lastLine,
              key,
              joinedText,
              lineCount: lineParts.length
            };
          }
        }

        // Fallback clásico: leer el contenedor completo
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
          lineCount: t ? 1 : 0
        };
      }

      return { text: "", key: "", joinedText: "", lineCount: 0 };
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
      return { text: "", key: "", joinedText: "", lineCount: 0 };
    }

    const joined = smartJoinLines(parts).replace(/\s+/g, " ").trim();

    return {
      text: joined,
      key: key || "no-key",
      joinedText: joined,
      lineCount: parts.length
    };
  }

  // ---------------------------------------------------------------------------
  // Elegir el mejor selector
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
  // Fingerprints
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
  // Detectar transición fea de solapamiento
  // ---------------------------------------------------------------------------
  // OJO:
  // Esta función sola NO alcanza.
  // También vamos a exigir:
  // - que haya varias líneas/partes detectadas
  // - y que el texto "junto" contenga el anterior
  //
  // Así evitamos comernos subtítulos legítimos que solo se parecen un poco.
  // ---------------------------------------------------------------------------
  function isOverlapTransition(prevText, nextJoinedText, nextMainText, lineCount) {
    const prev = fpLoose(prevText || "");
    const joined = fpLoose(nextJoinedText || "");
    const main = fpLoose(nextMainText || "");

    if (!prev || !joined || !main) return false;

    // Si no hay varias partes, no asumimos transición.
    if (!lineCount || lineCount < 2) return false;

    // Si el texto principal sigue siendo exactamente el anterior,
    // esto no es "overlap", es simplemente repetición.
    if (main === prev) return false;

    // Caso típico:
    // prev = "hola conan"
    // joined = "hola conan hola profesor agasa como esta"
    // main = "hola profesor agasa como esta"
    if (joined.startsWith(prev + " ")) return true;
    if (joined.includes(" " + prev + " ")) return true;

    return false;
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
  // Pedir lectura en próximo frame
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
  // Iniciar visual
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
      lineCount
    } = readTextFromNodes(nodes, p);

    // Si no hay texto visible, reseteamos cue activo.
    if (!text) {
      S._visualCueActive = false;
      S._visualLastEmptyAt = performance.now();
      return;
    }

    const strict = fpStrict(text);
    const loose = fpLoose(text);

    const tNow = getVideoTimeSec();
    const lastT = (typeof S._visualLastVideoTimeSec === "number")
      ? S._visualLastVideoTimeSec
      : null;

    const lastStrict = S._visualLastStrict || "";
    const lastLoose = S._visualLastLoose || "";

    // -------------------------------------------------------------------------
    // OJO ACÁ:
    // -------------------------------------------------------------------------
    // Antes usábamos un "sameTextish" demasiado permisivo,
    // incluyendo contains/includes.
    //
    // Eso ayudaba a parar duplicados,
    // PERO también se comía subtítulos nuevos parecidos.
    //
    // Ahora, para Netflix/Max, solo tratamos como "igual"
    // lo que sea igual de verdad.
    // -------------------------------------------------------------------------
    const sameStrict = strict && strict === lastStrict;
    const sameLoose = loose && loose === lastLoose;

    const sameTextish = sameStrict || sameLoose;

    const sameKey = key && key === (S._visualLastKey || "");
    const now = performance.now();

    // -------------------------------------------------------------------------
    // Detectar transición fea de overlap
    // -------------------------------------------------------------------------
    // Solo si:
    // - estamos en Netflix/Max
    // - había texto anterior
    // - hay varias partes detectadas
    // - el texto "junto" contiene claramente al anterior
    // - y el texto principal ya es otro
    // -------------------------------------------------------------------------
    const overlapTransition =
      isRerenderPlatform &&
      S._visualLastText &&
      isOverlapTransition(S._visualLastText, joinedText, text, lineCount);

    if (overlapTransition) {
      if (DEBUG()) {
        KWSR.log?.("VISUAL overlap-transition", {
          prev: S._visualLastText,
          joinedText,
          nextMain: text,
          lineCount
        });
      }
      return;
    }

    // -------------------------------------------------------------------------
    // Cue-lock fuerte, pero SOLO para igualdad real
    // -------------------------------------------------------------------------
    // Si el mismo cue sigue activo y es esencialmente idéntico,
    // no lo releemos.
    //
    // Ya NO bloqueamos "parecidos".
    // Solo exactos.
    // -------------------------------------------------------------------------
    if (isRerenderPlatform && S._visualCueActive && sameTextish) {
      if (DEBUG()) {
        KWSR.log?.("VISUAL cue-lock", { text, key });
      }

      if (tNow != null) {
        S._visualLastVideoTimeSec = tNow;
      }

      return;
    }

    // -------------------------------------------------------------------------
    // Gate por tiempo del video
    // -------------------------------------------------------------------------
    // También lo dejamos solo para igualdad real.
    // Si el video casi no avanzó PERO el texto cambió de verdad,
    // debemos permitirlo.
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
            text
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
            text
          });
        }
        return;
      }

      if (!isRerenderPlatform && dt < allowRepeatAfterMs) {
        if (DEBUG()) {
          KWSR.log?.("VISUAL dedupe (grey)", {
            dt: Math.round(dt),
            text
          });
        }
        return;
      }
    }

    if (!fromObserver && strict && strict === S.lastVisualSeen) return;
    S.lastVisualSeen = strict || text;

    // Guardamos nuevo estado
    S._visualLastText = text;
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
        text,
        joinedText,
        lineCount
      });
    }

    KWSR.voice?.leerTextoAccesible?.(text);
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