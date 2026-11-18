# Compatibilidad automática y reportes

17/11/2026. Revisión 1, disponible en `3.0.0-beta`. La estable 3.0.0 de `main`
conserva su código. Se mantiene la organización actual por plataformas; el
refactor por motores de renderizado continúa reservado para otra versión.

## Reutilización de selectores

La lectura por pistas utilizables del video mantiene su prioridad. Para la
lectura visual, el banco propio del sitio se prueba primero. Si no tiene uno,
o ese banco no encuentra un candidato, se prueban los otros bancos existentes
y los selectores de compatibilidad. Se eliminan duplicados y se dejan los
selectores genéricos más amplios al final. La unión actual suma 43 selectores
únicos para sitios sin banco propio.

Se reutilizan las listas de Netflix, Hive/Disney, Max, YouTube, Flow/THEOplayer,
ViX, Video.js, PlayKit/Kaltura y Plyr. Los lectores incrementales ya validados
de YouTube y Flow conservan su integración en sus plataformas. Usar sus
selectores en otro sitio no activa automáticamente esos lectores ni las
adaptaciones de controles de esa plataforma.

Una coincidencia CSS no es suficiente: los candidatos de compatibilidad deben
tener texto visible dentro del área del video activo. Se revisan ancestros
ocultos y se rechazan botones, menús, opciones, la interfaz de KathWare y texto
fuera del video. Los grupos estructurales de ViX se aceptan con su validación
de líneas, conservando la agrupación. No se mezclan padres e hijos repetidos
de selectores que incluyen varios niveles del mismo texto.

Se conserva el selector encontrado y se reevalúa con los temporizadores
existentes. Las búsquedas sin resultado se espacian; el respaldo periódico de
compatibilidad recupera cambios de CSS y subtítulos que aparecen después. Un
cambio de video o fuente reinicia la búsqueda. La comprobación periódica no
vuelve a leer un subtítulo de Disney que sigue igual.

## Estado de detección

El popup distingue extensión apagada, modo desactivado, ausencia de video,
lectura por pistas, selector encontrado y espera de subtítulos. También
reconoce el fallback existente de Shadow DOM abierto.

Una búsqueda sin texto significa que todavía no hay un candidato utilizable.
No acredita incompatibilidad: puede haber una pausa entre frases, subtítulos
desactivados o un video sin iniciar. El mensaje pide reproducir contenido con
subtítulos visibles y ofrece debug y reporte si persiste el problema.

El diagnóstico incluye `selectorSearch`: revisión, estado, número total de
candidatos, intentos realizados, selector elegido, banco de origen y resultados
de la búsqueda. El resumen del popup no incluye el texto de los subtítulos.

## Preparar un reporte

1. Activar SubtitleReader e iniciar un video con subtítulos visibles.
2. Si no se leen, abrir el popup y pulsar «Activar debug». También sigue
   disponible Alt+Shift+D en la página.
3. Reproducir unos segundos y volver al popup. Describir qué ocurrió y en qué
   contenido o situación, hasta 1000 caracteres; se pueden agregar más detalles
   al revisar el formulario de GitHub.
4. Elegir si se adjuntan diagnóstico y registros de esta pestaña. Esta opción
   está desmarcada inicialmente y puede incluir texto de subtítulos.
5. Pulsar «Preparar reporte en GitHub». Revisar el borrador y publicarlo desde
   GitHub cuando esté listo. La extensión no publica issues automáticamente.

El ajuste de debug se guarda como antes. Los nuevos registros del reporte
permanecen en memoria en cada página, con hasta 100 entradas, y solo se recopilan
con debug activado. Se conservan hasta recargar esa página; el reporte no usa
registros persistidos de otras pestañas. El diagnóstico completo se solicita
solo cuando el usuario elige adjuntarlo.

Las URL técnicas de la página y de los registros omiten credenciales, parámetros
y fragmentos. Los comentarios se conservan. Los detalles técnicos pueden
resumirse para ajustar el tamaño del enlace al formulario. Si no se puede
consultar el diagnóstico solicitado o abrir GitHub, se informa el fallo y se
conservan los comentarios mientras el popup siga abierto.

## Alcance de las pruebas

```sh
node --test tests/selector-fallback.cjs tests/report-flow.cjs tests/tts-recovery.cjs tests/fullscreen-live-region.cjs tests/flow-incremental.cjs tests/flow-phrases.cjs tests/flow-timing.cjs tests/youtube-incremental.cjs
```

Resultado: 150 pruebas de lógica aprobadas; 16 de selección, 15 de diagnóstico
y reportes, y 119 regresiones. Los escenarios usan DOM, reloj, API de extensión
y mensajería simulados. No abren Crunchyroll ni publican un issue.

Se agregan dos escenarios de integración en `tests/selector-browser.cjs`.
La ejecución junto con las pruebas existentes de ViX y controles está bloqueada:
Chromium falla al crear sockets con `Operation not permitted`. Queda pendiente
validar el comportamiento en Chrome real y con NVDA o voz del navegador.

Crunchyroll está reconocido por su dominio y participa de la búsqueda compartida,
pero su servicio real no se considera verificado. Los selectores consultan el
documento donde corre el contenido de la extensión; esta revisión no añade
coordinación entre iframes ni acceso a marcos aislados de otro origen. Se mantienen
los límites de Shadow DOM cerrado y de subtítulos dibujados en imágenes o canvas.
El diagnóstico incluye el número de iframes para ayudar a investigar esos casos.

Referencias: [mensajería de extensiones de Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
y [creación de issues en GitHub](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue).
