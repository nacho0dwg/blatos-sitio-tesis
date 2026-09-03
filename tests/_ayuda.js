/* ===========================================================
   Lo mínimo compartido por las suites de tests/.

   Sin dependencias: node y nada más, igual que el resto del proyecto.
   El contador es global al proceso, así `node tests/todos.js` imprime
   un solo resumen aunque corran cuatro archivos.
   =========================================================== */

'use strict';

var estado = { corridas: 0, fallas: 0 };

function ok(condicion, descripcion) {
  estado.corridas++;
  if (condicion) return;
  estado.fallas++;
  console.log('  ✗ ' + descripcion);
}

function igual(obtenido, esperado, descripcion) {
  estado.corridas++;
  if (obtenido === esperado) return;
  estado.fallas++;
  console.log('  ✗ ' + descripcion + '\n      esperado: ' + JSON.stringify(esperado) +
    '\n      obtenido: ' + JSON.stringify(obtenido));
}

function titulo(texto) {
  console.log('\n' + texto);
}

/* Imprime el resumen y corta el proceso con el código que corresponda.
   Lo llama el archivo que se ejecutó directamente, no las suites que
   se cargaron desde el runner. */
function resumen() {
  console.log('\n' + (estado.fallas === 0
    ? '✓ ' + estado.corridas + ' comprobaciones, todo en verde.'
    : '✗ ' + estado.fallas + ' de ' + estado.corridas + ' comprobaciones fallaron.'));

  process.exit(estado.fallas === 0 ? 0 : 1);
}

/* True si este archivo es el que se invocó desde la línea de comandos.
   Sirve para que cada suite se pueda correr sola o desde el runner. */
function esPrincipal(modulo) {
  return require.main === modulo;
}

module.exports = {
  ok: ok,
  igual: igual,
  titulo: titulo,
  resumen: resumen,
  esPrincipal: esPrincipal,
  estado: estado
};
