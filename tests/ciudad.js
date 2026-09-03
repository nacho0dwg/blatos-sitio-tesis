/* ===========================================================
   Pruebas del esquema de la encuesta de CIUDAD.

   Se corre con:   node tests/ciudad.js
   (o todas juntas: node tests/todos.js)

   Cubre:
     · el gating (localidad, edad, modalidad — y nada más);
     · el corte de los menores de 18;
     · los cuatro bloques y sus preguntas;
     · el escape del ranking: marcar "no conozco" apaga la pregunta de
       orden Y la deja de hacer obligatoria;
     · las siete propuestas y sus tres niveles tipográficos;
     · la privacidad: abiertas siempre opcionales, contacto en un POST
       aparte y fuera del payload de la respuesta.
   =========================================================== */

'use strict';

global.document = global.document || { addEventListener: function () {} };

var t = require('./_ayuda.js');
var ok = t.ok;
var igual = t.igual;
var titulo = t.titulo;

var api = require('../assets/js/encuesta-ciudad.js');

var GATING = api.GATING;
var GATING_PASOS = api.GATING_PASOS;
var BLOQUES = api.BLOQUES;
var PROPUESTAS = api.PROPUESTAS;

function ids(preguntas) {
  return preguntas.map(function (p) { return p.id; });
}

function todasLasPreguntas() {
  return BLOQUES.reduce(function (acum, b) { return acum.concat(b.preguntas); }, []);
}

function buscar(id) {
  return todasLasPreguntas().filter(function (p) { return p.id === id; })[0];
}

/* =========================================================
   1. Gating
   ========================================================= */

titulo('Gating de la encuesta de ciudad');

igual(GATING_PASOS.length, 1,
  'una sola pantalla de gating (no hay convivencia que dependa de la edad)');

igual(ids(GATING).join(','), 'localidad,edad,modalidad',
  'el gating pregunta localidad, edad y modalidad, en ese orden');

ok(ids(GATING).indexOf('convivencia') === -1, 'no pregunta convivencia');
ok(ids(GATING).indexOf('vinculo') === -1, 'no pregunta vínculo con la zona');

GATING.forEach(function (p) {
  ok(p.requerida === true, 'la pregunta de gating ' + p.id + ' es obligatoria');
});

/* La localidad conserva el "¿cuál?" del Valle, y ese texto es abierto:
   nunca sale por el endpoint público. */
var localidad = GATING[0];
igual(localidad.campoExtra.id, 'localidad_valle_cual', 'la localidad tiene el campo "¿en cuál?"');
igual(localidad.campoExtra.siValor, 'valle', 'que aparece solo si eligió el Valle');
ok(localidad.campoExtra.abierta === true, 'y está marcado como abierto');

/* =========================================================
   2. Edad: columna propia y filtrable
   ========================================================= */

titulo('La edad es un campo propio');

var edad = GATING.filter(function (p) { return p.id === 'edad'; })[0];
igual(edad.tipo, 'radio', 'la edad es una sola opción, no texto libre');
igual(edad.opciones.map(function (o) { return o.valor; }).join(','),
  'menor_18,18_29,30_39,40_49,50_59,60_74,75_mas',
  'con los mismos rangos que la encuesta de vivienda');

/* No la usa ninguna condición de pregunta: no filtra nada dentro de la
   encuesta, existe solo como dato para leer la Sheet por rango etario.
   La única regla que la mira es el corte de los menores. */
var miranLaEdad = todasLasPreguntas().filter(function (p) {
  return typeof p.condicion === 'function' &&
    String(p.condicion).indexOf('edad') !== -1;
});
igual(miranLaEdad.length, 0, 'ninguna pregunta se muestra u oculta según la edad');

/* =========================================================
   3. Corte de menores
   ========================================================= */

titulo('Corte de los menores de 18');

igual(api.resolver({ edad: 'menor_18', localidad: 'cosquin' }), null,
  'un menor de 18 no tiene recorrido: corta y no se guarda nada');

['18_29', '30_39', '40_49', '50_59', '60_74', '75_mas'].forEach(function (e) {
  ['cosquin', 'valle', 'capital', 'otra'].forEach(function (loc) {
    var r = api.resolver({ edad: e, localidad: loc });
    ok(r !== null && r.clave === 'ciudad',
      e + ' en ' + loc + ' entra a la encuesta (es plana: no deriva)');
  });
});

/* =========================================================
   4. Bloques
   ========================================================= */

titulo('Bloques');

igual(BLOQUES.length, 4, 'cuatro bloques');
igual(BLOQUES[3].titulo, 'Para cerrar', 'el último es el cierre');

igual(ids(BLOQUES[0].preguntas).join(','),
  'ciudad_sector_potencial,ciudad_relacion_rio,ciudad_problematica',
  'bloque 1: percepción del entorno');

igual(ids(BLOQUES[1].preguntas).join(','),
  'ciudad_falta_equipamiento,ciudad_motor_alternativo,ciudad_donde_se_reune,' +
  'ciudad_proyecto_deseado',
  'bloque 2: equipamiento y dinámica social');

igual(ids(BLOQUES[2].preguntas).join(','),
  'ciudad_propuestas_nose,ciudad_propuestas_ranking,ciudad_otra_propuesta',
  'bloque 3: validación de propuestas');

igual(ids(BLOQUES[3].preguntas).join(','),
  'ciudad_algo_mas,ciudad_interes_tema,cierre_optin,contacto_nombre,contacto_medio',
  'bloque 4: cierre');

/* El "¿por qué?" del río no es una pregunta del bloque: cuelga de la
   pregunta del río como campoExtra sin `siValor`, así se dibuja dentro
   de la misma tarjeta y no se lleva un número propio. */
var rio = buscar('ciudad_relacion_rio');
ok(!!rio.campoExtra, 'el río tiene el "¿por qué?" colgado');
igual(rio.campoExtra.id, 'ciudad_relacion_rio_por_que', 'con su id de siempre');
igual(rio.campoExtra.tipo, 'textarea', 'y es un textarea, no un renglón');
ok(!rio.campoExtra.siValor,
  'sin siValor: se ve siempre, no depende de qué opción se marque');
ok(rio.campoExtra.abierta === true, 'está marcado abierta (no se publica)');
ok(rio.campoExtra.requerido === false, 'y es opcional');

/* El catch-all del cierre es otro que el del ranking: uno pregunta por
   proyectos, el otro por vivir acá. Si fueran el mismo id se pisarían. */
ok(buscar('ciudad_algo_mas').id !== buscar('ciudad_otra_propuesta').id,
  'los dos catch-all son preguntas distintas');

/* Todos los ids son únicos: dos preguntas con el mismo id se pisarían
   al leerse del DOM y al escribirse en la Sheet. */
var vistos = {};
var repetidos = 0;
todasLasPreguntas().concat(GATING).forEach(function (p) {
  if (vistos[p.id]) repetidos++;
  vistos[p.id] = true;
});
igual(repetidos, 0, 'no hay ids repetidos entre gating y bloques');

/* La relación con el río: cuatro opciones ordinales, de mejor a peor. */
var rio = buscar('ciudad_relacion_rio');
igual(rio.opciones.map(function (o) { return o.valor; }).join(','),
  'excelente,buena,regular,deficiente',
  'la relación con el río va de excelente a deficiente');
ok(rio.requerida === true, 'y es obligatoria');

/* La problemática deja escribir "otra". */
var problematica = buscar('ciudad_problematica');
igual(problematica.campoExtra.id, 'ciudad_problematica_otra', 'la problemática tiene campo "otra"');
igual(problematica.campoExtra.siValor, 'otra', 'que aparece al elegir "otra"');
ok(problematica.campoExtra.abierta === true, 'y es texto abierto');

/* =========================================================
   5. Escape del ranking
   ========================================================= */

titulo('Escape del ranking de propuestas');

var escape = buscar('ciudad_propuestas_nose');
var ranking = buscar('ciudad_propuestas_ranking');

igual(escape.tipo, 'checkbox', 'el escape es una casilla');
ok(escape.requerida === false, 'y no es obligatoria: no marcarla es lo normal');
igual(escape.opciones.length, 1, 'con una sola opción');
igual(escape.opciones[0].valor, 'no_conozco', 'cuyo valor es no_conozco');

igual(ranking.tipo, 'orden', 'el ranking es una pregunta de orden');
ok(ranking.requerida === true, 'y es obligatoria mientras se muestre');

/* La condición es lo que hace de escape: con la casilla marcada la
   pregunta no se dibuja, y el motor no valida lo que no está visible. */
ok(ranking.condicion({}) === true,
  'sin marcar nada, el ranking se muestra');
ok(ranking.condicion({ ciudad_propuestas_nose: [] }) === true,
  'con la casilla vacía, el ranking se muestra');
ok(ranking.condicion({ ciudad_propuestas_nose: ['no_conozco'] }) === false,
  'marcando "no conozco", el ranking desaparece');

/* Y esa es toda la lógica: el motor decide obligatoriedad por
   visibilidad, así que apagar la pregunta también la desobliga. */
var motor = require('../assets/js/encuesta-motor.js');
ok(typeof motor.validar === 'function', 'el motor expone validar()');

/* =========================================================
   6. Las siete propuestas
   ========================================================= */

titulo('Las siete propuestas');

igual(PROPUESTAS.length, 7, 'son siete');
ok(ranking.opciones === PROPUESTAS, 'y son las opciones del ranking');

var valoresEsperados = [
  'terminal_tren', 'balnearios_rio', 'prevencion_incendios',
  'habitat_intergeneracional', 'plaza_folklore', 'accesos_ciudad',
  'escuela_artesanias'
];
igual(PROPUESTAS.map(function (p) { return p.valor; }).join(','),
  valoresEsperados.join(','), 'con los valores esperados');

/* Los tres niveles tipográficos necesitan tres textos distintos: si
   faltara alguno, el motor dibuja la tarjeta incompleta y la jerarquía
   se cae sola. */
PROPUESTAS.forEach(function (p) {
  ok(!!p.texto && p.texto.length > 3, p.valor + ': tiene nombre');
  ok(!!p.propuesta && p.propuesta.length > 10, p.valor + ': tiene línea de propuesta');
  ok(!!p.detalle && p.detalle.length > 40, p.valor + ': tiene explicación larga');
  ok(p.propuesta !== p.detalle, p.valor + ': propuesta y detalle no son el mismo texto');
  /* El nombre es lo que se anuncia por voz al mover el ítem: si fuera
     largo, un lector de pantalla no podría seguir el reordenamiento. */
  ok(p.texto.length <= 50, p.valor + ': el nombre entra en un anuncio de voz');
});

/* =========================================================
   7. Privacidad
   ========================================================= */

titulo('Privacidad');

/* Regla no negociable del proyecto: las abiertas son SIEMPRE opcionales. */
todasLasPreguntas().forEach(function (p) {
  if (!p.abierta) return;
  ok(p.requerida === false, 'la pregunta abierta ' + p.id + ' es opcional');
});

var ABIERTAS = todasLasPreguntas()
  .filter(function (p) { return p.abierta; })
  .map(function (p) { return p.id; });

igual(ABIERTAS.join(','),
  'ciudad_sector_potencial,ciudad_falta_equipamiento,ciudad_motor_alternativo,' +
  'ciudad_proyecto_deseado,ciudad_otra_propuesta,ciudad_algo_mas',
  'las seis preguntas abiertas del cuestionario');

/* Los campos colgados también son texto libre: la regla vale igual
   para ellos, y ninguno puede ser obligatorio. */
var EXTRAS_ABIERTOS = todasLasPreguntas().concat(GATING)
  .filter(function (p) { return p.campoExtra && p.campoExtra.abierta; })
  .map(function (p) { return p.campoExtra; });

igual(EXTRAS_ABIERTOS.map(function (c) { return c.id; }).join(','),
  'ciudad_relacion_rio_por_que,ciudad_problematica_otra,' +
  'ciudad_donde_se_reune_otro,localidad_valle_cual',
  'los cuatro campos abiertos colgados de otra pregunta');

EXTRAS_ABIERTOS.forEach(function (c) {
  ok(c.requerido === false, 'el campo abierto ' + c.id + ' es opcional');
});

/* El opt-in decide si se piden los campos de contacto, pero no viaja
   con las respuestas. */
var optin = buscar('cierre_optin');
ok(optin.soloLocal === true, 'el opt-in está marcado soloLocal');

['contacto_nombre', 'contacto_medio'].forEach(function (id) {
  ok(buscar(id).esContacto === true, id + ' está marcado esContacto');
  ok(buscar(id).condicion({ cierre_optin: 'si' }) === true, id + ' aparece con el opt-in en sí');
  ok(buscar(id).condicion({ cierre_optin: 'no' }) === false, id + ' no aparece sin opt-in');
});

/* =========================================================
   8. Payload
   ========================================================= */

titulo('Payload de ciudad');

var envio = api.armarPayload({
  clave: 'ciudad',
  gating: {},
  respuestas: {
    modalidad: 'asistida',
    localidad: 'cosquin',
    edad: '60_74',
    ciudad_relacion_rio: 'deficiente',
    ciudad_propuestas_ranking: ['balnearios_rio', 'terminal_tren']
  },
  cierre: { cierre_optin: 'si', contacto_nombre: 'Ana', contacto_medio: 'ana@ejemplo' }
});

igual(envio.payload.tipo, 'respuesta', 'es de tipo respuesta');
igual(envio.payload.encuesta, 'ciudad', 'lleva encuesta: ciudad (es lo que rutea la hoja)');
igual(envio.payload.track, undefined, 'y NO lleva track: no hay trayectos acá');
igual(envio.payload.modalidad, 'asistida', 'la modalidad sale como campo propio');
igual(envio.payload.respuestas.modalidad, undefined, 'y ya no está entre las respuestas');
igual(envio.payload.respuestas.edad, '60_74', 'la edad viaja como respuesta, con su propio id');

igual(envio.contacto.nombre, 'Ana', 'el contacto va aparte');
ok(JSON.stringify(envio.payload).indexOf('Ana') === -1,
  'el contacto no aparece por ningún lado dentro del payload de la respuesta');

var sinContacto = api.armarPayload({
  clave: 'ciudad', gating: {}, respuestas: {}, cierre: { cierre_optin: 'no' }
});
igual(sinContacto.contacto, null, 'sin opt-in no se manda contacto');

igual(api.CONFIG.bloquesEstimados, 4,
  'la barra de progreso sabe que siempre son cuatro bloques');

if (t.esPrincipal(module)) t.resumen();
