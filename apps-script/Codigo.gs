/**
 * INNOVATEA — Web App que recibe las encuestas y las escribe en la hoja.
 *
 * CÓMO INSTALARLO
 *  1. Abra la hoja Form_caracterización en Google Sheets.
 *  2. Extensiones → Apps Script. Borre el contenido y pegue este archivo.
 *  3. (Opcional) Configuración del proyecto → Propiedades del script →
 *     agregue CLAVE_PANEL con la misma clave que puso en config.js.
 *  4. Implementar → Nueva implementación → Aplicación web:
 *       Ejecutar como:      Yo (su cuenta)
 *       Quién tiene acceso: Cualquier usuario
 *  5. Copie la URL que termina en /exec y péguela en ENDPOINT_SHEETS
 *     dentro de config.js del repositorio.
 *
 * Cada vez que cambie este archivo hay que volver a implementar
 * (Implementar → Administrar implementaciones → editar → Nueva versión),
 * o la URL seguirá sirviendo el código viejo.
 *
 * DISEÑO
 *  El script no conoce las preguntas. El formulario le manda, en cada
 *  envío, los encabezados y las filas ya armadas; aquí solo se crean las
 *  pestañas que falten, se agregan columnas nuevas al final si aparecen, y
 *  se escribe cada fila bajo el encabezado que le corresponde. Así, cuando
 *  se agregue o se cambie una pregunta en preguntas.js, la hoja se adapta
 *  sin tocar este código.
 *
 *  La pestaña _envios guarda cada encuesta completa en JSON. Es la que lee
 *  el panel de resultados; las otras tres pestañas son las legibles y las
 *  que se descargan como Excel.
 */

var HOJA_ENVIOS = '_envios';

/* ===================================================================
   Entrada
   =================================================================== */

function doPost(e) {
  try {
    // El formulario envía text/plain para evitar la verificación previa
    // de CORS, que un Web App de Apps Script no sabe responder.
    var datos = JSON.parse(e.postData.contents);
    if (datos.accion !== 'registrar') return responder({ ok: false, error: 'Acción desconocida' });
    return responder(registrar(datos));
  } catch (err) {
    return responder({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.accion === 'listar') {
      if (!claveValida(p.clave)) return responder({ ok: false, error: 'Clave incorrecta' });
      return responder({ ok: true, registros: listar() });
    }
    return responder({ ok: true, servicio: 'INNOVATEA', estado: 'activo' });
  } catch (err) {
    return responder({ ok: false, error: String(err) });
  }
}

function responder(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

function claveValida(dada) {
  var esperada = PropertiesService.getScriptProperties().getProperty('CLAVE_PANEL');
  if (!esperada) return true; // sin clave configurada, la lectura queda abierta
  return String(dada || '') === esperada;
}

/* ===================================================================
   Escritura
   =================================================================== */

function registrar(datos) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // dos encuestas enviadas a la vez no se pisan
  try {
    var libro = SpreadsheetApp.getActiveSpreadsheet();

    (datos.destinos || []).forEach(function (destino) {
      escribirFilas(libro, destino.hoja, destino.encabezados, destino.filas);
    });

    if (datos.registro) {
      var envios = hojaConEncabezados(libro, HOJA_ENVIOS, ['id_envio', 'enviado', 'tipo', 'json']);
      envios.appendRow([
        datos.registro.id,
        datos.registro.enviado,
        datos.registro.tipo,
        JSON.stringify(datos.registro),
      ]);
    }

    return { ok: true, id: datos.registro ? datos.registro.id : null };
  } finally {
    lock.releaseLock();
  }
}

function escribirFilas(libro, nombre, encabezados, filas) {
  if (!nombre || !filas || !filas.length) return;
  var hoja = hojaConEncabezados(libro, nombre, encabezados);
  var actuales = encabezadosActuales(hoja);

  // Si el formulario trae columnas que la hoja todavía no tiene, se agregan
  // al final en lugar de reordenar lo que ya hay escrito.
  var nuevas = encabezados.filter(function (h) { return actuales.indexOf(h) === -1; });
  if (nuevas.length) {
    hoja.getRange(1, actuales.length + 1, 1, nuevas.length).setValues([nuevas]);
    actuales = actuales.concat(nuevas);
  }

  var matriz = filas.map(function (fila) {
    return actuales.map(function (col) {
      var v = fila[col];
      return v === undefined || v === null ? '' : v;
    });
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

/* ===================================================================
   Lectura para el panel
   =================================================================== */

function listar() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_ENVIOS);
  if (!hoja || hoja.getLastRow() < 2) return [];
  var columnas = encabezadosActuales(hoja);
  var iJson = columnas.indexOf('json');
  if (iJson === -1) return [];

  return hoja.getRange(2, 1, hoja.getLastRow() - 1, columnas.length).getValues()
    .map(function (fila) {
      try { return JSON.parse(fila[iJson]); } catch (e) { return null; }
    })
    .filter(function (r) { return r; });
}
