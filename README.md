# KathWare SubtitleReader

**Autora:** Katherine Vargas · [KathWare](https://kathware.com.ar)

## Versión estable: 3.0.0

Desarrollé SubtitleReader para escuchar los subtítulos de las plataformas de
video con un lector de pantalla o con las voces del navegador. También agregué
controles accesibles para los reproductores que todavía los necesitan.

En `main` dejo el código de la extensión estable, este README, su historial y
la licencia. El desarrollo, las pruebas, los scripts de empaquetado y los
proyectos de reproductor se conservan en
[`3.0.0-beta`](https://github.com/dragonmoon1522/KathWare-SubtitleReader/tree/3.0.0-beta).

## Qué incluye

- Correcciones de Disney+ / Hive y mejoras de compatibilidad con YouTube,
  Paramount+ y ViX.
- Lectura desde pistas de texto o subtítulos visibles, con ajustes para evitar
  repeticiones.
- Elección de voz y velocidad en el modo sintetizador. La voz la elegís vos;
  la opción automática respeta la predeterminada del navegador.
- Lectura en pantalla completa del contenedor del reproductor.
- Recuperación de la voz con más margen y un reintento cuando corresponde,
  conservando el modo que elegiste ante un error.
- Controles de reproducción, avance, retroceso, volumen y pantalla completa,
  con mejoras para conservarlos visibles mientras los usamos con el teclado.
- Diagnóstico y reinicio manual de lectura.

En modo **Lector**, la voz y sus ajustes dependen de tu lector de pantalla.
En modo **Voz del sistema**, podés elegir entre las voces que exponga el navegador.
La extensión lee los subtítulos del contenido: acordate de activarlos.

## Plataformas que probé

Netflix, Disney+, Max, Paramount+ y YouTube funcionan bien en las pruebas que
hice durante el desarrollo. También comprobé Flow a demanda y la lectura de ViX.
No doy por probado un sitio solo porque tenga selectores en el código.

**Flow en vivo sigue pendiente:** puede ir detrás del audio y entregar frases
cortadas. También hay limitaciones cuando la pantalla completa nativa muestra
únicamente el elemento de video; el botón de KathWare usa el contenedor cuando
está disponible.

## Atajos

| Acción | Comando |
| --- | --- |
| Activar o desactivar | Alt+Shift+K |
| Cambiar modo de lectura | Alt+Shift+L |
| Abrir o cerrar el panel | Alt+Shift+O |
| Activar o desactivar debug | Alt+Shift+D |
| Reiniciar la lectura | Alt+Shift+R |

## Instalación

La ficha de la extensión está en
[Chrome Web Store](https://chrome.google.com/webstore/detail/mbdjoamfljkbajlppfpahibnfjdiecbe/).
El código estable de GitHub y la actualización publicada en la tienda son pasos
separados.

Para cargarla localmente:

1. Descargá o cloná la rama `main`.
2. Abrí la administración de extensiones del navegador.
3. Activá el modo de desarrollador y elegí **Cargar sin comprimir**.
4. Seleccioná la carpeta `Extension/`.
5. Al actualizar, recargá la extensión y las pestañas donde la estabas usando.

El manifest está en `Extension/`. Si armás un ZIP, debe quedar en la raíz del
paquete, junto con los archivos de esa carpeta. Las
[herramientas para generar paquetes](https://github.com/dragonmoon1522/KathWare-SubtitleReader/blob/3.0.0-beta/docs/navegadores.md)
se mantienen en la rama de desarrollo y permiten elegir el código estable como
origen.

La primera distribución corresponde a Chrome. Después de aproximadamente dos
semanas de uso estable desde su publicación, evaluaré Edge y otros Chromium.
Firefox queda para más adelante.

## Privacidad y reportes

Los ajustes se guardan en el navegador. Los registros remotos son optativos:
la extensión no los envía por defecto.

Si encontrás un problema, podés abrir un issue con la plataforma, el navegador y
el modo de lectura que usaste. El diagnóstico ayuda a ubicarlo; revisá lo que
compartís antes de enviarlo.

[Historial de versiones](version.md) · [Licencia](LICENSE.md) ·
[Sitio del proyecto](https://kathware.com.ar/subtitlereader/)
