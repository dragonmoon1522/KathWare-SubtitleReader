# Medir el atraso de Flow en vivo

El diagnóstico de 3.0.0-beta, revisión 3, usa dos marcas de teclado. Sirve
para comparar el diálogo original con el subtítulo y distinguir cuándo se
observó el texto en Flow de cuándo lo entregó KathWare.

1. Actualizá desde `3.0.0-beta`, recargá la extensión y después la pestaña de
   Flow. El botón **Diagnóstico** identifica `flowTiming.revision: 3` y
   `flowReaderRevision: 4`.
2. Con el video en marcha y el foco en la página de Flow, pulsá **Alt+Shift+M**
   al escuchar una frase fácil de reconocer en el audio original.
3. Al aparecer o al escuchar leído **el subtítulo de esa misma frase**, pulsá
   **Alt+Shift+N**. El video sigue y el foco queda donde estaba. No hace falta
   abrir el panel ni escribir.
4. Buscá en la consola **`[KathWare] CONSOLE RENDERER FLOW TIMING`** con
   `"phase":"measured"`. Compartí esa línea para revisar los tiempos. El
   panel también conserva el intervalo entre las dos marcas.

La segunda marca debe llegar dentro de 30 segundos. Si se pasó el plazo, se
pausó, se cambió de video o se saltó a otra posición, se puede empezar de
nuevo con Alt+Shift+M. Los datos quedan en memoria de la pestaña.

| Campo | Qué muestra |
| --- | --- |
| `audioMark` y `subtitleMark` | Las dos pulsaciones, con el tiempo del video y el texto que se encontró en Flow en cada una. |
| `manualDelayMs` | Milisegundos entre las dos pulsaciones. Incluye el tiempo de reacción. |
| `videoElapsedMs` | Milisegundos que avanzó el video entre las marcas. |
| `timeline` | Cambios del texto de Flow (`caption`), entregas del adaptador (`adapter`), actualizaciones de la región accesible (`live-region`) e inicios del sintetizador (`tts-start`), con tiempo relativo a la primera marca. |
| `omittedEvents` | Eventos más viejos descartados si se llenó el registro de 240. |

Si el texto de la frase aparece tarde en el registro y KathWare lo entrega
enseguida, la mayor parte del atraso ya estaba antes de la salida de
KathWare. Si el texto se observa pronto pero sale tarde, se puede revisar
la entrega y la voz por separado. Compará la misma frase en todos los casos:
los subtítulos de Flow pueden conservar texto de líneas anteriores.

La extensión no graba el audio ni mide cuándo habla NVDA. La región accesible
registra el momento en que cambia su texto; el inicio del sintetizador solo
está disponible cuando se usa la voz del navegador.

Para probar con reloj y reproductor simulados:

```sh
node --test tests/flow-timing.cjs tests/flow-incremental.cjs tests/youtube-incremental.cjs
```
