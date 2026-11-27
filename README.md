# KathWare SubtitleReader

**Autora:** Katherine Vargas · [KathWare](https://kathware.com.ar)
**Versión estable preparada:** 3.0.0 · **Revisión:** 26/11/2026

Desarrollé SubtitleReader para escuchar los subtítulos de las plataformas de
video con un lector de pantalla o con las voces del navegador. También agregué
controles accesibles para los reproductores que todavía los necesitan.

## Qué incluye la 3.0.0

- Correcciones para Disney+ / Hive y mejoras de compatibilidad con YouTube,
  Paramount+ y ViX.
- Lectura desde pistas de texto o subtítulos visibles, con ajustes para evitar
  repeticiones y manejar el texto que se va completando.
- Elección de voz, velocidad y volumen en el modo voz, sin idioma preferido.
- Lectura en pantalla completa corregida y comprobada con NVDA. La corrección
  que probé en beta ya está incorporada a esta estable.
- Recuperación del sintetizador con más margen y un reintento cuando corresponde,
  conservando el modo que elegiste ante un error.
- Lectura por voz en orden: cada subtítulo termina antes de empezar el siguiente.
- Controles de reproducción, avance, retroceso, volumen del video y pantalla
  completa, con mejoras para mantenerlos visibles al recorrerlos con el teclado.
- Debug opcional, diagnóstico, reinicio manual y preparación de issues en GitHub.

La extensión lee los subtítulos que proporciona el contenido. No genera ni
traduce subtítulos: acordate de activarlos en la plataforma.

## Empezar a usarla

1. Abrí el contenido y activá sus subtítulos.
2. Activá SubtitleReader con **Alt+Shift+K** en esa pestaña.
3. Elegí cómo escuchar con **Alt+Shift+L**: lector, voz del sistema o desactivado.
4. Abrí el panel con **Alt+Shift+O** para ajustar la lectura y sus controles.

## Modo voz: voz, velocidad y volumen

El modo **Voz del sistema** usa las voces que el navegador expone mediante
Web Speech API. En el panel vas a encontrar:

- **Voz del sintetizador:** elegí cualquiera de la lista. La opción
  **Predeterminada del navegador** respeta esa configuración; no priorizo español.
- **Velocidad del sintetizador:** entre 0,8x y 3x. El valor inicial es 1,75x;
  podés cambiarlo según la voz y el contenido.
- **Volumen del sintetizador:** de 0% a 100%, en pasos de 5. El valor inicial es
  100%. El 0% silencia la lectura por voz, sin silenciar la película.

Los valores se guardan en el perfil del navegador y se aplican a las siguientes
frases y a los reintentos. No vuelvo a empezar una frase ya iniciada al mover un
ajuste. Los botones de volumen y silencio del reproductor controlan el **video**;
el deslizador del sintetizador controla la **lectura**.

Las voces disponibles dependen del navegador y del sistema. Algunas pueden usar
servicios en línea. Instalar un sintetizador para NVDA no garantiza que aparezca
en esta lista: el navegador tiene que exponerlo.

### Terminar cada subtítulo

Lector y voz reciben el mismo texto y usan los mismos filtros de repeticiones.
En modo voz, si aparece otro subtítulo mientras estoy escuchando uno, espera
su turno. La llegada de texto nuevo ya no corta la frase ni su reintento.
Voz, velocidad y volumen se aplican cuando comienza cada frase.

Si la voz es más lenta que los diálogos, la lectura puede quedar algo atrás.
Podés ajustar la velocidad o usar **Alt+Shift+R** para vaciar lo pendiente y
reiniciar desde el contenido actual. Pausar, buscar otra posición, cambiar de
video o de modo, apagar o reiniciar también descarta la lectura anterior.
En modo lector, NVDA administra su propia voz; **Ctrl** permite detenerla.

## Modo lector: usá tu sintetizador habitual

En **Lector de pantalla**, SubtitleReader entrega el texto mediante una región
accesible. La voz, el sintetizador, la velocidad, el volumen y el tono los
configurás en tu lector. Podés usar cualquier sintetizador instalado que ese
lector admita; RHVoice y Phonon son recomendaciones, no requisitos.

Los ajustes de voz del panel de SubtitleReader no modifican los de NVDA, JAWS
u otro lector. Tampoco los controles del video modifican el volumen del lector.

### Referencia de teclado de NVDA

El **anillo de opciones del sintetizador** permite ajustar voz, velocidad,
volumen, tono y otras opciones que admita el motor mientras sigue el video,
sin abandonar la página. Elegí el parámetro y después cambiá su valor.

| Acción | Escritorio | Portátil |
| --- | --- | --- |
| Elegir el sintetizador | NVDA+Ctrl+S | NVDA+Ctrl+S |
| Abrir opciones de voz | NVDA+Ctrl+V | NVDA+Ctrl+V |
| Parámetro siguiente | NVDA+Ctrl+Flecha derecha | NVDA+Ctrl+Mayús+Flecha derecha |
| Parámetro anterior | NVDA+Ctrl+Flecha izquierda | NVDA+Ctrl+Mayús+Flecha izquierda |
| Subir el valor o elegir la voz siguiente | NVDA+Ctrl+Flecha arriba | NVDA+Ctrl+Mayús+Flecha arriba |
| Bajar el valor o elegir la voz anterior | NVDA+Ctrl+Flecha abajo | NVDA+Ctrl+Mayús+Flecha abajo |
| Aumentar en pasos mayores | NVDA+Ctrl+RePág | NVDA+Ctrl+Mayús+RePág |
| Disminuir en pasos mayores | NVDA+Ctrl+AvPág | NVDA+Ctrl+Mayús+AvPág |
| Abrir perfiles de configuración | NVDA+Ctrl+P | NVDA+Ctrl+P |

**NVDA** es la tecla modificadora configurada, como Insert o Bloq Mayús.
**Mayús** significa Shift. La disposición de escritorio o portátil se elige
en NVDA; no depende de que el equipo sea una notebook.

Por ejemplo, recorré el anillo hasta escuchar «velocidad» y usá arriba o abajo
para cambiarla. Para voz, volumen o tono, el procedimiento es el mismo.
Los comandos de selección de sintetizador y opciones de voz abren un diálogo
de NVDA; al cerrarlo podés seguir en el navegador.

Para volver al sintetizador habitual, usá **NVDA+Ctrl+S** y elegilo otra vez.
Si querés separar una configuración completa para subtítulos de la de uso
cotidiano, creá un perfil con **NVDA+Ctrl+P**. Volver a elegir un motor no equivale
a deshacer todos los cambios de configuración.

Referencias oficiales: [comandos de NVDA 2026.2](https://download.nvaccess.org/releases/2026.2/documentation/es/keyCommands.html)
y [guía y perfiles de configuración](https://download.nvaccess.org/releases/2026.2/documentation/userGuide.html#ConfigurationProfiles).
Si reasignaste comandos, usá tus combinaciones configuradas.

### Sintetizadores que recomiendo

**[RHVoice](https://rhvoice.org/)** es una alternativa gratuita y de código
abierto para NVDA y aplicaciones compatibles con SAPI 5 en Windows. Revisá
la [guía de instalación](https://rhvoice.org/installation/) y la compatibilidad
del complemento con tu versión de NVDA. La instalación para el sistema y el
complemento de NVDA son opciones distintas.

También recomiendo **[Phonon for NVDA](https://github.com/OnjLouis/phononNVDA)**.
Lo estuve probando y me dio muy buenos resultados para libros y subtítulos,
con voces naturales. Lo recomiendo especialmente para ese uso; para navegar
interfaces a mucha velocidad, elegí el sintetizador que te resulte más ágil.
Su proyecto indica NVDA de 64 bits 2026.2 o posterior, Windows 10 o posterior y
un procesador con AVX2. La respuesta depende del equipo.
[Descargas y requisitos](https://github.com/OnjLouis/phononNVDA/releases).

## Atajos de SubtitleReader

| Acción | Comando |
| --- | --- |
| Activar o desactivar en la pestaña | Alt+Shift+K |
| Cambiar entre lector, voz y desactivado | Alt+Shift+L |
| Abrir o cerrar el panel | Alt+Shift+O |
| Activar o desactivar debug | Alt+Shift+D |
| Reiniciar la lectura | Alt+Shift+R |

Estos comandos controlan la extensión. Los del apartado anterior controlan NVDA.

## Controles del reproductor y foco del teclado

Al recorrer los botones con **Tab**, **Shift+Tab** o las flechas, mantengo visibles
los controles de la plataforma. Esto también se aplica mientras usás los
controles o ajustes de SubtitleReader. Al salir de ese espacio, la plataforma
vuelve a manejar su ocultación habitual.

Si el reproductor ya tiene controles utilizables, o puedo hacerlos accesibles
agregando nombres y teclado como en ViX y Flow, oculto la barra de reproducción
alternativa de KathWare. El panel de lectura y sus ajustes siguen disponibles.
Una barra que se oculta por inactividad no hace aparecer otro reproductor.
Si los controles desaparecen de verdad o dejan de ser utilizables, conservo
el respaldo. Si estabas usando esa barra, espero a que salgas antes de ocultarla.

## Plataformas probadas y límites

Netflix, Disney+, Max, Paramount+ y YouTube funcionan bien en las pruebas que
hice durante el desarrollo. También comprobé Flow a demanda y la lectura de ViX.
No doy por probado un sitio solo porque tenga selectores en el código.

- **Flow en vivo sigue pendiente:** puede ir detrás del audio y entregar frases
  cortadas. La 3.0.0 no da por resuelto ese fallo.
- Los cambios de las plataformas pueden requerir nuevas correcciones. Páginas
  internas del navegador o lugares que no permitan extensiones quedan fuera
  del alcance del lector.

**Pantalla completa ya está corregida.** La región que anuncia los subtítulos
acompaña al contenedor del reproductor. Confirmé su funcionamiento al probar
la beta y verifiqué que la estable incluye esa misma corrección. No queda
anotada como fallo pendiente. Los controles de KathWare usan ese contenedor
para mantener juntos el video, los controles y los anuncios del lector.

La recuperación de voz espera hasta 10 segundos para iniciar cuando el motor
no responde; ese límite no agrega 10 segundos a cada subtítulo. Si hay un fallo
antes de hablar, permite un reintento. Los subtítulos nuevos esperan su turno
y el modo que elegiste se conserva.

## Debug y reportar un problema

Debug es opcional. Podés activarlo con **Alt+Shift+D** o con **Debug** en el panel.
Reproducí el fallo durante unos segundos. **Diagnóstico** muestra el estado
técnico en la consola del navegador; si hace falta, podés copiarlo al reporte.
**Alt+Shift+R** reinicia la lectura después de una actualización o un fallo.

Para reportar, abrí la ventana del icono de la extensión, escribí qué ocurrió y
elegí **Preparar issue en GitHub**. Se abre un borrador para que lo revises y
publiques con tu cuenta. No se publica automáticamente.

El borrador incluye versión, plataforma, navegador, modo y URL de la página
sin credenciales, parámetros ni fragmento. La casilla de registros es optativa:
adjunta solo los que ya estén guardados para esa pestaña y página, si existen.
Activar debug muestra mensajes en la consola; no convierte esa casilla en una
captura automática de todos sus mensajes.

Los registros pueden contener subtítulos y otros datos del contenido. Revisá
el borrador antes de publicarlo y desactivá debug al terminar. Los ajustes y
los registros guardados usan almacenamiento local del navegador; no uso un
servidor propio para recibirlos. Al preparar un issue, el texto seleccionado se
abre en GitHub.

## Chrome y Microsoft Edge: un mismo ZIP

Voy a subir primero la 3.0.0 a Chrome Web Store. Si supera la revisión de Google,
voy a presentar **ese mismo ZIP en Microsoft Edge Add-ons**. Este plan reemplaza
la espera orientativa de dos semanas que habíamos anotado para Edge.

El paquete no contiene `key` ni `update_url` específicos de una tienda. Está
preparado con Manifest V3 y las APIs que usa esta extensión están disponibles
en Chromium. La aprobación de Google no sustituye la validación de Microsoft
ni la comprobación del funcionamiento en Edge.

En **Edge**, el modo voz permitirá elegir las voces que el navegador exponga.
Esto incluye voces de Microsoft cuando estén disponibles, por ejemplo **Elena,
en español de Argentina**, si aparece en la lista. No prometo que todas las
voces del catálogo de Microsoft estén disponibles en cada equipo.

El código es el mismo; las preferencias y las voces se gestionan en cada
navegador y perfil. No se trasladan automáticamente de Chrome a Edge.
Otros navegadores Chromium y Firefox mantienen sus pruebas y adaptación
pendientes.

Referencias: [portar una extensión a Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension)
y [publicación en Edge Add-ons](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension).

## Instalación local y organización del repositorio

1. Descargá o cloná `main`.
2. Abrí la administración de extensiones del navegador.
3. Activá el modo de desarrollador y elegí **Cargar sin comprimir**.
4. Seleccioná `Extension/`.
5. Recargá la extensión y las pestañas donde la estabas usando al actualizar.

El manifest queda en la raíz del ZIP de distribución. Solo incluyo la extensión
y su licencia; README, historial, scripts, pruebas y proyectos de reproductor
no se cargan ni se empaquetan como parte de la extensión.

En `main` dejo `Extension/`, README, historial y licencia. En
[`3.0.0-beta`](https://github.com/dragonmoon1522/KathWare-SubtitleReader/tree/3.0.0-beta)
conservo las herramientas y el desarrollo futuro. Accessibility Player y el
snippet de WPCode Lite tienen sus propios historiales y no forman parte de este ZIP.

Para después quedan Flow en vivo, la reorganización por tipo de renderizado,
Audiocinemateca para personas con cuenta válida, la versión en inglés, la
detección de idiomas y las funciones experimentales que siguen en beta.

[Historial de versiones](version.md) · [Licencia](LICENSE.md) ·
[Sitio del proyecto](https://kathware.com.ar/subtitlereader/) ·
[Ficha en Chrome Web Store](https://chrome.google.com/webstore/detail/mbdjoamfljkbajlppfpahibnfjdiecbe/)
