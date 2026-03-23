// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.visual.js
// -----------------------------------------------------------------------------

(() => {
  const KWSR = window.KWSR;
  if (!KWSR || KWSR.visual) return;

  const S = KWSR.state;
  const CFG = KWSR.CFG;
  const normalize = KWSR.utils?.normalize || ((x) => String(x ?? "").trim());

  const DEBUG = () => !!(CFG?.debug && CFG?.debugVisual);

  function platform() {
    return KWSR.platforms?.getPlatform?.() || "generic";
  }

  function isNetflix() { return platform() === "netflix"; }
  function isMax() { return platform() === "max"; }
  function isDisney() { return platform() === "disney"; }

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

  function looksLikeNoise(node, text) {
    const t = normalize(text);
    if (!t) return true;
    if (isInsideKathWareUI(node)) return true;

    const tag = (node?.tagName || "").toUpperCase();
    if (["A","BUTTON","INPUT","TEXTAREA","SELECT","LABEL"].includes(tag)) return true;

    if (t.length < 2 || t.length > 420) return true;

    return false;
  }

  function isVisible(el) {
    try {
      if (!el || !(el instanceof Element)) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;

      const r = el.getBoundingClientRect();
      return !(r.width < 2 && r.height < 2);
    } catch {
      return false;
    }
  }

  function getSelectors() {
    return KWSR.platforms?.platformSelectors?.(platform()) || [];
  }

  function getFreshNodesBySelector(sel) {
    try {
      return Array.from(document.querySelectorAll(sel))
        .filter(n => !isInsideKathWareUI(n));
    } catch {
      return [];
    }
  }

  function containerKeyForNode(n) {
    try {
      const el = n?.nodeType === 1 ? n : n?.parentElement;
      if (!el) return "no-el";

      const wrap =
        el.closest?.("[class*='caption'],[class*='subtitle'],[class*='timedtext']") || el;

      return (wrap.className || "").toString().slice(0, 120);
    } catch {
      return "key-err";
    }
  }

  function smartJoinLines(parts) {
    return normalize(parts.join(" "));
  }

  function fpLoose(text) {
    return normalize(text)
      .replace(/[^\w\s]/g, "")
      .toLowerCase();
  }

  // -----------------------------------------------------------------------------
  // 🔥 NETFLIX FIX REAL
  // -----------------------------------------------------------------------------
  function readTextFromNodes(nodes, p) {
    if (!nodes?.length) return { text: "", key: "" };

    if (p === "netflix") {
  for (const n of nodes) {
    const el = n?.nodeType === 1 ? n : n?.parentElement;
    if (!el) continue;
    if (isInsideKathWareUI(el)) continue;

    const cont = el.closest?.(".player-timedtext-text-container") || el;
    const key = containerKeyForNode(cont);

    let raw = "";
    try {
      raw = cont.innerText || cont.textContent || "";
    } catch {}

    let text = normalize(raw);
    if (!text) continue;

    // 🔥 CLAVE: normalizar saltos de línea
    text = text.replace(/\s*\n\s*/g, " ").trim();

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

    // -----------------------------------------------------------------------------
    // MAX (ya te funcionaba)
    // -----------------------------------------------------------------------------
    if (p === "max") {
      const parts = [];
      let key = "";

      for (const n of nodes) {
        const el = n?.nodeType === 1 ? n : n?.parentElement;
        if (!el || !isVisible(el)) continue;

        const t = normalize(el.innerText || "");
        if (!t) continue;

        if (!key) key = containerKeyForNode(el);
        parts.push(t);
      }

      return {
        text: smartJoinLines(parts),
        key
      };
    }

    // -----------------------------------------------------------------------------
    // DISNEY / GENERIC
    // -----------------------------------------------------------------------------
    const parts = [];
    let key = "";

    for (const n of nodes) {
      const t = normalize(n.innerText || "");
      if (!t) continue;

      if (!key) key = containerKeyForNode(n);
      parts.push(t);
    }

    return {
      text: smartJoinLines(parts),
      key
    };
  }

  // -----------------------------------------------------------------------------
  // CORE LOOP
  // -----------------------------------------------------------------------------
  function pollVisualTick() {
    if (!KWSR.voice?.shouldReadNow?.()) return;

    const p = platform();

    if (!S.visualSelectorUsed) {
      S.visualSelectorUsed = getSelectors()[0];
      if (!S.visualSelectorUsed) return;
    }

    const nodes = getFreshNodesBySelector(S.visualSelectorUsed);
    const { text, key } = readTextFromNodes(nodes, p);

    if (!text) return;

    if (text === S._lastText) return;

    S._lastText = text;

    if (DEBUG()) {
      KWSR.log?.("VISUAL speak", { p, text });
    }

    KWSR.voice?.leerTextoAccesible?.(text);
  }

  function startVisual() {
    S.visualSelectorUsed = getSelectors()[0];

    setInterval(pollVisualTick, 120);
  }

  function stopVisualObserver() {}

  function visualReselectTick() {}

  function resetVisualDedupe() {
    S._lastText = "";
  }

  KWSR.visual = {
    startVisual,
    stopVisualObserver,
    pollVisualTick,
    visualReselectTick,
    resetVisualDedupe
  };

})();