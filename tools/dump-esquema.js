/* Vuelca el esquema de LAS DOS encuestas a JSON, leyendo los archivos de
   esquema (la fuente de verdad) por su `module.exports`. Lo consumen
   tools/arbol-encuesta.py y tools/arbol-ciudad.py para dibujar los PNG
   de docs/.

   node tools/dump-esquema.js > docs/esquema-encuesta.json */

var path = require('path');

/* Los archivos se atan al DOMContentLoaded al final del IIFE. */
global.document = { addEventListener: function () {} };

function cargar(nombre) {
  return require(path.join(__dirname, '..', 'assets', 'js', nombre));
}

var m = cargar('encuesta-vivienda.js');
var ciudad = cargar('encuesta-ciudad.js');

/* Gating de referencia que habilita la pregunta extra del Track A
   (convivencia intergeneracional), para que el volcado incluya TODAS las
   preguntas posibles. Las que solo aparecen así quedan marcadas `extra`. */
var CON_EXTRA = { convivencia: 'padres_abuelos' };

function describir(pregunta) {
  return {
    id: pregunta.id,
    tipo: pregunta.tipo,
    etiqueta: pregunta.etiqueta,
    opcional: pregunta.requerida !== true,
    condicional: typeof pregunta.condicion === 'function',
    extra: pregunta.extra === true,
    /* Campo de texto colgado de la pregunta (el "¿por qué?" del río, los
       "¿cuál?"). No es una pregunta aparte, pero el diagrama lo tiene
       que mostrar o parecería que ese texto no se pide. */
    campoExtra: pregunta.campoExtra
      ? { id: pregunta.campoExtra.id, etiqueta: pregunta.campoExtra.etiqueta }
      : null
  };
}

function describirPaso(paso) {
  return {
    titulo: paso.titulo,
    bajada: paso.bajada || '',
    n: paso.preguntas.length,
    preguntas: paso.preguntas.map(describir)
  };
}

var out = { gating: [], tracks: {}, ciudad: null };

m.GATING_PASOS.forEach(function (paso) {
  out.gating.push(describirPaso(paso));
});

/* La encuesta de ciudad es plana: un solo recorrido, sin trayectos. */
out.ciudad = {
  gating: ciudad.GATING_PASOS.map(describirPaso),
  bloques: ciudad.BLOQUES.map(function (bloque) {
    return {
      titulo: bloque.titulo,
      bajada: bloque.bajada || '',
      preguntas: bloque.preguntas.map(describir)
    };
  })
};

Object.keys(m.TRACKS).forEach(function (track) {
  out.tracks[track] = {
    nombre: m.TRACKS[track].nombre,
    bloques: m.bloquesDeTrack(track, CON_EXTRA).map(function (bloque) {
      return {
        titulo: bloque.titulo,
        preguntas: bloque.preguntas.map(describir)
      };
    })
  };
});

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
