/* ui.js — Módulo 1: interfaz y renderizado.
   Construye toda la pantalla dentro del contenedor #innovatea-app y genera
   los campos a partir de preguntas.js. No sabe nada de envíos ni de Excel:
   cuando el usuario actúa, emite un evento sobre el contenedor y main.js decide.

   Eventos emitidos:
     innovatea:rol    detail = { rol }        se eligió rectores | docentes
     innovatea:enviar detail = { rol }        se pulsó "Enviar respuestas"

   El formulario se muestra POR PASOS: cada sección es una capa y solo se ve
   una a la vez. "Siguiente" valida la capa actual antes de avanzar; la capa
   nueva entra desde la derecha y la anterior sale hacia la izquierda (al
   retroceder, al revés). Todas las capas siguen en el DOM, así que
   recolector.js lee el formulario completo igual que antes.

   El estado vivo (respuestas generales y fichas de estudiante) se mantiene
   aquí porque la lógica condicional, la barra de progreso y el borrador
   local dependen de él. La lectura definitiva en el momento del envío la
   hace recolector.js leyendo el DOM. */

import {
  RECTORES, DOC_ID, DOC_GRUPO, DOC_ESTUDIANTE, DOC_CIERRE, INSTITUCIONES,
} from "./preguntas.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Las respuestas escritas a mano se guardan en mayúsculas, igual que se ven. */
const mayus = (s) => s.toLocaleUpperCase("es-CO");

let raiz = null;          // contenedor #innovatea-app
let ajustes = {};         // config recibida de main.js
let rolActual = null;     // "rectores" | "docentes"
let A = {};               // respuestas generales
let S = [];               // fichas de estudiante (docentes)
let registro = [];        // [{ el, q, store, ambito, indice }]
let pasos = [];           // elementos .paso, en orden
let pasoActual = 0;
let finTransicion = null; // cierra de golpe una transición en curso

const $ = (sel) => raiz.querySelector(sel);
const emitir = (nombre, detalle) => raiz.dispatchEvent(new CustomEvent(nombre, { detail: detalle || {} }));
const sinMovimiento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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
    <div class="roles">
      <button class="role" type="button" data-form="rectores">
        <small>Formulario 1 · 28 preguntas · 10 min aprox.</small>
        <h3>Rectores y directivos</h3>
        <span>Caracterización institucional y poblacional de la sede educativa.</span>
        <span class="go">Comenzar →</span>
      </button>
      <button class="role" type="button" data-form="docentes">
        <small>Formulario 2 · 6 secciones · 15 min aprox.</small>
        <h3>Docentes de básica primaria</h3>
        <span>Su grupo, cada estudiante reportado, apoyos pedagógicos y formación.</span>
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

function campo(q, store, prefijo, ambito, indice) {
  const id = prefijo + q.id;
  const enLinea = ["select", "num", "inst", "numna", "text"].includes(q.t);
  const fs = document.createElement(enLinea ? "div" : "fieldset");
  fs.className = "q";
  fs.id = "q-" + id;

  const etiqueta = `<span class="n">${q.n}</span><span>${esc(q.l)}` +
    `${q.opt ? ' <span class="multi-note">(opcional)</span>' : ""}` +
    `${q.t === "multi" ? ' <span class="multi-note">(puede marcar varias)</span>' : ""}</span>`;
  fs.innerHTML = fs.tagName === "FIELDSET"
    ? `<legend>${etiqueta}</legend>`
    : `<label class="lab" for="i-${id}">${etiqueta}</label>`;

  let ctl;
  let na = null;

  if (q.t === "radio" || q.t === "multi") {
    ctl = document.createElement("div");
    ctl.className = "opts";
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
      });
      const sp = document.createElement("span");
      sp.textContent = o;
      lab.append(inp, sp);
      ctl.append(lab);
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

  } else { // num, numna
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

  const err = document.createElement("span");
  err.className = "err";
  err.textContent = "Responda esta pregunta para continuar.";
  const adv = document.createElement("span");
  adv.className = "warn";
  adv.hidden = true;
  fs.append(ctl, err, adv);

  registro.push({ el: fs, q, store, ambito, indice });
  return fs;
}

function seccion(sec, store, prefijo, ambito, indice) {
  const s = document.createElement("div");
  s.className = "section";
  s.innerHTML = `<h2 tabindex="-1">${esc(sec.title)}</h2>${sec.hint ? `<p class="hint">${esc(sec.hint)}</p>` : ""}`;
  sec.qs.forEach((q) => s.append(campo(q, store, prefijo, ambito, indice)));
  return s;
}

export const respondida = (q, store) => {
  const v = store[q.id];
  return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "";
};
export const visible = (q, store) => !q.show || q.show(store);
export const obligatoria = (r) => !r.q.opt;

/* =====================================================================
   Reacción a cualquier cambio: visibilidad, avisos, progreso, borrador
   ===================================================================== */

function cambio(qid) {
  registro.forEach((r) => {
    r.el.hidden = !visible(r.q, r.store);
    if (respondida(r.q, r.store)) r.el.classList.remove("missing");
    if (qid && r.q.dep === qid && r.el._refill) r.el._refill();
  });

  registro.forEach((r) => { const w = r.el.querySelector(".warn"); w.hidden = true; w.textContent = ""; });
  if (rolActual === "rectores") {
    RECTORES.checks(A).forEach((c) => {
      const r = registro.find((x) => x.q.id === c.q && x.store === A);
      if (!r) return;
      const w = r.el.querySelector(".warn");
      w.textContent = c.m;
      w.hidden = false;
    });
  }
  if (rolActual === "docentes") sincronizarFichas();

  const vis = registro.filter((r) => visible(r.q, r.store) && obligatoria(r));
  const hechas = vis.filter((r) => respondida(r.q, r.store)).length;
  $("#count").textContent = `${hechas}/${vis.length}`;
  $("#barFill").style.width = (vis.length ? (hechas / vis.length) * 100 : 0) + "%";
  actualizarNav();
  guardarBorrador();
}

/* =====================================================================
   Pasos (capas)
   ===================================================================== */

/** Envuelve una o varias secciones en una capa. `condicion` decide si la
    capa aplica (la de fichas solo aplica si el docente reportó estudiantes). */
function paso(contenido, condicion) {
  const p = document.createElement("div");
  p.className = "paso";
  p.hidden = true;
  if (condicion) p._aplica = condicion;
  p.append(contenido);
  pasos.push(p);
  return p;
}

const pasoAplica = (i) => !pasos[i]._aplica || pasos[i]._aplica();
const pasosVisibles = () => pasos.map((_, i) => i).filter(pasoAplica);

function actualizarNav() {
  const nav = $("#pasoNav");
  if (!nav || !pasos.length) return;
  const vis = pasosVisibles();
  const pos = vis.indexOf(pasoActual);
  const ultimo = pos === vis.length - 1;

  $("#pasoTxt").textContent = `Paso ${pos + 1} de ${vis.length}`;
  $("#pasoSeg").innerHTML = vis.map((_, k) =>
    `<i class="${k < pos ? "hecho" : k === pos ? "actual" : ""}"></i>`).join("");

  $("#prev").hidden = pos <= 0;
  $("#next").hidden = ultimo;
  $("#send").hidden = !ultimo;
  $("#sendHint").hidden = !ultimo;
}

/** Cambia de capa con la animación correspondiente a la dirección. */
function cambiarPaso(destino) {
  if (finTransicion) finTransicion();
  const viejo = pasos[pasoActual];
  const nuevo = pasos[destino];
  const adelante = destino > pasoActual;
  pasoActual = destino;
  mensaje("");
  actualizarNav();

  const enfocar = () => {
    const h = nuevo.querySelector("h2");
    if (h) h.focus({ preventScroll: true });
  };
  $("#formView").scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth", block: "start" });

  if (!viejo || viejo === nuevo || sinMovimiento()) {
    pasos.forEach((p, i) => { p.hidden = i !== destino; });
    enfocar();
    return;
  }

  const cEntra = adelante ? "entra-der" : "entra-izq";
  const cSale = adelante ? "sale-izq" : "sale-der";
  viejo.classList.add("saliendo", cSale);
  nuevo.hidden = false;
  nuevo.classList.add(cEntra);

  const t = setTimeout(() => finTransicion && finTransicion(), 460);
  finTransicion = () => {
    clearTimeout(t);
    viejo.hidden = true;
    viejo.classList.remove("saliendo", cSale);
    nuevo.classList.remove(cEntra);
    finTransicion = null;
  };
  enfocar();
}

/** Preguntas obligatorias sin responder dentro de una capa. */
function faltantesDelPaso(i) {
  const p = pasos[i];
  return registro.filter((r) => p.contains(r.el) && visible(r.q, r.store) && obligatoria(r) && !respondida(r.q, r.store));
}

function siguiente() {
  const falta = faltantesDelPaso(pasoActual);
  if (falta.length) {
    falta.forEach((r) => r.el.classList.add("missing"));
    falta[0].el.scrollIntoView({ behavior: "smooth", block: "center" });
    mensaje(`Faltan ${falta.length} pregunta(s) en este paso. Están marcadas en rojo.`);
    return;
  }
  if (pasos[pasoActual].contains($("#students")) && requiereFichas() && S.length === 0) {
    mensaje("Agregue al menos una ficha de estudiante para continuar.");
    return;
  }
  const vis = pasosVisibles();
  const pos = vis.indexOf(pasoActual);
  if (pos < vis.length - 1) cambiarPaso(vis[pos + 1]);
}

function anterior() {
  const vis = pasosVisibles();
  const pos = vis.indexOf(pasoActual);
  if (pos > 0) cambiarPaso(vis[pos - 1]);
}

/** Lleva a la capa que contiene un elemento y, al terminar la entrada,
    lo desplaza a la vista. */
function llevarA(el, bloque = "center") {
  const i = pasos.findIndex((p) => p.contains(el));
  const desplazar = () => el.scrollIntoView({ behavior: "smooth", block: bloque });
  if (i >= 0 && i !== pasoActual) { cambiarPaso(i); setTimeout(desplazar, sinMovimiento() ? 0 : 480); }
  else desplazar();
}

/* =====================================================================
   Construcción del formulario
   ===================================================================== */

export function renderizarFormulario(rol) {
  rolActual = rol;
  registro = [];
  pasos = [];
  pasoActual = 0;
  if (finTransicion) finTransicion();
  const f = $("#form");
  f.innerHTML = "";

  const borrador = cargarBorrador(rol);
  A = borrador.A || {};
  S = borrador.S || [];

  const ind = document.createElement("div");
  ind.className = "pasos-ind";
  ind.innerHTML = `<span id="pasoTxt"></span><span class="seg" id="pasoSeg" aria-hidden="true"></span>`;
  f.append(ind);

  const capas = document.createElement("div");
  capas.className = "pasos";
  f.append(capas);

  if (rol === "rectores") {
    $("#formTitle").textContent = "Rectores";
    $("#formIntro").innerHTML = `<h2 class="titulo">${esc(RECTORES.title)}</h2><p class="hint">Responda con la información institucional disponible. Las cantidades se escriben en números enteros.</p>`;
    RECTORES.sections.forEach((s) => capas.append(paso(seccion(s, A, "", "general", null))));
  } else {
    $("#formTitle").textContent = "Docentes";
    $("#formIntro").innerHTML = `<h2 class="titulo">Encuesta para docentes</h2><p class="hint">Primero describa su grupo. Luego diligencie una ficha (secciones 2 a 4) por cada estudiante con autismo u otra condición del neurodesarrollo reportada, sin nombres ni documentos. Al final responda las secciones 5 y 6.</p>`;
    capas.append(paso(seccion(DOC_ID, A, "", "general", null)));
    capas.append(paso(seccion(DOC_GRUPO, A, "", "general", null)));

    const st = document.createElement("div");
    st.id = "students";
    st.className = "section";
    st.innerHTML = `<h2 tabindex="-1">Fichas por estudiante</h2><p class="hint" id="stHint"></p><div id="stList"></div><div class="actions" style="margin-top:14px"><button type="button" class="btn ghost" id="addSt">+ Agregar ficha de estudiante</button></div>`;
    capas.append(paso(st, requiereFichas));

    DOC_CIERRE.forEach((s) => capas.append(paso(seccion(s, A, "", "general", null))));
    st.querySelector("#addSt").addEventListener("click", () => {
      S.push({});
      renderizarFichas();
      mensaje("");
      const ultima = $("#stList").lastElementChild;
      if (ultima) ultima.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const nav = document.createElement("div");
  nav.className = "actions pasos-nav";
  nav.id = "pasoNav";
  nav.innerHTML = `
    <button type="button" class="btn ghost" id="prev">← Anterior</button>
    <button type="button" class="btn" id="next">Siguiente →</button>
    <button type="submit" class="btn" id="send">Enviar respuestas</button>
    <span class="hint" id="sendHint">Revise que todas las preguntas visibles estén respondidas.</span>`;
  f.append(nav);
  f.append(Object.assign(document.createElement("div"), { id: "formMsg" }));

  $("#prev").addEventListener("click", anterior);
  $("#next").addEventListener("click", siguiente);

  // Enter dentro de un campo avanza de paso; solo en el último envía.
  f.onsubmit = (e) => {
    e.preventDefault();
    const vis = pasosVisibles();
    if (vis.indexOf(pasoActual) < vis.length - 1) { siguiente(); return; }
    emitir("innovatea:enviar", { rol });
  };

  pasos[0].hidden = false;
  if (rol === "docentes") renderizarFichas(); else cambio();
  mostrar("formView");
}

function renderizarFichas() {
  registro = registro.filter((r) => r.store === A);
  const lista = $("#stList");
  lista.innerHTML = "";
  S.forEach((st, i) => {
    const card = document.createElement("article");
    card.className = "student";
    card.innerHTML = `<header><h3>Estudiante ${i + 1}</h3><button type="button" class="btn ghost small" data-rm="${i}">Quitar ficha</button></header>`;
    DOC_ESTUDIANTE.forEach((s) => card.append(seccion(s, st, `s${i}-`, "estudiante", i)));
    lista.append(card);
  });
  // Quitar ficha pide una segunda pulsación: evita borrados accidentales.
  lista.querySelectorAll("[data-rm]").forEach((b) =>
    b.addEventListener("click", () => {
      const i = Number(b.dataset.rm);
      if (b.dataset.armed) { S.splice(i, 1); renderizarFichas(); return; }
      b.dataset.armed = "1";
      b.textContent = "¿Quitar? Toque de nuevo";
      setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = "Quitar ficha"; } }, 3000);
    }));
  cambio();
}

function sincronizarFichas() {
  const h = $("#stHint");
  if (!h) return;
  const n = Number(A.d6 || 0);
  h.textContent = requiereFichas()
    ? `Registró ${A.d5 === "Sí" ? n + " estudiante(s) con autismo" : "estudiantes con otras condiciones"}. Lleva ${S.length} ficha(s) diligenciada(s).`
    : "";
}

/** ¿El rol y las respuestas actuales exigen al menos una ficha de estudiante? */
export const requiereFichas = () => rolActual === "docentes" && (A.d5 === "Sí" || A.d7 === "Sí");

/* =====================================================================
   Acceso para los demás módulos
   ===================================================================== */

export const obtenerRegistro = () => registro;
export const rol = () => rolActual;
export const numeroDeFichas = () => S.length;

/** Recibe descriptores { id, ambito, indice } de transformador.js, resalta
    las preguntas correspondientes y lleva a la capa de la primera. */
export function marcarFaltantes(faltantes) {
  const elementos = faltantes
    .map((f) => registro.find((r) => r.q.id === f.id && r.ambito === f.ambito && r.indice === f.indice))
    .filter(Boolean);
  elementos.forEach((r) => r.el.classList.add("missing"));
  if (elementos.length) llevarA(elementos[0].el);
}

export function mensaje(html, clase = "bad") {
  const m = $("#formMsg");
  if (m) m.innerHTML = html ? `<div class="notice ${clase}">${html}</div>` : "";
}

export function irA(sel) {
  const el = $(sel);
  if (el) llevarA(el, "start");
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

function guardarBorrador() {
  try { localStorage.setItem(clave(rolActual), JSON.stringify({ A, S })); } catch (e) { /* modo privado */ }
}
function cargarBorrador(rol) {
  try { return JSON.parse(localStorage.getItem(clave(rol)) || "{}"); } catch (e) { return {}; }
}
export function limpiarBorrador(rol) {
  try { localStorage.removeItem(clave(rol || rolActual)); } catch (e) { /* modo privado */ }
  A = {}; S = [];
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
