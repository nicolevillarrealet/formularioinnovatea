/* reglas.js — Coherencia entre respuestas.

   Aquí viven, en un solo lugar, las reglas que impiden respuestas
   imposibles: más niñas con TEA que estudiantes con TEA, más casos
   que matriculados, marcar "Ninguna condición" después de reportar casos,
   etc. No son avisos opcionales: mientras una regla no se cumpla, el
   formulario no deja pasar a la siguiente pregunta, y transformador.js
   vuelve a revisarlas antes de enviar.

   Cada regla recibe (s, c):
     s  las respuestas del ámbito de la pregunta: las generales, o las de
        una ficha de estudiante
     c  { A, S, i, rol }  respuestas generales, todas las fichas, el índice
        de la ficha (null si la pregunta es general) y el formulario
        ("rectores" = docentes de apoyo, "docentes")

   Tipos de regla por pregunta:
     min, max  números. Devuelven { v, m }: el límite y el mensaje que se
               muestra si se cruza. null = sin límite.
     chips     números pequeños: se responden con botones del mínimo al 10
               y "11 o más" abre el campo para escribir.
     maxSel    selección múltiple: cuántas opciones se pueden marcar.
     opc       opciones de una pregunta de selección que se marcan solas
               (forzar) o se deshabilitan (vetar) según respuestas previas.
     regla     cualquier otra condición; devuelve el mensaje o null. */

import { GRADOS, EDADES } from "./catalogos.js";
import { INDICE, TEA, TDAH } from "./preguntas.js";

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

/* ---------- Docentes de apoyo (formulario 1, claves r…) ---------- */

const teaApoyo = (a) => n(a, "r7") + n(a, "r8");
const deMatricula = (a) => ({
  v: n(a, "r5"),
  m: `No puede ser mayor que la matrícula de básica primaria (pregunta ${P("r5")}): ${n(a, "r5")}.`,
});

/* ---------- Ficha ---------- */

/* Equivalencias entre las opciones de la pregunta de condiciones del
   grupo (d8) y las de la ficha (e23), que están redactadas distinto. */
const D8_A_E23 = {
  [TDAH]: TDAH,
  "Discapacidad intelectual": "Discapacidad intelectual",
  "Trastornos del aprendizaje": "Trastornos específicos del aprendizaje",
  "Trastornos del lenguaje": "Trastornos del lenguaje o comunicación",
  "Tics o Tourette": "Tics o Tourette",
  "Otras": "Otra",
};
const OTRAS_E23 = ["Discapacidad intelectual", "Trastornos del lenguaje o comunicación",
  "Trastornos específicos del aprendizaje", "Tics o Tourette", "Otra"];
const E23 = [TEA, TDAH, ...OTRAS_E23, "Ninguna"];

/** Condiciones que se pueden marcar en una ficha. La ficha es solo para
    estudiantes con TEA, así que TEA va siempre; las demás solo si se
    reportaron en la institución o el grupo, porque pueden presentarse a
    la vez que el TEA. */
function permitidasEnFicha(c) {
  const A = c.A;
  const p = new Set([TEA]);
  if (c.rol === "rectores") {
    if (n(A, "r9") > 0) p.add(TDAH);
    if (n(A, "r10") > 0) OTRAS_E23.forEach((o) => p.add(o));
    return p;
  }
  if (si(A, "d7")) (A.d8?.length ? A.d8 : Object.keys(D8_A_E23)).forEach((o) => p.add(D8_A_E23[o] || o));
  else if (A.d7 === "No sabe") Object.values(D8_A_E23).forEach((o) => p.add(o));
  return p;
}

/** Limita una pregunta de una opción a las marcadas en otra de varias:
    si solo hay una posible, se marca sola. */
function soloLasMarcadas(marcadas, todas) {
  if (!Array.isArray(marcadas) || !marcadas.length) return null;
  const vetar = todas.filter((o) => !marcadas.includes(o));
  return { forzar: marcadas.length === 1 ? [marcadas[0]] : [], vetar };
}

/* =====================================================================
   Reglas por pregunta
   ===================================================================== */

const R = {
  /* --- Contacto (opcional, pero si se escribe debe ser un celular) --- */
  rc: { regla: (s) => celularMalo(s.rc) },
  dc: { regla: (s) => celularMalo(s.dc) },

  /* --- Docentes de apoyo --- */
  r5: { min: () => ({ v: 1, m: "Escriba al menos 1: es la matrícula de básica primaria de la institución." }) },
  r7: { max: deMatricula }, // se escribe el número (sin botones)
  r8: { // se escribe el número (sin botones), como la 6.1
    max: (a) => {
      const v = Math.max(0, n(a, "r5") - n(a, "r7"));
      return { v, m: `Con ${n(a, "r5")} matriculados y ${n(a, "r7")} ya contados en la pregunta ${P("r7")}, aquí el máximo es ${v}.` };
    },
    min: (a) => si(a, "r6") && n(a, "r7") === 0
      ? { v: 1, m: `En la pregunta ${P("r6")} respondió que sí hay estudiantes con trastorno del espectro autista (TEA) y en la ${P("r7")} escribió 0: aquí debe haber al menos 1.` }
      : null,
  },
  r9: { chips: true, max: deMatricula },
  r10: { chips: true, max: deMatricula },
  r11: {
    chips: true,
    max: (a) => ({ v: teaApoyo(a), m: `No puede ser mayor que el total de estudiantes con trastorno del espectro autista (TEA) (preguntas ${P("r7")} y ${P("r8")}): ${teaApoyo(a)}.` }),
  },
  r12: {
    chips: true,
    max: (a) => {
      const v = Math.max(0, teaApoyo(a) - n(a, "r11"));
      return { v, m: `Con ${teaApoyo(a)} estudiante(s) con trastorno del espectro autista (TEA) y ${n(a, "r11")} de sexo femenino (pregunta ${P("r11")}), aquí el máximo es ${v}.` };
    },
  },
  r13: {
    maxSel: (a) => ({ v: teaApoyo(a), m: `Con ${teaApoyo(a)} estudiante(s) con trastorno del espectro autista (TEA) no se pueden marcar más de ${teaApoyo(a)} grupo(s) de edad.` }),
  },
  r14: {
    maxSel: (a) => ({ v: teaApoyo(a), m: `Con ${teaApoyo(a)} estudiante(s) con trastorno del espectro autista (TEA) no se pueden marcar más de ${teaApoyo(a)} grado(s).` }),
  },
  r16: { chips: true, max: deMatricula },
  r17: { max: deMatricula }, // SIMAT: se escribe el número (sin botones)
  // r19 (docentes de apoyo pedagógico) no depende del cargo de quien
  // responde: un docente de apoyo no es lo mismo que un docente de apoyo
  // pedagógico, así que ambas respuestas son válidas.

  /* --- Docentes --- */
  d4: { min: () => ({ v: 1, m: "Escriba al menos 1: es el número de estudiantes que tiene a cargo." }) },
  d6: {
    chips: true,
    max: (a) => ({ v: n(a, "d4"), m: `No puede ser mayor que los estudiantes a su cargo (pregunta ${P("d4")}): ${n(a, "d4")}.` }),
    min: (a) => si(a, "d5") ? { v: 1, m: `En la pregunta ${P("d5")} respondió que sí tiene estudiantes con trastorno del espectro autista (TEA): debe ser al menos 1.` } : null,
  },
  d34: {
    chips: true,
    min: (a) => si(a, "d33") ? { v: 1, m: `En la pregunta ${P("d33")} respondió que sí conoció casos: debe ser al menos 1, o elija «Información no disponible».` } : null,
  },

  /* --- Ficha de estudiante --- */
  e10: {
    // Docentes de apoyo: la edad tiene que estar entre las marcadas en 6.5 (r13).
    opc: (s, c) => c.rol === "rectores" ? soloLasMarcadas(c.A.r13, EDADES) : null,
  },
  e11: {
    // Docentes de apoyo: el grado tiene que estar entre los marcados en 6.6 (r14).
    // Docentes: si tiene un solo grado a cargo (d3), es ese; preescolar no
    // aplica porque el formulario es de básica primaria.
    opc: (s, c) => {
      const todos = ["Preescolar", ...GRADOS];
      if (c.rol === "rectores") return soloLasMarcadas(c.A.r14, todos);
      if (GRADOS.includes(c.A.d3)) return { forzar: [c.A.d3], vetar: todos.filter((g) => g !== c.A.d3) };
      return { forzar: [], vetar: ["Preescolar"] };
    },
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
    // La ficha es de un estudiante con diagnóstico de TEA reportado.
    opc: () => ({ forzar: [], vetar: ["Sin diagnóstico reportado"] }),
  },
  e23: {
    // TEA siempre; "Ninguna" nunca. Si no se reportaron otras
    // condiciones, la pregunta queda resuelta sola y se salta.
    opc: (s, c) => {
      const p = permitidasEnFicha(c);
      return { forzar: [TEA], vetar: E23.filter((o) => !p.has(o)) };
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

/** Fichas de caracterización: una por cada estudiante con trastorno del
    espectro autista (TEA) reportado, en los dos formularios.
    Docentes de apoyo: 6.1 + 6.2 (r7 + r8) si 6 es "Sí". Docentes: 5.1 (d6) si 5 es "Sí". */
export function numFichas(A, rol) {
  const total = rol === "rectores"
    ? (si(A, "r6") ? n(A, "r7") + n(A, "r8") : 0)
    : (si(A, "d5") ? n(A, "d6") : 0);
  return Math.max(0, Math.floor(total));
}

/** Pregunta(s) de donde sale el número de fichas, para los mensajes. */
export const preguntaFichas = (rol) => rol === "rectores" ? `${P("r7")} y ${P("r8")}` : `${P("d6")}`;
