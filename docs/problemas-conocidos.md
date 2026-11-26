# Problemas conocidos de 3.0.0

Estado al 26/11/2026. **Flow en vivo continúa pendiente. La lectura en pantalla
completa ya está corregida y comprobada con NVDA** en la beta que estoy usando.
El 20/11 pasé la corrección a estable y ahora volví a comparar ambas ramas.

| Problema | Estado | Próximo trabajo |
| --- | --- | --- |
| Flow en vivo: atraso y fragmentación | Abierto. Se ha reportado un desfase de aproximadamente una frase respecto del audio y cortes en la entrega. La revisión 5 conserva las mejoras actuales, sin dar por resuelto el fallo en el servicio real. | Localizar el desfase y revisar la agrupación con pruebas en Flow, NVDA y voz del navegador. |

## Correcciones ya incorporadas

- **Pantalla completa:** la región de anuncios acompaña al contenedor sin
  reiniciar la captura ni mover el foco. Ya funciona con NVDA y la corrección
  está tanto en beta como en estable. No es un fallo abierto de esta entrega.
- **Recuperación del sintetizador:** integrada en ambas ramas, con espera
  inicial de 10 segundos, vigilancia según texto y velocidad y un reintento
  antes del inicio. Los errores conservan el modo y los ajustes elegidos.
- **Volumen de la voz:** disponible también en beta, independiente del video
  y del lector de pantalla, con guardado del ajuste.

Las pruebas automatizadas verifican regresiones. La confirmación de uso de
pantalla completa proviene de mis pruebas reales con NVDA. El detalle sobre
los distintos elementos que puede poner en pantalla completa una plataforma
queda en las [notas de implementación](fullscreen-lectura.md).

La estable sigue excluyendo la medición temporal de Flow y el reinicio automático
al cambiar de pantalla completa. La corrección promovida ajusta la ubicación de
los anuncios y la recuperación de salida; la captura y la agrupación de Flow
conservan su implementación previa.

La rama beta conserva la sonda de Flow y la búsqueda ampliada de selectores y
reportes para futuras versiones; estas funciones no se promovieron a `main`.
