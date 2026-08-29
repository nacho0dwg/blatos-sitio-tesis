/* ===========================================================
   Galería del imaginario + lightbox propio (el-proyecto.html).

   Sin librería: trece imágenes no justifican traer un lightbox de
   terceros, y uno propio se puede hacer accesible de entrada
   (foco atrapado, Escape, flechas, aria-modal).

   Dos tamaños por imagen:
     · thumb/imaginario-NN.jpg (800×450, ~75 KB) en la grilla;
     · el original de 1600×900 solo cuando se abre el lightbox.
   Las trece originales juntas son casi 4 MB: en un celular en Cosquín
   eso es la diferencia entre ver la página y abandonarla.

   El archivo se carga con defer y antes que divulgacion.js: cuando
   corre, el DOM ya está parseado, y las tarjetas quedan puestas antes
   de que se registren los reveals que las animan.
   =========================================================== */

(function () {
  'use strict';

  /* `titulo` es la etiqueta corta que se ve sobre la imagen.
     `alt` es la descripción para quien no la ve: no repite el título,
     lo completa. */
  var IMAGENES = [
    {
      n: 1,
      titulo: 'Cocinar juntos',
      alt: 'Cocina comunitaria con una mesa larga de madera: personas de distintas edades cocinan y conversan junto a una celosía de ladrillo que da a un patio con huerta.'
    },
    {
      n: 2,
      titulo: 'La galería como calle',
      alt: 'Galería exterior cubierta: una mujer mayor en silla de ruedas conversa con otra persona junto a un cantero de aromáticas, con las sierras de fondo.'
    },
    {
      n: 3,
      titulo: 'Fuego y encuentro',
      alt: 'Fogón al aire libre al atardecer: vecinos y vecinas sentados en gradas de piedra alrededor del fuego, bajo un cielo rosado.'
    },
    {
      n: 4,
      titulo: 'Anfiteatro al atardecer',
      alt: 'Anfiteatro de piedra al atardecer, con el valle y las sierras de fondo y gente sentada mirando hacia el centro.'
    },
    {
      n: 5,
      titulo: 'Desde la calle',
      alt: 'Vista del conjunto desde la vereda: muros de ladrillo y estructura de madera junto al río, con las sierras detrás y gente caminando.'
    },
    {
      n: 6,
      titulo: 'Taller de oficio',
      alt: 'Taller de luthería: dos personas de distintas edades trabajan una guitarra sobre el banco, en un interior de ladrillo con grandes ventanales.'
    },
    {
      n: 7,
      titulo: 'Talleres abiertos',
      alt: 'Interior del área de talleres, con puestos de trabajo, herramientas y gente circulando entre la estructura de madera y el vidrio.'
    },
    {
      n: 8,
      titulo: 'La feria',
      alt: 'Feria techada abierta a la plaza, con puestos de instrumentos y textiles y mucha gente recorriéndola.'
    },
    {
      n: 9,
      titulo: 'El acceso',
      alt: 'Acceso al Centro Cultural Intergeneracional Cosquín: rampa, muro de ladrillo y un banco a la sombra de un árbol florecido.'
    },
    {
      n: 10,
      titulo: 'Circular sin escalones',
      alt: 'Galería de circulación con bancos y canteros y señalética de talleres y biblioteca: una persona mayor en silla de ruedas avanza acompañada por otra.'
    },
    {
      n: 11,
      titulo: 'La mesa larga',
      alt: 'Cocina comunitaria con hogar a leña y una mesa larga compartida por personas de varias generaciones.'
    },
    {
      n: 12,
      titulo: 'Estar compartido',
      alt: 'Estar comedor luminoso: adultos mayores y jóvenes conversan alrededor de una barra de madera, con el patio al fondo.'
    },
    {
      n: 13,
      titulo: 'El conjunto',
      alt: 'Vista aérea del conjunto entre la vegetación de la costa del río, con el cerro al fondo.'
    }
  ];

  var contenedor = document.querySelector('[data-galeria]');
  if (!contenedor) return;

  var caja = document.getElementById('lightbox');
  var img = document.getElementById('lightbox-img');
  var texto = document.getElementById('lightbox-texto');
  var contador = document.getElementById('lightbox-contador');
  var btnCerrar = document.getElementById('lightbox-cerrar');
  var btnAnterior = document.getElementById('lightbox-anterior');
  var btnSiguiente = document.getElementById('lightbox-siguiente');

  var indice = 0;
  var abridor = null;

  function rutaThumb(n) {
    return 'assets/img/imaginarios/thumb/imaginario-' + (n < 10 ? '0' + n : n) + '.jpg';
  }

  function rutaGrande(n) {
    return 'assets/img/imaginarios/Imaginario 0 (' + n + ').jpeg';
  }

  /* ---------- Grilla ---------- */

  function armarGrilla() {
    IMAGENES.forEach(function (imagen, i) {
      var boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'galeria-item';
      boton.setAttribute('aria-haspopup', 'dialog');
      boton.setAttribute('data-indice', String(i));

      var foto = document.createElement('img');
      foto.src = rutaThumb(imagen.n);
      /* El alt de la miniatura es el nombre accesible del botón: por eso
         describe la escena y no dice "ampliar". Lo que hace el botón ya
         lo dice el aria-haspopup. */
      foto.alt = imagen.alt;
      foto.loading = 'lazy';
      foto.decoding = 'async';
      foto.width = 800;
      foto.height = 450;
      boton.appendChild(foto);

      /* Número y título son un refuerzo visual del alt: para un lector
         de pantalla serían la misma información dos veces. */
      var num = document.createElement('span');
      num.className = 'galeria-num';
      num.setAttribute('aria-hidden', 'true');
      num.textContent = (i + 1) + ' / ' + IMAGENES.length;
      boton.appendChild(num);

      var pie = document.createElement('span');
      pie.className = 'galeria-pie';
      pie.setAttribute('aria-hidden', 'true');
      pie.textContent = imagen.titulo;
      boton.appendChild(pie);

      boton.addEventListener('click', function () { abrir(i, boton); });
      contenedor.appendChild(boton);
    });
  }

  /* ---------- Lightbox ---------- */

  function mostrar(i) {
    indice = (i + IMAGENES.length) % IMAGENES.length;
    var imagen = IMAGENES[indice];

    img.src = rutaGrande(imagen.n);
    img.alt = imagen.alt;
    texto.textContent = imagen.titulo;
    contador.textContent = (indice + 1) + ' / ' + IMAGENES.length;
  }

  function abrir(i, boton) {
    abridor = boton;
    mostrar(i);
    caja.hidden = false;
    /* Sin esto la página de atrás sigue scrolleando bajo el lightbox. */
    document.body.style.overflow = 'hidden';
    btnCerrar.focus();
  }

  function cerrar() {
    caja.hidden = true;
    document.body.style.overflow = '';
    /* El foco vuelve a la tarjeta que abrió: si se perdiera, quien
       navega con teclado quedaría de nuevo al principio de la página. */
    if (abridor) abridor.focus();
    abridor = null;
  }

  function estaAbierto() {
    return !caja.hidden;
  }

  btnCerrar.addEventListener('click', cerrar);
  btnAnterior.addEventListener('click', function () { mostrar(indice - 1); });
  btnSiguiente.addEventListener('click', function () { mostrar(indice + 1); });

  /* Click en el fondo (no en la imagen ni en los botones) cierra. */
  caja.addEventListener('click', function (ev) {
    if (ev.target === caja) cerrar();
  });

  document.addEventListener('keydown', function (ev) {
    if (!estaAbierto()) return;

    if (ev.key === 'Escape') {
      cerrar();
    } else if (ev.key === 'ArrowLeft') {
      mostrar(indice - 1);
    } else if (ev.key === 'ArrowRight') {
      mostrar(indice + 1);
    } else if (ev.key === 'Tab') {
      /* Foco atrapado: con aria-modal el lector de pantalla ya ignora el
         resto de la página, pero el tabulador del navegador no. Sin esto
         se puede tabular hasta el footer sin ver dónde está el foco. */
      var focos = [btnCerrar, btnAnterior, btnSiguiente];
      var pos = focos.indexOf(document.activeElement);
      var siguiente = ev.shiftKey ? pos - 1 : pos + 1;

      if (pos === -1 || siguiente < 0 || siguiente >= focos.length) {
        ev.preventDefault();
        focos[ev.shiftKey ? focos.length - 1 : 0].focus();
      }
    }
  });

  armarGrilla();
})();
