/* ===========================================================
   Encuesta sobre la ciudad — Cosquín

   Solo el CONTENIDO de esta encuesta. Dibujar las preguntas, leerlas,
   validarlas, navegar los bloques y enviar es trabajo del motor
   compartido (assets/js/encuesta-motor.js), que la página carga antes
   que este archivo.

   A diferencia de la encuesta de vivienda, esta es PLANA: no hay árbol
   de trayectos. Todo el mundo responde los mismos cuatro bloques, y el
   gating existe solo para tomar tres datos de contexto —localidad, edad
   y modalidad— más el único corte que hay: los menores de 18.

   Organización:
     1. ESQUEMA    → las preguntas, como datos
     2. ARRANQUE   → la config que se le pasa al motor
   =========================================================== */

(function () {
  'use strict';

  /* =========================================================
     1. ESQUEMA DE PREGUNTAS
     ========================================================= */

  function escala5(id, etiqueta, extremoBajo, medio, extremoAlto, ayuda) {
    return {
      id: id,
      tipo: 'escala',
      etiqueta: etiqueta,
      ayuda: ayuda,
      requerida: true,
      opciones: [
        { valor: '1', texto: '1', ayuda: extremoBajo },
        { valor: '2', texto: '2' },
        { valor: '3', texto: '3', ayuda: medio },
        { valor: '4', texto: '4' },
        { valor: '5', texto: '5', ayuda: extremoAlto }
      ]
    };
  }

  /* Pregunta abierta. Por la regla de privacidad del proyecto, el texto
     libre es SIEMPRE opcional y nunca sale por el endpoint público:
     estas respuestas viven solo en la Sheet. */
  function abierta(id, etiqueta, ayuda) {
    return {
      id: id,
      tipo: 'textarea',
      etiqueta: etiqueta,
      ayuda: ayuda ? ayuda + ' Opcional.' : 'Opcional.',
      requerida: false,
      abierta: true
    };
  }

  /* ---------- Gating ----------
     Una sola pantalla: acá no hay convivencia (cuyas opciones dependían
     de la edad y obligaban a partir el gating en dos) ni vínculo con la
     zona, porque no se deriva a ningún trayecto. */

  var P_LOCALIDAD = {
    id: 'localidad',
    tipo: 'radio',
    etiqueta: '¿Dónde vivís actualmente?',
    requerida: true,
    opciones: [
      { valor: 'cosquin', texto: 'En Cosquín' },
      { valor: 'valle', texto: 'En otra localidad del Valle de Punilla' },
      { valor: 'capital', texto: 'En Córdoba Capital' },
      { valor: 'otra', texto: 'En otro lugar' }
    ],
    campoExtra: {
      id: 'localidad_valle_cual',
      etiqueta: '¿En cuál?',
      siValor: 'valle',
      requerido: false,
      /* Texto libre: no se publica nunca (además es dato de localidad). */
      abierta: true
    }
  };

  /* La edad queda en su propia columna de la hoja `ciudad`. No deriva
     nada ni filtra ninguna pregunta —salvo el corte de los menores—:
     está para poder leer después cualquier respuesta por rango etario
     directamente desde la planilla, sin tocar código. */
  var P_EDAD = {
    id: 'edad',
    tipo: 'radio',
    etiqueta: '¿Qué edad tenés?',
    requerida: true,
    opciones: [
      { valor: 'menor_18', texto: 'Menos de 18 años' },
      { valor: '18_29', texto: 'Entre 18 y 29 años' },
      { valor: '30_39', texto: 'Entre 30 y 39 años' },
      { valor: '40_49', texto: 'Entre 40 y 49 años' },
      { valor: '50_59', texto: 'Entre 50 y 59 años' },
      { valor: '60_74', texto: 'Entre 60 y 74 años' },
      { valor: '75_mas', texto: '75 años o más' }
    ]
  };

  var P_MODALIDAD = {
    id: 'modalidad',
    tipo: 'radio',
    etiqueta: '¿Quién está completando la encuesta?',
    ayuda: 'No hay respuesta mejor ni peor: sirve para saber cómo se recogió el dato.',
    requerida: true,
    opciones: [
      { valor: 'online', texto: 'La estoy completando yo mismo/a' },
      { valor: 'asistida', texto: 'Me está ayudando otra persona' }
    ]
  };

  var GATING_PASOS = [
    {
      titulo: 'Para empezar',
      bajada: 'Tres preguntas cortas de contexto y arrancamos.',
      preguntas: [P_LOCALIDAD, P_EDAD, P_MODALIDAD]
    }
  ];

  var GATING = GATING_PASOS.reduce(function (acum, paso) {
    return acum.concat(paso.preguntas);
  }, []);

  /* ---------- Bloque 1 — Percepción del entorno ---------- */

  var BLOQUE_ENTORNO = {
    titulo: 'La ciudad que ves',
    bajada: 'Cómo ves Cosquín hoy.',
    preguntas: [
      abierta(
        'ciudad_sector_potencial',
        '¿Qué sector de la ciudad te parece que tiene más potencial y hoy está abandonado o subutilizado?',
        'Puede ser un predio, una calle, una manzana o toda una zona.'
      ),
      /* Va como radio y no como escala numérica: son cuatro etiquetas de
         palabra entera, y la escala del sitio se dibuja en una fila que
         no las deja leer en un celular. Sigue siendo ordinal: el orden
         de las opciones es el que manda en la Sheet y en el tablero. */
      {
        id: 'ciudad_relacion_rio',
        tipo: 'radio',
        etiqueta: '¿Cómo calificarías la relación de la ciudad con el río?',
        requerida: true,
        opciones: [
          { valor: 'excelente', texto: 'Excelente' },
          { valor: 'buena', texto: 'Buena' },
          { valor: 'regular', texto: 'Regular' },
          { valor: 'deficiente', texto: 'Deficiente' }
        ],
        /* El "¿por qué?" no es una pregunta aparte: es el margen de esta
           misma. Va como campoExtra sin `siValor` —así aparece siempre,
           debajo de las opciones y dentro de la misma tarjeta— en vez de
           ocupar un número propio en el bloque. */
        campoExtra: {
          id: 'ciudad_relacion_rio_por_que',
          tipo: 'textarea',
          etiqueta: '¿Por qué? (opcional)',
          requerido: false,
          abierta: true
        }
      },
      {
        id: 'ciudad_problematica',
        tipo: 'radio',
        etiqueta: '¿Cuál de estas problemáticas te preocupa más?',
        ayuda: 'Una sola: la que más te preocupe.',
        requerida: true,
        opciones: [
          { valor: 'incendios', texto: 'Incendios' },
          { valor: 'infraestructura', texto: 'Infraestructura (agua, gas, cloacas, electricidad)' },
          { valor: 'areas_inseguras', texto: 'Áreas inseguras' },
          { valor: 'accesibilidad', texto: 'Accesibilidad a ciertas zonas' },
          { valor: 'transporte_turistico', texto: 'Transporte turístico' },
          { valor: 'congestion_transito', texto: 'Congestión de tránsito' },
          { valor: 'espacios_verdes', texto: 'Falta de espacios verdes' },
          { valor: 'basura', texto: 'Recolección/tratamiento de basura' },
          { valor: 'otra', texto: 'Otra' }
        ],
        campoExtra: {
          id: 'ciudad_problematica_otra',
          etiqueta: '¿Cuál?',
          siValor: 'otra',
          requerido: false,
          abierta: true
        }
      }
    ]
  };

  /* ---------- Bloque 2 — Equipamiento y dinámica social ---------- */

  var BLOQUE_EQUIPAMIENTO = {
    titulo: 'Dónde pasa la vida',
    bajada: 'Cosquín cambia mucho entre la temporada y el resto del año.',
    preguntas: [
      abierta(
        'ciudad_falta_equipamiento',
        'Pensando en Cosquín fuera de temporada estival, ¿qué tipo de espacios públicos o equipamientos comunitarios sentís que le faltan a la ciudad?',
        'Pensá en el Cosquín de todos los días, no en el del festival.'
      ),
      abierta(
        'ciudad_motor_alternativo',
        'Más allá del festival y el circuito tradicional del folclore, ¿qué otro aspecto de la ciudad podría ser un gran motor para Cosquín si se lo trabajara mejor?'
      ),
      /* Antes era abierta. Pasa a opciones porque las respuestas caen
         casi siempre en las mismas siete categorías, y así el dato se
         puede publicar y graficar (el texto libre nunca sale). */
      {
        id: 'ciudad_donde_se_reune',
        tipo: 'radio',
        etiqueta: '¿Dónde transcurre habitualmente la vida social de la gente de tu edad en la ciudad?',
        requerida: true,
        opciones: [
          { valor: 'plaza', texto: 'Plaza' },
          { valor: 'mercado_feria', texto: 'Mercado o feria' },
          { valor: 'parada_transporte', texto: 'Parada de transporte' },
          { valor: 'escuela', texto: 'Escuela' },
          { valor: 'taller_oficio', texto: 'Taller de oficio' },
          { valor: 'costanera', texto: 'Costanera del río' },
          { valor: 'vivienda_privada', texto: 'Vivienda privada' },
          { valor: 'otro', texto: 'Otro' }
        ],
        campoExtra: {
          id: 'ciudad_donde_se_reune_otro',
          etiqueta: '¿Dónde?',
          siValor: 'otro',
          requerido: false,
          abierta: true
        }
      },
      /* Cierra el bloque haciendo de puente con el ranking del bloque
         siguiente: primero se pide el proyecto propio, sin lista a la
         vista, y recién después aparecen las siete propuestas. */
      abierta(
        'ciudad_proyecto_deseado',
        'Si se anunciara un gran proyecto de arquitectura para mejorar la calidad de vida de los residentes de Cosquín, ¿qué te gustaría que fuera?'
      )
    ]
  };

  /* ---------- Bloque 3 — Validación de propuestas ----------

     Las siete propuestas del TFC, para ordenar por urgencia. Cada una
     se lee en tres niveles: el nombre alcanza para reconocerla, la
     propuesta la resume en una línea y el detalle explica por qué. El
     motor arma la tarjeta a partir de estos tres campos.

     `texto` es el nombre corto: es lo que se anuncia por voz al mover
     un ítem y lo que va en el aria-label de las flechas. */

  var PROPUESTAS = [
    {
      valor: 'terminal_tren',
      texto: 'Terminal y estación de tren',
      propuesta: 'Renovación del nodo de movilidad interurbano.',
      detalle: 'Modernización y ampliación de la infraestructura de transporte, para resolver conflictos de tráfico en el centro, mejorar la primera impresión del turista que llega a pie, y recuperar el vacío urbano que hoy genera el predio de trenes.'
    },
    {
      valor: 'balnearios_rio',
      texto: 'Balnearios del río',
      propuesta: 'Revitalización paisajística y recreativa de la costa.',
      detalle: 'Intervención integral de los balnearios Azud Nivelador, Uranga y La Toma: un sistema de bordes que regule crecidas, mejore la accesibilidad y fomente el uso durante todo el año con nuevo equipamiento público.'
    },
    {
      valor: 'prevencion_incendios',
      texto: 'Prevención de incendios',
      propuesta: 'Infraestructura estratégica de mitigación.',
      detalle: 'Red urbana y periurbana con estaciones operativas de prevención, corredores cortafuego y refugios temporales, integrando arquitectura y gestión de riesgo ambiental.'
    },
    {
      valor: 'habitat_intergeneracional',
      texto: 'Hábitat intergeneracional y transferencia cultural',
      propuesta: 'Complejo de uso mixto vivienda + talleres.',
      detalle: 'Vivienda adaptada para adultos mayores combinada con talleres comunitarios y espacios públicos, para promover el intercambio de oficios, cultura y tradiciones folklóricas entre generaciones.'
    },
    {
      valor: 'plaza_folklore',
      texto: 'Plaza Nacional del Folklore',
      propuesta: 'Reestructuración urbana del nodo central.',
      detalle: 'Rediseño para resolver la dualidad de uso: optimizar la logística del festival, y funcionar como espacio cívico activo, sombreado y funcional el resto del año.'
    },
    {
      valor: 'accesos_ciudad',
      texto: 'Sistema de accesos a la ciudad',
      propuesta: 'Plan maestro de portales de ingreso.',
      detalle: 'Acceso Norte/Sur (ruta nueva): nuevo portal que filtra usos industriales incompatibles y sutura el tejido residencial fragmentado. Acceso histórico (calle Gerónico): boulevard que mejora la circulación, resuelve el deterioro de calzada y renueva la imagen de entrada.'
    },
    {
      valor: 'escuela_artesanias',
      texto: 'Escuela de artesanías',
      propuesta: 'Polo productivo y de formación regional.',
      detalle: 'Centro de formación y producción local que sostiene la economía cultural de Cosquín los 365 días del año, con talleres de trabajo y mercado permanente.'
    }
  ];

  var BLOQUE_PROPUESTAS = {
    titulo: 'Qué haría falta primero',
    bajada: 'Siete propuestas para Cosquín. Nos interesa el orden, no la nota.',
    preguntas: [
      /* El encuadre viaja como etiqueta de la casilla de escape para que
         se lea ANTES de pedir el orden, sin sumar un tipo de bloque
         nuevo solo para un párrafo. */
      {
        id: 'ciudad_propuestas_nose',
        tipo: 'checkbox',
        etiqueta: 'Estas son las siete propuestas que estamos estudiando. Abajo se ordenan de la más urgente a la menos urgente.',
        ayuda: 'Si no las conocés lo suficiente, marcá la casilla y seguimos: no conocerlas también es un dato.',
        requerida: false,
        opciones: [
          { valor: 'no_conozco', texto: 'No conozco lo suficiente estos proyectos como para opinar' }
        ]
      },
      {
        id: 'ciudad_propuestas_ranking',
        tipo: 'orden',
        etiqueta: 'Ordená las siete propuestas: la más urgente arriba',
        ayuda: 'Arrastrá desde el agarre, o movelas con las flechas ↑ ↓. La lista arranca desordenada a propósito.',
        requerida: true,
        /* "No conozco" es un dato válido, no un vacío: si se marca, el
           orden desaparece y deja de ser obligatorio. */
        condicion: function (r) {
          return (r.ciudad_propuestas_nose || []).indexOf('no_conozco') === -1;
        },
        opciones: PROPUESTAS
      },
      abierta(
        'ciudad_otra_propuesta',
        '¿Hay algún otro proyecto o problemática urgente que no esté en la lista?'
      )
    ]
  };

  /* ---------- Bloque 4 — Cierre ----------
     Mismo mecanismo de contacto que la encuesta de vivienda: el opt-in
     es `soloLocal` (decide si se muestran los campos, pero no viaja con
     las respuestas) y el contacto sale en un POST aparte, sin ningún id
     en común con la fila de la encuesta. */

  var BLOQUE_CIERRE = {
    titulo: 'Para cerrar',
    bajada: 'Una pregunta más y listo.',
    preguntas: [
      /* Catch-all general, distinto del del bloque anterior: aquel es
         sobre proyectos, este es sobre vivir acá. Va primero para que se
         escriba antes de que la persona ya se sienta en la salida. */
      abierta(
        'ciudad_algo_mas',
        '¿Hay algo más que quieras contarnos sobre cómo es vivir en Cosquín que deberíamos tener en cuenta para nuestro trabajo?'
      ),
      escala5(
        'ciudad_interes_tema',
        '¿Qué tanto te interesa lo que pase con el espacio público de Cosquín?',
        'Nada', 'Más o menos', 'Mucho'
      ),
      {
        id: 'cierre_optin',
        tipo: 'radio',
        etiqueta: '¿Te interesaría una entrevista más profunda, o recibir novedades del proyecto?',
        ayuda: 'Si decís que sí, te vamos a pedir un contacto. Se guarda aparte, sin ninguna conexión con las respuestas que diste.',
        requerida: true,
        soloLocal: true,
        opciones: [
          { valor: 'si', texto: 'Sí, me interesa' },
          { valor: 'no', texto: 'No, gracias' }
        ]
      },
      {
        id: 'contacto_nombre',
        tipo: 'texto',
        etiqueta: 'Tu nombre',
        requerida: true,
        esContacto: true,
        condicion: function (r) { return r.cierre_optin === 'si'; }
      },
      {
        id: 'contacto_medio',
        tipo: 'texto',
        etiqueta: 'Un mail o teléfono para contactarte',
        requerida: true,
        esContacto: true,
        condicion: function (r) { return r.cierre_optin === 'si'; }
      }
    ]
  };

  var BLOQUES = [
    BLOQUE_ENTORNO,
    BLOQUE_EQUIPAMIENTO,
    BLOQUE_PROPUESTAS,
    BLOQUE_CIERRE
  ];

  /* =========================================================
     2. ARRANQUE
     ========================================================= */

  /* Un solo recorrido para todo el mundo. El único corte es el de los
     menores de 18: igual que en la encuesta de vivienda, el sitio se
     presenta como dirigido a mayores de edad y no pide el consentimiento
     de un adulto responsable, así que un menor no puede terminar
     respondiendo por ninguna vía. Devolver null es ese corte: se muestra
     la pantalla de agradecimiento y NO se guarda nada. */
  function resolver(gating) {
    if (gating.edad === 'menor_18') return null;
    return { clave: 'ciudad', bloques: BLOQUES };
  }

  /* El payload lleva `encuesta: 'ciudad'`, que es lo que Code.gs mira
     para escribir en la hoja `ciudad` en vez de en una de trayecto.
     `respuestas` ya llega sin los campos de contacto ni los soloLocal:
     los sacó el motor. */
  function armarPayload(ctx) {
    var respuestas = ctx.respuestas;

    /* La modalidad va como campo propio, no como una respuesta más. */
    var modalidad = respuestas.modalidad || 'online';
    delete respuestas.modalidad;

    var dejoContacto = ctx.cierre.cierre_optin === 'si' &&
      ctx.cierre.contacto_nombre && ctx.cierre.contacto_medio;

    return {
      payload: {
        tipo: 'respuesta',
        encuesta: 'ciudad',
        modalidad: modalidad,
        respuestas: respuestas
      },
      contacto: dejoContacto
        ? { nombre: ctx.cierre.contacto_nombre, medio: ctx.cierre.contacto_medio }
        : null
    };
  }

  var CONFIG = {
    gatingPasos: GATING_PASOS,
    /* Acá no se estima nada: los cuatro bloques son siempre los mismos. */
    bloquesEstimados: BLOQUES.length,
    resolver: resolver,
    armarPayload: armarPayload
  };

  if (typeof window !== 'undefined' && window.TFC_ENCUESTA) {
    document.addEventListener('DOMContentLoaded', function () {
      window.TFC_ENCUESTA.iniciar(CONFIG);
    });
  }

  /* Gancho para las pruebas (tests/, se corren con node). */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      GATING: GATING,
      GATING_PASOS: GATING_PASOS,
      BLOQUES: BLOQUES,
      PROPUESTAS: PROPUESTAS,
      BLOQUE_CIERRE: BLOQUE_CIERRE,
      CONFIG: CONFIG,
      resolver: resolver,
      armarPayload: armarPayload
    };
  }
})();
