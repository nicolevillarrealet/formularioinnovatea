/* transformador.js — Módulo 3: limpieza, validación y estructura final.
   Recibe lo que leyó recolector.js y produce dos cosas:

   1) `registro`: el envío como objeto anidado, que es lo que se guarda y lo
      que lee el panel.
   2) `destinos`: el mismo envío ya aplanado en filas listas para la hoja de
      cálculo, una entrada por pestaña (Rectores, Docentes, Estudiantes).

   Las tres pestañas comparten `id_envio`, de modo que cada ficha de
   estudiante se puede volver a unir con la encuesta del docente que la
   registró. Los encabezados se derivan de preguntas.js: si mañana cambia un
   enunciado o se agrega una pregunta, la hoja se adapta sola.

   FORMATO PARA TABULAR SIN LIMPIEZA
   - Una sola opción: una columna con el texto de la opción.
   - Números: una columna con el número (o "Información no disponible").
   - Varias opciones: UNA COLUMNA POR OPCIÓN, con encabezado
     "13. ¿Pregunta? [Opción]" y valor 1 si la marcó o 0 si no. Así se
     cuenta con SUMA o se filtra directamente, sin separar textos.
   - Celda vacía: la pregunta no aplicaba (se ocultó por una respuesta
     anterior). Es distinto de 0, que significa "aplicaba y no la marcó". */

import {
  RECTORES, DOC_ID, DOC_GRUPO, DOC_ESTUDIANTE, DOC_CIERRE,
  preguntasDe, etiqueta,
} from "./preguntas.js";
import { errorDe, numFichas } from "./reglas.js";

export const HOJAS = { RECTORES: "Rectores", DOCENTES: "Docentes", ESTUDIANTES: "Estudiantes" };

/* Preguntas que ya viajan como metadatos y no se repiten como columna. */
const META = new Set(["rn", "rc", "dn", "dc"]);

const visible = (q, store) => !q.show || q.show(store);
const vacio = (v) => v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/** Celda para hoja de cálculo: los números siguen siendo números. */
function celda(v) {
  if (v === undefined) return "";
  if (Array.isArray(v)) return v.join("; ");
  return v;
}

function identificador() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "env-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/* =====================================================================
   Validación
   ===================================================================== */

function faltantesDe(secciones, store, ambito, indice) {
  return preguntasDe(secciones)
    .filter((q) => !q.opt && visible(q, store) && vacio(store[q.id]))
    .map((q) => ({ id: q.id, ambito, indice, pregunta: `${q.n}. ${q.l}` }));
}

/** Respuestas que no cuadran con otras (reglas.js). El formulario ya no
    deja avanzar con ellas; esto es la última barrera antes de enviar, por
    si llegan de un borrador viejo o de alguien que salte la interfaz. */
function incoherenciasDe(secciones, store, ambito, indice, ctx) {
  return preguntasDe(secciones)
    .filter((q) => visible(q, store))
    .map((q) => ({ q, m: errorDe(q, store, ctx) }))
    .filter((x) => x.m)
    .map(({ q, m }) => ({ id: q.id, ambito, indice, pregunta: `${q.n}. ${q.l}`, error: m }));
}

/* =====================================================================
   Limpieza
   ===================================================================== */

/** Deja solo las respuestas de preguntas visibles; descarta restos de
    preguntas que se ocultaron después de haber sido respondidas. */
function soloVisibles(secciones, store) {
  const salida = {};
  preguntasDe(secciones).forEach((q) => {
    if (META.has(q.id)) return;
    if (!visible(q, store)) return;
    if (vacio(store[q.id])) return;
    salida[q.id] = store[q.id];
  });
  return salida;
}

/* =====================================================================
   Aplanado a filas
   ===================================================================== */

function columnas(secciones) {
  return preguntasDe(secciones).filter((q) => !META.has(q.id));
}

/** Encabezado de la columna de una opción en una pregunta de varias. */
export const etiquetaOpcion = (q, o) => `${etiqueta(q.id)} [${o}]`;

/** Escribe en la fila `f` las columnas de una pregunta: una sola, o una
    por opción (1/0) si es de varias respuestas. */
function ponerColumnas(f, q, valor) {
  if (q.t !== "multi") { f[etiqueta(q.id)] = celda(valor); return; }
  const marcadas = Array.isArray(valor) ? valor : null;
  q.o.forEach((o) => { f[etiquetaOpcion(q, o)] = marcadas ? (marcadas.includes(o) ? 1 : 0) : ""; });
}

/* =====================================================================
   API
   ===================================================================== */

/**
 * @param {{general:Object, estudiantes:Array}} crudos  salida de recolector.js
 * @param {"rectores"|"docentes"} rol
 * @returns {{ok:boolean, faltantes:Array, avisos:Array, mensaje:string,
 *            registro:Object, destinos:Array}}
 */
export function limpiarDatos(crudos, rol) {
  const g = crudos.general || {};
  const fichas = crudos.estudiantes || [];
  const avisos = [];
  let faltantes = [];

  let errores = [];
  const general = { A: g, S: fichas, i: null };
  if (rol === "rectores") {
    faltantes = faltantesDe(RECTORES.sections, g, "general", null);
    errores = incoherenciasDe(RECTORES.sections, g, "general", null, general);
  } else {
    const secciones = [DOC_ID, DOC_GRUPO, ...DOC_CIERRE];
    faltantes = faltantesDe(secciones, g, "general", null);
    errores = incoherenciasDe(secciones, g, "general", null, general);
  }

  // Fichas: solo de estudiantes con autismo, exactamente una por cada uno.
  const esperadas = rol === "docentes" ? numFichas(g) : 0;
  const necesitaFichas = esperadas > 0;
  if (necesitaFichas) {
    fichas.slice(0, esperadas).forEach((st, i) => {
      faltantes = faltantes.concat(faltantesDe(DOC_ESTUDIANTE, st, "estudiante", i));
      errores = errores.concat(incoherenciasDe(DOC_ESTUDIANTE, st, "estudiante", i, { A: g, S: fichas, i }));
    });
  }

  let mensaje = "";
  if (faltantes.length) {
    mensaje = `Faltan ${faltantes.length} pregunta(s) por responder. Están marcadas en rojo.`;
  } else if (errores.length) {
    mensaje = `Hay ${errores.length} respuesta(s) que no cuadran con otras. Corríjala(s) para poder enviar.`;
  } else if (necesitaFichas && fichas.length < esperadas) {
    mensaje = `Reportó ${esperadas} estudiante(s) con autismo y hay ${fichas.length} ficha(s). Complete las que faltan.`;
  }
  faltantes = faltantes.concat(errores);

  if (mensaje) return { ok: false, faltantes, avisos, mensaje, registro: null, destinos: [] };

  /* ---- Registro anidado ---- */
  const id = identificador();
  const enviado = new Date().toISOString();
  const registro = rol === "rectores"
    ? {
        id, enviado, tipo: "rector",
        nombre: g.rn || "", contacto: g.rc || "",
        municipio: g.r1 || "", institucion: g.r2 || "",
        respuestas: soloVisibles(RECTORES.sections, g),
        estudiantes: [],
      }
    : {
        id, enviado, tipo: "docente",
        nombre: g.dn || "", contacto: g.dc || "",
        municipio: g.d1 || "", institucion: g.d2 || "",
        respuestas: soloVisibles([DOC_ID, DOC_GRUPO, ...DOC_CIERRE], g),
        estudiantes: fichas.slice(0, esperadas).map((st) => soloVisibles(DOC_ESTUDIANTE, st)),
      };

  return { ok: true, faltantes: [], avisos, mensaje: "", registro, destinos: aFilas(registro) };
}

/**
 * Convierte un registro en las filas de cada pestaña de la hoja de cálculo.
 * Es la misma función que usa el panel para rearmar el Excel completo, así
 * que una respuesta recién enviada y una descargada producen idénticas columnas.
 */
export function aFilas(registro) {
  const r = registro;
  const comun = { id_envio: r.id, enviado: r.enviado, municipio: r.municipio, institucion: r.institucion,
    correo_verificado: r.correo_verificado || "" };

  if (r.tipo === "rector") {
    const f = { ...comun, nombre: r.nombre, contacto: r.contacto, cargo: r.respuestas.r3 || "" };
    columnas(RECTORES.sections).forEach((q) => ponerColumnas(f, q, r.respuestas[q.id]));
    return [{ hoja: HOJAS.RECTORES, encabezados: Object.keys(f), filas: [f] }];
  }

  const fd = { ...comun, nombre: r.nombre, contacto: r.contacto, fichas_registradas: r.estudiantes.length };
  columnas([DOC_ID, DOC_GRUPO, ...DOC_CIERRE]).forEach((q) => ponerColumnas(fd, q, r.respuestas[q.id]));

  const pregEst = columnas(DOC_ESTUDIANTE);
  const filasEst = r.estudiantes.map((st, i) => {
    const fe = { ...comun, ficha: i + 1, docente: r.nombre, grado_a_cargo: r.respuestas.d3 || "" };
    pregEst.forEach((q) => ponerColumnas(fe, q, st[q.id]));
    return fe;
  });

  const destinos = [{ hoja: HOJAS.DOCENTES, encabezados: Object.keys(fd), filas: [fd] }];
  if (filasEst.length) {
    destinos.push({ hoja: HOJAS.ESTUDIANTES, encabezados: Object.keys(filasEst[0]), filas: filasEst });
  }
  return destinos;
}
