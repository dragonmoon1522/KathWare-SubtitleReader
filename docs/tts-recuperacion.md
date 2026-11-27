# Recuperación de la voz del navegador

Revisión 1, desarrollada el 17/11/2026 y aprobada para la estable 3.0.0
el 20/11/2026. La voz automática sigue la predeterminada del navegador;
ningún idioma recibe prioridad impuesta por SubtitleReader.

El 26/11/2026 actualicé la recuperación a **revisión 2**, con lectura por turnos
en beta y estable. Ambos modos reciben el mismo texto filtrado; el navegador
termina una frase antes de empezar la siguiente. No se cancela por la llegada
de un subtítulo nuevo. La revisión 1 se conserva en el historial.

Comprobé que el sintetizador puede leer subtítulos en pantalla completa.
El problema estaba en la recuperación: ante un fallo, SubtitleReader
cambiaba y guardaba el modo lector automáticamente. Esto es independiente del
[corrección de anuncios de NVDA en pantalla completa](fullscreen-lectura.md).

## Causas comprobadas en el código anterior

- El temporizador de 4,5 segundos vigilaba toda la frase, incluso cuando estaba
  hablando correctamente. Otra comprobación de 5,5 segundos también podía
  interpretar una lectura larga como un bloqueo.
- Sustituir una frase por otra usa `speechSynthesis.cancel()`. Esa cancelación
  puede producir `canceled` o `interrupted`; antes se trataban como fallos.
- Los eventos de frases anteriores podían modificar el estado y los tiempos
  de la frase actual.
- Cualquier fallo cambiaba el modo a lector y lo guardaba en la configuración.

## Comportamiento de la estable

La salida sigue siendo la que el usuario eligió. Un error del sintetizador no
cambia el modo ni entrega ese subtítulo por la región `aria-live`. Se conservan
la voz, la velocidad y el volumen elegidos. Los ajustes que el usuario cambie deliberadamente
durante una espera se aplican al siguiente intento.

| Situación | Recuperación |
| --- | --- |
| La voz todavía no comenzó | Se esperan hasta 10 segundos para el evento de inicio. |
| La frase ya está hablando | El margen depende del texto pendiente y de la velocidad efectiva: al menos 15 segundos, hasta 120 segundos por período sin avance. Los eventos de avance de palabra renuevan el margen. |
| Fallo recuperable antes del inicio | Un reintento después de 500 ms, mientras siga siendo el mismo video, posición y modo. Conserva su turno delante de las frases nuevas. |
| Llega un subtítulo nuevo | Espera su turno, sin cortar la frase que se está leyendo ni cancelar su reintento. |
| La frase falló después de empezar | Se limpia el intento y se continúa con la siguiente frase en espera, sin repetir entera una frase parcialmente escuchada. |
| Se agotó el reintento | Se informa el problema, se conserva el modo voz y se permite continuar con la frase siguiente. |
| Voz/idioma no disponible, argumento inválido, texto demasiado largo o bloqueo del navegador | Se informa el problema sin repetir automáticamente el mismo intento. Se puede elegir otra voz o reiniciar la lectura. |
| Pausa, búsqueda de otra posición, finalización, cambio de video, apagado, reinicio o cambio de modo | Se invalida el intento anterior y se vacían las frases en espera. |

Estos tiempos son valores de implementación para probar, no garantías de
duración o latencia de Web Speech. No es necesario esperar 10 segundos para cada
subtítulo: ese tiempo es un límite si no llega el evento de inicio. Las frases
que terminan normalmente liberan su vigilancia al finalizar.

Las cancelaciones deliberadas se invalidan antes de llamar al motor. Los eventos
tardíos de una frase o intento anterior no pueden cambiar el estado, cancelar la
vigilancia actual o producir nuevos reintentos. Un motor de síntesis pausado se
reanuda antes de solicitar voz.

Los avisos de fallo se limitan a uno cada 10 segundos. El límite de avisos no
bloquea nuevos subtítulos. El diagnóstico del panel incluye `ttsRecovery` con
`revision`, `phase`, `attempt`, `started`, `deadlineAt` y `lastError`.
La revisión 2 añade `queued`, la cantidad de frases que todavía esperan turno.
Voz, velocidad y volumen se aplican al comenzar cada turno o reintento. La cola
puede atrasarse con una voz lenta; Alt+Shift+R permite vaciarla y reiniciar.

## Validación

La promoción del 20/11 aprobó 111 pruebas Node de la extensión: regresiones de lectura,
integridad de la estable, pantalla completa, recuperación y seis escenarios
sobre elección libre de voz. Se usan eventos y síntesis simulados.

Después de recargar, el error anterior no volvió a aparecer. Por eso pasé
estas correcciones a la estable. La prueba de navegador no puede
arrancar aquí por restricciones de sockets; no se atribuye a Node una validación
de audio real o pronunciación de NVDA.

Los toques finales del 26/11 aprobaron **146 pruebas Node de la estable y 197
de beta**. Incluyen 13 escenarios de cola y 12 de foco y respaldo. Se actualizaron
las pruebas de sustitución para comprobar ahora la cancelación deliberada,
conservando la protección frente a eventos tardíos y los ajustes guardados.

Referencias: [errores de Web Speech](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisErrorEvent/error)
y [especificación de síntesis](https://webaudio.github.io/web-speech-api/).
