# Historial de KathWare SubtitleReader

**Autora:** Katherine Vargas

## 3.0.0 estable — 17/11/2026, actualizada el 20/11/2026

Dejé la estable en `main` y mantengo `3.0.0-beta` para continuar el desarrollo.
En esta entrega incorporé:

- Correcciones para Disney+ / Hive y mejoras de compatibilidad con YouTube,
  Paramount+ y ViX.
- Lectura incremental y ajustes para evitar repeticiones.
- Selector de voz y velocidad. La elección automática sigue la predeterminada
  del navegador, sin preferencia de idioma.
- Mejoras de accesibilidad de los controles y de su uso con el teclado.
- Lectura en pantalla completa del contenedor, con la región de anuncios en
  el mismo espacio.
- Recuperación del sintetizador: más margen para iniciar y terminar una frase,
  un reintento cuando corresponde y conservación del modo elegido ante errores.
- Diagnóstico, debug y reinicio manual con Alt+Shift+D/R.

El 20/11 pasé a estable las correcciones de pantalla completa y sintetizador
tras las últimas pruebas. Las herramientas experimentales de Flow y los
selectores ampliados de la beta no forman parte de esta entrega.

**Queda pendiente:** atraso y fragmentación de Flow en vivo y limitaciones de
la pantalla completa nativa que muestra solo el elemento de video.

## 25/11/2026 — limpieza de la rama estable

Dejé en `main` la extensión y su documentación básica. Las pruebas, los scripts,
los ensayos y los proyectos de reproductor se mantienen en desarrollo y en el
historial de Git. No modifiqué el código de `Extension/` ni su versión.

Las notas detalladas de desarrollo siguen en
[el historial de la beta](https://github.com/dragonmoon1522/KathWare-SubtitleReader/blob/3.0.0-beta/version.md).
Preparar el código o el ZIP no implica publicar la actualización en la tienda.

## 2.0.0 estable — 07/04/2026

Reorganicé el núcleo por responsabilidades, incorporé selección automática entre
pistas y subtítulos visuales, controles accesibles, diagnóstico y salida mediante
lector de pantalla o sintetizador. Dejé atrás los selectores manuales que no
ayudaban al uso cotidiano.

## 2.0.0 beta — 09/11/2025

Unifiqué las ramas anteriores e incorporé detección de reproductores HTML5,
selección de fuente y pista, lectura por lector o sintetizador y sincronización
de ajustes en el navegador.

## 1.0.0 beta — 08/07/2025

Primera lectura funcional de pistas y subtítulos visuales, controles por teclado,
panel flotante, diagnóstico voluntario y Licencia de Accesibilidad Universal.

Los detalles históricos de cada cambio se conservan en Git.
