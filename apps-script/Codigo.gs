/**
 * INNOVATEA — Web App PÚBLICO. Recibe las encuestas y las escribe en la hoja.
 *
 * Este script es la única pieza expuesta a internet, y a propósito solo
 * sabe hacer tres cosas: enviar un código de verificación a un correo,
 * comprobar ese código, y AGREGAR filas a tres pestañas conocidas. No
 * devuelve respuestas, no borra, no modifica y no puede tocar ninguna otra
 * pestaña. Aunque alguien encuentre la URL —y la encontrará, porque el
 * navegador de cada persona que abre el formulario la descarga—, nunca
 * puede sacar datos.
 *
 * Para leer las respuestas está Panel.gs, que es un proyecto aparte y
 * privado.
 *
 * CÓMO INSTALARLO
 *  1. Abra la hoja Form_caracterización en Google Sheets, con la cuenta
 *     institucional (Workspace): de ella salen los correos con los códigos.
 *  2. Extensiones → Apps Script. Borre lo que haya y pegue este archivo.
 *  3. Implementar → Nueva implementación → Aplicación web:
 *       Ejecutar como:      Yo (su cuenta)
 *       Quién tiene acceso: Cualquier usuario
 *     Google pedirá autorizar el envío de correos: es para los códigos.
 *  4. Copie la URL que termina en /exec y péguela en ENDPOINT_SHEETS
 *     dentro de config.js del repositorio.
 *
 * VERIFICACIÓN POR CORREO
 *  Quien responde escribe su correo, recibe un código de 6 dígitos y lo
 *  escribe en el formulario. Este script comprueba el código y entrega un
 *  "pase" firmado con el correo, que acompaña al envío. Cada correo puede
 *  enviar UNA encuesta de rector y UNA de docente; la pestaña _correos
 *  lleva la cuenta.
 *
 *  5. Para que la verificación sea OBLIGATORIA: Configuración del proyecto
 *     (engranaje) → Propiedades de la secuencia de comandos → Agregar
 *     propiedad EXIGIR_CORREO con valor  si
 *     Póngala DESPUÉS de publicar el formulario nuevo: mientras no exista,
 *     el script acepta también envíos sin verificar (los de la versión
 *     anterior de la página), marcados "sin verificación".
 *
 *  Frenos contra abuso (alguien pidiendo códigos para correos ajenos):
 *  un código por correo cada minuto y máximo 5 al día; máximo 300 códigos
 *  por hora en total; cada código vence a los 15 minutos y admite 5
 *  intentos. Workspace permite unos 1 500 correos al día.
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
var HOJA_CORREOS = '_correos';
var TIPOS_PERMITIDOS = ['rector', 'docente'];
var MAX_CUERPO = 300000;   // caracteres del JSON recibido
var MAX_FILAS = 120;       // fichas de estudiante en un solo envío
var MAX_COLUMNAS = 400;    // con una columna por opción, Docentes llega a ~80
var MAX_TEXTO = 2000;      // caracteres por celda
var MAX_POR_MINUTO = 60;   // peticiones aceptadas por minuto en todo el servicio

var VIGENCIA_PASE_HORAS = 72;   // tiempo para terminar la encuesta (o reenviarla desde la cola)
var VIGENCIA_CODIGO_MIN = 15;
var INTENTOS_CODIGO = 5;
var ESPERA_REENVIO_SEG = 60;
var CODIGOS_POR_CORREO_DIA = 5;
var CODIGOS_POR_HORA = 300;
var REMITENTE = 'INNOVATEA · Gobernación de Nariño';

/* ===================================================================
   Entrada
   =================================================================== */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return responder({ ok: false, error: 'Envío vacío' });
    if (e.postData.contents.length > MAX_CUERPO) return responder({ ok: false, error: 'Envío demasiado grande' });
    if (!dentroDelLimite()) return responder({ ok: false, error: 'Demasiadas peticiones seguidas, intente en un minuto' });

    // El formulario envía text/plain para evitar la verificación previa de
    // CORS, que un Web App de Apps Script no sabe responder.
    var datos = JSON.parse(e.postData.contents);
    if (datos.accion === 'pedirCodigo') return responder(pedirCodigo(datos));
    if (datos.accion === 'verificarCodigo') return responder(verificarCodigo(datos));
    if (datos.accion !== 'registrar') return responder({ ok: false, error: 'Acción desconocida' });

    if (!registroValido(datos.registro)) return responder({ ok: false, error: 'Registro no válido' });
    var v = verificar(datos.verificacion || {});
    if (!v.ok) return responder({ ok: false, error: v.error });

    return responder(registrar(datos, v));
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
  return contar('envios-' + Math.floor(Date.now() / 60000), 120) <= MAX_POR_MINUTO;
}

/** Suma 1 a un contador en caché y devuelve el valor nuevo. */
function contar(llave, segundos) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(llave) || 0) + 1;
  cache.put(llave, String(n), segundos);
  return n;
}

/* ===================================================================
   Verificación por correo
   =================================================================== */

function exigirCorreo() {
  return String(PropertiesService.getScriptProperties().getProperty('EXIGIR_CORREO') || '').toLowerCase() === 'si';
}

/** Clave propia para firmar códigos y pases. Se crea sola la primera vez
    y no sale nunca de las propiedades del script. */
function secreto() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('PASE_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('PASE_SECRET', s); }
  return s;
}

function firmar(texto) {
  var bytes = Utilities.computeHmacSha256Signature(String(texto), secreto());
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function normalizarCorreo(c) {
  var s = String(c || '').trim().toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 120 ? s : '';
}

/** Llave corta para la caché: no guarda el correo en claro. */
function llaveCorreo(correo) { return firmar('c|' + correo).slice(0, 32); }

function codigoNuevo() {
  var hex = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  return ('000000' + (parseInt(hex, 16) % 1000000)).slice(-6);
}

/** Acción "pedirCodigo": envía un código de 6 dígitos al correo. */
function pedirCodigo(datos) {
  var correo = normalizarCorreo(datos.correo);
  if (!correo) return { ok: false, error: 'Escriba un correo electrónico válido.' };

  var k = llaveCorreo(correo);
  var cache = CacheService.getScriptCache();
  if (cache.get('espera-' + k)) return { ok: false, error: 'Ya le enviamos un código hace menos de un minuto. Revise su bandeja de entrada y la carpeta de spam.' };
  if (contar('dia-' + k + '-' + new Date().toISOString().slice(0, 10), 86400) > CODIGOS_POR_CORREO_DIA) {
    return { ok: false, error: 'Ya se pidieron demasiados códigos para este correo hoy. Intente mañana.' };
  }
  if (contar('hora-' + Math.floor(Date.now() / 3600000), 3700) > CODIGOS_POR_HORA) {
    return { ok: false, error: 'Hay muchas solicitudes en este momento. Intente en unos minutos.' };
  }
  if (MailApp.getRemainingDailyQuota() < 1) {
    return { ok: false, error: 'Por hoy no se pueden enviar más códigos. Intente mañana.' };
  }

  var codigo = codigoNuevo();
  cache.put('codigo-' + k, JSON.stringify({ h: firmar('k|' + correo + '|' + codigo), n: 0 }), VIGENCIA_CODIGO_MIN * 60);
  cache.put('espera-' + k, '1', ESPERA_REENVIO_SEG);

  MailApp.sendEmail({
    to: correo,
    name: REMITENTE,
    subject: 'Su código para la encuesta INNOVATEA: ' + codigo,
    body: 'Su código de verificación es ' + codigo + '.\n\nEscríbalo en el formulario para continuar. Vence en ' +
      VIGENCIA_CODIGO_MIN + ' minutos.\n\nSi usted no pidió este código, ignore este mensaje.',
    htmlBody: '<div style="font-family:Arial,sans-serif;font-size:15px;color:#17213d">' +
      '<p>Su código de verificación para la encuesta <b>INNOVATEA</b> es:</p>' +
      '<p style="font-size:30px;font-weight:bold;letter-spacing:6px;margin:16px 0">' + codigo + '</p>' +
      '<p>Escríbalo en el formulario para continuar. Vence en ' + VIGENCIA_CODIGO_MIN + ' minutos.</p>' +
      '<p style="color:#56607a;font-size:13px">Si usted no pidió este código, ignore este mensaje.</p></div>',
  });
  return { ok: true, espera: ESPERA_REENVIO_SEG, vence: VIGENCIA_CODIGO_MIN };
}

/** Acción "verificarCodigo": comprueba el código y entrega el pase. */
function verificarCodigo(datos) {
  var correo = normalizarCorreo(datos.correo);
  var codigo = String(datos.codigo || '').replace(/\D/g, '');
  if (!correo || codigo.length !== 6) return { ok: false, error: 'Escriba los 6 dígitos del código.' };

  var k = llaveCorreo(correo);
  var cache = CacheService.getScriptCache();
  var guardado = cache.get('codigo-' + k);
  if (!guardado) return { ok: false, error: 'El código venció o no existe. Pida uno nuevo.' };
  var c = JSON.parse(guardado);
  if (c.n >= INTENTOS_CODIGO) {
    cache.remove('codigo-' + k);
    return { ok: false, error: 'Demasiados intentos. Pida un código nuevo.' };
  }
  if (firmar('k|' + correo + '|' + codigo) !== c.h) {
    c.n++;
    cache.put('codigo-' + k, JSON.stringify(c), VIGENCIA_CODIGO_MIN * 60);
    var quedan = INTENTOS_CODIGO - c.n;
    return { ok: false, error: 'El código no coincide. ' + (quedan > 0 ? 'Le quedan ' + quedan + ' intento(s).' : 'Pida un código nuevo.') };
  }
  cache.remove('codigo-' + k);
  return { ok: true, pase: crearPase(correo), correo: correo, usadas: encuestasDe(correo) };
}

/** Pase = "milisegundos.correoBase64.firma": prueba que quien envía
    comprobó ese correo, y cuándo. */
function crearPase(correo) {
  var t = String(Date.now());
  var c = Utilities.base64EncodeWebSafe(correo).replace(/=+$/, '');
  return t + '.' + c + '.' + firmar('p|' + t + '|' + correo);
}

function leerPase(pase) {
  var partes = String(pase || '').split('.');
  if (partes.length !== 3 || !/^\d{10,15}$/.test(partes[0])) return null;
  var correo;
  try {
    var b = partes[1] + '==='.slice((partes[1].length + 3) % 4);
    correo = normalizarCorreo(Utilities.newBlob(Utilities.base64DecodeWebSafe(b)).getDataAsString());
  } catch (e) { return null; }
  if (!correo || firmar('p|' + partes[0] + '|' + correo) !== partes[2]) return null;
  var edad = Date.now() - Number(partes[0]);
  if (edad < 0 || edad > VIGENCIA_PASE_HORAS * 3600 * 1000) return null;
  return { correo: correo, minutos: Math.round(edad / 60000) };
}

/** Comprueba la verificación de un envío. */
function verificar(v) {
  var p = v.pase ? leerPase(v.pase) : null;
  if (p) return { ok: true, correo: p.correo, como: 'correo', minutos: p.minutos };
  if (v.pase) return { ok: false, error: 'La verificación de su correo venció. Recargue la página y verifique su correo de nuevo; sus respuestas no se pierden.' };
  if (exigirCorreo()) return { ok: false, error: 'Falta verificar su correo. Recargue la página y verifíquelo; sus respuestas no se pierden.' };
  return { ok: true, correo: '', como: 'sin verificación', minutos: '' };
}

/** Tipos de encuesta que este correo ya envió. */
function encuestasDe(correo) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_CORREOS);
  if (!hoja || hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, 2).getValues()
    .filter(function (f) { return String(f[0]) === correo; })
    .map(function (f) { return String(f[1]); });
}

/** ¿Ya se registró este envío? (un reenvío desde la cola no se duplica) */
function yaRegistrado(libro, id) {
  var hoja = libro.getSheetByName(HOJA_CORREOS);
  if (!hoja || hoja.getLastRow() < 2) return false;
  return hoja.getRange(2, 3, hoja.getLastRow() - 1, 1).getValues()
    .some(function (f) { return String(f[0]) === id; });
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

function registrar(datos, v) {
  if (!registroValido(datos.registro)) return { ok: false, error: 'Registro no válido' };

  var destinos = (datos.destinos || []).filter(destinoValido);
  if (!destinos.length) return { ok: false, error: 'No hay filas válidas que escribir' };

  var r = datos.registro;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // dos encuestas enviadas a la vez no se pisan
  try {
    var libro = SpreadsheetApp.getActiveSpreadsheet();

    // Un reenvío desde la cola de un envío que ya entró no se duplica.
    if (yaRegistrado(libro, r.id)) return { ok: true, id: r.id, repetido: true };

    // Una encuesta de cada tipo por correo verificado.
    if (v.correo && encuestasDe(v.correo).indexOf(r.tipo) !== -1) {
      return { ok: false, error: 'El correo ' + v.correo + ' ya envió una encuesta de ' + r.tipo + '. Cada correo puede enviar una sola.' };
    }

    // El correo lo pone el servidor a partir del pase: el que venga del
    // navegador no cuenta.
    r.correo_verificado = v.correo;
    destinos.forEach(function (destino) {
      var enc = destino.encabezados.map(String);
      if (enc.indexOf('correo_verificado') === -1) {
        var i = enc.indexOf('contacto');
        enc.splice(i === -1 ? enc.length : i + 1, 0, 'correo_verificado');
      }
      destino.filas.forEach(function (f) { f.correo_verificado = v.correo; });
      escribirFilas(libro, destino.hoja, enc, destino.filas);
    });

    var columnasEnvios = ['id_envio', 'enviado', 'tipo', 'json', 'verificacion', 'minutos_desde_verificacion'];
    var envios = hojaConEncabezados(libro, HOJA_ENVIOS, columnasEnvios);
    completarEncabezados(envios, columnasEnvios);
    envios.appendRow([
      r.id,
      String(r.enviado || '').slice(0, 40),
      r.tipo,
      JSON.stringify(r).slice(0, MAX_CUERPO),
      v.como,
      v.minutos,
    ]);

    if (v.correo) {
      hojaConEncabezados(libro, HOJA_CORREOS, ['correo', 'tipo', 'id_envio', 'fecha'])
        .appendRow([v.correo, r.tipo, r.id, new Date()]);
    }

    return { ok: true, id: r.id };
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

/** Hojas creadas con una versión anterior: agrega los encabezados que falten. */
function completarEncabezados(hoja, encabezados) {
  var actuales = encabezadosActuales(hoja);
  encabezados.forEach(function (h, i) {
    if (actuales.indexOf(h) === -1 && !actuales[i]) hoja.getRange(1, i + 1).setValue(h).setFontWeight('bold');
  });
}

function encabezadosActuales(hoja) {
  var ancho = hoja.getLastColumn();
  if (ancho === 0) return [];
  return hoja.getRange(1, 1, 1, ancho).getValues()[0].map(String);
}
