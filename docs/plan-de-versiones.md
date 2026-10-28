# Plan de salida y trabajo posterior de KathWare SubtitleReader

Acuerdo de Katherine del 28/10/2026. La versión de trabajo sigue siendo
3.0.0-beta hasta que se confirme su paso a estable.

## Primera etapa: actualización de Chrome

La salida inicial de 3.0.0 será la actualización de la extensión de Chrome.
Se cierran las pruebas de compatibilidad, lectura y accesibilidad de la versión
actual, con sus correcciones, selector de voces, velocidad y diagnóstico ya
integrados. El paso a estable y la publicación esperan la confirmación expresa
de Katherine.

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
