/* main.js — Controlador principal. Es el único archivo que se enlaza
   desde WordPress:

     <script type="module"
       src="https://cdn.jsdelivr.net/gh/transformaciondigital2026/formularioinnovatea@v1.1.0/main.js"></script>

   Su trabajo es coordinar los módulos, no contener lógica propia:
     ui.js           dibuja y avisa cuando el usuario actúa
     recolector.js   lee el DOM en el momento del envío
     transformador.js limpia, valida y arma las filas de la hoja
     exportador.js   manda las filas a Google Sheets

   La página pública solo escribe. El panel de resultados vive aparte, en
   un Web App privado de Apps Script protegido con cuenta de Google, para
   que ningún visitante del sitio pueda leer las respuestas. */

import { CONFIG } from "./config.js";
import * as ui from "./modulos/ui.js";
import { extraerDatosDelDOM } from "./modulos/recolector.js";
import { limpiarDatos } from "./modulos/transformador.js";
import { enviarASheets, reintentarPendientes, pendientes } from "./modulos/exportador.js";

/* La base se deduce de la ubicación de este archivo, de modo que los
   estilos y la imagen salen del mismo origen sin configurar nada. */
const base = CONFIG.BASE || new URL(".", import.meta.url).href;
const config = { ...CONFIG, BASE: base };

function cargarEstilos() {
  const href = base + "estilos/innovatea.css";
  if (document.querySelector(`link[href="${href}"]`)) return;
  document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href }));

  const fuentes = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap";
  if (!document.querySelector(`link[href="${fuentes}"]`)) {
    document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href: fuentes }));
  }
}

function contenedor() {
  let el = document.getElementById("innovatea-app");
  if (!el) {
    // Basta con la etiqueta <script>: el contenedor se crea justo donde está,
    // para que el formulario aparezca en el lugar del bloque de WordPress.
    // (En un módulo document.currentScript es null, así que la etiqueta se
    // localiza comparando su src con la URL de este propio archivo.)
    el = document.createElement("div");
    el.id = "innovatea-app";
    const propio = [...document.querySelectorAll("script[src]")].find((s) => s.src === import.meta.url);
    if (propio && propio.parentNode) propio.parentNode.insertBefore(el, propio);
    else document.body.append(el);
  }
  // "alignwide" es la clase con la que WordPress deja salir un bloque del
  // ancho de contenido angosto; sin ella el tema lo encoge y lo centra.
  el.classList.add("alignwide");
  return el;
}

/* =====================================================================
   Envío de una encuesta
   ===================================================================== */

async function alEnviar(rol) {
  ui.mensaje("");

  // 1. Capturar lo que hay en pantalla.
  const crudos = extraerDatosDelDOM(ui.obtenerRegistro());

  // 2. Limpiar, validar y aplanar.
  const resultado = limpiarDatos(crudos, rol);
  if (!resultado.ok) {
    // Primero se navega (eso limpia el mensaje anterior) y luego se avisa.
    if (resultado.faltantes.length) ui.marcarFaltantes(resultado.faltantes);
    else ui.irA(".fin-ficha");
    ui.mensaje(resultado.mensaje);
    return;
  }

  // 3. Enviar a la hoja de cálculo.
  ui.bloquearEnvio(true, "Enviando…");
  try {
    const envio = await enviarASheets(resultado.registro, resultado.destinos, config);
    ui.limpiarBorrador(rol);
    if (envio.ok) {
      ui.finalizar();
    } else {
      // No hubo conexión, pero el envío quedó guardado en este navegador y
      // sale solo la próxima vez que se abra el formulario con señal.
      console.warn("INNOVATEA: envío encolado —", envio.error);
      ui.finalizar("No había conexión en este momento, así que su respuesta quedó guardada en este dispositivo. Vuelva a abrir el formulario cuando tenga señal y se enviará sola. No la diligencie de nuevo.");
    }
  } catch (err) {
    ui.mensaje(`No se pudo enviar: ${err.message} Sus respuestas siguen guardadas en este navegador; intente de nuevo.`);
  } finally {
    ui.bloquearEnvio(false);
  }
}

/* =====================================================================
   Arranque
   ===================================================================== */

function iniciar() {
  cargarEstilos();
  const raiz = contenedor();
  ui.montar(raiz, config);
  ui.iniciarPantallaBienvenida();

  raiz.addEventListener("innovatea:rol", (e) => ui.renderizarFormulario(e.detail.rol));
  raiz.addEventListener("innovatea:enviar", (e) => alEnviar(e.detail.rol));

  // Encuestas que quedaron sin salir por falta de conexión.
  if (pendientes()) {
    reintentarPendientes(config).then((n) => {
      if (n) console.info(`INNOVATEA: se enviaron ${n} encuesta(s) que estaban pendientes.`);
    });
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
else iniciar();
