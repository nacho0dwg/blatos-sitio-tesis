/* ===========================================================
   Dashboard público de resultados.

   Solo dibuja lo que el servidor mandó. No filtra ni decide
   qué es publicable: eso ya lo resolvió Apps Script (doGet),
   que omite las preguntas con menos de 5 respuestas.

   Si una pregunta no vino, acá no existe. Es a propósito.
   =========================================================== */

(function () {
  'use strict';

  /* Un color por trayecto: cada gráfico es de una sola serie, así que el
     color identifica al grupo, no a la opción. Los cinco tonos se
     distinguen también en escala de grises y para los tres tipos de
     daltonismo más comunes.

     Hay dos juegos porque la página de resultados pasó a fondo carbón:
     los tonos oscuros que funcionaban sobre hueso —el violeta sobre todo—
     ahí se hunden. Son los mismos matices, aclarados. */
  var PALETA_CLARA = {
    A: '#2a78d6',
    B: '#eb6834',
    C: '#1baf7a',
    D1: '#4a3aa7',
    D2: '#a01f5e',
    /* La encuesta de ciudad no es un trayecto más: va en un ocre que no
       compite con ninguno de los cinco. */
    ciudad: '#8a6a12'
  };

  var PALETA_OSCURA = {
    A: '#63a6f0',
    B: '#f0885a',
    C: '#3fc79a',
    D1: '#a795f5',
    D2: '#f0679f',
    ciudad: '#d6b043'
  };

  var esOscuro = document.body && document.body.classList.contains('tema-oscuro');

  var COLOR_TRACK = esOscuro ? PALETA_OSCURA : PALETA_CLARA;

  /* El relleno es el mismo color a baja opacidad: sobre carbón hace falta
     un poco más para que la barra se despegue del fondo. */
  var TINTE_TRACK = {};
  ['A', 'B', 'C', 'D1', 'D2', 'ciudad'].forEach(function (track) {
    TINTE_TRACK[track] = hexARgba(COLOR_TRACK[track], esOscuro ? 0.22 : 0.12);
  });

  function hexARgba(hex, alfa) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alfa + ')';
  }

  var ORDEN_TRACKS = ['A', 'B', 'C', 'D1', 'D2'];

  /* Chart.js dibuja en canvas: no hereda ni una variable CSS. Estos dos
     valores son los únicos colores del sitio que hay que mantener a mano
     acá, y son los tokens --text-muted y --color-borde. */
  var INK_SECUNDARIO = esOscuro ? '#a89e90' : '#52514e';
  var INK_GRILLA = esOscuro ? 'rgba(243, 237, 226, 0.14)' : '#e1e0d9';

  /* Escribe el valor al final de cada barra.
     Además de informar, cumple la regla de relieve: el dato nunca
     depende solo del color. */
  var pluginEtiquetas = {
    id: 'etiquetasValor',
    afterDatasetsDraw: function (chart) {
      var ctx = chart.ctx;
      var meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data) return;

      ctx.save();
      ctx.font = '600 12px "Segoe UI", Verdana, Arial, sans-serif';
      ctx.fillStyle = INK_SECUNDARIO;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

      var sufijo = (chart.options.plugins.etiquetasValor || {}).sufijo || '';

      meta.data.forEach(function (barra, i) {
        var valor = chart.data.datasets[0].data[i];
        if (valor === 0) return;
        ctx.fillText(String(valor) + sufijo, barra.x + 8, barra.y);
      });

      ctx.restore();
    }
  };

  /* Chart.js no corta las etiquetas del eje: si no entran, las recorta
     y deja "…o espacio propio". Partiéndolas en un array de líneas, las
     dibuja una debajo de la otra y se leen enteras. */
  var ANCHO_ETIQUETA = 19;

  function partirEtiqueta(texto) {
    if (texto.length <= ANCHO_ETIQUETA) return texto;

    var lineas = [];
    var actual = '';

    texto.split(' ').forEach(function (palabra) {
      if (!actual) { actual = palabra; return; }
      if ((actual + ' ' + palabra).length <= ANCHO_ETIQUETA) {
        actual += ' ' + palabra;
      } else {
        lineas.push(actual);
        actual = palabra;
      }
    });
    if (actual) lineas.push(actual);

    /* Más de tres líneas apila tanto que el gráfico deja de leerse:
       ahí sí se corta, pero con puntos suspensivos visibles. */
    if (lineas.length > 3) {
      lineas = lineas.slice(0, 3);
      lineas[2] += '…';
    }
    return lineas;
  }

  function altoDe(etiquetas) {
    return etiquetas.reduce(function (total, e) {
      var lineas = Array.isArray(e) ? e.length : 1;
      return total + Math.max(34, lineas * 17 + 16);
    }, 40);
  }

  function crear(tag, clase, texto) {
    var el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto != null) el.textContent = texto;
    return el;
  }

  /* ---------- Render de un gráfico ---------- */

  function renderGrafico(contenedor, track, idPregunta, pregunta) {
    var tarjeta = crear('div', 'tarjeta grafico-tarjeta');

    tarjeta.appendChild(crear('h3', null, pregunta.etiqueta));

    /* Las preguntas de orden se publican como "qué porcentaje la puso
       primera". Es la única lectura honesta con estos tamaños de
       muestra: un promedio de posiciones sobre 5 o 7 ítems comprime
       todo al centro y sugiere una precisión que no hay. Como no es
       obvio de dónde sale el número, se dice en el gráfico. */
    var esRanking = pregunta.tipo === 'ranking';
    if (esRanking) {
      tarjeta.appendChild(crear(
        'p', 'grafico-nota',
        'Porcentaje de quienes la pusieron en primer lugar.'
      ));
    }

    var canvas = document.createElement('canvas');
    canvas.id = 'grafico-' + track + '-' + idPregunta;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute(
      'aria-label',
      pregunta.etiqueta + '. Resultados en la tabla que está debajo del gráfico.'
    );

    /* La caja da la altura: Chart.js con maintainAspectRatio en false
       la toma del contenedor. Crece con la cantidad de opciones. */
    var etiquetas = pregunta.opciones.map(function (o) { return partirEtiqueta(o.etiqueta); });
    var cantidades = pregunta.opciones.map(function (o) { return o.cantidad; });

    var caja = crear('div', 'grafico-caja');
    caja.style.height = altoDe(etiquetas) + 'px';
    caja.appendChild(canvas);
    tarjeta.appendChild(caja);

    var valores = esRanking
      ? cantidades.map(function (c) { return Math.round((c / pregunta.n) * 100); })
      : cantidades;

    new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: etiquetas,
        datasets: [{
          data: valores,
          backgroundColor: TINTE_TRACK[track],
          borderColor: COLOR_TRACK[track],
          borderWidth: 2,
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 18,
          maxBarThickness: 22
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 34 } },
        plugins: {
          /* Una sola serie: la leyenda sería ruido, el título ya la nombra. */
          legend: { display: false },
          etiquetasValor: { sufijo: esRanking ? '%' : '' },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var i = ctx.dataIndex;
                if (esRanking) {
                  return valores[i] + '% la puso primera (' + cantidades[i] + ' de ' + pregunta.n + ')';
                }
                var total = cantidades.reduce(function (a, b) { return a + b; }, 0);
                var pct = total ? Math.round((cantidades[i] / total) * 100) : 0;
                return cantidades[i] + ' respuestas (' + pct + '%)';
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: esRanking ? 100 : undefined,
            ticks: {
              precision: 0,
              color: INK_SECUNDARIO,
              callback: function (v) { return esRanking ? v + '%' : v; }
            },
            grid: { color: INK_GRILLA, drawBorder: false }
          },
          y: {
            /* 11px y no 12: en la grilla de dos columnas la tarjeta mide
               unos 290px, y Chart.js le da al eje una fracción de eso.
               Con el cuerpo por defecto, las etiquetas se salen del canvas. */
            ticks: { color: INK_SECUNDARIO, autoSkip: false, font: { size: 11 } },
            grid: { display: false }
          }
        }
      },
      plugins: [pluginEtiquetas]
    });

    tarjeta.appendChild(crear(
      'p', 'grafico-n',
      'Respondieron esta pregunta: ' + pregunta.n + ' personas'
    ));

    tarjeta.appendChild(renderTabla(pregunta, esRanking, valores));
    contenedor.appendChild(tarjeta);
  }

  /* Vista de tabla: accesible por teclado y lector de pantalla,
     y respaldo cuando el color no alcanza. */
  function renderTabla(pregunta, esRanking, porcentajes) {
    var detalle = document.createElement('details');
    detalle.className = 'detalle-tabla';
    detalle.appendChild(crear('summary', null, 'Ver los números'));

    var tabla = crear('table', 'tabla-datos');
    var thead = document.createElement('thead');
    var filaCab = document.createElement('tr');

    var columnas = esRanking
      ? ['Opción', 'La pusieron primera', '%']
      : ['Opción', 'Respuestas'];

    columnas.forEach(function (t) { filaCab.appendChild(crear('th', null, t)); });
    thead.appendChild(filaCab);
    tabla.appendChild(thead);

    var tbody = document.createElement('tbody');
    pregunta.opciones.forEach(function (opcion, i) {
      var fila = document.createElement('tr');
      fila.appendChild(crear('td', null, opcion.etiqueta));
      fila.appendChild(crear('td', null, String(opcion.cantidad)));
      if (esRanking) fila.appendChild(crear('td', null, porcentajes[i] + '%'));
      tbody.appendChild(fila);
    });
    tabla.appendChild(tbody);

    detalle.appendChild(tabla);
    return detalle;
  }

  /* ---------- Render de un trayecto ---------- */

  function renderTrack(contenedor, track, datos) {
    var bloque = crear('section', 'track-bloque');
    bloque.style.setProperty('--color-track', COLOR_TRACK[track]);

    var encabezado = crear('div', 'track-titulo');
    encabezado.appendChild(crear('h2', null, datos.nombre));
    encabezado.appendChild(
      crear('span', 'badge-n', datos.n === 1 ? '1 respuesta' : datos.n + ' respuestas')
    );
    bloque.appendChild(encabezado);

    var ids = Object.keys(datos.preguntas);

    if (ids.length === 0) {
      bloque.appendChild(crear(
        'p',
        'sin-datos',
        'Todavía no hay suficientes respuestas en esta categoría como para mostrar resultados.'
      ));
      contenedor.appendChild(bloque);
      return;
    }

    var grilla = crear('div', 'grid-graficos');
    ids.forEach(function (id) {
      renderGrafico(grilla, track, id, datos.preguntas[id]);
    });
    bloque.appendChild(grilla);

    contenedor.appendChild(bloque);
  }

  /* ---------- Carga ---------- */

  /* El pedido al Apps Script, separado del render: la portada usa los
     mismos datos para el contador y no tiene por qué repetir esto. */
  function pedirDatos() {
    if (!window.TFC_CONFIG || !window.TFC_CONFIG.estaConfigurado()) {
      return Promise.reject(new Error('sin_configurar'));
    }

    return fetch(window.TFC_CONFIG.APPS_SCRIPT_URL, { method: 'GET' })
      .then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      })
      .then(function (datos) {
        if (datos.error) throw new Error(datos.error);
        return datos;
      });
  }

  function cargar() {
    var estado = document.getElementById('estado-carga');
    var error = document.getElementById('error-dashboard');
    var contenedor = document.getElementById('contenedor-tracks');

    /* El archivo también se carga en la portada, que usa solo la API de
       abajo: si no está el tablero, no hay nada que dibujar. */
    if (!contenedor) return;

    if (!window.TFC_CONFIG || !window.TFC_CONFIG.estaConfigurado()) {
      estado.classList.add('oculto');
      error.textContent = 'Los resultados todavía no están conectados: falta cargar la URL del Apps Script en assets/js/config.js.';
      error.classList.remove('oculto');
      return;
    }

    pedirDatos()
      .then(function (datos) {
        estado.classList.add('oculto');
        error.classList.add('oculto');

        /* La encuesta de ciudad va primero, arriba de la de vivienda:
           es la que se está difundiendo. Se dibuja con el mismo render
           —es un bloque más, solo que no viene de `tracks`—. Si el
           backend todavía no la devuelve —el deploy del Apps Script va
           aparte del del sitio— la sección simplemente no aparece. */
        var contCiudad = document.getElementById('contenedor-ciudad');
        var hayCiudad = !!(contCiudad && datos.ciudad);
        if (hayCiudad) renderTrack(contCiudad, 'ciudad', datos.ciudad);

        var hayVivienda = false;
        ORDEN_TRACKS.forEach(function (track) {
          if (datos.tracks && datos.tracks[track]) {
            renderTrack(contenedor, track, datos.tracks[track]);
            hayVivienda = true;
          }
        });

        /* La línea divisoria separa una encuesta de la otra, así que
           solo tiene sentido si están las dos: con una sola es una raya
           suelta que no separa nada. */
        var bloqueVivienda = document.getElementById('bloque-vivienda');
        if (bloqueVivienda && hayCiudad && hayVivienda) {
          bloqueVivienda.classList.add('tiene-datos');
        }

        if (datos.actualizado) {
          var fecha = new Date(datos.actualizado);
          document.getElementById('pie-actualizado').textContent =
            'Datos actualizados al ' + fecha.toLocaleDateString('es-AR') +
            ' a las ' + fecha.toLocaleTimeString('es-AR', {
              hour: '2-digit', minute: '2-digit', hour12: false
            }) + ' hs.';
        }
      })
      .catch(function () {
        estado.classList.add('oculto');
        error.textContent = 'No pudimos cargar los resultados en este momento. Probá recargar la página en un rato.';
        error.classList.remove('oculto');
      });
  }

  document.addEventListener('DOMContentLoaded', cargar);

  /* Lo mínimo para que la portada pueda pedir los mismos datos y dibujar
     una tarjeta de vista previa sin duplicar nada de esto.
     Todo lo demás (qué se publica y qué no) lo decide el servidor. */
  window.TFC_DASHBOARD = {
    pedirDatos: pedirDatos,
    renderGrafico: renderGrafico,
    COLOR_TRACK: COLOR_TRACK,
    ORDEN_TRACKS: ORDEN_TRACKS
  };
})();
