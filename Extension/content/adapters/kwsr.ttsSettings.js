// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.ttsSettings.js
// -----------------------------------------------------------------------------
// Ajustes de sintetizador para 2.2.0-beta.
//
// Problema que corrige:
// - kwsr.voice.js crea cada SpeechSynthesisUtterance con rate = 1.
// - a esa velocidad el sintetizador queda retrasado respecto de subtítulos rápidos.
//
// Esta capa mantiene intacto voice.js y aplica, justo antes de speechSynthesis.speak():
// - voz elegida por el usuario;
// - velocidad elegida por el usuario.
//
// El modo "lector" (aria-live) NO puede modificar la velocidad de NVDA/JAWS:
// esa velocidad pertenece al lector de pantalla, no al navegador.
// -----------------------------------------------------------------------------

(() => {
  const KWSR = window.KWSR;
  if (!KWSR || !KWSR.voice || KWSR.ttsSettings) return;

  const S = KWSR.state;
  const CFG = KWSR.CFG || {};
  const api = KWSR.api;

  const DEFAULT_RATE = 1.75;
  const MIN_RATE = 0.8;
  const MAX_RATE = 3;

  CFG.ttsRate = Number.isFinite(Number(CFG.ttsRate))
    ? Number(CFG.ttsRate)
    : DEFAULT_RATE;

  S.ttsVoiceURI = S.ttsVoiceURI || "";
  S.ttsVoiceName = S.ttsVoiceName || "";

  let speechPatched = false;
  let originalSpeak = null;

  function clampRate(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_RATE;
    return Math.min(MAX_RATE, Math.max(MIN_RATE, n));
  }

  function getVoices() {
    try {
      if (typeof speechSynthesis === "undefined") return [];
      return Array.from(speechSynthesis.getVoices?.() || []);
    } catch {
      return [];
    }
  }

  function voiceKey(voice) {
    return String(voice?.voiceURI || voice?.name || "");
  }

  function getSelectedVoice() {
    const voices = getVoices();
    if (!voices.length) return null;

    if (S.ttsVoiceURI) {
      const exact = voices.find(v => voiceKey(v) === S.ttsVoiceURI);
      if (exact) return exact;
    }

    if (S.ttsVoiceName) {
      const byName = voices.find(v => String(v.name || "") === S.ttsVoiceName);
      if (byName) return byName;
    }

    return S.voiceES ||
      voices.find(v => (v.lang || "").toLowerCase().startsWith("es-ar")) ||
      voices.find(v => (v.lang || "").toLowerCase().startsWith("es")) ||
      voices[0] ||
      null;
  }

  function persist(values) {
    try {
      api?.storage?.local?.set?.(values);
    } catch {}
  }

  function setRate(value, { announce = true } = {}) {
    CFG.ttsRate = clampRate(value);
    persist({ ttsRate: CFG.ttsRate });

    if (announce) {
      try { KWSR.toast?.notify?.(`Velocidad de voz: ${CFG.ttsRate}x`); } catch {}
    }

    syncPanel();
    return CFG.ttsRate;
  }

  function setVoice(value, { announce = true } = {}) {
    const voices = getVoices();
    const selected = voices.find(v => voiceKey(v) === String(value || "")) || null;

    if (selected) {
      S.ttsVoiceURI = voiceKey(selected);
      S.ttsVoiceName = selected.name || "";
      S.voiceES = selected;
    } else {
      S.ttsVoiceURI = "";
      S.ttsVoiceName = "";
      S.voiceES = null;
      try { KWSR.voice?.cargarVozES?.(); } catch {}
    }

    persist({
      ttsVoiceURI: S.ttsVoiceURI,
      ttsVoiceName: S.ttsVoiceName
    });

    if (announce) {
      const label = selected
        ? `${selected.name}${selected.lang ? `, ${selected.lang}` : ""}`
        : "automática";
      try { KWSR.toast?.notify?.(`Voz: ${label}`); } catch {}
    }

    syncPanel();
    return selected;
  }

  function loadSettings() {
    if (!api?.storage?.local?.get) {
      CFG.ttsRate = clampRate(CFG.ttsRate);
      return;
    }

    try {
      api.storage.local.get(
        ["ttsRate", "ttsVoiceURI", "ttsVoiceName"],
        (data) => {
          try {
            CFG.ttsRate = clampRate(data?.ttsRate ?? CFG.ttsRate ?? DEFAULT_RATE);
            S.ttsVoiceURI = String(data?.ttsVoiceURI || "");
            S.ttsVoiceName = String(data?.ttsVoiceName || "");

            const chosen = getSelectedVoice();
            if (chosen && (S.ttsVoiceURI || S.ttsVoiceName)) {
              S.voiceES = chosen;
            }
          } catch {}

          refreshVoiceOptions();
          syncPanel();
        }
      );
    } catch {
      CFG.ttsRate = clampRate(CFG.ttsRate);
    }
  }

  function applySettingsToUtterance(utterance) {
    if (!utterance) return;

    try {
      utterance.rate = clampRate(CFG.ttsRate);
    } catch {}

    try {
      const voice = getSelectedVoice();
      if (voice) {
        utterance.voice = voice;
        if (voice.lang) utterance.lang = voice.lang;
      }
    } catch {}

    if (CFG.debug) {
      try {
        KWSR.log?.("TTS speak", {
          rate: utterance.rate,
          voice: utterance.voice?.name || "default",
          lang: utterance.lang || "",
          text: String(utterance.text || "")
        });
      } catch {}
    }
  }

  function patchSpeechSynthesis() {
    if (speechPatched) return true;

    try {
      if (typeof speechSynthesis === "undefined") return false;
      if (typeof speechSynthesis.speak !== "function") return false;

      const synth = speechSynthesis;
      const instanceSpeak = synth.speak;

      const instanceWrapper = function(utterance) {
        try { applySettingsToUtterance(utterance); } catch {}
        return instanceSpeak.call(synth, utterance);
      };

      try {
        synth.speak = instanceWrapper;
        if (synth.speak === instanceWrapper) {
          originalSpeak = instanceSpeak;
          speechPatched = true;
          return true;
        }
      } catch {}

      const proto = Object.getPrototypeOf(synth);
      const protoSpeak = proto?.speak;
      if (!proto || typeof protoSpeak !== "function") return false;

      const protoWrapper = function(utterance) {
        try { applySettingsToUtterance(utterance); } catch {}
        return protoSpeak.call(this, utterance);
      };

      proto.speak = protoWrapper;
      if (proto.speak !== protoWrapper) return false;

      originalSpeak = protoSpeak;
      speechPatched = true;
      return true;
    } catch (e) {
      if (CFG.debug) {
        KWSR.warn?.("No se pudo interceptar speechSynthesis.speak", String(e?.message || e));
      }
      return false;
    }
  }

  function createSelect(id, labelText) {
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "4px"
    });

    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.textContent = labelText;

    const select = document.createElement("select");
    select.id = id;
    select.setAttribute("aria-label", labelText);
    Object.assign(select.style, {
      width: "100%",
      padding: "8px 10px",
      borderRadius: "10px",
      border: "0"
    });

    wrap.append(label, select);
    return { wrap, select };
  }

  function buildRateOptions(select) {
    if (!select) return;

    const rates = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];
    select.textContent = "";

    for (const rate of rates) {
      const option = document.createElement("option");
      option.value = String(rate);
      option.textContent = `${rate}x`;
      select.appendChild(option);
    }

    select.value = String(clampRate(CFG.ttsRate));
  }

  function refreshVoiceOptions() {
    const select = document.querySelector("#kwsr-tts-voice");
    if (!select) return;

    const current = S.ttsVoiceURI || "";
    const voices = getVoices();

    select.textContent = "";

    const automatic = document.createElement("option");
    automatic.value = "";
    automatic.textContent = "Automática (preferir español)";
    select.appendChild(automatic);

    for (const voice of voices) {
      const option = document.createElement("option");
      option.value = voiceKey(voice);
      option.textContent = `${voice.name || "Voz"}${voice.lang ? ` — ${voice.lang}` : ""}`;
      select.appendChild(option);
    }

    select.value = current;
    if (current && select.value !== current) select.value = "";
  }

  function enhanceOverlay() {
    const panel = S.overlayPanel;
    if (!panel || panel.querySelector("#kwsr-tts-settings")) {
      syncPanel();
      return;
    }

    const section = document.createElement("div");
    section.id = "kwsr-tts-settings";
    section.setAttribute("role", "group");
    section.setAttribute("aria-label", "Ajustes del sintetizador de voz");
    Object.assign(section.style, {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "8px",
      marginTop: "10px"
    });

    const title = document.createElement("div");
    title.textContent = "Sintetizador de voz";
    Object.assign(title.style, { fontWeight: "700" });

    const voiceUI = createSelect("kwsr-tts-voice", "Voz del sintetizador");
    const rateUI = createSelect("kwsr-tts-rate", "Velocidad del sintetizador");

    buildRateOptions(rateUI.select);

    voiceUI.select.addEventListener("change", () => {
      setVoice(voiceUI.select.value);
    });

    rateUI.select.addEventListener("change", () => {
      setRate(rateUI.select.value);
    });

    const note = document.createElement("div");
    note.textContent = "La velocidad del modo Lector se configura en NVDA, JAWS o el lector de pantalla del sistema.";
    Object.assign(note.style, {
      fontSize: "12px",
      opacity: ".9"
    });

    section.append(title, voiceUI.wrap, rateUI.wrap, note);

    const betaTools = panel.querySelector("#kwsr-beta-tools");
    if (betaTools) panel.insertBefore(section, betaTools);
    else panel.appendChild(section);

    refreshVoiceOptions();
    syncPanel();
  }

  function syncPanel() {
    const rate = document.querySelector("#kwsr-tts-rate");
    if (rate) rate.value = String(clampRate(CFG.ttsRate));

    const voice = document.querySelector("#kwsr-tts-voice");
    if (voice) {
      const current = S.ttsVoiceURI || "";
      if (voice.value !== current) voice.value = current;
      if (current && voice.value !== current) voice.value = "";
    }
  }

  function getState() {
    const selected = getSelectedVoice();
    return {
      rate: clampRate(CFG.ttsRate),
      voiceURI: S.ttsVoiceURI || "",
      voiceName: selected?.name || S.ttsVoiceName || "",
      voiceLang: selected?.lang || "",
      voicesAvailable: getVoices().length,
      speechPatched
    };
  }

  const originalEnsureOverlay = KWSR.overlay?.ensureOverlay?.bind(KWSR.overlay);
  const originalSetPanelOpen = KWSR.overlay?.setPanelOpen?.bind(KWSR.overlay);

  if (KWSR.overlay && originalEnsureOverlay) {
    KWSR.overlay.ensureOverlay = (...args) => {
      const result = originalEnsureOverlay(...args);
      enhanceOverlay();
      return result;
    };
  }

  if (KWSR.overlay && originalSetPanelOpen) {
    KWSR.overlay.setPanelOpen = (open) => {
      const result = originalSetPanelOpen(open);
      if (open) enhanceOverlay();
      return result;
    };
  }

  try {
    if (typeof speechSynthesis !== "undefined" && speechSynthesis.addEventListener) {
      speechSynthesis.addEventListener("voiceschanged", () => {
        refreshVoiceOptions();
        const selected = getSelectedVoice();
        if (selected && (S.ttsVoiceURI || S.ttsVoiceName)) S.voiceES = selected;
      });
    }
  } catch {}

  KWSR.ttsSettings = {
    setRate,
    setVoice,
    getVoices,
    getSelectedVoice,
    getState,
    refreshVoiceOptions,
    enhanceOverlay,
    applySettingsToUtterance
  };

  patchSpeechSynthesis();
  loadSettings();
})();
