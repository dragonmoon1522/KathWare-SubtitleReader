// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.voice.js
// -----------------------------------------------------------------------------
//
// QUÉ HACE ESTE ARCHIVO
// ---------------------
// Este módulo se encarga de la SALIDA final del subtítulo.
//
// Traducción a idioma simple:
// - otro módulo detecta el texto
// - este módulo decide si hay que leerlo o no
// - y si hay que leerlo:
//   - lo manda al lector de pantalla (aria-live)
//   - o al sintetizador de voz (speechSynthesis)
//
// Este archivo NO:
// - detecta subtítulos en pantalla
// - busca spans ni divs
// - decide selectores
//
// Solo recibe texto ya detectado y dice:
// "¿esto se lee? ¿cómo se lee? ¿hay que ignorarlo porque es repetido?"
//
// -----------------------------------------------------------------------------
//
// PROBLEMA QUE TENÍAMOS
// ---------------------
// Este archivo estaba haciendo demasiadas cosas “inteligentes”:
// - dedupe global
// - delta / rolling captions
// - comparación por texto "parecido"
//
// Eso en teoría parecía buena idea.
// En la práctica, con Netflix/Max y DOM raro:
//
// - repetía subtítulos largos
// - a veces cortaba frases
// - a veces hablaba solo la cola
// - a veces confundía subtítulos distintos pero parecidos
//
// -----------------------------------------------------------------------------
//
// DECISIÓN DE ESTA VERSIÓN
// ------------------------
// Hacemos este módulo MÁS SIMPLE y más estable.
//
// O sea:
// - dedupe exacto o casi exacto -> sí
// - inventar deltas para Netflix/Max -> no, por ahora no
// - tratar textos “parecidos” como si fueran el mismo -> no
//
// En resumen:
// este archivo deja de adivinar tanto.
//
// -----------------------------------------------------------------------------


(() => {
  const KWSR = window.KWSR;
  if (!KWSR || KWSR.voice) return;

  const S = KWSR.state;
  const CFG = KWSR.CFG;
  const normalize = KWSR.utils?.normalize || ((x) => String(x ?? "").trim());

  // ---------------------------------------------------------------------------
  // Estado interno del módulo
  // ---------------------------------------------------------------------------
  // Esto vive solo mientras la página está abierta.
  // No se guarda en storage.
  // ---------------------------------------------------------------------------
  let lastSpeakAt = 0;
  let ttsBrokenUntil = 0;
  let lastTtsError = "";
  let watchdogTimer = null;

  // Si TTS falla, pasar automáticamente a modo lector
  const AUTO_SWITCH_TO_READER_ON_TTS_FAIL = true;

  // Para no enganchar onvoiceschanged muchas veces
  let voicesHooked = false;

  // ---------------------------------------------------------------------------
  // Helpers: plataforma / videoTime
  // ---------------------------------------------------------------------------
  function platform() {
    try {
      return KWSR.platforms?.getPlatform?.() || "generic";
    } catch {
      return "generic";
    }
  }

  function isRerenderPlatform() {
    const p = platform();
    return (p === "netflix" || p === "max");
  }

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
  // Live Region (aria-live)
  // ---------------------------------------------------------------------------
  //
  // Esto crea un div invisible que los lectores de pantalla pueden anunciar.
  // Sirve para el modo "lector".
  // ---------------------------------------------------------------------------
  function ensureLiveRegion() {
    if (S.liveRegion) return;

    const div = document.createElement("div");
    div.id = "kwsr-live-region";
    div.setAttribute("role", "status");
    div.setAttribute("aria-live", "polite");
    div.setAttribute("aria-atomic", "true");

    Object.assign(div.style, {
      position: "fixed",
      left: "-9999px",
      top: "0",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      clip: "rect(1px, 1px, 1px, 1px)",
      clipPath: "inset(50%)",
      whiteSpace: "nowrap"
    });

    document.documentElement.appendChild(div);
    S.liveRegion = div;
  }

  // ---------------------------------------------------------------------------
  // pushToLiveRegion(text)
  // ---------------------------------------------------------------------------
  // Truco clásico:
  // primero vaciamos el contenido,
  // luego lo seteamos con un mini timeout.
  //
  // Esto ayuda a que algunos lectores vuelvan a anunciar el texto.
  // ---------------------------------------------------------------------------
  function pushToLiveRegion(text) {
    ensureLiveRegion();

    try {
      S.liveRegion.textContent = "";

      setTimeout(() => {
        if (!S.liveRegion) return;
        S.liveRegion.textContent = String(text ?? "");
      }, 10);
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // TTS (speechSynthesis)
  // ---------------------------------------------------------------------------
  function isTTSAvailable() {
    return (
      typeof speechSynthesis !== "undefined" &&
      typeof SpeechSynthesisUtterance !== "undefined"
    );
  }

  // ---------------------------------------------------------------------------
  // cargarVozES()
  // ---------------------------------------------------------------------------
  // Busca una voz en español, idealmente es-AR.
  // Si no hay, usa alguna es-*.
  // Si no hay nada, usa la primera disponible.
  // ---------------------------------------------------------------------------
  function cargarVozES() {
    try {
      if (!isTTSAvailable()) return;

      const pick = (voices) => {
        return (
          voices.find(v => (v.lang || "").toLowerCase().startsWith("es-ar")) ||
          voices.find(v => (v.lang || "").toLowerCase().startsWith("es")) ||
          voices.find(v => (v.lang || "").toLowerCase().includes("es")) ||
          voices[0] ||
          null
        );
      };

      const voces = speechSynthesis.getVoices?.() || [];
      if (voces.length) {
        S.voiceES = pick(voces);
      }

      if (!voicesHooked) {
        voicesHooked = true;

        speechSynthesis.onvoiceschanged = () => {
          try {
            const v2 = speechSynthesis.getVoices?.() || [];
            if (v2.length) S.voiceES = pick(v2) || S.voiceES || null;
          } catch {}
        };
      }
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // hardResetTTS()
  // ---------------------------------------------------------------------------
  // Cancela cualquier voz pendiente o colgada.
  // ---------------------------------------------------------------------------
  function hardResetTTS() {
    try {
      if (!isTTSAvailable()) return;
      speechSynthesis.cancel?.();
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Watchdog helpers
  // ---------------------------------------------------------------------------
  function clearWatchdog() {
    try {
      if (watchdogTimer) clearTimeout(watchdogTimer);
    } catch {}

    watchdogTimer = null;
  }

  // ---------------------------------------------------------------------------
  // markTTSBroken(reason)
  // ---------------------------------------------------------------------------
  // Marca TTS como roto por unos segundos,
  // limpia cola y hace fallback a lector si está habilitado.
  // ---------------------------------------------------------------------------
  function markTTSBroken(reason) {
    lastTtsError = String(reason || "unknown");
    ttsBrokenUntil = Date.now() + 4000;

    S.ttsLastError = lastTtsError;
    S.ttsBrokenUntil = ttsBrokenUntil;

    KWSR.warn?.("TTS error", { msg: lastTtsError });

    hardResetTTS();

    if (AUTO_SWITCH_TO_READER_ON_TTS_FAIL) {
      S.modoNarradorGlobal = "lector";

      try {
        KWSR.api?.storage?.local?.set?.({ modoNarrador: "lector" });
      } catch {}

      try {
        KWSR.toast?.notify?.("⚠️ Falló la voz. Pasé a modo Lector automáticamente.");
      } catch {}

      try {
        KWSR.overlay?.updateOverlayStatus?.();
      } catch {}
    }
  }

  // ---------------------------------------------------------------------------
  // maybeUnstickTTS()
  // ---------------------------------------------------------------------------
  // Si speechSynthesis parece colgado demasiado tiempo,
  // lo cancelamos y marcamos error.
  // ---------------------------------------------------------------------------
  function maybeUnstickTTS() {
    try {
      if (!isTTSAvailable()) return;

      const now = Date.now();
      const speaking = !!speechSynthesis.speaking;
      const stuckTooLong = speaking && (now - lastSpeakAt > 5500);

      if (stuckTooLong) {
        KWSR.warn?.("TTS parecía colgado, cancel()");
        hardResetTTS();
        markTTSBroken("stuck_speaking_timeout");
      }
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // shouldReadNow()
  // ---------------------------------------------------------------------------
  // Decide si en ESTE momento se permite leer.
  //
  // Reglas:
  // - la extensión tiene que estar activa
  // - el modo narrador no puede ser "off"
  // - el video no debe estar pausado o terminado
  // ---------------------------------------------------------------------------
  function shouldReadNow() {
    if (!S.extensionActiva) return false;
    if (!S.modoNarradorGlobal || S.modoNarradorGlobal === "off") return false;

    try {
      const v = S.currentVideo;
      if (v && (v.paused || v.ended)) return false;
    } catch {}

    maybeUnstickTTS();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Fingerprints (huellas)
  // ---------------------------------------------------------------------------
  // Sirven para comparar textos de forma consistente.
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
  // computeDelta(prevClean, currClean)
  // ---------------------------------------------------------------------------
  // Esta función calcula "solo la parte nueva" cuando un texto crece.
  //
  // EJEMPLO:
  // prev = "Hola"
  // curr = "Hola ¿todo bien?"
  // delta = "¿todo bien?"
  //
  // OJO:
  // En esta versión NO la usamos para Netflix/Max.
  // La dejamos por si en el futuro la querés reactivar en otras plataformas.
  // ---------------------------------------------------------------------------
  function computeDelta(prevClean, currClean) {
    const prev = normalize(prevClean);
    const curr = normalize(currClean);
    if (!prev || !curr) return "";

    const prevN = prev.replace(/\s+/g, " ").trim();
    const currN = curr.replace(/\s+/g, " ").trim();

    if (currN.length <= prevN.length) return "";

    if (currN.toLowerCase().startsWith(prevN.toLowerCase())) {
      let tail = currN.slice(prevN.length).trim();
      tail = tail.replace(/^[-–—:|•]+\s*/g, "").trim();
      return tail;
    }

    const prevL = fpLoose(prevN);
    const currL = fpLoose(currN);

    if (prevL && currL && currL.startsWith(prevL) && currN.length > prevN.length) {
      const idx = currN.toLowerCase().indexOf(prevN.toLowerCase());
      if (idx === 0) {
        let tail = currN.slice(prevN.length).trim();
        tail = tail.replace(/^[-–—:|•]+\s*/g, "").trim();
        return tail;
      }
    }

    return "";
  }

  // ---------------------------------------------------------------------------
  // dedupeAndDelta(raw)
  // ---------------------------------------------------------------------------
  //
  // Recibe texto crudo y devuelve:
  // - "" si NO hay que leerlo
  // - texto final si SÍ hay que leerlo
  //
  // Esta versión está simplificada a propósito.
  // Queremos:
  // - dedupe confiable
  // - menos "inteligencia" peligrosa
  // - nada de delta en Netflix/Max
  // ---------------------------------------------------------------------------
    function dedupeAndDelta(raw) {
    const clean = normalize(raw);
    if (!clean) return "";

    const strictKey = fpStrict(clean);
    const looseKey = fpLoose(clean);
    if (!strictKey && !looseKey) return "";

    const now = Date.now();
    const dt = now - (S.lastEmitAt || 0);

    const lastStrict = S.lastEmitStrictKey || "";
    const lastLoose = S.lastEmitLooseKey || "";

    const sameTextish =
      (strictKey && strictKey === lastStrict) ||
      (looseKey && looseKey === lastLoose);

    // -------------------------------------------------------------------------
    // 0) Gate por videoTime (anti re-render)
    // -------------------------------------------------------------------------
    if (isRerenderPlatform() && sameTextish) {
      const tNow = getVideoTimeSec();
      const lastT = (typeof S.lastEmitVideoTimeSec === "number")
        ? S.lastEmitVideoTimeSec
        : null;

      if (tNow != null && lastT != null) {
        const dtVideo = Math.abs(tNow - lastT);
        const gate = (platform() === "max") ? 0.45 : 0.35;

        if (dtVideo < gate) {
          S.lastEmitVideoTimeSec = tNow;
          return "";
        }
      }
    }

    // -------------------------------------------------------------------------
    // 1) Anti-eco inmediato
    // -------------------------------------------------------------------------
    const baseEcho = (CFG.echoMs ?? 380);
    const echoMs = isRerenderPlatform() ? Math.max(baseEcho, 520) : baseEcho;

    if (dt < echoMs && sameTextish) {
      return "";
    }

    // -------------------------------------------------------------------------
    // 2) Cooldown normal
    // -------------------------------------------------------------------------
    const base = (CFG.cooldownMs ?? 650);
    const extra = Math.min(1100, strictKey.length * 12);
    const windowMs = base + extra;

    // -------------------------------------------------------------------------
    // 3) Delta
    // -------------------------------------------------------------------------
    const canDelta = false;

    if (canDelta && S.lastEmitText) {
      const tNow = getVideoTimeSec();
      const lastT = (typeof S.lastEmitVideoTimeSec === "number")
        ? S.lastEmitVideoTimeSec
        : null;

      const okWindow = (tNow != null && lastT != null)
        ? (Math.abs(tNow - lastT) < 1.25)
        : (dt < 1600);

      if (okWindow) {
        const delta = computeDelta(S.lastEmitText, clean);

        if (delta && delta.length >= 2) {
          S.lastEmitStrictKey = strictKey;
          S.lastEmitLooseKey = looseKey;
          S.lastEmitAt = now;
          S.lastEmitText = clean;

          const vt = getVideoTimeSec();
          if (vt != null) S.lastEmitVideoTimeSec = vt;

          return delta;
        }
      }
    }

    // -------------------------------------------------------------------------
    // 4) Si es exactamente lo mismo dentro de la ventana, no repetir
    // -------------------------------------------------------------------------
    if (strictKey === lastStrict && dt < windowMs) return "";

    // -------------------------------------------------------------------------
    // 5) Anti-repetición larga en plataformas con re-render
    // -------------------------------------------------------------------------
    const rerenderRepeatMs = (platform() === "netflix") ? 4200 : 2600;

    if (isRerenderPlatform() && sameTextish && dt < rerenderRepeatMs) {
      return "";
    }

    // -------------------------------------------------------------------------
    // Guardar estado global de dedupe
    // -------------------------------------------------------------------------
    S.lastEmitStrictKey = strictKey;
    S.lastEmitLooseKey = looseKey;
    S.lastEmitAt = now;
    S.lastEmitText = clean;

    const vt = getVideoTimeSec();
    if (vt != null) S.lastEmitVideoTimeSec = vt;

    return clean;
  }

  // ---------------------------------------------------------------------------
  // speakTTS(text)
  // ---------------------------------------------------------------------------
  //
  // Devuelve:
  // - true si intentó hablar o consideró que ya estaba cubierto
  // - false si falló y conviene fallback a lector
  // ---------------------------------------------------------------------------
  function speakTTS(text) {
    if (!isTTSAvailable()) {
      markTTSBroken("speechSynthesis_not_available");
      return false;
    }

    const now = Date.now();
    if (now < ttsBrokenUntil) return false;

    cargarVozES();

    try {
      clearWatchdog();

      // -----------------------------------------------------------------------
      // Anti-eco TTS
      // -----------------------------------------------------------------------
      // Si el mismo texto llega dos veces muy pegado al sintetizador,
      // no lo mandamos de nuevo.
      // -----------------------------------------------------------------------
      const tKey = fpStrict(text);
      if (
        tKey &&
        (tKey === (S.lastSpokenKey || "")) &&
        (now - (S.lastSpokenAt || 0) < (CFG.ttsEchoMs ?? 350))
      ) {
        return true;
      }

      // Limpiar cola para evitar acumulación
      try {
        speechSynthesis.cancel?.();
      } catch {}

      const u = new SpeechSynthesisUtterance(text);
      if (S.voiceES) u.voice = S.voiceES;

      u.lang = (S.voiceES?.lang) || "es-ES";
      u.rate = 1;
      u.pitch = 1;
      u.volume = 1;

      let finished = false;

      u.onstart = () => {
        lastSpeakAt = Date.now();
        S.lastSpokenKey = tKey || "";
        S.lastSpokenAt = Date.now();
      };

      u.onend = () => {
        finished = true;
        clearWatchdog();
      };

      u.onerror = (ev) => {
        finished = true;
        clearWatchdog();

        const msg = String(ev?.error || ev?.message || "tts_error");
        markTTSBroken(msg);
      };

      // Watchdog por si queda colgado
      watchdogTimer = setTimeout(() => {
        if (finished) return;
        markTTSBroken("watchdog_no_end_no_error");
      }, Math.max(2500, (CFG.ttsWatchdogMs || 4500)));

      speechSynthesis.speak(u);
      lastSpeakAt = Date.now();

      return true;
    } catch (e) {
      markTTSBroken(String(e?.message || e));
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // API pública: leerTextoAccesible(raw)
  // ---------------------------------------------------------------------------
  //
  // Esta es la entrada principal desde visual.js o track.js.
  // Hace:
  // - shouldReadNow()
  // - dedupe global
  // - lector vs sintetizador
  // - fallback si TTS falla
  // ---------------------------------------------------------------------------
  function leerTextoAccesible(raw) {
    if (!shouldReadNow()) return;

    const text = dedupeAndDelta(raw);
    if (!text) return;

    // Mostrar en overlay solo si está habilitado explícitamente
    if (CFG?.overlayShowText === true) {
      try {
        KWSR.overlay?.updateOverlayText?.(text);
      } catch {}
    }

    // Modo lector
    if (S.modoNarradorGlobal === "lector") {
      pushToLiveRegion(text);
      return;
    }

    // Modo sintetizador
    const ok = speakTTS(text);
    if (!ok) pushToLiveRegion(text);
  }

  // ---------------------------------------------------------------------------
  // API pública: detenerLectura()
  // ---------------------------------------------------------------------------
  //
  // Se usa cuando:
  // - se apaga la extensión
  // - el usuario pone modo off
  // - reiniciamos el pipeline
  // ---------------------------------------------------------------------------
  function detenerLectura() {
    try { clearWatchdog(); } catch {}
    try { hardResetTTS(); } catch {}
    try {
      if (S.liveRegion) S.liveRegion.textContent = "";
    } catch {}

    // Reset dedupe global
    S.lastEmitAt = 0;
    S.lastEmitText = "";
    S.lastEmitStrictKey = "";
    S.lastEmitLooseKey = "";
    S.lastEmitVideoTimeSec = null;

    // Reset anti-eco TTS
    S.lastSpokenAt = 0;
    S.lastSpokenKey = "";
  }

  // ---------------------------------------------------------------------------
  // Export público
  // ---------------------------------------------------------------------------
  KWSR.voice = {
    cargarVozES,
    shouldReadNow,
    leerTextoAccesible,
    detenerLectura,
    pushToLiveRegion
  };

})();