/* transformador.js — Módulo 3: limpieza, validación y estructura final.
   Recibe lo que leyó recolector.js y produce dos cosas:

   1) `registro`: el envío como objeto anidado, que es lo que se guarda y lo
      que lee el panel.
   2) `destinos`: el mismo envío ya aplanado en filas listas para la hoja de
      cálculo, una entrada por pestaña (Rectores, Docentes, Estudiantes).

   Las tres pestañas comparten `id_envio`, de modo que cada ficha de
   estudiante se puede volver a unir con la encuesta del docente que la
   registró. Los encabezados se derivan de preguntas.js: si mañana cambia un
   enunciado o se agrega una pregunta, la hoja se adapta sola. */

import {
  RECTORES, DOC_ID, DOC_GRUPO, DOC_ESTUDIANTE, DOC_CIERRE,
  preguntasDe, etiqueta,
} from "./preguntas.js";
import { errorDe, maxFichas, minFichas } from "./reglas.js";

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
  return preguntasDe(secciones).filter((q) => !META.has(q.id)).map((q) => q.id);
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

  const necesitaFichas = rol === "docentes" && (g.d5 === "Sí" || g.d7 === "Sí");
  if (rol === "docentes" && necesitaFichas) {
    fichas.forEach((st, i) => {
      faltantes = faltantes.concat(faltantesDe(DOC_ESTUDIANTE, st, "estudiante", i));
      errores = errores.concat(incoherenciasDe(DOC_ESTUDIANTE, st, "estudiante", i, { A: g, S: fichas, i }));
    });
  }
  const tope = necesitaFichas ? maxFichas(g) : null;

  let mensaje = "";
  if (faltantes.length) {
    mensaje = `Faltan ${faltantes.length} pregunta(s) por responder. Están marcadas en rojo.`;
  } else if (errores.length) {
    mensaje = `Hay ${errores.length} respuesta(s) que no cuadran con otras. Corríjala(s) para poder enviar.`;
  } else if (necesitaFichas && fichas.length === 0) {
    mensaje = "Agregue al menos una ficha de estudiante (secciones 2 a 4).";
  } else if (necesitaFichas && fichas.length < minFichas(g).v) {
    mensaje = `${minFichas(g).m} Lleva ${fichas.length}.`;
  } else if (tope && fichas.length > tope.v) {
    mensaje = `Tiene ${fichas.length} fichas, pero ${tope.m.charAt(0).toLowerCase() + tope.m.slice(1)} Quite las que sobran.`;
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
        estudiantes: necesitaFichas ? fichas.map((st) => soloVisibles(DOC_ESTUDIANTE, st)) : [],
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
  const comun = { id_envio: r.id, enviado: r.enviado, municipio: r.municipio, institucion: r.institucion };

  if (r.tipo === "rector") {
    const ids = columnas(RECTORES.sections);
    const f = { ...comun, nombre: r.nombre, contacto: r.contacto, cargo: r.respuestas.r3 || "" };
    ids.forEach((id) => { f[etiqueta(id)] = celda(r.respuestas[id]); });
    return [{ hoja: HOJAS.RECTORES, encabezados: Object.keys(f), filas: [f] }];
  }

  const idsDocente = columnas([DOC_ID, DOC_GRUPO, ...DOC_CIERRE]);
  const fd = { ...comun, nombre: r.nombre, contacto: r.contacto, fichas_registradas: r.estudiantes.length };
  idsDocente.forEach((id) => { fd[etiqueta(id)] = celda(r.respuestas[id]); });

  const idsEstudiante = columnas(DOC_ESTUDIANTE);
  const filasEst = r.estudiantes.map((st, i) => {
    const fe = { ...comun, ficha: i + 1, docente: r.nombre, grado_a_cargo: r.respuestas.d3 || "" };
    idsEstudiante.forEach((id) => { fe[etiqueta(id)] = celda(st[id]); });
    return fe;
  });

  const destinos = [{ hoja: HOJAS.DOCENTES, encabezados: Object.keys(fd), filas: [fd] }];
  if (filasEst.length) {
    destinos.push({ hoja: HOJAS.ESTUDIANTES, encabezados: Object.keys(filasEst[0]), filas: filasEst });
  }
  return destinos;
}
