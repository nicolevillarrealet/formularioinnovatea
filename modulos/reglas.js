/* reglas.js — Coherencia entre respuestas.

   Aquí viven, en un solo lugar, las reglas que impiden respuestas
   imposibles: más niñas con autismo que estudiantes con autismo, más casos
   que matriculados, marcar "Ninguna condición" después de reportar casos,
   etc. No son avisos opcionales: mientras una regla no se cumpla, el
   formulario no deja pasar a la siguiente pregunta, y transformador.js
   vuelve a revisarlas antes de enviar.

   Cada regla recibe (s, c):
     s  las respuestas del ámbito de la pregunta: las generales, o las de
        una ficha de estudiante
     c  { A, S, i }  respuestas generales, todas las fichas y el índice de
        la ficha (null si la pregunta es general)

   Tipos de regla por pregunta:
     min, max  números. Devuelven { v, m }: el límite y el mensaje que se
               muestra si se cruza. null = sin límite.
     chips     números pequeños: se responden con botones del mínimo al 10
               y "11 o más" abre el campo para escribir.
     maxSel    selección múltiple: cuántas opciones se pueden marcar.
     opc       opciones de una pregunta de selección que se marcan solas
               (forzar) o se deshabilitan (vetar) según respuestas previas.
     regla     cualquier otra condición; devuelve el mensaje o null. */

import { GRADOS } from "./catalogos.js";
import { INDICE } from "./preguntas.js";

const NA = "Información no disponible";
const n = (a, k) => { const v = Number(a?.[k]); return Number.isFinite(v) ? v : 0; };
const si = (a, k) => a?.[k] === "Sí";
/* Número visible de una pregunta. Los mensajes lo toman de preguntas.js,
   así que si se renumera el instrumento los mensajes siguen correctos. */
const P = (id) => INDICE[id]?.n;

/** Celular colombiano: 10 dígitos que empiezan por 3. */
const celularMalo = (v) => v && !/^3\d{9}$/.test(String(v))
  ? "Escriba un celular de 10 dígitos que empiece por 3, o deje el campo vacío."
  : null;

/* ---------- Rectores ---------- */

const autismoRector = (a) => n(a, "r7") + n(a, "r8");
const deMatricula = (a) => ({
  v: n(a, "r5"),
  m: `No puede ser mayor que la matrícula de básica primaria (pregunta ${P("r5")}): ${n(a, "r5")}.`,
});
const OTRAS_R15 = ["Discapacidad intelectual", "Trastornos del lenguaje o comunicación",
  "Trastornos del aprendizaje", "Tics o Tourette", "Otras"];

/* ---------- Docentes ---------- */

/* Equivalencias entre las opciones de la pregunta de condiciones del
   grupo (d8) y las de la ficha (e23), que están redactadas distinto. */
const D8_A_E23 = {
  "TDAH": "TDAH",
  "Discapacidad intelectual": "Discapacidad intelectual",
  "Trastornos del aprendizaje": "Trastornos específicos del aprendizaje",
  "Trastornos del lenguaje": "Trastornos del lenguaje o comunicación",
  "Tics o Tourette": "Tics o Tourette",
  "Otras": "Otra",
};
const E23 = ["Autismo", "TDAH", "Discapacidad intelectual", "Trastornos del lenguaje o comunicación",
  "Trastornos específicos del aprendizaje", "Tics o Tourette", "Otra", "Ninguna"];

/** Condiciones que se pueden marcar en una ficha. La ficha es solo para
    estudiantes con autismo, así que "Autismo" va siempre; las demás solo
    si el docente reportó esas condiciones en su grupo (d7, d8), porque
    pueden presentarse a la vez que el autismo. */
function permitidasEnFicha(c) {
  const A = c.A;
  const p = new Set(["Autismo"]);
  if (si(A, "d7")) (A.d8?.length ? A.d8 : Object.keys(D8_A_E23)).forEach((o) => p.add(D8_A_E23[o]));
  else if (A.d7 === "No sabe") Object.values(D8_A_E23).forEach((o) => p.add(o));
  return p;
}

/* =====================================================================
   Reglas por pregunta
   ===================================================================== */

const R = {
  /* --- Contacto (opcional, pero si se escribe debe ser un celular) --- */
  rc: { regla: (s) => celularMalo(s.rc) },
  dc: { regla: (s) => celularMalo(s.dc) },

  /* --- Rectores --- */
  r5: { min: () => ({ v: 1, m: "Escriba al menos 1: es la matrícula de básica primaria de la institución." }) },
  r7: { chips: true, max: deMatricula },
  r8: {
    chips: true,
    max: (a) => {
      const v = Math.max(0, n(a, "r5") - n(a, "r7"));
      return { v, m: `Con ${n(a, "r5")} matriculados y ${n(a, "r7")} ya contados en la pregunta ${P("r7")}, aquí el máximo es ${v}.` };
    },
    min: (a) => si(a, "r6") && n(a, "r7") === 0
      ? { v: 1, m: `En la pregunta ${P("r6")} respondió que sí hay estudiantes con autismo y en la ${P("r7")} escribió 0: aquí debe haber al menos 1.` }
      : null,
  },
  r9: { chips: true, max: deMatricula },
  r10: { chips: true, max: deMatricula },
  r11: {
    chips: true,
    max: (a) => ({ v: autismoRector(a), m: `No puede ser mayor que el total de estudiantes con autismo (preguntas ${P("r7")} y ${P("r8")}): ${autismoRector(a)}.` }),
  },
  r12: {
    chips: true,
    max: (a) => {
      const v = Math.max(0, autismoRector(a) - n(a, "r11"));
      return { v, m: `Con ${autismoRector(a)} estudiante(s) con autismo y ${n(a, "r11")} de sexo femenino (pregunta ${P("r11")}), aquí el máximo es ${v}.` };
    },
  },
  r13: {
    maxSel: (a) => ({ v: autismoRector(a), m: `Con ${autismoRector(a)} estudiante(s) con autismo no se pueden marcar más de ${autismoRector(a)} grupo(s) de edad.` }),
  },
  r14: {
    maxSel: (a) => ({ v: autismoRector(a), m: `Con ${autismoRector(a)} estudiante(s) con autismo no se pueden marcar más de ${autismoRector(a)} grado(s).` }),
  },
  r15: {
    opc: (a) => {
      const forzar = [], vetar = [];
      if (si(a, "r6")) forzar.push("Autismo");
      else if (a.r6 === "No") vetar.push("Autismo");
      if (n(a, "r9") > 0) forzar.push("TDAH");
      if (si(a, "r6") || n(a, "r9") > 0 || n(a, "r10") > 0) vetar.push("Ninguna");
      return { forzar, vetar };
    },
    regla: (a) => n(a, "r10") > 0 && !(a.r15 || []).some((o) => OTRAS_R15.includes(o))
      ? `En la pregunta ${P("r10")} reportó ${n(a, "r10")} estudiante(s) con otras condiciones: marque cuál o cuáles.`
      : null,
  },
  r16: { chips: true, max: deMatricula },
  r17: { chips: true, max: deMatricula },
  r21: {
    // "Personal de apoyo" = docentes de apoyo (19) u orientador (20).
    opc: (a) => {
      if (a.r19 === "No" && a.r20 === "No") return { forzar: ["No cuenta"], vetar: ["Tiempo completo", "Medio tiempo", "Algunos días"] };
      if (si(a, "r19") || si(a, "r20")) return { forzar: [], vetar: ["No cuenta"] };
      return null;
    },
  },

  /* --- Docentes --- */
  d4: { min: () => ({ v: 1, m: "Escriba al menos 1: es el número de estudiantes que tiene a cargo." }) },
  d6: {
    chips: true,
    max: (a) => ({ v: n(a, "d4"), m: `No puede ser mayor que los estudiantes a su cargo (pregunta ${P("d4")}): ${n(a, "d4")}.` }),
    min: (a) => si(a, "d5") ? { v: 1, m: `En la pregunta ${P("d5")} respondió que sí tiene estudiantes con autismo: debe ser al menos 1.` } : null,
  },
  d34: {
    chips: true,
    min: (a) => si(a, "d33") ? { v: 1, m: `En la pregunta ${P("d33")} respondió que sí conoció casos: debe ser al menos 1, o elija «Información no disponible».` } : null,
  },

  /* --- Ficha de estudiante --- */
  e11: {
    // Si el docente tiene un solo grado a cargo (d3), es ese.
    opc: (s, c) => GRADOS.includes(c.A.d3)
      ? { forzar: [c.A.d3], vetar: GRADOS.filter((g) => g !== c.A.d3) }
      : null,
  },
  e20: {
    opc: (s) => {
      if (s.e19 === "No afiliado") return { forzar: ["No afiliado"], vetar: [] };
      if (s.e19 === "Régimen especial o de excepción") return { forzar: ["Especial o de excepción"], vetar: [] };
      if (s.e19 && s.e19 !== NA) return { forzar: [], vetar: ["No afiliado", "Especial o de excepción"] };
      return null;
    },
  },
  e22: {
    // La ficha es de un estudiante con diagnóstico de autismo reportado.
    opc: () => ({ forzar: [], vetar: ["Sin diagnóstico reportado"] }),
  },
  e23: {
    // "Autismo" siempre; "Ninguna" nunca. Si el docente no reportó otras
    // condiciones, la pregunta queda resuelta sola y se salta.
    opc: (s, c) => {
      const p = permitidasEnFicha(c);
      return { forzar: ["Autismo"], vetar: E23.filter((o) => !p.has(o)) };
    },
  },
  e30: {
    opc: (s) => {
      if (s.e28 === "Regular" && s.e29 === "No") return { forzar: ["No aplica"], vetar: [] };
      if (si(s, "e29") || s.e28 === "Presenta ausencias frecuentes") return { forzar: [], vetar: ["No aplica"] };
      return null;
    },
  },
};

/* =====================================================================
   API
   ===================================================================== */

export const conChips = (q) => !!R[q.id]?.chips;

/** Límites numéricos vigentes. max null = sin tope conocido. */
export function limites(q, s, c) {
  const r = R[q.id] || {};
  const mn = r.min?.(s, c);
  const mx = r.max?.(s, c);
  return { min: mn ? mn.v : 0, max: mx ? mx.v : null };
}

/** Cuántas opciones se pueden marcar, o null si no hay tope. */
export function maxSeleccion(q, s, c) {
  const m = R[q.id]?.maxSel?.(s, c);
  return m && m.v > 0 ? m.v : null;
}

/** { forzar:[], vetar:[] } para preguntas de selección, o null. */
export function opcionesDe(q, s, c) {
  const o = R[q.id]?.opc?.(s, c);
  return o ? { forzar: o.forzar || [], vetar: o.vetar || [] } : null;
}

/** Mensaje de la primera regla que no se cumple, o null si todo cuadra. */
export function errorDe(q, s, c) {
  const r = R[q.id];
  if (!r) return null;
  const v = s[q.id];
  if (typeof v === "number") {
    const mn = r.min?.(s, c);
    if (mn && v < mn.v) return mn.m;
    const mx = r.max?.(s, c);
    if (mx && v > mx.v) return mx.m;
  }
  if (Array.isArray(v) && r.maxSel) {
    const m = r.maxSel(s, c);
    if (m && m.v > 0 && v.length > m.v) return m.m;
  }
  return r.regla ? r.regla(s, c) : null;
}

/** Fichas de caracterización: una por cada estudiante con autismo que el
    docente reportó (d6), y ninguna si no reportó autismo. */
export function numFichas(A) {
  return si(A, "d5") ? Math.max(0, Math.floor(n(A, "d6"))) : 0;
}

export const preguntaFichas = () => P("d6");
