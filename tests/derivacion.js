/* ===========================================================
   Pruebas del esquema de la encuesta de vivienda.

   Se corre con:   node tests/derivacion.js
   Sin dependencias: node y nada más, igual que el resto del proyecto.

   Cubre lo que NO se puede ver de un vistazo en el navegador:
     · las 6 reglas de derivación, en orden y con sus empates;
     · que partir el gating en dos pantallas no haya perdido, duplicado
       ni cambiado ninguna pregunta;
     · que la lista de convivencias siga dependiendo de la edad;
     · la cantidad de bloques de cada trayecto y la pregunta extra de A.
   =========================================================== */

'use strict';

/* encuesta-vivienda.js se ejecuta entero al requerirlo y termina
   registrando un listener: alcanza con un document de mentira. */
global.document = { addEventListener: function () {} };

var api = require('../assets/js/encuesta-vivienda.js');

var GATING = api.GATING;
var GATING_PASOS = api.GATING_PASOS;
var derivarTrack = api.derivarTrack;
var bloquesDeTrack = api.bloquesDeTrack;
var opcionesConvivencia = api.opcionesConvivencia;

var fallas = 0;
var corridas = 0;

function ok(condicion, descripcion) {
  corridas++;
  if (condicion) return;
  fallas++;
  console.log('  ✗ ' + descripcion);
}

function igual(obtenido, esperado, descripcion) {
  corridas++;
  if (obtenido === esperado) return;
  fallas++;
  console.log('  ✗ ' + descripcion + '\n      esperado: ' + JSON.stringify(esperado) +
    '\n      obtenido: ' + JSON.stringify(obtenido));
}

function titulo(texto) {
  console.log('\n' + texto);
}

function valores(preguntaId) {
  var pregunta = GATING.filter(function (p) { return p.id === preguntaId; })[0];
  return pregunta.opciones.map(function (o) { return o.valor; });
}

/* =========================================================
   1. Estructura del gating en dos pantallas
   ========================================================= */

titulo('Gating partido en dos pantallas');

igual(GATING_PASOS.length, 2, 'son dos pantallas');
igual(GATING_PASOS[0].titulo, 'Para empezar', 'la primera se llama "Para empezar"');
igual(GATING_PASOS[1].titulo, 'Tu convivencia', 'la segunda se llama "Tu convivencia"');

var ids1 = GATING_PASOS[0].preguntas.map(function (p) { return p.id; });
var ids2 = GATING_PASOS[1].preguntas.map(function (p) { return p.id; });

igual(ids1.join(','), 'localidad,vinculo,edad,modalidad',
  'pantalla 1: localidad (+vínculo), edad y modalidad');
igual(ids2.join(','), 'convivencia', 'pantalla 2: solo la convivencia');

/* El reordenamiento es de presentación: el conjunto de preguntas y sus
   ids tienen que ser exactamente los mismos de antes, porque cada id es
   una columna de la hoja. */
var idsTodos = GATING.map(function (p) { return p.id; }).sort();
igual(idsTodos.join(','), 'convivencia,edad,localidad,modalidad,vinculo',
  'las 5 preguntas del gating siguen siendo las mismas');
igual(GATING.length, ids1.length + ids2.length,
  'la lista chata es exactamente la unión de las dos pantallas');

var repetidos = idsTodos.filter(function (id, i) { return idsTodos[i - 1] === id; });
igual(repetidos.length, 0, 'ninguna pregunta quedó duplicada entre pantallas');

/* Los valores guardados no cambiaron: si cambiaran, la columna de la
   hoja pasaría a tener dos vocabularios distintos. */
igual(valores('localidad').join(','), 'cosquin,valle,capital,otra',
  'los valores de localidad no cambiaron');
igual(valores('edad').join(','), 'menor_18,18_29,30_39,40_49,50_59,60_74,75_mas',
  'los valores de edad no cambiaron');
igual(valores('modalidad').join(','), 'online,asistida',
  'los valores de modalidad no cambiaron');

/* La convivencia se responde en la pantalla 2, pero su lista de opciones
   depende de la edad, que se respondió en la 1: por eso la función tiene
   que seguir declarando de qué depende. */
var convivencia = GATING_PASOS[1].preguntas[0];
ok(typeof convivencia.opcionesDe === 'function', 'la convivencia arma sus opciones por función');
igual((convivencia.dependeDe || []).join(','), 'edad', 'y declara que depende de la edad');
igual(convivencia.requerida, true, 'sigue siendo obligatoria');

/* =========================================================
   2. Opciones de convivencia según la edad
   ========================================================= */

titulo('La convivencia se filtra por edad');

function convivenciasDe(edad) {
  return opcionesConvivencia({ edad: edad }).map(function (o) { return o.valor; });
}

ok(convivenciasDe('menor_18').indexOf('padres_tutores') !== -1,
  'un menor ve "con mis padres o tutores"');
ok(convivenciasDe('menor_18').indexOf('hijos_adultos') === -1,
  'un menor no ve "con hijos adultos"');
ok(convivenciasDe('menor_18').indexOf('padres_abuelos') === -1,
  'un menor no ve la opción que derivaría a Track B');
ok(convivenciasDe('30_39').indexOf('residencia') === -1,
  'alguien de 30 no ve "en una residencia"');
ok(convivenciasDe('75_mas').indexOf('residencia') !== -1,
  'alguien de 75 sí ve "en una residencia"');
ok(convivenciasDe('40_49').indexOf('padres_abuelos') !== -1,
  'un adulto ve "con mis padres o abuelos"');

/* =========================================================
   3. Las 6 reglas de derivación
   ========================================================= */

titulo('Derivación a trayecto');

function derivar(localidad, edad, convivencia, vinculo) {
  return derivarTrack({
    localidad: localidad,
    edad: edad,
    convivencia: convivencia,
    vinculo: vinculo,
    modalidad: 'online'
  });
}

/* Regla 1 — 60+ en la zona */
igual(derivar('cosquin', '60_74', 'pareja'), 'A', 'A: 60-74 en Cosquín');
igual(derivar('valle', '75_mas', 'solo'), 'A', 'A: 75+ en el Valle');
igual(derivar('cosquin', '60_74', 'residencia'), 'A', 'A: 60+ en residencia, en la zona');
/* Gana sobre la regla 2 aunque la convivencia sea de las de Track B. */
igual(derivar('cosquin', '60_74', 'hijos_adultos'), 'A',
  'A le gana a B cuando la persona tiene 60+');

/* Regla 2 — menores de 60 en la zona conviviendo entre generaciones */
igual(derivar('cosquin', '40_49', 'padres_abuelos'), 'B', 'B: 40-49 con padres/abuelos');
igual(derivar('valle', '18_29', 'hijos_adultos'), 'B', 'B: 18-29 con hijos adultos');
igual(derivar('cosquin', '30_39', 'hijos_menores'), 'D1',
  'con hijos menores no es B: es intergeneracional pero no entre adultos');

/* Regla 3 — Córdoba Capital con vínculo */
igual(derivar('capital', '30_39', 'pareja', 'naci_me_fui'), 'C', 'C: se fue a Capital');
igual(derivar('capital', '60_74', 'solo', 'familia_directa'), 'C',
  'C también captura a los 60+ de Capital (no cumplen la localidad de la regla 1)');
igual(derivar('capital', '30_39', 'pareja', 'ninguno'), null,
  'Capital sin vínculo cae en el corte');

/* Regla 4 y 5 — resto de vecinos de la zona */
igual(derivar('cosquin', '18_29', 'solo'), 'D1', 'D1: 18-29 en Cosquín');
igual(derivar('valle', '30_39', 'pareja'), 'D1', 'D1: 30-39 en el Valle');
igual(derivar('cosquin', '40_49', 'solo'), 'D2', 'D2: 40-49 en Cosquín');
igual(derivar('valle', '50_59', 'pareja'), 'D2', 'D2: 50-59 en el Valle');

/* Regla 6 — corte */
igual(derivar('cosquin', 'menor_18', 'padres_tutores'), null,
  'los menores de 18 de la zona caen en el corte');
igual(derivar('capital', 'menor_18', 'padres_tutores', 'familia_directa'), null,
  'un menor de Capital con vínculo también corta: ningún trayecto lo cubre');
igual(derivar('otra', '30_39', 'pareja', 'familia_directa'), null,
  'otra localidad con vínculo corta: C es sobre la migración a Capital');
igual(derivar('otra', '60_74', 'solo', 'naci_me_fui'), null,
  'un mayor que vive lejos también corta');

/* Barrido completo: ninguna combinación puede tirar una excepción ni
   devolver algo que no sea un trayecto conocido o el corte. */
titulo('Barrido de todas las combinaciones del gating');

var VALIDOS = ['A', 'B', 'C', 'D1', 'D2', null];
var combinaciones = 0;
var porTrack = { A: 0, B: 0, C: 0, D1: 0, D2: 0, corte: 0 };

valores('localidad').forEach(function (localidad) {
  valores('edad').forEach(function (edad) {
    opcionesConvivencia({ edad: edad }).forEach(function (conv) {
      valores('vinculo').concat(['']).forEach(function (vinculo) {
        combinaciones++;
        var track = derivar(localidad, edad, conv.valor, vinculo);
        if (VALIDOS.indexOf(track) === -1) {
          fallas++;
          console.log('  ✗ trayecto inesperado: ' + track);
        }
        porTrack[track === null ? 'corte' : track]++;
      });
    });
  });
});

corridas++;
console.log('  · ' + combinaciones + ' combinaciones, todas resueltas: ' +
  JSON.stringify(porTrack));

ok(porTrack.A > 0 && porTrack.B > 0 && porTrack.C > 0 && porTrack.D1 > 0 && porTrack.D2 > 0,
  'los cinco trayectos son alcanzables desde el gating');

/* Ningún menor de 18 puede terminar en un trayecto. */
var menoresConTrayecto = 0;
valores('localidad').forEach(function (localidad) {
  opcionesConvivencia({ edad: 'menor_18' }).forEach(function (conv) {
    valores('vinculo').concat(['']).forEach(function (vinculo) {
      if (derivar(localidad, 'menor_18', conv.valor, vinculo) !== null) menoresConTrayecto++;
    });
  });
});
igual(menoresConTrayecto, 0, 'ningún menor de 18 llega a un trayecto, en ninguna combinación');

/* =========================================================
   4. Bloques de cada trayecto
   ========================================================= */

titulo('Bloques por trayecto');

function bloquesDe(track, gating) {
  return bloquesDeTrack(track, gating || {}).map(function (b) { return b.titulo; });
}

igual(bloquesDe('A', { convivencia: 'padres_abuelos' }).length, 5, 'A tiene 5 bloques');
igual(bloquesDe('B').length, 3, 'B tiene 3 bloques');
igual(bloquesDe('C').length, 4, 'C tiene 4 bloques');
igual(bloquesDe('D1').length, 4, 'D1 tiene 4 bloques');
igual(bloquesDe('D2').length, 4, 'D2 tiene 4 bloques');

['A', 'B', 'C', 'D1', 'D2'].forEach(function (track) {
  var titulos = bloquesDe(track, { convivencia: 'padres_abuelos' });
  igual(titulos[titulos.length - 1], 'Para cerrar',
    track + ' termina con el bloque de cierre');
});

/* La pregunta extra de A solo aparece si la convivencia es intergeneracional. */
function preguntasDeA(convivencia) {
  return bloquesDeTrack('A', { convivencia: convivencia }).reduce(function (acum, b) {
    return acum.concat(b.preguntas.map(function (p) { return p.id; }));
  }, []);
}

ok(preguntasDeA('padres_abuelos').indexOf('a_extra_calidad_convivencia') !== -1,
  'A con convivencia intergeneracional incluye la pregunta extra');
ok(preguntasDeA('solo').indexOf('a_extra_calidad_convivencia') === -1,
  'A viviendo solo/a no incluye la pregunta extra');

/* =========================================================
   Resumen
   ========================================================= */

console.log('\n' + (fallas === 0
  ? '✓ ' + corridas + ' comprobaciones, todo en verde.'
  : '✗ ' + fallas + ' de ' + corridas + ' comprobaciones fallaron.'));

process.exit(fallas === 0 ? 0 : 1);
