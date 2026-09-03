/* ===========================================================
   Sección de encuesta de la portada: contador en vivo + vista
   previa de un gráfico.

   Los datos son los mismos del dashboard y se piden con la misma
   función (window.TFC_DASHBOARD.pedirDatos): el servidor ya decidió
   qué es publicable, acá no se filtra nada.

   Tres estados posibles, y ninguno es un cero pelado:
     · total ≥ mínimo de publicación → el número, contando hacia arriba;
     · total < mínimo                → mensaje de "recién empieza";
     · sin conexión o sin configurar → mensaje neutro, nunca un error
       técnico en la primera pantalla del sitio.
   =========================================================== */

(function () {
  'use strict';

  var caja = document.getElementById('panel-encuesta');
  if (!caja) return;

  var numero = document.getElementById('contador-numero');
  var etiqueta = document.getElementById('contador-etiqueta');
  var espera = document.getElementById('contador-espera');
  var anuncio = document.getElementById('contador-anuncio');
  var preview = document.getElementById('preview-grafico');

  var MINIMO_POR_DEFECTO = 5;

  var total = null;      /* null mientras no llegaron los datos */
  var visible = false;   /* si la sección ya entró en pantalla */
  var animado = false;

  var sinMovimiento = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Estados ---------- */

  function mostrarNumero(n) {
    espera.hidden = true;
    numero.hidden = false;
    etiqueta.hidden = false;
    numero.textContent = '0';
    anuncio.textContent = n === 1
      ? '1 respuesta hasta ahora.'
      : n + ' respuestas hasta ahora.';
  }

  function mostrarMensaje(texto) {
    numero.hidden = true;
    etiqueta.hidden = true;
    espera.hidden = false;
    espera.textContent = texto;
    anuncio.textContent = texto;
  }

  /* ---------- Contador ---------- */

  /* Arranca solo cuando se dan las dos cosas: que haya número y que la
     sección esté a la vista. Cuál de las dos llega primero depende de la
     red y del scroll, así que no se puede encadenar una con la otra. */
  function intentarAnimar() {
    if (animado || total === null || !visible) return;
    animado = true;

    if (sinMovimiento) {
      numero.textContent = String(total);
      return;
    }

    var inicio = null;
    var duracion = 1400;

    function paso(ahora) {
      if (inicio === null) inicio = ahora;
      var avance = Math.min((ahora - inicio) / duracion, 1);
      /* easeOutCubic: arranca rápido y frena, que es como se lee un
         contador; lineal parece una barra de carga. */
      var suave = 1 - Math.pow(1 - avance, 3);
      numero.textContent = String(Math.round(suave * total));
      if (avance < 1) requestAnimationFrame(paso);
    }

    requestAnimationFrame(paso);
  }

  function observarEntrada() {
    if (!window.IntersectionObserver) {
      visible = true;
      intentarAnimar();
      return;
    }

    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        visible = true;
        observador.disconnect();
        intentarAnimar();
      });
    }, { threshold: 0.35 });

    observador.observe(caja);
  }

  /* ---------- Vista previa ---------- */

  /* Se elige el trayecto con más respuestas que tenga alguna pregunta
     publicada, y de ahí la primera. Con pocos datos casi nunca hay más
     de un candidato; cuando los haya, el más grande es el que mejor
     representa lo que se va a ver en el tablero completo. */
  function elegirPregunta(datos) {
    var mejor = null;

    function considerar(clave, info) {
      if (!info) return;

      var ids = Object.keys(info.preguntas || {});
      if (!ids.length) return;

      if (!mejor || info.n > mejor.n) {
        mejor = {
          track: clave,
          nombre: info.nombre,
          n: info.n,
          id: ids[0],
          pregunta: info.preguntas[ids[0]]
        };
      }
    }

    (window.TFC_DASHBOARD.ORDEN_TRACKS || []).forEach(function (track) {
      considerar(track, datos.tracks && datos.tracks[track]);
    });
    considerar('ciudad', datos.ciudad);

    return mejor;
  }

  function dibujarPreview(datos) {
    if (!window.Chart || !preview) return;

    var elegida = elegirPregunta(datos);
    if (!elegida) return;

    var titulo = document.createElement('p');
    titulo.className = 'antetitulo';
    titulo.textContent = 'Un dato: ' + elegida.nombre;
    preview.appendChild(titulo);

    window.TFC_DASHBOARD.renderGrafico(preview, elegida.track, elegida.id, elegida.pregunta);
    preview.classList.remove('oculto');
  }

  /* ---------- Arranque ---------- */

  observarEntrada();

  if (!window.TFC_DASHBOARD) {
    mostrarMensaje('Los resultados se van a publicar acá.');
    return;
  }

  window.TFC_DASHBOARD.pedirDatos()
    .then(function (datos) {
      var minimo = datos.minimo_publicacion || MINIMO_POR_DEFECTO;

      /* El contador es del relevamiento entero, no de una encuesta:
         suma los cinco trayectos de vivienda más la hoja de ciudad. */
      var suma = 0;
      (window.TFC_DASHBOARD.ORDEN_TRACKS || []).forEach(function (track) {
        var info = datos.tracks && datos.tracks[track];
        if (info && typeof info.n === 'number') suma += info.n;
      });
      if (datos.ciudad && typeof datos.ciudad.n === 'number') suma += datos.ciudad.n;

      /* Debajo del mínimo el número no se muestra: "3 respuestas" en la
         portada desalienta más de lo que invita, y además es el mismo
         umbral con el que el servidor decide publicar una pregunta. */
      if (suma < minimo) {
        mostrarMensaje('La encuesta recién empieza: tu respuesta es de las primeras.');
        return;
      }

      total = suma;
      mostrarNumero(suma);
      intentarAnimar();
      dibujarPreview(datos);
    })
    .catch(function () {
      mostrarMensaje('Los resultados se van a publicar acá.');
    });
})();
