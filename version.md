## Historial de Versiones KathWare SubtitleReader

**Última actualización:** 2026-09-29
**Autora:** Katherine Vargas [(KathWare)](https://kathware.com.ar)

---

### **Versión 2.2.0-beta — en desarrollo (2026-09-28)**

Versión beta orientada a consolidar en la extensión las funciones ya probadas en consola, sin introducir todavía el cambio estructural previsto para 3.0.0.

#### Alcance de esta versión

* Integración de mejoras funcionales sobre la arquitectura 2.x existente.
* Se mantiene la separación actual por módulos y adapters.
* Los cambios de paradigma, reorganización completa por renderizadores/contenedores y refactor estructural quedan reservados para **3.0.0**.

#### Lectura de subtítulos y renderizadores

* YouTube y Flow/THEOplayer: la lectura incremental por pausa envía el texto acumulado después de 850 ms sin texto nuevo, sin mínimo de palabras. Respuestas aisladas como «Sí» o «No» ya no quedan pendientes por ese filtro. El envío de un buffer vacío sigue descartándose.

Corrección de omisiones visuales ViX / Lura (2026-09-29):

* Un bloque de líneas `<p>` con `display: table` ya no se descarta por conservar una línea vacía u oculta. Se siguen agrupando las líneas visibles, sin ampliar la detección a texto arbitrario del player.
* El observador atiende cambios de subtítulos aunque el mismo lote empiece por una mutación de la interfaz de KathWare.
* En ViX se observan también cambios de clase/estilo/visibilidad y se mantiene el sondeo periódico como respaldo, incluso con observador activo. Esto recupera cues presentes al activar la lectura o al reanudarla sin otra mutación de texto.
* La lectura agrupada no depende de que el selector genérico haya encontrado previamente texto. Un intervalo sin texto libera la deduplicación visual de ViX para permitir una frase idéntica posterior; se conserva el filtro anti-eco de salida.
* Se excluyen bloques ocultos por sus ancestros. Debug registra el texto candidato y el número de líneas; el diagnóstico se imprime como JSON copiable e incluye candidato agrupado, último texto visual y última emisión.
* Validación: seis pruebas nuevas del detector visual en Chrome y nueve pruebas de accesibilidad del player aprobadas. Las pruebas capturan la entrega a la capa de voz; la comprobación de cobertura en una sesión real de ViX con NVDA/TTS sigue pendiente.
* Sin refactor de 3.0 ni cambios a la velocidad, síntesis o cola de voz.

* Actualización de compatibilidad con **Disney+ / Hive** mediante nuevos selectores visuales.
* Incorporación de fallback para subtítulos dentro de **Shadow DOM abierto**.
* Mejora de lectura visual en **ViX**, agrupando líneas pertenecientes al mismo bloque de subtítulos.
* Integración del comportamiento incremental validado en consola para:

  * **YouTube**
  * **Flow / THEOplayer**
* Incorporación de selectores ya probados para renderizadores y reproductores como:

  * Video.js
  * PlayKit / Kaltura
  * THEOplayer
* Se mantiene la selección automática de fuente efectiva de subtítulos sin exigir configuración manual al usuario.

#### Accesibilidad del reproductor

Corrección ViX / overlay (2026-09-29):

* ViX queda bajo un único adaptador de accesibilidad: el general ya no sobrescribe sus etiquetas. Se elimina la competencia que provocaba la alternancia repetida `labeled: 2/0`; el debug informa cambios del conjunto de controles, no el delta de cada pasada.
* Los botones visibles y habilitados de ViX recuperan entrada con Tab aunque tengan `tabindex="-1"`. Los botones personalizados admiten Enter/Espacio, conservando nombres reales del sitio y sin convertir contenedores, sliders ni subtítulos en botones.
* `keepAlive` usa un único destino en ViX y se solicita también antes de Tab. No se fuerzan visibles menús cerrados ni elementos ocultos/inertes.
* La detección del player accesible verifica visibilidad de ancestros, estado habilitado y entrada real en Tab. Un `role` sin foco o una etiqueta genérica ya no bastan para retirar el fallback.
* Las reglas del fallback no reaccionan a sus propias mutaciones ni reescriben atributos sin cambios. Solo ocultan la barra alternativa; configuración y «Cerrar panel» permanecen disponibles. Si el foco estaba en esa barra, pasa a «Cerrar panel» antes de ocultarla.
* El overlay se monta dentro del contenedor de pantalla completa y se reconecta al actualizarse si el sitio retiró su nodo. Pantalla completa nativa sobre el elemento `video` sigue limitada por la interfaz del navegador.
* Los atajos alternativos respetan controles enfocados. El botón de subtítulos se elimina desde la construcción del panel.
* Pruebas de regresión en navegador con DOM de ejemplo para etiquetas estables, Tab/Enter/Espacio, controles ocultos/deshabilitados, fallback, observadores y pantalla completa. Sigue pendiente la validación en una sesión real de ViX con NVDA.
* Sin cambios al lector de subtítulos ni refactor de 3.0.

* Mejora del etiquetado automático de controles en reproductores poco accesibles.
* Compatibilidad específica para controles de **ViX**, incluyendo componentes sin semántica HTML suficiente.
* Activación de `keepAlive` en ViX para evitar que los controles desaparezcan durante la navegación con lector de pantalla.
* Detección dinámica del nivel de accesibilidad del reproductor nativo:

  * si el reproductor ya ofrece controles accesibles, los controles alternativos de KathWare no se muestran;
  * si no existe una interfaz usable por teclado y lector de pantalla, se muestran como fallback.
* Eliminación del botón **Alternar pista de subtítulos** del reproductor alternativo de KathWare.
* Eliminación del atajo `C` asociado a ese control.
* Cuando el reproductor del sitio ya es accesible, SubtitleReader tampoco captura sus atajos de reproducción.

#### Sintetizador de voz

* Corrección del atraso del sintetizador respecto de subtítulos rápidos.
* La velocidad de `SpeechSynthesisUtterance` deja de quedar fija en `1x`.
* Nueva velocidad inicial para subtítulos mediante sintetizador: **1.75x**.
* Selector de velocidad disponible entre **1x y 3x**.
* Selector de voces disponibles a través de Web Speech API.
* Opción automática con preferencia por voces en español.
* Persistencia de voz y velocidad mediante `storage.local`.
* Actualización automática del listado cuando el navegador carga voces mediante `voiceschanged`.
* La velocidad del modo **Lector** sigue dependiendo exclusivamente del lector de pantalla del usuario.

#### Interfaz, diagnóstico y pruebas

* Incorporación de herramientas de prueba dentro del panel:

  * Debug
  * Diagnóstico
  * Reiniciar lectura
* Nuevos atajos de prueba:

  * `Alt + Shift + D` → activar o desactivar debug
  * `Alt + Shift + R` → reiniciar la lectura / diagnóstico según contexto
* El diagnóstico informa, entre otros datos:

  * versión
  * plataforma detectada
  * fuente efectiva TRACK / VISUAL
  * selector visual activo
  * estado del video
  * pistas de texto disponibles
  * estado de TTS
  * voz y velocidad seleccionadas
* Reinicio del pipeline al cambiar de pantalla completa para recuperar observadores y lectura cuando el DOM del reproductor cambia.

#### Manifest y estado de la beta

* `manifest.json` actualizado a:

  * `version`: `2.2.0`
  * `version_name`: `2.2.0-beta`
* La rama `2.2.0-beta` se mantiene como banco de pruebas antes de fusionar los cambios con la versión estable.

#### Pendiente antes de estabilizar 2.2.0

* Validación manual en Chrome de:

  * YouTube
  * ViX
  * Disney+
  * Flow
* Confirmar comportamiento del sintetizador con distintas voces y velocidades.
* Confirmar que la detección de reproductor accesible no oculte controles alternativos cuando todavía son necesarios.
* Revisar compatibilidad de pantalla completa y cambios dinámicos del DOM.

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
