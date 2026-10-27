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
<script type="module" src="https://cdn.jsdelivr.net/gh/transformaciondigital2026/formularioinnovatea@v1.3.0/main.js"></script>
```

Eso es todo. El formulario se monta justo donde esté el bloque; la etiqueta carga el
controlador y el controlador trae por su cuenta los estilos y los demás módulos. No hace falta
plugin, ni FTP, ni subir archivos al hosting.

**Para publicar un cambio:** `git tag v1.3.1 && git push origin v1.3.1`, y cambie el número en
la línea de WordPress.

> **Por qué una etiqueta y no `@main`.** jsDelivr le dice al navegador que guarde estos archivos
> durante 7 días. Con `@main`, una corrección tardaría hasta una semana en llegarle a quien ya
> hubiera abierto la página, y purgar la caché de jsDelivr limpia la del CDN pero no la del
> visitante. Con una etiqueta, cada publicación es una dirección distinta: el cambio se ve de
> inmediato y nadie se queda con la versión vieja. `@main` sirve para probar, no para producción.

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

**Qué protege al endpoint público.** Solo acepta las acciones `pedirCodigo`, `verificarCodigo` y `registrar`, solo escribe en las tres
pestañas de la lista blanca (`Rectores`, `Docentes`, `Estudiantes`), rechaza cuerpos de más de
300 000 caracteres y más de 120 filas por envío, recorta cada celda a 2 000 caracteres, frena
las ráfagas a 60 envíos por minuto y neutraliza el texto que empiece por `=`, `+`, `-` o `@`
para que Excel no lo ejecute como fórmula. No puede leer, ni modificar, ni borrar, ni tocar
otra pestaña.

**Verificación del correo.** Antes de elegir la encuesta, quien responde escribe su correo y
recibe un código de 6 dígitos que envía el propio Apps Script (`MailApp`, desde la cuenta
institucional). Quien decide es `Codigo.gs`, no el navegador:

1. Comprueba el código y entrega un **pase firmado** con el correo (HMAC con una clave que solo
   vive en las propiedades del script). Vale 72 horas: quien deja la encuesta a medias puede
   volver sin pedir otro código.
2. Al enviar, lee el correo del pase —no el que diga el navegador— y lo escribe en la columna
   `correo_verificado`. Un pase alterado o vencido se rechaza.
3. **Una encuesta por correo:** cada correo puede enviar una de rector y una de docente. La
   pestaña `_correos` lleva la cuenta; si el correo ya envió esa encuesta, su tarjeta aparece
   bloqueada desde el inicio y el servidor rechaza un segundo envío.
4. **Frenos contra abuso:** un código por correo cada minuto y máximo 5 al día; máximo 300 por
   hora en total; cada código vence a los 15 minutos y admite 5 intentos. Workspace permite unos
   1 500 correos al día.

Cualquier correo puede pedir un código: esto prueba quién respondió, no restringe quién puede
hacerlo. La pestaña `_envios` registra cómo se verificó cada envío (`correo` o `sin
verificación`) y cuántos minutos pasaron desde la verificación.

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

#### Activar la verificación por correo

1. Pegue el `Codigo.gs` nuevo y vuelva a implementar (nueva versión). Google pedirá autorizar el
   **envío de correos**: es para los códigos. Use la cuenta institucional (Workspace).
2. Publique el formulario nuevo (`VERIFICAR_CORREO: true` en `config.js`, ya viene así).
3. Cuando el formulario nuevo esté en línea, haga la verificación **obligatoria**: en el
   proyecto de `Codigo.gs`, **Configuración del proyecto** (engranaje) → **Propiedades de la
   secuencia de comandos** → **Agregar propiedad** → `EXIGIR_CORREO` = `si`, y guarde.

Mientras `EXIGIR_CORREO` no exista, el servidor también acepta envíos sin verificar (los de la
página anterior) y los marca «sin verificación». Por eso va en el paso 3 y no antes.

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
| `Estudiantes` | ficha de caracterización (estudiante con autismo) | `id_envio` de la pestaña `Docentes` |
| `_envios` | envío completo en JSON | uso interno del panel |

Las tres primeras son las legibles: se descargan con **Archivo → Descargar → Microsoft Excel
(.xlsx)** y ya vienen con los enunciados completos como encabezado. La pestaña `_envios` es la
que consulta el panel y no hace falta mirarla.

### Formato de las columnas (listo para tabular)

| Tipo de pregunta | Cómo queda en la hoja |
|---|---|
| Una sola opción | una columna con el texto de la opción |
| Número | una columna con el número, o «Información no disponible» |
| Varias opciones | **una columna por opción**, `13. ¿Pregunta? [Opción]`, con `1` si la marcó y `0` si no |
| Pregunta que no aplicaba | celda vacía (distinto de `0`, que es «aplicaba y no la marcó») |

Así se cuenta con `SUMA` o `CONTAR.SI` y se filtra directamente, sin separar textos.

**Numeración.** Rectores: 1 a 28. Docentes: 1 a 22, en el orden en que se responden. Ficha de
caracterización: F1 a F25, aparte, porque se repite una vez por estudiante con autismo.

**Reorganizar las pestañas.** Si la hoja tiene filas de versiones anteriores (respuestas
múltiples en una sola celda, numeración vieja), abra el panel y pulse **Reorganizar hojas con el
formato actual**. Rearma `Rectores`, `Docentes` y `Estudiantes` desde `_envios` con el formato de
arriba. No borra nada: las pestañas anteriores quedan renombradas como «… respaldo fecha». Hace
falta permiso de edición en la hoja y haber actualizado `Panel.gs` (paso 3) con la versión nueva.

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
│   ├── preguntas.js        Preguntas: rectores 1–28, docentes 1–22, ficha F1–F25
│   ├── reglas.js           Coherencia entre respuestas (límites y opciones)
│   ├── ui.js               Módulo 1 · renderizado e interacción
│   ├── recolector.js       Módulo 2 · lectura del DOM al enviar
│   ├── transformador.js    Módulo 3 · limpieza, validación y filas
│   ├── exportador.js       Módulo 4 · envío a Sheets, cola y respaldo CSV
│   ├── acceso.js           Verificación del correo con un código de 6 dígitos
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

**Coherencia entre respuestas.** Las reglas están en `modulos/reglas.js` y no son avisos: una
respuesta imposible (más estudiantes con autismo que matriculados, más niñas que estudiantes con
autismo, marcar «Ninguna» después de reportar casos…) muestra
el motivo en rojo y el formulario no avanza hasta corregirla. Las opciones que ya no aplican se
deshabilitan, las que se deducen de respuestas anteriores se marcan solas, y `transformador.js`
vuelve a revisar todo antes de enviar. Las cantidades pequeñas se responden con botones del 0 al
10; «11 o más» abre el campo para escribir, siempre dentro del máximo que permitan las respuestas
anteriores. Una pregunta que queda resuelta por respuestas anteriores (una sola opción posible) se
responde sola, se salta y aparece en el resumen como «automática».

**Fichas de caracterización.** Solo para estudiantes con autismo: se crean solas, una por cada
estudiante que el docente reportó, y van al final de la encuesta. Cada ficha empieza con una
pantalla «Estudiante N de M» que muestra el estado de todas y permite volver a cualquiera. Si el
docente cambia el número de estudiantes, las fichas que sobran se ocultan pero sus respuestas se
conservan.

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
