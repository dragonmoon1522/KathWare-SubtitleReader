# Lectura en pantalla completa

Desarrollé la revisión 1 el 17/11/2026 y la pasé a la estable 3.0.0
el 20/11/2026. Se conserva el límite del modo nativo de video.

## Qué sabemos

En la prueba inicial, la lectura automática y el reinicio manual no funcionaban
en pantalla completa. NVDA+Tab sí permite consultar el texto enfocado, incluidos
subtítulos. Esto demuestra acceso a ese objeto al consultarlo; no confirma que
NVDA reciba los cambios de la región de anuncios de la extensión. La alerta
«para salir de pantalla completa, presione Esc» pertenece a la interfaz del
navegador y tampoco comprueba esa vía de salida.

Después comprobé que el sintetizador del navegador sí puede leer en pantalla
completa. Su cambio automático a modo lector ante un
fallo se aborda por separado en [recuperación de TTS](tts-recuperacion.md).
El ensayo de esta página corresponde a los anuncios de NVDA y otros lectores.

En el código, el panel se movía al contenedor de pantalla completa, mientras
`#kwsr-live-region` permanecía en la raíz del documento. El reinicio de lectura
reutilizaba ese nodo sin revisar su ubicación. Esta diferencia es comprobable;
después de probar la corrección, la incorporé a la estable.

## Qué cambia

La región accesible se prepara vacía y conserva `role=status`, `aria-live=polite`
y `aria-atomic=true`. Al cambiar de pantalla completa acompaña al contenedor
correspondiente; si el sitio la elimina, vuelve a conectarse al entregar un
subtítulo. También se contempla el contenedor interior de Shadow DOM abierto.
Se mantiene independiente del panel, que puede estar oculto.

El cambio no mueve el foco ni reinicia los observadores, la captura de pistas o
la deduplicación. Tampoco vuelve a anunciar el subtítulo anterior al entrar o
salir. Detener la lectura cancela actualizaciones diferidas que todavía no se
entregaron; una pausa o un cambio de modo evita anuncios pendientes obsoletos.

Los controles de KathWare solicitan pantalla completa sobre el contenedor
existente del reproductor cuando está disponible. No se envuelve ni se mueve el
video y no se reemplazan los botones nativos de las plataformas.

Si el elemento en pantalla completa es `video` o `audio`, sus hijos son contenido
alternativo, no una superficie fiable para anuncios. En ese caso la región se
mantiene en el documento y el diagnóstico muestra `native-media-fullscreen`.
No se considera resuelto ese modo. Tampoco se garantiza acceso al interior de
Shadow DOM cerrado, reproductores de otros documentos o interfaces del navegador.

## Prueba con NVDA

1. Actualizar desde `main` (estable) o `3.0.0-beta` (desarrollo), recargar
   la extensión y la pestaña del servicio.
2. Activar SubtitleReader, elegir modo lector y comprobar algunos subtítulos
   con el video en reproducción y la vista normal.
3. Abrir el panel de KathWare y usar su botón «Pantalla completa». Dejar pasar
   varios subtítulos nuevos sin consultar el foco ni reiniciar la lectura.
4. Comprobar si NVDA los anuncia automáticamente, si hay repeticiones y si la
   lectura continúa al salir con Esc. La alerta inicial del navegador no cuenta.
5. Comparar con el botón de pantalla completa propio de la plataforma. Puede
   elegir otro elemento y, por tanto, tener un resultado distinto.

Registrar plataforma, navegador, versión de NVDA, método de entrada y resultado.
El diagnóstico del panel incluye `liveRegion`: `revision`, `scope`,
`fullscreenTag`, `connected`, `hostTag`, `insideFullscreen` y texto actual.
`connected=true` e `insideFullscreen=true` acreditan ubicación, no habla de NVDA.

## Comprobaciones de desarrollo

La extensión tiene 111 pruebas Node en esta revisión. Se verifican entrada y
salida del contenedor, reconexión, foco,
deduplicación, cancelación y recuperación del sintetizador. La prueba de
navegador está bloqueada por creación de sockets en este entorno; la
comprobación de uso real corresponde a las pruebas que hice con NVDA.

Referencias: [NVDA: consulta del foco](https://download.nvaccess.org/documentation/en/keyCommands.html),
[regiones ARIA live](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)
y [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API).
