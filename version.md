## Historial de Versiones KathWare SubtitleReader

**Última actualización:** 2026-04-07
**Autora:** Katherine Vargas [(KathWare)](https://kathware.com.ar)

---

### **Versión 2.0.0 — estable (2026-04-07)**

Versión pública estable de KathWare SubtitleReader.

#### Cambios conceptuales y de arquitectura

* Cambio de nombre del proyecto a **KathWare SubtitleReader**, reflejando su objetivo real:
  lectura accesible de subtítulos, **no** reemplazo del reproductor.
* Reescritura del núcleo con **separación estricta de responsabilidades**:
  `bootstrap`, `pipeline`, `track`, `visual`, `voice`, `overlay`, `toast`, `adapters`.
* Arranque seguro mediante `kwsr.bootstrap.js`:

  * creación de un único namespace global (`window.KWSR`)
  * guarda crítica contra doble carga del content script
* Activación **lazy** de la interfaz:

  * el overlay y el panel solo existen cuando la extensión está activa
  * no se inyecta interfaz innecesaria en páginas inactivas
* Eliminación de lógica que fuerce idioma, voz o comportamiento del lector de pantalla.
  El idioma y la voz dependen exclusivamente de la configuración del usuario.
* Unificación y normalización de atajos de teclado:

  * `Alt + Shift + K` → activar o desactivar la extensión
  * `Alt + Shift + L` → cambiar modo de lectura
  * `Alt + Shift + O` → abrir o cerrar panel

#### Lectura de subtítulos

* Detección automática de la mejor fuente de subtítulos disponible:

  * **TRACK** cuando existen pistas reales (`textTracks`)
  * **VISUAL** cuando los subtítulos solo están renderizados en el DOM
* Eliminación de selectores manuales irrelevantes:
  el usuario no necesita elegir TRACK o VISUAL.
* Reescritura completa del motor VISUAL:

  * lectura por snapshot del contenedor
  * independencia del layout interno
  * compatibilidad con re-render dinámico
* Implementación de deduplicación robusta:

  * fingerprints estrictos y laxos
  * ventanas temporales anti-eco
  * control de re-render
* Implementación de lectura por delta en subtítulos progresivos.
* La extensión utiliza únicamente información ya disponible en el reproductor para realizar la lectura accesible.

#### Accesibilidad y compatibilidad

* Adaptaciones automáticas para plataformas con interfaces poco accesibles.
* Etiquetado dinámico de elementos cuando es posible.
* Corrección de reproductores que ocultan controles por inactividad.
* Panel accesible con estado real de funcionamiento.
* Controles accesibles del reproductor:

  * reproducir y pausar
  * avanzar y retroceder
  * volumen
  * pantalla completa

#### Voz, lector y estabilidad

* Sistema híbrido:

  * lector de pantalla mediante *live region*
  * sintetizador de voz opcional
* Watchdog de TTS.
* Recuperación automática ante fallos del sintetizador.

#### Logs y diagnóstico

* Sistema interno de logs desacoplado del flujo principal.
* Persistencia local mediante `storage.local`.
* Envío de logs únicamente bajo decisión explícita del usuario.
* Integración con GitHub Issues para reporte de errores.

#### Compatibilidad verificada

* Netflix
* Disney+
* Max
* Paramount+
* Flow

#### Estado

Versión estable publicada.

El desarrollo continúa con mejoras de compatibilidad, correcciones y nuevas funciones de accesibilidad.

---

### **Versión 2.0.0 beta — 2025-11-09**

* Unificación de ramas previas en una arquitectura común.
* Detección automática de reproductores HTML5 y no accesibles.
* Integración inicial de:

  * lectura por lector de pantalla
  * lectura por sintetizador de voz.
* Selector manual de fuente de subtítulos (TRACK / VISUAL).
* Selector de pistas cuando existen múltiples `textTracks`.
* Sincronización de preferencias mediante `chrome.storage.local`.
* Refactorización inicial de logs y mensajes de consola.
* Atajo `Ctrl + Shift + K` para activar o desactivar la extensión.
* Base técnica preparada para futuras funciones de transcripción.

---

### **Versión 1.0.0-beta — 2025-07-08**

* Lectura funcional de subtítulos TRACK y visuales.
* Selector de modo de lectura: sintetizador o lector de pantalla (`aria-live`).
* Controles accesibles por teclado (reproducir, pausar, volumen y saltos).
* Panel flotante accesible desde `popup.html`.
* Guardado local de errores y sistema de envío voluntario.
* Detección automática de reproductores no accesibles.
* Integración inicial con plataformas como Flow, Max y Disney+.
* Incorporación de la Licencia de Accesibilidad Universal (LAU).

---

**Licencia:**
Este contenido está licenciado bajo **Licencia de Accesibilidad Universal (LAU)** y **Creative Commons BY-NC-SA 4.0**.

Más información en:
https://kathware.com.ar/normas-de-uso-y-licencias-de-kathware/
