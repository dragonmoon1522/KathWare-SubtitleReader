# Integración futura con Audiocinemateca

Decisiones de Katherine del 26/10/2026. Estado: planificación; no implementada.
El [plan de versiones del 28/10/2026](plan-de-versiones.md) mantiene esta
integración como trabajo posterior, fuera del lanzamiento de 3.0.0 y de su
distribución equivalente para otros navegadores.

## Alcance y momento

Audiocinemateca queda fuera de 3.0.0. La prioridad es terminar las pruebas de
esa versión y preparar la estable cuando Katherine confirme los resultados.
El lanzamiento previsto para los próximos días depende de esa confirmación;
no se programa una publicación automática.

Las pruebas de integración con Audiocinemateca comenzarán después del
lanzamiento de 3.0.0. La función corresponderá a una versión posterior, todavía
sin número asignado.

## Experiencia prevista

La extensión buscará la obra y la edición compatibles y resolverá la
sincronización con la menor intervención posible de la persona. Se partirá del
idioma ya seleccionado en la plataforma digital, distinguiendo español de
España y español latino cuando la información esté disponible.

El MP3 de Audiocinemateca contiene el audio completo de la obra junto con la
audiodescripción. La integración deberá contemplar ese audio completo al
coordinarlo con el vídeo de la plataforma.

La investigación inicial identificó rutas relativas de audio en el catálogo y
clientes públicos Android y NVDA que usan autenticación HTTP Basic por HTTPS.
La reutilización de la sesión web desde la extensión queda pendiente de una
prueba autenticada; no se da por implementada ni validada.

## Acceso y condiciones obligatorias

- La función será exclusiva para personas registradas en Audiocinemateca,
  con acceso válido a su cuenta comprobado por el servicio.
- La existencia de una cookie o una marca local de sesión no será prueba
  suficiente de autorización vigente.
- Los enlaces del catálogo se usarán con la autenticación de la propia
  persona. La integración no proporcionará acceso anónimo ni utilizará
  cuentas compartidas o intermediarios para eludir ese requisito.
- Se respetarán las condiciones y restricciones de Audiocinemateca, incluida
  la prohibición de obtención masiva de archivos. El uso previsto es acceder al
  contenido que la persona haya elegido reproducir.
- Si se incumplen estas reglas, se deshabilitará o retirará la funcionalidad.
  La manera concreta de aplicar esta medida se definirá antes de distribuirla.

## Decisión pendiente: audiodescripción nativa

Todavía no se ha decidido qué ofrecer cuando la plataforma digital ya incluya
audiodescripción para la obra y el idioma seleccionados. Se evaluará si mostrar
también la opción de Audiocinemateca, priorizar la pista nativa u ofrecer otra
forma de elección. Ninguna de esas alternativas se considera aprobada.

## Referencias de la investigación

- [Catálogo y web de Audiocinemateca](https://audiocinemateca.com/).
- [Reproducción externa y accesibilidad](https://audiocinemateca.com/accesibilidad).
- [Cliente Android de Johan G. y César Verástegui](https://github.com/JohanAnim/Audiocinemateca).
- [Complemento de Audiocinemateca para NVDA](https://github.com/nvda-es/Audiocinemateca-para-nvda).

Estos hallazgos documentan posibilidades técnicas; la implementación y sus
pruebas se harán en el desarrollo posterior a 3.0.0.
