/* ===========================================================
   Animación de las páginas de divulgación (index, el-proyecto,
   resultados). GSAP + ScrollTrigger por CDN, sin build step.

   NO se carga en encuesta-vivienda.html: ahí el movimiento se
   limita a un fade de 0.28s entre pasos, resuelto en CSS.

   Contrato con el CSS
   -------------------
   El <html> lleva la clase `es-animable` (la pone un script inline
   en el <head>, antes del primer pintado, para que no se vea el
   contenido y después desaparezca). Esa clase es la que activa
   `opacity: 0` en los [data-revelar]. Si GSAP no está —CDN caída,
   JS bloqueado— este archivo la saca y todo queda visible.
   Nunca se llega a una página con contenido invisible.
   =========================================================== */

(function () {
  'use strict';

  var raiz = document.documentElement;

  function mostrarTodo() {
    raiz.classList.remove('es-animable');
  }

  /* El chequeo de movimiento reducido se hace de nuevo acá y no solo
     en el head: alguien puede cambiar la preferencia del sistema con
     la pestaña abierta. */
  var sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');

  function iniciar() {
    if (sinMovimiento.matches) {
      mostrarTodo();
      return;
    }

    if (!window.gsap || !window.ScrollTrigger) {
      mostrarTodo();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    partirEnPalabras();
    animarHero();
    animarGuarda();
    animarRevelados();

    /* Las fuentes del CDN cambian la altura de los títulos display
       después del primer layout; sin esto los triggers quedan
       calculados sobre las medidas de la fuente de respaldo. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        ScrollTrigger.refresh();
      });
    }
  }

  /* ---------- Reveal palabra por palabra ----------
     Envuelve cada palabra en un span para poder escalonarlas.
     Se hace en JS y no en el HTML para no ensuciar el markup ni
     obligar a mantener los spans a mano al editar un título. */
  function partirEnPalabras() {
    var titulos = document.querySelectorAll('[data-revelar-palabras]');

    Array.prototype.forEach.call(titulos, function (titulo) {
      var palabras = titulo.textContent.trim().split(/\s+/);
      titulo.textContent = '';

      palabras.forEach(function (palabra, i) {
        var contenedor = document.createElement('span');
        contenedor.className = 'palabra';
        /* inline-block para que el transform la afecte; el overflow
           del padre recorta la entrada desde abajo. */
        contenedor.style.display = 'inline-block';
        contenedor.style.willChange = 'transform, opacity';
        contenedor.textContent = palabra;
        titulo.appendChild(contenedor);

        if (i < palabras.length - 1) {
          titulo.appendChild(document.createTextNode(' '));
        }
      });
    });
  }

  /* ---------- Hero: entrada + parallax ---------- */
  function animarHero() {
    var hero = document.querySelector('.hero-cine');
    if (!hero) return;

    var fondo = hero.querySelector('.hero-fondo');
    var display = hero.querySelector('.hero-display');
    var script = hero.querySelector('.hero-script');
    var meta = hero.querySelector('.hero-meta');
    var tags = hero.querySelectorAll('.hero-tags li');
    var ficha = hero.querySelector('.ficha-flotante');
    var columnas = hero.querySelectorAll('.hero-columnas p');
    var scroll = hero.querySelector('.hero-scroll');

    var piezas = [fondo, meta, display, script, ficha, scroll];

    /* Deja el hero en su estado final, sin animar. */
    function asentarHero() {
      gsap.set(piezas.filter(Boolean), { clearProps: 'opacity,transform' });
      if (tags.length) gsap.set(tags, { clearProps: 'opacity,transform' });
      if (columnas.length) gsap.set(columnas, { clearProps: 'opacity,transform' });
    }

    /* Si la pestaña arranca en segundo plano, el navegador estrangula
       requestAnimationFrame y la línea de tiempo queda casi congelada.
       Como la entrada parte de opacity 0, el hero se vería VACÍO. Ese
       es el primer golpe de vista del sitio: no puede depender de que
       una animación llegue a destino. Sin foco, no hay entrada. */
    if (document.hidden) {
      asentarHero();
      animarParallax();
      return;
    }

    /* --- Entrada al cargar --- */
    var entrada = gsap.timeline({ defaults: { ease: 'power3.out' } });

    /* Segunda red: si a los 3s la entrada no terminó —pestaña que pasa
       a segundo plano a mitad de camino, equipo muy lento— se corta y
       se asienta. Vale más un hero quieto y visible que uno a medias. */
    var reserva = setTimeout(function () {
      if (entrada.progress() < 1) {
        entrada.kill();
        asentarHero();
      }
    }, 3000);

    entrada.eventCallback('onComplete', function () {
      clearTimeout(reserva);
    });

    if (fondo) {
      entrada.from(fondo, { scale: 1.12, duration: 1.8, ease: 'power2.out' }, 0);
    }
    if (meta) {
      entrada.from(meta, { opacity: 0, y: -14, duration: 0.9 }, 0.2);
    }
    if (display) {
      entrada.from(display, { opacity: 0, y: 90, duration: 1.2 }, 0.25);
    }
    if (script) {
      entrada.from(script, { opacity: 0, y: 50, duration: 1.1 }, 0.5);
    }
    if (tags.length) {
      entrada.from(tags, { opacity: 0, x: 24, duration: 0.7, stagger: 0.09 }, 0.7);
    }
    if (ficha) {
      entrada.from(ficha, { opacity: 0, y: 34, duration: 0.9 }, 0.8);
    }
    if (columnas.length) {
      entrada.from(columnas, { opacity: 0, y: 22, duration: 0.8, stagger: 0.12 }, 0.95);
    }
    if (scroll) {
      entrada.from(scroll, { opacity: 0, duration: 0.8 }, 1.3);
    }

    animarParallax();

    /* --- Parallax ---
       Tres velocidades distintas sobre el mismo scroll: el fondo baja,
       el título sube poco y la itálica sube más. Esa diferencia es la
       que genera la sensación de profundidad.

       Va aparte de la entrada porque no arranca desde opacity 0: si no
       llega a correr, no esconde nada. Por eso se aplica igual cuando
       la entrada se saltea. */
    function animarParallax() {
      var recorrido = {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.6
      };

      if (fondo) {
        gsap.to(fondo, { yPercent: 12, ease: 'none', scrollTrigger: recorrido });
      }
      if (display) {
        gsap.to(display, { yPercent: -22, ease: 'none', scrollTrigger: recorrido });
      }
      if (script) {
        gsap.to(script, { yPercent: -48, ease: 'none', scrollTrigger: recorrido });
      }
      if (ficha) {
        gsap.to(ficha, { yPercent: -14, ease: 'none', scrollTrigger: recorrido });
      }
    }
  }

  /* ---------- Guarda coscoína: desplazamiento continuo ----------
     La franja del borde izquierdo es `position: fixed`, así que por sí
     sola no se mueve nunca. Lo que le da la sensación de recorrido sin
     fin es correr el PATRÓN a otra velocidad que la página: mientras el
     contenido sube 1, la guarda sube 0.35. Como el tile se repite en Y,
     ese desplazamiento no tiene final visible.

     Se mueve la máscara y no el elemento: un transform dejaría el borde
     de arriba vacío apenas el recorrido pasara un tile.

     Si esta función no corre —GSAP caído, movimiento reducido— la
     variable queda en 0 y la franja se ve igual, quieta. Nunca
     desaparece por no haberse animado. */
  function animarGuarda() {
    var cuerpo = document.body;
    if (!cuerpo.classList.contains('tema-oscuro')) return;

    var VELOCIDAD = 0.35;

    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: function (recorrido) {
        cuerpo.style.setProperty(
          '--guarda-y', (-recorrido.scroll() * VELOCIDAD).toFixed(1) + 'px');
      }
    });
  }

  /* ---------- Reveals al entrar en viewport ---------- */
  function animarRevelados() {
    /* Títulos partidos en palabras: entran escalonadas. */
    var titulos = document.querySelectorAll('[data-revelar-palabras]');
    Array.prototype.forEach.call(titulos, function (titulo) {
      gsap.from(titulo.querySelectorAll('.palabra'), {
        opacity: 0,
        yPercent: 60,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.06,
        scrollTrigger: {
          trigger: titulo,
          start: 'top 85%',
          once: true
        }
      });
    });

    /* Bloques genéricos. data-revelar="grupo" escalona a los hijos
       directos en vez de mover el bloque entero; "grupo-escala" hace lo
       mismo sumando un acercamiento, que es lo que le sienta a una
       grilla de imágenes (moverlas solo en Y se lee como un salto). */
    var bloques = document.querySelectorAll('[data-revelar]');
    Array.prototype.forEach.call(bloques, function (bloque) {
      var modo = bloque.getAttribute('data-revelar');
      var esGrupo = (modo === 'grupo' || modo === 'grupo-escala');
      var conEscala = (modo === 'grupo-escala');
      var objetivo = esGrupo ? bloque.children : bloque;

      gsap.to(objetivo, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: conEscala ? 0.75 : 0.9,
        ease: 'power3.out',
        stagger: esGrupo ? (conEscala ? 0.07 : 0.1) : 0,
        scrollTrigger: {
          trigger: bloque,
          start: 'top 88%',
          once: true
        }
      });

      /* En un grupo, el estado de partida lo tiene el contenedor por
         CSS; hay que pasárselo a los hijos y liberar al padre. */
      if (esGrupo) {
        gsap.set(bloque, { opacity: 1, y: 0 });
        gsap.set(bloque.children, {
          opacity: 0,
          y: conEscala ? 18 : 28,
          scale: conEscala ? 0.94 : 1
        });
      }
    });
  }

  /* Si el usuario activa "reducir movimiento" con la página abierta,
     se matan los ScrollTriggers y todo queda en su estado final. */
  function escucharCambioDePreferencia() {
    function alCambiar() {
      if (!sinMovimiento.matches) return;
      if (window.ScrollTrigger) {
        ScrollTrigger.getAll().forEach(function (st) { st.kill(); });
      }
      if (window.gsap) {
        gsap.globalTimeline.clear();
        gsap.set('[data-revelar], [data-revelar] > *, .palabra', { opacity: 1, y: 0, yPercent: 0, scale: 1 });
        gsap.set('.hero-fondo, .hero-display, .hero-script, .ficha-flotante', { clearProps: 'transform' });
      }
      /* La guarda no la maneja GSAP sino una variable CSS: hay que
         devolverla a cero a mano o queda corrida donde estaba. */
      document.body.style.setProperty('--guarda-y', '0px');
      mostrarTodo();
    }

    if (sinMovimiento.addEventListener) {
      sinMovimiento.addEventListener('change', alCambiar);
    } else if (sinMovimiento.addListener) {
      sinMovimiento.addListener(alCambiar);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  escucharCambioDePreferencia();
})();
