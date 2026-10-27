/**
 * INNOVATEA — Web App PRIVADO. Panel de resultados de la coordinación.
 *
 * Va en un proyecto de Apps Script DISTINTO al de Codigo.gs. Esa
 * separación es la que hace segura toda la solución: el formulario que
 * está en internet solo puede escribir, y leer las respuestas solo se
 * puede por aquí.
 *
 * CÓMO INSTALARLO
 *  1. script.google.com → Nuevo proyecto. Llámelo "INNOVATEA — Panel".
 *  2. Pegue este archivo en Código.gs.
 *  3. Archivo → Nuevo → Archivo HTML, llámelo exactamente `panel`, y pegue
 *     el contenido de apps-script/panel.html.
 *  4. Implementar → Nueva implementación → Aplicación web:
 *       Ejecutar como:      El usuario que accede a la aplicación web
 *       Quién tiene acceso: Cualquier usuario con cuenta de Google
 *  5. Guarde la URL /exec y compártala solo con la coordinación.
 *
 * POR QUÉ ESA COMBINACIÓN ES SEGURA
 *  Al ejecutarse "como el usuario que accede", el script abre la hoja con
 *  los permisos de quien entra. Quien no esté compartido en la hoja recibe
 *  un error de permisos y no ve ni una fila. Es decir: el control de
 *  acceso al panel es el mismo de Google Sheets, que ya administra usted
 *  desde el botón Compartir. No hay ninguna clave que mantener, ni que se
 *  pueda filtrar, ni que quede escrita en el repositorio.
 *
 *  "Cualquier usuario con cuenta de Google" suena abierto, pero solo
 *  significa que Google le pide iniciar sesión antes de dejarlo pasar; lo
 *  que se puede leer lo sigue decidiendo el permiso sobre la hoja.
 */

var ID_HOJA = '1bEUL_mvQ-tdjiNnniA2eLn_5FgDSXQVSIO2N_Os8e8E';
var HOJA_ENVIOS = '_envios';

function doGet() {
  var t = HtmlService.createTemplateFromFile('panel');
  t.urlHoja = 'https://docs.google.com/spreadsheets/d/' + ID_HOJA + '/edit';
  return t.evaluate()
    .setTitle('INNOVATEA — Panel de resultados')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Devuelve todos los envíos. La llama la página con google.script.run.
 * Si quien entró no tiene acceso a la hoja, esta línea falla con error de
 * permisos y el panel muestra el aviso: así debe ser.
 */
function listarRegistros() {
  var hoja = SpreadsheetApp.openById(ID_HOJA).getSheetByName(HOJA_ENVIOS);
  if (!hoja || hoja.getLastRow() < 2) return [];

  var ancho = hoja.getLastColumn();
  var columnas = hoja.getRange(1, 1, 1, ancho).getValues()[0].map(String);
  var iJson = columnas.indexOf('json');
  if (iJson === -1) return [];

  return hoja.getRange(2, 1, hoja.getLastRow() - 1, ancho).getValues()
    .map(function (fila) {
      try { return JSON.parse(fila[iJson]); } catch (e) { return null; }
    })
    .filter(function (r) { return r; });
}

/* ===================================================================
   Reorganizar las pestañas con el formato actual
   =================================================================== */

var HOJAS_DATOS = ['Rectores', 'Docentes', 'Estudiantes'];
var MAX_COLUMNAS = 400;

/**
 * Rearma las pestañas Rectores, Docentes y Estudiantes con las filas que
 * le manda el panel (calculadas desde _envios con el formato vigente).
 *
 * No borra nada: cada pestaña actual se renombra como respaldo
 * ("Docentes respaldo 2026-10-27 15:40") y se crea una nueva. Cuando
 * haya revisado que la nueva está bien, puede borrar los respaldos.
 *
 * Solo funciona para quien tenga permiso de EDICIÓN en la hoja: el script
 * se ejecuta con la cuenta de quien abrió el panel.
 */
function reconstruirHojas(destinos) {
  if (!Array.isArray(destinos)) throw new Error('Datos no válidos');
  var libro = SpreadsheetApp.openById(ID_HOJA);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    var hechas = [];
    destinos.forEach(function (d) {
      if (HOJAS_DATOS.indexOf(d.hoja) === -1) return;
      if (!Array.isArray(d.encabezados) || !d.encabezados.length || d.encabezados.length > MAX_COLUMNAS) return;
      if (!Array.isArray(d.filas)) return;

      var vieja = libro.getSheetByName(d.hoja);
      if (vieja) vieja.setName(d.hoja + ' respaldo ' + sello);

      var hoja = libro.insertSheet(d.hoja);
      var enc = d.encabezados.map(String);
      hoja.getRange(1, 1, 1, enc.length).setValues([enc]).setFontWeight('bold');
      hoja.setFrozenRows(1);
      if (d.filas.length) {
        var matriz = d.filas.map(function (f) {
          return enc.map(function (c) { return limpiar(f[c]); });
        });
        hoja.getRange(2, 1, matriz.length, enc.length).setValues(matriz);
      }
      hechas.push(d.hoja + ' (' + d.filas.length + ' filas)');
    });
    return { ok: true, resumen: hechas.join(', ') || 'no había filas que escribir' };
  } finally {
    lock.releaseLock();
  }
}

function limpiar(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  var s = String(v).slice(0, 2000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
