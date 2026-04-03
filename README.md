## **KathWare SubtitleReader**

**Autora:** Katherine Vargas | [(KathWare)](https://kathware.com.ar)
**Última actualización:** 2026-04-03

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

### 🌍 Plataformas soportadas (versión actual)

**Compatibilidad verificada:**

* Netflix
* Disney+
* Max
* Paramount+
* Flow

> ⚠️ Las plataformas pueden modificar su funcionamiento interno sin previo aviso.
> KathWare SubtitleReader está diseñado para adaptarse dinámicamente, pero pueden producirse fallos temporales.

---

### ⭐ Compatibilidad destacada: Flow

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

### 🔒 Privacidad y datos

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

* 🛡 [Licencia de Accesibilidad Universal (LAU)](https://kathware.com.ar/lau/)
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

> ⚠️ Algunas plataformas pueden limitar la accesibilidad de ciertos controles.

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

### Instalación (modo desarrollador)

#### Chrome / Edge:

1. Clonar o descargar el repositorio
2. Abrir: `chrome://extensions/`
3. Activar **Modo de desarrollador**
4. Seleccionar **Cargar sin comprimir**
5. Elegir la carpeta del proyecto

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

🔗 [version.md](./version.md)

---

### Estado del proyecto

**Beta pública**

El proyecto se encuentra en desarrollo activo, con foco en:

* accesibilidad real con lector de pantalla
* funcionamiento en plataformas de streaming
* adaptación a entornos dinámicos