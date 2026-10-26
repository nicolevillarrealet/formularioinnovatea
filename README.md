# INNOVATEA — Formulario de caracterización

Encuestas de caracterización del proyecto **INNOVATEA: Voces diversas, futuros posibles**
(Gobernación de Nariño). Dos formularios —rectores y docentes de básica primaria— que se
incrustan en WordPress con una sola etiqueta y escriben cada respuesta en una hoja de Google
Sheets.

- **Formulario 1 · Rectores:** 28 preguntas, caracterización institucional y poblacional.
- **Formulario 2 · Docentes:** 46 preguntas en 6 secciones. Las secciones 2 a 4 se repiten
  una vez por cada estudiante reportado, sin nombres ni documentos.

---

## En WordPress: una sola línea

En la página donde va la encuesta, agregue un bloque **HTML personalizado** y pegue esto:

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/transformaciondigital2026/formularioinnovatea@main/main.js"></script>
```

Eso es todo. El formulario se monta justo donde esté el bloque; la etiqueta carga el
controlador y el controlador trae por su cuenta los estilos, la imagen del banner y los demás
módulos. No hace falta plugin, ni FTP, ni subir archivos al hosting, y cada `push` a `main`
actualiza el formulario del sitio.

> **En producción conviene fijar una versión.** Cambie `@main` por una etiqueta de git
> (`@v1.0.0`, por ejemplo). Así un commit nuevo nunca altera el formulario que está en línea
> hasta que usted publique otra etiqueta.
>
> jsDelivr guarda los archivos de una rama hasta 12 horas. Para forzar un cambio, abra una vez
> `https://purge.jsdelivr.net/gh/transformaciondigital2026/formularioinnovatea@main/main.js`.

---

## Seguridad

**El repositorio es público y eso no debilita nada.** Conviene entender por qué, porque la
intuición dice lo contrario.

Cualquier persona que abra la página de WordPress descarga estos archivos en su navegador y
puede leerlos con pulsar F12. Eso pasa con el repositorio público y con el repositorio privado:
lo que el navegador ejecuta nunca es secreto. Un repositorio privado solo oculta el historial de
commits y las issues, no el código que se sirve. Por eso la solución no se apoya en esconder
archivos, sino en que **no haya nada que esconder**:

| | Formulario público | Panel de resultados |
|---|---|---|
| Dónde vive | WordPress, visible para todos | Web App privado de Apps Script |
| Qué puede hacer | solo **agregar** filas | solo **leer** |
| Quién entra | cualquiera | quien esté compartido en la hoja |
| Script | `apps-script/Codigo.gs` | `apps-script/Panel.gs` (proyecto aparte) |

Las dos piezas son proyectos de Apps Script distintos, con implementaciones distintas. El que
está expuesto a internet no tiene ninguna función que devuelva datos: aunque alguien encuentre
su URL, no hay nada que pueda consultar.

**Qué protege al endpoint público.** Solo acepta la acción `registrar`, solo escribe en las tres
pestañas de la lista blanca (`Rectores`, `Docentes`, `Estudiantes`), rechaza cuerpos de más de
300 000 caracteres y más de 120 filas por envío, recorta cada celda a 2 000 caracteres, frena
las ráfagas a 60 envíos por minuto y neutraliza el texto que empiece por `=`, `+`, `-` o `@`
para que Excel no lo ejecute como fórmula. Lo peor que puede hacer un atacante es mandar
encuestas falsas, que se borran de la hoja. No puede leer, ni modificar, ni borrar, ni tocar
otra pestaña.

**Qué protege al panel.** Se implementa con *Ejecutar como: el usuario que accede*, así que abre
la hoja con los permisos de quien entra. Quien no esté compartido en
**Form_caracterización** recibe un error de permisos y no ve una sola fila. El control de acceso
es el botón **Compartir** de Google Sheets, que usted ya administra. No hay ninguna clave que
mantener, que rotar, ni que se pueda filtrar en un commit.

**Los datos nunca pasan por GitHub.** Viajan del navegador de quien responde directamente a su
hoja de Google. El repositorio solo contiene la forma del formulario.

---

## Puesta en marcha

### 1. El Web App que recibe las encuestas

1. Abra la hoja **Form_caracterización** en Google Sheets.
2. **Extensiones → Apps Script.** Borre lo que haya y pegue [`apps-script/Codigo.gs`](apps-script/Codigo.gs).
3. **Implementar → Nueva implementación → Aplicación web:**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
4. Copie la URL que termina en `/exec`.

### 2. El repositorio

En [`config.js`](config.js), pegue esa URL:

```js
ENDPOINT_SHEETS: "https://script.google.com/macros/s/.../exec",
```

`commit` y `push`. Es el único valor que hay que configurar.

### 3. El panel de la coordinación

1. En [script.google.com](https://script.google.com) → **Nuevo proyecto**, llamado
   «INNOVATEA — Panel». Es un proyecto **aparte** del anterior: ahí está la seguridad.
2. Pegue [`apps-script/Panel.gs`](apps-script/Panel.gs) en `Código.gs`.
3. **Archivo → Nuevo → Archivo HTML**, llamado exactamente `panel`, con el contenido de
   [`apps-script/panel.html`](apps-script/panel.html).
4. **Implementar → Nueva implementación → Aplicación web:**
   - Ejecutar como: **El usuario que accede a la aplicación web**
   - Quién tiene acceso: **Cualquier usuario con cuenta de Google**
5. Guarde la URL `/exec` y compártala con la coordinación. Para dar o quitar acceso, use el
   botón **Compartir** de la hoja: nada más.

### 4. WordPress

La línea del principio de este archivo.

---

## Cómo se reflejan los datos

Cada envío viaja en un solo POST y se reparte en tres pestañas:

| Pestaña | Una fila por | Se une con |
|---|---|---|
| `Rectores` | encuesta de rector | — |
| `Docentes` | encuesta de docente | — |
| `Estudiantes` | ficha de estudiante | `id_envio` de la pestaña `Docentes` |
| `_envios` | envío completo en JSON | uso interno del panel |

Las tres primeras son las legibles: se descargan con **Archivo → Descargar → Microsoft Excel
(.xlsx)** y ya vienen con los enunciados completos como encabezado. La pestaña `_envios` es la
que consulta el panel y no hace falta mirarla.

«Tiempo real» aquí significa que la fila aparece en la hoja en el mismo momento del envío —quien
tenga la hoja abierta la ve llegar— y que el panel se refresca cada 30 segundos.

### Si cambia una pregunta

El Apps Script no conoce las preguntas: el formulario le manda los encabezados en cada envío. Al
agregar o editar una pregunta en `modulos/preguntas.js`, la hoja agrega la columna nueva al final
por su cuenta, sin tocar el `.gs`, sin volver a implementar y sin perder lo ya registrado.

---

## Estructura

```text
formularioinnovatea/
├── index.html              Página de prueba local
├── config.js               Lo único que hay que editar (sin secretos)
├── main.js                 Controlador: el único archivo que enlaza WordPress
├── modulos/
│   ├── catalogos.js        Municipios, EPS, grados, directorio institucional
│   ├── preguntas.js        Las 74 preguntas de los dos formularios
│   ├── ui.js               Módulo 1 · renderizado e interacción
│   ├── recolector.js       Módulo 2 · lectura del DOM al enviar
│   ├── transformador.js    Módulo 3 · limpieza, validación y filas
│   ├── exportador.js       Módulo 4 · envío a Sheets, cola y respaldo CSV
│   └── panel.js            Dibujo del panel (solo lo usa el Web App privado)
├── estilos/innovatea.css   Todo acotado a #innovatea-app
├── assets/                 Imagen del banner
├── apps-script/
│   ├── Codigo.gs           Web App público · solo escritura
│   ├── Panel.gs            Web App privado · solo lectura
│   └── panel.html          Página del panel
└── wordpress/              Qué pegar en el bloque HTML
```

El flujo de un envío recorre los módulos en orden: `ui` avisa que se pulsó enviar →
`recolector` lee el DOM → `transformador` limpia, valida y arma las filas → `exportador` las
manda a la hoja. Ningún módulo llama al siguiente: los coordina `main.js`.

---

## Decisiones que conviene conocer

**Borrador local.** Lo que se va respondiendo se guarda en el navegador de quien contesta. Si se
cierra la página por accidente, al volver encuentra la encuesta como la dejó. Se borra al enviar.

**Cola de reintentos.** Si el envío falla por falta de señal, la encuesta queda guardada en el
dispositivo y sale sola la próxima vez que se abra el formulario con conexión. A quien responde
se le avisa en pantalla para que no la diligencie dos veces.

**Preguntas condicionales.** Una pregunta que se oculta después de haber sido respondida no viaja
a la hoja: el transformador descarta las respuestas de preguntas no visibles.

**Avisos de coherencia.** En el formulario de rectores, si las cifras no cuadran (más niñas y
niños autistas que diagnósticos reportados, o más estudiantes con condiciones que matrícula
total) aparece un aviso en naranja. Es un aviso, no un bloqueo: la institución puede tener
razones para esos números.

**Datos personales.** El formulario pide nombre y contacto de quien responde (con autorización
expresa, Ley 1581 de 2012) y ningún dato identificable de los estudiantes. La lista de quién ha
respondido es de uso interno y no debe incluirse en informes.

**Directorio institucional.** `INSTITUCIONES` en `modulos/catalogos.js` está vacío a la espera de
que la Secretaría entregue el listado. Mientras tanto, el campo de institución acepta escritura
libre. Cuando llegue el listado, basta con llenarlo como
`{ "Pasto": ["IE ...", "IE ..."], ... }` para que aparezcan las sugerencias por municipio.

---

## Desarrollo local

```bash
python3 -m http.server 8777
```

y abrir `http://localhost:8777`. Hace falta un servidor: los módulos de JavaScript no se cargan
desde `file://`.
