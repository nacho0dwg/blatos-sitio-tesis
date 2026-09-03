/* ===========================================================
   Contraste y jerarquía tipográfica de las tarjetas del ranking.

   Se corre con:   node tests/contraste.js
   (o todas juntas: node tests/todos.js)

   Las siete propuestas de la encuesta de ciudad se leen en tres
   niveles —nombre, propuesta, explicación— y el encargo pide que la
   diferencia se note a simple vista. Esto verifica las dos mitades de
   eso, leyendo el CSS de verdad (no una copia de los valores):

     1. Contraste: los tres niveles contra el fondo de la tarjeta de la
        encuesta. El umbral duro es AA (4.5:1); se informa además si
        llegan a AAA (7:1), porque esta encuesta se completa asistida
        con adultos mayores.
     2. Jerarquía: los tres se distinguen por tamaño Y por peso Y por
        color a la vez. Apoyarse en uno solo se rompe cuando alguien
        agranda la tipografía del sistema o mira la pantalla al sol.
   =========================================================== */

'use strict';

var fs = require('fs');
var path = require('path');

var t = require('./_ayuda.js');
var ok = t.ok;
var igual = t.igual;
var titulo = t.titulo;

var css = fs.readFileSync(
  path.join(__dirname, '..', 'assets', 'css', 'style.css'), 'utf8'
);

/* ---------- Lectura del CSS ---------- */

/* Los tokens semánticos claros viven en :root. La tarjeta de la
   encuesta NO cambia de tema (.pagina-encuesta deja los tokens claros
   a propósito), así que estos son los valores que rigen ahí. */
function tokensDeRoot() {
  var bloque = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  var tokens = {};
  if (!bloque) return tokens;

  var re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g;
  var m;
  while ((m = re.exec(bloque[1])) !== null) {
    tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

function reglaDe(selector) {
  var re = new RegExp('(^|\\n)' + selector.replace('.', '\\.') + '\\s*\\{([\\s\\S]*?)\\n\\}');
  var m = css.match(re);
  return m ? m[2] : null;
}

function propiedad(cuerpo, nombre) {
  var m = cuerpo && cuerpo.match(new RegExp('(?:^|\\n)\\s*' + nombre + '\\s*:\\s*([^;]+);'));
  return m ? m[1].trim() : null;
}

var TOKENS = tokensDeRoot();

/* Resuelve un valor que puede ser un hex o un var(--token). */
function aHex(valor) {
  var m = valor && valor.match(/var\((--[a-z0-9-]+)\)/);
  if (m) return aHex(TOKENS[m[1]]);
  return valor && valor.trim();
}

/* ---------- Contraste WCAG 2.1 ---------- */

function canal(v) {
  var c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminancia(hex) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var r = canal(parseInt(h.slice(0, 2), 16));
  var g = canal(parseInt(h.slice(2, 4), 16));
  var b = canal(parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
  var la = luminancia(a);
  var lb = luminancia(b);
  var alto = Math.max(la, lb);
  var bajo = Math.min(la, lb);
  return (alto + 0.05) / (bajo + 0.05);
}

/* ---------- Los tres niveles ---------- */

var FONDO = aHex('var(--color-superficie)');

var NIVELES = [
  { clase: '.orden-nombre', rol: 'nombre' },
  { clase: '.orden-propuesta', rol: 'propuesta' },
  { clase: '.orden-detalle', rol: 'explicación' }
];

titulo('Los tres niveles existen en el CSS');

ok(/^#[0-9a-f]{6}$/i.test(FONDO || ''),
  'el fondo de la tarjeta (--color-superficie) es un hex: ' + FONDO);

NIVELES.forEach(function (n) {
  n.cuerpo = reglaDe(n.clase);
  ok(n.cuerpo !== null, 'existe la regla ' + n.clase);
  if (!n.cuerpo) return;

  n.color = aHex(propiedad(n.cuerpo, 'color'));
  n.tam = parseFloat(propiedad(n.cuerpo, 'font-size'));
  n.peso = parseInt(propiedad(n.cuerpo, 'font-weight'), 10);

  ok(/^#[0-9a-f]{6}$/i.test(n.color || ''), n.clase + ' declara un color resoluble');
  ok(!isNaN(n.tam), n.clase + ' declara font-size');
  ok(!isNaN(n.peso), n.clase + ' declara font-weight');
});

titulo('Contraste sobre la tarjeta de la encuesta (fondo ' + FONDO + ')');

NIVELES.forEach(function (n) {
  if (!n.color) return;
  var r = contraste(n.color, FONDO);
  var nota = r >= 7 ? 'AAA' : (r >= 4.5 ? 'AA' : 'NO PASA');

  console.log('  · ' + n.rol + ' (' + n.clase + '): ' + n.color +
    '  ' + r.toFixed(2) + ':1  ' + nota +
    '  —  ' + n.tam + 'rem / ' + n.peso);

  ok(r >= 4.5, n.rol + ' cumple WCAG AA (4.5:1) sobre la tarjeta');
  ok(r >= 7, n.rol + ' cumple WCAG AAA (7:1) sobre la tarjeta');
});

titulo('La jerarquía no depende de una sola señal');

var tams = NIVELES.map(function (n) { return n.tam; });
var pesos = NIVELES.map(function (n) { return n.peso; });
var colores = NIVELES.map(function (n) { return n.color; });

ok(tams[0] > tams[1] && tams[1] > tams[2],
  'los tamaños bajan: nombre > propuesta > explicación (' + tams.join(' > ') + ')');

ok(pesos[0] > pesos[1] && pesos[1] > pesos[2],
  'los pesos bajan: nombre > propuesta > explicación (' + pesos.join(' > ') + ')');

igual(new Set(colores).size, 3, 'los tres colores son distintos entre sí');

/* Que se note "a simple vista": un escalón de menos de 0.05rem entre
   dos niveles no se ve. */
ok(tams[0] - tams[1] >= 0.05, 'hay un escalón visible entre nombre y propuesta');
ok(tams[1] - tams[2] >= 0.05, 'hay un escalón visible entre propuesta y explicación');

/* ---------- El resto de la tarjeta sigue siendo usable ---------- */

titulo('Objetivos táctiles del reordenamiento');

/* La encuesta se completa en el celular y muchas veces asistida: los
   controles de la lista de orden no pueden encogerse por haberse vuelto
   la tarjeta más alta. */
var btn = reglaDe('.orden-btn');
igual(parseInt(propiedad(btn, 'height'), 10), 40, 'las flechas ↑ ↓ miden 40px de alto');
igual(parseInt(propiedad(btn, 'width'), 10), 48, 'y 48px de ancho');

var agarre = reglaDe('.orden-agarre');
ok(parseInt(propiedad(agarre, 'min-height'), 10) >= 44,
  'el agarre mantiene al menos 44px de alto');
igual(propiedad(agarre, 'touch-action'), 'none',
  'y sigue siendo el único punto que bloquea el scroll táctil');

var opcion = reglaDe('.opcion');
ok(parseInt(propiedad(opcion, 'min-height'), 10) >= 56,
  'las opciones siguen midiendo 56px de alto');

if (t.esPrincipal(module)) t.resumen();
