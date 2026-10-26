/* config.js — Lo único que hay que editar para poner el formulario en marcha.
   Después de cambiar algo aquí, haga commit y push: jsDelivr sirve la
   versión nueva (puede tardar unos minutos en refrescar su caché). */

export const CONFIG = {

  /* URL /exec del Web App de Google Apps Script.
     Se obtiene en: Extensiones → Apps Script → Implementar → Nueva
     implementación → Aplicación web → Ejecutar como "Yo" y acceso
     "Cualquier usuario". Ver apps-script/Codigo.gs y el README. */
  ENDPOINT_SHEETS: "",

  /* Id de la hoja de cálculo, solo para el botón "Abrir hoja de cálculo"
     del panel. Es la parte larga de la URL de Google Sheets. */
  ID_HOJA: "1bEUL_mvQ-tdjiNnniA2eLn_5FgDSXQVSIO2N_Os8e8E",

  /* Si se define, en el inicio aparece el enlace al panel de resultados y
     se pide esta clave. Déjela vacía para que el panel no exista en el
     sitio público y la coordinación consulte directamente la hoja.
     Ojo: esta clave es visible en el código del sitio. Sirve para que un
     visitante no entre por curiosidad, no como control de acceso real. */
  CLAVE_PANEL: "",

  /* Cada cuánto vuelve a consultar el panel, en milisegundos. */
  INTERVALO_PANEL_MS: 30000,

  /* El banner de bienvenida se puede apagar si la página de WordPress ya
     tiene su propia cabecera con el mismo contenido. */
  MOSTRAR_BANNER: true,

  /* Deje vacío para que los estilos y la imagen se carguen desde el mismo
     sitio donde está main.js (jsDelivr). Solo se cambia si aloja los
     archivos en otra ruta. */
  BASE: "",
};
