# Problemas conocidos de 3.0.0

Estado al 20/11/2026. Katherine confirma que el error reportado no reapareció
después de recargar y aprueba pasar a estable las correcciones de pantalla
completa y sintetizador. Flow en vivo continúa pendiente.

| Problema | Estado | Próximo trabajo |
| --- | --- | --- |
| Flow en vivo: atraso y fragmentación | Abierto. Se ha reportado un desfase de aproximadamente una frase respecto del audio y cortes en la entrega. La revisión 5 conserva las mejoras actuales, sin dar por resuelto el fallo en el servicio real. | Localizar el desfase y revisar la agrupación con pruebas en Flow, NVDA y voz del navegador. |
| Anuncios en pantalla completa de contenedor | Corrección aprobada para la estable: la región de anuncios acompaña al contenedor sin reiniciar la captura ni mover el foco. | Mantener validación de cada navegador y plataforma. |
| Pantalla completa nativa de `video` | Limitación abierta: el contenido alternativo de un video no es una superficie fiable para los anuncios del lector. | Usar el botón de KathWare para entrar con el contenedor cuando esté disponible. |
| Recuperación del sintetizador | Integrada en estable: espera inicial de 10 segundos, vigilancia según texto y velocidad y un reintento antes del inicio. Los errores conservan el modo y los ajustes del usuario. | Comprobar voces concretas y registrar errores nuevos. |

Las pruebas automatizadas de regresión permiten conservar comportamientos ya
comprobados. No cierran estos fallos, que necesitan validación con los servicios
y lectores de pantalla reales.

La estable sigue excluyendo la medición temporal de Flow y el reinicio automático
al cambiar de pantalla completa. La corrección promovida ajusta la ubicación de
los anuncios y la recuperación de salida; la captura y la agrupación de Flow
conservan su implementación previa.
