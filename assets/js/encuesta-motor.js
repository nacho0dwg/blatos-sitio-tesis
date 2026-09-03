/* ===========================================================
   Motor de encuestas — Cosquín

   La parte que NO cambia entre una encuesta y otra: dibuja las
   preguntas a partir del esquema, lee y valida lo respondido, maneja
   el gating, los bloques, el botón de atrás y el envío.

   El contenido —qué se pregunta, cómo se deriva el recorrido y qué
   forma tiene el payload— vive en el archivo de cada encuesta:
     assets/js/encuesta-vivienda.js
     assets/js/encuesta-ciudad.js

   Cómo se usa:

     TFC_ENCUESTA.iniciar({
       gatingPasos:      [ { titulo, bajada, preguntas: [...] }, ... ],
       bloquesEstimados: 3,        // para la barra durante el gating
       iconos:           { id: '<svg interior>' },   // opcional
       resolver:         function (gating) {
                           // { clave, bloques } | null  (null = corte)
                         },
       armarPayload:     function (ctx) {
                           // ctx = { clave, gating, respuestas, cierre }
                           // { payload, contacto }  (contacto puede ser null)
                         }
     });

   `respuestas` llega a armarPayload ya sin los campos marcados
   `esContacto` ni `soloLocal`: el motor los saca antes, para que no
   puedan viajar dentro de la respuesta anónima por descuido.

   Tipos de pregunta soportados:
     radio | checkbox | escala | orden | texto | textarea
   =========================================================== */

(function () {
  'use strict';

  /* La configuración de la encuesta que está corriendo. La deja
     `iniciar`; hasta entonces no hay ninguna. */
  var cfg = {};

  /* ---------- Tarjeta de un ítem de la lista de orden ----------
     Con `texto` a secas, el ítem es una etiqueta corta y listo.

     Cuando la opción trae `propuesta` y/o `detalle`, el ítem pasa a ser
     una tarjeta de tres niveles: el nombre (que alcanza para
     reconocerla), la propuesta en una línea y la explicación larga.
     Los tres niveles se distinguen por tamaño, peso y color, no solo
     por uno de los tres.

     `texto` sigue siendo el nombre corto: es lo que se lee en el
     aria-label de las flechas y lo que se anuncia al moverse. Un lector
     de pantalla que tuviera que escuchar los tres niveles en cada
     movimiento no podría seguir el reordenamiento. */
  function renderTextoOrden(opcion) {
    var caja = crearElemento('span', 'orden-texto');

    if (!opcion.propuesta && !opcion.detalle) {
      caja.textContent = opcion.texto;
      return caja;
    }

    caja.appendChild(crearElemento('span', 'orden-nombre', opcion.nombre || opcion.texto));

    if (opcion.propuesta) {
      var linea = crearElemento('span', 'orden-propuesta');
      linea.appendChild(crearElemento('strong', null, 'Propuesta:'));
      linea.appendChild(document.createTextNode(' ' + opcion.propuesta));
      caja.appendChild(linea);
    }

    if (opcion.detalle) {
      caja.appendChild(crearElemento('span', 'orden-detalle', opcion.detalle));
    }

    return caja;
  }

  /* El nombre corto del ítem, para anunciar dónde quedó. */
  function nombreDeOrden(item) {
    var nombre = item.querySelector('.orden-nombre');
    if (nombre) return nombre.textContent;
    var texto = item.querySelector('.orden-texto');
    return texto ? texto.textContent : '';
  }


  /* =========================================================
     3. RENDER
     ========================================================= */

  /* Une dos objetos de respuestas; lo de `encima` pisa lo de `base`. */
  function fusionar(base, encima) {
    var out = {};
    Object.keys(base || {}).forEach(function (k) { out[k] = base[k]; });
    Object.keys(encima || {}).forEach(function (k) { out[k] = encima[k]; });
    return out;
  }

  function crearElemento(tag, clase, texto) {
    var el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto != null) el.textContent = texto;
    return el;
  }

  function crearIcono(nombre) {
    if (!cfg.iconos || !cfg.iconos[nombre]) return null;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'opcion-icono');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.innerHTML = cfg.iconos[nombre];
    return svg;
  }

  function renderOpcionSimple(pregunta, opcion, tipoInput) {
    var label = crearElemento('label', 'opcion');
    var input = document.createElement('input');
    input.type = tipoInput;
    input.name = pregunta.id;
    input.value = opcion.valor;
    label.appendChild(input);

    if (opcion.icono) {
      var icono = crearIcono(opcion.icono);
      if (icono) label.appendChild(icono);
    }

    label.appendChild(crearElemento('span', null, opcion.texto));

    if (opcion.ayuda) {
      label.appendChild(crearElemento('small', 'solo-lectura-visual', opcion.ayuda));
    }
    return label;
  }

  /* ---------- Pregunta de orden (arrastre) ----------
     Se puede reordenar de dos maneras y las dos valen igual:
       · arrastrando desde el agarre (mouse y touch, vía Pointer Events)
       · con los botones ↑ ↓, que además es el camino con teclado
     El arrastre HTML5 nativo no existe en móviles, y esta encuesta se
     completa sobre todo en un celular: por eso va con Pointer Events.

     La lista arranca DESORDENADA al azar. Si arrancara en el orden en
     que están escritas las opciones, quien no la toca dejaría ese orden
     como si fuera su respuesta, y el sesgo quedaría escondido en los
     datos. Por eso además hay que tocarla al menos una vez para poder
     seguir: un orden que nadie eligió no es un dato. */
  function mezclar(lista) {
    var copia = lista.slice();
    for (var i = copia.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copia[i]; copia[i] = copia[j]; copia[j] = tmp;
    }
    return copia;
  }

  function renderOrden(pregunta) {
    var caja = crearElemento('div', 'caja-orden');

    var lista = crearElemento('ol', 'lista-orden');
    lista.setAttribute('data-orden', pregunta.id);

    mezclar(pregunta.opciones).forEach(function (opcion) {
      var item = crearElemento('li', 'item-orden');
      item.setAttribute('data-valor', opcion.valor);

      var agarre = crearElemento('span', 'orden-agarre');
      agarre.setAttribute('aria-hidden', 'true');
      agarre.innerHTML =
        '<svg viewBox="0 0 16 16" width="16" height="16" focusable="false">' +
        '<circle cx="5" cy="3" r="1.4"/><circle cx="11" cy="3" r="1.4"/>' +
        '<circle cx="5" cy="8" r="1.4"/><circle cx="11" cy="8" r="1.4"/>' +
        '<circle cx="5" cy="13" r="1.4"/><circle cx="11" cy="13" r="1.4"/></svg>';
      item.appendChild(agarre);

      item.appendChild(crearElemento('span', 'orden-pos', '1'));
      item.appendChild(renderTextoOrden(opcion));

      var botones = crearElemento('span', 'orden-botones');
      [['-1', 'Subir'], ['1', 'Bajar']].forEach(function (par) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'orden-btn';
        btn.setAttribute('data-mover', par[0]);
        btn.setAttribute('aria-label', par[1] + ': ' + opcion.texto);
        btn.innerHTML = par[0] === '-1' ? '&uarr;' : '&darr;';
        botones.appendChild(btn);
      });
      item.appendChild(botones);

      lista.appendChild(item);
    });

    caja.appendChild(lista);

    var aviso = crearElemento('p', 'orden-aviso');
    aviso.setAttribute('role', 'status');
    aviso.setAttribute('aria-live', 'polite');
    caja.appendChild(aviso);

    numerarOrden(lista);
    activarOrden(lista, aviso);

    return caja;
  }

  function numerarOrden(lista) {
    Array.prototype.forEach.call(lista.children, function (item, i) {
      var pos = item.querySelector('.orden-pos');
      if (pos) pos.textContent = String(i + 1);

      /* Los extremos no tienen a dónde ir: se desactiva el botón en vez
         de dejar que no haga nada al tocarlo. */
      var arriba = item.querySelector('[data-mover="-1"]');
      var abajo = item.querySelector('[data-mover="1"]');
      if (arriba) arriba.disabled = (i === 0);
      if (abajo) abajo.disabled = (i === lista.children.length - 1);
    });
  }

  function marcarTocado(lista) {
    lista.setAttribute('data-tocado', '1');
  }

  /* Anuncia dónde quedó el ítem que se acaba de mover. Es la única
     manera de seguir un reordenamiento sin ver la pantalla. */
  function anunciarPosicion(item, lista, aviso) {
    if (!aviso || !item) return;
    aviso.textContent = nombreDeOrden(item) +
      ': posición ' + item.querySelector('.orden-pos').textContent +
      ' de ' + lista.children.length + '.';
  }

  function activarOrden(lista, aviso) {
    /* --- Botones ↑ ↓ (también es el camino con teclado) --- */
    lista.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-mover]');
      if (!btn || btn.disabled) return;

      var item = btn.closest('.item-orden');
      var paso = parseInt(btn.getAttribute('data-mover'), 10);

      if (paso < 0 && item.previousElementSibling) {
        lista.insertBefore(item, item.previousElementSibling);
      } else if (paso > 0 && item.nextElementSibling) {
        lista.insertBefore(item.nextElementSibling, item);
      } else {
        return;
      }

      numerarOrden(lista);
      marcarTocado(lista);

      /* Al mover, el botón puede haberse desactivado (llegó a un
         extremo) y el foco se perdería. Se lleva al gemelo. */
      if (btn.disabled) {
        var otro = item.querySelector('[data-mover="' + (paso < 0 ? '1' : '-1') + '"]');
        if (otro && !otro.disabled) otro.focus();
      } else {
        btn.focus();
      }

      anunciarPosicion(item, lista, aviso);
    });

    /* --- Arrastre con Pointer Events (mouse y touch) ---
       El agarre es el único punto con touch-action: none. Si el ítem
       entero lo tuviera, no se podría scrollear la página tocando la
       lista, que en un celular ocupa casi toda la pantalla.

       El lugar que le toca al ítem lo decide SIEMPRE la posición del
       puntero contra los otros ítems, nunca el rectángulo del que se
       está arrastrando: ese está desplazado por el transform y, apenas
       se reacomoda una vez, deja de decir dónde está el dedo. Midiendo
       contra el puntero, un tirón largo cruza todos los ítems que haga
       falta de una sola vez. */
    var arrastrando = null;
    var pinza = 0;

    function reubicar(y) {
      var hermanos = Array.prototype.filter.call(lista.children, function (h) {
        return h !== arrastrando;
      });

      var destino = null;
      for (var i = 0; i < hermanos.length; i++) {
        var caja = hermanos[i].getBoundingClientRect();
        if (y < caja.top + caja.height / 2) { destino = hermanos[i]; break; }
      }

      if (destino) {
        if (arrastrando.nextElementSibling !== destino) lista.insertBefore(arrastrando, destino);
      } else if (lista.lastElementChild !== arrastrando) {
        lista.appendChild(arrastrando);
      }

      /* Ya en su lugar del DOM, se lo vuelve a pegar al dedo: sin esto
         el ítem saltaría al hueco nuevo y dejaría de seguir al puntero. */
      arrastrando.style.transform = '';
      var propio = arrastrando.getBoundingClientRect();
      arrastrando.style.transform = 'translateY(' + (y - pinza - propio.top) + 'px)';

      numerarOrden(lista);
    }

    lista.addEventListener('pointerdown', function (ev) {
      var agarre = ev.target.closest('.orden-agarre');
      if (!agarre) return;

      arrastrando = agarre.closest('.item-orden');
      if (!arrastrando) return;

      /* Dónde se agarró el ítem, para que no salte al empezar. */
      pinza = ev.clientY - arrastrando.getBoundingClientRect().top;

      arrastrando.classList.add('arrastrando');
      /* La captura mantiene el arrastre aunque el dedo se salga del
         ítem. Si el navegador la rechaza, el arrastre igual funciona
         mientras el puntero no se vaya de la lista: no vale abortar. */
      try { agarre.setPointerCapture(ev.pointerId); } catch (sinCaptura) {}
      ev.preventDefault();
    });

    lista.addEventListener('pointermove', function (ev) {
      if (!arrastrando) return;
      ev.preventDefault();
      reubicar(ev.clientY);
    });

    function soltar() {
      if (!arrastrando) return;
      var item = arrastrando;
      item.style.transform = '';
      item.classList.remove('arrastrando');
      arrastrando = null;
      numerarOrden(lista);
      marcarTocado(lista);
      anunciarPosicion(item, lista, aviso);
    }

    lista.addEventListener('pointerup', soltar);
    lista.addEventListener('pointercancel', soltar);
  }

  /* ---------- Render de una pregunta ---------- */

  function opcionesDe(pregunta, respuestas) {
    if (typeof pregunta.opcionesDe === 'function') {
      return pregunta.opcionesDe(respuestas || {});
    }
    return pregunta.opciones;
  }

  function renderListaOpciones(pregunta, opciones, tipoInput, claseCont) {
    var cont = crearElemento('div', claseCont);
    opciones.forEach(function (opcion) {
      cont.appendChild(renderOpcionSimple(pregunta, opcion, tipoInput));
    });
    return cont;
  }

  function renderPregunta(pregunta, respuestas) {
    var bloque = crearElemento('fieldset');
    bloque.setAttribute('data-pregunta', pregunta.id);

    bloque.appendChild(crearElemento('legend', null, pregunta.etiqueta));

    if (pregunta.ayuda) {
      bloque.appendChild(crearElemento('p', 'ayuda-pregunta', pregunta.ayuda));
    }

    if (pregunta.tipo === 'radio' || pregunta.tipo === 'checkbox' || pregunta.tipo === 'escala') {
      var tipoInput = pregunta.tipo === 'checkbox' ? 'checkbox' : 'radio';
      var claseCont = pregunta.tipo === 'escala'
        ? 'opciones escala'
        : (pregunta.presentacion === 'grilla' ? 'opciones opciones-grilla' : 'opciones');

      /* Caja propia para poder re-dibujar solo las opciones cuando
         dependen de otra respuesta (convivencia según edad). */
      var zona = crearElemento('div', 'zona-opciones');
      zona.setAttribute('data-opciones-de', pregunta.id);
      bloque.appendChild(zona);

      pintarOpciones(zona, pregunta, respuestas, tipoInput, claseCont);

      if (pregunta.maxSeleccion) {
        var contador = crearElemento('p', 'contador-seleccion');
        contador.setAttribute('data-contador-de', pregunta.id);
        contador.setAttribute('role', 'status');
        contador.setAttribute('aria-live', 'polite');
        bloque.appendChild(contador);
      }

      /* Campo extra colgado de la pregunta. Dos usos:
         - con `siValor`, condicional a una opción ("¿cuál localidad
           del Valle?", "¿cuál otra problemática?");
         - sin `siValor`, siempre a la vista: un "¿por qué?" que
           pertenece a la misma pregunta y no merece numeración propia. */
      if (pregunta.campoExtra) {
        var extra = pregunta.campoExtra;
        var siempre = !extra.siValor;
        var campo = crearElemento(
          'div', 'campo campo-anidado' + (siempre ? '' : ' oculto'));
        campo.setAttribute('data-campo-extra-de', pregunta.id);

        var lbl = crearElemento('label', null, extra.etiqueta);
        lbl.setAttribute('for', extra.id);
        var inp = extra.tipo === 'textarea'
          ? document.createElement('textarea')
          : document.createElement('input');
        if (extra.tipo !== 'textarea') inp.type = 'text';
        inp.id = extra.id;
        inp.name = extra.id;
        if (extra.ayuda) inp.setAttribute('placeholder', extra.ayuda);

        campo.appendChild(lbl);
        campo.appendChild(inp);
        bloque.appendChild(campo);
      }

    } else if (pregunta.tipo === 'orden') {
      bloque.appendChild(renderOrden(pregunta));

    } else if (pregunta.tipo === 'texto') {
      var input = document.createElement('input');
      input.type = 'text';
      input.id = pregunta.id;
      input.name = pregunta.id;
      input.setAttribute('aria-label', pregunta.etiqueta);
      bloque.appendChild(input);

    } else if (pregunta.tipo === 'textarea') {
      var ta = document.createElement('textarea');
      ta.id = pregunta.id;
      ta.name = pregunta.id;
      ta.setAttribute('aria-label', pregunta.etiqueta);
      bloque.appendChild(ta);
    }

    return bloque;
  }

  /* Dibuja (o re-dibuja) las opciones de una pregunta dentro de su zona.
     Conserva lo ya marcado si la opción sigue existiendo. */
  function pintarOpciones(zona, pregunta, respuestas, tipoInput, claseCont) {
    var opciones = opcionesDe(pregunta, respuestas);

    var firma = opciones.map(function (o) { return o.valor; }).join('|');
    if (zona.getAttribute('data-firma') === firma) return;

    var marcados = {};
    Array.prototype.forEach.call(
      zona.querySelectorAll('input:checked'),
      function (i) { marcados[i.value] = true; }
    );

    zona.innerHTML = '';
    zona.setAttribute('data-firma', firma);

    if (pregunta.grupos) {
      /* Doce opciones seguidas se leen como un muro. Se parten en
         bloques con subtítulo; el role=group + aria-labelledby hace
         que el subtítulo no sea solo decorativo y un lector de
         pantalla anuncie en qué bloque está. */
      pregunta.grupos.forEach(function (grupo, i) {
        var idTitulo = pregunta.id + '__g' + i;
        var caja = crearElemento('div', 'grupo-opciones');
        caja.setAttribute('role', 'group');
        caja.setAttribute('aria-labelledby', idTitulo);

        var titulo = crearElemento('p', 'grupo-titulo', grupo.titulo);
        titulo.id = idTitulo;
        caja.appendChild(titulo);
        caja.appendChild(renderListaOpciones(pregunta, grupo.opciones, tipoInput, claseCont));
        zona.appendChild(caja);
      });
    } else {
      zona.appendChild(renderListaOpciones(pregunta, opciones, tipoInput, claseCont));
    }

    Array.prototype.forEach.call(zona.querySelectorAll('input'), function (i) {
      if (marcados[i.value]) i.checked = true;
    });
  }

  function renderPreguntas(contenedor, preguntas, respuestasPrevias, contexto) {
    /* El contexto son las respuestas de pantallas anteriores. Queda
       guardado en el contenedor porque `actualizar` vuelve a correr en
       cada change y necesita las mismas: sin él, la convivencia no vería
       la edad —que ahora se responde en la pantalla anterior— y ofrecería
       la lista genérica en lugar de la que le corresponde. */
    contenedor.contexto = contexto || {};
    contenedor.innerHTML = '';
    preguntas.forEach(function (pregunta) {
      contenedor.appendChild(
        renderPregunta(pregunta, fusionar(contenedor.contexto, respuestasPrevias))
      );
    });

    /* Cada cambio puede activar preguntas condicionales, cambiar la
       lista de opciones de otra pregunta o llegar a un tope.

       El mismo contenedor se reusa para todos los bloques, así que
       primero se saca el manejador anterior: si no, cada bloque dejaría
       uno vivo apuntando a las preguntas del bloque que ya no está. */
    if (contenedor.alCambiar) {
      contenedor.removeEventListener('change', contenedor.alCambiar);
    }
    contenedor.alCambiar = function () { actualizar(contenedor, preguntas); };
    contenedor.addEventListener('change', contenedor.alCambiar);

    actualizar(contenedor, preguntas);
  }

  function actualizar(contenedor, preguntas) {
    var actuales = fusionar(contenedor.contexto, leerRespuestas(contenedor, preguntas, true));
    aplicarOpcionesDinamicas(contenedor, preguntas, actuales);
    aplicarCondiciones(contenedor, preguntas, actuales);
    aplicarLimites(contenedor, preguntas);
  }

  /* Re-dibuja las preguntas cuyas opciones dependen de otra respuesta. */
  function aplicarOpcionesDinamicas(contenedor, preguntas, actuales) {
    preguntas.forEach(function (pregunta) {
      if (typeof pregunta.opcionesDe !== 'function') return;

      var zona = contenedor.querySelector('[data-opciones-de="' + pregunta.id + '"]');
      if (!zona) return;

      var tipoInput = pregunta.tipo === 'checkbox' ? 'checkbox' : 'radio';
      var claseCont = pregunta.tipo === 'escala' ? 'opciones escala' : 'opciones';
      pintarOpciones(zona, pregunta, actuales, tipoInput, claseCont);
    });
  }

  /* Tope de selección en un multi-select: al llegar al máximo se
     deshabilitan las opciones que quedaron sin marcar.
     Se impide el error en vez de reportarlo después: la encuesta se
     completa muchas veces de forma asistida, y volver a buscar cuál
     destildar es más costoso que no poder marcar la siguiente. */
  function aplicarLimites(contenedor, preguntas) {
    preguntas.forEach(function (pregunta) {
      if (!pregunta.maxSeleccion) return;

      var inputs = contenedor.querySelectorAll('input[name="' + pregunta.id + '"]');
      var marcados = 0;
      Array.prototype.forEach.call(inputs, function (i) { if (i.checked) marcados++; });

      var enElTope = marcados >= pregunta.maxSeleccion;
      Array.prototype.forEach.call(inputs, function (i) {
        i.disabled = enElTope && !i.checked;
        var caja = i.closest('.opcion');
        if (caja) caja.classList.toggle('opcion-inactiva', i.disabled);
      });

      var contador = contenedor.querySelector('[data-contador-de="' + pregunta.id + '"]');
      if (!contador) return;

      contador.textContent = enElTope
        ? 'Elegiste ' + marcados + ' de ' + pregunta.maxSeleccion + '. Para cambiar, destildá alguna.'
        : 'Elegiste ' + marcados + ' de ' + pregunta.maxSeleccion + '.';
    });
  }

  /* Un campoExtra sin `siValor` no depende de nada: está siempre a la
     vista. Con `siValor`, aparece solo cuando esa opción está elegida. */
  function campoExtraVisible(pregunta, actuales) {
    var extra = pregunta.campoExtra;
    if (!extra.siValor) return true;
    return actuales[pregunta.id] === extra.siValor;
  }

  /* Muestra u oculta preguntas y campos extra según lo respondido hasta ahora. */
  function aplicarCondiciones(contenedor, preguntas, actuales) {
    preguntas.forEach(function (pregunta) {
      var bloque = contenedor.querySelector('[data-pregunta="' + pregunta.id + '"]');
      if (!bloque) return;

      if (typeof pregunta.condicion === 'function') {
        bloque.classList.toggle('oculto', !pregunta.condicion(actuales));
      }

      if (pregunta.campoExtra) {
        var campo = contenedor.querySelector('[data-campo-extra-de="' + pregunta.id + '"]');
        if (campo) {
          campo.classList.toggle('oculto', !campoExtraVisible(pregunta, actuales));
        }
      }
    });
  }

  function preguntaVisible(contenedor, pregunta) {
    var bloque = contenedor.querySelector('[data-pregunta="' + pregunta.id + '"]');
    return bloque && !bloque.classList.contains('oculto');
  }

  /* =========================================================
     4. LECTURA Y VALIDACIÓN
     ========================================================= */

  /* Lee el estado actual del DOM.
     Si ignorarVisibilidad es true, lee todo (se usa para evaluar condiciones). */
  function leerRespuestas(contenedor, preguntas, ignorarVisibilidad) {
    var out = {};

    preguntas.forEach(function (pregunta) {
      if (!ignorarVisibilidad && !preguntaVisible(contenedor, pregunta)) return;

      if (pregunta.tipo === 'checkbox') {
        var marcados = contenedor.querySelectorAll('input[name="' + pregunta.id + '"]:checked');
        out[pregunta.id] = Array.prototype.map.call(marcados, function (i) { return i.value; });

      } else if (pregunta.tipo === 'radio' || pregunta.tipo === 'escala') {
        var sel = contenedor.querySelector('input[name="' + pregunta.id + '"]:checked');
        out[pregunta.id] = sel ? sel.value : '';

      } else if (pregunta.tipo === 'orden') {
        out[pregunta.id] = leerOrden(contenedor, pregunta);

      } else {
        var campo = contenedor.querySelector('[name="' + pregunta.id + '"]');
        out[pregunta.id] = campo ? campo.value.trim() : '';
      }

      /* Campo extra (texto suelto asociado a una opción) */
      if (pregunta.campoExtra) {
        var extraCampo = contenedor.querySelector('[name="' + pregunta.campoExtra.id + '"]');
        var extraVisible = campoExtraVisible(pregunta, out);
        out[pregunta.campoExtra.id] = (extraCampo && extraVisible) ? extraCampo.value.trim() : '';
      }
    });

    return out;
  }

  /* El orden de los ítems en el DOM ES la respuesta. */
  function leerOrden(contenedor, pregunta) {
    var lista = contenedor.querySelector('[data-orden="' + pregunta.id + '"]');
    if (!lista) return [];
    return Array.prototype.map.call(lista.children, function (item) {
      return item.getAttribute('data-valor');
    });
  }

  function ordenTocado(contenedor, pregunta) {
    var lista = contenedor.querySelector('[data-orden="' + pregunta.id + '"]');
    return !!(lista && lista.getAttribute('data-tocado') === '1');
  }

  function estaVacia(valor) {
    if (Array.isArray(valor)) return valor.length === 0;
    return valor == null || valor === '';
  }

  /* Devuelve un mensaje de error, o null si está todo bien. */
  function validar(contenedor, preguntas, respuestas) {
    for (var i = 0; i < preguntas.length; i++) {
      var pregunta = preguntas[i];
      if (!preguntaVisible(contenedor, pregunta)) continue;

      /* Las preguntas abiertas nunca son obligatorias. */
      if (pregunta.abierta || !pregunta.requerida) continue;

      var valor = respuestas[pregunta.id];

      if (pregunta.tipo === 'orden') {
        if (!ordenTocado(contenedor, pregunta)) {
          return {
            mensaje: 'Falta ordenar: “' + pregunta.etiqueta + '”. La lista arranca desordenada a propósito: movela con las flechas o arrastrando, aunque sea una vez.',
            id: pregunta.id
          };
        }
        continue;
      }

      if (estaVacia(valor)) {
        return { mensaje: 'Falta responder: “' + pregunta.etiqueta + '”.', id: pregunta.id };
      }

      /* Red de seguridad: el render ya deshabilita al llegar al tope,
         pero si esa capa fallara el dato no debe pasar igual. */
      if (pregunta.maxSeleccion && Array.isArray(valor) && valor.length > pregunta.maxSeleccion) {
        return {
          mensaje: 'En “' + pregunta.etiqueta + '” se puede elegir hasta ' + pregunta.maxSeleccion + '.',
          id: pregunta.id
        };
      }
    }
    return null;
  }

  /* =========================================================
     5. FLUJO DE LA ENCUESTA

     consentimiento → gating → bloque 1 … bloque N → enviando
     El último bloque es siempre el cierre común.
     ========================================================= */

  var estado = {
    clave: null,
    gating: {},
    pasoGating: 0,
    bloques: [],
    indice: 0,
    respuestas: {}
  };

  var el = {};

  var PASOS = ['paso-consentimiento', 'paso-gating', 'paso-bloque', 'paso-corte', 'paso-enviando'];

  function mostrarPaso(idPaso, porcentaje, anuncio) {
    PASOS.forEach(function (id) {
      var nodo = document.getElementById(id);
      if (nodo) nodo.classList.toggle('oculto', id !== idPaso);
    });

    var visible = document.getElementById(idPaso);
    if (visible && !visible.classList.contains('oculto')) {
      /* Se reinicia la animación de entrada quitando y volviendo a
         poner la clase (si no, no vuelve a correr). */
      visible.classList.remove('paso-entra');
      void visible.offsetWidth;
      visible.classList.add('paso-entra');
    }

    el.progreso.hidden = (idPaso === 'paso-consentimiento' || idPaso === 'paso-corte');
    el.progresoBarra.style.width = porcentaje + '%';

    if (anuncio) el.anuncio.textContent = anuncio;
    window.scrollTo({ top: 0, behavior: comportamientoDeScroll() });
  }

  /* El scroll suave también es movimiento. La regla del CSS no alcanza:
     un behavior explícito en JS le gana a scroll-behavior, así que la
     preferencia hay que mirarla también acá. */
  function comportamientoDeScroll() {
    var sinMovimiento = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return sinMovimiento ? 'auto' : 'smooth';
  }

  /* Índice global del recorrido: primero las pantallas de gating
     (0 … cfg.gatingPasos.length - 1) y después los bloques del recorrido.

     Durante el gating todavía no se sabe cuántos bloques vienen, así que
     se estima con `bloquesEstimados`, que cada encuesta fija en su
     recorrido más corto. Al quedar la estimación por debajo de cualquier
     total real, la barra nunca retrocede al conocerse el recorrido. */
  function porcentajeDe(indice) {
    var total = (estado.bloques.length || cfg.bloquesEstimados) + cfg.gatingPasos.length;
    return Math.round(((indice + 0.5) / total) * 100);
  }

  function mostrarError(nodoError, mensaje, idPregunta) {
    nodoError.textContent = mensaje;
    nodoError.classList.remove('oculto');

    if (idPregunta) {
      var bloque = document.querySelector('[data-pregunta="' + idPregunta + '"]');
      if (bloque) bloque.scrollIntoView({ behavior: comportamientoDeScroll(), block: 'center' });
    }
  }

  function ocultarError(nodoError) {
    nodoError.classList.add('oculto');
    nodoError.textContent = '';
  }

  /* ---------- Navegación del gating (dos pantallas) ---------- */

  function irAGating(indice) {
    estado.pasoGating = indice;
    var paso = cfg.gatingPasos[indice];

    el.tituloGating.textContent = paso.titulo;
    el.bajadaGating.textContent = paso.bajada || '';
    el.bajadaGating.hidden = !paso.bajada;

    /* Lo ya respondido se vuelve a mostrar al volver atrás. Va también
       como contexto: es de ahí de donde la convivencia saca la edad. */
    renderPreguntas(el.contGating, paso.preguntas, estado.gating, estado.gating);
    restaurarRespuestas(el.contGating, paso.preguntas, estado.gating);
    actualizar(el.contGating, paso.preguntas);

    /* Desde la primera pantalla no hay a dónde volver: el consentimiento
       ya se dio y no se vuelve a pedir. */
    el.btnAtrasGating.hidden = (indice === 0);

    ocultarError(el.errGating);
    mostrarPaso('paso-gating', porcentajeDe(indice), paso.titulo);
  }

  /* Las respuestas del gating viven en dos lados a propósito: en
     `gating` para derivar el trayecto y filtrar bloques, y en
     `respuestas` porque además son columnas de la fila que se guarda. */
  function guardarGating(respuestas) {
    Object.keys(respuestas).forEach(function (k) {
      estado.gating[k] = respuestas[k];
      estado.respuestas[k] = respuestas[k];
    });
  }

  /* Cerrada la última pantalla del gating: la encuesta resuelve qué
     recorrido corresponde y el motor lo arranca.

     `resolver` devuelve { clave, bloques } o null. Null es el corte: no
     hay recorrido que le corresponda a quien responde y no se guarda
     nada. La `clave` identifica el recorrido (en vivienda es el trayecto;
     en una encuesta plana es siempre la misma) y viaja al payload. */
  function resolverYArrancar() {
    var previa = estado.clave;
    var recorrido = cfg.resolver(estado.gating);

    if (!recorrido) {
      estado.clave = null;
      mostrarPaso('paso-corte', 100, 'La encuesta no continúa para tu caso');
      return;
    }

    estado.clave = recorrido.clave;

    /* Si volvió atrás y cambió algo que lo mueve de recorrido, lo que
       había respondido antes es de otro cuestionario: se descarta. El
       gating se conserva, porque sigue valiendo igual. */
    if (previa && previa !== estado.clave) {
      estado.respuestas = fusionar({}, estado.gating);
    }

    estado.bloques = recorrido.bloques;
    irABloque(0);
  }

  /* ---------- Navegación por bloques ---------- */

  function bloqueActual() {
    return estado.bloques[estado.indice];
  }

  function irABloque(indice) {
    estado.indice = indice;
    var bloque = bloqueActual();
    var esUltimo = (indice === estado.bloques.length - 1);

    el.contadorBloque.textContent =
      'Bloque ' + (indice + 1) + ' de ' + estado.bloques.length;
    el.tituloBloque.textContent = bloque.titulo;
    el.bajadaBloque.textContent = bloque.bajada || '';
    el.bajadaBloque.hidden = !bloque.bajada;

    /* Las respuestas ya dadas se vuelven a mostrar al volver atrás. */
    renderPreguntas(el.contBloque, bloque.preguntas, estado.respuestas);
    restaurarRespuestas(el.contBloque, bloque.preguntas, estado.respuestas);
    actualizar(el.contBloque, bloque.preguntas);

    el.btnSiguiente.textContent = esUltimo ? 'Enviar respuestas' : 'Continuar';

    ocultarError(el.errBloque);
    mostrarPaso(
      'paso-bloque',
      porcentajeDe(indice + cfg.gatingPasos.length),
      'Bloque ' + (indice + 1) + ' de ' + estado.bloques.length + ': ' + bloque.titulo
    );
  }

  /* Vuelve a marcar lo que ya se había respondido en este bloque.
     El orden se restaura moviendo los ítems al orden guardado. */
  function restaurarRespuestas(contenedor, preguntas, respuestas) {
    preguntas.forEach(function (pregunta) {
      var valor = respuestas[pregunta.id];
      if (valor === undefined) return;

      if (pregunta.tipo === 'checkbox') {
        (valor || []).forEach(function (v) {
          var input = contenedor.querySelector(
            'input[name="' + pregunta.id + '"][value="' + v + '"]'
          );
          if (input) input.checked = true;
        });

      } else if (pregunta.tipo === 'radio' || pregunta.tipo === 'escala') {
        if (!valor) return;
        var sel = contenedor.querySelector(
          'input[name="' + pregunta.id + '"][value="' + valor + '"]'
        );
        if (sel) sel.checked = true;

      } else if (pregunta.tipo === 'orden') {
        var lista = contenedor.querySelector('[data-orden="' + pregunta.id + '"]');
        if (!lista || !valor || !valor.length) return;
        valor.forEach(function (v) {
          var item = lista.querySelector('[data-valor="' + v + '"]');
          if (item) lista.appendChild(item);
        });
        numerarOrden(lista);
        lista.setAttribute('data-tocado', '1');

      } else {
        var campo = contenedor.querySelector('[name="' + pregunta.id + '"]');
        if (campo) campo.value = valor;
      }

      if (pregunta.campoExtra && respuestas[pregunta.campoExtra.id]) {
        var extra = contenedor.querySelector('[name="' + pregunta.campoExtra.id + '"]');
        if (extra) extra.value = respuestas[pregunta.campoExtra.id];
      }
    });
  }

  function guardarBloqueActual(respuestas) {
    Object.keys(respuestas).forEach(function (k) {
      estado.respuestas[k] = respuestas[k];
    });
  }

  function iniciar(config) {
    cfg = config;
    if (cfg.bloquesEstimados == null) cfg.bloquesEstimados = 3;

    el.progreso = document.getElementById('progreso');
    el.progresoBarra = document.getElementById('progreso-barra');
    el.anuncio = document.getElementById('anuncio-paso');

    el.contGating = document.getElementById('contenedor-gating');
    el.tituloGating = document.getElementById('titulo-gating');
    el.bajadaGating = document.getElementById('bajada-gating');
    el.btnAtrasGating = document.getElementById('btn-atras-gating');
    el.contBloque = document.getElementById('contenedor-bloque');

    el.contadorBloque = document.getElementById('contador-bloque');
    el.tituloBloque = document.getElementById('titulo-bloque');
    el.bajadaBloque = document.getElementById('bajada-bloque');
    el.btnSiguiente = document.getElementById('btn-siguiente');
    el.btnAtras = document.getElementById('btn-atras');

    el.errGating = document.getElementById('error-gating');
    el.errBloque = document.getElementById('error-bloque');
    el.errConsentimiento = document.getElementById('error-consentimiento');

    /* --- Consentimiento --- */
    document.getElementById('btn-empezar').addEventListener('click', function () {
      var check = document.getElementById('consentimiento-check');
      if (!check.checked) {
        el.errConsentimiento.classList.remove('oculto');
        return;
      }
      el.errConsentimiento.classList.add('oculto');
      estado.bloques = [];
      irAGating(0);
    });

    /* --- Gating: una pantalla por vez --- */
    document.getElementById('form-gating').addEventListener('submit', function (ev) {
      ev.preventDefault();
      ocultarError(el.errGating);

      var preguntas = cfg.gatingPasos[estado.pasoGating].preguntas;
      var respuestas = leerRespuestas(el.contGating, preguntas);
      var error = validar(el.contGating, preguntas, respuestas);
      if (error) {
        mostrarError(el.errGating, error.mensaje, error.id);
        return;
      }

      guardarGating(respuestas);

      if (estado.pasoGating < cfg.gatingPasos.length - 1) {
        irAGating(estado.pasoGating + 1);
        return;
      }

      resolverYArrancar();
    });

    /* --- Atrás dentro del gating --- */
    el.btnAtrasGating.addEventListener('click', function () {
      /* Se guarda lo que haya, aunque esté incompleto: volver atrás no
         debería costarle a nadie lo que ya marcó. */
      guardarGating(leerRespuestas(el.contGating, cfg.gatingPasos[estado.pasoGating].preguntas));
      if (estado.pasoGating > 0) irAGating(estado.pasoGating - 1);
    });

    /* --- Bloques --- */
    document.getElementById('form-bloque').addEventListener('submit', function (ev) {
      ev.preventDefault();
      ocultarError(el.errBloque);

      var preguntas = bloqueActual().preguntas;
      var respuestas = leerRespuestas(el.contBloque, preguntas);
      var error = validar(el.contBloque, preguntas, respuestas);
      if (error) {
        mostrarError(el.errBloque, error.mensaje, error.id);
        return;
      }

      guardarBloqueActual(respuestas);

      if (estado.indice < estado.bloques.length - 1) {
        irABloque(estado.indice + 1);
      } else {
        enviar(respuestas);
      }
    });

    /* --- Atrás --- */
    el.btnAtras.addEventListener('click', function () {
      /* Se guarda lo que haya, aunque esté incompleto: volver atrás no
         debería costarle a nadie lo que ya escribió. */
      guardarBloqueActual(leerRespuestas(el.contBloque, bloqueActual().preguntas));

      if (estado.indice > 0) {
        irABloque(estado.indice - 1);
      } else {
        irAGating(cfg.gatingPasos.length - 1);
      }
    });

    mostrarPaso('paso-consentimiento', 0);
  }

  /* ---------------------------------------------------------
     Envío: dos POST separados e independientes.

     1) La respuesta de la encuesta (anónima).
     2) El contacto, SOLO si la persona lo dejó.

     No comparten ningún identificador: el contacto viaja en su
     propio request, sin el track ni ninguna de las respuestas.
     --------------------------------------------------------- */
  function enviar(respuestasCierre) {
    var boton = el.btnSiguiente;
    boton.disabled = true;

    if (!window.TFC_CONFIG || !window.TFC_CONFIG.estaConfigurado()) {
      boton.disabled = false;
      mostrarError(
        el.errBloque,
        'El formulario todavía no está conectado al servidor. Falta cargar la URL del Apps Script en assets/js/config.js.'
      );
      return;
    }

    mostrarPaso('paso-enviando', 100, 'Enviando respuestas');

    /* Todo lo respondido, menos los campos de contacto y los soloLocal.
       Se barren TODOS los bloques del recorrido, no solo el último: así
       un campo de contacto que viviera en otro bloque tampoco viajaría
       dentro de la respuesta anónima. */
    var respuestas = {};
    Object.keys(estado.respuestas).forEach(function (k) {
      respuestas[k] = estado.respuestas[k];
    });

    estado.bloques.forEach(function (bloque) {
      bloque.preguntas.forEach(function (pregunta) {
        if (pregunta.esContacto || pregunta.soloLocal) delete respuestas[pregunta.id];
      });
    });

    var envio = cfg.armarPayload({
      clave: estado.clave,
      gating: estado.gating,
      respuestas: respuestas,
      cierre: respuestasCierre
    });

    postear(envio.payload)
      .then(function () {
        if (!envio.contacto) return null;
        return postear({
          tipo: 'contacto',
          contacto: envio.contacto
        }).catch(function () {
          /* Si falla solo el contacto, la respuesta ya se guardó:
             no tiene sentido bloquear a la persona por esto. */
          return null;
        });
      })
      .then(function () {
        window.location.href = 'gracias.html';
      })
      .catch(function () {
        boton.disabled = false;
        mostrarPaso('paso-bloque', porcentajeDe(estado.indice + cfg.gatingPasos.length));
        mostrarError(
          el.errBloque,
          'No pudimos enviar tus respuestas. Revisá la conexión y probá de nuevo con el botón "Enviar respuestas".'
        );
      });
  }

  /* Content-Type text/plain a propósito: evita el preflight CORS,
     que Apps Script no responde. El servidor parsea el body como JSON. */
  function postear(payload) {
    return fetch(window.TFC_CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    }).then(function (data) {
      if (!data || !data.ok) throw new Error('Respuesta inesperada del servidor');
      return data;
    });
  }

  /* Lo que consumen los archivos de cada encuesta. En el navegador se
     usa `window.TFC_ENCUESTA`; en node (las pruebas), module.exports.
     Se exponen también las funciones puras de lectura y validación,
     que son las que tiene sentido probar sin DOM. */
  var API = {
    iniciar: iniciar,
    validar: validar,
    estaVacia: estaVacia,
    fusionar: fusionar
  };

  if (typeof window !== 'undefined') window.TFC_ENCUESTA = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
