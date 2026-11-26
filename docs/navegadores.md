# Paquetes y navegadores — 3.0.0-beta

**Estado al 20/11/2026:** `main` contiene 3.0.0 estable. Esta rama mantiene el
desarrollo y las herramientas de prueba para las próximas versiones. Para
generar la distribución estable, usar `main`; los comandos de esta rama
generan paquetes con la etiqueta beta.


La extensión se mantiene en `Extension/`, con una única base de HTML, CSS y
JavaScript. Se preparan paquetes diferentes a partir de esa misma fuente. No
hace falta mantener una rama de código por cada navegador basado en Chromium.

## Orden de publicación actualizado el 25/11/2026

1. Subir primero 3.0.0 estable a Chrome Web Store.
2. Si Google aprueba el paquete, presentar ese mismo ZIP en Edge Add-ons.
   La revisión de Microsoft y la prueba de sus voces se realizan por separado.
3. Evaluar otros Chromium después de la estabilización y sus pruebas.
4. Mantener Firefox para una adaptación posterior.

Este plan reemplaza la espera orientativa de dos semanas para Edge. La salida
de voz usa las voces que cada navegador exponga; Elena de Argentina es una
opción solo cuando figure en la lista de Edge.

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

## Generar la estable con las herramientas de esta rama

Mantengo el empaquetador en desarrollo. Para usarlo con el código de `main`,
preparo un checkout aparte e indico su carpeta `Extension`:

```sh
git fetch origin
git worktree add --detach ../subtitlereader-estable origin/main
python3 scripts/package_extension.py --target chrome --source-dir ../subtitlereader-estable/Extension
```

El manifest se lee del origen elegido. Si el origen es una beta, el ZIP sigue
siendo beta. El paquete no incorpora scripts, pruebas ni documentación del
repositorio. La licencia se toma del mismo checkout que la extensión.

## Destinos

| Destino | Paquete | Estado |
| --- | --- | --- |
| Chrome | `chrome` | Primera distribución desde `main`; esta rama genera el paquete de desarrollo beta. |
| Edge | El mismo ZIP estable de Chrome | Se presentará después de la aprobación de Google; mantiene su revisión y pruebas propias. |
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

### Verificación y pruebas actuales (07/11/2026)

- Pasan 62 pruebas de lectura incremental: 36 de la suite de Flow, 12 de
  agrupación de frases y 14 específicas de YouTube. Cubren las secuencias
  recibidas, puntuación, letras en formación, plazos, palabras repetidas y
  recuperación de nodos. Los intervalos entre mutaciones son simulados.
  Probé YouTube revisión 1 el 31/10/2026 y funciona bien. En Flow noté una
  frase de atraso respecto del audio y entregas fragmentadas. La revisión 5
  corrige la agrupación; sigue pendiente medir y localizar el desfase.
- Se pueden ejecutar juntas con:

  ```sh
  node --test tests/flow-incremental.cjs tests/flow-phrases.cjs tests/youtube-incremental.cjs
  ```
- Para el atraso reportado tanto con NVDA como con el sintetizador se usa la
  [medición de Flow con dos marcas](flow-timing.md), revisión 3. Marcá el
  audio con Alt+Shift+M y el subtítulo correspondiente con Alt+Shift+N, con
  la reproducción en marcha. La comparación con la transmisión sigue pendiente.
- Con el foco dentro del reproductor, probar Tab, Shift+Tab y flechas cuando
  la barra normalmente se oculta. El foco debe seguir el orden del sitio y la
  barra alternativa no debe desaparecer mientras esté enfocada. Falta
  confirmar la navegación con NVDA en los reproductores reales.
- Para probar el nuevo ZIP de Chrome, descomprimirlo en la carpeta usada para
  cargar la beta, reemplazar sus archivos y recargar la extensión desde su
  administrador. Después recargar la pestaña de Flow o YouTube para sustituir
  también los scripts que ya estaban ejecutándose.
- El botón **Diagnóstico** debe informar `flowReaderRevision: 5` y
  `youtubeReaderRevision: 1`. Con debug activo, los registros `CONSOLE RENDERER`
  de cada plataforma llevan su revisión correspondiente y son JSON copiables.
  Ese nombre histórico no significa que se esté ejecutando la consola
  experimental de `web/`; el ZIP utiliza el adaptador de la extensión.
- Flow confirma los vacíos del subtítulo durante 250 ms. La revisión 4 conserva
  brevemente lo entregado para reconocer una cola larga de la línea anterior
  que reaparece acortada. El debug registra `gap` y `reset` para distinguir
  desapariciones, recuperaciones de línea y reinicios del lector.
- Flow revisión 5 entrega hasta el final de frase o cambio de hablante, con
  80 ms de agrupación y un tope de 250 ms para ese final. Para texto sin
  puntuación espera 1200 ms de estabilidad; con escritura continua limita
  la espera a 2500 ms y conserva la palabra final. Una letra suelta no sale
  por el temporizador de estabilidad. No se cambia el diagnóstico revisión 3.
- YouTube entrega frases terminadas con la puntuación disponible y agrega un
  plazo de 850 ms que no se reinicia al llegar más palabras. La última palabra
  visible puede esperar a la pausa para evitar cortarla. Conserva también las
  repeticiones entre segmentos distintos del subtítulo.
- El modo debug registra cada cambio del subtítulo, por lo que puede producir
  muchos mensajes. Se puede desactivar con Alt+Shift+D al terminar la prueba.

El registro inicial de Flow recibido el 31/10 contiene 12 entregas de una o dos palabras, con
`pendingMs` entre 355 y 983 ms. Este valor mide la espera registrada por el
adaptador para ese grupo; no mide el desfase con el audio ni el instante en que
NVDA pronuncia el texto. Los valores no deben sumarse para inferir un atraso
total. Sigue pendiente distinguir la llegada del subtítulo de su anuncio por
el lector de pantalla; el registro no confirma cuál de esos tramos aporta los
diez segundos reportados.

### Verificación de esta preparación (26/10/2026)

- Las 13 pruebas de `tests/flow-incremental.cjs` pasaron.
- Se comprobó la sintaxis de los 21 archivos JavaScript de la extensión y de
  la consola experimental conservada.
- Se generaron y verificaron ambos ZIP, con los recursos del manifest presentes.
- Las pruebas de navegador de ViX y del reproductor no se pudieron ejecutar en
  este entorno por falta de un navegador instalado; su descarga tampoco estuvo
  disponible. No sustituyen la validación manual pendiente con NVDA/TTS.

### Estable 3.0.0 confirmada

Dejé la estable el 17/11/2026 con el estado funcional de ese momento.
`main` identifica `version_name: "3.0.0"` y excluye la medición temporal de Flow
y el reinicio automático al cambiar de pantalla completa.

La rama `3.0.0-beta` continúa el desarrollo y conserva la medición de Flow.
La corrección posterior de [región de anuncios](fullscreen-lectura.md) reemplaza
el reinicio automático de pantalla completa. El 20/11/2026 la pasé a la
estable junto con la recuperación del sintetizador.
La voz elegida tiene prioridad; la opción automática respeta la predeterminada
del navegador sin priorizar idioma. Flow en vivo y el modo nativo de video
conservan los [límites documentados](problemas-conocidos.md). Los registros y
pruebas anteriores de este documento corresponden a la preparación de la beta.

La primera distribución corresponde a Chrome. Los otros navegadores seguirán
el orden acordado en el [plan de versiones](plan-de-versiones.md).

## Comprobaciones de salida

El 25/11/2026 añadí pruebas del volumen independiente y del formulario de reporte
de la estable. El volumen no modifica el del video ni la región del modo lector.
Para el popup estable, ejecutá desde esta rama:

```sh
KWSR_STABLE_ROOT=../subtitlereader-estable node --test tests/stable/popup.cjs
```

Las pruebas siguen fuera de `main`. La guía de usuario final está en su README.
