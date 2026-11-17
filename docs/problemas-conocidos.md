# Problemas conocidos de 3.0.0

Estado al 17/11/2026. Katherine aprueba publicar 3.0.0 con estos fallos
abiertos y continuar su corrección en la rama `3.0.0-beta`.

| Problema | Estado | Próximo trabajo |
| --- | --- | --- |
| Flow en vivo: atraso y fragmentación | Abierto. Se ha reportado un desfase de aproximadamente una frase respecto del audio y cortes en la entrega. La revisión 5 conserva las mejoras actuales, sin dar por resuelto el fallo en el servicio real. | Localizar el desfase y revisar la agrupación con pruebas en Flow, NVDA y voz del navegador. |
| Subtítulos en pantalla completa | Abierto. Los subtítulos no se leen en ese modo. Para mantener la lectura, usar la vista normal. | Revisar la detección del texto y la salida accesible al entrar, salir o cambiar el contenedor de pantalla completa. |

Las pruebas automatizadas de regresión permiten conservar comportamientos ya
comprobados. No cierran estos fallos, que necesitan validación con los servicios
y lectores de pantalla reales.

La medición temporal de Flow y el reinicio automático al cambiar de pantalla
completa se retiran de la estable. El código de esos ensayos permanece en la
rama beta para retomarlo en una versión posterior.
