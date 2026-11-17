## **KathWare SubtitleReader**

**Autora:** Katherine Vargas | [(KathWare)](https://kathware.com.ar)
**Última actualización:** 2026-11-17

### Versión estable: 3.0.0

La rama `main` contiene la versión estable 3.0.0, aprobada por Katherine el
17/11/2026. Integra las correcciones de Disney+ / Hive, compatibilidad con
YouTube, Paramount+ y ViX, lectura de Flow, selector de voces y velocidad,
controles accesibles y diagnóstico general.

**Fallos conocidos que quedan abiertos para una versión posterior:**

- **Flow en vivo:** atraso respecto del audio y entregas fragmentadas reportadas.
- **Pantalla completa:** los subtítulos no se leen; usar la vista normal para
  mantener la lectura.

Ver el [seguimiento de estos fallos](docs/problemas-conocidos.md).

La distribución inicial corresponde a la extensión de **Chrome**. Tras
aproximadamente dos semanas de uso estable desde su publicación en Chrome se
evaluará la misma versión para otros navegadores Chromium. Firefox queda para
más adelante.

La rama `3.0.0-beta` conserva las herramientas experimentales y continúa como
rama de desarrollo. La reorganización por tipos de renderizado, Audiocinemateca,
la versión en inglés y la detección automática de idiomas quedan para versiones
posteriores.

Ver el [plan de versiones](docs/plan-de-versiones.md) y el
[empaquetado por navegador](docs/navegadores.md).

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

### Plataformas y estado de 3.0.0

| Plataforma | Estado documentado |
| --- | --- |
| Netflix y Max | Funcionamiento confirmado por Katherine durante la beta. |
| Disney+ / Hive | Corrección integrada y funcionamiento confirmado durante la beta. |
| Flow a demanda | Funcionamiento confirmado anteriormente; conserva la implementación actual. |
| ViX | Lectura confirmada anteriormente y pruebas automatizadas de lectura y controles. |
| YouTube | Funcionamiento confirmado de la revisión 1. |
| Flow en vivo | Implementación actual incluida; atraso y fragmentación pendientes de corrección. |
| Paramount+ | Funcionamiento confirmado durante la beta. |
| Dailymotion / Telefe | Selectores previstos; falta validación específica para anunciar compatibilidad verificada. |

La lectura en pantalla completa tiene un fallo conocido, pendiente de
corrección. Las confirmaciones de lectura no implican que ese modo funcione.

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

El desarrollo continúa en la rama beta. Los fallos de Flow en vivo y de lectura
en pantalla completa se conservan abiertos para una próxima versión. La consola
independiente de `web/` queda fuera de los paquetes de la extensión.
