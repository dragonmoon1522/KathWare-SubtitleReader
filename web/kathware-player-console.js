// ====================================================
// KathWare SubtitleReader - Console 3.0 Beta
// Version: 3.0.0-console-beta.1
//
// Consola principal de desarrollo.
//
// Principios:
// - lectura por tipo de renderizador, no por plataforma
// - textTracks cuando sean utilizables
// - renderizadores visuales conocidos
// - subtítulos visuales agrupados por estructura
// - accesibilidad de controles sin reemplazar el player
// - sin timers de reetiquetado de controles
// ====================================================

(() => {
  "use strict";

  const OLD = window.__KATHWARE_SUBTITLE_READER_CONSOLE__;

  if (OLD?.destroy) {
    try {
      OLD.destroy();
    } catch (_) {}
  }

  // ==================================================
  // Estado
  // ==================================================

  const KWSR = {
    version: "3.0.0-console-beta.1",

    enabled: true,

    // lector | voz | off
    readerMode: "lector",

    debug: false,

    liveRegion: null,
    statusRegion: null,
    panel: null,

    visualObserver: null,

    playerObserver: null,
    playerParentObserver: null,
    currentPlayer: null,

    keyHandler: null,
    fullscreenHandler: null,

    track: null,
    trackCueHandler: null,

    lastTrackText: "",
    lastVisualRaw: "",

    lastEmittedFp: "",
    lastEmittedAt: 0,

    pendingVisualText: "",
    visualSettleTimer: null,

    visualBuffer: "",
    visualFlushTimer: null,
    visualSpokenContext: "",

    settleMs: 120,

    repeatBlockMs: 4000,

    softFlushMs: 1400,
    liveFlushMs: 850,

    emergencyLimit: 140,

    minFlushWords: 4,
    liveMinWords: 3,

    spokenContextLimit: 900
  };

  // ==================================================
  // Utilidades
  // ==================================================

  const log = (...args) => {
    if (KWSR.debug) {
      console.log("[KWSR]", ...args);
    }
  };

  const normalize = text =>
    String(text || "")
      .replace(/\u200b/g, "")
      .replace(/>>+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.!?…:;])/g, "$1")
      .trim();

  const fp = text =>
    normalize(text)
      .toLowerCase()
      .replace(/[.,;:!?¿¡"“”'()[\]{}…]/g, "")
      .trim();

  const wordsOf = text =>
    normalize(text)
      .split(/\s+/)
      .filter(Boolean);

  const wordCount = text =>
    wordsOf(text).length;

  function collapseRepeatedText(text) {
    text = normalize(text);

    if (!text) {
      return "";
    }

    const words = text.split(" ");

    if (
      words.length >= 4 &&
      words.length % 2 === 0
    ) {
      const half = words.length / 2;

      const a =
        words.slice(0, half).join(" ");

      const b =
        words.slice(half).join(" ");

      if (
        fp(a) &&
        fp(a) === fp(b)
      ) {
        return normalize(a);
      }
    }

    return text;
  }

  function isVisible(el) {
    if (!el?.getBoundingClientRect) {
      return false;
    }

    const rect =
      el.getBoundingClientRect();

    if (
      rect.width < 2 ||
      rect.height < 2
    ) {
      return false;
    }

    const style =
      getComputedStyle(el);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) !== 0
    );
  }

  function isInsideKathWareUI(el) {
    if (!el?.closest) {
      return false;
    }

    return Boolean(
      el.closest(`
        #kwsr-console-panel,
        #kwsr-console-live-region,
        #kwsr-console-status-region,
        #kwsr-live-region,
        [id^="kwsr-"],
        [class^="kwsr-"],
        [class*=" kwsr-"]
      `)
    );
  }

  function isBadNode(el) {
    if (!el) {
      return true;
    }

    if (isInsideKathWareUI(el)) {
      return true;
    }

    const tag =
      (el.tagName || "").toUpperCase();

    if (
      [
        "BUTTON",
        "A",
        "INPUT",
        "SELECT",
        "TEXTAREA",
        "LABEL"
      ].includes(tag)
    ) {
      return true;
    }

    if (
      el.closest?.(`
        button,
        a,
        input,
        select,
        textarea,
        [role="button"],
        [role="slider"],
        [role="menu"],
        [role="dialog"],
        .ytp-chrome-bottom,
        .ytp-progress-bar,
        .ytp-tooltip,
        .ytp-popup,
        .ytp-settings-menu
      `)
    ) {
      return true;
    }

    const sig =
      `${el.id || ""} ${el.className || ""}`
        .toLowerCase();

    return /control|button|slider|settings|menu|tooltip|toast|popup|volume|quality|speed|seek|progress|advert/.test(sig);
  }

  function isBadText(text) {
    return /control deslizante|barra deslizante|configuración del proyecto|subtítulos desactivados|volumen|velocidad|calidad|opciones de audio|estilo de subtítulos|se reanudó la reproducción|se pausó la reproducción/i.test(
      normalize(text)
    );
  }

  // ==================================================
  // Shadow DOM
  // ==================================================

  function queryAllDeep(
    root,
    selector,
    out = []
  ) {
    try {
      root
        .querySelectorAll(selector)
        .forEach(el => out.push(el));

      root
        .querySelectorAll("*")
        .forEach(el => {
          if (el.shadowRoot) {
            queryAllDeep(
              el.shadowRoot,
              selector,
              out
            );
          }
        });
    } catch (_) {}

    return out;
  }

  // ==================================================
  // Video
  // ==================================================

  function findVideos(
    root = document,
    out = new Set()
  ) {
    try {
      root
        .querySelectorAll("video")
        .forEach(v => out.add(v));

      root
        .querySelectorAll("*")
        .forEach(el => {
          if (el.shadowRoot) {
            findVideos(
              el.shadowRoot,
              out
            );
          }
        });
    } catch (_) {}

    return [...out];
  }

  function getMainVideo() {
    return (
      findVideos()
        .map(video => {
          const rect =
            video.getBoundingClientRect();

          return {
            video,
            area:
              rect.width *
              rect.height
          };
        })
        .filter(x => x.area > 1000)
        .sort(
          (a, b) =>
            b.area - a.area
        )[0]?.video || null
    );
  }

  // ==================================================
  // Regiones accesibles
  // ==================================================

  function createLiveRegions() {
    const live =
      document.createElement("div");

    live.id =
      "kwsr-console-live-region";

    live.setAttribute(
      "aria-live",
      "polite"
    );

    live.setAttribute(
      "aria-atomic",
      "true"
    );

    live.setAttribute(
      "role",
      "status"
    );

    Object.assign(
      live.style,
      {
        position: "fixed",
        left: "-9999px",
        width: "1px",
        height: "1px",
        overflow: "hidden"
      }
    );

    const status =
      document.createElement("div");

    status.id =
      "kwsr-console-status-region";

    status.setAttribute(
      "aria-live",
      "assertive"
    );

    status.setAttribute(
      "aria-atomic",
      "true"
    );

    status.setAttribute(
      "role",
      "status"
    );

    Object.assign(
      status.style,
      {
        position: "fixed",
        left: "-9999px",
        width: "1px",
        height: "1px",
        overflow: "hidden"
      }
    );

    document.documentElement
      .appendChild(live);

    document.documentElement
      .appendChild(status);

    KWSR.liveRegion = live;
    KWSR.statusRegion = status;
  }

  function speakThroughLiveRegion(
    region,
    text
  ) {
    if (!region) {
      return;
    }

    region.textContent = "";

    setTimeout(() => {
      region.textContent =
        normalize(text);
    }, 25);
  }

  function announceStatus(text) {
    text = normalize(text);

    if (!text) {
      return;
    }

    speakThroughLiveRegion(
      KWSR.statusRegion,
      text
    );

    log(text);

    updatePanel();
  }

  // ==================================================
  // Salida
  // ==================================================

  function rememberSpoken(text) {
    text = normalize(text);

    if (!text) {
      return;
    }

    KWSR.visualSpokenContext =
      normalize(
        `${KWSR.visualSpokenContext} ${text}`
      );

    if (
      KWSR.visualSpokenContext.length >
      KWSR.spokenContextLimit
    ) {
      KWSR.visualSpokenContext =
        KWSR.visualSpokenContext.slice(
          -KWSR.spokenContextLimit
        );
    }
  }

  function emit(
    text,
    source
  ) {
    text = normalize(text);

    if (
      !KWSR.enabled ||
      !text ||
      KWSR.readerMode === "off"
    ) {
      return;
    }

    const currentFp =
      fp(text);

    const now =
      Date.now();

    if (
      currentFp ===
        KWSR.lastEmittedFp &&
      now -
        KWSR.lastEmittedAt <
        KWSR.repeatBlockMs
    ) {
      return;
    }

    KWSR.lastEmittedFp =
      currentFp;

    KWSR.lastEmittedAt =
      now;

    if (
      KWSR.readerMode ===
      "lector"
    ) {
      speakThroughLiveRegion(
        KWSR.liveRegion,
        text
      );
    }

    if (
      KWSR.readerMode === "voz" &&
      "speechSynthesis" in window
    ) {
      try {
        speechSynthesis.cancel();

        const utterance =
          new SpeechSynthesisUtterance(
            text
          );

        utterance.lang =
          document.documentElement.lang ||
          "es-ES";

        speechSynthesis.speak(
          utterance
        );
      } catch (_) {}
    }

    rememberSpoken(text);

    log(`${source}:`, text);

    updatePanel(
      text,
      source
    );
  }

  // ==================================================
  // textTracks
  // ==================================================

  function detachTrack() {
    if (
      KWSR.track &&
      KWSR.trackCueHandler
    ) {
      try {
        KWSR.track.removeEventListener(
          "cuechange",
          KWSR.trackCueHandler
        );
      } catch (_) {}
    }

    KWSR.track = null;
    KWSR.trackCueHandler = null;
  }

  function readActiveTrack(track) {
    if (
      !KWSR.enabled ||
      !track
    ) {
      return false;
    }

    let text = "";

    try {
      text = normalize(
        [...track.activeCues]
          .map(cue => cue.text)
          .join(" ")
      );
    } catch (_) {}

    if (!text) {
      return false;
    }

    if (
      text ===
      KWSR.lastTrackText
    ) {
      return true;
    }

    KWSR.lastTrackText =
      text;

    emit(
      text,
      "STANDARD:textTracks"
    );

    return true;
  }

  function findUsableTrack() {
    const video =
      getMainVideo();

    if (
      !video?.textTracks?.length
    ) {
      return null;
    }

    const tracks =
      [...video.textTracks]
        .filter(track =>
          [
            "subtitles",
            "captions"
          ].includes(
            track.kind
          )
        );

    for (const track of tracks) {
      try {
        if (
          track.mode ===
          "disabled"
        ) {
          track.mode =
            "hidden";
        }
      } catch (_) {}
    }

    return (
      tracks.find(track => {
        try {
          return (
            track.activeCues &&
            track.activeCues.length
          );
        } catch (_) {
          return false;
        }
      }) ||
      tracks[0] ||
      null
    );
  }

  function attachTrack() {
    const track =
      findUsableTrack();

    if (
      track === KWSR.track
    ) {
      return Boolean(track);
    }

    detachTrack();

    if (!track) {
      return false;
    }

    KWSR.track =
      track;

    KWSR.trackCueHandler =
      () => {
        readActiveTrack(track);
      };

    try {
      track.addEventListener(
        "cuechange",
        KWSR.trackCueHandler
      );
    } catch (_) {}

    readActiveTrack(track);

    return true;
  }

  // ==================================================
  // Renderizador visual estructural
  // ==================================================

  /*
   * Este es el detector validado en ViX.
   *
   * IMPORTANTE:
   * el candidato NO es cada <p>.
   *
   * Es el contenedor que agrupa todos los
   * <p> directos correspondientes al mismo
   * subtítulo.
   */

  function getGroupedLineCandidate() {
    const video =
      getMainVideo();

    if (!video) {
      return null;
    }

    const roots = [];

    const stablePlayer =
      document.querySelector(
        "#video-player"
      );

    if (stablePlayer) {
      roots.push(stablePlayer);
    }

    const nearVideo =
      video.parentElement;

    if (
      nearVideo &&
      !roots.includes(nearVideo)
    ) {
      roots.push(nearVideo);
    }

    const candidates = [];

    for (const root of roots) {
      let divs = [];

      try {
        divs =
          [...root.querySelectorAll("div")];
      } catch (_) {
        continue;
      }

      for (const container of divs) {
        if (
          !isVisible(container) ||
          isInsideKathWareUI(container)
        ) {
          continue;
        }

        /*
         * Solamente hijos DIRECTOS.
         *
         * Así evitamos tomar:
         * - título
         * - metadata
         * - controles
         * - padres gigantes
         */

        const children =
          [...container.children];

        if (
          !children.length ||
          !children.every(
            child =>
              child.tagName === "P"
          )
        ) {
          continue;
        }

        const lines = [];

        let valid = true;

        for (
          const child of children
        ) {
          if (
            !isVisible(child)
          ) {
            valid = false;
            break;
          }

          const style =
            getComputedStyle(child);

          /*
           * Firma estructural observada.
           *
           * No usamos:
           * - nombre de plataforma
           * - clase ofuscada
           * - tamaño exacto
           * - fuente exacta
           */

          if (
            style.display !==
            "table"
          ) {
            valid = false;
            break;
          }

          const text =
            normalize(
              child.innerText ||
              child.textContent
            );

          if (
            !text ||
            isBadText(text)
          ) {
            valid = false;
            break;
          }

          lines.push(text);
        }

        if (
          !valid ||
          !lines.length
        ) {
          continue;
        }

        /*
         * AQUÍ está la corrección importante:
         *
         * Si el grupo tiene 2 P,
         * leemos LOS DOS.
         */

        const text =
          collapseRepeatedText(
            normalize(
              lines.join(" ")
            )
          );

        if (
          text.length < 2 ||
          text.length > 500
        ) {
          continue;
        }

        const rect =
          container
            .getBoundingClientRect();

        candidates.push({
  el: container,

  renderer: {
    name:
      "Visual grouped lines",

    mode:
      "settled"
  },

  text,

  lines:
    lines.length,

  rect,

  length:
    text.length
});
      }
    }

    candidates.sort((a, b) => {
  /*
   * Primero preferimos el texto más completo.
   *
   * Si ambos tienen una longitud parecida,
   * preferimos el grupo situado más abajo
   * dentro del reproductor.
   *
   * Es el criterio que ya funcionó durante
   * la prueba estructural original.
   */

  const lengthDifference =
    b.length - a.length;

  if (
    Math.abs(lengthDifference) >
    5
  ) {
    return lengthDifference;
  }

  return (
    b.rect.bottom -
    a.rect.bottom
  );
});

    return (
      candidates[0] ||
      null
    );
  }

  // ==================================================
  // Renderizadores visuales conocidos
  // ==================================================

  const VISUAL_RENDERERS = [
    {
      name:
        "YouTube captions",

      mode:
        "liveIncremental",

      stable: [
        "#ytp-caption-window-container",
        ".ytp-caption-window-container"
      ],

      inner: [
        ".ytp-caption-segment",
        ".caption-visual-line"
      ]
    },

    {
      name:
        "THEOplayer / Flow-like",

      mode:
        "liveIncremental",

      stable: [
        ".theoplayer-texttracks",
        "[class*='theoplayer'][class*='texttrack']"
      ],

      inner: [
        ".theoplayer-texttracks *",
        "[class*='texttrack']"
      ]
    },

    {
      name:
        "Disney / Hive",

      mode:
        "settled",

      stable: [
        "timed-text-override-region",
        ".timed-text-override-region",
        ".DxcOverlay",
        "DISNEY-WEB-PLAYER"
      ],

      inner: [
        ".hive-subtitle-renderer-wrapper",
        ".hive-subtitle-renderer-line",
        "[class*='subtitle']",
        "[class*='caption']",
        "[class*='timed-text']",
        "span",
        "div"
      ]
    },

    {
      name:
        "Video.js / Percipio",

      mode:
        "settled",

      stable: [
        ".vjs-text-track-display"
      ],

      inner: [
        ".vjs-text-track-cue",
        ".vjs-text-track-cue *"
      ]
    },

    {
      name:
        "PlayKit / Kaltura",

      mode:
        "settled",

      stable: [
        ".playkit-subtitles",
        ".playkit-captions",
        ".playkit-subtitle"
      ],

      inner: [
        ".playkit-subtitle",
        ".playkit-subtitles *"
      ]
    },

    {
      name:
        "Netflix-like renderer",

      mode:
        "settled",

      stable: [
        ".player-timedtext",
        ".player-timedtext-text-container",
        "[data-uia*='subtitle']",
        "[data-uia*='caption']"
      ],

      inner: [
        ".player-timedtext-text",
        ".player-timedtext span",
        "[data-uia*='subtitle'] span"
      ]
    }
  ];

  function getNodeText(
    el,
    renderer
  ) {
    if (
      !el ||
      !isVisible(el) ||
      isBadNode(el)
    ) {
      return "";
    }

    const parts = [];

    for (
      const selector of
      renderer.inner
    ) {
      try {
        el
          .querySelectorAll(
            selector
          )
          .forEach(node => {
            if (
              !isVisible(node) ||
              isBadNode(node)
            ) {
              return;
            }

            const text =
              normalize(
                node.innerText ||
                node.textContent
              );

            if (
              !text ||
              isBadText(text)
            ) {
              return;
            }

            parts.push(text);
          });
      } catch (_) {}
    }

    const unique =
      [...new Set(parts)];

    if (unique.length) {
      return collapseRepeatedText(
        normalize(
          unique.join(" ")
        )
      );
    }

    const text =
      normalize(
        el.innerText ||
        el.textContent
      );

    if (
      !text ||
      isBadText(text)
    ) {
      return "";
    }

    return collapseRepeatedText(
      text
    );
  }

  function pickKnownVisual() {
    const candidates = [];

    const isYouTube =
      location.hostname.includes(
        "youtube.com"
      );

    for (
      const renderer of
      VISUAL_RENDERERS
    ) {
      if (
        isYouTube &&
        renderer.name !==
          "YouTube captions"
      ) {
        continue;
      }

      for (
        const selector of
        renderer.stable
      ) {
        try {
          queryAllDeep(
            document,
            selector
          ).forEach(el => {
            const text =
              getNodeText(
                el,
                renderer
              );

            if (!text) {
              return;
            }

            if (
              text.length < 2 ||
              text.length > 700
            ) {
              return;
            }

            const rect =
              el.getBoundingClientRect();

            let score =
              Math.min(
                text.length,
                180
              );

            score +=
              rect.bottom >
              window.innerHeight *
                0.45
                ? 50
                : 0;

            score += 90;

            candidates.push({
              el,
              renderer,
              text,
              score,
              selector
            });
          });
        } catch (_) {}
      }
    }

    candidates.sort(
      (a, b) =>
        b.score - a.score
    );

    return (
      candidates[0] ||
      null
    );
  }

  function pickVisual() {
    /*
     * Primero intentamos renderizadores
     * identificados explícitamente.
     */

    const known =
      pickKnownVisual();

    if (known) {
      return known;
    }

    /*
     * Si no encontramos uno conocido,
     * probamos estructura visual agrupada.
     *
     * Esto cubre ViX sin llamarlo "ViX".
     */

    const grouped =
      getGroupedLineCandidate();

    if (grouped) {
      return grouped;
    }

    return null;
  }

  // ==================================================
  // Incremental
  // ==================================================

  function hasHardBoundary(text) {
    return /[.!?…:]\s*$/.test(
      normalize(text)
    );
  }

  function hasSoftBoundary(text) {
    return /[,;]\s*$/.test(
      normalize(text)
    );
  }

  function getDelta(
    previous,
    current
  ) {
    previous =
      normalize(previous);

    current =
      normalize(current);

    if (!previous) {
      return current;
    }

    if (
      !current ||
      current === previous
    ) {
      return "";
    }

    if (
      fp(current) ===
      fp(previous)
    ) {
      return "";
    }

    const prevWords =
      wordsOf(previous);

    const currWords =
      wordsOf(current);

    if (
      current.startsWith(
        previous
      )
    ) {
      return normalize(
        currWords
          .slice(
            prevWords.length
          )
          .join(" ")
      );
    }

    const maxOverlap =
      Math.min(
        prevWords.length,
        currWords.length
      );

    for (
      let size = maxOverlap;
      size >= 2;
      size--
    ) {
      const prevTail =
        fp(
          prevWords
            .slice(-size)
            .join(" ")
        );

      for (
        let start = 0;
        start <=
        currWords.length - size;
        start++
      ) {
        const currChunk =
          fp(
            currWords
              .slice(
                start,
                start + size
              )
              .join(" ")
          );

        if (
          prevTail &&
          prevTail === currChunk
        ) {
          return normalize(
            currWords
              .slice(
                start + size
              )
              .join(" ")
          );
        }
      }
    }

    if (
      fp(previous).includes(
        fp(current)
      )
    ) {
      return "";
    }

    return current;
  }

  function removeAlreadySpoken(
    delta
  ) {
    delta =
      normalize(delta);

    if (!delta) {
      return "";
    }

    const context =
      normalize(
        `${KWSR.visualSpokenContext} ${KWSR.visualBuffer}`
      );

    if (!context) {
      return delta;
    }

    if (
      fp(context).includes(
        fp(delta)
      )
    ) {
      return "";
    }

    const deltaWords =
      wordsOf(delta);

    for (
      let cut = 1;
      cut < deltaWords.length;
      cut++
    ) {
      const candidate =
        normalize(
          deltaWords
            .slice(cut)
            .join(" ")
        );

      if (!candidate) {
        continue;
      }

      if (
        !fp(context).includes(
          fp(candidate)
        )
      ) {
        return candidate;
      }
    }

    return delta;
  }

  function flushVisual(
    reason = "flush"
  ) {
    clearTimeout(
      KWSR.visualFlushTimer
    );

    KWSR.visualFlushTimer =
      null;

    const text =
      normalize(
        KWSR.visualBuffer
      );

    KWSR.visualBuffer = "";

    if (!text) {
      return;
    }

    emit(
      text,
      `VISUAL:${reason}`
    );
  }

  function queueVisualDelta(
    delta,
    rendererName = ""
  ) {
    delta =
      normalize(delta);

    if (!delta) {
      return;
    }

    const live =
      rendererName ===
        "YouTube captions" ||
      rendererName ===
        "THEOplayer / Flow-like";

    if (!live) {
      delta =
        removeAlreadySpoken(
          delta
        );
    }

    if (!delta) {
      return;
    }

    const flushMs =
      live
        ? KWSR.liveFlushMs
        : KWSR.softFlushMs;

    const minWords =
      live
        ? KWSR.liveMinWords
        : KWSR.minFlushWords;

    KWSR.visualBuffer =
      normalize(
        `${KWSR.visualBuffer} ${delta}`
      );

    clearTimeout(
      KWSR.visualFlushTimer
    );

    const words =
      wordCount(
        KWSR.visualBuffer
      );

    if (
      hasHardBoundary(
        KWSR.visualBuffer
      ) &&
      words >= 3
    ) {
      flushVisual(
        "sentence"
      );

      return;
    }

    if (
      hasSoftBoundary(
        KWSR.visualBuffer
      ) &&
      KWSR.visualBuffer.length >=
        45 &&
      words >= minWords
    ) {
      flushVisual(
        "soft"
      );

      return;
    }

    if (
      KWSR.visualBuffer.length >=
        KWSR.emergencyLimit &&
      words >= minWords
    ) {
      flushVisual(
        "limit"
      );

      return;
    }

    KWSR.visualFlushTimer =
      setTimeout(() => {
        if (
          wordCount(
            KWSR.visualBuffer
          ) >= minWords
        ) {
          flushVisual(
            "pause"
          );
        }
      }, flushMs);
  }

  // ==================================================
  // Settled
  // ==================================================

  function handleSettledVisual(
    current,
    picked
  ) {
    clearTimeout(
      KWSR.visualSettleTimer
    );

    KWSR.pendingVisualText =
      current;

    KWSR.visualSettleTimer =
      setTimeout(() => {
        const text =
          normalize(
            KWSR.pendingVisualText
          );

        if (!text) {
          return;
        }

        if (
          text ===
            KWSR.lastVisualRaw ||
          fp(text) ===
            fp(
              KWSR.lastVisualRaw
            )
        ) {
          return;
        }

        KWSR.lastVisualRaw =
          text;

        /*
 * Los renderizadores settled entregan el cue completo.
 * No recortamos palabras contra el contexto hablado.
 *
 * La deduplicación completa ya se hizo comparando
 * lastVisualRaw y fingerprint.
 */

log(
  `VISUAL RAW (${picked.renderer.name}):`,
  text
);

if (picked.lines) {
  log(
    "VISUAL LINES:",
    picked.lines
  );
}

emit(
  text,
  `VISUAL:${picked.renderer.name}`
);
      }, KWSR.settleMs);
  }

  function handleLiveIncrementalVisual(
    current,
    picked
  ) {
    const previous =
      KWSR.lastVisualRaw;

    const delta =
      getDelta(
        previous,
        current
      );

    KWSR.lastVisualRaw =
      current;

    if (!delta) {
      return true;
    }

    if (
      previous &&
      fp(delta) ===
        fp(current) &&
      fp(previous).includes(
        fp(current)
      )
    ) {
      return true;
    }

    log(
      `VISUAL RAW (${picked.renderer.name}):`,
      current
    );

    log(
      "VISUAL DELTA:",
      delta
    );

    queueVisualDelta(
      delta,
      picked.renderer.name
    );

    return true;
  }

  // ==================================================
  // Lectura visual
  // ==================================================

  function readVisual() {
    if (!KWSR.enabled) {
      return false;
    }

    const picked =
      pickVisual();

    if (!picked) {
      return false;
    }

    const current =
      normalize(
        picked.text
      );

    if (!current) {
      return false;
    }

    if (
      picked.renderer.mode ===
      "settled"
    ) {
      handleSettledVisual(
        current,
        picked
      );

      return true;
    }

    handleLiveIncrementalVisual(
      current,
      picked
    );

    return true;
  }

  // ==================================================
  // Motor
  // ==================================================

  function tick() {
    if (!KWSR.enabled) {
      return;
    }

    const hasTrack =
      attachTrack();

    if (
      hasTrack &&
      readActiveTrack(
        KWSR.track
      )
    ) {
      return;
    }

    readVisual();
  }

  function resetReadingState() {
    KWSR.lastTrackText = "";
    KWSR.lastVisualRaw = "";

    KWSR.pendingVisualText = "";

    KWSR.visualBuffer = "";
    KWSR.visualSpokenContext = "";

    clearTimeout(
      KWSR.visualSettleTimer
    );

    clearTimeout(
      KWSR.visualFlushTimer
    );

    KWSR.visualSettleTimer =
      null;

    KWSR.visualFlushTimer =
      null;
  }

  function restartEngine() {
    resetReadingState();

    detachTrack();

    try {
      speechSynthesis?.cancel?.();
    } catch (_) {}

    tick();

    announceStatus(
      "Motor reiniciado"
    );
  }

  // ==================================================
  // Observer de subtítulos
  // ==================================================

  function installVisualObserver() {
    KWSR.visualObserver?.disconnect();

    const observer =
      new MutationObserver(
        mutations => {
          if (!KWSR.enabled) {
            return;
          }

          /*
           * No necesitamos reaccionar
           * a nuestra propia UI.
           */

          const relevant =
            mutations.some(
              mutation =>
                !isInsideKathWareUI(
                  mutation.target
                )
            );

          if (!relevant) {
            return;
          }

          tick();
        }
      );

    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true,
        characterData: true
      }
    );

    KWSR.visualObserver =
      observer;
  }

  // ==================================================
  // Accesibilidad de controles
  // ==================================================

  const CONTROL_NAMES = {
    "player-back-button":
      "Volver",

    "player-play-pause":
      "Reproducir o pausar",

    "player-mute-unmute":
      "Silenciar o activar sonido",

    "player-captions":
      "Subtítulos",

    "player-settings":
      "Configuración",

    "player-pip":
      "Imagen en imagen",

    "player-fullscreen":
      "Pantalla completa"
  };

  function createHiddenControlText(
    text
  ) {
    const span =
      document.createElement(
        "span"
      );

    span.className =
      "kwsr-control-name";

    span.textContent =
      text;

    Object.assign(
      span.style,
      {
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: "0",
        margin: "-1px",
        overflow: "hidden",
        clip:
          "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: "0"
      }
    );

    return span;
  }

  function labelPlayerControls() {
    const root =
      document.querySelector(
        "#video-player"
      );

    if (!root) {
      return 0;
    }

    let count = 0;

    for (
      const [
        testId,
        text
      ] of
      Object.entries(
        CONTROL_NAMES
      )
    ) {
      const button =
        root.querySelector(
          `button[data-testid="${testId}"]`
        );

      if (!button) {
        continue;
      }

      if (
        button.querySelector(
          ".kwsr-control-name"
        )
      ) {
        continue;
      }

      button.appendChild(
        createHiddenControlText(
          text
        )
      );

      count++;

      log(
        `${testId} -> ${text}`
      );
    }

    const seek =
      root.querySelector(
        '[data-testid="player-seek-bar"] input[type="range"]'
      );

    if (
      seek &&
      !seek.getAttribute(
        "title"
      )
    ) {
      seek.setAttribute(
        "title",
        "Posición de reproducción"
      );
    }

    return count;
  }

  function disconnectPlayerObservers() {
    try {
      KWSR.playerObserver
        ?.disconnect();
    } catch (_) {}

    try {
      KWSR.playerParentObserver
        ?.disconnect();
    } catch (_) {}

    KWSR.playerObserver =
      null;

    KWSR.playerParentObserver =
      null;
  }

  function attachPlayerAccessibility() {
    const root =
      document.querySelector(
        "#video-player"
      );

    if (!root) {
      return;
    }

    disconnectPlayerObservers();

    KWSR.currentPlayer =
      root;

    labelPlayerControls();

    /*
     * Sólo cambios de hijos directos.
     *
     * No:
     * - atributos
     * - characterData
     * - subtree
     * - currentTime
     *
     * Si el reproductor cambia entre
     * contenido y publicidad,
     * reetiquetamos.
     */

    KWSR.playerObserver =
      new MutationObserver(() => {
        labelPlayerControls();
      });

    KWSR.playerObserver.observe(
      root,
      {
        childList: true,
        subtree: false
      }
    );

    const parent =
      root.parentElement;

    if (parent) {
      KWSR.playerParentObserver =
        new MutationObserver(
          () => {
            const newRoot =
              document.querySelector(
                "#video-player"
              );

            if (
              newRoot &&
              newRoot !==
                KWSR.currentPlayer
            ) {
              attachPlayerAccessibility();
            }
          }
        );

      KWSR.playerParentObserver.observe(
        parent,
        {
          childList: true,
          subtree: false
        }
      );
    }
  }

  // ==================================================
  // Estado
  // ==================================================

  function setEnabled(value) {
    KWSR.enabled =
      Boolean(value);

    resetReadingState();

    announceStatus(
      KWSR.enabled
        ? "SubtitleReader activado"
        : "SubtitleReader desactivado"
    );

    if (KWSR.enabled) {
      tick();
    }
  }

  function cycleReaderMode() {
    KWSR.readerMode =
      KWSR.readerMode ===
      "lector"
        ? "voz"
        : KWSR.readerMode ===
          "voz"
        ? "off"
        : "lector";

    resetReadingState();

    const label =
      KWSR.readerMode ===
      "lector"
        ? "lector de pantalla"
        : KWSR.readerMode ===
          "voz"
        ? "voz del navegador"
        : "silencio";

    announceStatus(
      `Salida: ${label}`
    );
  }

  function toggleDebug() {
    KWSR.debug =
      !KWSR.debug;

    announceStatus(
      `Debug ${
        KWSR.debug
          ? "activado"
          : "desactivado"
      }`
    );

    console.log(
      "[KWSR] Debug:",
      KWSR.debug
        ? "ON"
        : "OFF"
    );
  }

  function getState() {
    const picked =
      pickVisual();

    return {
      version:
        KWSR.version,

      enabled:
        KWSR.enabled,

      readerMode:
        KWSR.readerMode,

      debug:
        KWSR.debug,

      mainVideo:
        Boolean(
          getMainVideo()
        ),

      textTrack:
        Boolean(
          KWSR.track
        ),

      renderer:
        picked?.renderer
          ?.name ||
        null,

      lines:
        picked?.lines ||
        null,

      currentText:
        picked?.text ||
        "",

      lastVisualRaw:
        KWSR.lastVisualRaw,

      visualBuffer:
        KWSR.visualBuffer
    };
  }

  function announceState() {
    const state =
      getState();

    console.log(
      "[KWSR] Estado:",
      state
    );

    const mode =
      KWSR.readerMode ===
      "lector"
        ? "lector de pantalla"
        : KWSR.readerMode ===
          "voz"
        ? "voz del navegador"
        : "silencio";

    announceStatus(
      [
        `KathWare SubtitleReader ${
          KWSR.enabled
            ? "activado"
            : "desactivado"
        }`,

        `Salida: ${mode}`,

        state.renderer
          ? `Renderizador: ${state.renderer}`
          : "Sin renderizador visual detectado",

        state.mainVideo
          ? "Video detectado"
          : "Video no detectado",

        KWSR.debug
          ? "Debug activado"
          : "Debug desactivado"
      ].join(". ")
    );
  }

  // ==================================================
  // Controles de video
  // ==================================================

  function playPauseVideo() {
    const video =
      getMainVideo();

    if (!video) {
      announceStatus(
        "No se encontró video principal"
      );

      return;
    }

    if (video.paused) {
      video
        .play()
        .then(() =>
          announceStatus(
            "Reproducción iniciada"
          )
        )
        .catch(() =>
          announceStatus(
            "No se pudo iniciar la reproducción"
          )
        );
    } else {
      video.pause();

      announceStatus(
        "Reproducción pausada"
      );
    }
  }

  function toggleMute() {
    const video =
      getMainVideo();

    if (!video) {
      announceStatus(
        "No se encontró video principal"
      );

      return;
    }

    video.muted =
      !video.muted;

    announceStatus(
      video.muted
        ? "Video silenciado"
        : "Video con sonido"
    );
  }

  function seekVideo(seconds) {
    const video =
      getMainVideo();

    if (!video) {
      announceStatus(
        "No se encontró video principal"
      );

      return;
    }

    try {
      video.currentTime =
        Math.max(
          0,
          video.currentTime +
            seconds
        );

      announceStatus(
        seconds > 0
          ? "Avanzando"
          : "Retrocediendo"
      );
    } catch (_) {
      announceStatus(
        "No se pudo cambiar la posición del video"
      );
    }
  }

  function toggleFullscreen() {
    const video =
      getMainVideo();

    const target =
      video?.closest?.(
        "[class*='player'], [class*='video'], main, body"
      ) ||
      video ||
      document.documentElement;

    if (
      !document.fullscreenElement
    ) {
      target
        .requestFullscreen?.()
        .catch(() =>
          announceStatus(
            "No se pudo activar pantalla completa"
          )
        );
    } else {
      document
        .exitFullscreen?.()
        .catch(() =>
          announceStatus(
            "No se pudo salir de pantalla completa"
          )
        );
    }
  }

  // ==================================================
  // Panel
  // ==================================================

  function createButton(
    text,
    action
  ) {
    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.textContent =
      text;

    button.addEventListener(
      "click",
      action
    );

    Object.assign(
      button.style,
      {
        margin: "2px",
        padding: "6px 8px",
        fontSize: "13px",
        cursor: "pointer"
      }
    );

    return button;
  }

  function createPanel() {
    const panel =
      document.createElement(
        "section"
      );

    panel.id =
      "kwsr-console-panel";

    panel.setAttribute(
      "role",
      "region"
    );

    panel.setAttribute(
      "aria-label",
      "KathWare SubtitleReader"
    );

    Object.assign(
      panel.style,
      {
        position: "fixed",
        zIndex:
          "2147483647",
        right: "12px",
        bottom: "12px",
        maxWidth: "360px",
        background:
          "rgba(0, 0, 0, 0.88)",
        color: "#fff",
        padding: "10px",
        borderRadius: "10px",
        fontFamily:
          "Arial, sans-serif",
        fontSize: "14px",
        lineHeight: "1.4",
        boxShadow:
          "0 4px 16px rgba(0,0,0,.35)"
      }
    );

    const title =
      document.createElement(
        "h2"
      );

    title.textContent =
      "KathWare SubtitleReader";

    Object.assign(
      title.style,
      {
        fontSize: "16px",
        margin: "0 0 6px"
      }
    );

    const status =
      document.createElement(
        "p"
      );

    status.id =
      "kwsr-console-panel-status";

    const last =
      document.createElement(
        "p"
      );

    last.id =
      "kwsr-console-panel-last";

    last.textContent =
      "Último subtítulo: ninguno";

    const controls =
      document.createElement(
        "div"
      );

    controls.appendChild(
      createButton(
        "Activar/desactivar",
        () =>
          setEnabled(
            !KWSR.enabled
          )
      )
    );

    controls.appendChild(
      createButton(
        "Cambiar salida",
        cycleReaderMode
      )
    );

    controls.appendChild(
      createButton(
        "Estado",
        announceState
      )
    );

    controls.appendChild(
      createButton(
        "Play/Pausa",
        playPauseVideo
      )
    );

    controls.appendChild(
      createButton(
        "Retroceder",
        () =>
          seekVideo(-10)
      )
    );

    controls.appendChild(
      createButton(
        "Avanzar",
        () =>
          seekVideo(10)
      )
    );

    controls.appendChild(
      createButton(
        "Silenciar",
        toggleMute
      )
    );

    controls.appendChild(
      createButton(
        "Pantalla completa",
        toggleFullscreen
      )
    );

    controls.appendChild(
      createButton(
        "Debug",
        toggleDebug
      )
    );

    panel.appendChild(
      title
    );

    panel.appendChild(
      status
    );

    panel.appendChild(
      last
    );

    panel.appendChild(
      controls
    );

    document.documentElement
      .appendChild(panel);

    KWSR.panel =
      panel;

    updatePanel();
  }

  function togglePanel() {
    if (!KWSR.panel) {
      createPanel();

      announceStatus(
        "Panel abierto"
      );

      return;
    }

    const hidden =
      KWSR.panel.hidden;

    KWSR.panel.hidden =
      !hidden;

    announceStatus(
      hidden
        ? "Panel abierto"
        : "Panel cerrado"
    );
  }

  function updatePanel(
    lastText = "",
    source = ""
  ) {
    if (!KWSR.panel) {
      return;
    }

    const status =
      KWSR.panel.querySelector(
        "#kwsr-console-panel-status"
      );

    const last =
      KWSR.panel.querySelector(
        "#kwsr-console-panel-last"
      );

    const picked =
      pickVisual();

    if (status) {
      status.textContent =
        `Estado: ${
          KWSR.enabled
            ? "activo"
            : "apagado"
        }. ` +
        `Salida: ${
          KWSR.readerMode
        }. ` +
        `Renderizador: ${
          picked?.renderer
            ?.name ||
          "no detectado"
        }.`;
    }

    if (
      lastText &&
      last
    ) {
      last.textContent =
        `Último subtítulo (${source}): ${lastText}`;
    }
  }

  // ==================================================
  // Atajos
  // ==================================================

  function bindHotkeys() {
    KWSR.keyHandler =
      event => {
        if (
          !event.altKey ||
          !event.shiftKey
        ) {
          return;
        }

        const key =
          event.key.toLowerCase();

        let handled =
          true;

        switch (key) {
          case "k":
            setEnabled(
              !KWSR.enabled
            );
            break;

          case "l":
            cycleReaderMode();
            break;

          case "o":
            togglePanel();
            break;

          case "d":
            toggleDebug();
            break;

          case "r":
            restartEngine();
            break;

          case "p":
            playPauseVideo();
            break;

          case "m":
            toggleMute();
            break;

          case "f":
            toggleFullscreen();
            break;

          case "arrowleft":
            seekVideo(-10);
            break;

          case "arrowright":
            seekVideo(10);
            break;

          default:
            handled =
              false;
        }

        if (handled) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      };

    document.addEventListener(
      "keydown",
      KWSR.keyHandler,
      true
    );
  }

  // ==================================================
  // Pantalla completa
  // ==================================================

  function installFullscreenWatcher() {
    KWSR.fullscreenHandler =
      () => {
        resetReadingState();

        attachPlayerAccessibility();

        tick();
      };

    document.addEventListener(
      "fullscreenchange",
      KWSR.fullscreenHandler
    );
  }

  // ==================================================
  // Destroy
  // ==================================================

  function destroy() {
    clearTimeout(
      KWSR.visualSettleTimer
    );

    clearTimeout(
      KWSR.visualFlushTimer
    );

    detachTrack();

    try {
      KWSR.visualObserver
        ?.disconnect();
    } catch (_) {}

    disconnectPlayerObservers();

    try {
      document.removeEventListener(
        "keydown",
        KWSR.keyHandler,
        true
      );
    } catch (_) {}

    try {
      document.removeEventListener(
        "fullscreenchange",
        KWSR.fullscreenHandler
      );
    } catch (_) {}

    try {
      speechSynthesis
        ?.cancel?.();
    } catch (_) {}

    try {
      KWSR.liveRegion
        ?.remove();

      KWSR.statusRegion
        ?.remove();

      KWSR.panel
        ?.remove();
    } catch (_) {}

    delete window
      .__KATHWARE_SUBTITLE_READER_CONSOLE__;

    console.log(
      "[KWSR] Destruido"
    );
  }

  // ==================================================
  // Inicio
  // ==================================================

  createLiveRegions();
  createPanel();

  bindHotkeys();

  installVisualObserver();
  installFullscreenWatcher();

  attachPlayerAccessibility();

  tick();

  window.__KATHWARE_SUBTITLE_READER_CONSOLE__ = {
    KWSR,

    destroy,

    tick,

    readVisual,

    pickVisual,

    getGroupedLineCandidate,

    getMainVideo,

    getState,

    announceState,

    setEnabled,

    cycleReaderMode,

    togglePanel,

    playPauseVideo,

    toggleMute,

    seekVideo,

    toggleFullscreen,

    restartEngine,

    labelPlayerControls,

    attachPlayerAccessibility
  };

  announceStatus(
    "KathWare SubtitleReader iniciado"
  );

  console.log(
    "[KWSR] Iniciado",
    KWSR.version
  );

  console.log(
    "[KWSR] Atajos: " +
    "Alt+Shift+K ON/OFF | " +
    "Alt+Shift+L lector/voz/off | " +
    "Alt+Shift+O panel | " +
    "Alt+Shift+D debug | " +
    "Alt+Shift+R reiniciar | " +
    "Alt+Shift+P play/pausa | " +
    "Alt+Shift+M mute | " +
    "Alt+Shift+F pantalla completa | " +
    "Alt+Shift+Flechas avanzar/retroceder"
  );
})();