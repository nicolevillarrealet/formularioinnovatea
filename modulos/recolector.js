/* recolector.js — Módulo 2: recibir respuestas.
   Lee el DOM en el momento del envío y devuelve los datos tal como quedaron
   en pantalla, sin interpretarlos. No filtra preguntas ocultas ni valida:
   de eso se encarga transformador.js.

   Las respuestas escritas a mano (nombre, contacto, institución) se
   guardan en MAYÚSCULAS, igual que se ven en el formulario.

   Entrada:  el registro de campos que publica ui.js.
   Salida:   { general: {...}, estudiantes: [ {...}, ... ] } */

/** Valor crudo de un campo, según el tipo de control que generó ui.js. */
function valorDe(entrada) {
  const { el, q } = entrada;

  if (q.t === "radio") {
    const marcado = el.querySelector("input:checked");
    return marcado ? marcado.value : undefined;
  }

  if (q.t === "multi") {
    const marcados = [...el.querySelectorAll("input:checked")].map((i) => i.value);
    return marcados.length ? marcados : undefined;
  }

  if (q.t === "select") {
    // El buscador de municipios guarda lo elegido en un input oculto.
    const oculto = el.querySelector("input[data-valor]");
    if (oculto) return oculto.value || undefined;
    const sel = el.querySelector("select");
    return sel && sel.value ? sel.value : undefined;
  }

  if (q.t === "text" || q.t === "inst") {
    const inp = el.querySelector('input[type="text"]');
    const v = inp ? inp.value.trim().toLocaleUpperCase("es-CO") : "";
    return v || undefined;
  }

  if (q.t === "num" || q.t === "numna") {
    // Números pequeños: los botones guardan el valor en un input oculto.
    const oculto = el.querySelector("input[data-valor]");
    if (oculto) {
      if (oculto.value === "") return undefined;
      if (oculto.value === "Información no disponible") return oculto.value;
      return Math.max(0, Math.floor(Number(oculto.value)));
    }
  }

  if (q.t === "numna") {
    // La única casilla dentro de un campo numna es "Información no disponible".
    const na = el.querySelector('input[type="checkbox"]');
    if (na && na.checked) return "Información no disponible";
  }

  // num y numna sin la casilla marcada
  const num = el.querySelector('input[type="number"]');
  if (!num || num.value === "") return undefined;
  return Math.max(0, Math.floor(Number(num.value)));
}

/**
 * Recorre todos los campos generados y arma el objeto crudo.
 * @param {Array} registro entradas { el, q, store, ambito, indice }
 */
export function extraerDatosDelDOM(registro) {
  const general = {};
  const estudiantes = [];

  registro.forEach((entrada) => {
    const v = valorDe(entrada);
    if (v === undefined) return;

    if (entrada.ambito === "estudiante") {
      const i = entrada.indice;
      while (estudiantes.length <= i) estudiantes.push({});
      estudiantes[i][entrada.q.id] = v;
    } else {
      general[entrada.q.id] = v;
    }
  });

  // Una ficha abierta y vacía debe seguir existiendo para que la validación
  // la señale, así que se cuentan por el registro y no por lo respondido.
  const fichasAbiertas = registro.reduce(
    (max, r) => (r.ambito === "estudiante" ? Math.max(max, r.indice + 1) : max), 0);
  while (estudiantes.length < fichasAbiertas) estudiantes.push({});

  return { general, estudiantes };
}
