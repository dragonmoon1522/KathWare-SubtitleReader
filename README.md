## **KathWare SubtitleReader**

**Autora:** Katherine Vargas | [(KathWare)](https://kathware.com.ar)
**Última actualización:** 2026-11-20

### Rama de desarrollo: 3.0.0-beta

**La versión estable 3.0.0 ya está en [`main`](https://github.com/dragonmoon1522/KathWare-SubtitleReader/tree/main)**,
aprobada por Katherine el 17/11/2026 y ampliada el 20/11 con las correcciones
de pantalla completa de contenedor y recuperación de voz.

Esta rama continúa como espacio de desarrollo para las versiones posteriores.
Se conservan aquí las herramientas experimentales de medición de Flow y la
búsqueda ampliada de selectores/reportes, además de las correcciones compartidas
con la estable.

Permanecen abiertos para una próxima versión el atraso y la fragmentación de
**Flow en vivo** y el límite del modo de pantalla completa nativa de video.
Ver [el seguimiento de fallos](docs/problemas-conocidos.md).

**Ensayo de pantalla completa, revisión 1 (17/11/2026):** la región de anuncios
acompaña al contenedor de pantalla completa y los controles de KathWare solicitan
ese contenedor cuando está disponible. Se retira el reinicio automático del
pipeline al cambiar de modo. Katherine aprueba su incorporación a la estable
el 20/11/2026. Ver [la prueba y sus límites](docs/fullscreen-lectura.md).

**Recuperación del sintetizador, revisión 1 (17/11/2026):** un fallo de voz ya no
cambia ni guarda automáticamente el modo lector. Se amplía la espera inicial,
se ajusta la vigilancia a la duración y velocidad de la frase y se permite un
reintento antes de empezar a hablar. Ver [comportamiento y pruebas](docs/tts-recuperacion.md).
Katherine confirma que el error no reapareció y aprueba pasar esta recuperación
a la estable el 20/11/2026. La voz automática respeta la predeterminada del
navegador, sin preferencia impuesta de español u otro idioma.

**Compatibilidad y reportes, revisión 1 (17/11/2026):** los sitios sin un banco
propio prueban los selectores existentes hasta encontrar subtítulos visibles del
video. Se conserva la prioridad de los bancos propios y la arquitectura actual.
El popup permite activar debug y preparar un issue con comentarios y diagnóstico
optativo de la pestaña actual. Ver [compatibilidad y reportes](docs/compatibilidad-y-reportes.md).
Crunchyroll es un candidato para pruebas reales; la búsqueda automática no acredita
por sí sola que su reproductor funcione con la extensión.

La etiqueta de esta rama sigue siendo `3.0.0-beta` durante el desarrollo;
la entrega estable debe empaquetarse desde `main`. El número de la próxima
versión se asignará cuando se defina su alcance.

Se conserva el [plan de versiones](docs/plan-de-versiones.md): Chrome primero,
otros Chromium tras la estabilización y Firefox más adelante. La reorganización
por renderizadores, Audiocinemateca, la versión en inglés y la detección
automática de idiomas siguen pendientes para versiones posteriores.

---

### **Descripción del Proyecto**

**KathWare SubtitleReader** es una extensión accesible para navegador que permite la **lectura automática de subtítulos** en plataformas de video, incluso cuando el reproductor **no ofrece accesibilidad nativa** o presenta barreras para lectores de pantalla.

Forma parte del ecosistema **KathWare** y se desarrolla como proyecto independiente dentro del entorno GitHub de `dragonmoon1522`.

Su objetivo principal es **garantizar acceso al contenido audiovisual**, respetando siempre la configuración del usuario y **sin imponer idioma, voz ni comportamiento al lector de pantalla o sintetizador**.

Incluye:

* Activación y control completos desde teclado
* Lectura automática de subtítulos mediante lector de pantalla o sintetizador del sistema
* Detección inteligente de subtítulos visibles cuando no existen pistas accesibles
* Adaptaciones automáticas para reproductores con interfaces poco accesibles
* Herramientas de diagnóstico para pruebas de accesibilidad

---

### Enlaces oficiales

Sitio web:
https://kathware.com.ar/subtitlereader/

Presentación del proyecto:
https://kathware.com.ar/presentacion-subtitlereader/

Chrome Web Store:
https://chrome.google.com/webstore/detail/mbdjoamfljkbajlppfpahibnfjdiecbe/

Repositorio:
https://github.com/dragonmoon1522/KathWare-SubtitleReader

---

### Plataformas y estado de validación de 3.0.0-beta

| Plataforma | Evidencia disponible | Pendiente para esta entrega |
| --- | --- | --- |
| Netflix y Max | Katherine confirmó funcionamiento en la beta el 31/10/2026. | Prueba funcional cerrada; pendientes generales de salida. |
| Disney+ / Hive | Corrección integrada; Katherine confirmó funcionamiento en la beta el 31/10/2026. | Prueba funcional cerrada; pendientes generales de salida. |
| Flow a demanda | Katherine confirmó funcionamiento el 07/10/2026. | Comprobación con el paquete final. |
| ViX | Lectura confirmada el 07/10/2026; pruebas automatizadas de lectura y controles. | Cierre conjunto con lector/TTS y controles accesibles. |
| YouTube | Katherine confirmó funcionamiento correcto de la revisión 1 el 31/10/2026; 14 pruebas específicas. | Prueba funcional cerrada; pendientes generales de salida. |
| Flow en vivo | Revisión 5: entrega por frase o cambio de hablante; conserva letras en formación y las protecciones frente al desplazamiento de líneas. | Confirmar la nueva agrupación y medir el desfase reportado con el audio. |
| Paramount+ | Katherine confirmó funcionamiento en la beta el 31/10/2026. | Prueba funcional cerrada; pendientes generales de salida. |
| Crunchyroll y otros sitios sin banco propio | Búsqueda compartida de selectores integrada y probada con DOM de ejemplo. | Validación en el servicio real; no se anuncia compatibilidad confirmada. |
| Dailymotion / Telefe | Objetivo previsto; sin cierre documentado en esta entrega. | Prueba explícita antes de anunciarlo como verificado. |

La confirmación del 31/10/2026 documenta la prueba funcional reportada para
Netflix, Disney+, Max, Paramount+ y YouTube. Katherine aprobó el paso a estable
en `main` el 17/11/2026, con Flow en vivo y pantalla completa como fallos abiertos.

Para localizar el atraso de Flow en vivo, [hacé dos marcas sin interrumpir
el video](docs/flow-timing.md): **Alt+Shift+M** al escuchar el diálogo y
**Alt+Shift+N** cuando aparezca o se lea ese mismo subtítulo. El informe
separa el intervalo entre teclas de los tiempos del texto de Flow y de la
salida de KathWare. Queda pendiente probarlo con la transmisión real.

Otros sitios y reproductores pueden funcionar mediante las pistas o selectores
incluidos, pero no se anuncian como verificados sin una prueba concreta. Algunas
plataformas no se han podido probar por limitaciones de acceso o presupuesto;
se agradecen reportes de funcionamiento y errores.

> Las plataformas pueden modificar su funcionamiento interno sin previo aviso.
> KathWare SubtitleReader está diseñado para adaptarse dinámicamente, pero pueden producirse fallos temporales.

---

### Compatibilidad destacada: Flow

En **Flow**, la extensión no solo permite la lectura de subtítulos, sino que además:

* Mejora la accesibilidad del reproductor
* Detecta y anuncia cuando el botón de audio y subtítulos no está disponible
* Permite navegación accesible en canales de TV en vivo

> Esto convierte a Flow en uno de los entornos donde KathWare SubtitleReader aporta mayor valor diferencial.

---

### Tecnologías utilizadas

* HTML, CSS y JavaScript puro
* Web Speech API (SpeechSynthesis), opcional
* Lectura accesible mediante *live regions*
* Almacenamiento local del navegador (`storage.local`)
* Detección dinámica de:

  * elementos `<video>`
  * pistas de subtítulos (`textTracks`)
  * subtítulos renderizados en el DOM

---

### Privacidad y datos

KathWare SubtitleReader:

* **No recopila datos personales sensibles**
* **No envía información a servidores externos por defecto**
* Utiliza almacenamiento local (`storage.local`) únicamente para:

  * configuración del usuario
  * estado de la extensión
  * logs de diagnóstico (opcionales)

> El envío de logs solo ocurre cuando el usuario decide reportar un problema.

---

### Licencias y manifiestos

* [Licencia de Accesibilidad Universal (LAU)](https://kathware.com.ar/lau/)
* [Creative Commons BY-NC-SA 4.0](https://kathware.com.ar/normas-de-uso-y-licencias-de-kathware/)

---

### Funcionalidades principales

* **Activación por atajo universal:** `Alt + Shift + K`
* **Panel accesible opcional**, visible solo cuando la extensión está activa

#### Modos de funcionamiento

* **Modo lector:** usa lector de pantalla (*live region*)
* **Modo voz:** usa sintetizador del sistema
* **Modo desactivado**

Atajos:

* `Alt + Shift + L` → cambiar modo
* `Alt + Shift + O` → abrir/cerrar panel

---

### Inteligencia de detección

* Selección automática de fuente de subtítulos:

  * `track` (pistas accesibles)
  * `visual` (detección en pantalla)

* Lectura sincronizada con el video

* Sistema anti-duplicación:

  * evita repeticiones
  * detecta re-render de subtítulos
  * filtra contenido irrelevante (menús, overlays, etc.)

---

### Controles accesibles del reproductor

* Reproducir / pausar
* Avanzar / retroceder
* Volumen
* Pantalla completa

Cuando el foco está dentro del reproductor, la extensión ayuda a mantener
visibles sus barras de control al recorrerlas con Tab, Shift+Tab y flechas.
La barra alternativa de KathWare sigue disponible mientras se la usa con
el teclado y se retira al salir si los controles del sitio ya funcionan.

---

### Arquitectura y diseño del núcleo

El núcleo está diseñado de forma **modular, robusta y orientada a accesibilidad real**.

Principios clave:

* **Arranque seguro (bootstrap)**

  * `kwsr.bootstrap.js` crea `window.KWSR`
  * evita cargas duplicadas

* **Separación de responsabilidades**

  * `core/` → lógica principal
  * `ui/` → overlay y notificaciones
  * `adapters/` → compatibilidad por plataforma

* **Automatización**

  * el sistema decide la mejor fuente de subtítulos
  * el usuario no necesita configuración técnica

* **Resistencia a cambios externos**

  * deduplicación avanzada
  * control de re-render
  * watchdog del sintetizador

* **Accesibilidad como base**

  * uso de *live regions*
  * sin forzar idioma ni voz
  * sin interferir con navegación del usuario

---

### Instalación

#### Chrome Web Store

https://chrome.google.com/webstore/detail/mbdjoamfljkbajlppfpahibnfjdiecbe/

#### Chrome / Edge y otros Chromium

1. Clonar o descargar el repositorio
2. Abrir la administración de extensiones, por ejemplo `chrome://extensions/` o `edge://extensions/`.
3. Activar **Modo de desarrollador**
4. Seleccionar **Cargar sin comprimir**
5. Elegir la carpeta `Extension/` del proyecto.

También se pueden generar los ZIP con `python3 scripts/package_extension.py`,
descomprimir el correspondiente al navegador y cargar la carpeta que contiene
su `manifest.json`. El paquete `chromium` sirve como base para Edge, Brave,
Opera y Vivaldi, pendientes de sus pruebas específicas y procesos de tienda.
Las instrucciones completas están en [paquetes y navegadores](docs/navegadores.md).

---

### Contribuciones y reporte de errores

Podés:

* Crear un **Issue**
* Enviar un **Pull Request**
* Usar el formulario integrado en la extensión
* Adjuntar logs de diagnóstico (opcional)

---

### Licencia del proyecto

* Licencia de Accesibilidad Universal (LAU) v1.3
* Creative Commons BY-NC-SA 4.0

---

### Historial de versiones

[version.md](./version.md)

---

### Estado del proyecto

**`main`: versión estable 3.0.0. `3.0.0-beta`: desarrollo futuro.**

Esta rama conserva los experimentos y las pruebas para continuar el trabajo.
El paquete estable se obtiene desde `main`. Los fallos de Flow en vivo y
pantalla completa siguen abiertos; la consola independiente de `web/` no
forma parte de los paquetes de la extensión.
