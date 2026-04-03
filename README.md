## **KathWare SubtitleReader**

**Autora:** Katherine Vargas | [(KathWare)](https://kathware.com.ar)
**Última actualización:** 2026-04-03

---

### **Descripción del Proyecto**

**KathWare SubtitleReader** es una extensión accesible para navegador que permite la **lectura automática de subtítulos** en plataformas de video, incluso cuando el reproductor **no ofrece accesibilidad nativa** o presenta barreras para lectores de pantalla (como ocurre en Netflix, Max, Flow y plataformas similares).

Forma parte del ecosistema **KathWare** y se desarrolla como proyecto independiente dentro del entorno GitHub de `dragonmoon1522`.

El objetivo principal de la extensión es **garantizar acceso al contenido audiovisual**, respetando siempre la configuración del usuario y **sin imponer idioma, voz ni comportamiento al lector de pantalla o sintetizador**.

Incluye:

* Activación y control completos desde teclado.
* Lectura automática de subtítulos mediante lector de pantalla o sintetizador del sistema.
* Detección inteligente de subtítulos visibles cuando no existen pistas accesibles.
* Adaptaciones automáticas para reproductores con interfaces poco accesibles.
* Herramientas de diagnóstico y compatibilidad para pruebas de accesibilidad.

---

### 🌍 Plataformas soportadas (estado actual)

**Probadas y funcionales:**

* Netflix
* Disney+
* Max
* YouTube

**Compatibilidad en evaluación o parcial:**

* Prime Video
* Paramount+
* Flow
* Pluto TV
* Twitch
* Vimeo

> ⚠️ Las plataformas pueden cambiar su funcionamiento interno sin previo aviso.
> KathWare SubtitleReader está diseñado para adaptarse dinámicamente, pero pueden producirse fallos temporales.

---

### Tecnologías utilizadas

* HTML, CSS y JavaScript puro.
* Web Speech API (SpeechSynthesis), opcional y controlada por el usuario.
* Lectura accesible mediante *live regions* (no se fuerza idioma).
* Almacenamiento local del navegador (`storage.local`).
* Detección dinámica de:

  * elementos `<video>`,
  * pistas de subtítulos (`textTracks`),
  * subtítulos renderizados visualmente en el DOM.

---

### 🔒 Privacidad y datos

KathWare SubtitleReader:

* **No recopila datos personales sensibles.**
* **No envía información a servidores externos por defecto.**
* Utiliza almacenamiento local (`storage.local`) únicamente para:

  * configuración del usuario,
  * estado de la extensión,
  * logs de diagnóstico (opcionales).

> El envío de información de diagnóstico **solo ocurre si el usuario decide reportar un problema**.

---

### Licencias y manifiestos

* 🛡 [Licencia de Accesibilidad Universal (LAU) — Español y inglés](https://kathware.com.ar/lau/)
* [Creative Commons BY-NC-SA 4.0](https://kathware.com.ar/normas-de-uso-y-licencias-de-kathware/)

> Todos los proyectos del ecosistema KathWare están protegidos por la LAU y por licencias libres no comerciales.

---

### Funcionalidades principales

* **Activación por atajo universal:** `Alt + Shift + K`
* **Panel accesible opcional**, disponible solo cuando la extensión está activa.

#### Modos de lectura

* **Modo lector:** utiliza lector de pantalla (*live region*).
* **Modo voz:** utiliza sintetizador del sistema.
* **Modo desactivado.**

Cambio rápido:

* `Alt + Shift + L` → alternar modos
* `Alt + Shift + O` → abrir/cerrar panel

---

### Inteligencia de detección

* Selección automática de fuente de subtítulos:

  * `track` (pistas accesibles),
  * `visual` (detección en pantalla).
* Lectura sincronizada con el video.
* **Sistema anti-duplicación avanzado**:

  * evita eco en Netflix y Max,
  * detecta re-render de subtítulos,
  * filtra contenido irrelevante (menús, overlays).

---

### Controles accesibles del reproductor

* Reproducir / pausar
* Avanzar / retroceder
* Volumen
* Pantalla completa

> ⚠️ Algunas plataformas pueden limitar la accesibilidad de ciertos controles.

---

### Arquitectura y decisiones de diseño (núcleo)

El núcleo de **KathWare SubtitleReader** está diseñado de forma **modular, defensiva y comprensible**, priorizando la mantenibilidad y la accesibilidad.

Principios clave:

* **Arranque seguro (bootstrap):**

  * `kwsr.bootstrap.js` crea un único namespace global (`window.KWSR`)
  * Previene cargas duplicadas del content script

* **Separación de responsabilidades:**

  * `core/` → lógica principal
  * `ui/` → overlay y notificaciones
  * `adapters/` → compatibilidad por plataforma

* **Automatización inteligente:**

  * el sistema decide la mejor fuente de subtítulos
  * el usuario no necesita configurar manualmente

* **Robustez frente a cambios externos:**

  * deduplicación avanzada
  * control de re-render
  * watchdog del sintetizador

* **Accesibilidad nativa:**

  * uso de *live regions*
  * sin forzar idioma ni voz
  * sin interferir con navegación o escritura

---

### Instalación de la extensión (modo desarrollador)

#### En Google Chrome o Microsoft Edge:

1. Descargá o cloná este repositorio.
2. Abrí: `chrome://extensions/`
3. Activá **"Modo de desarrollador"**
4. Seleccioná **"Cargar sin comprimir"**
5. Elegí la carpeta del proyecto

---

### Cómo contribuir o reportar errores

Podés:

* Enviar un **pull request**
* Abrir un **Issue**
* Usar el **formulario integrado en la extensión**
* Enviar logs de diagnóstico (opcional)

---

### Licencia de este proyecto

* [Licencia de Accesibilidad Universal (LAU) v1.2](https://kathware.com.ar/lau/)
* [Creative Commons BY-NC-SA 4.0](https://kathware.com.ar/normas-de-uso-y-licencias-de-kathware/)

---

### Historial de versiones

🔗 [Consultar `version.md`](./version.md)

---

### Estado actual del proyecto

Este proyecto se encuentra en **desarrollo activo (beta pública)**.

Las pruebas se realizan priorizando:

* accesibilidad real con lector de pantalla
* uso en plataformas de streaming reales
* comportamiento en escenarios no controlados