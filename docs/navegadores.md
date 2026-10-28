# Paquetes y navegadores — 3.0.0-beta

La extensión se mantiene en `Extension/`, con una única base de HTML, CSS y
JavaScript. Se preparan paquetes diferentes a partir de esa misma fuente. No
hace falta mantener una rama de código por cada navegador basado en Chromium.

## Orden de publicación acordado el 28/10/2026

1. Publicar primero 3.0.0 como actualización de la extensión de Chrome, una vez
   cerradas las pruebas y recibida la confirmación de Katherine.
2. Observar su funcionamiento durante aproximadamente dos semanas desde esa
   publicación. El plazo es orientativo y depende de la estabilidad real.
3. Distribuir la misma versión funcional estabilizada para otros navegadores,
   después de sus pruebas y adaptaciones de empaquetado.

Los paquetes preparados para otros Chromium sirven para esa segunda etapa.
Su generación local no adelanta su publicación ni los convierte en un requisito
para cerrar la salida inicial de Chrome. Firefox sigue pendiente de adaptación
y pruebas, sin fecha específica comprometida.

Ver el [plan de salida y trabajo posterior](plan-de-versiones.md).

## Generar los paquetes

Requiere Python 3.9 o posterior, sin instalar bibliotecas adicionales:

```sh
python3 scripts/package_extension.py
```

El comando genera en `dist/`:

- `kathware-subtitlereader-3.0.0-beta-chrome.zip`
- `kathware-subtitlereader-3.0.0-beta-chromium.zip`

Para generar uno solo, usar `--target chrome` o `--target chromium`. El
`manifest.json` queda en la raíz de cada ZIP, junto con los archivos de la
extensión y su licencia. No se incluyen pruebas, archivos de desarrollo ni las
consolas experimentales de `web/`. El script comprueba los recursos del manifest,
verifica el ZIP e informa su SHA-256. No sube paquetes ni cambia la versión.

## Destinos

| Destino | Paquete | Estado |
| --- | --- | --- |
| Chrome | `chrome` | Primera publicación; beta pendiente de las últimas pruebas y confirmación. |
| Edge | `chromium` | Segunda etapa, después de estabilizar Chrome; falta prueba específica y envío a Edge Add-ons. |
| Brave y Vivaldi | `chromium` | Segunda etapa, después de estabilizar Chrome; falta prueba específica. |
| Opera | `chromium` | Segunda etapa, después de estabilizar Chrome; falta prueba específica y evaluación para su tienda. |
| Firefox | Sin paquete en esta entrega | Adaptación y pruebas aplazadas. |

Ambos paquetes usan Manifest V3. El destino `chromium` elimina `update_url` y
`key` si alguna vez se agregan al manifest de origen: las identidades y las
actualizaciones de cada tienda se administran por separado. Hoy el manifest no
contiene esas claves, por lo que los paquetes comparten contenido funcional.
El mínimo declarado se conserva en Chromium 114; esto no equivale a haber
verificado cada versión histórica de cada navegador.

## Probar un paquete Chromium

1. Descomprimir el ZIP en una carpeta.
2. Abrir la administración de extensiones del navegador: `chrome://extensions/`,
   `edge://extensions/`, `brave://extensions/`, `vivaldi://extensions/` u
   `opera://extensions/`, según corresponda.
3. Activar el modo de desarrollador y elegir **Cargar sin comprimir**.
4. Seleccionar la carpeta que contiene `manifest.json`. Si se usa directamente
   el repositorio, seleccionar `Extension/`.
5. Abrir de nuevo o recargar la página de video. Probar activación, panel,
   Alt+Shift+K/L/O/D/R, persistencia de ajustes, lector, voces y pantalla completa.

Las preferencias y voces disponibles dependen del perfil, navegador y sistema.
La carga manual puede producir una identidad distinta de la edición instalada
desde una tienda; no se promete migración automática de preferencias.

## Firefox: evaluación inicial

La revisión inicial no encontró una necesidad de reescribir el lector. Se usan
APIs comunes (`storage`, `tabs`, `runtime` y `commands`) y Firefox admite las
llamadas `chrome.*` con callbacks utilizadas aquí. El bootstrap y el popup ya
contemplan los espacios de nombres `chrome` y `browser`.

La diferencia concreta del manifest actual está en el segundo plano: Chromium
usa `background.service_worker`, mientras que Firefox necesita
`background.scripts` para este código. También hay que definir la identidad del
complemento y los metadatos de distribución de Mozilla.

La adaptación inicial parece acotada, pero su cierre requiere cargar la
extensión en Firefox real, verificar los permisos de acceso a sitios y comprobar
lectura con NVDA, voces, mensajes, atajos y pantalla completa. Esta entrega no
genera ni anuncia un paquete Firefox; queda para una tarea posterior y no
condiciona el cierre de 3.0.0.

Documentación consultada el 26/10/2026:

- [Portar una extensión a Microsoft Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension).
- [Extensiones para varios navegadores, Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Build_a_cross_browser_extension).
- [Segundo plano en el manifest, Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background).

## Paso a estable

### Verificación de esta preparación (26/10/2026)

- Las 13 pruebas de `tests/flow-incremental.cjs` pasaron.
- Se comprobó la sintaxis de los 21 archivos JavaScript de la extensión y de
  la consola experimental conservada.
- Se generaron y verificaron ambos ZIP, con los recursos del manifest presentes.
- Las pruebas de navegador de ViX y del reproductor no se pudieron ejecutar en
  este entorno por falta de un navegador instalado; su descarga tampoco estuvo
  disponible. No sustituyen la validación manual pendiente con NVDA/TTS.

### Confirmación de la estable

La rama de trabajo es `3.0.0-beta`; la línea `2.2.0-beta` se conserva como
antecedente. La extensión mantiene `version: "3.0.0"` y
`version_name: "3.0.0-beta"`. Sus diagnósticos y reportes usan esa misma etiqueta.

El paso a estable y la publicación en tiendas requieren la confirmación expresa
de Katherine después de las pruebas. Antes de esa confirmación no se elimina la
etiqueta beta, no se crea una entrega estable y no se actualiza `main`.
La primera publicación será en Chrome; las siguientes seguirán el orden
acordado en el plan de versiones.

El refactor por tipos de renderizado queda para una versión posterior. La
consola histórica en `web/kathware-player-console.js` conserva sus experimentos;
no se carga en la extensión ni se incluye en los paquetes.
