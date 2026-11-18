# Problemas conocidos de 3.0.0

Estado al 17/11/2026. Katherine aprueba publicar 3.0.0 con estos fallos
abiertos y continuar su corrección en la rama `3.0.0-beta`.

| Problema | Estado | Próximo trabajo |
| --- | --- | --- |
| Flow en vivo: atraso y fragmentación | Abierto. Se ha reportado un desfase de aproximadamente una frase respecto del audio y cortes en la entrega. La revisión 5 conserva las mejoras actuales, sin dar por resuelto el fallo en el servicio real. | Localizar el desfase y revisar la agrupación con pruebas en Flow, NVDA y voz del navegador. |
| Subtítulos con lector de pantalla en pantalla completa | Abierto. NVDA puede consultar texto enfocado con NVDA+Tab, pero no anuncia los subtítulos automáticamente. Para mantener la lectura con NVDA en la estable, usar la vista normal. | Ensayo de región de anuncios, revisión 1, disponible solo en beta; pendiente validación real con NVDA. Ver [prueba y límites](fullscreen-lectura.md). |
| Modo voz: cambio automático a lector ante fallos | Reportado el 17/11/2026. La voz sí lee en pantalla completa, pero la recuperación anterior podía abandonar el modo voz por una cancelación normal o una frase larga. | Recuperación de TTS, revisión 1, integrada en beta con pruebas de lógica. Pendiente validación con voces reales. Ver [comportamiento y pruebas](tts-recuperacion.md). |

Las pruebas automatizadas de regresión permiten conservar comportamientos ya
comprobados. No cierran estos fallos, que necesitan validación con los servicios
y lectores de pantalla reales.

La medición temporal de Flow y el reinicio automático al cambiar de pantalla
completa se retiran de la estable. La beta conserva la medición de Flow; su
reinicio automático se reemplaza por el ensayo de región de anuncios del
17/11/2026. Esta modificación no cambia el alcance de la estable.
