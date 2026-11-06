## Historial de Versiones KathWare SubtitleReader

**Última actualización:** 2026-11-05
**Autora:** Katherine Vargas [(KathWare)](https://kathware.com.ar)

---

### **Versión 3.0.0-beta — en pruebas (2026-10-26)**

Continúa el trabajo iniciado como 2.2.0-beta el 28/09/2026. Reúne las mejoras
funcionales de la extensión sin introducir el refactor por renderizadores,
aplazado para una versión posterior. El paso a estable queda sujeto a las
pruebas y a la confirmación expresa de Katherine.

#### Plan de salida definido el 28/10/2026

* La primera distribución estable será la actualización de la extensión de
  Chrome, después de terminar las pruebas y recibir la confirmación de Katherine.
* Tras unas dos semanas de uso estable desde su publicación en Chrome, se
  preparará la misma versión funcional para otros navegadores. El plazo es
  aproximado y depende de los resultados de estabilidad y de las pruebas
  específicas de cada navegador.
* Las pruebas y adaptaciones para otros navegadores forman parte de esa segunda
  etapa, no de los requisitos para cerrar la salida inicial en Chrome.
* La reorganización por renderizadores, Audiocinemateca, la versión en inglés y
  la detección automática de idiomas quedan para versiones posteriores. Las
  demás ideas anotadas se conservan para evaluación futura.
* El detalle se mantiene en `docs/plan-de-versiones.md`.

#### Preparación de 3.0.0-beta (2026-10-26)

* Manifest actualizado a `version: "3.0.0"` y `version_name: "3.0.0-beta"`.
* El núcleo toma su versión del manifest y los reportes conservan la etiqueta
  beta; se elimina la versión 2.2.0 fijada por el adaptador incremental.
* Se conserva el historial de ambas ramas y la consola experimental de la
  antigua `3.0.0-beta`, independiente de la extensión empaquetada.
* Empaquetado reproducible desde la misma fuente para Chrome y otros Chromium.
  El paquete `chromium` prepara la distribución en Edge, Brave, Opera y Vivaldi;
  sus pruebas específicas y la publicación en tiendas siguen pendientes.
* README actualizado con el estado de las plataformas y documentación de
  instalación y empaquetado en `docs/navegadores.md`.
* Firefox queda aplazado tras una evaluación inicial de manifest y APIs.
* No se cambia `main`, no se publica una estable y no se suben paquetes a tiendas.

#### Alcance de esta versión

* Integración de mejoras funcionales sobre la arquitectura 2.x existente.
* Se mantiene la separación actual por módulos y adapters.
* Los cambios de paradigma, reorganización completa por renderizadores/contenedores y refactor estructural quedan reservados para **una versión posterior**.

#### Lectura de subtítulos y renderizadores

Medición con dos marcas y foco del reproductor (2026-11-05):

* `flowTiming` revisión 3 reemplaza la captura con pausa por **Alt+Shift+M**
  al escuchar el diálogo y **Alt+Shift+N** al detectar su subtítulo. Los atajos
  no cambian el foco, la reproducción ni la voz y no requieren escribir.
* El diagnóstico conserva el texto y la posición del video en las dos marcas,
  el intervalo entre ellas y un registro acotado de cambios del subtítulo,
  entregas, actualizaciones de la región accesible e inicios del sintetizador.
  Se imprime aunque el panel esté cerrado. La segunda marca es manual; no
  mide directamente cuándo habla NVDA.
* Al entrar al reproductor con foco, KathWare mantiene visibles sus barras
  ante el ocultamiento por opacidad o visibilidad y responde a Tab, Shift+Tab
  y flechas sin tomar el control de esas teclas. La ayuda se retira al salir
  del reproductor o desactivar la extensión. Se respetan menús cerrados y
  la barra alternativa espera a que salga el foco para desaparecer.
* Se agregan regresiones de las dos marcas y de navegación con teclado.
  Sigue pendiente comprobar el desfase de Flow y el foco con NVDA en los sitios.

Corrección de una cola repetida de Flow tras un vacío confirmado (2026-11-01):

* El nuevo registro muestra una frase entregada por partes que reaparece
  completa al reconstruirse el final de una línea después de un vacío de
  250 ms. Se incorpora una regresión de ese patrón, que fallaba en la revisión 3.
* Flow conserva una referencia breve de lo ya entregado tras confirmar el vacío.
  La reutiliza durante hasta dos segundos solo si el texto reaparece como una
  cola estricta de la línea anterior, con al menos tres palabras solapadas.
  Las palabras nuevas añadidas a esa cola siguen entregándose.
* No se usa esa recuperación para una frase completa idéntica ni para un
  solapamiento corto. Se descarta ante reinicios, cambios de video/fuente,
  saltos en la reproducción o al vencer el plazo. Se mantienen las esperas
  de lectura de 350/850 ms y la confirmación de vacío de 250 ms.
* `flowReaderRevision` pasa a 4. Sus registros incluyen `flowTimingRevision`
  para identificar si está cargado el diagnóstico, cuya revisión sigue siendo 2.
  El registro de reinicio agrega posición del video y última entrega conocida.
* La captura usa ahora el prefijo `[KathWare] CONSOLE RENDERER FLOW TIMING`,
  compartiendo las etiquetas de los registros habituales. Esto facilita verla
  junto con ellos si se filtra la consola; no confirma que un filtro fuera
  la causa de que no apareciera en los archivos recibidos.
* Validación: 74 pruebas aprobadas, con cinco regresiones nuevas de recuperación
  y liberación de contexto. Los registros recibidos siguen sin una referencia
  del audio: esta corrección no demuestra el origen ni elimina por sí sola
  el atraso de unos diez segundos reportado. La beta sigue pendiente de cierre.

Captura simple para revisar la sincronización de Flow (2026-10-31):

* Se simplifica la prueba que requería marcar y escribir una palabra durante
  el diálogo. Alt+Shift+M y el botón del panel ahora capturan el texto encontrado
  en Flow y después pausan el video. El foco pasa a un campo de solo lectura,
  para comparar la captura con lo que se acababa de escuchar.
* La captura conserva el último texto entregado y su antigüedad, la posición
  del video y si la pausa tuvo éxito. El resultado queda fijo y se puede
  continuar con **Reanudar video**. No se presenta como una medición exacta
  del desfase con el audio, ni atribuye la causa automáticamente a Flow.
* `flowTiming` pasa a revisión 2. La medición detallada por marca manual queda
  disponible en la API de desarrollo; deja de ser la interacción predeterminada.
  Los nuevos archivos recibidos contienen registros de lectura sin una marca
  de audio o captura, por lo que no cierran la identificación del atraso.
* Validación: 69 pruebas aprobadas, incluidas cuatro nuevas para capturar antes
  de que pause borre el subtítulo, conservar la captura, informar una pausa
  fallida y mantener el alcance exclusivo a Flow. Se actualizan las pruebas
  del atajo y del foco. La comparación real con el audio sigue pendiente.

Medición independiente del atraso de Flow (2026-10-31):

* Katherine confirma que el atraso ocurre también con el sintetizador del
  navegador y que NVDA está callado cuando aparece el subtítulo. La hipótesis
  de una acumulación exclusiva en NVDA pierde fuerza; la causa sigue abierta.
* Se incorpora un diagnóstico optativo para Flow, sin cambiar sus esperas de
  lectura: Alt+Shift+M marca una palabra escuchada en el audio original, abre
  el panel y enfoca un campo para escribirla. Un observador independiente mide
  su primera aparición en el texto del reproductor durante hasta 30 segundos.
* Se registran por separado la entrega del adaptador, la actualización de la
  región accesible y el evento de inicio del sintetizador del navegador. La
  medición no afirma observar cuándo NVDA pronuncia el texto ni permite
  atribuir el desfase a un servidor específico de Flow.
* Una palabra ya visible, una pausa, búsqueda, cambio de video o un historial
  insuficiente se informan sin inventar un tiempo de llegada. El registro se
  acota en memoria y el observador termina automáticamente.
* Los resultados se incluyen en el diagnóstico como `flowTiming`, revisión 1,
  y en la consola bajo `[KWSR FLOW TIMING]`. Instrucciones e interpretación en
  `docs/flow-timing.md`.
* Validación: 65 pruebas aprobadas, incluidas 20 de medición y los 45 casos
  previos de lectura incremental. Se comprueban las etapas de salida y el
  flujo de teclado/foco con DOM y reloj simulados. Falta el ensayo en Flow real.
  La extensión continúa como `3.0.0-beta`.

Corrección de lectura incremental de YouTube (2026-10-31, revisión 1):

* En el registro de un tutorial de guitarra, cada palabra nueva reiniciaba la
  espera de 850 ms. Al seguir hablando, la entrega se demoraba hasta una pausa
  o hasta acumular bastante texto. Además, el cálculo por diferencias omitía
  puntos y comas añadidos a palabras anteriores.
* YouTube conserva las palabras pendientes completas y sus correcciones. Las
  frases terminadas pueden entregarse aunque la misma actualización ya incluya
  palabras de la siguiente. Se conserva la puntuación disponible antes de la
  entrega y se evitan puntos o comas aislados al comienzo de una línea desplazada.
* Durante escritura continua hay un plazo de 850 ms que no se reinicia con cada
  palabra. Entrega las palabras anteriores a la última visible, que todavía
  puede estar formándose; la pausa de 850 ms termina de entregar lo pendiente.
  Se mantienen los cortes por puntuación o longitud. Estos tiempos no incluyen
  el atraso del subtitulado de origen ni de NVDA/TTS.
* Dos segmentos visibles distintos de YouTube ya no se descartan por contener
  el mismo texto. Se conservan repeticiones intencionales como
  `arriba, abajo, arriba, abajo` y segmentos que solo contienen puntuación.
* Se conservan las palabras al desplazarse o sustituirse brevemente los nodos.
  Un vacío de 250 ms se confirma releyendo el DOM antes de liberar la memoria.
  Los temporizadores comprueban que la extensión, la fuente y la lectura sigan
  activas antes de entregar texto, y se cancelan al reiniciar.
* El diagnóstico informa `youtubeReaderRevision: 1`. Los registros de YouTube
  son JSON copiables con `revision: 1`, texto detectado, pendiente y tiempo de
  espera. Flow mantiene su revisión 3; solo se comparte la comparación pura
  entre palabras, sin cambiar sus tiempos ni su estado.
* Validación: 45 pruebas aprobadas (31 de la suite existente y 14 específicas
  de YouTube). Se reutiliza el DOM y reloj simulados en `tests/helpers/`.
  La secuencia recibida conserva todas sus palabras en el ensayo; sus intervalos
  son simulados. Sigue pendiente escuchar esta revisión con NVDA/TTS en YouTube.
* La extensión sigue en `3.0.0-beta`, con la arquitectura actual por plataformas.

Corrección de repeticiones tras recambios breves del DOM de Flow (2026-10-31, revisión 3):

* En un nuevo registro, `ES LO MISMO. TENGO QUE IR. A JUGAR.` reaparece entero
  como pendiente justo antes de `121.`, aunque ya se había entregado. Una
  desaparición del texto durante un frame reproduce ese comportamiento: se
  borraba inmediatamente la memoria de lo leído. El registro original no
  permite identificar por sí solo qué provocó esa desaparición o reinicio.
* Flow espera 250 ms antes de confirmar que el subtítulo desapareció. Si vuelve
  durante ese intervalo, conserva las palabras leídas y las pendientes. Antes
  de confirmar el vacío, vuelve a consultar el DOM por si el texto regresó sin
  otro aviso del observador o del sondeo.
* Durante el vacío se suspende la entrega para evitar anunciar una palabra
  cortada. Al volver el texto se conserva el plazo de 850 ms ya iniciado para
  la escritura continua. Un vacío confirmado libera la memoria para permitir
  una nueva aparición legítima de la misma frase.
* Los reinicios cancelan también la espera de confirmación. El debug agrega
  eventos `gap` (inicio, restauración o confirmación) y `reset` con su motivo,
  para distinguir un recambio del DOM de otros reinicios durante la prueba real.
* El diagnóstico informa `flowReaderRevision: 3` y los registros Flow usan
  `revision: 3`. Se mantiene la versión `3.0.0-beta`.
* Validación: 31 pruebas con reloj controlado aprobadas. Incluyen el fragmento
  de `A JUGAR. 121.`, vacíos transitorios y persistentes, entrega de palabras
  pendientes, plazos y cancelación. La validación auditiva con NVDA/TTS de esta
  revisión sigue pendiente.

Corrección de palabras y líneas desplazadas en Flow / THEOplayer (2026-10-31):

* Los registros de Flow mostraron que una palabra podía completarse justo al
  desplazarse las líneas: `EL DO` → `EL DOLOR.` y `CUCHILLOS. Y E` →
  `CUCHILLOS. Y ES`. Se interpretaba como otro subtítulo, se enviaba el fragmento
  anterior y se repetía parte del texto ya leído.
* El adaptador de Flow conserva las palabras pendientes que salen de pantalla
  y alinea el final anterior con el principio actual, admitiendo que la última
  palabra siga creciendo. El desplazamiento por sí solo ya no fuerza una lectura
  del fragmento. Se libera el historial ya leído que dejó de ser visible.
* Se eliminan de la salida las marcas de hablante `>` y `>>`, incluso durante
  su construcción. Los registros mantienen el texto original para diagnóstico.
* Si una palabra cambia después de la pausa que ya provocó su lectura, se
  entrega la corrección desde esa palabra, sin repetir el prefijo sin cambios.
  No se puede retirar lo que el lector ya anunció: los 350 ms siguen siendo
  una espera heurística, y el límite de escritura continua se mantiene en 850 ms.
* Los registros Flow incluyen `revision: 2`; el diagnóstico general incluye
  `flowReaderRevision: 2` para distinguir esta corrección de paquetes anteriores.
  `CONSOLE RENDERER` es el nombre histórico de estos registros del adaptador.
* Validación: 23 pruebas con reloj controlado aprobadas, incluidas las dos
  secuencias recibidas y casos de corrección, marcas de hablante, repetición y
  cancelación. Los intervalos de las secuencias son simulados porque los registros
  no incluyen tiempos entre actualizaciones. Sigue pendiente la comprobación
  auditiva de esta revisión en Flow real con NVDA/TTS.
* Cambio acotado al adaptador incremental de Flow y su diagnóstico; se mantiene
  la arquitectura actual y la condición beta de 3.0.0.

Corrección de texto incremental Flow / THEOplayer (2026-10-03):

* Se conserva la frase actual separada del texto ya enviado. Las letras que completan una palabra pendiente reemplazan su versión parcial, en lugar de descartarse por tener la misma cantidad de palabras («TR» → «TRABAJO»).
* Flow espera 350 ms sin cambios para enviar el texto, incluso si tiene una sola palabra. Durante escritura continua hay un límite de 850 ms que no se reinicia con cada letra: envía hasta el último espacio y conserva la palabra final en formación. El límite no fuerza la salida de una palabra sin separación; esa palabra espera a estabilizarse.
* Al desplazarse las líneas se compara el final anterior con el principio actual, evitando quitar coincidencias en mitad de una frase. Se conserva el texto pendiente que sale de pantalla.
* Se cancelan temporizadores al reiniciar y se comprueba que la lectura siga habilitada antes de entregar texto. YouTube conserva su comportamiento previo.
* Los registros `CONSOLE RENDERER live/flush` de Flow incluyen JSON copiable con texto detectado, pendiente y tiempo de espera de la extensión.
* Pruebas con reloj controlado cubren palabras en formación, correcciones, pausas, escritura continua, líneas desplazadas y cancelación. Falta medir la experiencia en Flow real con NVDA: estos tiempos no incluyen el atraso del subtitulado de origen ni del lector de pantalla.

* Cambio del 2026-09-29: YouTube y Flow/THEOplayer eliminaron el mínimo de palabras para la pausa de 850 ms. Flow ajusta luego esos tiempos con la corrección del 2026-10-03 descrita arriba. El envío de un buffer vacío sigue descartándose.

Corrección de omisiones visuales ViX / Lura (2026-09-29):

* Un bloque de líneas `<p>` con `display: table` ya no se descarta por conservar una línea vacía u oculta. Se siguen agrupando las líneas visibles, sin ampliar la detección a texto arbitrario del player.
* El observador atiende cambios de subtítulos aunque el mismo lote empiece por una mutación de la interfaz de KathWare.
* En ViX se observan también cambios de clase/estilo/visibilidad y se mantiene el sondeo periódico como respaldo, incluso con observador activo. Esto recupera cues presentes al activar la lectura o al reanudarla sin otra mutación de texto.
* La lectura agrupada no depende de que el selector genérico haya encontrado previamente texto. Un intervalo sin texto libera la deduplicación visual de ViX para permitir una frase idéntica posterior; se conserva el filtro anti-eco de salida.
* Se excluyen bloques ocultos por sus ancestros. Debug registra el texto candidato y el número de líneas; el diagnóstico se imprime como JSON copiable e incluye candidato agrupado, último texto visual y última emisión.
* Validación: seis pruebas nuevas del detector visual en Chrome y nueve pruebas de accesibilidad del player aprobadas. Las pruebas capturan la entrega a la capa de voz; la comprobación de cobertura en una sesión real de ViX con NVDA/TTS sigue pendiente.
* Sin refactor estructural ni cambios a la velocidad, síntesis o cola de voz.

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
* Sin cambios al lector de subtítulos ni refactor estructural.

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

* Revisión de comentarios para facilitar la lectura y el mantenimiento: guías «Para ubicarte» en los 21 archivos JavaScript de la extensión, orientación en HTML/CSS y explicación de las pruebas. Se aclaran términos técnicos con ejemplos y se documentan las decisiones de lectura, espera y accesibilidad. Cambio documental, sin modificar instrucciones ejecutables ni adelantar la publicación estable; siguen pendientes las pruebas de YouTube y Flow en vivo.

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

  * `version`: `3.0.0`
  * `version_name`: `3.0.0-beta`
* La rama `3.0.0-beta` es la candidata de pruebas; `2.2.0-beta` se conserva como
  antecedente. La estable se preparará solo cuando Katherine la confirme.

#### Validación funcional confirmada el 31/10/2026

* Katherine confirmó que **Netflix, Disney+, Max y Paramount+** funcionan bien
  en sus pruebas de la beta. Se cierra la comprobación funcional reportada de
  estas cuatro plataformas y se actualiza su estado en README.
* Katherine confirmó después el funcionamiento correcto de **YouTube revisión
  1**. Se cierra también su comprobación funcional reportada.
* **Flow en vivo revisión 3** mantiene pendiente la sincronización: Katherine
  reporta unos 10 segundos de atraso frente a la transmisión. El registro
  contiene 12 entregas de una o dos palabras con `pendingMs` de 355 a 983 ms;
  no mide cuándo NVDA las pronuncia ni cuándo debían aparecer respecto del audio.
  La causa sigue abierta, sin atribuirla al proveedor ni al lector de pantalla
  solo a partir de esos valores.
* Flow a demanda y ViX mantienen el estado de validación anterior.
* Esta confirmación de funcionamiento no adelanta el paso a estable. Se conservan
  las comprobaciones generales de salida indicadas a continuación.

#### Pendiente antes de estabilizar 3.0.0

* Validación manual en Chrome de:

  * ViX
  * Flow en vivo: identificar y resolver o delimitar el atraso reportado.
* Confirmar comportamiento del sintetizador con distintas voces y velocidades.
* Confirmar que la detección de reproductor accesible no oculte controles alternativos cuando todavía son necesarios.
* Revisar compatibilidad de pantalla completa y cambios dinámicos del DOM.
* Revalidar Flow a demanda con el paquete final.
* Dailymotion / Telefe solo se anunciará como verificado si se completa una
  prueba específica; no hay cierre documentado en esta entrega.
* Recibir la confirmación expresa de Katherine para preparar la estable.

Las pruebas específicas para otros navegadores se harán en la segunda etapa
del lanzamiento, antes de anunciar su compatibilidad verificada.

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
