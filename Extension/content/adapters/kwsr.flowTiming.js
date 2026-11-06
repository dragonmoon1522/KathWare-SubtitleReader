// KathWare SubtitleReader - Diagnóstico de Flow con dos marcas manuales.
// El registro dura hasta 30 segundos y queda en memoria. No escucha el audio
// ni intenta determinar cuándo habla NVDA: la segunda marca la hace la persona.
(() => {
  const KWSR = window.KWSR;
  if (!KWSR || KWSR.flowTiming) return;
  const S = KWSR.state;
  const REVISION = 3;
  const WINDOW_MS = 30000;
  const TRACE_LIMIT = 240;
  const OUTPUT_STAGES = new Set(["adapter", "live-region", "tts-start"]);
  let session = null;
  let listener = null;
  let report = { revision: REVISION, phase: "idle" };

  const clock = () => performance.now();
  const isFlow = () => KWSR.platforms?.getPlatform?.() === "flow";
  const video = () => (S.currentVideo?.isConnected !== false && S.currentVideo) || KWSR.video?.getMainVideo?.();
  const sourceKey = v => v?.currentSrc || v?.src || "";
  const normalize = text => String(text ?? "").replace(/\s+/g, " ").trim();
  const excerpt = text => text.length > 300 ? "…" + text.slice(-300) : text;
  const mediaTime = v => Math.round(v.currentTime * 1000) / 1000;

  function readCaption() {
    const candidate = KWSR.consoleRenderers?.getRendererText?.("flow");
    return { text: normalize(candidate?.text), selector: candidate?.selector || "" };
  }

  function captureMark(v, at) {
    const mark = {
      at,
      wallTimeMs: Date.now(),
      videoTime: mediaTime(v),
      readingMode: S.modoNarradorGlobal
    };
    mark.caption = readCaption();
    mark.caption.text = excerpt(mark.caption.text);
    return mark;
  }

  function publish(phase, data, log = true) {
    report = { revision: REVISION, phase, ...data };
    try { listener?.(report); } catch {}
    if (log) console.log(`[KathWare] CONSOLE RENDERER FLOW TIMING ${JSON.stringify(report)}`);
    return report;
  }

  function detach() {
    const s = session;
    if (!s) return;
    session = null;
    s.observer?.disconnect();
    clearTimeout(s.timer);
    for (const name of s.events) s.video.removeEventListener(name, s.interrupt);
  }

  function interrupt(reason) {
    if (!session) return report;
    const { audioMark } = session;
    detach();
    return publish(reason === "timeout" ? "expired" : "invalid", { reason, audioMark });
  }

  function valid(s, at) {
    const v = video();
    if (!isFlow() || !S.extensionActiva || v !== s.video || sourceKey(v) !== s.source) {
      interrupt("source-changed");
      return false;
    }
    if (v.paused || v.ended || v.seeking || v.playbackRate !== s.rate ||
        !Number.isFinite(v.currentTime) || v.currentTime < s.audioMark.videoTime - 0.01) {
      interrupt("playback-changed");
      return false;
    }
    if (at - s.audioMark.at >= WINDOW_MS) {
      interrupt("timeout");
      return false;
    }
    return true;
  }

  function record(s, stage, text, at) {
    s.timeline.push({ stage, afterAudioMarkMs: Math.round(at - s.audioMark.at), videoTime: mediaTime(s.video), text: excerpt(text) });
    if (s.timeline.length > TRACE_LIMIT) {
      s.timeline.shift();
      s.omittedEvents++;
    }
  }

  function sample(s) {
    if (session !== s || !valid(s, clock())) return;
    const { text } = readCaption();
    if (excerpt(text) === s.lastCaption) return;
    s.lastCaption = excerpt(text);
    record(s, "caption", text, clock());
  }

  function markAudio() {
    const at = clock();
    detach();
    const v = video();
    if (!isFlow() || !S.extensionActiva || !v || v.paused || v.ended || v.seeking || !Number.isFinite(v.currentTime)) {
      return publish("invalid", { reason: "play-a-flow-video" });
    }

    const audioMark = captureMark(v, at);
    const s = session = {
      audioMark, video: v, source: sourceKey(v), rate: v.playbackRate,
      lastCaption: audioMark.caption.text, timeline: [], omittedEvents: 0,
      events: ["pause", "seeking", "emptied", "ended", "ratechange"],
      interrupt: event => { if (session === s) interrupt(event.type); }
    };

    try {
      s.observer = new MutationObserver(() => sample(s));
      s.observer.observe(document.documentElement, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ["class", "style", "hidden"]
      });
      for (const name of s.events) v.addEventListener(name, s.interrupt);
      s.timer = setTimeout(() => { if (session === s) interrupt("timeout"); }, WINDOW_MS);
    } catch {
      return interrupt("observer-unavailable");
    }
    return publish("waiting-subtitle", { audioMark }, false);
  }

  function markSubtitle() {
    const at = clock();
    const s = session;
    if (!s) return report.phase === "idle" ? publish("invalid", { reason: "audio-mark-required" }) : report;
    if (!valid(s, at)) return report;

    const subtitleMark = captureMark(s.video, at);
    detach();
    return publish("measured", {
      reference: "manual-audio-and-subtitle-marks",
      audioMark: s.audioMark,
      subtitleMark,
      manualDelayMs: Math.round(at - s.audioMark.at),
      videoElapsedMs: Math.round((subtitleMark.videoTime - s.audioMark.videoTime) * 1000),
      playbackRate: s.rate,
      timeline: s.timeline,
      omittedEvents: s.omittedEvents,
      nvdaSpeechStartMeasured: false
    });
  }

  function noteOutput(stage, text) {
    const at = clock();
    if (session && OUTPUT_STAGES.has(stage) && valid(session, at)) record(session, stage, normalize(text), at);
  }

  KWSR.flowTiming = {
    revision: REVISION, markAudio, markSubtitle, noteOutput,
    getReport: () => report,
    setListener(fn) {
      listener = typeof fn === "function" ? fn : null;
      try { listener?.(report); } catch {}
    },
    cancel() { interrupt("cancelled"); }
  };
})();
