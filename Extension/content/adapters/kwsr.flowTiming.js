// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.flowTiming.js
// Diagnóstico temporal de Flow: audio marcado por la persona -> texto en el DOM
// -> entrega del adaptador -> live region o inicio del sintetizador.
//
// PARA UBICARTE
// No escucha ni graba audio. La marca manual es la referencia del diálogo.
// Un observador independiente consulta el subtítulo sin esperar al lector.
// Solo se activa al marcar; conserva una prueba de 30 segundos en memoria.
// -----------------------------------------------------------------------------
(() => {
  const KWSR = window.KWSR;
  if (!KWSR || KWSR.flowTiming) return;
  const REVISION = 1;
  const WINDOW_MS = 30000;
  const MAX_SAMPLES = 800;
  let session = null;
  let listener = null;

  const clock = () => typeof performance !== "undefined" ? performance.now() : Date.now();
  const platform = () => KWSR.platforms?.getPlatform?.() || "generic";
  const video = () => KWSR.state?.currentVideo || KWSR.video?.getMainVideo?.() || null;
  const key = v => String(v?.currentSrc || v?.src || "");
  const tokens = text => String(text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const contains = (text, word) => (` ${tokens(text).join(" ")} `).includes(` ${tokens(word).join(" ")} `);
  const round = value => Number.isFinite(value) ? Math.round(value) : null;

  function detach() {
    if (!session) return;
    session.observer?.disconnect();
    clearTimeout(session.timer);
    for (const [event, handler] of session.events) session.video.removeEventListener?.(event, handler);
    session.events = [];
    session.running = false;
  }

  function getReport() {
    if (!session) return { revision: REVISION, phase: "idle", running: false };
    const s = session;
    let phase = s.invalid ? "invalid" : !s.word ? "need-word" : s.expired ? "not-found" : "waiting";
    let caption = null;
    if (!s.invalid && s.word) {
      if (contains(s.initial.text, s.word)) {
        phase = "already-visible";
      } else if (s.truncated) {
        phase = "history-incomplete";
      } else {
        const found = s.samples.find(row => !row.initial && contains(row.text, s.word));
        if (found) {
          phase = "matched";
          caption = {
            observedAfterAudioMarkMs: round(found.at - s.at),
            videoTime: found.videoTime,
            videoSecondsAfterAudioMark: Number((found.videoTime - s.videoTime).toFixed(3)),
            text: found.text.slice(0, 300)
          };
          // Guardar el resultado aunque el historial acotado se renueve después.
          s.match = { ...found };
        } else if (s.match) {
          phase = "matched";
        }
      }
      if (!caption && phase === "matched" && s.match) {
        caption = {
          observedAfterAudioMarkMs: round(s.match.at - s.at), videoTime: s.match.videoTime,
          videoSecondsAfterAudioMark: Number((s.match.videoTime - s.videoTime).toFixed(3)), text: s.match.text.slice(0, 300)
        };
      }
    }
    const output = {};
    for (const stage of ["adapter", "live-region", "tts-start"]) {
      const event = !s.invalid && s.word && s.outputs.find(row => row.stage === stage && row.at >= (s.match?.at ?? s.at) && contains(row.text, s.word));
      output[stage] = event ? {
        afterAudioMarkMs: round(event.at - s.at), afterCaptionMs: caption ? round(event.at - s.match.at) : null
      } : null;
    }
    return {
      revision: REVISION, phase, running: s.running, word: s.word,
      audioMark: { wallTimeMs: s.wallTime, videoTime: s.videoTime, playbackRate: s.rate },
      caption, output, invalidReason: s.invalid || null,
      samples: s.samples.length, historyTruncated: s.truncated,
      reference: "manual-audio-mark", nvdaSpeechStartMeasured: false
    };
  }

  function publish() {
    const report = getReport();
    try { listener?.(report); } catch {}
  }

  function invalidate(reason) {
    if (!session) return;
    session.invalid = reason;
    detach();
    publish();
  }

  function valid() {
    if (!session?.running) return false;
    const v = video();
    if (platform() !== "flow" || !KWSR.state?.extensionActiva || v !== session.video || key(v) !== session.key) {
      invalidate("source-changed");
      return false;
    }
    if (v.paused || v.ended || Number(v.playbackRate || 1) !== session.rate) {
      invalidate("playback-changed");
      return false;
    }
    return true;
  }

  function sample(initial = false) {
    if (!valid()) return;
    const text = String(KWSR.consoleRenderers?.getRendererText?.("flow")?.text || "").replace(/\s+/g, " ").trim();
    if (!initial && text === session.lastRaw) return;
    const row = { text, at: clock(), videoTime: Number(session.video.currentTime), initial };
    session.lastRaw = text;
    if (initial) session.initial = row;
    session.samples.push(row);
    if (session.samples.length > MAX_SAMPLES) {
      session.samples.splice(1, 1);
      session.truncated = !session.match;
    }
    publish();
  }

  function markAudio() {
    detach();
    const v = video();
    if (platform() !== "flow" || !KWSR.state?.extensionActiva || !v || v.paused || v.ended || !Number.isFinite(v.currentTime)) {
      session = null;
      return { revision: REVISION, phase: "invalid", running: false, invalidReason: "play-a-flow-video" };
    }
    session = {
      at: clock(), wallTime: Date.now(), videoTime: Number(v.currentTime), rate: Number(v.playbackRate || 1),
      video: v, key: key(v), running: true, word: "", lastRaw: "", initial: { text: "" },
      samples: [], outputs: [], events: [], timer: null, observer: null,
      invalid: "", expired: false, truncated: false, match: null
    };
    const target = session;
    sample(true);
    try {
      session.observer = new MutationObserver(() => { if (session === target) sample(); });
      session.observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
      for (const event of ["pause", "seeking", "emptied", "ratechange"]) {
        const handler = () => { if (session === target) invalidate(event); };
        v.addEventListener?.(event, handler);
        session.events.push([event, handler]);
      }
      session.timer = setTimeout(() => {
        if (session !== target) return;
        sample();
        session.expired = true;
        detach();
        publish();
      }, WINDOW_MS);
    } catch {
      invalidate("observer-unavailable");
    }
    return getReport();
  }

  function setWord(value) {
    if (!session) return getReport();
    const word = String(value || "").trim().slice(0, 80);
    session.word = tokens(word).length ? word : "";
    session.match = null;
    publish();
    return getReport();
  }

  function noteOutput(stage, text) {
    if (!["adapter", "live-region", "tts-start"].includes(stage) || !valid()) return;
    session.outputs.push({ stage, text: String(text || ""), at: clock() });
    if (session.outputs.length > MAX_SAMPLES) session.outputs.shift();
    publish();
  }

  KWSR.flowTiming = {
    revision: REVISION, markAudio, setWord, noteOutput, getReport,
    setListener(fn) { listener = typeof fn === "function" ? fn : null; publish(); },
    cancel() { invalidate("cancelled"); }
  };
})();
