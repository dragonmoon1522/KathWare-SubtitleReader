# Historial de KathWare SubtitleReader

**Autora:** Katherine Vargas

## 3.0.0 estable — 17/11/2026, actualizada el 26/11/2026

Dejé la estable en `main` y mantengo `3.0.0-beta` para continuar el desarrollo.
En esta entrega incorporé:

- Correcciones para Disney+ / Hive y mejoras de compatibilidad con YouTube,
  Paramount+ y ViX.
- Lectura incremental y ajustes para evitar repeticiones.
- Selector de voz, velocidad y volumen. La elección automática sigue la predeterminada
  del navegador, sin preferencia de idioma.
- Mejoras de accesibilidad de los controles y de su uso con el teclado.
- Lectura en pantalla completa del contenedor, con la región de anuncios en
  el mismo espacio.
- Recuperación del sintetizador: más margen para iniciar y terminar una frase,
  un reintento cuando corresponde y conservación del modo elegido ante errores.
- Diagnóstico, debug y reinicio manual con Alt+Shift+D/R.

El 20/11 pasé a estable las correcciones de pantalla completa y sintetizador
tras las últimas pruebas. Las herramientas experimentales de Flow y los
selectores ampliados de la beta no forman parte de esta entrega.

**Queda pendiente:** atraso y fragmentación de Flow en vivo.

## 26/11/2026 — toques finales de controles y continuidad de voz

- Mantuve visibles los controles al recorrerlos con Tab, Shift+Tab y flechas,
  también mientras uso el panel y los controles de SubtitleReader. Conservo
  el tipo de caja de la barra para sostener su visibilidad y restauro el estilo
  anterior al salir. Los menús cerrados mantienen su estado.
- Evité que reaparezca la barra alternativa solo porque el sitio oculte por
  inactividad controles que ya comprobé utilizables. La decisión contempla los
  nombres y el teclado, incluidos los que agregan los adaptadores de ViX y Flow.
  Los controles quitados, deshabilitados o de otro video vuelven a evaluarse.
- Hice que la voz termine cada subtítulo y continúe con los siguientes en orden.
  Lector y voz comparten el procesamiento y el filtro de repeticiones. Los
  ajustes elegidos se aplican al comenzar cada frase o reintento.
- Conservé la recuperación del sintetizador. Un fallo definitivo permite
  continuar con la frase siguiente sin repetir las palabras ya escuchadas.
  Pausar, buscar otra posición, cambiar de video o de modo, apagar o reiniciar
  limpia lo pendiente. No restablecí ninguna preferencia guardada.
- Apliqué estos cambios en `main` y beta, con comentarios sencillos en el código.

Validación: **146 pruebas Node de la estable y 197 de beta aprobadas**, más
sintaxis JavaScript y comprobación de recursos y empaquetado. Las nuevas pruebas
cubren continuidad de voz, igualdad del texto entre modos, foco, visibilidad y
decisión de mostrar el respaldo. Son escenarios con DOM y síntesis simulados.
Chrome automatizado se cerró antes de arrancar aquí; no atribuyo a esas pruebas
una comprobación visual o auditiva real de estos últimos cambios con NVDA.

Preparé un ZIP estable nuevo para Chrome y Edge y actualicé el paquete beta.
Conservo la versión **3.0.0** de esta entrega todavía sin presentar a las tiendas.

SHA-256 del ZIP estable de estos toques finales:
`0693c6778c2bd86e6d19affa284837091fb44e971affa20dc880e4d76f11ba8a`.

## 26/11/2026 — pantalla completa confirmada y revisión de ambas ramas

La lectura en pantalla completa ya funciona en la beta que estoy probando.
Comparé esa corrección con `main`: la ubicación de la región de anuncios,
la entrada y salida de pantalla completa y el botón del reproductor coinciden.
No faltaba promover código; corregí las notas que la seguían presentando como
pendiente. La distinción técnica del modo nativo de video se conserva en las
notas de implementación, separada del estado de la corrección probada.

También comprobé que beta y estable incluyen el mismo control de volumen del
sintetizador, con persistencia y aplicación a las siguientes frases y reintentos.
Volví a ejecutar las 15 pruebas de pantalla completa y las 7 de volumen en
cada rama: **22 aprobadas en estable y 22 en beta**. La comprobación auditiva
de pantalla completa es la de mis pruebas con NVDA; Node verifica las
regresiones de estructura y eventos.

Esta revisión modifica documentación. El código y el ZIP estable conservan
su contenido y su SHA-256. Preparé además un ZIP beta actualizado para probar.

## 25/11/2026 — revisión final para Chrome y Edge

Revisé la estable contra las correcciones que probamos e incorporé lo que
faltaba antes de generar el ZIP final:

- Agregué **Volumen del sintetizador**, separado del audio del video: 0–100%,
  persistencia del ajuste y aplicación a las siguientes frases y reintentos.
- Mantuve la selección de cualquier voz expuesta por el navegador y la elección
  automática sin idioma preferido. El selector de velocidad incluye 0,8x–3x.
- Corregí la explicación del reporte: abre un borrador de issue para revisión;
  la casilla no garantiza registros sin datos del contenido. Los adjuntos se
  limitan a registros guardados de la pestaña y página actuales. La URL de
  referencia omite credenciales, parámetros y fragmento.
- Documenté los comandos de NVDA para sintetizador, voz, velocidad, volumen,
  tono y perfiles. Cualquier sintetizador compatible con el lector puede usarse.
  Las opciones del modo voz no cambian la configuración del modo lector.
- Dejé las recomendaciones de RHVoice y Phonon para NVDA, especialmente para
  subtítulos y lectura prolongada, junto con sus fuentes y requisitos.
- Actualicé la distribución: **Chrome primero y, si Google aprueba el paquete,
  el mismo ZIP para Edge**. Reemplaza la espera orientativa de dos semanas para
  Edge. Sus voces serán las que exponga ese navegador, incluidas las de Microsoft
  cuando estén disponibles; Elena es un ejemplo condicionado a esa lista.

Validación: **121 pruebas Node de la estable** aprobadas: 111 regresiones,
7 escenarios de volumen y 3 de reportes. También revisé sintaxis JavaScript,
recursos del manifest e integridad del paquete. Los eventos de voz y el DOM de
estas pruebas son simulados; el navegador automatizado no pudo iniciar en este
entorno. No equivalen a escuchar una voz real, a probar Edge con NVDA o a obtener
la aprobación de las tiendas.

Conservo `version` y `version_name` en **3.0.0** porque estoy preparando esta
misma entrega antes de subirla. El ZIP contiene únicamente los archivos de la
extensión y la licencia. Las pruebas y herramientas permanecen en desarrollo.
La rama `2.2.0-beta` no tiene commits exclusivos; su retirada sigue pendiente.

SHA-256 del ZIP preparado el 25/11, sustituido por el de los toques finales:
`4c8f2289348dc49f4fb57f1849e1cf7ff1c8ba4404496f561d10de4cfe69a29e`.

## 25/11/2026 — limpieza de la rama estable

Dejé en `main` la extensión y su documentación básica. Las pruebas, los scripts,
los ensayos y los proyectos de reproductor se mantienen en desarrollo y en el
historial de Git. En esa limpieza no modifiqué el código de `Extension/` ni su versión.

Las notas detalladas de desarrollo siguen en
[el historial de la beta](https://github.com/dragonmoon1522/KathWare-SubtitleReader/blob/3.0.0-beta/version.md).
Preparar el código o el ZIP no implica publicar la actualización en la tienda.

## 2.0.0 estable — 07/04/2026

Reorganicé el núcleo por responsabilidades, incorporé selección automática entre
pistas y subtítulos visuales, controles accesibles, diagnóstico y salida mediante
lector de pantalla o sintetizador. Dejé atrás los selectores manuales que no
ayudaban al uso cotidiano.

## 2.0.0 beta — 09/11/2025

Unifiqué las ramas anteriores e incorporé detección de reproductores HTML5,
selección de fuente y pista, lectura por lector o sintetizador y sincronización
de ajustes en el navegador.

## 1.0.0 beta — 08/07/2025

Primera lectura funcional de pistas y subtítulos visuales, controles por teclado,
panel flotante, diagnóstico voluntario y Licencia de Accesibilidad Universal.

Los detalles históricos de cada cambio se conservan en Git.
