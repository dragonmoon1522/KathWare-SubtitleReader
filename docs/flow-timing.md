# Medir el atraso de Flow en vivo

Herramienta de diagnóstico de 3.0.0-beta, revisión 1. El atraso reportado de unos
10 segundos ocurre tanto con NVDA como con el sintetizador del navegador. La
medición busca separar la disponibilidad del texto de su entrega a la voz.

## Hacer una marca

1. Actualizar desde la rama `3.0.0-beta`, recargar la extensión y la pestaña de
   Flow. El diagnóstico debe incluir `flowTiming` con `revision: 1`.
2. Con el foco en la página y el video reproduciéndose, escuchar una palabra
   distintiva en **el audio original del video** y pulsar **Alt+Shift+M** en ese
   momento. También está el botón **Marcar audio de Flow** en el panel.
3. Se abre el panel y el foco pasa al campo **Palabra distintiva escuchada en el
   audio del video**. Escribir esa palabra y presionar **Enter**. Escribirla
   después no cambia la marca de tiempo, que ya quedó registrada.
4. Dejar el video reproduciéndose, sin pausarlo, adelantarlo ni cambiar su
   velocidad. El observador captura durante un máximo de 30 segundos. El
   resultado aparece como un mensaje de estado en el panel.
5. Copiar el diagnóstico, que incluye `flowTiming`, o los registros
   **`[KWSR FLOW TIMING]`** de la consola. Pueden aparecer varias líneas al llegar
   el subtítulo y después las salidas; la última contiene los datos más completos.

Elegir una palabra concreta, poco repetida en ese diálogo. Una palabra común
puede coincidir con otro subtítulo de la misma pantalla. Si ya estaba visible al
marcar, se informa que su llegada anterior es desconocida y se debe repetir con
otra palabra; nunca se convierte esa situación en un atraso de cero segundos.

## Qué mide el informe

| Campo | Significado |
| --- | --- |
| `audioMark` | Referencia manual del audio y tiempo del video en ese instante. |
| `caption.observedAfterAudioMarkMs` | Milisegundos entre la marca y la primera observación de la palabra completa en el texto de Flow. |
| `caption.videoSecondsAfterAudioMark` | Diferencia entre los tiempos del video en esos mismos dos instantes. |
| `output.adapter.afterCaptionMs` | Tiempo desde esa observación hasta que el adaptador entrega la palabra a la capa de voz. |
| `output.live-region.afterCaptionMs` | Tiempo hasta que se actualiza realmente el texto de la región accesible. No es el instante en que NVDA lo pronuncia. |
| `output.tts-start.afterCaptionMs` | Tiempo hasta el evento de inicio de la frase del sintetizador del navegador, si se usó esa salida. No identifica el inicio acústico de cada palabra dentro de la frase. |

Si el texto aparece unos 10000 ms después de la marca y la entrega del adaptador
es de unos cientos de milisegundos, la demora está antes de preparar la salida de
KathWare, en la disponibilidad, renderizado o detección del subtítulo de Flow.
Eso por sí solo no identifica qué parte del servicio o reproductor originó el
desfase. Si el texto aparece pronto y el evento de voz tarda mucho, se investiga
la salida. Los campos sin coincidencia quedan en `null`.

Cada salida informa también `afterAudioMarkMs`. Si la palabra ya estaba visible
al marcar, se puede conservar ese tiempo desde la marca hasta la salida; el
tiempo desde la llegada desconocida del subtítulo permanece en `null`.

La referencia depende de la reacción de la persona y de que identifique la misma
palabra. El instante del texto es el observado por JavaScript, no una medición
del primer píxel dibujado. No se captura audio ni se analiza la transmisión, y
no se puede observar desde la página el inicio real del habla de NVDA. Los
datos se conservan en memoria de esa pestaña, con un historial acotado.

Pausar, buscar otra posición, cambiar de video o velocidad invalida la
comparación. Una nueva marca reemplaza la prueba anterior. La medición termina
automáticamente y conserva el informe para copiarlo.

## Verificación automatizada

```sh
node --test tests/flow-timing.cjs tests/flow-incremental.cjs tests/youtube-incremental.cjs
```

Las 65 pruebas pasan: 45 regresiones de lectura incremental y 20 de medición,
incluidos el marcador por teclado, el foco del campo, las etapas de salida,
la cancelación y el historial acotado. Se usan reloj y DOM simulados; la prueba
en Flow real con la marca manual sigue pendiente.

El significado del evento del sintetizador se documenta en
[SpeechSynthesisUtterance: start](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/start_event).
