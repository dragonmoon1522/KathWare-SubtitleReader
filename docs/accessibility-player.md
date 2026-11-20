# Accessibility Player 3.0.0

Actualización preparada el 20/11/2026 para el reproductor de
`https://kathware.com.ar/accessibility-player/`.

## Fuente y generación

- Plantilla: `web/player-template.html`.
- Salida de lectura compartida: `Extension/content/core/kwsr.voice.js`.
- Generador: `python3 scripts/build_player.py`.
- Snippet generado: `web/kathware-player-local.html`.

El generador adapta la salida de voz a un namespace propio del reproductor,
sin sobrescribir `window.KWSR` de la extensión. El único ajuste de configuración
de frase es tomar la velocidad del selector local. No se agrega un segundo
motor de lectura de subtítulos ni una separación nueva por renderizadores.

El reproductor conserva carga local de audio/video, pistas SRT/VTT, controles de
reproducción, volumen del archivo, progreso y modos lector/voz/off. Añade selección
de todas las voces expuestas por el navegador, sin idioma preferido, y velocidad.
Los archivos permanecen en el dispositivo; sus URL de objeto se liberan al
sustituirlos o abandonar la página.

Pantalla completa se solicita sobre el contenedor con video, controles y región
accesible. La recuperación de TTS es la misma de la estable: margen de inicio y
duración, reintento limitado antes de hablar y conservación del modo del usuario.

## Publicación en KathWare

La página publicada usa el snippet WPCode **Accessibility Player, ID 5044**.
La página tiene ID **6806**. La exportación histórica del repositorio privado
`KathWare-WPCode` se conserva sin cambios.

1. Respaldar el código actual del snippet 5044.
2. Sustituirlo por el contenido completo de `web/kathware-player-local.html`.
3. Mantener el mismo ID, estado activo y método de shortcode.
4. Actualizar el consejo de la página 6806 que indica que pantalla completa no
   funciona: explicar el botón de contenedor y el límite del modo nativo.
5. Comprobar la página pública con un archivo local y VTT/SRT: lector, voz,
   idioma elegido, velocidad, pausa y pantalla completa.

**Estado:** fuente y reemplazo preparados. La publicación en WordPress requiere
una sesión de administración; no se da por aplicada hasta verificar el sitio.

## Pruebas

`node --test tests/local-player.cjs` aprueba 9 escenarios de la aplicación
generada con DOM, archivos y síntesis simulados. Incluye aislamiento, habilitación
de controles, SRT, ubicación en pantalla completa, voz/velocidad, recuperación,
cambio de modo y liberación de archivos. Las pruebas del módulo de salida se
ejecutan también como parte de la extensión.

Los resultados de Node no acreditan pronunciación de NVDA ni audio real de las
voces. La prueba con navegador en este entorno está bloqueada por creación de
sockets. El registro de publicación debe añadirse cuando se verifique WordPress.
