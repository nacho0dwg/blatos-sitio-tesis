/* ===========================================================
   Corre las cuatro suites y saca un solo resumen.

       node tests/todos.js

   Cada archivo se puede correr solo también; el contador de _ayuda.js
   es del proceso, así que desde acá suman todas juntas.
   =========================================================== */

'use strict';

var t = require('./_ayuda.js');

console.log('== Encuesta de vivienda ==');
require('./derivacion.js');

console.log('\n== Encuesta de ciudad ==');
require('./ciudad.js');

console.log('\n== Backend (Code.gs) ==');
require('./backend.js');

console.log('\n== Contraste y jerarquía ==');
require('./contraste.js');

t.resumen();
