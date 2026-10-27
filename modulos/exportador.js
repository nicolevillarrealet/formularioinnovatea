/* exportador.js — Módulo 4: envío a Google Sheets y descargas.
   Es el único módulo del formulario que habla con la red, y solo escribe:
   nunca pide datos de vuelta. Leer las respuestas es tarea del panel, que
   vive en un Web App privado y pasa por la cuenta de Google.

   Nota sobre CORS: un Web App de Apps Script no responde a la petición
   OPTIONS de verificación previa, así que el POST se envía como
   "text/plain" (petición simple, sin verificación previa) y el .gs lee el
   cuerpo con JSON.parse(e.postData.contents). Si se usara
   "application/json" el navegador bloquearía el envío.

   Si la red falla, el envío queda en una cola local y se reintenta la
   próxima vez que se abra el formulario: en zonas con conectividad
   intermitente esto evita perder una encuesta ya diligenciada.

   Si en cambio el SERVIDOR rechaza el envío (por ejemplo, el correo ya
   envió esa encuesta), no se encola: se avisa a quien responde.

   Cada envío lleva `verificacion.pase`: el que Codigo.gs entregó al
   comprobar el código que llegó al correo de quien responde. */

const COLA = "innovatea-pendientes";

/* =====================================================================
   Envío
   ===================================================================== */

function sobre(registro, destinos, verificacion) {
  return { version: 1, accion: "registrar", registro, destinos, verificacion: verificacion || {} };
}

/** Error que viene del servidor (no de la red): no se reintenta solo. */
class Rechazo extends Error {
  constructor(m) { super(m); this.rechazo = true; }
}

async function postear(endpoint, cuerpo) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(cuerpo),
    redirect: "follow",
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const texto = await res.text();
  let datos;
  try { datos = JSON.parse(texto); } catch (e) { throw new Error("Respuesta no válida del servidor"); }
  if (!datos.ok) throw new Rechazo(datos.error || "El servidor rechazó el envío");
  return datos;
}

/* ---------- Verificación por correo ---------- */

function exigirEndpoint(config) {
  if (!config.ENDPOINT_SHEETS) throw new Error("Falta configurar ENDPOINT_SHEETS en config.js.");
}

/** Pide a Codigo.gs que envíe un código de 6 dígitos al correo. */
export async function pedirCodigo(correo, config) {
  exigirEndpoint(config);
  return postear(config.ENDPOINT_SHEETS, { version: 1, accion: "pedirCodigo", correo });
}

/** Comprueba el código. Devuelve { pase, correo, usadas }. */
export async function verificarCodigo(correo, codigo, config) {
  exigirEndpoint(config);
  return postear(config.ENDPOINT_SHEETS, { version: 1, accion: "verificarCodigo", correo, codigo });
}

/**
 * Manda un envío a la hoja de cálculo.
 * @returns {Promise<{ok:boolean, encolado:boolean}>}
 */
export async function enviarASheets(registro, destinos, config, verificacion) {
  if (!config.ENDPOINT_SHEETS) {
    throw new Error("Falta configurar ENDPOINT_SHEETS en config.js.");
  }
  const cuerpo = sobre(registro, destinos, verificacion);
  try {
    await postear(config.ENDPOINT_SHEETS, cuerpo);
    return { ok: true, encolado: false };
  } catch (err) {
    if (err.rechazo) throw err; // el servidor dijo que no: no se reintenta solo
    encolar(cuerpo);
    return { ok: false, encolado: true, error: err.message };
  }
}

/* =====================================================================
   Cola local de reintentos
   ===================================================================== */

function leerCola() {
  try { return JSON.parse(localStorage.getItem(COLA) || "[]"); } catch (e) { return []; }
}
function escribirCola(lista) {
  try { localStorage.setItem(COLA, JSON.stringify(lista)); } catch (e) { /* modo privado */ }
}
function encolar(cuerpo) {
  const lista = leerCola();
  lista.push(cuerpo);
  escribirCola(lista);
}

export const pendientes = () => leerCola().length;

/** Reintenta los envíos que quedaron en cola. Devuelve cuántos salieron. */
export async function reintentarPendientes(config) {
  if (!config.ENDPOINT_SHEETS) return 0;
  const lista = leerCola();
  if (!lista.length) return 0;

  const quedan = [];
  let enviados = 0;
  for (const cuerpo of lista) {
    try { await postear(config.ENDPOINT_SHEETS, cuerpo); enviados++; }
    catch (e) { if (!e.rechazo) quedan.push(cuerpo); }
  }
  escribirCola(quedan);
  return enviados;
}

/* =====================================================================
   Descarga de respaldo (CSV)
   ===================================================================== */

/** Respaldo local en CSV de todo lo que se ve en el panel.
    El Excel de trabajo es la hoja de Google; esto es solo una copia.
    Lo usa la página del panel, no el formulario público. */
export function descargarCsv(filas, nombreArchivo) {
  if (!filas.length) return;
  const columnas = [...new Set(filas.flatMap((f) => Object.keys(f)))];
  const celda = (v) => {
    const s = Array.isArray(v) ? v.join("; ") : (v ?? "");
    return /[",\n;]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + [columnas.join(","), ...filas.map((f) => columnas.map((c) => celda(f[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = nombreArchivo;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
