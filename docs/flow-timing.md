# Revisar el atraso de Flow en vivo

Diagnóstico de 3.0.0-beta, revisión 2. El atraso reportado de unos 10 segundos
ocurre tanto con NVDA como con el sintetizador del navegador. La prueba simple
congela el texto encontrado en Flow para compararlo con el diálogo escuchado.

## Prueba simple: capturar y pausar

1. Actualizar desde la rama `3.0.0-beta`, recargar la extensión y la pestaña de
   Flow. El diagnóstico debe incluir `flowTiming` con `revision: 2`.
   El lector actual se identifica como `flowReaderRevision: 4`; sus registros
   habituales incluyen `revision: 4` y `flowTimingRevision: 2`.
2. Con el foco en la página y mientras se escucha el audio original del video,
   pulsar **Alt+Shift+M**. No hace falta esperar una palabra concreta. También
   está el botón **Capturar subtítulo y pausar** en el panel.
3. KathWare guarda primero el texto del subtítulo y después pausa el video.
   Se abre el panel y el foco pasa a **Subtítulo encontrado en Flow al capturar**,
   un campo de solo lectura. Comparar especialmente las últimas palabras: las
   líneas anteriores pueden seguir visibles por el desplazamiento del subtítulo.
   Revisar si ese final corresponde al diálogo que se acababa de escuchar o
   a una frase anterior. Se puede copiar con los comandos normales
   del campo de texto.
4. El botón **Reanudar video** permite continuar. El diagnóstico conserva la
   captura y la consola registra **`[KathWare] CONSOLE RENDERER FLOW TIMING`**
   para compartirla. Este prefijo comparte las etiquetas de los mensajes
   habituales de KathWare para facilitar su visualización junto con ellos.

Capturar antes de pausar evita perder el texto si el reproductor retira sus
subtítulos al recibir la pausa. La captura queda fija aunque el DOM cambie
más tarde. Si la pausa automática falla, el informe lo indica y el texto se
conserva para revisarlo usando los controles normales del video.

## Qué contiene la captura

| Campo | Significado |
| --- | --- |
| `phase: snapshot` | Se hizo una captura, no una medición exacta del desfase con el audio. |
| `videoTime` | Posición del video al capturar. |
| `sourceText` | Texto encontrado en Flow antes de solicitar la pausa. |
| `selector` | Selector que encontró el texto. |
| `lastDeliveredText` | Último texto entregado a la capa de salida. |
| `lastDeliveredAgoMs` | Tiempo desde esa entrega hasta la captura, si se conoce. |
| `pauseSucceeded` | Indica si el video quedó pausado. |
| `audioOffsetMeasured: false` | La comparación con el audio es de la persona; la captura no inventa una cantidad de segundos. |

Si la propia captura contiene un diálogo anterior al que se escuchaba, el
atraso ya existe en el texto disponible para el lector. Eso ayuda a localizar
la demora antes de la salida de voz, pero no identifica por sí solo si se debe
al servicio, al renderizado de Flow o a la selección/detección del texto. Si
la captura corresponde al diálogo actual y la voz iba atrás, se investiga el
tramo de entrega y salida.

Se necesita esa comparación humana: estos datos no contienen el audio de la
transmisión. Los registros `live/flush` por sí solos no permiten medir cuándo
se dijo una frase en el video. Los datos de la prueba se conservan en memoria
de la pestaña.

## Medición detallada conservada

La API de diagnóstico conserva `markAudio` y `setWord` para una medición manual
más detallada desde el contexto de desarrollo de la extensión. Ya no es el
flujo predeterminado del panel ni del atajo.

Esa medición relaciona una marca manual con la primera observación de una palabra
completa mediante un observador independiente. Durante hasta 30 segundos registra
por separado la entrega del adaptador, la actualización real de la región
accesible y el evento de inicio de una frase del sintetizador del navegador.
No observa cuándo NVDA pronuncia el texto. Una palabra ya presente tiene un
instante de llegada desconocido; no se presenta como un atraso de cero.

Pausar, buscar otra posición o cambiar de video/velocidad invalida la medición
manual detallada. La captura simple, en cambio, pausa el video deliberadamente
y reemplaza cualquier medición anterior.

## Verificación automatizada

```sh
node --test tests/flow-timing.cjs tests/flow-incremental.cjs tests/youtube-incremental.cjs
```

Las 74 pruebas pasan: 50 regresiones de lectura incremental y 24 de medición y
captura, incluidos el atajo, el foco del campo de solo lectura, la conservación
del texto antes de pausar, etapas de salida y límites del historial. Se usan
reloj y DOM simulados; la comparación con el audio de Flow real sigue pendiente.

El significado del evento del sintetizador se documenta en
[SpeechSynthesisUtterance: start](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/start_event).
