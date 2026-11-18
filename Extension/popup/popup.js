// Configuración, compatibilidad y preparación de reportes de la pestaña actual.
// El formulario de GitHub siempre queda para revisión y publicación del usuario.
document.addEventListener("DOMContentLoaded", () => {
  const api = typeof chrome !== "undefined" && chrome?.runtime ? chrome :
    typeof browser !== "undefined" && browser?.runtime ? browser : null;
  if (!api) return;

  const mode = document.getElementById("modoNarrador");
  const description = document.getElementById("reporteError");
  const reportButton = document.getElementById("enviarReporte");
  const includeTechnical = document.getElementById("permitirEnvioLogs");
  const debugButton = document.getElementById("alternarDebug");
  const compatibility = document.getElementById("compatibilidad");
  const reportStatus = document.getElementById("estadoReporte");
  let debug = false, modeEdited = false, debugEdited = false;

  const status = text => { if (reportStatus) reportStatus.textContent = text; };
  function showDebug(value) {
    debug = !!value;
    if (!debugButton) return;
    debugButton.setAttribute("aria-pressed", String(debug));
    debugButton.textContent = debug ? "Desactivar debug" : "Activar debug";
  }

  function activeTab(callback) {
    try { api.tabs.query({ active: true, currentWindow: true }, tabs => callback(tabs?.[0] || null)); }
    catch { callback(null); }
  }

  function send(tab, message, callback) {
    if (tab?.id == null) { callback(null); return; }
    try {
      api.tabs.sendMessage(tab.id, message, response => callback(api.runtime.lastError ? null : response));
    } catch { callback(null); }
  }

  function showSupport(support) {
    if (!support) {
      if (compatibility) compatibility.textContent = "No se pudo consultar esta página. Recargala si acabás de actualizar la extensión.";
      return;
    }
    if (!debugEdited) showDebug(support.debug);
    if (!modeEdited && mode && support.modoNarrador) mode.value = support.modoNarrador;
    let text;
    if (!support.extensionActiva) text = "SubtitleReader está apagado en esta pestaña. Activá la lectura con Alt+Shift+K.";
    else if (support.modoNarrador === "off") text = "El modo de lectura está desactivado.";
    else if (!support.videoFound) text = "Todavía no se encontró un video. Iniciá la reproducción para buscar sus subtítulos.";
    else if (support.selectorSearch?.status === "track") text = "Lectura desde las pistas de subtítulos del video.";
    else if (support.selectorSearch?.status === "matched") text = "Se encontró una forma de leer los subtítulos de este reproductor.";
    else text = "Todavía no se detectaron subtítulos. Reproducí un video con subtítulos visibles. Si sigue sin leer, activá debug y prepará un reporte.";
    if (compatibility) compatibility.textContent = text;
  }

  try {
    api.storage.local.get(["modoNarrador", "debug"], data => {
      if (!modeEdited && mode && data?.modoNarrador) mode.value = data.modoNarrador;
      if (!debugEdited) showDebug(data?.debug);
    });
  } catch {}
  activeTab(tab => send(tab, { action: "getSubtitleStatus" }, response => showSupport(response?.support)));

  mode?.addEventListener("change", () => {
    modeEdited = true;
    try {
      api.storage.local.set({ modoNarrador: mode.value }, () => {
        activeTab(tab => send(tab, { action: "updateSettings" }, () => {
          send(tab, { action: "getSubtitleStatus" }, response => showSupport(response?.support));
        }));
      });
    } catch {}
  });

  debugButton?.addEventListener("click", () => {
    debugEdited = true;
    const enabled = !debug;
    debugButton.disabled = true;
    activeTab(tab => send(tab, { action: "setDebug", enabled }, response => {
      if (response?.support) {
        showDebug(response.support.debug);
        showSupport(response.support);
        debugButton.disabled = false;
        status(enabled ? "Debug activado. Reproducí unos segundos y volvé para preparar el reporte." : "Debug desactivado.");
        return;
      }
      try {
        api.storage.local.set({ debug: enabled, debugVisual: enabled }, () => {
          if (api.runtime.lastError) status("No se pudo guardar el ajuste de debug.");
          else { showDebug(enabled); status("Debug configurado. Recargá la pestaña para aplicarlo."); }
          debugButton.disabled = false;
        });
      } catch { debugButton.disabled = false; status("No se pudo activar debug en esta página."); }
    }));
  });

  reportButton?.addEventListener("click", () => {
    const mensaje = String(description?.value || "").trim();
    if (!mensaje) { status("Describí qué ocurrió antes de preparar el reporte."); description?.focus(); return; }
    reportButton.disabled = true;
    const technical = !!includeTechnical?.checked;
    activeTab(tab => send(tab, { action: "getDiagnostics", includeTechnical: technical }, response => {
      if (technical && (response?.status !== "ok" || !response.diagnostic)) {
        status("No se pudo obtener el diagnóstico de esta pestaña. Recargá la página y volvé a intentarlo, o prepará el reporte sin adjuntarlo.");
        reportButton.disabled = false;
        return;
      }
      try {
        const manifest = api.runtime.getManifest();
        const support = response?.support;
        let platform = support?.platform || "";
        if (!platform || platform === "generic") {
          try { platform = new URL(tab?.url || "").hostname; } catch { platform = "sitio por revisar"; }
        }
        const prepared = globalThis.KWSRReport.prepareIssue({
          mensaje, fecha: new Date().toISOString(), version: manifest.version_name || manifest.version,
          modoNarrador: support?.modoNarrador || mode?.value || "desconocido",
          url: response?.pageUrl || tab?.url || "", platform, ua: navigator.userAgent,
          diagnostic: technical ? response?.diagnostic : null,
          logs: technical ? response?.logs || [] : []
        });
        api.tabs.create({ url: prepared.url }, () => {
          reportButton.disabled = false;
          status(api.runtime.lastError ? "No se pudo abrir GitHub. Tus comentarios siguen en el formulario." :
            "Se abrió el borrador en GitHub. Revisalo y publicalo cuando esté listo.");
        });
      } catch (error) {
        reportButton.disabled = false;
        status(String(error?.message || "No se pudo preparar el reporte."));
      }
    }));
  });
});
