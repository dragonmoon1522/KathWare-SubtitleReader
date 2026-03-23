// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.visual.js
// -----------------------------------------------------------------------------
//
// QUÉ HACE ESTE ARCHIVO
// ---------------------
// Este módulo lee subtítulos VISUALES del DOM.
//
// Traducción simple:
// - mira nodos de subtítulos en pantalla
// - junta el texto visible
// - evita basura / menús / duplicados
// - le pasa el texto final a KWSR.voice
//
// Este archivo NO:
// - usa textTracks
// - habla por sí solo
// - crea paneles
//
// -----------------------------------------------------------------------------
//
// IDEA GENERAL
// ------------
// Cada plataforma se porta distinto:
//
// - Disney: no hay que filtrar de más o no dispara nunca
// - Netflix: re-renderiza mucho
// - Max: a veces reparte el subtítulo en varios nodos
//
// Esta versión separa esos comportamientos.
//
// -----------------------------------------------------------------------------

(() => {
  const KWSR = window.KWSR;
  if (!KWSR || KWSR.visual) return;

  const S = KWSR.state;
  const CFG = KWSR.CFG;
  const normalize = KWSR.utils?.normalize || ((x) => String(x ?? "").trim());

  const DEBUG = () => !!(CFG?.debug && CFG?.debugVisual);

  // ---------------------------------------------------------------------------
  // Plataforma
  // ---------------------------------------------------------------------------
  function platform() {
    return KWSR.platforms?.getPlatform?.() || "generic";
  }

  function caps() {
    const p = platform();
    return KWSR.platforms?.platformCapabilities?.(p) || {};
  }

  function isNetflix() {
    return platform() === "netflix";
  }

  function isMax() {
    return platform() === "max";
  }

  function isDisney() {
    return platform() === "disney";
  }

  // ---------------------------------------------------------------------------
  // Evitar leer UI propia
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
  // Detectar menús de audio / idiomas / subtítulos
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
      "english", "deutsch", "español", "espanol", "français", "francais", "italiano", "português", "portugues",
      "polski", "magyar", "dansk", "norsk", "svenska", "suomi", "türkçe", "turkce", "čeština", "cestina",
      "română", "romana", "slovenčina", "slovencina", "nederlands", "ελληνικά", "日本語", "한국어",
      "chinese", "简体", "繁體", "粵語", "bokmål", "brasil", "canada"
    ].reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);

    if (hits >= 3) return true;
    if (t.length > 160 && strong) return true;

    return false;
  }

  // ---------------------------------------------------------------------------
  // Filtro anti-basura
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
  // Ver visibilidad real
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
  // Selectores
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
  // Delta simple (para Max)
  // ---------------------------------------------------------------------------
  function computeDelta(prevText, currText) {
    const prev = normalize(prevText);
    const curr = normalize(currText);

    if (!prev || !curr) return "";
    if (curr.length <= prev.length) return "";

    if (curr.toLowerCase().startsWith(prev.toLowerCase())) {
      let tail = curr.slice(prev.length).trim();
      tail = tail.replace(/^[-–—:|•]+\s*/g, "").trim();
      return tail;
    }

    const prevL = fpLoose(prev);
    const currL = fpLoose(curr);

    if (prevL && currL && currL.startsWith(prevL)) {
      const idx = curr.toLowerCase().indexOf(prev.toLowerCase());
      if (idx === 0) {
        let tail = curr.slice(prev.length).trim();
        tail = tail.replace(/^[-–—:|•]+\s*/g, "").trim();
        return tail;
      }
    }

    return "";
  }

  // ---------------------------------------------------------------------------
  // Leer texto desde nodos
  // ---------------------------------------------------------------------------
  function readTextFromNodes(nodes, p) {
    if (!nodes?.length) {
      return {
        text: "",
        key: "",
        lineParts: [],
        lineCount: 0
      };
    }

    // -------------------------------------------------------------------------
    // NETFLIX
    // -------------------------------------------------------------------------
    //
    // Idea simple:
    // - NO reconstruir desde spans internos
    // - NO mezclar niveles distintos del DOM
    // - tomar el texto FINAL del contenedor
    //
    // Esto evita que un subtítulo largo se lea dos veces por aparecer:
    // - una vez en spans internos
    // - y otra vez como bloque completo con <br>
    // -------------------------------------------------------------------------
    if (p === "netflix") {
      for (const n of nodes) {
        const el = n?.nodeType === 1 ? n : n?.parentElement;
        if (!el) continue;
        if (isInsideKathWareUI(el)) continue;

        const cont = el.closest?.(".player-timedtext-text-container") || el;
        const key = containerKeyForNode(cont);

        let raw = "";
        try {
          // innerText suele respetar mejor los <br> y saltos visibles
          raw = cont.innerText || cont.textContent || "";
        } catch {}

        let text = normalize(raw);
        if (!text) continue;

        // Unificar saltos de línea para que:
        // "línea 1\nlínea 2" => "línea 1 línea 2"
        text = text.replace(/\s*\n+\s*/g, " ").replace(/\s+/g, " ").trim();

        if (!text) continue;
        if (isLanguageMenuText(text)) continue;
        if (looksLikeNoise(cont, text)) continue;

        return {
          text,
          key,
          lineParts: [text],
          lineCount: 1
        };
      }

      return {
        text: "",
        key: "",
        lineParts: [],
        lineCount: 0
      };
    }

    // -------------------------------------------------------------------------
    // MAX
    // -------------------------------------------------------------------------
    if (p === "max") {
      const parts = [];
      let key = "";
      const seen = new Set();

      for (const n of nodes) {
        const el = n?.nodeType === 1 ? n : n?.parentElement;
        if (!el) continue;
        if (isInsideKathWareUI(el)) continue;
        if (!isVisible(el)) continue;

        const t = normalize(el.innerText || el.textContent || "");
        if (!t) continue;
        if (looksLikeNoise(el, t)) continue;
        if (seen.has(t)) continue;

        seen.add(t);
        if (!key) key = containerKeyForNode(el);
        parts.push(t);
      }

      if (!parts.length) {
        return {
          text: "",
          key: "",
          lineParts: [],
          lineCount: 0
        };
      }

      const joined = smartJoinLines(parts);

      return {
        text: joined,
        key: key || "no-key",
        lineParts: parts,
        lineCount: parts.length
      };
    }

    // -------------------------------------------------------------------------
    // DISNEY / RESTO
    // -------------------------------------------------------------------------
    const parts = [];
    let key = "";

    for (const n of nodes) {
      if (!n) continue;
      if (isInsideKathWareUI(n)) continue;

      const t = normalize(n.textContent || n.innerText || "");
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
        lineParts: [],
        lineCount: 0
      };
    }

    const joined = smartJoinLines(parts).replace(/\s+/g, " ").trim();

    return {
      text: joined,
      key: key || "no-key",
      lineParts: parts,
      lineCount: parts.length
    };
  }

  // ---------------------------------------------------------------------------
  // Elegir selector
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

    S._visualPendingText = "";
    S._visualPendingStrict = "";
    S._visualPendingLoose = "";
    S._visualPendingKey = "";
    S._visualPendingSince = 0;

    S._visualLastDeltaStrict = "";
    S._visualLastDeltaLoose = "";
    S._nfLastStrict = "";
    S._nfLastAt = 0;
    S.lastVisualSeen = "";
  }

  // ---------------------------------------------------------------------------
  // Programar lectura en próximo frame
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
  // Marcar cambios
  // ---------------------------------------------------------------------------
  function scheduleVisualRead(reasonNode) {
    if (S.effectiveFuente !== "visual") return;
    if (reasonNode && isInsideKathWareUI(reasonNode)) return;

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

    if (!S.visualSelectors) {
      S.visualSelectors = getSelectors();
    }

    if (!S.visualSelectorUsed) {
      S.visualSelectorUsed = pickBestSelector(p);
      if (!S.visualSelectorUsed) return;
    }

    const nodes = getFreshNodesBySelector(S.visualSelectorUsed);
    const { text, key, lineParts, lineCount } = readTextFromNodes(nodes, p);

    // -------------------------------------------------------------------------
    // SIN TEXTO → RESET
    // -------------------------------------------------------------------------
    if (!text) {
      const emptyNow = performance.now();
      const p2 = platform();

      // Netflix a veces vacía el cue un instante y lo vuelve a insertar igual.
      // No soltamos el lock enseguida o el mismo subtítulo entra como "nuevo".
      if (p2 === "netflix") {
        S._visualLastEmptyAt = emptyNow;

        const graceMs = 900;
        const sinceLastSpeak = emptyNow - (S._visualLastAt || 0);

        if (S._visualCueActive && sinceLastSpeak < graceMs) {
          return;
        }
      }

      S._visualCueActive = false;
      S._visualLastEmptyAt = emptyNow;

      S._visualPendingText = "";
      S._visualPendingStrict = "";
      S._visualPendingLoose = "";
      S._visualPendingKey = "";
      S._visualPendingSince = 0;

      return;
    }

    const strict = fpStrict(text);
    const loose = fpLoose(text);

    const lastStrict = S._visualLastStrict || "";
    const lastLoose = S._visualLastLoose || "";

    const sameStrict = strict && strict === lastStrict;
    const sameLoose = loose && loose === lastLoose;
    const sameExactish = sameStrict || sameLoose;

    const now = performance.now();
    const tNow = getVideoTimeSec();
    const lastT = (typeof S._visualLastVideoTimeSec === "number")
      ? S._visualLastVideoTimeSec
      : null;

    // =========================================================================
    // DISNEY
    // =========================================================================
    if (isDisney()) {
      const sameKey = key && key === (S._visualLastKey || "");
      const minRepeatMs = 600;

      if (sameExactish && sameKey) {
        const dt = now - (S._visualLastAt || 0);
        if (dt < minRepeatMs) return;
      }

      S._visualLastText = text;
      S._visualLastKey = key || "";
      S._visualLastAt = now;
      S._visualLastStrict = strict;
      S._visualLastLoose = loose;
      S._visualCueActive = true;
      S._visualCueSince = now;

      if (tNow != null) S._visualLastVideoTimeSec = tNow;

      if (DEBUG()) {
        KWSR.log?.("VISUAL disney speak", { text, lineParts, lineCount });
      }

      KWSR.voice?.leerTextoAccesible?.(text);
      return;
    }

    // =========================================================================
    // NETFLIX
    // =========================================================================
    if (isNetflix()) {
      const settleMs = 120;

      if (S._visualCueActive && sameExactish) {
        return;
      }

      if (strict !== (S._visualPendingStrict || "")) {
        S._visualPendingText = text;
        S._visualPendingStrict = strict;
        S._visualPendingLoose = loose;
        S._visualPendingKey = key || "";
        S._visualPendingSince = now;
        return;
      }

      const pendingAge = now - (S._visualPendingSince || 0);
      if (pendingAge < settleMs) return;

      if (sameExactish) return;

      const sameNetflixRecent =
        strict &&
        strict === (S._nfLastStrict || "") &&
        (now - (S._nfLastAt || 0)) < 4000;

      if (sameNetflixRecent) {
        if (DEBUG()) {
          KWSR.log?.("VISUAL netflix suppress exact recent repeat", {
            text,
            strict,
            age: Math.round(now - (S._nfLastAt || 0))
          });
        }
        return;
      }

      S._visualLastText = text;
      S._visualLastKey = key || "";
      S._visualLastAt = now;
      S._visualLastStrict = strict;
      S._visualLastLoose = loose;
      S._visualCueActive = true;
      S._visualCueSince = now;
      S.lastVisualSeen = strict || text;

      if (tNow != null) S._visualLastVideoTimeSec = tNow;

      S._nfLastStrict = strict;
      S._nfLastAt = now;

      if (DEBUG()) {
        KWSR.log?.("VISUAL netflix speak", { text, lineParts, lineCount });
      }

      KWSR.voice?.leerTextoAccesible?.(text);
      return;
    }

    // =========================================================================
    // MAX
    // =========================================================================
    if (isMax()) {
      const sameKey = key && key === (S._visualLastKey || "");
      const settleMs = 80;

      if (strict !== (S._visualPendingStrict || "")) {
        S._visualPendingStrict = strict;
        S._visualPendingSince = now;
        return;
      }

      const pendingAge = now - (S._visualPendingSince || 0);
      if (pendingAge < settleMs) return;

      if (S._visualCueActive && sameKey && sameExactish) {
        return;
      }

      const prevText = S._visualLastText || "";
      const delta = prevText ? computeDelta(prevText, text) : "";
      const closeInTime = (tNow != null && lastT != null)
        ? Math.abs(tNow - lastT) < 1.2
        : (now - (S._visualLastAt || 0)) < 1500;

      if (delta && delta.length >= 2 && closeInTime && sameKey) {
        const deltaStrict = fpStrict(delta);
        const deltaLoose = fpLoose(delta);

        const sameDelta =
          (deltaStrict && deltaStrict === (S._visualLastDeltaStrict || "")) ||
          (deltaLoose && deltaLoose === (S._visualLastDeltaLoose || ""));

        if (!sameDelta) {
          S._visualLastText = text;
          S._visualLastKey = key || "";
          S._visualLastAt = now;
          S._visualLastStrict = strict;
          S._visualLastLoose = loose;
          S._visualCueActive = true;
          S._visualCueSince = now;
          S._visualLastDeltaStrict = deltaStrict || "";
          S._visualLastDeltaLoose = deltaLoose || "";

          if (tNow != null) S._visualLastVideoTimeSec = tNow;

          if (DEBUG()) {
            KWSR.log?.("VISUAL max delta", { delta, text, lineParts, lineCount });
          }

          KWSR.voice?.leerTextoAccesible?.(delta);
        }

        return;
      }

      S._visualLastText = text;
      S._visualLastKey = key || "";
      S._visualLastAt = now;
      S._visualLastStrict = strict;
      S._visualLastLoose = loose;
      S._visualCueActive = true;
      S._visualCueSince = now;
      S._visualLastDeltaStrict = "";
      S._visualLastDeltaLoose = "";

      if (tNow != null) S._visualLastVideoTimeSec = tNow;

      if (DEBUG()) {
        KWSR.log?.("VISUAL max full", { text, lineParts, lineCount });
      }

      KWSR.voice?.leerTextoAccesible?.(text);
      return;
    }

    // =========================================================================
    // GENERIC
    // =========================================================================
    if (sameExactish) return;

    S._visualLastText = text;
    S._visualLastKey = key || "";
    S._visualLastAt = now;
    S._visualLastStrict = strict;
    S._visualLastLoose = loose;

    if (tNow != null) S._visualLastVideoTimeSec = tNow;

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