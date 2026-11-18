// Utilidades del borrador de GitHub. No publica ni envía un issue.
(() => {
  const ISSUE_URL = "https://github.com/dragonmoon1522/KathWare-SubtitleReader/issues/new";
  const URL_BUDGET = 7500;

  function cleanUrl(value) {
    try {
      const url = new URL(String(value));
      if (!/^https?:$/.test(url.protocol)) return "(URL no compartida)";
      url.username = url.password = url.search = url.hash = "";
      return url.href.slice(0, 400);
    } catch { return "(sin URL compatible)"; }
  }

  function cleanValue(value, depth = 0) {
    if (depth > 7) return "(resumido)";
    if (typeof value === "string") return value.replace(/https?:\/\/[^\s<>"']+/g, cleanUrl).slice(0, 600);
    if (value == null || typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.slice(0, 20).map(item => cleanValue(item, depth + 1));
    if (typeof value !== "object") return String(value);
    const result = {};
    for (const [key, item] of Object.entries(value).slice(0, 40)) {
      if (/^(password|cookie|authorization|token|accessToken|refreshToken|secret)$/i.test(key)) continue;
      result[key] = cleanValue(item, depth + 1);
    }
    return result;
  }

  function compactDiagnostic(data) {
    if (!data) return null;
    return cleanValue({
      version: data.version, platform: data.platform, extensionActiva: data.extensionActiva,
      modoNarrador: data.modoNarrador, fuenteEfectiva: data.fuenteEfectiva,
      selectorSearch: data.selectorSearch, visualSelectorUsed: data.visualSelectorUsed,
      currentTrack: data.currentTrack, liveRegion: data.liveRegion, ttsRecovery: data.ttsRecovery,
      flowReaderRevision: data.flowReaderRevision, youtubeReaderRevision: data.youtubeReaderRevision,
      embeddedFrames: data.embeddedFrames,
      lastVisualText: data.lastVisualText, lastEmittedText: data.lastEmittedText,
      video: data.video ? { ...data.video, currentSrc: undefined } : null
    });
  }

  function prepareIssue(report) {
    const title = `Lectura de subtítulos: ${report.platform || "sitio por revisar"}`;
    const description = String(report.mensaje || "").trim();
    if (!description) throw new Error("Describí qué ocurrió antes de preparar el reporte.");
    const info = [
      "## Descripción", description, "", "## Información",
      `- Fecha: ${report.fecha}`, `- Versión: ${report.version}`,
      `- Plataforma: ${report.platform}`, `- URL: ${cleanUrl(report.url)}`,
      `- Modo de lectura: ${report.modoNarrador}`, `- Navegador / SO: ${String(report.ua || "").slice(0, 350)}`
    ].join("\n");
    const urlFor = body => {
      const url = new URL(ISSUE_URL);
      url.searchParams.set("title", title); url.searchParams.set("body", body);
      return url.href;
    };
    if (urlFor(info).length > URL_BUDGET) throw new Error("El comentario es demasiado extenso para abrir el borrador. Acortalo antes de continuar.");
    let diagnostic = compactDiagnostic(report.diagnostic);
    const logs = cleanValue((report.logs || []).slice(-20));
    let trimmed = (report.logs?.length || 0) > 20;
    const bodyFor = () => [
      info,
      diagnostic ? "\n## Diagnóstico\n```json\n" + JSON.stringify(diagnostic, null, 2) + "\n```" : "",
      logs.length ? "\n## Registros de esta pestaña\n```json\n" + JSON.stringify(logs, null, 2) + "\n```" : "",
      trimmed ? "\nLa información técnica se resumió para abrir este borrador." : ""
    ].filter(Boolean).join("\n");
    while (urlFor(bodyFor()).length > URL_BUDGET && logs.length) { logs.shift(); trimmed = true; }
    while (urlFor(bodyFor()).length > URL_BUDGET && diagnostic?.selectorSearch?.checked?.length) {
      diagnostic.selectorSearch.checked.pop(); trimmed = true;
    }
    if (urlFor(bodyFor()).length > URL_BUDGET && diagnostic) {
      diagnostic = cleanValue({
        platform: diagnostic.platform, fuenteEfectiva: diagnostic.fuenteEfectiva,
        selectorSearch: diagnostic.selectorSearch ? { ...diagnostic.selectorSearch, checked: undefined } : null,
        liveRegion: diagnostic.liveRegion ? { ...diagnostic.liveRegion, text: undefined } : null,
        ttsRecovery: diagnostic.ttsRecovery
      });
      trimmed = true;
    }
    if (urlFor(bodyFor()).length > URL_BUDGET) { diagnostic = null; trimmed = true; }
    const body = bodyFor();
    if (urlFor(body).length > URL_BUDGET) throw new Error("Acortá el comentario para poder abrir el borrador en GitHub.");
    return { url: urlFor(body), body, trimmed };
  }

  globalThis.KWSRReport = { cleanUrl, cleanValue, prepareIssue };
})();
