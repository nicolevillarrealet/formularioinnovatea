/* ui.js — Módulo 1: interfaz y renderizado.
   Construye toda la pantalla dentro del contenedor #innovatea-app y genera
   los campos a partir de preguntas.js. No sabe nada de envíos ni de Excel:
   cuando el usuario actúa, emite un evento sobre el contenedor y main.js decide.

   Eventos emitidos:
     innovatea:rol    detail = { rol }        se eligió rectores | docentes
     innovatea:enviar detail = { rol }        se pulsó "Enviar respuestas"

   ESTILO WIZARD: cada pregunta es una pantalla y solo se ve una a la vez.
   "Siguiente" valida la pregunta actual; la pantalla nueva entra desde la
   derecha y la anterior sale hacia la izquierda (al retroceder, al revés).
   En las preguntas de una sola opción, tocar la respuesta ya avanza.
   Las preguntas condicionales que no aplican se saltan solas.

   En docentes, las FICHAS DE CARACTERIZACIÓN van al final, después de
   las preguntas sobre el docente, y las abre una pantalla que explica que
   esa parte es obligatoria. Son solo para estudiantes con autismo y se
   crean solas: tantas como estudiantes con autismo reportó el docente.
   Cada ficha empieza con una pantalla "Estudiante N de M" que muestra el
   estado de todas las fichas y permite volver a cualquiera.

   Las respuestas de las fichas viven en S y nunca se borran al cambiar el
   número de estudiantes: si el docente baja de 3 a 2, la tercera ficha se
   oculta (y no se envía) pero sus datos siguen ahí si vuelve a subir.

   Preguntas que quedan resueltas por respuestas anteriores (una sola
   opción posible, o un número cuyo mínimo y máximo coinciden) se
   responden solas y se saltan; aparecen en el resumen como automáticas.

   Una vez el usuario llega al resumen final, desde cualquier pregunta
   puede volver a él con "Volver al resumen", sin recorrer lo ya resuelto.

   COHERENCIA: las reglas de reglas.js no son avisos. Una respuesta que no
   cuadra con las anteriores (más casos que matriculados, "Ninguna" después
   de reportar casos…) muestra el motivo en rojo y "Siguiente" no avanza
   hasta corregirla. Las opciones que ya no aplican se deshabilitan y las
   que se deducen de respuestas previas se marcan solas.

   Todas las pantallas siguen en el DOM, así que recolector.js lee el
   formulario completo igual que antes. */

import {
  RECTORES, DOC_ID, DOC_GRUPO, DOC_ESTUDIANTE, DOC_CIERRE, INSTITUCIONES,
} from "./preguntas.js";
import { conChips, limites, maxSeleccion, opcionesDe, errorDe, numFichas, preguntaFichas } from "./reglas.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Las respuestas escritas a mano se guardan en mayúsculas, igual que se ven. */
const mayus = (s) => s.toLocaleUpperCase("es-CO");

let raiz = null;          // contenedor #innovatea-app
let ajustes = {};         // config recibida de main.js
let rolActual = null;     // "rectores" | "docentes"
let A = {};               // respuestas generales
let S = [];               // fichas de estudiante (docentes)
let registro = [];        // [{ el, q, store, ambito, indice }]
let actual = null;        // pantalla visible
let pantallaFinal = null; // "Revise y envíe"
let finTransicion = null; // cierra de golpe una transición en curso
let ultimoToque = 0;      // para avanzar solo cuando se toca, no con el teclado
let vioResumen = false;   // ya llegó al resumen final al menos una vez
let fichasPintadas = -1;  // cuántas fichas hay dibujadas ahora mismo
const memoria = {};       // copia del borrador por si el navegador no deja guardar

const $ = (sel) => raiz.querySelector(sel);
const emitir = (nombre, detalle) => raiz.dispatchEvent(new CustomEvent(nombre, { detail: detalle || {} }));
const sinMovimiento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const punteroFino = () => window.matchMedia?.("(pointer: fine)").matches;

/* =====================================================================
   Estructura de la página
   ===================================================================== */

export function montar(contenedor, config) {
  raiz = contenedor;
  ajustes = config;
  raiz.innerHTML = plantilla();
  cablearInicio();
  return raiz;
}

/* La página de WordPress ya trae la imagen, el título de bienvenida y el
   texto de presentación del proyecto, así que el bloque empieza
   directamente en la elección de encuesta. */
function plantilla() {
  return `
<div id="topbar" class="topbar" hidden>
  <div class="wrap">
    <button class="btn ghost small" id="back" type="button">← Salir</button>
    <strong id="formTitle">Encuesta</strong>
    <div class="bar" aria-hidden="true"><i id="barFill"></i></div>
    <span class="count" id="count">0/0</span>
  </div>
</div>

<div class="main wrap">
  <section id="home">
    <h2 class="titulo">Elija la encuesta que le corresponde</h2>
    <label class="consent" for="acepto">
      <input type="checkbox" id="acepto">
      <span>Autorizo el tratamiento de mis datos personales (nombre y contacto) y de la información que registre en esta encuesta, para la caracterización y el seguimiento del proyecto INNOVATEA, en los términos de la Ley 1581 de 2012. Mis datos solo serán conocidos por la coordinación del proyecto y no aparecerán en los informes. No registraré nombres ni documentos de estudiantes.</span>
    </label>
    <div class="acceso" id="acceso" hidden></div>
    <div class="roles">
      <button class="role" type="button" data-form="rectores">
        <small>Formulario 1 · 28 preguntas · 10 min aprox.</small>
        <h3>Rectores y directivos</h3>
        <span>Caracterización institucional y poblacional de la sede educativa.</span>
        <span class="go">Comenzar →</span>
      </button>
      <button class="role" type="button" data-form="docentes">
        <small>Formulario 2 · 22 preguntas + una ficha por estudiante con autismo</small>
        <h3>Docentes de básica primaria</h3>
        <span>Su grupo, su práctica pedagógica y formación, y la caracterización de cada estudiante con autismo.</span>
        <span class="go">Comenzar →</span>
      </button>
    </div>
    <div id="homeMsg"></div>
  </section>

  <section id="formView" hidden>
    <div id="formIntro"></div>
    <form id="form" novalidate></form>
  </section>

  <section id="thanks" class="thanks" hidden>
    <h2>¡Gracias por participar!</h2>
    <p>Su respuesta quedó registrada. La información se analizará siempre de forma agregada para orientar acciones de inclusión en Nariño.</p>
    <div class="actions"><button class="btn" type="button" id="again">Volver al inicio</button></div>
  </section>
</div>`;
}

/* =====================================================================
   Pantalla de bienvenida
   ===================================================================== */

export function iniciarPantallaBienvenida() {
  mostrar("home");
}

function cablearInicio() {
  raiz.querySelectorAll("[data-form]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!$("#acepto").checked) {
        $("#homeMsg").innerHTML = `<div class="notice bad">Para continuar, marque la autorización de tratamiento de datos.</div>`;
        $(".consent").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      $("#homeMsg").innerHTML = "";
      emitir("innovatea:rol", { rol: b.dataset.form });
    }));
  $("#acepto").addEventListener("change", () => { $("#homeMsg").innerHTML = ""; });
  $("#back").addEventListener("click", () => mostrar("home"));
  $("#again").addEventListener("click", () => mostrar("home"));
}

export function mostrar(vista) {
  ["home", "formView", "thanks"].forEach((id) => { $("#" + id).hidden = id !== vista; });
  $("#topbar").hidden = vista !== "formView";
  raiz.scrollIntoView({ block: "start" });
}

/* =====================================================================
   Renderizado de preguntas
   ===================================================================== */

/* =====================================================================
   Buscador para listas largas (municipios)
   ===================================================================== */

/* Sin tildes ni mayúsculas, para que "narino" encuentre "Nariño" y
   "alban" encuentre "Albán". Los nombres vienen precompuestos (NFC), así
   que quitar las tildes no cambia la longitud y las posiciones coinciden
   con el texto original al resaltar la coincidencia. */
const normalizar = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const LUPA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;

/**
 * Campo de búsqueda con la lista filtrada debajo. Al elegir, la lista se
 * recoge y queda una ficha con el valor y el botón "Cambiar".
 * El valor elegido viaja en un input oculto [data-valor] que lee recolector.js.
 */
function buscador(q, store, id, alElegir) {
  const nombre = q.buscar;
  const ctl = document.createElement("div");
  ctl.className = "buscador";
  ctl.innerHTML = `
    <div class="busc-elegido" hidden>
      <span class="busc-check" aria-hidden="true">✓</span>
      <strong class="busc-valor"></strong>
      <button type="button" class="btn ghost small busc-cambiar">Cambiar</button>
    </div>
    <div class="busc-panel">
      <div class="busc-campo">${LUPA}
        <input type="text" id="i-${id}" autocomplete="off" spellcheck="false" role="combobox"
          aria-autocomplete="list" aria-expanded="true" aria-controls="lb-${id}"
          placeholder="Escriba para buscar…">
      </div>
      <p class="hint busc-cuenta" aria-live="polite"></p>
      <ul class="busc-lista" role="listbox" id="lb-${id}" aria-label="${esc(nombre)}"></ul>
    </div>
    <input type="hidden" data-valor>`;

  const elegido = ctl.querySelector(".busc-elegido");
  const panel = ctl.querySelector(".busc-panel");
  const inp = ctl.querySelector("input[type=text]");
  const lista = ctl.querySelector(".busc-lista");
  const cuenta = ctl.querySelector(".busc-cuenta");
  const oculto = ctl.querySelector("[data-valor]");
  let opciones = [];
  let activo = -1;

  const marcarActivo = () => {
    lista.querySelectorAll("li[role=option]").forEach((li, i) => li.classList.toggle("activo", i === activo));
    const li = lista.children[activo];
    if (li && li.getAttribute("role") === "option") {
      inp.setAttribute("aria-activedescendant", li.id);
      li.scrollIntoView({ block: "nearest" });
    } else inp.removeAttribute("aria-activedescendant");
  };

  const pintar = () => {
    const t = normalizar(inp.value.trim());
    opciones = q.o.filter((o) => normalizar(o).includes(t));
    // Primero los que empiezan por lo escrito, luego los que lo contienen.
    if (t) opciones.sort((a, b) => normalizar(b).startsWith(t) - normalizar(a).startsWith(t));
    activo = t && opciones.length ? 0 : -1;

    lista.innerHTML = opciones.map((o, i) => {
      const k = t ? normalizar(o).indexOf(t) : -1;
      const texto = k >= 0
        ? esc(o.slice(0, k)) + `<mark>${esc(o.slice(k, k + t.length))}</mark>` + esc(o.slice(k + t.length))
        : esc(o);
      return `<li role="option" id="lb-${id}-${i}" data-v="${esc(o)}" aria-selected="${store[q.id] === o}">${texto}</li>`;
    }).join("") || `<li class="busc-vacio">No hay ${esc(nombre)} con «${esc(inp.value.trim())}». Revise cómo lo escribió.</li>`;

    cuenta.textContent = !t
      ? `${q.o.length} ${nombre} · toque uno o escriba para filtrar`
      : opciones.length === 1 ? "1 coincidencia · Enter para elegirla" : `${opciones.length} coincidencias`;
    marcarActivo();
  };

  const mostrarElegido = () => {
    const v = store[q.id];
    oculto.value = v || "";
    elegido.hidden = !v;
    panel.hidden = !!v;
    inp.setAttribute("aria-expanded", String(!v));
    if (v) elegido.querySelector(".busc-valor").textContent = v;
  };

  const elegir = (v) => {
    store[q.id] = v;
    mostrarElegido();
    cambio(q.id);
    elegido.querySelector(".busc-cambiar").focus({ preventScroll: true });
    alElegir();
  };

  // pointerdown + preventDefault: el campo no pierde el foco al tocar.
  lista.addEventListener("pointerdown", (e) => { if (e.target.closest("li[role=option]")) e.preventDefault(); });
  lista.addEventListener("click", (e) => {
    const li = e.target.closest("li[role=option]");
    if (li) elegir(li.dataset.v);
  });

  inp.addEventListener("input", pintar);
  inp.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!opciones.length) return;
      activo = e.key === "ArrowDown"
        ? Math.min(opciones.length - 1, activo + 1)
        : Math.max(0, activo - 1);
      marcarActivo();
    } else if (e.key === "Enter") {
      e.preventDefault(); // no enviar el formulario
      const v = opciones[activo] ?? (opciones.length === 1 ? opciones[0] : null);
      if (v) elegir(v);
    } else if (e.key === "Escape" && inp.value) {
      e.preventDefault();
      inp.value = "";
      pintar();
    }
  });

  elegido.querySelector(".busc-cambiar").addEventListener("click", () => {
    elegido.hidden = true;
    panel.hidden = false;
    inp.setAttribute("aria-expanded", "true");
    inp.value = "";
    pintar();
    inp.focus();
  });

  pintar();
  mostrarElegido();
  return ctl;
}

/* =====================================================================
   Números pequeños: botones del mínimo al 10 y "11 o más"
   ===================================================================== */

const NA = "Información no disponible";

/**
 * Botones con los valores posibles (respetando los límites de reglas.js:
 * si el máximo es 3, solo aparecen 0, 1, 2 y 3). Si el máximo pasa de 10,
 * el último botón abre un campo para escribir la cifra. El valor viaja en
 * un input oculto [data-valor] que lee recolector.js.
 */
function selectorNumero(q, store, id, alElegir) {
  const ctl = document.createElement("div");
  ctl.className = "numsel";
  ctl.innerHTML = `
    <div class="chips" role="group"></div>
    <div class="num-mas" hidden>
      <input type="number" id="i-${id}" inputmode="numeric" step="1" placeholder="Escriba el número">
      <span class="hint num-rango"></span>
    </div>
    <input type="hidden" data-valor>`;
  const chips = ctl.querySelector(".chips");
  const mas = ctl.querySelector(".num-mas");
  const inp = mas.querySelector("input");
  const rango = mas.querySelector(".num-rango");
  const oculto = ctl.querySelector("[data-valor]");
  let clave = "";
  let tope = 10;
  let modoMas = false;

  chips.addEventListener("pointerdown", () => { ultimoToque = Date.now(); });
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.mas !== undefined) {
      modoMas = true;
      if (typeof store[q.id] !== "number" || store[q.id] <= tope) { delete store[q.id]; inp.value = ""; }
      cambio();
      inp.focus();
      return;
    }
    modoMas = false;
    store[q.id] = b.dataset.na !== undefined ? NA : Number(b.dataset.v);
    cambio();
    alElegir();
  });
  inp.addEventListener("input", () => {
    if (inp.value === "") delete store[q.id];
    else store[q.id] = Math.max(0, Math.floor(Number(inp.value)));
    cambio();
  });

  ctl._refrescar = (c, aplicaPregunta) => {
    const { min, max } = limites(q, store, c);
    // Un solo valor posible: se responde solo y la pantalla se salta.
    const fija = aplicaPregunta && q.t !== "numna" && max != null && min === max;
    if (fija) { store[q.id] = min; modoMas = false; }
    tope = max == null ? 10 : Math.min(max, 10);
    const hayMas = max == null || max > 10;
    const k = `${min}|${tope}|${hayMas}`;
    if (k !== clave) {
      clave = k;
      let html = "";
      for (let v = min; v <= tope; v++) html += `<button type="button" class="chip" data-v="${v}">${v}</button>`;
      if (hayMas) html += `<button type="button" class="chip chip-mas" data-mas>${Math.max(tope + 1, min)} o más</button>`;
      if (q.t === "numna") html += `<button type="button" class="chip chip-na" data-na>${NA}</button>`;
      chips.innerHTML = html;
      inp.min = String(hayMas ? Math.max(tope + 1, min) : min);
      if (max != null) inp.max = String(max); else inp.removeAttribute("max");
      rango.textContent = max != null ? `Máximo ${max}.` : "";
    }
    const v = store[q.id];
    if (typeof v === "number" && v > tope) modoMas = true;
    if (v === NA) modoMas = false;
    chips.querySelectorAll(".chip").forEach((b) => {
      const on = b.dataset.na !== undefined ? v === NA
        : b.dataset.mas !== undefined ? modoMas
        : !modoMas && v === Number(b.dataset.v);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    mas.hidden = !modoMas;
    if (modoMas && document.activeElement !== inp) inp.value = typeof v === "number" ? v : "";
    oculto.value = v ?? "";
    return fija;
  };
  return ctl;
}

/** Contexto que reciben las reglas para una entrada del registro. */
const ctx = (r) => ({ A, S, i: r.indice });

/**
 * Aplica las reglas de opciones: desmarca lo que ya no aplica, marca lo
 * que se deduce de respuestas previas y deshabilita en pantalla lo que no
 * se puede elegir. Va en el orden del formulario, así que cada pregunta
 * ve ya corregidas las anteriores de las que depende.
 */
function aplicarReglas() {
  registro.forEach((r) => {
    const { q, store: s } = r;
    const c = ctx(r);
    const activa = visible(q, s) && (r.ambito !== "estudiante" || r.indice < numFichas(A));
    r.fija = false;
    if (r.el._refrescar) r.fija = !!r.el._refrescar(c, activa);
    if (q.t !== "radio" && q.t !== "multi") return;

    const o = opcionesDe(q, s, c);
    const forzar = new Set(o?.forzar || []);
    const vetar = new Set(o?.vetar || []);
    if (o && visible(q, s)) {
      if (q.t === "radio") {
        if (forzar.size === 1) s[q.id] = [...forzar][0];
        else if (vetar.has(s[q.id])) delete s[q.id];
      } else {
        let v = (s[q.id] || []).filter((x) => !vetar.has(x));
        forzar.forEach((x) => { if (!v.includes(x)) v.push(x); });
        if (q.x && v.length > 1) v = v.filter((x) => x !== q.x);
        v = q.o.filter((x) => v.includes(x)); // orden original
        if (v.length) s[q.id] = v; else delete s[q.id];
      }
    }

    const tope = q.t === "multi" ? maxSeleccion(q, s, c) : null;
    const sel = s[q.id];
    const marcadas = Array.isArray(sel) ? sel.length : 0;
    let lleno = false;
    r.el.querySelectorAll(".opts input").forEach((inp) => {
      const val = inp.value;
      inp.checked = q.t === "radio" ? sel === val : (sel || []).includes(val);
      const fijada = forzar.has(val) && (q.t === "multi" || forzar.size === 1);
      const sinCupo = tope != null && !inp.checked && marcadas >= tope;
      if (sinCupo) lleno = true;
      const bloq = vetar.has(val) || fijada || sinCupo;
      inp.disabled = bloq;
      inp.closest(".opt").classList.toggle("bloq", bloq);
      inp.closest(".opt").classList.toggle("fijada", fijada);
    });

    // Sin nada que elegir (todo marcado o vetado): la pantalla se salta.
    r.fija = !!o && activa && (q.t === "radio"
      ? forzar.size === 1
      : q.o.every((x) => forzar.has(x) || vetar.has(x)));

    const partes = [];
    if (forzar.size) partes.push(`Se marcó según sus respuestas anteriores: ${[...forzar].join(", ")}.`);
    if (vetar.size) partes.push("Las opciones en gris no aplican según sus respuestas anteriores.");
    if (tope != null) partes.push(`Puede marcar hasta ${tope}${lleno ? " (ya llegó al máximo)" : ""}.`);
    const nota = r.el.querySelector(".nota");
    nota.textContent = partes.join(" ");
    nota.hidden = !partes.length;
  });
}

/** Errores de coherencia de una entrada visible (o null). */
function errorEn(r) {
  if (!visible(r.q, r.store)) return null;
  if (r.ambito === "estudiante" && !requiereFichas()) return null;
  return errorDe(r.q, r.store, ctx(r));
}

function mostrarErrores() {
  registro.forEach((r) => {
    const m = errorEn(r);
    const span = r.el.querySelector(".incoh");
    span.textContent = m || "";
    span.hidden = !m;
    r.el.classList.toggle("incoherente", !!m);
  });
}

function campo(q, store, prefijo, ambito, indice) {
  const id = prefijo + q.id;
  const enLinea = ["select", "num", "inst", "numna", "text", "largo"].includes(q.t);
  const fs = document.createElement(enLinea ? "div" : "fieldset");
  fs.className = "q";
  fs.id = "q-" + id;

  const etiqueta = `<span class="n">${q.n}</span><span>${esc(q.l)}` +
    `${q.opt ? ' <span class="multi-note">(opcional)</span>' : ""}` +
    `${q.t === "multi" ? ' <span class="multi-note">(puede marcar varias)</span>' : ""}` +
    `${q.ayuda ? `<span class="q-ayuda">${esc(q.ayuda)}</span>` : ""}</span>`;
  fs.innerHTML = fs.tagName === "FIELDSET"
    ? `<legend tabindex="-1">${etiqueta}</legend>`
    : `<label class="lab" for="i-${id}">${etiqueta}</label>`;

  let ctl;
  let na = null;

  if (q.t === "radio" || q.t === "multi") {
    ctl = document.createElement("div");
    ctl.className = "opts";
    ctl.addEventListener("pointerdown", () => { ultimoToque = Date.now(); });
    q.o.forEach((o, i) => {
      const lab = document.createElement("label");
      lab.className = "opt";
      const inp = document.createElement("input");
      inp.type = q.t === "radio" ? "radio" : "checkbox";
      inp.name = id;
      inp.value = o;
      inp.id = `i-${id}-${i}`;
      inp.checked = q.t === "radio" ? store[q.id] === o : (store[q.id] || []).includes(o);
      inp.addEventListener("change", () => {
        if (q.t === "radio") {
          store[q.id] = o;
        } else {
          let v = new Set(store[q.id] || []);
          if (inp.checked) {
            if (q.x && o === q.x) v = new Set([o]);
            else { v.add(o); if (q.x) v.delete(q.x); }
          } else v.delete(o);
          store[q.id] = [...v];
          ctl.querySelectorAll("input").forEach((x) => { x.checked = v.has(x.value); });
        }
        cambio();
        // Una sola opción y elegida con el dedo o el ratón: pasa sola.
        if (q.t === "radio" && Date.now() - ultimoToque < 1000) {
          setTimeout(() => { if (actual && actual.contains(fs)) siguiente(); }, 320);
        }
      });
      const sp = document.createElement("span");
      sp.textContent = o;
      lab.append(inp, sp);
      ctl.append(lab);
    });

  } else if (q.t === "select" && q.buscar) {
    // Listas largas (los 64 municipios): buscador en lugar de desplegable.
    ctl = buscador(q, store, id, () => {
      setTimeout(() => { if (actual && actual.contains(fs)) siguiente(); }, 320);
    });

  } else if (q.t === "select") {
    ctl = document.createElement("select");
    ctl.id = `i-${id}`;
    ctl.innerHTML = `<option value="">Seleccione…</option>` +
      q.o.map((o) => `<option${store[q.id] === o ? " selected" : ""}>${esc(o)}</option>`).join("");
    ctl.addEventListener("change", () => {
      if (ctl.value) store[q.id] = ctl.value; else delete store[q.id];
      cambio(q.id);
    });

  } else if (q.t === "inst") {
    // Campo de institución: lista sugerida según el municipio elegido, pero
    // admite escritura libre mientras el directorio esté incompleto.
    ctl = document.createElement("div");
    ctl.className = "inst";
    const inp = document.createElement("input");
    inp.type = "text";
    inp.id = `i-${id}`;
    inp.autocomplete = "off";
    inp.setAttribute("list", `dl-${id}`);
    inp.placeholder = "Escriba o seleccione el nombre de la institución";
    inp.value = store[q.id] || "";
    const dl = document.createElement("datalist");
    dl.id = `dl-${id}`;
    const llenar = () => {
      const lista = INSTITUCIONES[store[q.dep]] || [];
      dl.innerHTML = lista.map((x) => `<option value="${esc(x)}">`).join("");
    };
    llenar();
    fs._refill = llenar;
    inp.addEventListener("input", () => {
      const v = mayus(inp.value.trim());
      if (v) store[q.id] = v; else delete store[q.id];
      cambio();
    });
    ctl.append(inp, dl);

  } else if (q.t === "largo") {
    // Texto de varias líneas (por ejemplo, justificar una respuesta).
    ctl = document.createElement("div");
    ctl.className = "largo";
    const ta = document.createElement("textarea");
    ta.id = `i-${id}`;
    ta.rows = 4;
    ta.maxLength = 500;
    ta.value = store[q.id] || "";
    const cuenta = document.createElement("span");
    cuenta.className = "hint largo-cuenta";
    const contar = () => { cuenta.textContent = `${ta.value.length} / 500`; };
    ta.addEventListener("input", () => {
      const v = mayus(ta.value.trim());
      if (v) store[q.id] = v; else delete store[q.id];
      contar();
      cambio();
    });
    contar();
    ctl.append(ta, cuenta);

  } else if (q.t === "text") {
    ctl = document.createElement("input");
    ctl.type = "text";
    ctl.id = `i-${id}`;
    ctl.maxLength = 120;
    ctl.autocomplete = q.id.endsWith("n") ? "name" : "off";
    ctl.value = store[q.id] || "";
    ctl.addEventListener("input", () => {
      const v = mayus(ctl.value.trim());
      if (v) store[q.id] = v; else delete store[q.id];
      cambio();
    });

  } else if (conChips(q)) { // num / numna con números pequeños
    ctl = selectorNumero(q, store, id, () => {
      if (Date.now() - ultimoToque < 1000) {
        setTimeout(() => { if (actual && actual.contains(fs)) siguiente(); }, 320);
      }
    });
    fs._refrescar = ctl._refrescar;

  } else { // num, numna con totales grandes (matrícula, estudiantes a cargo)
    ctl = document.createElement("div");
    ctl.className = "numrow";
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.step = "1";
    inp.inputMode = "numeric";
    inp.id = `i-${id}`;
    inp.placeholder = "0";
    if (typeof store[q.id] === "number") inp.value = store[q.id];
    inp.addEventListener("input", () => {
      if (inp.value === "") delete store[q.id];
      else store[q.id] = Math.max(0, Math.floor(Number(inp.value)));
      if (na) na.querySelector("input").checked = false;
      cambio();
    });
    ctl.append(inp);
    if (q.t === "numna") {
      na = document.createElement("label");
      na.className = "opt";
      na.innerHTML = `<input type="checkbox" id="i-${id}-na"${store[q.id] === "Información no disponible" ? " checked" : ""}><span>Información no disponible</span>`;
      na.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checked) { store[q.id] = "Información no disponible"; inp.value = ""; }
        else delete store[q.id];
        cambio();
      });
      ctl.append(na);
    }
  }

  const nota = document.createElement("span");
  nota.className = "nota";
  nota.hidden = true;
  const err = document.createElement("span");
  err.className = "err";
  err.textContent = "Responda esta pregunta para continuar.";
  const incoh = document.createElement("span");
  incoh.className = "incoh";
  incoh.setAttribute("role", "alert");
  incoh.hidden = true;
  fs.append(ctl, nota, err, incoh);

  registro.push({ el: fs, q, store, ambito, indice });
  return fs;
}

export const respondida = (q, store) => {
  const v = store[q.id];
  return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "";
};
export const visible = (q, store) => !q.show || q.show(store);
export const obligatoria = (r) => !r.q.opt;

/* =====================================================================
   Pantallas
   ===================================================================== */

/** Una pantalla del wizard. `aplica` decide si se muestra o se salta. */
function pantalla(contenido, aplica) {
  const p = document.createElement("div");
  p.className = "pantalla";
  p.hidden = true;
  if (aplica) p._aplica = aplica;
  p.append(contenido);
  return p;
}

/** Una pantalla por pregunta de la sección, con el nombre de la sección
    arriba y la ayuda de la sección en la primera pregunta. */
function pantallasDeSeccion(sec, store, prefijo, ambito, indice, antetitulo, condicion) {
  return sec.qs.map((q, k) => {
    const caja = document.createElement("div");
    const titulo = (antetitulo ? antetitulo + " · " : "") + sec.title;
    caja.innerHTML = (ambito === "estudiante" ? bannerFicha(indice) : "") +
      `<p class="pantalla-sec">${esc(sec.title)}</p>` +
      (k === 0 && sec.hint ? `<p class="hint pantalla-hint">${esc(sec.hint)}</p>` : "");
    caja.append(campo(q, store, prefijo, ambito, indice));
    const r = registro[registro.length - 1];
    r.grupo = titulo; // para el resumen final
    // Se salta si no aplica o si quedó resuelta por respuestas anteriores.
    const p = pantalla(caja, () => (!condicion || condicion()) && visible(q, store) && !r.fija);
    if (ambito === "estudiante") p.dataset.ficha = indice;
    return p;
  });
}

/** Franja que identifica a qué estudiante pertenece la pantalla. */
function bannerFicha(i) {
  const total = numFichas(A);
  return `<div class="ficha-banner"><span class="ficha-chip">Ficha de caracterización</span>
    <strong>Estudiante ${i + 1}</strong><span class="ficha-de">de ${total}</span></div>`;
}

const todas = () => [...$("#capas").querySelectorAll(".pantalla")];
const aplica = (p) => !p._aplica || p._aplica();
const visibles = () => todas().filter(aplica);

/** La pantalla aplicable más cercana hacia adelante (1) o atrás (-1). */
function vecino(dir) {
  const lista = todas();
  const i = lista.indexOf(actual);
  return dir > 0
    ? lista.slice(i + 1).find(aplica)
    : lista.slice(0, Math.max(i, 0)).reverse().find(aplica);
}

/** Enunciado corto para el resumen: sin signos de pregunta y recortado. */
const corto = (l) => {
  const t = l.replace(/[¿?]/g, "").trim();
  return t.length > 58 ? t.slice(0, 56).trimEnd() + "…" : t;
};
const valorLegible = (v) => Array.isArray(v) ? v.join(", ") : String(v);

/** Lista muy resumida de lo respondido, agrupada por sección. Cada línea
    lleva de vuelta a su pregunta para corregirla. */
function pintarResumen() {
  const caja = $("#resumenLista");
  if (!caja) return;
  const filas = registro.filter((r) => visible(r.q, r.store) && respondida(r.q, r.store)
    && (r.ambito !== "estudiante" || requiereFichas()));
  // Mismo orden que el recorrido del formulario.
  const orden = todas();
  const pos = (r) => orden.findIndex((p) => p.contains(r.el));
  filas.sort((a, b) => pos(a) - pos(b));

  let html = "", grupo = null;
  filas.forEach((r, k) => {
    if (r.grupo !== grupo) {
      if (grupo !== null) html += "</div>";
      grupo = r.grupo;
      html += `<p class="resumen-sec">${esc(grupo)}</p><div class="resumen-filas">`;
    }
    const malo = errorEn(r) ? " malo" : "";
    const auto = r.fija ? ` <span class="resumen-auto">automática</span>` : "";
    html += `<button type="button" class="resumen-fila${malo}" data-k="${k}" title="Volver a esta pregunta">
      <span class="resumen-n">${esc(r.q.n)}</span>
      <span class="resumen-q">${esc(corto(r.q.l))}</span>
      <span class="resumen-v">${esc(valorLegible(r.store[r.q.id]))}${auto}</span></button>`;
  });
  if (grupo !== null) html += "</div>";
  caja.innerHTML = html || `<p class="hint">Aún no hay respuestas.</p>`;
  caja.querySelectorAll(".resumen-fila").forEach((b) =>
    b.addEventListener("click", () => {
      const r = filas[Number(b.dataset.k)];
      // Las automáticas no tienen pantalla propia: se va a la que la define.
      if (r.fija) { mensaje("Esta respuesta se llenó sola a partir de otras. Para cambiarla, corrija las preguntas de las que depende.", "info"); return; }
      llevarA(r.el);
    }));
}

/** Entradas obligatorias que todavía faltan o no cuadran, en orden. */
function pendientes() {
  const orden = todas();
  const pos = (r) => orden.findIndex((p) => p.contains(r.el));
  return registro
    .filter((r) => visible(r.q, r.store) && (r.ambito !== "estudiante" || r.indice < numFichas(A))
      && ((obligatoria(r) && !respondida(r.q, r.store)) || errorEn(r)))
    .sort((a, b) => pos(a) - pos(b));
}

function actualizarNav() {
  if (!actual || !$("#pasoNav")) return;
  const v = visibles();
  const pos = Math.max(0, v.indexOf(actual));
  const final = actual === pantallaFinal;

  $("#pasoTxt").textContent = `${pos + 1} de ${v.length}`;
  $("#pasoBar").style.width = (v.length > 1 ? (pos / (v.length - 1)) * 100 : 100) + "%";
  $("#prev").hidden = !vecino(-1);
  $("#next").hidden = final;
  $("#send").hidden = !final;
  if (final) vioResumen = true;
  $("#toResumen").hidden = final || !vioResumen;

  // El título de arriba dice siempre en qué ficha se está.
  const fi = actual.dataset.ficha;
  $("#formTitle").textContent = rolActual === "rectores" ? "Rectores"
    : fi !== undefined ? `Ficha · Estudiante ${Number(fi) + 1} de ${numFichas(A)}` : "Docentes";

  const intro = actual.querySelector("[data-intro-texto]");
  if (intro) intro.textContent = textoIntroFichas();

  const inicio = actual.querySelector(".inicio-ficha");
  if (inicio) pintarEstadoFichas(inicio);

  if (final) pintarResumen();

  if (final) {
    const vis = registro.filter((r) => visible(r.q, r.store) && obligatoria(r)
      && (r.ambito !== "estudiante" || requiereFichas()));
    const hechas = vis.filter((r) => respondida(r.q, r.store)).length;
    const malas = registro.filter((r) => errorEn(r)).length;
    $("#resumenFin").textContent = malas
      ? `Hay ${malas} respuesta(s) que no cuadran con otras.`
      : hechas === vis.length
        ? `Respondió las ${vis.length} preguntas obligatorias. Toque cualquier línea para corregirla, o envíe.`
        : `Respondió ${hechas} de ${vis.length} preguntas obligatorias.`;
    $("#irPendiente").hidden = !pendientes().length;
  }
}

/** Muestra otra pantalla con la animación según la dirección. */
function cambiarA(destino, adelante) {
  if (!destino) return;
  if (finTransicion) finTransicion();
  const viejo = actual;
  const lista = todas();
  if (adelante === undefined) adelante = lista.indexOf(destino) > lista.indexOf(viejo);
  actual = destino;
  mensaje("");
  actualizarNav();

  const fv = $("#formView");
  if (fv.getBoundingClientRect().top < 0) fv.scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth", block: "start" });

  if (!viejo || viejo === destino || !viejo.isConnected || sinMovimiento()) {
    lista.forEach((p) => { p.hidden = p !== destino; });
    enfocar(destino);
    return;
  }

  const cEntra = adelante ? "entra-der" : "entra-izq";
  const cSale = adelante ? "sale-izq" : "sale-der";

  // Sin esto, el contenedor saltaría de golpe a la altura de la tarjeta
  // nueva y quedaría un hueco en blanco (o la navegación brincaría).
  // Se fija la altura actual y se anima hasta la de la tarjeta que entra.
  const capas = $("#capas");
  const altoAntes = capas.offsetHeight;
  viejo.classList.add("saliendo", cSale);
  destino.hidden = false;
  destino.classList.add(cEntra);
  const altoDespues = capas.offsetHeight;
  capas.style.height = altoAntes + "px";
  void capas.offsetHeight; // aplica la altura inicial antes de animar
  capas.style.height = altoDespues + "px";

  const t = setTimeout(() => finTransicion && finTransicion(), 460);
  finTransicion = () => {
    clearTimeout(t);
    viejo.hidden = true;
    viejo.classList.remove("saliendo", cSale);
    destino.classList.remove(cEntra);
    capas.style.height = "";
    finTransicion = null;
  };
  enfocar(destino);
}

/** En computador se enfoca el campo para escribir de una vez; en el
    celular solo el enunciado, para no abrir el teclado sin pedirlo. */
function enfocar(p) {
  const campoTexto = [...p.querySelectorAll('input[type="text"], input[type="number"], select, textarea')]
    .find((x) => !x.closest("[hidden]"));
  if (campoTexto && punteroFino()) { campoTexto.focus({ preventScroll: true }); return; }
  const h = p.querySelector("legend, .lab, h2");
  if (h) { if (!h.hasAttribute("tabindex")) h.tabIndex = -1; h.focus({ preventScroll: true }); }
}

/** ¿La pantalla actual está bien respondida? Si no, la marca y sacude. */
function pantallaLista() {
  const aqui = registro.filter((r) => actual.contains(r.el) && visible(r.q, r.store));
  const falta = aqui.filter((r) => obligatoria(r) && !respondida(r.q, r.store));
  const malas = aqui.filter((r) => errorEn(r));
  if (!falta.length && !malas.length) return true;
  falta.forEach((r) => r.el.classList.add("missing"));
  // Sacude la tarjeta para que se note que no avanzó.
  [...falta, ...malas].forEach((r) => {
    r.el.classList.remove("sacudir");
    void r.el.offsetWidth;
    r.el.classList.add("sacudir");
  });
  return false;
}

function siguiente() {
  if (!pantallaLista()) return;
  cambiarA(vecino(1), true);
}

/** Desde cualquier pregunta, de vuelta al resumen (solo si ya llegó a él). */
function volverResumen() {
  if (!pantallaLista()) return;
  cambiarA(pantallaFinal, true);
}

function anterior() {
  cambiarA(vecino(-1), false);
}

/** Lleva a la pantalla que contiene un elemento. */
function llevarA(el) {
  const p = todas().find((x) => x.contains(el));
  if (p && p !== actual) cambiarA(p);
}

/* =====================================================================
   Reacción a cualquier cambio: avisos, progreso, borrador
   ===================================================================== */

function cambio(qid) {
  // Las fichas se crean solas: una por cada estudiante con autismo.
  if (rolActual === "docentes" && numFichas(A) !== fichasPintadas) { renderizarFichas(); return; }

  aplicarReglas();
  // Una regla pudo fijar el número de estudiantes con autismo (p. ej. si
  // tiene 1 estudiante a cargo): se ajustan las fichas antes de seguir.
  if (rolActual === "docentes" && numFichas(A) !== fichasPintadas) { renderizarFichas(); return; }
  registro.forEach((r) => {
    if (respondida(r.q, r.store)) r.el.classList.remove("missing");
    if (qid && r.q.dep === qid && r.el._refill) r.el._refill();
  });
  mostrarErrores();

  const vis = registro.filter((r) => visible(r.q, r.store) && obligatoria(r)
    && (r.ambito !== "estudiante" || requiereFichas()));
  const hechas = vis.filter((r) => respondida(r.q, r.store)).length;
  $("#count").textContent = `${hechas}/${vis.length}`;
  $("#barFill").style.width = (vis.length ? (hechas / vis.length) * 100 : 0) + "%";
  actualizarNav();
  guardarBorrador();
}

/* =====================================================================
   Construcción del formulario
   ===================================================================== */

export function renderizarFormulario(rol, ops = {}) {
  rolActual = rol;
  registro = [];
  actual = null;
  if (finTransicion) finTransicion();
  const f = $("#form");
  f.innerHTML = "";

  const borrador = cargarBorrador(rol);
  A = borrador.A || {};
  S = borrador.S || [];
  vioResumen = !!borrador.fin;
  fichasPintadas = -1;
  // El contacto se llena con el correo verificado, si está vacío.
  const contacto = rol === "rectores" ? "rc" : "dc";
  if (ops.correo && !A[contacto]) A[contacto] = ops.correo.toLocaleUpperCase("es-CO");

  const ind = document.createElement("div");
  ind.className = "pasos-ind";
  ind.innerHTML = `<span id="pasoTxt"></span><span class="progreso" aria-hidden="true"><i id="pasoBar"></i></span>`;
  f.append(ind);

  const capas = document.createElement("div");
  capas.className = "pasos";
  capas.id = "capas";
  f.append(capas);

  const agregar = (lista) => lista.forEach((p) => capas.append(p));

  if (rol === "rectores") {
    $("#formTitle").textContent = "Rectores";
    $("#formIntro").innerHTML = `<h2 class="titulo">${esc(RECTORES.title)}</h2><p class="hint">Responda con la información institucional disponible. Las cantidades se escriben en números enteros.</p>`;
    RECTORES.sections.forEach((s) => agregar(pantallasDeSeccion(s, A, "", "general", null)));
  } else {
    $("#formTitle").textContent = "Docentes";
    $("#formIntro").innerHTML = `<h2 class="titulo">Encuesta para docentes</h2><p class="hint">Primero describa su grupo y responda las preguntas sobre su práctica pedagógica y su formación. Al final caracterice a cada estudiante con autismo que reportó, sin nombres ni documentos.</p>`;
    // Orden: el docente responde primero lo que es sobre él y su grupo, y
    // al final caracteriza a cada estudiante con autismo (fichas).
    agregar(pantallasDeSeccion(DOC_ID, A, "", "general", null));
    agregar(pantallasDeSeccion(DOC_GRUPO, A, "", "general", null));
    DOC_CIERRE.forEach((s) => agregar(pantallasDeSeccion(s, A, "", "general", null)));
    capas.append(pantallaIntroFichas());
    const zona = document.createElement("div");
    zona.id = "zonaFichas";
    capas.append(zona);
  }

  const fin = document.createElement("div");
  fin.innerHTML = `<p class="pantalla-sec">Último paso</p><h2 tabindex="-1">Revise y envíe</h2>
    <p class="hint" id="resumenFin"></p>
    <button type="button" class="btn small" id="irPendiente" hidden>Ir a lo que falta →</button>
    <div class="resumen" id="resumenLista"></div>`;
  pantallaFinal = pantalla(fin);
  capas.append(pantallaFinal);

  const nav = document.createElement("div");
  nav.className = "actions pasos-nav";
  nav.id = "pasoNav";
  nav.innerHTML = `
    <button type="button" class="btn ghost" id="prev">← Anterior</button>
    <button type="button" class="btn ghost" id="toResumen" hidden>Volver al resumen</button>
    <button type="button" class="btn" id="next">Siguiente →</button>
    <button type="submit" class="btn" id="send">Enviar respuestas</button>`;
  f.append(nav);
  f.append(Object.assign(document.createElement("div"), { id: "formMsg" }));

  $("#prev").addEventListener("click", anterior);
  $("#next").addEventListener("click", siguiente);
  $("#toResumen").addEventListener("click", volverResumen);
  $("#irPendiente").addEventListener("click", () => {
    const p = pendientes()[0];
    if (p) { p.el.classList.add("missing"); llevarA(p.el); }
  });

  // Enter dentro de un campo avanza; solo en la pantalla final envía.
  f.onsubmit = (e) => {
    e.preventDefault();
    if (actual !== pantallaFinal) { siguiente(); return; }
    emitir("innovatea:enviar", { rol });
  };

  if (rol === "docentes") renderizarFichas(); else cambio();

  // Con un borrador a medias, se retoma en la primera pregunta sin
  // responder; si ya estaba todo y había llegado al resumen, en el resumen.
  const v = visibles();
  const pendiente = v.find((p) => registro.some((r) => p.contains(r.el) && obligatoria(r) && visible(r.q, r.store) && !respondida(r.q, r.store)));
  actual = pendiente || (vioResumen ? pantallaFinal : v[0]);
  actual.hidden = false;
  actualizarNav();
  mostrar("formView");
}

/* ---------- Fichas de caracterización ---------- */

/** Pantalla que abre la última parte: deja claro que viene la
    caracterización de cada estudiante con autismo y que es obligatoria. */
function pantallaIntroFichas() {
  const caja = document.createElement("div");
  caja.className = "intro-fichas";
  caja.innerHTML = `
    <p class="pantalla-sec">Última parte</p>
    <h2 tabindex="-1">Fichas de caracterización de sus estudiantes con autismo</h2>
    <p class="obligatorio"><strong>Esta parte es OBLIGATORIA.</strong> Sin ella no se puede enviar la encuesta.</p>
    <p data-intro-texto></p>
    <ul class="intro-lista">
      <li>Cada ficha tiene tres partes: A. sociodemográfica, B. salud y acceso a servicios, y C. permanencia escolar.</li>
      <li>Al terminar una ficha pasa sola a la siguiente. Puede volver a una ficha ya diligenciada en cualquier momento.</li>
      <li><strong>No escriba nombres ni documentos</strong>: cada estudiante se identifica solo como «Estudiante 1», «Estudiante 2»…</li>
      <li>Si no conoce un dato, elija «Información no disponible».</li>
    </ul>`;
  return pantalla(caja, requiereFichas);
}

function textoIntroFichas() {
  const n = numFichas(A);
  return n === 1
    ? `En la pregunta ${preguntaFichas()} reportó 1 estudiante con autismo: diligencie su ficha.`
    : `En la pregunta ${preguntaFichas()} reportó ${n} estudiantes con autismo. Se crearon ${n} fichas, una por cada uno: Estudiante 1 a Estudiante ${n}.`;
}

/** Estado de una ficha: completa, empezada o sin empezar. */
function estadoFicha(i) {
  const propias = registro.filter((r) => r.ambito === "estudiante" && r.indice === i && visible(r.q, r.store));
  const oblig = propias.filter(obligatoria);
  const hechas = oblig.filter((r) => respondida(r.q, r.store) && !errorEn(r)).length;
  const manuales = propias.filter((r) => !r.fija && respondida(r.q, r.store)).length;
  return { completa: oblig.length > 0 && hechas === oblig.length, empezada: manuales > 0, hechas, total: oblig.length };
}

/** Pantalla con que empieza cada ficha: a qué estudiante corresponde y el
    estado de todas, con acceso directo a cada una. */
function pantallaInicioFicha(i) {
  const caja = document.createElement("div");
  caja.className = "inicio-ficha";
  caja.dataset.ficha = i;
  caja.innerHTML = `
    ${bannerFicha(i)}
    <h2 tabindex="-1">Ficha del Estudiante ${i + 1}</h2>
    <p class="hint">Las preguntas que siguen son solo sobre el <strong>Estudiante ${i + 1}</strong>. Piense en un solo niño o niña durante toda la ficha.</p>
    <ol class="lista-fichas" aria-label="Estado de las fichas"></ol>`;
  const p = pantalla(caja, () => requiereFichas() && i < numFichas(A));
  p.dataset.ficha = i;
  return p;
}

function pintarEstadoFichas(caja) {
  const actualI = Number(caja.dataset.ficha);
  const lista = caja.querySelector(".lista-fichas");
  const n = numFichas(A);
  let html = "";
  for (let i = 0; i < n; i++) {
    const e = estadoFicha(i);
    const cls = i === actualI ? "actual" : e.completa ? "completa" : e.empezada ? "empezada" : "";
    const estado = e.completa ? "Completa" : e.empezada ? `En curso · ${e.hechas} de ${e.total}` : "Sin empezar";
    const accion = i === actualI ? `<span class="lf-aqui">Está aquí</span>`
      : `<button type="button" class="btn ghost small" data-ir="${i}">${e.completa ? "Revisar" : e.empezada ? "Continuar" : "Ir"}</button>`;
    html += `<li class="${cls}"><span class="lf-n">${i + 1}</span><span class="lf-txt"><strong>Estudiante ${i + 1}</strong><small>${estado}</small></span>${accion}</li>`;
  }
  lista.innerHTML = html;
  lista.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => {
    const destino = todas().find((p) => p.querySelector(`.inicio-ficha[data-ficha="${b.dataset.ir}"]`));
    if (destino) cambiarA(destino);
  }));
}

/** Dibuja las fichas que corresponden según el número de estudiantes con
    autismo. Los datos de S se conservan siempre: si sobran fichas solo se
    dejan de dibujar, y si faltan se agregan vacías. */
function renderizarFichas() {
  const n = numFichas(A);
  while (S.length < n) S.push({});
  fichasPintadas = n;

  registro = registro.filter((r) => r.store === A);
  const zona = $("#zonaFichas");
  zona.innerHTML = "";
  for (let i = 0; i < n; i++) {
    zona.append(pantallaInicioFicha(i));
    DOC_ESTUDIANTE.forEach((sec) =>
      pantallasDeSeccion(sec, S[i], `s${i}-`, "estudiante", i, `Estudiante ${i + 1}`, requiereFichas)
        .forEach((p) => zona.append(p)));
  }
  cambio();
}

/** ¿El docente reportó estudiantes con autismo? Entonces hay fichas. */
export const requiereFichas = () => rolActual === "docentes" && numFichas(A) > 0;

/* =====================================================================
   Acceso para los demás módulos
   ===================================================================== */

export const obtenerRegistro = () => registro;
export const rol = () => rolActual;
export const numeroDeFichas = () => numFichas(A);

/** Recibe descriptores { id, ambito, indice } de transformador.js, resalta
    las preguntas correspondientes y lleva a la primera. */
export function marcarFaltantes(faltantes) {
  const elementos = faltantes
    .map((f) => registro.find((r) => r.q.id === f.id && r.ambito === f.ambito && r.indice === f.indice))
    .filter(Boolean);
  elementos.forEach((r) => r.el.classList.add("missing"));
  if (elementos.length) llevarA(elementos[0].el);
}

/** Aviso en la pantalla de inicio (debajo de las encuestas). */
export function avisoInicio(html, clase = "bad") {
  $("#homeMsg").innerHTML = html ? `<div class="notice ${clase}">${html}</div>` : "";
}

/** Contenedor de la verificación de correo de la pantalla de inicio. */
export const contenedorAcceso = () => $("#acceso");

/** ¿Marcó la autorización de tratamiento de datos? */
export const autorizo = () => $("#acepto").checked;

/** Bloquea las tarjetas de las encuestas que el correo ya envió. */
export function marcarUsadas(tipos) {
  const nombre = { rectores: "rector", docentes: "docente" };
  raiz.querySelectorAll("[data-form]").forEach((b) => {
    const usada = (tipos || []).includes(nombre[b.dataset.form]);
    b.classList.toggle("usada", usada);
    b.disabled = usada;
    b.querySelector(".go").textContent = usada ? "Ya enviada con este correo" : "Comenzar →";
  });
}

export function mensaje(html, clase = "bad") {
  const m = $("#formMsg");
  if (m) m.innerHTML = html ? `<div class="notice ${clase}">${html}</div>` : "";
}

export function irA(sel) {
  const el = $(sel);
  if (el) llevarA(el);
}

export function bloquearEnvio(bloqueado, texto) {
  const b = $("#send");
  if (!b) return;
  b.disabled = bloqueado;
  b.textContent = texto || "Enviar respuestas";
}

/* =====================================================================
   Borrador local (solo en el navegador de quien responde)
   ===================================================================== */

const clave = (rol) => "innovatea-" + rol;

/* Se guarda en el navegador y, además, en memoria: si el navegador no
   deja guardar (modo privado, página incrustada), salir al inicio y volver
   a entrar no borra lo diligenciado mientras la página siga abierta. */
function guardarBorrador() {
  const datos = { A, S, fin: vioResumen };
  memoria[rolActual] = datos;
  try { localStorage.setItem(clave(rolActual), JSON.stringify(datos)); } catch (e) { /* modo privado */ }
}
function cargarBorrador(rol) {
  try {
    const guardado = localStorage.getItem(clave(rol));
    if (guardado) return JSON.parse(guardado);
  } catch (e) { /* modo privado */ }
  return memoria[rol] || {};
}
export function limpiarBorrador(rol) {
  const r = rol || rolActual;
  try { localStorage.removeItem(clave(r)); } catch (e) { /* modo privado */ }
  delete memoria[r];
  A = {}; S = []; vioResumen = false;
}

/** Pantalla final. `nota` permite avisar, por ejemplo, que el envío quedó
    en cola porque no había conexión en ese momento. */
export function finalizar(nota) {
  const seccion = $("#thanks");
  const previa = seccion.querySelector(".notice");
  if (previa) previa.remove();
  if (nota) seccion.querySelector(".actions").insertAdjacentHTML("beforebegin", `<div class="notice info">${nota}</div>`);
  mostrar("thanks");
}
