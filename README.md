# KathWare SubtitleReader

**Autora:** Katherine Vargas · [KathWare](https://kathware.com.ar)
**Documentación actualizada:** 25/11/2026

Desarrollé SubtitleReader para escuchar los subtítulos de las plataformas de
video con un lector de pantalla o con las voces del navegador. También agregué
controles accesibles para los reproductores que todavía los necesitan.

## Rama de desarrollo: 3.0.0-beta

La estable 3.0.0 está en [`main`](https://github.com/dragonmoon1522/KathWare-SubtitleReader/tree/main).
En esta rama sigo con el desarrollo para próximas versiones. El paquete estable
lo genero desde `main`; la etiqueta de esta rama sigue siendo beta.

Además de las correcciones compartidas con la estable, acá mantengo la búsqueda
ampliada de selectores, la preparación de reportes y las herramientas de medición
de Flow. Todavía me falta probar sitios nuevos, como Crunchyroll, en el servicio
real. Los detalles están en [compatibilidad y reportes](docs/compatibilidad-y-reportes.md)
y [medición de Flow](docs/flow-timing.md).

## Qué incluye la 3.0.0

- Correcciones de Disney+ / Hive y compatibilidad incorporada para YouTube,
  Paramount+ y ViX.
- Lectura de subtítulos mediante pistas de texto o mediante el texto visible
  del reproductor, con ajustes para evitar repeticiones.
- Selección de voz y velocidad en el modo sintetizador. La voz la elegís vos;
  la opción automática respeta la predeterminada del navegador.
- Lectura en pantalla completa del contenedor del reproductor. La región que
  anuncia los subtítulos acompaña al video y a sus controles.
- Recuperación de la voz: más tiempo para iniciar y terminar cada frase y un
  reintento cuando corresponde. Un error ya no cambia el modo elegido a lector.
- Controles de reproducción, volumen, avance, retroceso y pantalla completa,
  con mejoras para conservarlos visibles mientras los recorremos con el teclado.
- Diagnóstico y reinicio manual de lectura.

En modo **Lector**, la voz y sus ajustes dependen del lector de pantalla que uses.
En modo **Voz del sistema**, podés elegir entre las voces que exponga el navegador.
La extensión lee los subtítulos del contenido: acordate de activarlos.

## Plataformas que probé

| Plataforma | Estado |
| --- | --- |
| Netflix y Max | Las probé durante la beta y funcionan bien. |
| Disney+ | Probé la corrección de Hive y funciona bien. |
| Paramount+ | Funciona bien en las pruebas realizadas. |
| YouTube | Probé la revisión 1 y funciona correctamente. |
| Flow a demanda | Funcionamiento comprobado durante el desarrollo. |
| ViX | Lectura comprobada y pruebas automatizadas de lectura y controles. |
| Flow en vivo | Sigue pendiente corregir el atraso y la entrega fragmentada. |
| Dailymotion / Telefe | Hay selectores previstos; todavía me falta probarlo. |

Que un sitio tenga selectores en el código no significa que ya lo haya probado.
Todavía no pude revisar todas las plataformas. Si encontrás un problema,
contame qué navegador, plataforma y modo de lectura usaste.

## Lo que queda pendiente

Flow en vivo todavía puede ir detrás del audio y entregar frases cortadas.
También hay una limitación con la pantalla completa nativa que muestra solo el
elemento de video: el botón de KathWare usa el contenedor cuando está disponible.
El detalle está en [problemas conocidos](docs/problemas-conocidos.md).

Voy a distribuir primero la actualización de Chrome. Después de aproximadamente
dos semanas de uso estable desde su publicación, evaluaré la misma versión para
Edge y otros navegadores Chromium. Firefox queda para más adelante.

También quedan para versiones posteriores la organización por tipo de renderizado,
la integración con Audiocinemateca para personas con cuenta válida, la versión
en inglés y la detección automática de idiomas.

## Atajos

| Acción | Comando |
| --- | --- |
| Activar o desactivar | Alt+Shift+K |
| Cambiar modo de lectura | Alt+Shift+L |
| Abrir o cerrar el panel | Alt+Shift+O |
| Activar o desactivar debug | Alt+Shift+D |
| Reiniciar la lectura | Alt+Shift+R |

## Instalación y paquetes

La ficha de la extensión está en [Chrome Web Store](https://chrome.google.com/webstore/detail/mbdjoamfljkbajlppfpahibnfjdiecbe/).
El código estable y el paquete preparado no indican por sí solos que esa misma
actualización ya esté publicada en la tienda.

Para cargar el código localmente:

1. Descargá o cloná el repositorio y elegí la rama que quieras probar.
2. Abrí la administración de extensiones del navegador.
3. Activá el modo de desarrollador y elegí **Cargar sin comprimir**.
4. Seleccioná la carpeta `Extension/`.
5. Al actualizar, recargá la extensión y las pestañas de los servicios.

Para generar el ZIP estable, desde `main`:

```sh
python3 scripts/package_extension.py --target chrome
```

El destino `chromium` prepara la base para otros navegadores. Todavía faltan las
pruebas específicas y sus procesos de publicación. Más información en
[paquetes y navegadores](docs/navegadores.md).

## Desarrollo y privacidad

Trabajo con HTML, CSS y JavaScript. El código de la extensión está en
`Extension/`, organizado en núcleo, interfaz y adaptadores. Mantengo la
arquitectura actual durante esta entrega; la reorganización por renderizadores
queda para otra versión.

Uso `textTracks`, subtítulos visibles en el DOM, regiones accesibles y,
opcionalmente, Web Speech API. Los ajustes se guardan en el navegador.
Los registros remotos son optativos: la extensión no los envía por defecto.

Si querés colaborar, podés abrir un issue o un pull request. El diagnóstico
ayuda a ubicar el problema; revisá lo que compartís antes de enviarlo.

## Documentación

- [Historial de SubtitleReader](version.md).
- [Plan de versiones](docs/plan-de-versiones.md).
- [Lectura en pantalla completa](docs/fullscreen-lectura.md).
- [Recuperación del sintetizador](docs/tts-recuperacion.md).

Accessibility Player es otro proyecto, con su
[README](Accessibility-Player/README.md) y su
[historial propio](Accessibility-Player/version.md). El snippet para WPCode Lite
tiene su documentación de integración por separado.

Sitio del proyecto: [KathWare SubtitleReader](https://kathware.com.ar/subtitlereader/).

Licencias: [LAU](https://kathware.com.ar/lau/) y
[condiciones de uso de KathWare](https://kathware.com.ar/normas-de-uso-y-licencias-de-kathware/).
