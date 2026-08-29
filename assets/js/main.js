/* ===========================================================
   Utilidades compartidas por todas las páginas del sitio.
   Vanilla JS, sin dependencias.
   =========================================================== */

(function () {
  'use strict';

  /* Marca el link de navegación de la página actual con aria-current,
     así el estilo activo no hay que mantenerlo a mano en cada HTML. */
  function marcarNavActual() {
    var actual = window.location.pathname.split('/').pop() || 'index.html';
    var links = document.querySelectorAll('.nav-principal a');

    Array.prototype.forEach.call(links, function (link) {
      var destino = link.getAttribute('href');
      if (destino === actual) {
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  /* Año del footer, para no tener que actualizarlo a mano. */
  function completarAnio() {
    var slots = document.querySelectorAll('[data-anio-actual]');
    var anio = String(new Date().getFullYear());

    Array.prototype.forEach.call(slots, function (slot) {
      slot.textContent = anio;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    marcarNavActual();
    completarAnio();
  });
})();
