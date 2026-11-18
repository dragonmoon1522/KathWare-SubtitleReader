# Lectura en pantalla completa: ensayo en beta

17/11/2026. Revisión 1 de la región de anuncios. No forma parte de la estable
3.0.0 de `main`. El fallo continúa abierto hasta validarlo con NVDA.

## Qué sabemos

Katherine informa que la lectura automática y el reinicio manual no funcionan
en pantalla completa. NVDA+Tab sí permite consultar el texto enfocado, incluidos
subtítulos. Esto demuestra acceso a ese objeto al consultarlo; no confirma que
NVDA reciba los cambios de la región de anuncios de la extensión. La alerta
«para salir de pantalla completa, presione Esc» pertenece a la interfaz del
navegador y tampoco comprueba esa vía de salida.

En el código, el panel se movía al contenedor de pantalla completa, mientras
`#kwsr-live-region` permanecía en la raíz del documento. El reinicio de lectura
reutilizaba ese nodo sin revisar su ubicación. Esta diferencia es comprobable;
que sea la causa del silencio de NVDA es todavía una hipótesis.

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

1. Actualizar desde `3.0.0-beta`, recargar la extensión y la pestaña del servicio.
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

```sh
node --test tests/fullscreen-live-region.cjs tests/flow-incremental.cjs tests/flow-phrases.cjs tests/flow-timing.cjs tests/youtube-incremental.cjs
node --test tests/player-accessibility.cjs
```

El primer comando aprueba 95 pruebas de lógica: 15 nuevas de salida accesible y
pantalla completa, más 80 regresiones. Comprueba ubicación, reconexión, cambios
de contenedor, conservación del foco y deduplicación, cancelación de entregas y
la selección del contenedor desde los controles de KathWare.

La prueba de integración en navegador añade la entrada desde el botón, entrega
de texto dentro del contenedor y recuperación al salir. No pudo ejecutarse aquí:
Chromium falla al crear un socket con `Operation not permitted`. Ninguna de estas
pruebas acredita por sí sola la pronunciación de NVDA.

Referencias: [NVDA: consulta del foco](https://download.nvaccess.org/documentation/en/keyCommands.html),
[regiones ARIA live](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)
y [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API).
