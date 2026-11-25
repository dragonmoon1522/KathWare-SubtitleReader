# Historial de KathWare Accessibility Player

**Autora:** Katherine Vargas
**Documentación actualizada:** 25/11/2026

Este historial corresponde al reproductor local. El snippet de WPCode Lite
lleva sus propias notas de integración. La versión 3.0.0 de SubtitleReader no
define una versión o publicación del Player.

## 25/11/2026 — documentación por proyecto

Separé el README y el historial del Player de los de la extensión y de los del
snippet. Esta revisión es documental; no cambia la reproducción ni crea una
nueva versión funcional.

## 20/11/2026 — actualización preparada

Incorporé la salida de voz corregida y preparé el reproductor para archivos
locales con HTML, CSS y JavaScript en un solo fragmento:

- La región de anuncios acompaña al contenedor de pantalla completa.
- Los errores de síntesis conservan el modo y la voz elegidos.
- La recuperación espera más tiempo y permite un reintento antes de iniciar.
- La elección de voz respeta al usuario o la predeterminada del navegador.
- Agregué selección de velocidad y conversión local de tiempos SRT a VTT.
- Mantuve controles, progreso y carga local de audio, video y subtítulos.

Reutilicé la salida de SubtitleReader estable del 20/11/2026. Las nueve pruebas
del reproductor generado pasaron con eventos y síntesis simulados. Queda probar
la integración en un navegador real y con las voces que use cada persona.

## Antecedente anterior al 20/11/2026

El archivo local anterior necesitaba los elementos HTML de la página y estaba
preparado para insertarse junto a ellos. Lo conservo en el historial de Git.
La consola experimental de SubtitleReader que también está en `web/` es una
herramienta distinta y conserva su propio identificador de desarrollo.
