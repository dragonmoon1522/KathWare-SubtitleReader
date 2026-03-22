// -----------------------------------------------------------------------------
// KathWare SubtitleReader - kwsr.visual.js
// -----------------------------------------------------------------------------
//
// QUÉ HACE ESTE ARCHIVO
// ---------------------
// Este módulo se encarga de leer subtítulos VISUALES.
// Eso significa:
//
// - NO lee pistas de video.textTracks
// - NO decide cómo hablarlos
// - NO crea interfaz
//
// Solo hace esto:
// 1. Busca subtítulos dibujados en pantalla (en el DOM)
// 2. Junta el texto visible
// 3. Evita leer basura, menús o duplicados
// 4. Le pasa el texto final a KWSR.voice
//
// IDEA SIMPLE
// -----------
// Pensalo así:
//
// Pantalla -> este archivo mira
// Texto -> este archivo limpia
// Voz -> otro módulo lo habla
//
// -----------------------------------------------------------------------------
//
// PROBLEMA REAL QUE RESUELVE
// --------------------------
// En plataformas como Netflix y Max, el subtítulo puede verse quieto,
// PERO el DOM internamente cambia muchas veces.
//
// Ejemplo:
//
// 1. "Hola, Conan."
// 2. Netflix re-renderiza el mismo bloque
// 3. Parece nuevo para el código
// 4. Si no filtramos bien, se vuelve a leer
//
// Peor todavía: a veces aparece un estado intermedio:
//
// 1. "Hola, Conan."
// 2. "Hola, Conan. Hola profesor Agasa, cómo está?"
// 3. "Hola profesor Agasa, cómo está?"
//
// Ese paso 2 NO es un subtítulo real estable.
// Es una transición fea del DOM.
// Este archivo intenta ignorar ese estado intermedio.
//
// -----------------------------------------------------------------------------
//
// REGLAS IMPORTANTES
// ------------------
// - Este módulo NO habla directo.
// - Este módulo NO debe leer nuestra propia UI.
// - Este módulo NO debe leer menús de audio/subtítulos.
// - Este módulo NO debe releer el mismo cue por re-render.
//
// -----------------------------------------------------------------------------
//
// NOTA PARA MI YO DEL FUTURO
// --------------------------
// Si algo falla en Netflix, casi seguro el problema está en UNA de estas 3 cosas:
//
// 1. selector equivocado
// 2. snapshot de contenedor que mezcla cue viejo + nuevo
// 3. dedupe insuficiente
//
// -----------------------------------------------------------------------------


(() => {
  // ---------------------------------------------------------------------------
  // Arranque seguro del módulo
  // ---------------------------------------------------------------------------
  // Si KWSR no existe, no hacemos nada.
  // Si KWSR.visual ya existe, tampoco, para no pisar otro módulo cargado antes.
  // ---------------------------------------------------------------------------
  const KWSR = window.KWSR;
  if (!KWSR || KWSR.visual) return;

  // Estado global del proyecto
  const S = KWSR.state;

  // Config global
  const CFG = KWSR.CFG;

  // normalize es una función helper compartida.
  // Si no existe, usamos una versión mínima.
  const normalize = KWSR.utils?.normalize || ((x) => String(x ?? "").trim());

  // Debug opcional solo para visual.
  // Se activa si en CFG hay debug y debugVisual.
  const DEBUG = () => !!(CFG?.debug && CFG?.debugVisual);

  // ---------------------------------------------------------------------------
  // Helpers de plataforma
  // ---------------------------------------------------------------------------

  // Devuelve la plataforma actual:
  // "netflix", "disney", "max", "youtube", etc.
  function platform() {
    return KWSR.platforms?.getPlatform?.() || "generic";
  }

  // Devuelve capacidades especiales de esa plataforma.
  // Ejemplo: si conviene observar document completo.
  function caps() {
    const p = platform();
    return KWSR.platforms?.platformCapabilities?.(p) || {};
  }

  // ---------------------------------------------------------------------------
  // Evitar leer nuestra propia UI
  // ---------------------------------------------------------------------------
  // Esto es MUY importante.
  // Si no filtramos nuestra UI, el lector puede terminar leyéndose a sí mismo.
  // Y eso sería bastante cursed.
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
  // Detectar texto de menús de idioma / audio / subtítulos
  // ---------------------------------------------------------------------------
  // Queremos evitar leer cosas como:
  // "Audio: English Español Français"
  // "Subtitles"
  // "CC"
  //
  // Esta función intenta detectar ese tipo de texto.
  // ---------------------------------------------------------------------------
  function isLanguageMenuText(text) {
    const t = normalize(text);
    if (!t) return false;

    const lower = t.toLowerCase();

    // Palabras fuertes que suelen aparecer en menús, no en subtítulos reales.
    const strong =
      lower.includes("audio") ||
      lower.includes("subtítulos") ||
      lower.includes("subtitulos") ||
      lower.includes("subtitles") ||
      lower.includes("[cc]") ||
      lower.includes("cc ");

    if (!strong) return false;

    // Si aparecen muchos idiomas juntos, es sospechoso.
    const hits = [
      "english","deutsch","español","espanol","français","francais","italiano","português","portugues",
      "polski","magyar","dansk","norsk","svenska","suomi","türkçe","turkce","čeština","cestina",
      "română","romana","slovenčina","slovencina","nederlands","ελληνικά","日本語","한국어",
      "chinese","简体","繁體","粵語","bokmål","brasil","canada"
    ].reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);

    if (hits >= 3) return true;

    // Si es muy largo y además tiene palabras de audio/subs,
    // también puede ser menú o panel.
    if (t.length > 160 && strong) return true;

    return false;
  }

  // ---------------------------------------------------------------------------
  // Filtro general anti-basura
  // ---------------------------------------------------------------------------
  // Esto intenta descartar cosas que NO son subtítulos:
  // - botones
  // - links
  // - overlays
  // - tooltips
  // - cosas muy cortas o absurdamente largas
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

    // Largo razonable de subtítulo.
    if (t.length < 2 || t.length > 420) return true;

    const cls = ((node?.className || "") + " " + (node?.id || "")).toLowerCase();
    if (/toast|snack|tooltip|popover|modal|dialog|notif|banner|sr-only|screenreader-only/.test(cls)) {
      return true;
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Ver si un elemento está visible
  // ---------------------------------------------------------------------------
  // Esto ayuda especialmente en Disney:
  // a veces hay nodos que existen, pero no se ven realmente.
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
  // Selectores por plataforma
  // ---------------------------------------------------------------------------
  // Los selectores vienen desde kwsr.platforms.js
  // para no hardcodear todo acá.
  // ---------------------------------------------------------------------------
  function getSelectors() {
    const p = platform();
    return KWSR.platforms?.platformSelectors?.(p) || [];
  }

  // Busca nodos usando un selector CSS y filtra nuestra UI.
  function getFreshNodesBySelector(sel) {
    try {
      return Array.from(document.querySelectorAll(sel)).filter(n => !isInsideKathWareUI(n));
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Clave de contenedor
  // ---------------------------------------------------------------------------
  // Esto genera una "key" o "huella" del contenedor del subtítulo.
  // Sirve para saber si el texto viene del mismo bloque visual.
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
  // A veces un subtítulo está dividido en varios spans.
  // Esta función intenta unirlos con espacios donde corresponde.
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
  // Leer texto desde nodos
  // ---------------------------------------------------------------------------
  // Acá está una de las partes más importantes.
  //
  // Netflix/Max:
  // - intentamos leer el CONTENEDOR completo
  // - porque cada span interno puede cambiar demasiado
  //
  // Otras plataformas:
  // - juntamos partes visibles
  // ---------------------------------------------------------------------------
  function readTextFromNodes(nodes, p) {
    if (!nodes?.length) return { text: "", key: "" };

    // -------------------------------------------------------------------------
    // Netflix / Max
    // -------------------------------------------------------------------------
    // Leemos snapshot del contenedor.
    // PERO además:
    // - si encontramos varias líneas/nodos con texto, preferimos la ÚLTIMA,
    //   porque muchas veces el DOM mantiene un cue viejo + el nuevo,
    //   y la última línea suele ser el cue nuevo real.
    // -------------------------------------------------------------------------
    if (p === "netflix" || p === "max") {
      for (const n of nodes) {
        const el = n?.nodeType === 1 ? n : n?.parentElement;
        if (!el) continue;
        if (isInsideKathWareUI(el)) continue;

        const cont = el.closest?.(".player-timedtext-text-container") || el;

        // 1) Intentamos primero leer líneas hijas visibles de forma separada.
        // Esto ayuda a evitar el caso:
        // "viejo + nuevo" todo pegado en el contenedor.
        let lineParts = [];

        try {
          // Tomamos descendientes comunes de texto.
          const candidates = Array.from(
            cont.querySelectorAll("span, div")
          ).filter(child => {
            if (!child) return false;
            if (child === cont) return false;
            if (!isVisible(child)) return false;

            const txt = normalize(child.innerText || child.textContent || "");
            if (!txt) return false;
            if (looksLikeNoise(child, txt)) return false;

            return true;
          });

          // Nos quedamos con textos no vacíos y únicos en orden.
          const seen = new Set();
          for (const child of candidates) {
            const txt = normalize(child.innerText || child.textContent || "");
            if (!txt) continue;
            if (seen.has(txt)) continue;
            seen.add(txt);
            lineParts.push(txt);
          }
        } catch {
          // Si algo falla, seguimos con fallback.
          lineParts = [];
        }

        // Si encontramos varias partes, para Netflix/Max preferimos la última.
        // ¿Por qué?
        // Porque cuando aparece:
        // "Hola, Conan. Hola profesor Agasa..."
        // muchas veces el texto nuevo queda abajo / al final.
        if (lineParts.length >= 2) {
          const lastLine = normalize(lineParts[lineParts.length - 1]);
          if (lastLine && !isLanguageMenuText(lastLine) && !looksLikeNoise(cont, lastLine)) {
            const key = containerKeyForNode(cont);
            return { text: lastLine, key };
          }
        }

        // Fallback clásico: leer todo el contenedor.
        let raw = "";
        try {
          raw = cont.innerText || cont.textContent || "";
        } catch {}

        const t = normalize(raw);
        if (!t) continue;
        if (isLanguageMenuText(t)) continue;
        if (looksLikeNoise(cont, t)) continue;

        const key = containerKeyForNode(cont);
        return { text: t, key };
      }

      return { text: "", key: "" };
    }

    // -------------------------------------------------------------------------
    // Resto de plataformas
    // -------------------------------------------------------------------------
    const parts = [];
    let key = "";

    for (const n of nodes) {
      if (!n) continue;
      if (isInsideKathWareUI(n)) continue;

      if (p === "disney" && !isVisible(n)) continue;

      const t = normalize(n.textContent);
      if (!t) continue;

      if (p === "disney" && isLanguageMenuText(t)) continue;
      if (looksLikeNoise(n, t)) continue;

      if (!key) key = containerKeyForNode(n);
      parts.push(t);
    }

    if (!parts.length) return { text: "", key: "" };

    const joined = smartJoinLines(parts).replace(/\s+/g, " ").trim();
    return { text: joined, key: key || "no-key" };
  }

  // ---------------------------------------------------------------------------
  // Elegir el mejor selector
  // ---------------------------------------------------------------------------
  // Recorre los selectores posibles y se queda con el primero
  // que realmente entregue texto útil.
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
  // Fingerprints
  // ---------------------------------------------------------------------------
  // Estas funciones crean "huellas" del texto para comparar
  // si dos subtítulos son iguales o casi iguales.
  // ---------------------------------------------------------------------------

  // Huella estricta:
  // conserva más estructura.
  function fpStrict(text) {
    return normalize(text)
      .replace(/\u00A0/g, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  // Huella más flexible:
  // saca más puntuación y hace comparaciones menos rígidas.
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
  // Detectar transición fea de solapamiento
  // ---------------------------------------------------------------------------
  // Caso típico:
  //
  // prev = "hola conan"
  // next = "hola conan hola profesor agasa como esta"
  //
  // Eso NO debería leerse todavía.
  // Es un estado puente.
  // ---------------------------------------------------------------------------
  function isOverlapTransition(prevText, nextText) {
    const prev = fpLoose(prevText || "");
    const next = fpLoose(nextText || "");

    if (!prev || !next) return false;
    if (prev === next) return false;
    if (next.length <= prev.length) return false;

    if (next.startsWith(prev + " ")) return true;
    if (next.includes(" " + prev + " ")) return true;

    return false;
  }

  // ---------------------------------------------------------------------------
  // Tiempo del video
  // ---------------------------------------------------------------------------
  // Nos sirve para saber si el video realmente avanzó o si solo
  // hubo re-render del DOM.
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
  // Sirve cuando:
  // - se apaga todo
  // - cambia el video
  // - reiniciamos fuerte
  // ---------------------------------------------------------------------------
  function resetVisualDedupe() {
    S._visualLastAt = 0;
    S._visualLastText = "";
    S._visualLastKey = "";
    S._visualLastStrict = "";
    S._visualLastLoose = "";
    S._visualLastVideoTimeSec = null;

    // Cue activo = hay un subtítulo que consideramos "actual".
    S._visualCueActive = false;

    // Momento en que empezó ese cue.
    S._visualCueSince = 0;

    // Momento en que detectamos por última vez que NO había subtítulo.
    S._visualLastEmptyAt = 0;

    // Compatibilidad con lógica más vieja
    S.lastVisualSeen = "";
  }

  // ---------------------------------------------------------------------------
  // Pedir una lectura en el próximo frame
  // ---------------------------------------------------------------------------
  // requestAnimationFrame agrupa muchas mutaciones en una sola lectura.
  // Eso ayuda bastante a no reaccionar a cada microcambio del DOM.
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
  // Marcar que hay algo nuevo para leer
  // ---------------------------------------------------------------------------
  function scheduleVisualRead(reasonNode) {
    if (S.effectiveFuente !== "visual") return;
    if (reasonNode && isInsideKathWareUI(reasonNode)) return;

    const p = platform();

    // En Disney podemos filtrar un poco más por zona.
    if (p === "disney" && reasonNode) {
      try {
        const el = reasonNode.nodeType === 1 ? reasonNode : reasonNode.parentElement;
        if (el && !el.closest?.(".hive-subtitle-renderer-line,[class*='hive-subtitle-renderer-line']")) {
          return;
        }
      } catch {}
    }

    S.visualDirty = true;
    S.visualDirtyAt = performance.now();

    requestVisualFrame(reasonNode);
  }

  // ---------------------------------------------------------------------------
  // Iniciar modo visual
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
  // Esta es la función más importante del archivo.
  //
  // Qué hace:
  // 1. Verifica si corresponde leer
  // 2. Busca texto actual
  // 3. Decide si es nuevo, repetido o transición fea
  // 4. Si es válido, lo manda a voice
  // ---------------------------------------------------------------------------
  function pollVisualTick(fromObserver = false, reasonNode = null) {
    // Si voice dice que no hay que leer ahora, salimos.
    if (!KWSR.voice?.shouldReadNow?.()) return;

    // Solo trabajamos si la fuente efectiva es visual.
    if (S.effectiveFuente !== "visual") return;

    // Si hay observer activo, el poll manual no debe hablar por su cuenta.
    if (!fromObserver && S.visualObserverActive) return;

    // Si el llamado vino del observer, solo seguimos si había dirty flag.
    if (fromObserver) {
      if (!S.visualDirty) return;
      S.visualDirty = false;
    }

    if (reasonNode && isInsideKathWareUI(reasonNode)) return;

    const p = platform();
    const isRerenderPlatform = (p === "netflix" || p === "max");

    if (!S.visualSelectors) {
      S.visualSelectors = getSelectors();
    }

    // Si todavía no elegimos selector, intentamos elegir uno.
    if (!S.visualSelectorUsed) {
      S.visualSelectorUsed = pickBestSelector(p);
      if (!S.visualSelectorUsed) return;
    }

    // Leemos nodos usando el selector elegido.
    const nodes = getFreshNodesBySelector(S.visualSelectorUsed);
    const { text, key } = readTextFromNodes(nodes, p);

    // -------------------------------------------------------------------------
    // Si no hay texto visible
    // -------------------------------------------------------------------------
    // Marcamos que no hay cue activo.
    // Esto es útil para que un subtítulo igual pueda volver a leerse
    // más adelante SOLO si realmente desapareció antes.
    // -------------------------------------------------------------------------
    if (!text) {
      S._visualCueActive = false;
      S._visualLastEmptyAt = performance.now();
      return;
    }

    // Huellas del texto actual
    const strict = fpStrict(text);
    const loose = fpLoose(text);

    // Estado previo
    const tNow = getVideoTimeSec();
    const lastT = (typeof S._visualLastVideoTimeSec === "number")
      ? S._visualLastVideoTimeSec
      : null;

    const lastStrict = S._visualLastStrict || "";
    const lastLoose = S._visualLastLoose || "";

    const sameStrict = strict && strict === lastStrict;
    const sameLoose = loose && loose === lastLoose;

    // "sameTextish" = parecido fuerte
    const sameTextish =
      sameStrict ||
      sameLoose ||
      (lastLoose && loose && (lastLoose.includes(loose) || loose.includes(lastLoose)));

    const sameKey = key && key === (S._visualLastKey || "");
    const now = performance.now();

    // -------------------------------------------------------------------------
    // Detectar transición de solapamiento
    // -------------------------------------------------------------------------
    // Caso que queremos ignorar:
    //
    // prev = "Hola, Conan."
    // next = "Hola, Conan. Hola profesor Agasa..."
    //
    // Eso suele ser un estado puente de Netflix/Max.
    // -------------------------------------------------------------------------
    const overlapTransition =
      isRerenderPlatform &&
      S._visualLastText &&
      isOverlapTransition(S._visualLastText, text);

    if (overlapTransition) {
      if (DEBUG()) {
        KWSR.log?.("VISUAL overlap-transition", {
          prev: S._visualLastText,
          next: text
        });
      }
      return;
    }

    // -------------------------------------------------------------------------
    // Cue-lock fuerte para Netflix/Max
    // -------------------------------------------------------------------------
    // Si el mismo cue sigue activo, no lo releemos.
    // Esto mata el bug clásico del re-render infinito.
    // -------------------------------------------------------------------------
    if (isRerenderPlatform && S._visualCueActive && sameTextish) {
      if (DEBUG()) {
        KWSR.log?.("VISUAL cue-lock", { text, key });
      }

      if (tNow != null) {
        S._visualLastVideoTimeSec = tNow;
      }

      return;
    }

    // -------------------------------------------------------------------------
    // Gate por tiempo del video
    // -------------------------------------------------------------------------
    // Si el video casi no avanzó y el texto es casi el mismo,
    // probablemente fue re-render y no cue nuevo.
    // -------------------------------------------------------------------------
    if (isRerenderPlatform && tNow != null && lastT != null && sameTextish) {
      const dtVideo = Math.abs(tNow - lastT);

      // Max tolera un poquito más.
      const gate = (p === "max") ? 0.40 : 0.35;

      if (dtVideo < gate) {
        S._visualLastVideoTimeSec = tNow;
        S._visualLastStrict = strict;
        S._visualLastLoose = loose;

        if (DEBUG()) {
          KWSR.log?.("VISUAL dedupe (videoTime+textish)", {
            dtVideo,
            gate,
            text
          });
        }

        return;
      }
    }

    // -------------------------------------------------------------------------
    // Dedupe temporal normal
    // -------------------------------------------------------------------------
    // Esto es más útil en plataformas que no son Netflix/Max.
    // -------------------------------------------------------------------------
    const minRepeatMs = isRerenderPlatform ? 950 : 700;
    const allowRepeatAfterMs = isRerenderPlatform ? 2200 : 1700;

    if ((sameStrict || sameLoose) && sameKey) {
      const dt = now - (S._visualLastAt || 0);

      // Duplicado inmediato
      if (dt < minRepeatMs) {
        if (DEBUG()) {
          KWSR.log?.("VISUAL dedupe (fast)", {
            dt: Math.round(dt),
            text
          });
        }
        return;
      }

      // Ventana gris:
      // en Netflix/Max NO dejamos pasar por tiempo solamente.
      if (!isRerenderPlatform && dt < allowRepeatAfterMs) {
        if (DEBUG()) {
          KWSR.log?.("VISUAL dedupe (grey)", {
            dt: Math.round(dt),
            text
          });
        }
        return;
      }
    }

    // Compatibilidad vieja: si poll corre sin observer y ya vimos esto, salir.
    if (!fromObserver && strict && strict === S.lastVisualSeen) return;
    S.lastVisualSeen = strict || text;

    // -------------------------------------------------------------------------
    // Guardamos estado nuevo
    // -------------------------------------------------------------------------
    S._visualLastText = text;
    S._visualLastKey = key || "";
    S._visualLastAt = now;
    S._visualLastStrict = strict;
    S._visualLastLoose = loose;
    S._visualCueActive = true;
    S._visualCueSince = now;

    if (tNow != null) {
      S._visualLastVideoTimeSec = tNow;
    }

    if (DEBUG()) {
      KWSR.log?.("VISUAL speak", {
        selector: S.visualSelectorUsed,
        key,
        fromObserver,
        text
      });
    }

    // Finalmente delegamos a voice.
    KWSR.voice?.leerTextoAccesible?.(text);
  }

  // ---------------------------------------------------------------------------
  // Re-evaluar selector
  // ---------------------------------------------------------------------------
  // Algunas plataformas cambian tanto el DOM que conviene
  // volver a elegir selector de vez en cuando.
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
  // Export público del módulo
  // ---------------------------------------------------------------------------
  KWSR.visual = {
    startVisual,
    stopVisualObserver,
    pollVisualTick,
    visualReselectTick,
    resetVisualDedupe
  };

})();