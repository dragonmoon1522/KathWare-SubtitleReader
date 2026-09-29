// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.vixPlayerA11y.js
// -----------------------------------------------------------------------------
// Compatibilidad 2.2.0-beta para el reproductor de ViX.
//
// Problema:
// - ViX puede renderizar controles sin nombre o sin semántica suficiente.
// - La capa general nonAccessible no estaba habilitada para ViX.
// - Algunos controles modernos pueden ser div/componentes con SVG y no entrar en
//   los selectores conservadores del adaptador general.
//
// Esta capa:
// - habilita keepAlive + nonAccessibleFixes para ViX;
// - deja correr el adaptador general existente;
// - agrega un barrido específico dentro de #video-player para controles que el
//   detector general no ve;
// - nunca toca subtítulos ni la UI de KathWare.
// -----------------------------------------------------------------------------

(() => {
  const KWSR = window.KWSR;
  if (!KWSR || KWSR.vixPlayerA11y) return;

  const S = KWSR.state;
  const normalize = KWSR.utils?.normalize || (s => String(s || "").replace(/\s+/g, " ").trim());

  const OUR_UI =
    "#kathware-overlay-root," +
    "#kathware-overlay-panel," +
    "#kw-toast," +
    "#kwsr-live-region," +
    "#kathware-live-region";

  const CONTROL_SELECTOR = [
    "button",
    "[role='button']",
    "[aria-controls]",
    "[tabindex]",
    "[data-testid]",
    "[data-action]",
    "[data-control]",
    "[class*='button']",
    "[class*='Button']",
    "[class*='control']",
    "[class*='Control']"
  ].join(",");

  let observer = null;
  let scheduled = false;
  let lastSummary = "";

  function isVix() {
    return (KWSR.platforms?.getPlatform?.() || "") === "vix";
  }

  const originalCapabilities = KWSR.platforms?.platformCapabilities?.bind(KWSR.platforms);
  if (originalCapabilities) {
    KWSR.platforms.platformCapabilities = (p) => {
      const caps = { ...(originalCapabilities(p) || {}) };
      if (p === "vix") {
        caps.keepAlive = true;
        caps.nonAccessibleFixes = true;
      }
      return caps;
    };
  }

  function isVisible(el) {
    try {
      if (!el || !(el instanceof Element)) return false;
      if (el.closest?.(OUR_UI)) return false;

      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      if (Number(cs.opacity || 1) < 0.05) return false;

      const r = el.getBoundingClientRect();
      return r.width >= 12 && r.height >= 12;
    } catch {
      return false;
    }
  }

  function isProbablyInteractive(el) {
    try {
      const tag = (el.tagName || "").toUpperCase();
      if (["BUTTON", "A", "INPUT", "SELECT"].includes(tag)) return true;
      if ((el.getAttribute("role") || "").toLowerCase() === "button") return true;
      if (el.hasAttribute("aria-controls")) return true;
      if (el.hasAttribute("data-action") || el.hasAttribute("data-control") || el.hasAttribute("data-testid")) return true;
      if (el.hasAttribute("onclick")) return true;

      const ti = el.getAttribute("tabindex");
      if (ti !== null && Number(ti) >= 0) return true;

      const sig = `${el.id || ""} ${el.className || ""}`.toLowerCase();
      if (/button|control|play|pause|mute|volume|fullscreen|caption|subtitle|setting|seek|forward|back|rewind/.test(sig)) {
        return true;
      }

      return getComputedStyle(el).cursor === "pointer";
    } catch {
      return false;
    }
  }

  function nearVideo(el, video, root) {
    try {
      if (root?.contains(el)) return true;
      if (!video) return false;

      const vr = video.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const margin = 80;

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

  function signalBlob(el) {
    try {
      const child = el.querySelector?.("svg,[data-icon],[class*='icon'],[class*='Icon']");
      const childTitle = normalize(child?.querySelector?.("title")?.textContent || "");

      return normalize([
        el.id || "",
        el.className || "",
        el.getAttribute("title") || "",
        el.getAttribute("name") || "",
        el.getAttribute("data-testid") || "",
        el.getAttribute("data-action") || "",
        el.getAttribute("data-control") || "",
        el.getAttribute("data-icon") || "",
        el.getAttribute("aria-describedby") || "",
        child?.getAttribute?.("data-icon") || "",
        child?.getAttribute?.("aria-label") || "",
        child?.getAttribute?.("class") || "",
        childTitle
      ].join(" ")).toLowerCase();
    } catch {
      return "";
    }
  }

  function guessLabel(el) {
    const existing = normalize(el.getAttribute("aria-label") || "");
    if (existing && el.getAttribute("data-kw-autolabel") !== "1") return existing;

    const text = normalize(el.innerText || el.textContent || "");
    if (text && text.length <= 80) return text;

    const title = normalize(el.getAttribute("title") || "");
    if (title) return title;

    const blob = signalBlob(el);

    if (/pause|pausa/.test(blob)) return "Pausar";
    if (/play|reproduc/.test(blob)) return "Reproducir";
    if (/replay|restart|reiniciar/.test(blob)) return "Reiniciar reproducción";
    if (/rewind|backward|back-?10|seek-?back|retroced/.test(blob)) return "Retroceder";
    if (/forward|skip-?forward|forward-?10|seek-?forward|adelant/.test(blob)) return "Avanzar";
    if (/unmute|sound-?on|volume-?off/.test(blob)) return "Activar sonido";
    if (/mute|volume|sound|volumen|silencio/.test(blob)) return "Volumen o silenciar";
    if (/exit-?full|compress/.test(blob)) return "Salir de pantalla completa";
    if (/fullscreen|full-?screen|pantalla completa/.test(blob)) return "Pantalla completa";
    if (/subtitle|caption|closed-?caption|\bcc\b|subt[ií]t/.test(blob)) return "Subtítulos";
    if (/audio/.test(blob)) return "Audio";
    if (/setting|config|gear/.test(blob)) return "Configuración";
    if (/picture-?in-?picture|\bpip\b/.test(blob)) return "Imagen en imagen";
    if (/cast|chromecast/.test(blob)) return "Transmitir";
    if (/episode|episod/.test(blob)) return "Episodios";
    if (/next|siguiente/.test(blob)) return "Siguiente";
    if (/previous|prev|anterior/.test(blob)) return "Anterior";
    if (/close|cerrar|dismiss/.test(blob)) return "Cerrar";
    if (/more|menu|overflow/.test(blob)) return "Más opciones";

    return "Control del reproductor";
  }

  function applyLabel(el, label) {
    try {
      if (!el || !label) return false;

      const realLabel = normalize(el.getAttribute("aria-label") || "");
      const ours = el.getAttribute("data-kw-autolabel") === "1";
      const shouldSetLabel = !realLabel || (ours && realLabel !== label);

      if (shouldSetLabel) {
        el.setAttribute("aria-label", label);
        el.setAttribute("data-kw-autolabel", "1");
      }

      const tag = (el.tagName || "").toUpperCase();
      if (!["BUTTON", "A", "INPUT", "SELECT"].includes(tag) && !el.getAttribute("role")) {
        el.setAttribute("role", "button");
      }

      if (!["BUTTON", "A", "INPUT", "SELECT"].includes(tag) && !el.hasAttribute("tabindex")) {
        el.setAttribute("tabindex", "0");
      }

      return shouldSetLabel;
    } catch {
      return false;
    }
  }

  function scan() {
    if (!S.extensionActiva || !isVix()) return { found: 0, labeled: 0, unresolved: 0 };

    const video = S.currentVideo || KWSR.video?.getMainVideo?.();
    const root = document.querySelector("#video-player") ||
      video?.closest?.("[id*='video-player'],[class*='video-player'],[class*='player'],[class*='Player']") ||
      video?.parentElement ||
      null;

    const scope = root || document;
    let candidates = [];

    try {
      candidates = Array.from(scope.querySelectorAll(CONTROL_SELECTOR));
    } catch {}

    const seen = new Set();
    let labeled = 0;
    let unresolved = 0;
    const debugControls = [];

    for (const el of candidates) {
      if (!el || seen.has(el)) continue;
      seen.add(el);

      if (!isVisible(el)) continue;
      if (!isProbablyInteractive(el)) continue;
      if (!nearVideo(el, video, root)) continue;

      if (el.tagName === "P") continue;
      if (el.closest?.("#kwsr-tts-settings,#kwsr-beta-tools")) continue;

      const label = guessLabel(el);
      if (label === "Control del reproductor") unresolved++;

      if (applyLabel(el, label)) labeled++;

      if (KWSR.CFG?.debug) {
        debugControls.push({
          tag: el.tagName,
          label,
          id: el.id || "",
          className: String(el.className || "").slice(0, 100),
          testId: el.getAttribute("data-testid") || ""
        });
      }
    }

    const result = { found: candidates.length, labeled, unresolved };
    const summary = JSON.stringify(result);

    if (KWSR.CFG?.debug && summary !== lastSummary) {
      lastSummary = summary;
      console.log("[KathWare] ViX player accessibility", result, debugControls);
    }

    return result;
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  }

  function startObserver() {
    if (observer || !isVix()) return;

    try {
      observer = new MutationObserver(() => scheduleScan());
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "aria-hidden"]
      });
    } catch {
      observer = null;
    }
  }

  const originalTick = KWSR.nonAccessiblePlatforms?.tick?.bind(KWSR.nonAccessiblePlatforms);
  if (KWSR.nonAccessiblePlatforms && originalTick) {
    KWSR.nonAccessiblePlatforms.tick = (...args) => {
      const result = originalTick(...args);
      if (isVix()) {
        startObserver();
        scan();
      }
      return result;
    };
  }

  KWSR.vixPlayerA11y = {
    scan,
    startObserver,
    guessLabel,
    signalBlob
  };

  startObserver();
})();
