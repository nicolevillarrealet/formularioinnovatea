# INNOVATEA — Formulario de caracterización

Encuestas de caracterización del proyecto **INNOVATEA: Voces diversas, futuros posibles**
(Gobernación de Nariño). Dos formularios —rectores y docentes de básica primaria— que se
incrustan en WordPress y escriben cada respuesta en una hoja de Google Sheets.

- **Formulario 1 · Rectores:** 28 preguntas, caracterización institucional y poblacional.
- **Formulario 2 · Docentes:** 46 preguntas en 6 secciones. Las secciones 2 a 4 se repiten
  una vez por cada estudiante reportado, sin nombres ni documentos.

---

## Puesta en marcha (tres pasos)

### 1. Instalar el Apps Script en la hoja

1. Abra la hoja **Form_caracterización** en Google Sheets.
2. **Extensiones → Apps Script**. Borre lo que haya y pegue [`apps-script/Codigo.gs`](apps-script/Codigo.gs).
3. Si va a usar el panel, en **Configuración del proyecto → Propiedades del script** agregue
   `CLAVE_PANEL` con la clave que elija.
4. **Implementar → Nueva implementación → Aplicación web**, con:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
5. Copie la URL que termina en `/exec`.

### 2. Configurar el repositorio

Edite [`config.js`](config.js):

```js
ENDPOINT_SHEETS: "https://script.google.com/macros/s/.../exec",
CLAVE_PANEL: "la-clave-que-eligió",   // vacío = sin panel en el sitio
```

Haga `commit` y `push`. jsDelivr sirve la versión nueva (puede tardar hasta 12 horas en
refrescar su caché; para forzarlo abra una vez
`https://purge.jsdelivr.net/gh/transformaciondigital2026/formularioinnovatea@main/main.js`).

### 3. Pegar el formulario en WordPress

En la página donde va la encuesta, agregue un bloque **HTML personalizado** con estas dos líneas
(también están en [`wordpress/bloque-html.html`](wordpress/bloque-html.html)):

```html
<div id="innovatea-app"></div>
<script type="module" src="https://cdn.jsdelivr.net/gh/transformaciondigital2026/formularioinnovatea@main/main.js"></script>
```

No hace falta plugin, ni FTP, ni subir archivos al hosting. Los estilos y la imagen del banner
se cargan solos desde el mismo repositorio.

> **En producción conviene fijar una versión.** Cambie `@main` por una etiqueta de git
> (`@v1.0.0`, por ejemplo). Así un commit nuevo nunca altera el formulario que está en línea
> hasta que usted publique otra etiqueta.

---

## Cómo se reflejan los datos

Cada envío viaja en un solo POST al Apps Script, que escribe en tres pestañas:

| Pestaña | Una fila por | Se une con |
|---|---|---|
| `Rectores` | encuesta de rector | — |
| `Docentes` | encuesta de docente | — |
| `Estudiantes` | ficha de estudiante | `id_envio` de la pestaña `Docentes` |
| `_envios` | envío completo en JSON | uso interno del panel |

Las tres primeras son las legibles: se descargan con **Archivo → Descargar → Microsoft Excel
(.xlsx)** y ya vienen con los enunciados completos como encabezado. La pestaña `_envios` es la
que consulta el panel y no hace falta mirarla.

«Tiempo real» aquí significa que la fila aparece en la hoja en el mismo momento del envío —
quien tenga la hoja abierta la ve llegar— y que el panel del sitio se refresca cada 30 segundos
(`INTERVALO_PANEL_MS` en `config.js`).

### Si cambia una pregunta

El Apps Script no conoce las preguntas: el formulario le manda los encabezados en cada envío.
Al agregar o editar una pregunta en `modulos/preguntas.js`, la hoja agrega la columna nueva al
final por su cuenta, sin tocar el `.gs` ni perder lo ya registrado.

---

## Estructura

```text
formularioinnovatea/
├── index.html              Página de prueba local y de GitHub Pages
├── config.js               Lo único que hay que editar
├── main.js                 Controlador: el único archivo que enlaza WordPress
├── modulos/
│   ├── catalogos.js        Municipios, EPS, grados, directorio institucional
│   ├── preguntas.js        Las 74 preguntas de los dos formularios
│   ├── ui.js               Módulo 1 · renderizado e interacción
│   ├── recolector.js       Módulo 2 · lectura del DOM al enviar
│   ├── transformador.js    Módulo 3 · limpieza, validación y filas
│   ├── exportador.js       Módulo 4 · envío a Sheets, cola y respaldo CSV
│   └── panel.js            Panel de resultados de la coordinación
├── estilos/innovatea.css   Todo acotado a #innovatea-app
├── assets/                 Imagen del banner
├── apps-script/Codigo.gs   Web App que escribe en la hoja
└── wordpress/              Qué pegar en el bloque HTML
```

El flujo de un envío recorre los módulos en orden: `ui` avisa que se pulsó enviar →
`recolector` lee el DOM → `transformador` limpia, valida y arma las filas → `exportador` las
manda a la hoja. Ningún módulo llama al siguiente: los coordina `main.js`.

---

## Decisiones que conviene conocer

**Borrador local.** Lo que se va respondiendo se guarda en el navegador de quien contesta. Si
se cierra la página por accidente, al volver encuentra la encuesta como la dejó. Se borra al
enviar.

**Cola de reintentos.** Si el envío falla por falta de señal, la encuesta queda guardada en el
dispositivo y sale sola la próxima vez que se abra el formulario con conexión. A quien responde
se le avisa en pantalla para que no la diligencie dos veces.

**Preguntas condicionales.** Una pregunta que se oculta después de haber sido respondida no
viaja a la hoja: el transformador descarta las respuestas de preguntas no visibles.

**Avisos de coherencia.** En el formulario de rectores, si las cifras no cuadran (más niñas y
niños autistas que diagnósticos reportados, o más estudiantes con condiciones que matrícula
total) aparece un aviso en naranja. Es un aviso, no un bloqueo: la institución puede tener
razones para esos números.

**Protección del panel.** `CLAVE_PANEL` viaja en el JavaScript del sitio, así que solo evita
que un visitante entre por curiosidad. El control de acceso real son los permisos de la hoja de
Google y de la implementación del Apps Script. Si prefiere no correr ese riesgo, deje
`CLAVE_PANEL` vacío: el enlace al panel desaparece del sitio y la coordinación consulta la hoja
directamente.

**Datos personales.** El formulario pide nombre y contacto de quien responde (con autorización
expresa, Ley 1581 de 2012) y ningún dato identificable de los estudiantes. La lista de quién ha
respondido es de uso interno y no debe incluirse en informes.

**Directorio institucional.** `INSTITUCIONES` en `modulos/catalogos.js` está vacío a la espera
de que la Secretaría entregue el listado. Mientras tanto, el campo de institución acepta
escritura libre. Cuando llegue el listado, basta con llenarlo como
`{ "Pasto": ["IE ...", "IE ..."], ... }` para que aparezcan las sugerencias por municipio.

---

## Desarrollo local

```bash
python3 -m http.server 8777
```

y abrir `http://localhost:8777`. Hace falta un servidor: los módulos de JavaScript no se cargan
desde `file://`.
