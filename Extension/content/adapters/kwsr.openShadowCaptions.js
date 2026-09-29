// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.openShadowCaptions.js
// -----------------------------------------------------------------------------
// Fallback visual para subtítulos renderizados dentro de Shadow DOM abierto.
//
// Objetivo:
// - no crear otro lector por plataforma;
// - reutilizar el pipeline y la voz existentes;
// - intervenir solo cuando el texto visual vive dentro de un shadowRoot;
// - cubrir renderizadores Hive/Disney y otros motores que adopten Shadow DOM.
// -----------------------------------------------------------------------------

// PARA UBICARTE
// Busca subtítulos dentro de componentes con una estructura interna separada.
// Shadow DOM abierto = estructura interna que JavaScript puede consultar.
// Buscá collectShadowRoots para encontrarla y getCandidate para elegir texto.
//

(() => {
  const KWSR = window.KWSR;
  if (!KWSR || !KWSR.visual || KWSR.openShadowCaptions) return;

  const S = KWSR.state;
  const normalize = KWSR.utils?.normalize || ((x) => String(x ?? "").replace(/\s+/g, " ").trim());

  const CAPTION_SELECTOR = [
    ".hive-subtitle-renderer-line",
    "[class*='hive-subtitle']",
    "[class*='subtitle']",
    "[class*='caption']",
    "[class*='timed-text']",
    "[data-testid*='subtitle']",
    "[data-testid*='caption']",
    "[data-uia*='subtitle']",
    "[data-uia*='caption']"
  ].join(",");

  let lastKey = "";
  let lastAt = 0;

  function isInsideKathWareUI(node) {
    try {
      const el = node?.nodeType === 1 ? node : node?.parentElement;
      return !!el?.closest?.(
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

  function isVisible(el) {
    try {
      if (!el || !(el instanceof Element)) return false;
      if (isInsideKathWareUI(el)) return false;

      const style = getComputedStyle(el);
      if (!style) return false;
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (Number(style.opacity || 1) <= 0.01) return false;

      const r = el.getBoundingClientRect();
      return r.width >= 2 && r.height >= 2;
    } catch {
      return false;
    }
  }

  function isLanguageMenuText(text) {
    const t = normalize(text);
    if (!t) return false;

    const lower = t.toLowerCase();
    const strong =
      lower.includes("audio") ||
      lower.includes("subtítulos") ||
      lower.includes("subtitulos") ||
      lower.includes("subtitles") ||
      lower.includes("[cc]");

    if (!strong) return false;

    const langs = [
      "english", "deutsch", "español", "espanol", "français", "francais",
      "italiano", "português", "portugues", "polski", "nederlands",
      "日本語", "한국어", "简体", "繁體"
    ];

    const hits = langs.reduce((acc, lang) => acc + (lower.includes(lang) ? 1 : 0), 0);
    return hits >= 3 || t.length > 180;
  }

  function looksLikeNoise(el, text) {
    const t = normalize(text);
    if (!t || t.length < 2 || t.length > 360) return true;
    if (isInsideKathWareUI(el)) return true;
    if (isLanguageMenuText(t)) return true;

    const tag = (el?.tagName || "").toUpperCase();
    if (["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "LABEL", "OPTION"].includes(tag)) {
      return true;
    }

    try {
      if (el.closest?.("button,a,input,select,textarea,[role='button'],[role='slider'],[role='menu'],[role='dialog']")) {
        return true;
      }
    } catch {}

    const sig = `${el?.id || ""} ${el?.className || ""}`.toLowerCase();
    return /control|button|slider|settings|menu|tooltip|toast|popup|volume|quality|speed|seek|progress|advert|language/.test(sig);
  }

  function collectShadowRoots(root = document, out = []) {
    try {
      root.querySelectorAll("*").forEach((el) => {
        if (!el.shadowRoot) return;
        out.push({ root: el.shadowRoot, host: el });
        collectShadowRoots(el.shadowRoot, out);
      });
    } catch {}

    return out;
  }

  function getVideoRect() {
    try {
      const video = S.currentVideo || KWSR.video?.getMainVideo?.();
      return video?.getBoundingClientRect?.() || null;
    } catch {
      return null;
    }
  }

  function insideVideoArea(rect, videoRect) {
    if (!videoRect) return true;

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    return (
      cx >= videoRect.left - 8 &&
      cx <= videoRect.right + 8 &&
      cy >= videoRect.top - 8 &&
      cy <= videoRect.bottom + 8
    );
  }

  function candidateScore(el, text, videoRect, generic = false) {
    const rect = el.getBoundingClientRect();
    if (!insideVideoArea(rect, videoRect)) return -Infinity;

    let score = Math.min(text.length, 180);
    const sig = `${el.id || ""} ${el.className || ""}`.toLowerCase();

    if (/hive-subtitle/.test(sig)) score += 160;
    else if (/subtitle|caption|timed-text/.test(sig)) score += 110;

    if (videoRect?.height > 0) {
      const relativeBottom = (rect.bottom - videoRect.top) / videoRect.height;
      if (relativeBottom >= 0.48 && relativeBottom <= 0.96) score += 90;
      else if (relativeBottom < 0.30) score -= 80;
    } else if (rect.bottom > innerHeight * 0.45) {
      score += 50;
    }

    if (generic) score -= 45;
    if ((el.children?.length || 0) > 8) score -= 70;

    return score;
  }

  function getCandidate() {
    const roots = collectShadowRoots();
    if (!roots.length) return null;

    const videoRect = getVideoRect();
    const candidates = [];
    const seen = new Set();

    for (const entry of roots) {
      const { root, host } = entry;
      let nodes = [];

      try {
        nodes = Array.from(root.querySelectorAll(CAPTION_SELECTOR));
      } catch {}

      const hostSig = `${host?.tagName || ""} ${host?.id || ""} ${host?.className || ""}`.toLowerCase();
      const hiveLikeRoot = /disney-web-player|hive/.test(hostSig);

      if (hiveLikeRoot) {
        try {
          nodes.push(...root.querySelectorAll("span, p, div"));
        } catch {}
      }

      for (const el of nodes) {
        if (!isVisible(el)) continue;

        const text = normalize(el.innerText || el.textContent || "");
        if (!text || looksLikeNoise(el, text)) continue;

        const key = text.toLowerCase().replace(/\s+/g, " ").trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);

        const sig = `${el.id || ""} ${el.className || ""}`.toLowerCase();
        const generic = !/hive-subtitle|subtitle|caption|timed-text/.test(sig);
        const score = candidateScore(el, text, videoRect, generic);

        if (!Number.isFinite(score)) continue;
        candidates.push({ text, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  }

  function fallbackTick() {
    if (!S.extensionActiva) return false;
    if (S.effectiveFuente !== "visual") return false;
    if (!KWSR.voice?.shouldReadNow?.()) return false;

    const candidate = getCandidate();
    if (!candidate?.text) return false;

    const now = Date.now();
    const key = candidate.text.toLowerCase().replace(/\s+/g, " ").trim();

    if (key === lastKey && now - lastAt < 4000) return true;

    lastKey = key;
    lastAt = now;

    KWSR.voice?.leerTextoAccesible?.(candidate.text);
    return true;
  }

  const originalPollVisualTick = KWSR.visual.pollVisualTick?.bind(KWSR.visual);
  const originalResetVisualDedupe = KWSR.visual.resetVisualDedupe?.bind(KWSR.visual);

  KWSR.visual.pollVisualTick = (...args) => {
    const result = originalPollVisualTick?.(...args);

    try {
      fallbackTick();
    } catch (e) {
      if (KWSR.CFG?.debug && KWSR.CFG?.debugVisual) {
        KWSR.warn?.("Shadow captions fallback failed", {
          err: String(e?.message || e)
        });
      }
    }

    return result;
  };

  KWSR.visual.resetVisualDedupe = (...args) => {
    lastKey = "";
    lastAt = 0;
    return originalResetVisualDedupe?.(...args);
  };

  KWSR.openShadowCaptions = {
    fallbackTick,
    getCandidate,
    collectShadowRoots
  };
})();
