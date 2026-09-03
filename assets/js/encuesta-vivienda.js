/* ===========================================================
   Encuesta de vivienda intergeneracional — Cosquín

   Solo el CONTENIDO de esta encuesta. Dibujar las preguntas, leerlas,
   validarlas, navegar los bloques y enviar es trabajo del motor
   compartido (assets/js/encuesta-motor.js), que la página carga antes
   que este archivo.

   Organización:
     1. ESQUEMA     → las preguntas, como datos
     2. DERIVACIÓN  → las 6 reglas que asignan trayecto
     3. ARRANQUE    → la config que se le pasa al motor

   Tipos de pregunta soportados por el motor:
     radio | checkbox | escala | orden | texto | textarea

   Para sumar otra encuesta se escribe un archivo como este —esquema
   más config— y se reusa el mismo motor. Ver encuesta-ciudad.js.
   =========================================================== */

(function () {
  'use strict';

  /* =========================================================
     1. ESQUEMA DE PREGUNTAS

     tipo:        radio | checkbox | escala | orden | texto | textarea
     requerida:   si es false, se puede dejar vacía
     abierta:     true  => texto libre. SIEMPRE opcional y NUNCA se publica.
     condicion:   función que recibe las respuestas ya cargadas del bloque
                  y decide si la pregunta se muestra.
     grupos:      parte la lista de opciones en sub-bloques con subtítulo.
     presentacion:'grilla' => tarjetas con ícono en dos columnas.
     opcionesDe:  función que devuelve las opciones según otras respuestas
                  (se re-dibuja sola cuando cambia lo que mira).
     ========================================================= */

  var LOCALIDADES_ZONA = ['cosquin', 'valle'];
  var EDADES_60_MAS = ['60_74', '75_mas'];
  var EDADES_D1 = ['18_29', '30_39'];
  var EDADES_D2 = ['40_49', '50_59'];

  /* Convivencias que derivan a Track B (menores de 60 en la zona). */
  var CONVIVENCIA_TRACK_B = ['padres_abuelos', 'hijos_adultos'];

  /* Convivencias que implican otra generación bajo el mismo techo.
     Habilitan la pregunta extra del Track A. */
  var CONVIVENCIA_INTERGENERACIONAL = ['hijos_menores', 'hijos_adultos', 'padres_abuelos'];

  /* Aplana los grupos a la lista chata de opciones. El render usa
     `grupos`; la lectura, la validación y las etiquetas usan `opciones`.
     Se deriva en vez de escribirse dos veces para que no puedan quedar
     desincronizadas. */
  function aplanar(grupos) {
    return grupos.reduce(function (acum, grupo) {
      return acum.concat(grupo.opciones);
    }, []);
  }

  /* ---------------------------------------------------------
     Íconos de la grilla de espacios.
     Trazo simple, sin relleno: se leen a 24px y heredan el color
     del texto, así funcionan igual en claro que en oscuro.
     --------------------------------------------------------- */
  var ICONOS = {
    cocina_comedor: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/>',
    living_patio: '<path d="M4 11V8a2 2 0 012-2h12a2 2 0 012 2v3"/><path d="M3 11h18v6H3z"/><path d="M6 17v2M18 17v2"/>',
    lavadero: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="14" r="4"/><path d="M7 6.5h2.5"/>',
    deposito: '<path d="M3 8l9-4 9 4v10l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v10"/>',
    huespedes: '<path d="M3 19v-8h18v8"/><path d="M3 11V6"/><path d="M7 11V9a2 2 0 012-2h6a2 2 0 012 2v2"/><path d="M3 19v2M21 19v2"/>',
    huerta: '<path d="M12 21v-8"/><path d="M12 13c0-4 3-6.5 6.5-6.5C18.5 10 15.5 13 12 13z"/><path d="M12 15.5c0-3-2.2-5.2-5.2-5.2C6.8 13 9 15.5 12 15.5z"/>',
    taller: '<path d="M11 8.5l-7 7 3 3 7-7"/><path d="M13.5 3l7.5 7.5-3 3-7.5-7.5z"/>',
    auto: '<path d="M3 16v-4l2-5h14l2 5v4z"/><path d="M4 16v3M20 16v3"/><circle cx="7.5" cy="16" r="1.4"/><circle cx="16.5" cy="16" r="1.4"/>',
    wifi: '<path d="M3 9.5a15 15 0 0118 0"/><path d="M6.5 13a10 10 0 0111 0"/><path d="M10 16.5a5 5 0 014 0"/><circle cx="12" cy="19.5" r="1"/>',
    comercio: '<path d="M4 9h16v11H4z"/><path d="M3 9l2-5h14l2 5"/><path d="M9 20v-6h6v6"/>',
    plaza: '<path d="M12 21v-5"/><path d="M12 16a5 5 0 01-4.4-7.4A4 4 0 0112 4.5a4 4 0 014.4 4.1A5 5 0 0112 16z"/><path d="M8.5 19.5h7"/>',
    cuidado: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M7.5 12h9"/>'
  };

  /* ---------------------------------------------------------
     Lista de espacios (12).
     Se usa dos veces en cada trayecto que la incluye: qué se
     compartiría y qué no. Es la MISMA lista a propósito: la
     comparación entre las dos respuestas es el dato interesante.

     El agrupamiento va de lo más privado a lo más urbano, que es
     el orden en que se explica cuando la encuesta se lee en voz alta.
     Respaldo bibliográfico por opción en
     docs/encuesta-vivienda-fundamentacion.md
     --------------------------------------------------------- */
  var GRUPOS_ESPACIOS = [
    {
      titulo: 'Dentro de la casa',
      opciones: [
        { valor: 'cocina_comedor', texto: 'Cocina o comedor', icono: 'cocina_comedor' },
        { valor: 'living_patio', texto: 'Living, patio o galería para estar', icono: 'living_patio' },
        { valor: 'lavadero', texto: 'Lavadero', icono: 'lavadero' },
        { valor: 'deposito', texto: 'Espacio de guardado o depósito', icono: 'deposito' },
        { valor: 'huespedes', texto: 'Cuarto de huéspedes', icono: 'huespedes' }
      ]
    },
    {
      titulo: 'Para hacer cosas',
      opciones: [
        { valor: 'huerta', texto: 'Huerta o jardín', icono: 'huerta' },
        { valor: 'taller', texto: 'Taller o herramientas', icono: 'taller' }
      ]
    },
    {
      titulo: 'Servicios y entorno',
      opciones: [
        { valor: 'auto', texto: 'Auto u otro medio de transporte', icono: 'auto' },
        { valor: 'wifi', texto: 'Wifi o servicios', icono: 'wifi' },
        { valor: 'comercio', texto: 'Café, almacén o feria a pocos pasos', icono: 'comercio' },
        { valor: 'plaza', texto: 'Plaza o espacio verde cercano', icono: 'plaza' },
        { valor: 'cuidado', texto: 'Un lugar de atención o cuidado cerca', icono: 'cuidado' }
      ]
    }
  ];

  var ESPACIOS_PLANOS = aplanar(GRUPOS_ESPACIOS);

  /* Fabrica la pregunta de espacios: cambia el id y el enunciado,
     la lista es siempre la misma. */
  function preguntaEspacios(id, etiqueta, ayuda) {
    return {
      id: id,
      tipo: 'checkbox',
      etiqueta: etiqueta,
      ayuda: ayuda,
      requerida: true,
      presentacion: 'grilla',
      grupos: GRUPOS_ESPACIOS,
      opciones: ESPACIOS_PLANOS
    };
  }

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

  /* ---------- Convivencia: opciones según la edad ya respondida ----------
     Una persona de 16 años no tiene por qué leer "con hijos adultos",
     ni una de 30 "en una residencia". Se arma la lista con lo que puede
     pasarle a quien está respondiendo, y nada más. */
  var CONVIVENCIA_MENOR = [
    { valor: 'solo', texto: 'Solo/a' },
    { valor: 'padres_tutores', texto: 'Con mis padres o tutores' },
    { valor: 'hermanos_otros', texto: 'Con hermanos/as' },
    { valor: 'asistencia', texto: 'Con una persona de asistencia o cuidadora' },
    { valor: 'otro', texto: 'Otra situación' }
  ];

  var CONVIVENCIA_ADULTA = [
    { valor: 'solo', texto: 'Solo/a' },
    { valor: 'pareja', texto: 'En pareja' },
    { valor: 'hijos_menores', texto: 'Con hijos/as menores de edad' },
    { valor: 'hijos_adultos', texto: 'Con hijos/as adultos/as' },
    { valor: 'padres_abuelos', texto: 'Con mis padres, madre/padre o abuelos/as' },
    { valor: 'hermanos_otros', texto: 'Con hermanos/as u otros familiares' },
    { valor: 'asistencia', texto: 'Con una persona de asistencia o cuidadora' },
    { valor: 'otro', texto: 'Otra situación' }
  ];

  var CONVIVENCIA_MAYOR = CONVIVENCIA_ADULTA.concat([
    { valor: 'residencia', texto: 'En una residencia o geriátrico' }
  ]);

  function opcionesConvivencia(r) {
    if (r.edad === 'menor_18') return CONVIVENCIA_MENOR;
    if (EDADES_60_MAS.indexOf(r.edad) !== -1) return CONVIVENCIA_MAYOR;
    return CONVIVENCIA_ADULTA;
  }

  /* ---------- Gating ----------
     Dos pantallas cortas antes de derivar el trayecto:

       1. "Para empezar"   → localidad (+ vínculo, si no vive en la zona),
                             edad y modalidad.
       2. "Tu convivencia" → con quién vive.

     La convivencia va sola en la segunda porque sus opciones dependen
     de la edad: recién cuando esa respuesta ya existe se puede armar la
     lista que le corresponde a quien está respondiendo, sin ofrecerle
     situaciones imposibles.

     Es un corte de PRESENTACIÓN, no de datos: la respuesta sigue
     guardándose en la misma columna `convivencia` de la hoja, y las
     seis reglas de derivación siguen mirando el conjunto de las dos
     pantallas. */

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

  /* Va pegada a la localidad —y no al final, como estaba— porque es una
     repregunta sobre ella: solo aparece si no vive en la zona. */
  var P_VINCULO = {
    id: 'vinculo',
    tipo: 'radio',
    etiqueta: '¿Qué vínculo tenés con Cosquín?',
    requerida: true,
    condicion: function (r) {
      return r.localidad && LOCALIDADES_ZONA.indexOf(r.localidad) === -1;
    },
    opciones: [
      { valor: 'naci_me_fui', texto: 'Nací ahí y me fui' },
      { valor: 'familia_directa', texto: 'Tengo familia directa ahí' },
      { valor: 'vacaciones', texto: 'Fui de vacaciones' },
      { valor: 'ninguno', texto: 'Ningún vínculo particular' }
    ]
  };

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

  var P_CONVIVENCIA = {
    id: 'convivencia',
    tipo: 'radio',
    etiqueta: '¿Con quién vivís hoy?',
    ayuda: 'Elegí la opción que mejor describa tu casa.',
    requerida: true,
    /* Las opciones dependen de la edad, que se respondió en la pantalla
       anterior: llega como contexto del paso, no como una respuesta de
       este contenedor. */
    opcionesDe: opcionesConvivencia,
    dependeDe: ['edad'],
    opciones: CONVIVENCIA_ADULTA
  };

  var GATING_PASOS = [
    {
      titulo: 'Para empezar',
      bajada: 'Unas preguntas cortas para saber qué parte de la encuesta te corresponde.',
      preguntas: [P_LOCALIDAD, P_VINCULO, P_EDAD, P_MODALIDAD]
    },
    {
      titulo: 'Tu convivencia',
      bajada: 'Con quién compartís la casa hoy.',
      preguntas: [P_CONVIVENCIA]
    }
  ];

  /* Lista chata de las dos pantallas. Se deriva de los pasos en vez de
     escribirse aparte para que no puedan quedar desincronizadas. */
  var GATING = GATING_PASOS.reduce(function (acum, paso) {
    return acum.concat(paso.preguntas);
  }, []);

  /* =========================================================
     TRACK A — Adultos mayores residentes (Cosquín / el Valle)
     Todo el trayecto habla de usted.
     ========================================================= */

  var BLOQUES_A = [
    {
      titulo: 'Su casa hoy',
      bajada: 'Cómo es el lugar donde vive y qué tan cómodo le resulta.',
      preguntas: [
        {
          id: 'a_anios_casa',
          tipo: 'radio',
          etiqueta: '¿Hace cuántos años vive en su casa actual?',
          requerida: true,
          opciones: [
            { valor: 'menos_5', texto: 'Menos de 5 años' },
            { valor: '5_14', texto: 'Entre 5 y 14 años' },
            { valor: '15_29', texto: 'Entre 15 y 29 años' },
            { valor: '30_mas', texto: '30 años o más' }
          ]
        },
        {
          id: 'a_tenencia',
          tipo: 'radio',
          etiqueta: '¿La casa es propia o alquila?',
          requerida: true,
          opciones: [
            { valor: 'propietario', texto: 'Es propia' },
            { valor: 'alquila', texto: 'La alquilo' },
            { valor: 'familiar', texto: 'Es de un familiar' },
            { valor: 'otro', texto: 'Otra situación' }
          ]
        },
        escala5(
          'a_accesibilidad',
          '¿Qué tan fácil le resulta moverse dentro de su casa?',
          'Muy fácil', 'Más o menos', 'Muy difícil',
          'Pensando en escalones, pasillos, el baño, la altura de las cosas.'
        ),
        {
          id: 'a_orientacion',
          tipo: 'checkbox',
          etiqueta: '¿Hay algo en su casa que lo/la ayude a sentirse ubicado/a y en confianza?',
          ayuda: 'Puede marcar todas las que quiera.',
          requerida: true,
          opciones: [
            { valor: 'colores', texto: 'Colores o detalles distintivos en cada ambiente' },
            { valor: 'objetos', texto: 'Objetos o fotos personales a la vista' },
            { valor: 'luz', texto: 'Buena luz natural' },
            { valor: 'recorrido', texto: 'Un recorrido simple entre los ambientes' },
            { valor: 'sonidos', texto: 'Sonidos u olores familiares (la cocina, el patio)' }
          ]
        },
        {
          id: 'a_orientacion_otro',
          tipo: 'textarea',
          etiqueta: '¿Hay alguna otra cosa que la ayude a ubicarse en su casa?',
          ayuda: 'Opcional. Cuéntelo con sus palabras.',
          requerida: false,
          abierta: true
        }
      ]
    },
    {
      titulo: 'Su día a día',
      bajada: 'Cómo se maneja hoy y con quién cuenta.',
      preguntas: [
        escala5('a_soledad', '¿Qué tan seguido se siente solo/a?', 'Nunca', 'A veces', 'Muy seguido'),
        {
          id: 'a_ayuda_cerca',
          tipo: 'radio',
          etiqueta: 'Si necesita ayuda en el día a día, ¿tiene a alguien cerca?',
          requerida: true,
          opciones: [
            { valor: 'si_siempre', texto: 'Sí, siempre hay alguien' },
            { valor: 'si_a_veces', texto: 'Sí, pero no siempre' },
            { valor: 'no', texto: 'No, no tengo a nadie cerca' },
            { valor: 'no_se', texto: 'No sabría decir' }
          ]
        },
        {
          id: 'a_servicios',
          tipo: 'checkbox',
          etiqueta: '¿Qué cosas considera indispensables para poder vivir de forma autónoma?',
          ayuda: 'Puede marcar todas las que quiera.',
          requerida: true,
          opciones: [
            { valor: 'salud_cercana', texto: 'Tener atención de salud cerca' },
            { valor: 'transporte', texto: 'Transporte público accesible' },
            { valor: 'comercios_pie', texto: 'Poder llegar caminando a los comercios' },
            { valor: 'compania_cuidado', texto: 'Compañía o alguien que ayude con el cuidado' },
            { valor: 'actividades_sociales', texto: 'Actividades sociales o para compartir' }
          ]
        },
        /* Extra: solo si convive con otra generación bajo el mismo techo. */
        Object.assign(
          escala5(
            'a_extra_calidad_convivencia',
            '¿Cómo calificaría la convivencia con su familia hoy?',
            'Muy mala', 'Ni bien ni mal', 'Muy buena'
          ),
          { extra: true }
        )
      ]
    },
    {
      titulo: 'Cómo se imagina vivir',
      bajada: 'Qué le gustaría y qué le preocuparía de compartir el lugar con otras personas.',
      preguntas: [
        {
          id: 'a_preferencia_convivencia',
          tipo: 'radio',
          etiqueta: 'Si pudiera elegir, ¿cómo preferiría vivir?',
          requerida: true,
          opciones: [
            { valor: 'solo', texto: 'Solo/a' },
            { valor: 'gente_mi_edad', texto: 'Con gente de mi edad' },
            { valor: 'otras_generaciones', texto: 'Con personas de otras edades y generaciones' },
            { valor: 'no_se', texto: 'No sabría decir' }
          ]
        },
        escala5(
          'a_espacio_propio',
          'Si compartiera el lugar con otras personas, ¿qué tan importante sería tener un espacio propio?',
          'Nada importante', 'Más o menos', 'Muy importante'
        ),
        {
          id: 'a_interes_modelo',
          tipo: 'radio',
          etiqueta: '¿Le interesaría vivir en un lugar con su propia vivienda, pero con espacios comunes compartidos (patio, comedor, talleres)?',
          requerida: true,
          opciones: [
            { valor: 'si', texto: 'Sí, me interesaría' },
            { valor: 'no', texto: 'No, prefiero que no' },
            { valor: 'no_se', texto: 'No sé' }
          ]
        },
        {
          id: 'a_preocupaciones',
          tipo: 'orden',
          etiqueta: 'De un lugar así, ¿qué es lo que más le preocuparía?',
          ayuda: 'Arrastre para ordenar: lo que más le preocupa arriba, lo que menos abajo. También puede usar las flechas.',
          requerida: true,
          opciones: [
            { valor: 'privacidad', texto: 'Perder privacidad o no tener espacio propio' },
            { valor: 'ruidos', texto: 'Ruidos molestos' },
            { valor: 'limpieza', texto: 'La limpieza y el orden de los espacios compartidos' },
            { valor: 'conflictos', texto: 'Conflictos por el uso de los espacios comunes' },
            { valor: 'gastos', texto: 'Los gastos o costos compartidos' },
            { valor: 'carga', texto: 'Sentir que soy una carga para otros, o que otros lo son para mí' },
            { valor: 'independencia', texto: 'Perder independencia' }
          ]
        },
        {
          id: 'a_actividades_ninguna',
          tipo: 'checkbox',
          etiqueta: 'Pensando en actividades para hacer con otras personas del lugar…',
          ayuda: 'Si no le interesa hacer actividades en conjunto, marque la casilla y seguimos.',
          requerida: false,
          opciones: [
            { valor: 'ninguna', texto: 'Prefiero no hacer actividades en conjunto' }
          ]
        },
        {
          id: 'a_actividades',
          tipo: 'orden',
          etiqueta: '¿Cuáles le gustaría más?',
          ayuda: 'Arrastre para ordenar: la que más le gustaría arriba, la que menos abajo.',
          requerida: true,
          condicion: function (r) {
            return (r.a_actividades_ninguna || []).indexOf('ninguna') === -1;
          },
          opciones: [
            { valor: 'cocinar', texto: 'Cocinar o comer juntos' },
            { valor: 'huerta', texto: 'Cuidar una huerta o plantas' },
            { valor: 'manualidades', texto: 'Hacer manualidades u oficios' },
            { valor: 'juegos', texto: 'Juegos de mesa o cartas' },
            { valor: 'musica', texto: 'Música' },
            { valor: 'historias', texto: 'Compartir historias o recuerdos' },
            { valor: 'cuidar', texto: 'Cuidar niños o mascotas juntos' },
            { valor: 'caminar', texto: 'Caminar o hacer actividad física' }
          ]
        }
      ]
    },
    {
      titulo: 'Qué compartiría y qué no',
      bajada: 'La misma lista, dos veces: primero lo que compartiría, después lo que preferiría guardarse.',
      preguntas: [
        preguntaEspacios(
          'a_compartir',
          '¿Qué cosas estaría dispuesto/a a compartir?',
          'Marque todas las que le parezcan bien compartir.'
        ),
        preguntaEspacios(
          'a_no_compartir',
          '¿Y qué preferiría NO compartir?',
          'Marque lo que querría tener solo para usted.'
        )
      ]
    }
  ];

  /* =========================================================
     TRACK B — Familias con convivencia intergeneracional
     ========================================================= */

  var BLOQUES_B = [
    {
      titulo: 'Quiénes conviven',
      bajada: 'Cómo se armó la casa en la que viven hoy.',
      preguntas: [
        {
          id: 'b_generaciones',
          tipo: 'checkbox',
          etiqueta: '¿Quiénes viven en la casa?',
          ayuda: 'Marcá todas las generaciones presentes, incluyéndote.',
          requerida: true,
          opciones: [
            { valor: 'ninos_adolescentes', texto: 'Niños/as o adolescentes' },
            { valor: 'adultos_jovenes', texto: 'Adultos jóvenes (18 a 35)' },
            { valor: 'adultos', texto: 'Adultos (36 a 59)' },
            { valor: 'adultos_mayores', texto: 'Adultos mayores (60 o más)' }
          ]
        },
        {
          id: 'b_hace_cuanto',
          tipo: 'radio',
          etiqueta: '¿Hace cuánto conviven así?',
          requerida: true,
          opciones: [
            { valor: 'menos_1', texto: 'Menos de un año' },
            { valor: '1_3', texto: 'Entre 1 y 3 años' },
            { valor: '4_10', texto: 'Entre 4 y 10 años' },
            { valor: 'mas_10', texto: 'Más de 10 años' },
            { valor: 'siempre', texto: 'Siempre fue así' }
          ]
        },
        {
          id: 'b_motivo',
          tipo: 'radio',
          etiqueta: '¿La convivencia fue una decisión o se dio por necesidad?',
          requerida: true,
          opciones: [
            { valor: 'elegida', texto: 'Fue una decisión, la elegimos' },
            { valor: 'necesidad_economica', texto: 'Por necesidad económica' },
            { valor: 'necesidad_salud', texto: 'Por una cuestión de salud o cuidado' },
            { valor: 'otra', texto: 'Por otro motivo' }
          ]
        }
      ]
    },
    {
      titulo: 'Cómo funciona hoy',
      bajada: 'Qué anda bien, qué cuesta y qué cambiarían.',
      preguntas: [
        escala5(
          'b_calidad_convivencia',
          '¿Cómo calificarían la convivencia hoy?',
          'Muy mala', 'Ni bien ni mal', 'Muy buena'
        ),
        {
          id: 'b_dificultades',
          tipo: 'checkbox',
          etiqueta: '¿Qué es lo más difícil de convivir así?',
          ayuda: 'Podés marcar más de una.',
          requerida: true,
          opciones: [
            { valor: 'falta_espacio', texto: 'Falta de espacio' },
            { valor: 'privacidad', texto: 'Falta de privacidad' },
            { valor: 'tareas_cuidado', texto: 'Las tareas de cuidado' },
            { valor: 'diferencias_economicas', texto: 'Diferencias económicas' },
            { valor: 'nada', texto: 'Nada en particular, funciona bien' }
          ]
        },
        {
          id: 'b_rediseno',
          tipo: 'orden',
          etiqueta: 'Si pudieran rediseñar la vivienda, ¿qué cambiarían primero?',
          ayuda: 'Arrastrá para ordenar: lo más importante arriba, lo menos importante abajo.',
          requerida: true,
          opciones: [
            { valor: 'mas_m2', texto: 'Más metros cuadrados' },
            { valor: 'espacios_privados', texto: 'Espacios privados separados' },
            { valor: 'accesibilidad', texto: 'Accesibilidad (escalones, baño, pasillos)' },
            { valor: 'espacio_exterior', texto: 'Espacio exterior (patio, galería)' },
            { valor: 'productivo_huerta', texto: 'Espacio productivo o huerta' }
          ]
        }
      ]
    }
  ];

  /* =========================================================
     TRACK C — Migrantes a Córdoba Capital con vínculo a Cosquín
     ========================================================= */

  var BLOQUES_C = [
    {
      titulo: 'Por qué te fuiste',
      bajada: 'Cómo fue la salida de la zona.',
      preguntas: [
        {
          id: 'c_motivo_partida',
          tipo: 'checkbox',
          etiqueta: '¿Por qué te fuiste de Cosquín o la zona?',
          ayuda: 'Podés marcar más de una.',
          requerida: true,
          opciones: [
            { valor: 'estudio', texto: 'Para estudiar' },
            { valor: 'trabajo', texto: 'Por trabajo' },
            { valor: 'vivienda', texto: 'Por vivienda más accesible' },
            { valor: 'familia', texto: 'Por motivos familiares o de pareja' },
            { valor: 'otro', texto: 'Por otro motivo' }
          ]
        },
        {
          id: 'c_hace_cuanto_capital',
          tipo: 'radio',
          etiqueta: '¿Hace cuánto vivís en Córdoba Capital?',
          requerida: true,
          opciones: [
            { valor: 'menos_2', texto: 'Menos de 2 años' },
            { valor: '2_5', texto: 'Entre 2 y 5 años' },
            { valor: '6_10', texto: 'Entre 6 y 10 años' },
            { valor: 'mas_10', texto: 'Más de 10 años' }
          ]
        }
      ]
    },
    {
      titulo: 'Tu familia en la zona',
      bajada: 'Cómo se sostiene el vínculo a distancia.',
      preguntas: [
        {
          id: 'c_familiares_mayores',
          tipo: 'radio',
          etiqueta: '¿Tenés familiares mayores que siguen viviendo en Cosquín o la zona?',
          requerida: true,
          opciones: [
            { valor: 'si', texto: 'Sí' },
            { valor: 'no', texto: 'No' }
          ]
        },
        {
          id: 'c_acompanamiento',
          tipo: 'radio',
          etiqueta: '¿Cómo es el acompañamiento a esa distancia?',
          requerida: true,
          condicion: function (r) { return r.c_familiares_mayores === 'si'; },
          opciones: [
            { valor: 'visitas_seguido', texto: 'Los visito seguido' },
            { valor: 'otro_familiar', texto: 'Hay otro familiar que se ocupa' },
            { valor: 'ayuda_contratada', texto: 'Contratamos a alguien que ayude' },
            { valor: 'estan_solos', texto: 'Están bastante solos' }
          ]
        }
      ]
    },
    {
      titulo: '¿Volverías?',
      bajada: 'Qué haría falta para que volver sea una opción real.',
      preguntas: [
        {
          id: 'c_volveria',
          tipo: 'radio',
          etiqueta: '¿Considerarías volver a vivir en Cosquín o la zona?',
          requerida: true,
          opciones: [
            { valor: 'si_corto_plazo', texto: 'Sí, en el corto plazo' },
            { valor: 'si_futuro', texto: 'Sí, más adelante' },
            { valor: 'no', texto: 'No' }
          ]
        },
        {
          id: 'c_condiciones_volver',
          tipo: 'checkbox',
          etiqueta: '¿Qué haría falta para que vuelvas?',
          ayuda: 'Podés marcar más de una.',
          requerida: true,
          opciones: [
            { valor: 'vivienda_accesible', texto: 'Vivienda accesible (precio o alquiler)' },
            { valor: 'trabajo', texto: 'Oportunidades de trabajo' },
            { valor: 'convivir_cuidar', texto: 'Poder convivir o cuidar a un familiar' },
            { valor: 'servicios', texto: 'Mejores servicios (salud, transporte)' },
            { valor: 'nada', texto: 'Nada, no volvería' }
          ]
        },
        {
          id: 'c_interes_modelo',
          tipo: 'radio',
          etiqueta: '¿Te interesaría un modelo de vivienda donde convivan distintas generaciones, con unidades privadas y espacios comunes?',
          requerida: true,
          opciones: [
            { valor: 'si', texto: 'Sí' },
            { valor: 'no', texto: 'No' },
            { valor: 'no_se', texto: 'No sé' }
          ]
        }
      ]
    }
  ];

  /* =========================================================
     TRACKS D1 y D2 — Vecinos de la zona sin situación particular
     D2 = D1 + una pregunta al final. Se arma con una función para
     que las dos versiones no puedan desincronizarse.
     ========================================================= */

  function bloquesD(esD2) {
    var ultimo = {
      titulo: 'Vos, en un lugar así',
      bajada: 'La misma lista dos veces: qué compartirías y qué no.',
      preguntas: [
        preguntaEspacios(
          'd_compartir',
          '¿Qué cosas estarías dispuesto/a a compartir?',
          'Marcá todas las que te parezcan bien compartir.'
        ),
        preguntaEspacios(
          'd_no_compartir',
          '¿Y qué preferirías NO compartir?',
          'Marcá lo que querrías tener solo para vos.'
        ),
        {
          id: 'd_viviria',
          tipo: 'radio',
          etiqueta: '¿Vivirías en un modelo así en el futuro?',
          requerida: true,
          opciones: [
            { valor: 'si', texto: 'Sí, lo elegiría' },
            { valor: 'tal_vez', texto: 'Tal vez, depende de cómo esté armado' },
            { valor: 'no', texto: 'No' }
          ]
        },
        {
          id: 'd_recomendaria',
          tipo: 'radio',
          etiqueta: '¿Se lo recomendarías a un familiar?',
          requerida: true,
          opciones: [
            { valor: 'si', texto: 'Sí' },
            { valor: 'tal_vez', texto: 'Tal vez' },
            { valor: 'no', texto: 'No' }
          ]
        }
      ]
    };

    if (esD2) {
      ultimo.preguntas.push({
        id: 'd2_familiar_mayor',
        tipo: 'radio',
        etiqueta: '¿Tenés hoy algún familiar mayor (60+) al que te gustaría tener cerca en un lugar así?',
        requerida: true,
        opciones: [
          { valor: 'si', texto: 'Sí' },
          { valor: 'no', texto: 'No' },
          { valor: 'no_aplica', texto: 'No aplica' }
        ]
      });
    }

    return [
      {
        titulo: 'Tu zona hoy',
        bajada: 'Cómo ves el lugar donde vivís.',
        preguntas: [
          {
            id: 'd_hace_cuanto_zona',
            tipo: 'radio',
            etiqueta: '¿Hace cuánto vivís en la zona?',
            requerida: true,
            opciones: [
              { valor: 'menos_2', texto: 'Menos de 2 años' },
              { valor: '2_10', texto: 'Entre 2 y 10 años' },
              { valor: 'mas_10', texto: 'Más de 10 años' },
              { valor: 'toda_la_vida', texto: 'Toda mi vida' }
            ]
          },
          {
            id: 'd_impacto_turismo',
            tipo: 'radio',
            etiqueta: '¿Notás que el turismo o la temporada afectan los alquileres y los precios en tu zona?',
            requerida: true,
            opciones: [
              { valor: 'si_mucho', texto: 'Sí, mucho' },
              { valor: 'si_algo', texto: 'Sí, algo' },
              { valor: 'no', texto: 'No' },
              { valor: 'no_se', texto: 'No sabría decir' }
            ]
          },
          {
            id: 'd_mayores_solos',
            tipo: 'radio',
            etiqueta: '¿Conocés casos cercanos de adultos mayores que vivan solos?',
            ayuda: 'Es un dato general del barrio: no se pide ningún nombre ni dirección.',
            requerida: true,
            opciones: [
              { valor: 'si_varios', texto: 'Sí, varios casos' },
              { valor: 'si_alguno', texto: 'Sí, alguno' },
              { valor: 'no', texto: 'No' },
              { valor: 'no_se', texto: 'No sabría decir' }
            ]
          }
        ]
      },
      {
        titulo: 'Cómo ves la idea',
        bajada: 'Qué te parece bueno y qué te preocuparía de vivir entre generaciones.',
        preguntas: [
          {
            id: 'd_beneficios',
            tipo: 'checkbox',
            etiqueta: '¿Qué beneficios le ves a que convivan distintas generaciones?',
            ayuda: 'Podés marcar todos los que quieras.',
            requerida: true,
            opciones: [
              { valor: 'compania', texto: 'Compañía y menos soledad para los adultos mayores' },
              { valor: 'ayuda_mutua', texto: 'Ayuda mutua en las tareas de todos los días' },
              { valor: 'ahorro', texto: 'Ahorrar compartiendo gastos' },
              { valor: 'red_cuidado', texto: 'Una red de cuidado para los hijos o los chicos' },
              { valor: 'oficios', texto: 'Aprender o transmitir oficios entre generaciones' },
              { valor: 'comunidad', texto: 'Sensación de comunidad' }
            ]
          },
          {
            id: 'd_beneficios_otro',
            tipo: 'texto',
            etiqueta: '¿Algún otro beneficio que no esté en la lista?',
            ayuda: 'Opcional.',
            requerida: false,
            abierta: true
          },
          {
            id: 'd_preocupaciones',
            tipo: 'orden',
            etiqueta: '¿Y qué es lo que más te preocuparía?',
            ayuda: 'Arrastrá para ordenar: lo que más te preocupa arriba, lo que menos abajo.',
            requerida: true,
            opciones: [
              { valor: 'privacidad', texto: 'Perder privacidad en el día a día' },
              { valor: 'ruidos', texto: 'Ruidos o falta de tranquilidad' },
              { valor: 'acuerdos', texto: 'Tener que ponerme de acuerdo con otros para las decisiones de la casa' },
              { valor: 'visitas', texto: 'No poder recibir visitas o alojar huéspedes con total libertad' },
              { valor: 'gastos', texto: 'Depender de que el resto cumpla con los gastos compartidos' },
              { valor: 'con_quien', texto: 'No poder elegir con quién voy a convivir' }
            ]
          }
        ]
      },
      ultimo
    ];
  }

  /* =========================================================
     CIERRE — último bloque, igual en los 5 trayectos
     ========================================================= */

  var BLOQUE_CIERRE = {
    titulo: 'Para cerrar',
    bajada: 'Una pregunta más y listo.',
    preguntas: [
      escala5(
        'cierre_interes_tema',
        '¿Qué tanto te interesa el tema de la vivienda entre generaciones?',
        'Nada', 'Más o menos', 'Mucho'
      ),
      /* El ranking de proyectos urbanos vivía acá y se mudó entero a la
         encuesta de ciudad (encuesta-ciudad.js): preguntar por la ciudad
         al final de una encuesta sobre la casa mezclaba dos temas y
         alargaba un cuestionario que ya era largo. */
      {
        id: 'cierre_optin',
        tipo: 'radio',
        etiqueta: '¿Te interesaría una entrevista más profunda, o recibir novedades del proyecto?',
        ayuda: 'Si decís que sí, te vamos a pedir un contacto. Se guarda aparte, sin ninguna conexión con las respuestas que diste.',
        requerida: true,
        /* Ojo: esta respuesta NO viaja con las respuestas de la encuesta.
           Se usa solo para decidir si mostrar los campos de contacto. */
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

  var TRACKS = {
    A: { nombre: 'Adultos mayores de Cosquín y el Valle', bloques: BLOQUES_A },
    B: { nombre: 'Familias que conviven entre generaciones', bloques: BLOQUES_B },
    C: { nombre: 'Personas en Córdoba Capital con vínculo a Cosquín', bloques: BLOQUES_C },
    D1: { nombre: 'Vecinos y vecinas de 18 a 39', bloques: bloquesD(false) },
    D2: { nombre: 'Vecinos y vecinas de 40 a 59', bloques: bloquesD(true) }
  };

  /* =========================================================
     2. DERIVACIÓN A TRAYECTO

     Las 6 reglas, en orden. La primera que matchea gana.
     Devuelve 'A' | 'B' | 'C' | 'D1' | 'D2' | null (null = corte).
     ========================================================= */

  function derivarTrack(r) {
    var enZona = LOCALIDADES_ZONA.indexOf(r.localidad) !== -1;
    var es60mas = EDADES_60_MAS.indexOf(r.edad) !== -1;

    // 0 — ningún trayecto cubre a los menores de 18
    //
    // La encuesta se presenta como dirigida a mayores de edad y no pide
    // el consentimiento de un adulto responsable, así que un menor no
    // puede terminar respondiéndola por ninguna vía.
    //
    // Las reglas 1, 2, 4 y 5 ya los dejaban afuera por edad o por la
    // convivencia que se les ofrece, pero la 3 (Capital + vínculo) no
    // mira la edad: sin este corte explícito, alguien de 16 en Córdoba
    // Capital con familia en Cosquín entraba a Track C.
    if (r.edad === 'menor_18') return null;

    // 1 — adultos mayores que viven en Cosquín o el Valle
    if (es60mas && enZona) return 'A';

    // 2 — menores de 60 en la zona, conviviendo entre generaciones
    if (!es60mas && enZona && CONVIVENCIA_TRACK_B.indexOf(r.convivencia) !== -1) return 'B';

    // 3 — viven en Córdoba Capital y tienen algún vínculo con Cosquín
    if (r.localidad === 'capital' && r.vinculo && r.vinculo !== 'ninguno') return 'C';

    // 4 — resto de vecinos de la zona, 18 a 39
    if (enZona && EDADES_D1.indexOf(r.edad) !== -1) return 'D1';

    // 5 — resto de vecinos de la zona, 40 a 59
    if (enZona && EDADES_D2.indexOf(r.edad) !== -1) return 'D2';

    // 6 — corte: no hay trayecto que le corresponda, no se guarda nada
    return null;
  }

  /* ¿Corresponde la pregunta extra del Track A? */
  function correspondeExtraTrackA(r) {
    return CONVIVENCIA_INTERGENERACIONAL.indexOf(r.convivencia) !== -1;
  }

  /* Arma la lista final de bloques: los del trayecto + el cierre,
     ya filtrados según lo respondido en el gating. */
  function bloquesDeTrack(track, gating) {
    var incluirExtra = (track !== 'A') || correspondeExtraTrackA(gating);

    var bloques = TRACKS[track].bloques.map(function (bloque) {
      return {
        titulo: bloque.titulo,
        bajada: bloque.bajada,
        preguntas: bloque.preguntas.filter(function (p) {
          return incluirExtra || !p.extra;
        })
      };
    }).filter(function (bloque) {
      return bloque.preguntas.length > 0;
    });

    return bloques.concat([BLOQUE_CIERRE]);
  }

  /* =========================================================
     3. ARRANQUE

     Todo lo de arriba es contenido. Acá se le entrega al motor,
     que es quien dibuja, valida, navega y envía.
     ========================================================= */

  /* El recorrido de esta encuesta ES el trayecto derivado. Devolver
     null es el corte de la regla 6: no hay trayecto que le corresponda
     a quien responde y no se guarda nada. */
  function resolver(gating) {
    var track = derivarTrack(gating);
    if (!track) return null;
    return { clave: track, bloques: bloquesDeTrack(track, gating) };
  }

  /* El payload de vivienda: el trayecto va en `track`, que es lo que
     Code.gs usa para elegir la hoja. `respuestas` ya llega sin los
     campos de contacto ni los soloLocal —los sacó el motor—. */
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
        track: ctx.clave,
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
    /* El trayecto más corto (B) tiene 3 bloques: estimando por lo bajo,
       la barra de progreso nunca retrocede al conocerse el trayecto. */
    bloquesEstimados: 3,
    iconos: ICONOS,
    resolver: resolver,
    armarPayload: armarPayload
  };

  if (typeof window !== 'undefined' && window.TFC_ENCUESTA) {
    document.addEventListener('DOMContentLoaded', function () {
      window.TFC_ENCUESTA.iniciar(CONFIG);
    });
  }

  /* Gancho para las pruebas (tests/, se corren con node).
     En el navegador `module` no existe y esto no hace nada. Expone solo
     el esquema y funciones puras: nada que toque el DOM ni la red. */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      GATING: GATING,
      GATING_PASOS: GATING_PASOS,
      TRACKS: TRACKS,
      BLOQUE_CIERRE: BLOQUE_CIERRE,
      CONFIG: CONFIG,
      derivarTrack: derivarTrack,
      bloquesDeTrack: bloquesDeTrack,
      opcionesConvivencia: opcionesConvivencia,
      correspondeExtraTrackA: correspondeExtraTrackA,
      resolver: resolver,
      armarPayload: armarPayload
    };
  }
})();
