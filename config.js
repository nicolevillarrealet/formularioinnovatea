/* config.js — Lo único que hay que editar para poner el formulario en marcha.

   En este archivo no va ninguna clave ni ningún secreto, a propósito:
   todo lo que está aquí lo descarga el navegador de cualquier visitante,
   sea el repositorio público o privado. La única URL que aparece es la del
   Web App que recibe los envíos, que solo sabe escribir y nunca devuelve
   respuestas. Quién puede leer los datos se decide en Google, no aquí.

   Después de cambiar algo, haga commit y push: jsDelivr sirve la versión
   nueva (puede tardar unos minutos en refrescar su caché). */

export const CONFIG = {

  /* URL /exec del Web App de Google Apps Script que recibe las encuestas.
     Se obtiene implementando apps-script/Codigo.gs. Ver el README. */
  ENDPOINT_SHEETS: "https://script.google.com/macros/s/AKfycbzALRubDZJ2PuiKzKw2MQdtZCyfJo8c-REMApMB4mBIzy-u_Mc73FTQENYndU8PDlax5A/exec",

  /* Deje vacío para que la hoja de estilos se cargue desde el mismo sitio
     donde está main.js (jsDelivr). Solo se cambia si aloja los archivos
     en otra ruta. */
  BASE: "",
};
