# Paquetes y navegadores — 3.0.0

`main` contiene 3.0.0 estable, aprobada por Katherine el 17/11/2026.
`3.0.0-beta` continúa como rama de desarrollo. El 20/11/2026 se incorporan las
correcciones aprobadas de pantalla completa de contenedor y sintetizador,
con selección de voz sin preferencia de idioma. Flow en vivo y el modo nativo
del elemento de video conservan los [límites documentados](problemas-conocidos.md).

## Orden de distribución

1. Actualizar primero la extensión de Chrome.
2. Tras aproximadamente dos semanas de uso estable desde esa publicación,
   evaluar la misma versión para otros navegadores Chromium.
3. Adaptar y probar Firefox en una etapa posterior.

El plazo es orientativo. La publicación en Chrome Web Store y la validación
en cada navegador son pasos separados de la preparación del código en GitHub.

## Generar el paquete de Chrome

Desde `main`:

```sh
python3 scripts/package_extension.py --target chrome
```

Se genera `dist/kathware-subtitlereader-3.0.0-chrome.zip`, con el manifest
en la raíz. El script comprueba los recursos y verifica el ZIP. El resultado
incluye la licencia y conserva la versión del manifest, sin modificarla.

Para preparar también la base de otros Chromium:

```sh
python3 scripts/package_extension.py --target chromium
```

El segundo paquete es `dist/kathware-subtitlereader-3.0.0-chromium.zip`.
Elimina la identidad y URL de actualización específicas de una tienda si están
presentes. Generarlo no implica publicar ni verificar compatibilidad en esas
tiendas o navegadores.

| Navegador | Destino del empaquetador | Estado |
| --- | --- | --- |
| Chrome | `chrome` | Primera distribución; código estable 3.0.0 preparado en `main`. |
| Edge | `chromium` | Segunda etapa; prueba específica y envío a Edge Add-ons pendientes. |
| Brave y Vivaldi | `chromium` | Segunda etapa; pruebas específicas pendientes. |
| Opera | `chromium` | Segunda etapa; pruebas y evaluación de su tienda pendientes. |
| Firefox | Sin paquete en esta entrega | Adaptación y validación aplazadas. |

## Verificar el código y cargar la extensión

Pruebas de lectura incremental:

```sh
node --test tests/flow-incremental.cjs tests/flow-phrases.cjs tests/youtube-incremental.cjs
```

Pruebas de preparación estable con DOM simulado:

```sh
node --test tests/release.cjs
```

Pruebas de interfaz, con Playwright y Chrome:

```sh
node --test tests/player-accessibility.cjs tests/vix-captions.cjs
```

Para cargar el paquete localmente, descomprimirlo, abrir la administración de
extensiones, activar el modo de desarrollador y elegir **Cargar sin comprimir**.
Seleccionar la carpeta con `manifest.json`. Al actualizar, recargar la
extensión y las pestañas donde estuviera funcionando.

El diagnóstico general y el popup deben informar **3.0.0**. Se conservan los
atajos Alt+Shift+K/L/O/D/R. Las herramientas de medición de Flow y el reinicio
automático al cambiar de pantalla completa no forman parte de la estable.

La prueba de controles en pantalla completa verifica la interfaz del panel;
no acredita la lectura de subtítulos en ese modo. Tampoco los ensayos con
reloj simulado acreditan la sincronización de Flow en vivo.

## Firefox

La adaptación permanece pendiente. Se mantiene Manifest V3 y el código usa
`browser` o `chrome` cuando están disponibles, pero hace falta revisar
manifest, segundo plano, permisos, voces y funcionamiento con lectores de
pantalla antes de anunciar un paquete compatible.

La consola independiente de `web/` no se carga en la extensión ni se incluye
en los paquetes.

Verificación del 17/11/2026: las pruebas de lectura y preparación estable
pasan. La ejecución de las pruebas de interfaz quedó bloqueada por la
restricción de sockets del entorno de Chromium; no se presenta como aprobada.
