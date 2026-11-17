# Plan de salida y trabajo posterior de KathWare SubtitleReader

Actualizado con la decisión de Katherine del **17/11/2026**: publicar 3.0.0
como estable con la funcionalidad actual.

## Primera etapa: actualización de Chrome

`main` contiene 3.0.0 estable. La rama `3.0.0-beta` continúa disponible para
el desarrollo futuro y conserva las herramientas de prueba retiradas de la
distribución estable.

Los fallos de **Flow en vivo** y de **lectura en pantalla completa** permanecen
abiertos para una próxima versión. Se detallan en
[problemas conocidos](problemas-conocidos.md).

La arquitectura actual por plataformas y adaptadores se mantiene durante esta
entrega. Las ideas y funciones nuevas se anotan para las versiones siguientes.

## Segunda etapa: la misma versión para otros navegadores

Después de aproximadamente dos semanas de uso estable desde la publicación
en Chrome, se distribuirá esa misma versión funcional para otros navegadores.
Se conserva el alcance de la versión estabilizada; los cambios necesarios para
cada navegador se limitan a compatibilidad, correcciones y empaquetado.

Las dos semanas son una referencia, no una fecha automática de publicación.
Si aparecen regresiones, se corrigen y se evalúa la estabilidad antes de
ampliar la distribución. La validación específica de cada navegador se realiza
antes de anunciar su compatibilidad.

Los paquetes Chromium ya preparados permiten avanzar con Edge, Brave, Opera y
Vivaldi. Firefox requiere su adaptación y pruebas propias y conserva su estado
pendiente, sin una fecha específica comprometida.

Las instrucciones técnicas están en [paquetes y navegadores](navegadores.md).

## Versiones posteriores

Estos trabajos quedan fuera del alcance de 3.0.0 y de su distribución equivalente
para otros navegadores:

- **Flow en vivo:** corregir el atraso y la fragmentación reportados.
- **Lectura en pantalla completa:** recuperar la lectura de subtítulos al
  usar ese modo. Estos dos fallos se investigarán en la rama beta.
- **Reorganización y depuración de plataformas:** pasar de la separación actual
  por plataforma a una organización por tipo de renderizado y selector.
- **Integración con Audiocinemateca:** identificar la obra y la edición,
  autenticar el acceso y sincronizar el audio completo con el vídeo. Se mantienen
  las reglas de acceso exclusivo para personas registradas con cuenta válida,
  respeto de las restricciones del servicio y retirada de la funcionalidad ante
  incumplimientos. Ver [el plan específico](audiocinemateca-plan.md).
- **Versión de la aplicación en inglés.**
- **Detección automática de idiomas.** La preferencia de voces en español que
  ya existe no se considera la nueva detección automática de idiomas.
- **Otras ideas y pendientes ya anotados o que surjan:** se conservan para
  evaluación y priorización posterior, sin incorporarlos por defecto a esta
  salida.

Todavía no se asignan números, fechas ni orden de implementación a esas futuras
versiones. En Audiocinemateca sigue pendiente decidir qué ofrecer si la
plataforma digital ya dispone de audiodescripción propia.
