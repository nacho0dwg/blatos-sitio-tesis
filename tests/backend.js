/* ===========================================================
   Pruebas del backend (apps-script/Code.gs).

   Se corre con:   node tests/backend.js
   (o todas juntas: node tests/todos.js)

   Code.gs es JavaScript plano y no toca ninguna API de Google en el
   nivel superior: se puede evaluar en un sandbox de `vm` y leer sus
   constantes y funciones puras. Así lo que se prueba es el archivo que
   se deploya, no una copia del esquema escrita acá.

   Lo que cubre:
     · la hoja `ciudad` y sus columnas, con `edad` en columna propia;
     · que TODO lo que manda cada encuesta tenga columna en la Sheet
       (si se agrega una pregunta y se olvida la columna, falla acá);
     · que lo publicable no incluya texto libre ni localidad;
     · que las etiquetas cubran todas las opciones que se pueden guardar;
     · que el ranking urbano ya no esté en el cierre de vivienda.
   =========================================================== */

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

global.document = global.document || { addEventListener: function () {} };

var t = require('./_ayuda.js');
var ok = t.ok;
var igual = t.igual;
var titulo = t.titulo;

/* ---------- Code.gs, evaluado ---------- */

var codigo = fs.readFileSync(
  path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'
);

var gs = {};
vm.createContext(gs);
vm.runInContext(codigo, gs, { filename: 'Code.gs' });

/* ---------- Los dos esquemas del front ---------- */

var vivienda = require('../assets/js/encuesta-vivienda.js');
var ciudad = require('../assets/js/encuesta-ciudad.js');

/* Los ids que efectivamente llegan al servidor dentro de `respuestas`:
   todo lo del gating y de los bloques, menos los campos de contacto y
   los soloLocal —que el motor descarta antes de postear—, más los
   campos extra de texto que cuelgan de una opción. */
function idsQueViajan(preguntas) {
  var salida = [];
  preguntas.forEach(function (p) {
    if (p.esContacto || p.soloLocal) return;
    salida.push(p.id);
    if (p.campoExtra) salida.push(p.campoExtra.id);
  });
  return salida;
}

function preguntasDeBloques(bloques) {
  return bloques.reduce(function (acum, b) { return acum.concat(b.preguntas); }, []);
}

/* =========================================================
   1. La hoja de ciudad
   ========================================================= */

titulo('Hoja `ciudad`');

igual(gs.HOJA_CIUDAD, 'ciudad', 'la hoja se llama ciudad');

var COLS_CIUDAD = gs.columnasDeCiudad();

igual(COLS_CIUDAD[0], 'timestamp', 'la primera columna es el timestamp');
igual(COLS_CIUDAD[1], 'modalidad', 'la segunda es la modalidad');

/* --- Lo que pidió el encargo: `edad` en su propia columna --- */
titulo('La edad, en columna propia y filtrable');

igual(COLS_CIUDAD.filter(function (c) { return c === 'edad'; }).length, 1,
  'hay exactamente una columna llamada "edad"');

ok(COLS_CIUDAD.indexOf('edad') !== -1,
  'la columna edad existe en la hoja ciudad');

/* Filtrable quiere decir: una columna sola, con un valor por fila y de
   un conjunto cerrado. Nada de "edad" pegada a otro campo ni varios
   valores separados por " | " en la misma celda. */
var edadCiudad = ciudad.GATING.filter(function (p) { return p.id === 'edad'; })[0];
igual(edadCiudad.tipo, 'radio',
  'la edad es de opción única: una celda, un valor (no una lista con " | ")');

ok(COLS_CIUDAD.every(function (c) { return c.indexOf('edad') === -1 || c === 'edad'; }),
  'ninguna otra columna mezcla la edad adentro de su nombre');

/* Y los valores que se guardan son los mismos códigos que ya usan las
   hojas de trayecto, así que un filtro sirve para las dos encuestas. */
var CODIGOS_EDAD = edadCiudad.opciones.map(function (o) { return o.valor; });
CODIGOS_EDAD.forEach(function (v) {
  ok(gs.ETIQUETAS.edad[v] !== undefined,
    'el código de edad "' + v + '" tiene etiqueta en el backend');
});

/* La hoja de ciudad guarda la edad igual que las de trayecto. */
ok(gs.COLUMNAS_GATING.indexOf('edad') !== -1,
  'las hojas de trayecto también tienen la edad en columna propia');

/* =========================================================
   2. Todo lo que se manda tiene columna
   ========================================================= */

titulo('Cobertura de columnas — ciudad');

var VIAJAN_CIUDAD = idsQueViajan(ciudad.GATING)
  .concat(idsQueViajan(preguntasDeBloques(ciudad.BLOQUES)));

VIAJAN_CIUDAD.forEach(function (id) {
  ok(COLS_CIUDAD.indexOf(id) !== -1,
    'la hoja ciudad tiene columna para "' + id + '"');
});

/* Y al revés: una columna que nadie llena es una columna muerta. */
COLS_CIUDAD.forEach(function (col) {
  if (col === 'timestamp' || col === 'modalidad') return;
  ok(VIAJAN_CIUDAD.indexOf(col) !== -1,
    'la columna "' + col + '" de ciudad la llena alguna pregunta');
});

titulo('Cobertura de columnas — vivienda');

['A', 'B', 'C', 'D1', 'D2'].forEach(function (track) {
  var cols = gs.columnasDeTrack(track);
  var bloques = vivienda.bloquesDeTrack(track, { convivencia: 'padres_abuelos' });
  var viajan = idsQueViajan(vivienda.GATING)
    .concat(idsQueViajan(preguntasDeBloques(bloques)));

  viajan.forEach(function (id) {
    ok(cols.indexOf(id) !== -1, track + ': hay columna para "' + id + '"');
  });
});

/* =========================================================
   3. Qué se puede publicar
   ========================================================= */

titulo('Publicables de ciudad');

var IDS_PUBLICAS_CIUDAD = gs.PUBLICAS_CIUDAD.map(function (p) { return p.id; });

igual(IDS_PUBLICAS_CIUDAD.join(','),
  'edad,ciudad_relacion_rio,ciudad_problematica,ciudad_donde_se_reune,' +
  'ciudad_propuestas_nose,ciudad_propuestas_ranking,ciudad_interes_tema',
  'las siete preguntas publicables de ciudad');

/* Regla no negociable: ninguna abierta puede salir por doGet. */
/* Las abiertas del esquema MÁS los campos de texto colgados de otra
   pregunta (el "¿por qué?" del río, los dos "¿cuál?"). Se leen del
   esquema y no de una lista escrita a mano: si mañana se agrega otro,
   la prueba lo cubre sola. */
var TODAS_CIUDAD = preguntasDeBloques(ciudad.BLOQUES).concat(ciudad.GATING_PASOS
  .reduce(function (a, paso) { return a.concat(paso.preguntas); }, []));

var ABIERTAS_CIUDAD = TODAS_CIUDAD
  .filter(function (p) { return p.abierta; })
  .map(function (p) { return p.id; })
  .concat(TODAS_CIUDAD
    .filter(function (p) { return p.campoExtra && p.campoExtra.abierta; })
    .map(function (p) { return p.campoExtra.id; }));

ABIERTAS_CIUDAD.forEach(function (id) {
  ok(IDS_PUBLICAS_CIUDAD.indexOf(id) === -1,
    'la abierta "' + id + '" NO es publicable');
});

ok(IDS_PUBLICAS_CIUDAD.indexOf('localidad') === -1,
  'la localidad no es publicable (nunca hay desglose geográfico)');

/* Los contactos nunca salen, ni desde ciudad ni desde vivienda. */
['contacto_nombre', 'contacto_medio', 'cierre_optin'].forEach(function (id) {
  ok(IDS_PUBLICAS_CIUDAD.indexOf(id) === -1, '"' + id + '" no es publicable');
});

/* Ninguna columna de contacto en la hoja de respuestas. */
['contacto_nombre', 'contacto_medio', 'cierre_optin'].forEach(function (id) {
  ok(COLS_CIUDAD.indexOf(id) === -1,
    'la hoja ciudad no tiene columna "' + id + '"');
});

/* =========================================================
   4. Etiquetas
   ========================================================= */

titulo('Etiquetas de las opciones de ciudad');

function opcionesDe(id) {
  var p = preguntasDeBloques(ciudad.BLOQUES).filter(function (q) { return q.id === id; })[0];
  return p ? p.opciones.map(function (o) { return o.valor; }) : [];
}

[
  ['ciudad_relacion_rio', 'ciudad_relacion_rio'],
  ['ciudad_problematica', 'ciudad_problematica'],
  ['ciudad_propuestas_ranking', 'ciudad_propuestas_ranking'],
  ['ciudad_propuestas_nose', 'ciudad_propuestas_nose']
].forEach(function (par) {
  var tabla = gs.ETIQUETAS[par[1]] || {};
  opcionesDe(par[0]).forEach(function (valor) {
    ok(tabla[valor] !== undefined,
      par[0] + ': la opción "' + valor + '" tiene etiqueta legible');
  });
});

/* Cada publicable apunta a una tabla de etiquetas que existe. */
gs.PUBLICAS_CIUDAD.forEach(function (p) {
  ok(gs.ETIQUETAS[p.etiquetas] !== undefined,
    'el publicable ' + p.id + ' apunta a la tabla "' + p.etiquetas + '", que existe');
});

/* =========================================================
   5. El ranking urbano salió del cierre de vivienda
   ========================================================= */

titulo('El cierre de vivienda ya no tiene el ranking urbano');

igual(gs.COLUMNAS_CIERRE.join(','), 'cierre_interes_tema',
  'COLUMNAS_CIERRE queda solo con el interés en el tema');

['cierre_urbano_nose', 'cierre_urbano_ranking', 'cierre_urbano_otra'].forEach(function (id) {
  ok(gs.COLUMNAS_CIERRE.indexOf(id) === -1, 'COLUMNAS_CIERRE no tiene ' + id);
  ok(gs.PUBLICAS_CIERRE.every(function (p) { return p.id !== id; }),
    'PUBLICAS_CIERRE no tiene ' + id);

  ['A', 'B', 'C', 'D1', 'D2'].forEach(function (track) {
    ok(gs.PREGUNTAS_PUBLICAS[track].every(function (p) { return p.id !== id; }),
      'el trayecto ' + track + ' no publica ' + id);
  });
});

ok(gs.ETIQUETAS.cierre_urbano_ranking === undefined,
  'y las etiquetas del ranking viejo tampoco quedaron colgando');

/* =========================================================
   6. Contactos: una sola hoja, compartida
   ========================================================= */

titulo('Hoja de contactos');

igual(gs.HOJA_CONTACTOS, 'contactos_interes', 'sigue siendo la misma hoja');
ok(gs.HOJA_CONTACTOS !== gs.HOJA_CIUDAD, 'y no se duplicó una por encuesta');

if (t.esPrincipal(module)) t.resumen();
