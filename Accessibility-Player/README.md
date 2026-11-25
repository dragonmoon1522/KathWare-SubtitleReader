# KathWare Accessibility Player

**Autora:** Katherine Vargas · [KathWare](https://kathware.com.ar)
**Documentación actualizada:** 25/11/2026

Accessibility Player es el reproductor que desarrollo para abrir archivos locales
de audio o video y escuchar sus subtítulos. Podés usar tu lector de pantalla o
elegir una de las voces disponibles en el navegador.

Mantengo su documentación y su historial separados de SubtitleReader. También
documento aparte la adaptación para WPCode Lite: instalar el snippet en mi sitio
y usar el reproductor local son entregas distintas.

## Probar el reproductor local

El archivo preparado está en
[`web/kathware-player-local.html`](../web/kathware-player-local.html).
Podés guardarlo como HTML y abrirlo en el navegador.

1. Cargá un archivo de audio o video.
2. Cargá sus subtítulos en formato VTT o SRT.
3. Elegí el modo de lectura y comenzá la reproducción.
4. Si usás la voz del navegador, elegí la voz y la velocidad.

Los archivos se abren desde tu dispositivo mediante URL locales de objeto.
Los formatos de audio y video disponibles dependen del navegador.

## Cambios preparados

- Pantalla completa del contenedor, con el video, los controles y los anuncios
  del lector de pantalla en el mismo espacio.
- Recuperación del sintetizador sin cambiar el modo elegido ante un error.
- Elección de voz sin idioma preferido. La opción automática usa la
  predeterminada del navegador.
- Selector de velocidad, controles de reproducción, progreso y volumen del archivo.
- Conversión local de los tiempos SRT a VTT y limpieza de las URL de archivos
  cuando se reemplazan o se abandona la página.

La voz del modo lector se configura en el lector de pantalla. Los botones de
volumen ajustan el audio del archivo. La pantalla completa nativa que muestra
solo el video conserva limitaciones; el botón del Player utiliza el contenedor.

## Fuente y pruebas

La plantilla está en [`web/player-template.html`](../web/player-template.html).
Reutilizo el módulo de salida de voz de SubtitleReader para conservar las mismas
correcciones, pero cada proyecto tiene su propio historial.

```sh
python3 scripts/build_player.py
node --test tests/local-player.cjs
```

Los comandos se ejecutan desde la raíz del repositorio. Las nueve pruebas del
Player pasaron con DOM, archivos y síntesis simulados. La ejecución de Chromium
quedó bloqueada por restricciones de sockets, así que esas pruebas no acreditan
audio real ni lectura de NVDA.

El archivo preparado conserva un identificador interno `3.0.0` tomado de la
base compartida. No lo uso para anunciar una versión independiente del Player:
por ahora registro sus cambios por fecha en [su historial](version.md).
