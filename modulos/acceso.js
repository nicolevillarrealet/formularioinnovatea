/* acceso.js — Verificación del correo antes de la encuesta.

   1. La persona escribe su correo y pide un código.
   2. Codigo.gs le envía 6 dígitos al correo (MailApp).
   3. Los escribe aquí; Codigo.gs los comprueba y devuelve un "pase"
      firmado con el correo y la lista de encuestas que ese correo ya envió.

   El pase acompaña al envío final y Codigo.gs lo vuelve a comprobar: nada
   de lo que se decide aquí cuenta por sí solo. Se guarda en este navegador
   (vale 72 horas) para que quien deja la encuesta a medias pueda volver
   sin pedir otro código; se borra al enviar o con "Usar otro correo". */

import { pedirCodigo, verificarCodigo } from "./exportador.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CLAVE = "innovatea-acceso";
const VIGENCIA_MS = 71 * 3600 * 1000; // un poco menos que en el servidor

let memoria = null; // por si el navegador no deja guardar

function leer() {
  let s = memoria;
  try { s = JSON.parse(localStorage.getItem(CLAVE) || "null") || memoria; } catch (e) { /* modo privado */ }
  if (!s || !s.pase || Date.now() - s.t > VIGENCIA_MS) return null;
  return s;
}
function guardar(s) {
  memoria = s;
  try { s ? localStorage.setItem(CLAVE, JSON.stringify(s)) : localStorage.removeItem(CLAVE); } catch (e) { /* modo privado */ }
}

/**
 * Dibuja la verificación en `contenedor`.
 * @param {HTMLElement} contenedor
 * @param {Object} config  (ENDPOINT_SHEETS)
 * @param {{alCambiar:Function, antesDePedir?:Function}} ops
 *   alCambiar(sesion|null)  sesion = { correo, pase, usadas }
 *   antesDePedir() → mensaje de error o "" (p. ej., falta la autorización de datos)
 */
export function montarAcceso(contenedor, config, ops) {
  let correo = "";
  let reloj = null;

  const avisar = (html, clase = "bad") => {
    const m = contenedor.querySelector(".acc-msg");
    if (m) m.innerHTML = html ? `<div class="notice ${clase}">${html}</div>` : "";
  };
  const ocupado = (btn, si, texto) => { btn.disabled = si; if (texto) btn.textContent = texto; };

  function pasoCorreo(valor = "") {
    clearInterval(reloj);
    contenedor.innerHTML = `
      <p class="acc-titulo">Verifique su correo para comenzar</p>
      <p class="hint">Le enviaremos un código de 6 dígitos. Cada correo puede enviar una encuesta de rector y una de docente.</p>
      <form class="acc-fila" novalidate>
        <label class="sr" for="accCorreo">Correo electrónico</label>
        <input type="email" id="accCorreo" autocomplete="email" inputmode="email" placeholder="nombre@correo.com" value="${esc(valor)}" required>
        <button type="submit" class="btn">Enviar código</button>
      </form>
      <div class="acc-msg" aria-live="polite"></div>`;
    const f = contenedor.querySelector("form");
    const inp = contenedor.querySelector("#accCorreo");
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const previo = ops.antesDePedir ? ops.antesDePedir() : "";
      if (previo) { avisar(previo); return; }
      const c = inp.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)) { avisar("Escriba un correo electrónico válido."); inp.focus(); return; }
      const btn = f.querySelector("button");
      ocupado(btn, true, "Enviando…");
      try {
        const r = await pedirCodigo(c, config);
        correo = c;
        pasoCodigo(r.espera || 60);
      } catch (err) {
        avisar(esc(err.message));
        ocupado(btn, false, "Enviar código");
      }
    });
  }

  function pasoCodigo(espera) {
    contenedor.innerHTML = `
      <p class="acc-titulo">Escriba el código que enviamos a <strong>${esc(correo)}</strong></p>
      <p class="hint">Vence en 15 minutos. Si no lo ve, revise la carpeta de spam o correo no deseado.</p>
      <form class="acc-fila acc-form-codigo" novalidate>
        <div class="acc-cajas" role="group" aria-label="Código de 6 dígitos">
          ${[0, 1, 2, 3, 4, 5].map((i) => `<input type="text" class="acc-digito" inputmode="numeric" pattern="[0-9]*"
            maxlength="1" aria-label="Dígito ${i + 1} de 6" ${i === 0 ? 'autocomplete="one-time-code"' : 'autocomplete="off"'}>`).join("")}
        </div>
        <button type="submit" class="btn">Verificar</button>
      </form>
      <div class="acc-acciones">
        <button type="button" class="btn ghost small" data-reenviar disabled></button>
        <button type="button" class="btn ghost small" data-cambiar>Cambiar correo</button>
      </div>
      <div class="acc-msg" aria-live="polite"></div>`;
    const f = contenedor.querySelector("form");
    const cajas = [...contenedor.querySelectorAll(".acc-digito")];
    const reenviar = contenedor.querySelector("[data-reenviar]");
    const leerCodigo = () => cajas.map((c) => c.value).join("");
    const limpiarCajas = () => { cajas.forEach((c) => { c.value = ""; c.dataset.v = ""; c.classList.remove("lleno"); }); cajas[0].focus(); };
    const marcar = () => cajas.forEach((c) => c.classList.toggle("lleno", !!c.value));

    /** Reparte dígitos desde la caja `desde` (al escribir o al pegar). */
    const repartir = (texto, desde) => {
      const digitos = String(texto).replace(/\D/g, "").slice(0, 6 - desde).split("");
      digitos.forEach((d, k) => { cajas[desde + k].value = d; cajas[desde + k].dataset.v = d; });
      marcar();
      const siguiente = Math.min(desde + digitos.length, 5);
      cajas[siguiente].focus();
      cajas[siguiente].select();
      if (leerCodigo().length === 6) f.requestSubmit();
    };

    cajas.forEach((caja, i) => {
      caja.addEventListener("focus", () => caja.select());
      caja.addEventListener("input", (e) => {
        const v = caja.value.replace(/\D/g, "");
        // Una letra no borra el dígito que había; borrar sí lo borra.
        const borrar = e.inputType && e.inputType.startsWith("delete");
        caja.value = borrar ? "" : (caja.dataset.v || "");
        f.classList.remove("acc-error"); // el rojo del error se va al volver a escribir
        if (v) repartir(v, i);
        cajas.forEach((c) => { c.dataset.v = c.value; });
        marcar();
      });
      caja.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !caja.value && i > 0) {
          e.preventDefault();
          cajas[i - 1].value = "";
          cajas[i - 1].dataset.v = "";
          cajas[i - 1].focus();
          marcar();
        } else if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); cajas[i - 1].focus(); }
        else if (e.key === "ArrowRight" && i < 5) { e.preventDefault(); cajas[i + 1].focus(); }
      });
      caja.addEventListener("paste", (e) => {
        e.preventDefault();
        repartir((e.clipboardData || window.clipboardData).getData("text"), i);
      });
    });
    cajas[0].focus();

    let quedan = espera;
    const tic = () => {
      reenviar.disabled = quedan > 0;
      reenviar.textContent = quedan > 0 ? `Reenviar código (${quedan} s)` : "Reenviar código";
      quedan--;
      if (quedan < -1) clearInterval(reloj);
    };
    clearInterval(reloj);
    reloj = setInterval(tic, 1000);
    tic();

    reenviar.addEventListener("click", async () => {
      ocupado(reenviar, true, "Enviando…");
      try {
        const r = await pedirCodigo(correo, config);
        avisar("Le enviamos un código nuevo. El anterior ya no sirve.", "info");
        quedan = r.espera || 60;
        clearInterval(reloj); reloj = setInterval(tic, 1000); tic();
      } catch (err) {
        avisar(esc(err.message));
        ocupado(reenviar, false, "Reenviar código");
      }
    });
    contenedor.querySelector("[data-cambiar]").addEventListener("click", () => pasoCorreo(correo));

    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const codigo = leerCodigo();
      if (codigo.length !== 6) { avisar("Escriba los 6 dígitos del código."); cajas[codigo.length].focus(); return; }
      const btn = f.querySelector("button");
      ocupado(btn, true, "Verificando…");
      try {
        const r = await verificarCodigo(correo, codigo, config);
        const sesion = { correo: r.correo || correo, pase: r.pase, usadas: r.usadas || [], t: Date.now() };
        guardar(sesion);
        pasoListo(sesion);
      } catch (err) {
        avisar(esc(err.message));
        ocupado(btn, false, "Verificar");
        f.classList.remove("acc-error"); void f.offsetWidth; f.classList.add("acc-error");
        limpiarCajas();
      }
    });
  }

  function pasoListo(s) {
    clearInterval(reloj);
    contenedor.classList.add("acc-ok");
    contenedor.innerHTML = `
      <p class="acc-listo"><span class="acc-check" aria-hidden="true">✓</span>
        <span>Correo verificado: <strong>${esc(s.correo)}</strong></span>
        <button type="button" class="btn ghost small" data-otro>Usar otro correo</button></p>
      <div class="acc-msg" aria-live="polite"></div>`;
    contenedor.querySelector("[data-otro]").addEventListener("click", () => {
      guardar(null);
      contenedor.classList.remove("acc-ok");
      ops.alCambiar(null);
      pasoCorreo("");
    });
    ops.alCambiar(s);
  }

  const previa = leer();
  if (previa) pasoListo(previa); else pasoCorreo("");

  return {
    /** La sesión vigente, o null. */
    sesion: () => leer(),
    /** Tras un envío: se anota la encuesta enviada y se cierra la sesión,
        para que en un computador compartido la siguiente persona verifique
        su propio correo. */
    cerrar() {
      guardar(null);
      contenedor.classList.remove("acc-ok");
      ops.alCambiar(null);
      pasoCorreo("");
    },
  };
}
