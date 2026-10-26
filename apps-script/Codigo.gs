/**
 * INNOVATEA — Web App PÚBLICO. Recibe las encuestas y las escribe en la hoja.
 *
 * Este script es la única pieza expuesta a internet, y a propósito solo
 * sabe hacer una cosa: AGREGAR filas a tres pestañas conocidas. No lee
 * respuestas, no borra, no modifica y no puede tocar ninguna otra pestaña.
 * Aunque alguien encuentre la URL —y la encontrará, porque el navegador de
 * cada persona que abre el formulario la descarga—, lo peor que puede
 * hacer es mandar encuestas falsas, que se borran de la hoja. Nunca puede
 * sacar datos.
 *
 * Para leer las respuestas está Panel.gs, que es un proyecto aparte y
 * privado.
 *
 * CÓMO INSTALARLO
 *  1. Abra la hoja Form_caracterización en Google Sheets.
 *  2. Extensiones → Apps Script. Borre lo que haya y pegue este archivo.
 *  3. Implementar → Nueva implementación → Aplicación web:
 *       Ejecutar como:      Yo (su cuenta)
 *       Quién tiene acceso: Cualquier usuario
 *  4. Copie la URL que termina en /exec y péguela en ENDPOINT_SHEETS
 *     dentro de config.js del repositorio.
 *
 * Cada vez que cambie este archivo hay que volver a implementar
 * (Implementar → Administrar implementaciones → editar → Nueva versión),
 * o la URL seguirá sirviendo el código viejo.
 *
 * DISEÑO
 *  El script no conoce las preguntas: el formulario le manda, en cada
 *  envío, los encabezados y las filas ya armadas. Aquí solo se verifica
 *  que la pestaña sea una de las permitidas, se crean las columnas que
 *  falten y se escribe. Así, agregar una pregunta en preguntas.js no
 *  obliga a tocar ni a volver a implementar este código.
 */

/* ---- Límites. Nada de lo que llegue de fuera puede pasarse de aquí. ---- */
var HOJAS_PERMITIDAS = ['Rectores', 'Docentes', 'Estudiantes'];
var HOJA_ENVIOS = '_envios';
var TIPOS_PERMITIDOS = ['rector', 'docente'];
var MAX_CUERPO = 300000;   // caracteres del JSON recibido
var MAX_FILAS = 120;       // fichas de estudiante en un solo envío
var MAX_COLUMNAS = 300;
var MAX_TEXTO = 2000;      // caracteres por celda
var MAX_POR_MINUTO = 60;   // envíos aceptados por minuto en todo el servicio

/* ===================================================================
   Entrada
   =================================================================== */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return responder({ ok: false, error: 'Envío vacío' });
    if (e.postData.contents.length > MAX_CUERPO) return responder({ ok: false, error: 'Envío demasiado grande' });
    if (!dentroDelLimite()) return responder({ ok: false, error: 'Demasiados envíos seguidos, intente en un minuto' });

    // El formulario envía text/plain para evitar la verificación previa de
    // CORS, que un Web App de Apps Script no sabe responder.
    var datos = JSON.parse(e.postData.contents);
    if (datos.accion !== 'registrar') return responder({ ok: false, error: 'Acción desconocida' });

    return responder(registrar(datos));
  } catch (err) {
    return responder({ ok: false, error: String(err) });
  }
}

/** Este Web App no entrega datos. Un GET solo sirve para comprobar que vive. */
function doGet() {
  return responder({ ok: true, servicio: 'INNOVATEA', estado: 'activo' });
}

function responder(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Freno de ráfagas: no distingue quién envía, pero evita que un script
    suelto llene la hoja en segundos. */
function dentroDelLimite() {
  var cache = CacheService.getScriptCache();
  var llave = 'envios-' + Math.floor(Date.now() / 60000);
  var n = Number(cache.get(llave) || 0) + 1;
  cache.put(llave, String(n), 120);
  return n <= MAX_POR_MINUTO;
}

/* ===================================================================
   Validación de lo que llega
   =================================================================== */

function limpiarValor(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return isFinite(v) ? v : '';
  if (typeof v === 'boolean') return v;
  var s = String(v).slice(0, MAX_TEXTO);
  // Una celda que empieza por =, +, - o @ la interpreta Excel como fórmula.
  // Se le antepone un apóstrofo para que siempre se lea como texto.
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function destinoValido(destino) {
  return destino
    && HOJAS_PERMITIDAS.indexOf(destino.hoja) !== -1
    && Array.isArray(destino.encabezados) && destino.encabezados.length > 0
    && destino.encabezados.length <= MAX_COLUMNAS
    && Array.isArray(destino.filas) && destino.filas.length > 0
    && destino.filas.length <= MAX_FILAS;
}

function registroValido(r) {
  return r && typeof r === 'object'
    && typeof r.id === 'string' && r.id.length <= 80
    && TIPOS_PERMITIDOS.indexOf(r.tipo) !== -1;
}

/* ===================================================================
   Escritura
   =================================================================== */

function registrar(datos) {
  if (!registroValido(datos.registro)) return { ok: false, error: 'Registro no válido' };

  var destinos = (datos.destinos || []).filter(destinoValido);
  if (!destinos.length) return { ok: false, error: 'No hay filas válidas que escribir' };

  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // dos encuestas enviadas a la vez no se pisan
  try {
    var libro = SpreadsheetApp.getActiveSpreadsheet();

    destinos.forEach(function (destino) {
      escribirFilas(libro, destino.hoja, destino.encabezados.map(String), destino.filas);
    });

    var envios = hojaConEncabezados(libro, HOJA_ENVIOS, ['id_envio', 'enviado', 'tipo', 'json']);
    envios.appendRow([
      datos.registro.id,
      String(datos.registro.enviado || '').slice(0, 40),
      datos.registro.tipo,
      JSON.stringify(datos.registro).slice(0, MAX_CUERPO),
    ]);

    return { ok: true, id: datos.registro.id };
  } finally {
    lock.releaseLock();
  }
}

function escribirFilas(libro, nombre, encabezados, filas) {
  var hoja = hojaConEncabezados(libro, nombre, encabezados);
  var actuales = encabezadosActuales(hoja);

  // Si el formulario trae columnas que la hoja todavía no tiene, se agregan
  // al final en lugar de reordenar lo que ya hay escrito.
  var nuevas = encabezados.filter(function (h) { return actuales.indexOf(h) === -1; });
  if (nuevas.length && actuales.length + nuevas.length <= MAX_COLUMNAS) {
    hoja.getRange(1, actuales.length + 1, 1, nuevas.length).setValues([nuevas]);
    actuales = actuales.concat(nuevas);
  }

  var matriz = filas.map(function (fila) {
    return actuales.map(function (col) { return limpiarValor(fila[col]); });
  });
  hoja.getRange(hoja.getLastRow() + 1, 1, matriz.length, actuales.length).setValues(matriz);
}

function hojaConEncabezados(libro, nombre, encabezados) {
  var hoja = libro.getSheetByName(nombre);
  if (!hoja) hoja = libro.insertSheet(nombre);
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
    hoja.setFrozenRows(1);
    hoja.getRange(1, 1, 1, encabezados.length).setFontWeight('bold');
  }
  return hoja;
}

function encabezadosActuales(hoja) {
  var ancho = hoja.getLastColumn();
  if (ancho === 0) return [];
  return hoja.getRange(1, 1, 1, ancho).getValues()[0].map(String);
}
