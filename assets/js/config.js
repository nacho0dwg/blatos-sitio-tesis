/* ===========================================================
   Configuración compartida del sitio.

   ÚNICO lugar donde va la URL del Apps Script.
   La usan encuesta-vivienda.js (POST) y dashboard.js (GET).

   La URL apunta a un deployment fijo, así que NO hay que
   volver a tocarla al cambiar el backend: los redeploys van con
       clasp push
       clasp deploy -i AKfycbz4ADkzPwXcUroimeqC4FcT1PItIcSXwfyJT4DM9L2uSf2Edle66fHEdkhM0R9epNtJ
   y conservan esta misma URL. Ver CLAUDE.md.
   =========================================================== */

window.TFC_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz4ADkzPwXcUroimeqC4FcT1PItIcSXwfyJT4DM9L2uSf2Edle66fHEdkhM0R9epNtJ/exec',
};

window.TFC_CONFIG.estaConfigurado = function () {
  var url = window.TFC_CONFIG.APPS_SCRIPT_URL;
  return typeof url === 'string' && url.indexOf('https://') === 0;
};
