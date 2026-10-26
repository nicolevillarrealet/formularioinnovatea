/* exportador.js — Módulo 4: envío a Google Sheets y descargas.
   Es el único módulo que habla con la red.

   Nota sobre CORS: un Web App de Apps Script no responde a la petición
   OPTIONS de verificación previa, así que el POST se envía como
   "text/plain" (petición simple, sin verificación previa) y el .gs lee el
   cuerpo con JSON.parse(e.postData.contents). Si se usara
   "application/json" el navegador bloquearía el envío.

   Si la red falla, el envío queda en una cola local y se reintenta la
   próxima vez que se abra el formulario: en zonas con conectividad
   intermitente esto evita perder una encuesta ya diligenciada. */

const COLA = "innovatea-pendientes";

/* =====================================================================
   Envío
   ===================================================================== */

function sobre(registro, destinos) {
  return { version: 1, accion: "registrar", registro, destinos };
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
  if (!datos.ok) throw new Error(datos.error || "El servidor rechazó el envío");
  return datos;
}

/**
 * Manda un envío a la hoja de cálculo.
 * @returns {Promise<{ok:boolean, encolado:boolean}>}
 */
export async function enviarASheets(registro, destinos, config) {
  if (!config.ENDPOINT_SHEETS) {
    throw new Error("Falta configurar ENDPOINT_SHEETS en config.js.");
  }
  const cuerpo = sobre(registro, destinos);
  try {
    await postear(config.ENDPOINT_SHEETS, cuerpo);
    return { ok: true, encolado: false };
  } catch (err) {
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
    catch (e) { quedan.push(cuerpo); }
  }
  escribirCola(quedan);
  return enviados;
}

/* =====================================================================
   Lectura para el panel
   ===================================================================== */

/** Trae todos los envíos registrados en la hoja, para el panel en vivo. */
export async function leerRespuestas(config) {
  if (!config.ENDPOINT_SHEETS) throw new Error("Falta configurar ENDPOINT_SHEETS en config.js.");
  const url = `${config.ENDPOINT_SHEETS}?accion=listar&clave=${encodeURIComponent(config.CLAVE_PANEL || "")}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const datos = await res.json();
  if (!datos.ok) throw new Error(datos.error || "No se pudieron leer las respuestas");
  return datos.registros || [];
}

/** URL de la hoja de cálculo, para el botón "Abrir en Google Sheets". */
export function urlDeLaHoja(config) {
  return config.ID_HOJA ? `https://docs.google.com/spreadsheets/d/${config.ID_HOJA}/edit` : "";
}

/* =====================================================================
   Descarga de respaldo (CSV)
   ===================================================================== */

/** Respaldo local en CSV de todo lo que se ve en el panel.
    El Excel de trabajo es la hoja de Google; esto es solo una copia. */
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
