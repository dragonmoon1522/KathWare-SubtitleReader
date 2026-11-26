# Plan de salida y trabajo posterior de KathWare SubtitleReader

Actualizado el **20/11/2026**: mantener 3.0.0 estable e incorporar las
correcciones aprobadas de pantalla completa y sintetizador, con elección de voz
sin preferencia impuesta de idioma.

## Primera etapa: actualización de Chrome

`main` contiene 3.0.0 estable. La rama `3.0.0-beta` continúa disponible para
el desarrollo futuro y conserva las herramientas de prueba retiradas de la
distribución estable.

El fallo de **Flow en vivo** y la limitación de la pantalla completa nativa
del elemento de video permanecen abiertos. La corrección para pantalla completa
de contenedor ya está integrada. Se detallan en
[problemas conocidos](problemas-conocidos.md).

La arquitectura actual por plataformas y adaptadores se mantiene durante esta
entrega. Las ideas y funciones nuevas se anotan para las versiones siguientes.

## Edge después de la revisión de Chrome

El 25/11/2026 actualicé el plan: voy a subir primero la estable 3.0.0 a Chrome
Web Store y, si Google aprueba el paquete, voy a presentar ese mismo ZIP en
Microsoft Edge Add-ons. La espera orientativa de dos semanas ya no es un
requisito para Edge. Microsoft mantiene su propia revisión y las pruebas de
Edge siguen siendo necesarias antes de anunciarlo como verificado.

En modo voz, la lista incluye lo que exponga el navegador. En Edge podrán
elegirse voces de Microsoft, como Elena de Argentina, cuando estén disponibles.
No se añade un catálogo fijo ni se impone idioma. Las preferencias pertenecen
a cada navegador y perfil.

Brave, Opera y Vivaldi conservan su etapa posterior de pruebas y distribución.
Firefox sigue pendiente de adaptación. Las instrucciones de empaquetado están
en [paquetes y navegadores](navegadores.md).

## Versiones posteriores

Estos trabajos quedan fuera del alcance de 3.0.0 y de su distribución equivalente
para otros navegadores:

- **Flow en vivo:** corregir el atraso y la fragmentación reportados.
- **Pantalla completa nativa del video:** investigar el caso que queda fuera del
  contenedor usado por KathWare; la corrección de contenedor ya está en estable.
- **Reorganización y depuración de plataformas:** pasar de la separación actual
  por plataforma a una organización por tipo de renderizado y selector.
- **Integración con Audiocinemateca:** identificar la obra y la edición,
  autenticar el acceso y sincronizar el audio completo con el vídeo. Se mantienen
  las reglas de acceso exclusivo para personas registradas con cuenta válida,
  respeto de las restricciones del servicio y retirada de la funcionalidad ante
  incumplimientos. Ver [el plan específico](audiocinemateca-plan.md).
- **Versión de la aplicación en inglés.**
- **Detección automática de idiomas.** Por ahora se respeta la voz elegida por
  el usuario o la predeterminada del navegador, sin priorizar español.
- **Otras ideas y pendientes ya anotados o que surjan:** se conservan para
  evaluación y priorización posterior, sin incorporarlos por defecto a esta
  salida.

Todavía no se asignan números, fechas ni orden de implementación a esas futuras
versiones. En Audiocinemateca sigue pendiente decidir qué ofrecer si la
plataforma digital ya dispone de audiodescripción propia.
