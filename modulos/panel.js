/* panel.js — Panel de resultados para la coordinación del proyecto.

   Este módulo NO se carga en la página pública del formulario. Lo usa la
   página servida por apps-script/Panel.gs, que es un Web App privado: para
   abrirlo hay que estar en la lista de personas autorizadas y haber
   iniciado sesión con Google. Así ningún visitante del sitio puede llegar
   a las respuestas, y en el repositorio no queda ninguna clave.

   Aquí solo se dibuja. Quién trae los datos y cada cuánto lo decide la
   página que llama a `montar`. */

import { descargarCsv } from "./exportador.js";
import { aFilas } from "./transformador.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let registros = [];

/**
 * Prepara el panel dentro de un contenedor.
 * @param {HTMLElement} contenedor
 * @param {{urlHoja?:string}} opciones
 * @returns {{actualizar:Function, error:Function}} para alimentarlo con datos
 */
export function montar(contenedor, opciones = {}) {
  contenedor.innerHTML = `
    <div class="actions" style="margin-top:0">
      ${opciones.urlHoja ? `<a class="btn small" href="${esc(opciones.urlHoja)}" target="_blank" rel="noopener">Abrir hoja de cálculo</a>` : ""}
      <button class="btn ghost small" type="button" id="pCsv">Descargar respaldo CSV</button>
    </div>
    <h2 style="font-size:1.8rem;margin-top:18px">Panel de resultados</h2>
    <p class="hint" id="pState">Cargando respuestas…</p>
    <div id="pBody"></div>`;

  contenedor.querySelector("#pCsv").addEventListener("click", () => {
    const filas = registros.flatMap((r) => aFilas(r).flatMap((d) => d.filas.map((f) => ({ hoja: d.hoja, ...f }))));
    descargarCsv(filas, `innovatea-respaldo-${new Date().toISOString().slice(0, 10)}.csv`);
  });

  return {
    actualizar(nuevos) { registros = nuevos || []; pintar(contenedor); },
    error(mensaje) { contenedor.querySelector("#pState").textContent = "No se pudieron cargar las respuestas: " + mensaje; },
  };
}

/* ---------- Conteos ---------- */

function contar(lista) {
  const m = {};
  lista.forEach((v) => (Array.isArray(v) ? v : [v]).forEach((x) => { if (x !== undefined) m[x] = (m[x] || 0) + 1; }));
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

function barras(entradas) {
  const max = Math.max(1, ...entradas.map((e) => e[1]));
  const filas = entradas.map(([k, v]) =>
    `<div class="brow"><span>${esc(k)}</span><b style="text-align:right">${v}</b><div class="track"><i style="width:${(v / max) * 100}%"></i></div></div>`).join("");
  return `<div class="bars">${filas || '<p class="hint">Sin datos todavía.</p>'}</div>`;
}

/* ---------- Render ---------- */

function pintar(contenedor) {
  const R = registros.filter((r) => r.tipo === "rector");
  const D = registros.filter((r) => r.tipo === "docente");
  const n = (r, k) => Number((r.respuestas || {})[k] || 0);

  const conSoporte = R.reduce((s, r) => s + n(r, "r7"), 0);
  const sinSoporte = R.reduce((s, r) => s + n(r, "r8"), 0);
  const fichas = D.reduce((s, r) => s + (r.estudiantes || []).length, 0);
  const est = D.flatMap((r) => r.estudiantes || []);

  contenedor.querySelector("#pState").textContent = registros.length
    ? `${registros.length} respuesta(s) registradas. Se actualiza automáticamente.`
    : "Aún no hay respuestas. Aparecerán aquí a medida que rectores y docentes envíen la encuesta.";

  const porMunicipio = {};
  registros.forEach((r) => {
    const m = r.municipio || "Sin municipio";
    porMunicipio[m] = porMunicipio[m] || { r: 0, d: 0, aut: 0, f: 0 };
    if (r.tipo === "rector") { porMunicipio[m].r++; porMunicipio[m].aut += n(r, "r7") + n(r, "r8"); }
    else { porMunicipio[m].d++; porMunicipio[m].f += (r.estudiantes || []).length; }
  });
  const filasMun = Object.entries(porMunicipio).sort((a, b) => b[1].aut - a[1].aut || a[0].localeCompare(b[0]));

  contenedor.querySelector("#pBody").innerHTML = `
   <div class="tiles">
    <div class="tile"><b>${R.length}</b><span>Encuestas de rectores</span></div>
    <div class="tile"><b>${D.length}</b><span>Encuestas de docentes</span></div>
    <div class="tile"><b>${conSoporte + sinSoporte}</b><span>Estudiantes autistas reportados por rectores</span></div>
    <div class="tile"><b>${fichas}</b><span>Fichas de estudiante (docentes)</span></div>
   </div>
   <p class="hint" style="margin-top:8px">De los reportados por rectores: ${conSoporte} con soporte documental y ${sinSoporte} informados por la familia sin soporte.</p>

   <h2>Por municipio</h2>
   <div class="tablewrap"><table><thead><tr><th>Municipio</th><th class="num">Rectores</th><th class="num">Docentes</th><th class="num">Autismo (rectores)</th><th class="num">Fichas</th></tr></thead><tbody>
    ${filasMun.map(([m, v]) => `<tr><td>${esc(m)}</td><td class="num">${v.r}</td><td class="num">${v.d}</td><td class="num">${v.aut}</td><td class="num">${v.f}</td></tr>`).join("")
      || '<tr><td colspan="5" class="hint">Sin datos todavía.</td></tr>'}
    <tr><td>Municipios con respuesta</td><td colspan="4" class="num">${filasMun.length} de 64</td></tr>
   </tbody></table></div>

   <h2>Quién ha respondido</h2>
   <p class="hint">Uso interno de la coordinación. No incluya esta lista en informes.</p>
   <div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Encuesta</th><th>Nombre</th><th>Contacto</th><th>Institución</th><th>Municipio</th></tr></thead><tbody>
    ${[...registros].sort((a, b) => String(b.enviado).localeCompare(String(a.enviado)))
      .map((r) => `<tr><td>${esc(String(r.enviado || "").slice(0, 10))}</td><td>${r.tipo === "rector" ? "Rector" : "Docente"}</td><td>${esc(r.nombre || "Sin nombre")}</td><td>${esc(r.contacto || "")}</td><td>${esc(r.institucion || "")}</td><td>${esc(r.municipio || "")}</td></tr>`).join("")
      || '<tr><td colspan="6" class="hint">Sin respuestas todavía.</td></tr>'}
   </tbody></table></div>

   <h2>Necesidades institucionales prioritarias (rectores, p. 28)</h2>${barras(contar(R.map((r) => r.respuestas?.r28)))}
   <h2>Situación diagnóstica de los estudiantes (docentes, p. 22)</h2>${barras(contar(est.map((e) => e.e22)))}
   <h2>Dificultades de acceso a salud (docentes, p. 27)</h2>${barras(contar(est.map((e) => e.e27)))}
   <h2>Temas de formación solicitados (docentes, p. 44)</h2>${barras(contar(D.map((r) => r.respuestas?.d44)))}`;
}
