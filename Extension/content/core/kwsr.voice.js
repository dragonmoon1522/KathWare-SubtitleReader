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


// PARA UBICARTE
// Recibe texto y lo entrega al lector de pantalla o a la voz del navegador.
// Deduplicar significa evitar que el mismo texto se anuncie varias veces.
// Buscá leerTextoAccesible para la entrada y dedupeAndDelta para los filtros.
//

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
  let lastTtsError = "";
  let activeTTS = null;
  // Pensá en una fila: quien está hablando termina; los demás esperan su turno.
  // La fila vive en esta página. No cambia ninguna preferencia guardada.
  const ttsQueue = [];
  let ttsQueueTimer = null;
  let ttsVideo = null;
  let unwatchTTSVideo = null;
  let ttsStatus = "idle";
  let lastTtsNoticeAt = -Infinity;
  const TTS_RECOVERY_REVISION = 2;
  const LIVE_REGION_REVISION = 1;
  const pendingAnnouncements = new Set();

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

  // Diagnóstico optativo: registrar la entrega no debe afectar la lectura.
  function traceFlowOutput(stage, text) {
    try { KWSR.flowTiming?.noteOutput?.(stage, text); } catch {}
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
  function liveRegionContext() {
    let fullscreen = document.fullscreenElement;
    // En un Shadow DOM abierto, el documento expone el host, no el nodo interior.
    while (fullscreen?.shadowRoot?.fullscreenElement) {
      fullscreen = fullscreen.shadowRoot.fullscreenElement;
    }
    const tag = fullscreen?.tagName || "";
    const nativeMedia = /^(VIDEO|AUDIO)$/.test(tag);
    const replacedElement = /^(VIDEO|AUDIO|IFRAME|OBJECT|EMBED|CANVAS|IMG)$/.test(tag);
    return {
      fullscreen,
      // Los hijos de video son contenido alternativo: no son una región accesible
      // fiable en la pantalla completa nativa. No fingimos resolver ese caso.
      host: fullscreen && !replacedElement
        ? (fullscreen.shadowRoot || fullscreen) : document.documentElement,
      scope: !fullscreen ? "document" : nativeMedia ? "native-media-fullscreen"
        : replacedElement ? "unsupported-fullscreen-element" : "container-fullscreen"
    };
  }

  function ensureLiveRegion() {
    if (!S.liveRegion) {
      const div = document.createElement("div");
      div.id = "kwsr-live-region";
      div.setAttribute("role", "status");
      div.setAttribute("aria-live", "polite");
      div.setAttribute("aria-atomic", "true");
      Object.assign(div.style, {
        position: "fixed", left: "0", top: "0", width: "1px", height: "1px",
        overflow: "hidden", clip: "rect(1px, 1px, 1px, 1px)",
        clipPath: "inset(50%)", whiteSpace: "nowrap"
      });
      S.liveRegion = div;
    }
    const { host } = liveRegionContext();
    if (host && S.liveRegion.parentNode !== host) {
      // Mover la misma región vacía evita repetir el último subtítulo. No depende
      // del panel (que puede estar oculto), ni cambia el foco o el capturador.
      S.liveRegion.textContent = "";
      host.appendChild(S.liveRegion);
    }
    return S.liveRegion;
  }

  function getLiveRegionState() {
    const { fullscreen, scope } = liveRegionContext();
    const region = S.liveRegion;
    return {
      revision: LIVE_REGION_REVISION,
      scope,
      fullscreenTag: fullscreen?.tagName || "",
      connected: !!region?.isConnected,
      hostTag: region?.parentNode?.tagName || region?.parentNode?.nodeName || "",
      insideFullscreen: !!(fullscreen && region && (
        fullscreen.contains(region) || fullscreen.shadowRoot?.contains(region)
      )),
      text: String(region?.textContent || "").slice(0, 500)
    };
  }

  document.addEventListener("fullscreenchange", () => {
    if (S.extensionActiva && S.modoNarradorGlobal === "lector") ensureLiveRegion();
  });

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
      const outputMode = S.modoNarradorGlobal;
      const timer = setTimeout(() => {
        pendingAnnouncements.delete(timer);
        if (S.modoNarradorGlobal !== outputMode || !shouldReadNow()) return;
        // El modo de pantalla puede cambiar durante la espera del anuncio.
        ensureLiveRegion().textContent = String(text ?? "");
        traceFlowOutput("live-region", text);
      }, 10);
      pendingAnnouncements.add(timer);
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
  // cargarVoz()
  // ---------------------------------------------------------------------------
  // Respeta la elección guardada; en automático usa la predeterminada del
  // navegador, sin elegir idioma ni país por cuenta de la extensión.
  // ---------------------------------------------------------------------------
  function cargarVoz() {
    try {
      if (!isTTSAvailable()) return;

      const pick = (voices) => {
        if (S.ttsVoiceURI || S.ttsVoiceName) {
          return voices.find(v => S.ttsVoiceURI && String(v.voiceURI || v.name || "") === S.ttsVoiceURI) ||
            voices.find(v => S.ttsVoiceName && v.name === S.ttsVoiceName) || null;
        }
        return voices.find(v => v.default) || null;
      };

      const voces = speechSynthesis.getVoices?.() || [];
      S.voiceES = pick(voces);

      if (!voicesHooked) {
        voicesHooked = true;

        speechSynthesis.onvoiceschanged = () => {
          try {
            const v2 = speechSynthesis.getVoices?.() || [];
            S.voiceES = pick(v2);
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
  // Recuperación de TTS: respetar el modo elegido y los eventos de cada frase.
  // ---------------------------------------------------------------------------
  function ttsLimit(name, fallback, min, max) {
    const value = Number(CFG?.[name] ?? fallback);
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
  }

  function ttsContextIsCurrent(job) {
    const v = S.currentVideo;
    return S.extensionActiva && S.modoNarradorGlobal === "sintetizador" &&
      v === job.video && !v?.paused && !v?.ended &&
      String(v?.currentSrc || v?.src || "") === job.source;
  }

  function clearTTSTimer(job) {
    if (job?.timer != null) clearTimeout(job.timer);
    if (job) { job.timer = null; job.deadlineAt = null; }
  }

  function stopTTSJob(job = activeTTS, cancel = true) {
    if (!job || activeTTS !== job) return;
    // Invalidar ANTES de cancel(): el motor puede emitir error sincrónicamente.
    activeTTS = null;
    clearTTSTimer(job);
    ttsStatus = "idle";
    if (cancel) hardResetTTS();
  }

  function clearTTSQueue(cancel = true) {
    // Si cambiamos de escena, nadie debe seguir leyendo la escena anterior.
    ttsQueue.length = 0;
    if (ttsQueueTimer != null) clearTimeout(ttsQueueTimer);
    ttsQueueTimer = null;
    stopTTSJob(activeTTS, false);
    ttsStatus = "idle";
    unwatchTTSVideo?.();
    unwatchTTSVideo = null;
    ttsVideo = null;
    if (cancel) hardResetTTS();
  }

  function watchTTSVideo(video) {
    if (unwatchTTSVideo && ttsVideo === video) return;
    unwatchTTSVideo?.();
    ttsVideo = video;
    const events = ["pause", "seeking", "emptied", "ended"];
    const invalidate = () => clearTTSQueue();
    for (const event of events) video?.addEventListener?.(event, invalidate);
    // También vigilamos entre dos frases, cuando todavía no empezó la siguiente.
    unwatchTTSVideo = () => {
      for (const event of events) video?.removeEventListener?.(event, invalidate);
    };
  }

  function advanceTTSQueue() {
    if (activeTTS || ttsQueueTimer != null) return;
    if (!ttsQueue.length) {
      unwatchTTSVideo?.();
      unwatchTTSVideo = null;
      ttsVideo = null;
      return;
    }
    // Un turno breve deja que el motor termine de cerrar la frase anterior.
    // Además evita llamadas encadenadas si un motor responde sin esperar.
    ttsQueueTimer = setTimeout(() => {
      ttsQueueTimer = null;
      const job = ttsQueue.shift();
      if (!job) return;
      if (!ttsContextIsCurrent(job)) { clearTTSQueue(); return; }
      activeTTS = job;
      startTTSAttempt(job);
    }, 0);
  }

  function currentTTSAttempt(job, utterance) {
    if (activeTTS !== job || job.utterance !== utterance) return false;
    if (ttsContextIsCurrent(job)) return true;
    clearTTSQueue();
    return false;
  }

  function armTTSTimer(job, ms, callback) {
    clearTTSTimer(job);
    job.deadlineAt = Date.now() + ms;
    job.timer = setTimeout(() => {
      if (activeTTS !== job) return;
      if (!ttsContextIsCurrent(job)) { clearTTSQueue(); return; }
      callback();
    }, ms);
  }

  function speechTimeBudget(utterance, charIndex = 0) {
    const rate = Math.max(0.1, Number(utterance.rate) || 1);
    const remaining = Math.max(0, utterance.text.length - charIndex);
    // Margen conservador, ajustado al texto y a la velocidad efectiva. Los
    // eventos de avance renuevan el margen; no suponemos que hablar >5 s es fallar.
    return Math.min(120000, Math.max(
      ttsLimit("ttsWatchdogMs", 15000, 15000, 120000),
      Math.ceil(remaining / (10 * rate) * 1000) + 8000
    ));
  }

  function failTTSAttempt(job, utterance, reason) {
    if (!currentTTSAttempt(job, utterance)) return;
    const error = String(reason || "tts_error");
    if (error === "canceled" || error === "interrupted") {
      clearTTSQueue(false);
      return;
    }
    lastTtsError = error;
    S.ttsLastError = error;
    try { KWSR.warn?.("TTS error", { msg: error, attempt: job.attempt }); } catch {}
    const retries = Math.floor(ttsLimit("ttsMaxRetries", 1, 0, 2));
    const retryable = !/^(not-allowed|voice-unavailable|language-unavailable|text-too-long|invalid-argument|speechSynthesis_not_available)$/.test(error);
    const retry = !job.started && retryable && job.attempt <= retries;
    // Los callbacks de este intento quedan obsoletos aunque siga el mismo texto.
    job.utterance = null;
    clearTTSTimer(job);
    hardResetTTS();
    if (retry) {
      job.phase = "retry-wait";
      armTTSTimer(job, ttsLimit("ttsRetryDelayMs", 500, 100, 3000), () => startTTSAttempt(job));
      return;
    }
    stopTTSJob(job, false);
    ttsStatus = "failed";
    // El usuario conserva el modo y la voz. Un subtítulo nuevo puede intentar
    // nuevamente; no guardamos ni forzamos "lector" como consecuencia de un fallo.
    if (Date.now() - lastTtsNoticeAt >= 10000) {
      lastTtsNoticeAt = Date.now();
      try {
        KWSR.toast?.notify?.("No se pudo completar la lectura con voz. Podés elegir otra voz o reiniciar la lectura.");
      } catch {}
    }
    advanceTTSQueue();
  }

  function startTTSAttempt(job) {
    if (activeTTS !== job) return;
    if (!ttsContextIsCurrent(job)) { clearTTSQueue(); return; }
    job.phase = "starting";
    job.started = false;
    job.progress = 0;
    job.attempt++;
    job.utterance = null;
    clearTTSTimer(job);
    hardResetTTS();
    if (!isTTSAvailable()) {
      failTTSAttempt(job, null, "speechSynthesis_not_available");
      return;
    }
    try {
      cargarVoz();
      if ((S.ttsVoiceURI || S.ttsVoiceName) && !S.voiceES) {
        failTTSAttempt(job, null, "voice-unavailable");
        return;
      }
      const u = new SpeechSynthesisUtterance(job.text);
      job.utterance = u;
      if (S.voiceES) u.voice = S.voiceES;
      if (S.voiceES?.lang) u.lang = S.voiceES.lang;
      u.rate = 1;
      u.pitch = 1;
      u.volume = 1;

      u.onstart = () => {
        if (!currentTTSAttempt(job, u)) return;
        job.started = true;
        job.phase = "speaking";
        S.lastSpokenKey = job.key;
        S.lastSpokenAt = Date.now();
        traceFlowOutput("tts-start", job.text);
        armTTSTimer(job, speechTimeBudget(u), () => failTTSAttempt(job, u, "watchdog_no_end"));
      };
      u.onboundary = ev => {
        if (!currentTTSAttempt(job, u) || !job.started) return;
        const index = Number(ev?.charIndex);
        if (!Number.isInteger(index) || index <= job.progress || index > job.text.length) return;
        job.progress = index;
        armTTSTimer(job, speechTimeBudget(u, index), () => failTTSAttempt(job, u, "watchdog_no_end"));
      };
      u.onend = () => {
        if (!currentTTSAttempt(job, u)) return;
        stopTTSJob(job, false);
        advanceTTSQueue();
      };
      u.onerror = ev => failTTSAttempt(job, u, ev?.error || ev?.message || "tts_error");

      armTTSTimer(job, ttsLimit("ttsStartTimeoutMs", 10000, 5000, 60000),
        () => failTTSAttempt(job, u, "watchdog_no_start"));
      if (speechSynthesis.paused) speechSynthesis.resume?.();
      speechSynthesis.speak(u);
    } catch (e) {
      failTTSAttempt(job, job.utterance, e?.message || e);
    }
  }

  function getTTSState() {
    return {
      revision: TTS_RECOVERY_REVISION,
      phase: activeTTS?.phase || ttsStatus,
      attempt: activeTTS?.attempt || 0,
      started: !!activeTTS?.started,
      queued: ttsQueue.length,
      deadlineAt: activeTTS?.deadlineAt ?? null,
      lastError: lastTtsError
    };
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
  // Permite leer solo si la extensión y el modo de lectura están activados.
  // Si hay un video pausado o terminado, la lectura espera.
  function shouldReadNow() {
    if (!S.extensionActiva) return false;
    if (!S.modoNarradorGlobal || S.modoNarradorGlobal === "off") return false;

    try {
      const v = S.currentVideo;
      if (v && (v.paused || v.ended)) return false;
    } catch {}

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
  // Ambos modos reciben el mismo texto, filtrado una sola vez más abajo.
  // En modo voz, un subtítulo nuevo espera. No le quitamos la palabra al anterior.
  function speakTTS(text) {
    const key = fpStrict(text);
    if ((activeTTS && !ttsContextIsCurrent(activeTTS)) ||
        (ttsQueue.length && !ttsContextIsCurrent(ttsQueue[0]))) clearTTSQueue();
    const video = S.currentVideo;
    const job = {
      text, key, video, source: String(video?.currentSrc || video?.src || ""),
      attempt: 0, utterance: null, timer: null, started: false
    };
    watchTTSVideo(video);
    if (activeTTS || ttsQueueTimer != null) {
      ttsQueue.push(job);
      return;
    }
    activeTTS = job;
    startTTSAttempt(job);
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
  // - recuperación de TTS sin cambiar el modo elegido
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
    speakTTS(text);
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
    for (const timer of pendingAnnouncements) clearTimeout(timer);
    pendingAnnouncements.clear();
    clearTTSQueue(false);
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
    cargarVoz,
    cargarVozES: cargarVoz, // Alias para los módulos existentes.
    shouldReadNow,
    leerTextoAccesible,
    detenerLectura,
    pushToLiveRegion,
    prepareLiveRegion: ensureLiveRegion,
    getLiveRegionState,
    getTTSState
  };

})();
