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
