/**
 * ===========================================================
 * TFC Vivienda Intergeneracional — Cosquín
 * Backend de la encuesta: Google Apps Script + Google Sheets
 *
 * Copia local del script. El deploy se hace a mano en
 * script.google.com (ver instrucciones al final del archivo).
 *
 * Dos endpoints:
 *   doPost(e) → guarda una respuesta (o un contacto) en la Sheet.
 *   doGet(e)  → devuelve agregados YA PROCESADOS, nunca filas crudas.
 *
 * REGLA DE PRIVACIDAD (se aplica acá, en el servidor, a propósito):
 *   - Una pregunta con menos de MINIMO_PUBLICACION respuestas no
 *     aparece en el JSON de salida. No se manda "oculta": no está.
 *   - Nunca sale texto libre.
 *   - Nunca sale desglose por localidad ni barrio.
 *   - Nunca sale nada de la hoja de contactos.
 *
 * El script es autocontenido: crea las hojas que falten y sincroniza
 * los encabezados solo. No hace falta preparar nada a mano en la
 * planilla antes de deployar.
 * ===========================================================
 */

/** Umbral mínimo de respuestas para publicar una pregunta. */
var MINIMO_PUBLICACION = 5;

/** ID de la spreadsheet. Dejar vacío si el script está vinculado a la planilla. */
var SPREADSHEET_ID = '';

var HOJAS = {
  A: 'track_a',
  B: 'track_b',
  C: 'track_c',
  D1: 'track_d1',
  D2: 'track_d2'
};

var HOJA_CONTACTOS = 'contactos_interes';

/* ===========================================================
   ESQUEMA
   Define, por trayecto:
     - columnas: el orden de las columnas en la Sheet (incluye abiertas).
     - publicas: las preguntas que SÍ pueden agregarse y publicarse.

   Las preguntas abiertas y las de localidad no están en "publicas":
   por eso nunca pueden salir por doGet, aunque se guarden en la Sheet.
   =========================================================== */

/** Campos del gating que se guardan en todas las hojas de trayecto. */
var COLUMNAS_GATING = [
  'localidad',
  'localidad_valle_cual',
  'edad',
  'convivencia',
  'vinculo'
];

/** Campos del cierre que se guardan en todas las hojas de trayecto. */
var COLUMNAS_CIERRE = [
  'cierre_interes_tema',
  'cierre_urbano_nose',
  'cierre_urbano_ranking',
  'cierre_urbano_otra'
];

/** Espacios de la lista de 12: los mismos ids en A, D1 y D2. */
var COLUMNAS_ESPACIOS_A = ['a_compartir', 'a_no_compartir'];
var COLUMNAS_ESPACIOS_D = ['d_compartir', 'd_no_compartir'];

var COLUMNAS_TRACK_D = [
  'd_hace_cuanto_zona',
  'd_impacto_turismo',
  'd_mayores_solos',
  'd_beneficios',
  'd_beneficios_otro',
  'd_preocupaciones'
].concat(COLUMNAS_ESPACIOS_D).concat([
  'd_viviria',
  'd_recomendaria'
]);

var COLUMNAS_TRACK = {
  A: [
    'a_anios_casa',
    'a_tenencia',
    'a_accesibilidad',
    'a_orientacion',
    'a_orientacion_otro',
    'a_soledad',
    'a_ayuda_cerca',
    'a_servicios',
    'a_extra_calidad_convivencia',
    'a_preferencia_convivencia',
    'a_espacio_propio',
    'a_interes_modelo',
    'a_preocupaciones',
    'a_actividades_ninguna',
    'a_actividades'
  ].concat(COLUMNAS_ESPACIOS_A),
  B: [
    'b_generaciones',
    'b_hace_cuanto',
    'b_motivo',
    'b_calidad_convivencia',
    'b_dificultades',
    'b_rediseno'
  ],
  C: [
    'c_motivo_partida',
    'c_hace_cuanto_capital',
    'c_familiares_mayores',
    'c_acompanamiento',
    'c_volveria',
    'c_condiciones_volver',
    'c_interes_modelo'
  ],
  D1: COLUMNAS_TRACK_D,
  D2: COLUMNAS_TRACK_D.concat(['d2_familiar_mayor'])
};

/** Etiquetas legibles de las opciones, para que el dashboard no tenga que saberlas. */
var ETIQUETAS = {
  edad: {
    menor_18: 'Menos de 18', '18_29': '18 a 29', '30_39': '30 a 39',
    '40_49': '40 a 49', '50_59': '50 a 59', '60_74': '60 a 74', '75_mas': '75 o más'
  },
  convivencia: {
    solo: 'Solo/a', pareja: 'En pareja', hijos_menores: 'Con hijos menores',
    hijos_adultos: 'Con hijos adultos', padres_abuelos: 'Con padres o abuelos',
    padres_tutores: 'Con padres o tutores',
    hermanos_otros: 'Con hermanos u otros', asistencia: 'Con persona de asistencia',
    residencia: 'En residencia', otro: 'Otra situación'
  },
  vinculo: {
    naci_me_fui: 'Nació ahí y se fue', familia_directa: 'Tiene familia directa',
    vacaciones: 'Fue de vacaciones', ninguno: 'Sin vínculo particular'
  },
  escala5: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' },

  /* El orden de declaración es el orden en que salen las barras. */
  espacios: {
    cocina_comedor: 'Cocina o comedor',
    living_patio: 'Living, patio o galería',
    lavadero: 'Lavadero',
    deposito: 'Guardado o depósito',
    huespedes: 'Cuarto de huéspedes',
    huerta: 'Huerta o jardín',
    taller: 'Taller o herramientas',
    auto: 'Auto o transporte',
    wifi: 'Wifi o servicios',
    comercio: 'Café, almacén o feria cerca',
    plaza: 'Plaza o espacio verde cerca',
    cuidado: 'Atención o cuidado cerca'
  },
  cierre_urbano_ranking: {
    movilidad_terminal: 'Movilidad en terminal y estación',
    pozo_patos: 'Paisaje en el Pozo de los Patos',
    balneario_la_toma: 'Paisaje en el Balneario La Toma',
    azud_nivelador: 'Balneario Azud Nivelador',
    ingreso_geronico: 'Ingreso por calle Gerónico'
  },
  cierre_urbano_nose: {
    no_conozco: 'No conoce lo suficiente para opinar'
  },

  /* --- Track A --- */
  a_anios_casa: {
    menos_5: 'Menos de 5 años', '5_14': '5 a 14 años',
    '15_29': '15 a 29 años', '30_mas': '30 años o más'
  },
  a_tenencia: {
    propietario: 'Propia', alquila: 'Alquila',
    familiar: 'De un familiar', otro: 'Otra situación'
  },
  a_orientacion: {
    colores: 'Colores o detalles distintivos',
    objetos: 'Objetos o fotos personales',
    luz: 'Buena luz natural',
    recorrido: 'Recorrido simple entre ambientes',
    sonidos: 'Sonidos u olores familiares'
  },
  a_ayuda_cerca: {
    si_siempre: 'Sí, siempre', si_a_veces: 'Sí, a veces',
    no: 'No tiene a nadie cerca', no_se: 'No sabe'
  },
  a_servicios: {
    salud_cercana: 'Salud cerca', transporte: 'Transporte',
    comercios_pie: 'Comercios a pie', compania_cuidado: 'Compañía / cuidado',
    actividades_sociales: 'Actividades sociales'
  },
  a_preferencia_convivencia: {
    solo: 'Solo/a', gente_mi_edad: 'Con gente de su edad',
    otras_generaciones: 'Con otras generaciones', no_se: 'No sabe'
  },
  a_interes_modelo: { si: 'Sí', no: 'No', no_se: 'No sé' },
  a_preocupaciones: {
    privacidad: 'Perder privacidad o espacio propio',
    ruidos: 'Ruidos molestos',
    limpieza: 'Limpieza y orden de lo compartido',
    conflictos: 'Conflictos por los espacios comunes',
    gastos: 'Gastos compartidos',
    carga: 'Ser una carga, o que otros lo sean',
    independencia: 'Perder independencia'
  },
  a_actividades_ninguna: {
    ninguna: 'Prefiere no hacer actividades en conjunto'
  },
  a_actividades: {
    cocinar: 'Cocinar o comer juntos',
    huerta: 'Cuidar una huerta o plantas',
    manualidades: 'Manualidades u oficios',
    juegos: 'Juegos de mesa o cartas',
    musica: 'Música',
    historias: 'Compartir historias o recuerdos',
    cuidar: 'Cuidar niños o mascotas',
    caminar: 'Caminar o actividad física'
  },

  /* --- Track B --- */
  b_generaciones: {
    ninos_adolescentes: 'Niños o adolescentes', adultos_jovenes: 'Adultos jóvenes (18-35)',
    adultos: 'Adultos (36-59)', adultos_mayores: 'Adultos mayores (60+)'
  },
  b_hace_cuanto: {
    menos_1: 'Menos de 1 año', '1_3': '1 a 3 años', '4_10': '4 a 10 años',
    mas_10: 'Más de 10 años', siempre: 'Siempre fue así'
  },
  b_motivo: {
    elegida: 'Elegida', necesidad_economica: 'Necesidad económica',
    necesidad_salud: 'Salud o cuidado', otra: 'Otro motivo'
  },
  b_dificultades: {
    falta_espacio: 'Falta de espacio', privacidad: 'Privacidad',
    tareas_cuidado: 'Tareas de cuidado', diferencias_economicas: 'Diferencias económicas',
    nada: 'Nada en particular'
  },
  b_rediseno: {
    mas_m2: 'Más metros cuadrados', espacios_privados: 'Espacios privados separados',
    accesibilidad: 'Accesibilidad', espacio_exterior: 'Espacio exterior',
    productivo_huerta: 'Espacio productivo / huerta'
  },

  /* --- Track C --- */
  c_motivo_partida: {
    estudio: 'Estudio', trabajo: 'Trabajo', vivienda: 'Vivienda accesible',
    familia: 'Motivos familiares', otro: 'Otro motivo'
  },
  c_hace_cuanto_capital: {
    menos_2: 'Menos de 2 años', '2_5': '2 a 5 años',
    '6_10': '6 a 10 años', mas_10: 'Más de 10 años'
  },
  c_familiares_mayores: { si: 'Sí', no: 'No' },
  c_acompanamiento: {
    visitas_seguido: 'Los visita seguido', otro_familiar: 'Se ocupa otro familiar',
    ayuda_contratada: 'Ayuda contratada', estan_solos: 'Están bastante solos'
  },
  c_volveria: {
    si_corto_plazo: 'Sí, corto plazo', si_futuro: 'Sí, más adelante', no: 'No'
  },
  c_condiciones_volver: {
    vivienda_accesible: 'Vivienda accesible', trabajo: 'Trabajo',
    convivir_cuidar: 'Convivir o cuidar familiar', servicios: 'Mejores servicios',
    nada: 'Nada, no volvería'
  },
  c_interes_modelo: { si: 'Sí', no: 'No', no_se: 'No sé' },

  /* --- Tracks D1 y D2 --- */
  d_hace_cuanto_zona: {
    menos_2: 'Menos de 2 años', '2_10': '2 a 10 años',
    mas_10: 'Más de 10 años', toda_la_vida: 'Toda la vida'
  },
  d_impacto_turismo: {
    si_mucho: 'Sí, mucho', si_algo: 'Sí, algo', no: 'No', no_se: 'No sabe'
  },
  d_mayores_solos: {
    si_varios: 'Sí, varios', si_alguno: 'Sí, alguno', no: 'No', no_se: 'No sabe'
  },
  d_beneficios: {
    compania: 'Compañía y menos soledad',
    ayuda_mutua: 'Ayuda mutua en lo cotidiano',
    ahorro: 'Ahorro compartiendo gastos',
    red_cuidado: 'Red de cuidado para los chicos',
    oficios: 'Transmitir oficios entre generaciones',
    comunidad: 'Sensación de comunidad'
  },
  d_preocupaciones: {
    privacidad: 'Perder privacidad',
    ruidos: 'Ruidos o falta de tranquilidad',
    acuerdos: 'Acordar decisiones con otros',
    visitas: 'No poder recibir visitas con libertad',
    gastos: 'Que el resto no cumpla con los gastos',
    con_quien: 'No poder elegir con quién convivir'
  },
  d_viviria: { si: 'Sí, lo elegiría', tal_vez: 'Tal vez, depende', no: 'No' },
  d_recomendaria: { si: 'Sí', tal_vez: 'Tal vez', no: 'No' },
  d2_familiar_mayor: { si: 'Sí', no: 'No', no_aplica: 'No aplica' }
};

/**
 * Preguntas publicables por trayecto.
 * Todo lo que no esté acá NO puede salir nunca por doGet.
 *   tipo: 'simple' (una opción) | 'multiple' (varias) | 'ranking' (se cuenta el 1º puesto)
 *   grafico: sugerencia para el dashboard ('torta' | 'barra' | 'escala')
 */
var PUBLICAS_CIERRE = [
  { id: 'cierre_interes_tema', etiqueta: 'Interés en el tema (1 nada – 5 mucho)', tipo: 'simple', grafico: 'escala', etiquetas: 'escala5' },
  { id: 'cierre_urbano_nose', etiqueta: 'No conoce los lugares lo suficiente como para opinar', tipo: 'multiple', grafico: 'barra', etiquetas: 'cierre_urbano_nose' },
  { id: 'cierre_urbano_ranking', etiqueta: 'Intervención urbana más urgente', tipo: 'ranking', grafico: 'barra', etiquetas: 'cierre_urbano_ranking' }
];

/** Bloque publicable de los espacios: idéntico en A, D1 y D2 salvo el prefijo. */
function publicasEspacios(prefijo) {
  return [
    { id: prefijo + '_compartir', etiqueta: 'Qué estaría dispuesto/a a compartir', tipo: 'multiple', grafico: 'barra', etiquetas: 'espacios' },
    { id: prefijo + '_no_compartir', etiqueta: 'Qué preferiría NO compartir', tipo: 'multiple', grafico: 'barra', etiquetas: 'espacios' }
  ];
}

var PUBLICAS_D = [
  { id: 'edad', etiqueta: 'Edad', tipo: 'simple', grafico: 'barra', etiquetas: 'edad' },
  { id: 'convivencia', etiqueta: 'Con quién vive', tipo: 'simple', grafico: 'barra', etiquetas: 'convivencia' },
  { id: 'd_hace_cuanto_zona', etiqueta: 'Hace cuánto vive en la zona', tipo: 'simple', grafico: 'barra', etiquetas: 'd_hace_cuanto_zona' },
  { id: 'd_impacto_turismo', etiqueta: 'Impacto del turismo en alquileres y precios', tipo: 'simple', grafico: 'barra', etiquetas: 'd_impacto_turismo' },
  { id: 'd_mayores_solos', etiqueta: 'Conoce adultos mayores que viven solos', tipo: 'simple', grafico: 'barra', etiquetas: 'd_mayores_solos' },
  { id: 'd_beneficios', etiqueta: 'Beneficios que le ve al modelo', tipo: 'multiple', grafico: 'barra', etiquetas: 'd_beneficios' },
  { id: 'd_preocupaciones', etiqueta: 'Lo que más le preocuparía del modelo', tipo: 'ranking', grafico: 'barra', etiquetas: 'd_preocupaciones' }
].concat(publicasEspacios('d')).concat([
  { id: 'd_viviria', etiqueta: '¿Viviría en un modelo así?', tipo: 'simple', grafico: 'torta', etiquetas: 'd_viviria' },
  { id: 'd_recomendaria', etiqueta: '¿Se lo recomendaría a un familiar?', tipo: 'simple', grafico: 'torta', etiquetas: 'd_recomendaria' }
]);

var PREGUNTAS_PUBLICAS = {
  A: [
    { id: 'edad', etiqueta: 'Edad', tipo: 'simple', grafico: 'barra', etiquetas: 'edad' },
    { id: 'convivencia', etiqueta: 'Con quién vive', tipo: 'simple', grafico: 'barra', etiquetas: 'convivencia' },
    { id: 'a_anios_casa', etiqueta: 'Años en la casa actual', tipo: 'simple', grafico: 'barra', etiquetas: 'a_anios_casa' },
    { id: 'a_tenencia', etiqueta: 'Propia o alquilada', tipo: 'simple', grafico: 'torta', etiquetas: 'a_tenencia' },
    { id: 'a_accesibilidad', etiqueta: 'Dificultad para moverse en la casa (1 muy fácil – 5 muy difícil)', tipo: 'simple', grafico: 'escala', etiquetas: 'escala5' },
    { id: 'a_orientacion', etiqueta: 'Qué la ayuda a sentirse ubicada en su casa', tipo: 'multiple', grafico: 'barra', etiquetas: 'a_orientacion' },
    { id: 'a_soledad', etiqueta: 'Frecuencia con que se siente solo/a (1 nunca – 5 muy seguido)', tipo: 'simple', grafico: 'escala', etiquetas: 'escala5' },
    { id: 'a_ayuda_cerca', etiqueta: '¿Tiene ayuda cerca si la necesita?', tipo: 'simple', grafico: 'torta', etiquetas: 'a_ayuda_cerca' },
    { id: 'a_servicios', etiqueta: 'Servicios indispensables para vivir de forma autónoma', tipo: 'multiple', grafico: 'barra', etiquetas: 'a_servicios' },
    { id: 'a_extra_calidad_convivencia', etiqueta: 'Calidad de la convivencia familiar actual (1 muy mala – 5 muy buena)', tipo: 'simple', grafico: 'escala', etiquetas: 'escala5' },
    { id: 'a_preferencia_convivencia', etiqueta: 'Cómo preferiría vivir', tipo: 'simple', grafico: 'torta', etiquetas: 'a_preferencia_convivencia' },
    { id: 'a_espacio_propio', etiqueta: 'Importancia del espacio propio (1 nada – 5 mucho)', tipo: 'simple', grafico: 'escala', etiquetas: 'escala5' },
    { id: 'a_interes_modelo', etiqueta: 'Interés en unidad privada + espacios comunes', tipo: 'simple', grafico: 'torta', etiquetas: 'a_interes_modelo' },
    { id: 'a_preocupaciones', etiqueta: 'Lo que más le preocuparía del modelo', tipo: 'ranking', grafico: 'barra', etiquetas: 'a_preocupaciones' },
    { id: 'a_actividades_ninguna', etiqueta: 'Prefiere no hacer actividades en conjunto', tipo: 'multiple', grafico: 'barra', etiquetas: 'a_actividades_ninguna' },
    { id: 'a_actividades', etiqueta: 'Actividad en conjunto que más le gustaría', tipo: 'ranking', grafico: 'barra', etiquetas: 'a_actividades' }
  ].concat(publicasEspacios('a')).concat(PUBLICAS_CIERRE),

  B: [
    { id: 'edad', etiqueta: 'Edad', tipo: 'simple', grafico: 'barra', etiquetas: 'edad' },
    { id: 'b_generaciones', etiqueta: 'Generaciones que conviven', tipo: 'multiple', grafico: 'barra', etiquetas: 'b_generaciones' },
    { id: 'b_hace_cuanto', etiqueta: 'Hace cuánto conviven así', tipo: 'simple', grafico: 'barra', etiquetas: 'b_hace_cuanto' },
    { id: 'b_motivo', etiqueta: 'Convivencia elegida o por necesidad', tipo: 'simple', grafico: 'torta', etiquetas: 'b_motivo' },
    { id: 'b_calidad_convivencia', etiqueta: 'Calidad de la convivencia (1 muy mala – 5 muy buena)', tipo: 'simple', grafico: 'escala', etiquetas: 'escala5' },
    { id: 'b_dificultades', etiqueta: 'Lo más difícil de la convivencia', tipo: 'multiple', grafico: 'barra', etiquetas: 'b_dificultades' },
    { id: 'b_rediseno', etiqueta: 'Qué cambiarían primero', tipo: 'ranking', grafico: 'barra', etiquetas: 'b_rediseno' }
  ].concat(PUBLICAS_CIERRE),

  C: [
    { id: 'edad', etiqueta: 'Edad', tipo: 'simple', grafico: 'barra', etiquetas: 'edad' },
    { id: 'vinculo', etiqueta: 'Vínculo con Cosquín', tipo: 'simple', grafico: 'barra', etiquetas: 'vinculo' },
    { id: 'c_motivo_partida', etiqueta: 'Por qué se fue de la zona', tipo: 'multiple', grafico: 'barra', etiquetas: 'c_motivo_partida' },
    { id: 'c_hace_cuanto_capital', etiqueta: 'Hace cuánto vive en Córdoba Capital', tipo: 'simple', grafico: 'barra', etiquetas: 'c_hace_cuanto_capital' },
    { id: 'c_familiares_mayores', etiqueta: '¿Tiene familiares mayores en la zona?', tipo: 'simple', grafico: 'torta', etiquetas: 'c_familiares_mayores' },
    { id: 'c_acompanamiento', etiqueta: 'Cómo es el acompañamiento a distancia', tipo: 'simple', grafico: 'barra', etiquetas: 'c_acompanamiento' },
    { id: 'c_volveria', etiqueta: '¿Volvería a vivir en la zona?', tipo: 'simple', grafico: 'torta', etiquetas: 'c_volveria' },
    { id: 'c_condiciones_volver', etiqueta: 'Qué condiciones lo harían volver', tipo: 'multiple', grafico: 'barra', etiquetas: 'c_condiciones_volver' },
    { id: 'c_interes_modelo', etiqueta: 'Interés en vivienda intergeneracional', tipo: 'simple', grafico: 'torta', etiquetas: 'c_interes_modelo' }
  ].concat(PUBLICAS_CIERRE),

  D1: PUBLICAS_D.concat(PUBLICAS_CIERRE),

  D2: PUBLICAS_D.concat([
    { id: 'd2_familiar_mayor', etiqueta: '¿Tiene un familiar mayor al que le gustaría tener cerca?', tipo: 'simple', grafico: 'torta', etiquetas: 'd2_familiar_mayor' }
  ]).concat(PUBLICAS_CIERRE)
};

var NOMBRES_TRACK = {
  A: 'Adultos mayores de Cosquín y el Valle',
  B: 'Familias que conviven entre generaciones',
  C: 'Personas en Córdoba Capital con vínculo a Cosquín',
  D1: 'Vecinos y vecinas de 18 a 39',
  D2: 'Vecinos y vecinas de 40 a 59'
};

/* ===========================================================
   ENDPOINTS
   =========================================================== */

/**
 * Guarda una respuesta de encuesta o un contacto.
 * Espera el body como JSON (se manda con Content-Type text/plain
 * desde el sitio para evitar el preflight CORS).
 */
function doPost(e) {
  var lock = LockService.getScriptLock();

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'sin_datos' });
    }

    var payload = JSON.parse(e.postData.contents);

    lock.waitLock(20000);

    if (payload.tipo === 'contacto') {
      guardarContacto(payload.contacto);
      return jsonResponse({ ok: true });
    }

    var track = payload.track;
    if (!track || !HOJAS[track]) {
      return jsonResponse({ ok: false, error: 'track_invalido' });
    }

    guardarRespuesta(track, payload.modalidad, payload.respuestas || {});
    return jsonResponse({ ok: true });

  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  } finally {
    try { lock.releaseLock(); } catch (ignorado) {}
  }
}

/**
 * Devuelve los agregados públicos.
 * Nunca devuelve filas crudas, texto libre, localidad ni contactos.
 */
function doGet(e) {
  try {
    var salida = {
      actualizado: new Date().toISOString(),
      minimo_publicacion: MINIMO_PUBLICACION,
      tracks: {}
    };

    Object.keys(HOJAS).forEach(function (track) {
      salida.tracks[track] = agregarTrack(track);
    });

    return jsonResponse(salida);
  } catch (error) {
    return jsonResponse({ error: 'No se pudieron calcular los resultados.' });
  }
}

/* ===========================================================
   ESCRITURA
   =========================================================== */

function getSpreadsheet() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function columnasDeTrack(track) {
  return ['timestamp', 'modalidad']
    .concat(COLUMNAS_GATING)
    .concat(COLUMNAS_TRACK[track])
    .concat(COLUMNAS_CIERRE);
}

/** Devuelve la hoja, creándola y poniéndole los encabezados si hace falta. */
function getHoja(nombre, encabezados) {
  var ss = getSpreadsheet();
  var hoja = ss.getSheetByName(nombre);

  if (!hoja) {
    hoja = ss.insertSheet(nombre);
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
    hoja.setFrozenRows(1);
    return hoja;
  }

  sincronizarEncabezados(hoja, encabezados);
  return hoja;
}

/**
 * Deja la fila 1 con los encabezados que espera el esquema.
 *
 * Con la hoja todavía sin respuestas, los reescribe enteros.
 * Con respuestas cargadas, solo AGREGA al final las columnas que falten:
 * insertarlas en el medio correría todo lo guardado un lugar y las filas
 * viejas quedarían leídas contra el encabezado equivocado.
 */
function sincronizarEncabezados(hoja, encabezados) {
  var ultimaCol = hoja.getLastColumn();
  var actuales = ultimaCol > 0
    ? hoja.getRange(1, 1, 1, ultimaCol).getValues()[0].map(String)
    : [];

  if (hoja.getLastRow() < 2) {
    if (actuales.join(' ') === encabezados.join(' ')) return;
    if (ultimaCol > encabezados.length) {
      hoja.getRange(1, encabezados.length + 1, 1, ultimaCol - encabezados.length).clearContent();
    }
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
    hoja.setFrozenRows(1);
    return;
  }

  var faltantes = encabezados.filter(function (col) {
    return actuales.indexOf(col) === -1;
  });
  if (!faltantes.length) return;

  hoja.getRange(1, ultimaCol + 1, 1, faltantes.length).setValues([faltantes]);
}

function guardarRespuesta(track, modalidad, respuestas) {
  var hoja = getHoja(HOJAS[track], columnasDeTrack(track));

  /* La fila se arma contra el encabezado REAL de la hoja, no contra el
     esquema. Así, si alguna vez quedan desalineados, cada dato igual
     cae en su columna en vez de correrse en bloque. */
  var encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(String);

  var fila = encabezados.map(function (col) {
    if (col === 'timestamp') return new Date();
    if (col === 'modalidad') return modalidad === 'asistida' ? 'asistida' : 'online';

    var valor = respuestas[col];
    if (valor === undefined || valor === null) return '';
    /* Multi-select y orden llegan como array: se guardan separados por " | ".
       En las preguntas de orden, el orden del array ES el orden elegido. */
    if (Object.prototype.toString.call(valor) === '[object Array]') return valor.join(' | ');
    return String(valor);
  });

  hoja.appendRow(fila);
}

/**
 * Guarda el contacto en su propia hoja, sin ningún dato de la encuesta.
 *
 * La fecha se guarda SIN hora a propósito: con hora exacta, sería posible
 * cruzar esta fila con la respuesta enviada en el mismo segundo y romper
 * el anonimato. Con fecha sola, esa correlación no se puede hacer.
 */
function guardarContacto(contacto) {
  if (!contacto || (!contacto.nombre && !contacto.medio)) return;

  var hoja = getHoja(HOJA_CONTACTOS, ['fecha', 'nombre', 'contacto']);
  var hoy = new Date();
  var fechaSinHora = Utilities.formatDate(hoy, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  hoja.appendRow([
    fechaSinHora,
    String(contacto.nombre || '').substring(0, 120),
    String(contacto.medio || '').substring(0, 120)
  ]);
}

/* ===========================================================
   AGREGACIÓN (la parte que protege el anonimato)
   =========================================================== */

function agregarTrack(track) {
  var ss = getSpreadsheet();
  var hoja = ss.getSheetByName(HOJAS[track]);

  var resultado = {
    nombre: NOMBRES_TRACK[track],
    n: 0,
    preguntas: {}
  };

  if (!hoja || hoja.getLastRow() < 2) return resultado;

  var datos = hoja.getDataRange().getValues();
  var encabezados = datos[0];
  var filas = datos.slice(1);

  resultado.n = filas.length;

  var indice = {};
  encabezados.forEach(function (nombre, i) { indice[nombre] = i; });

  PREGUNTAS_PUBLICAS[track].forEach(function (pregunta) {
    var col = indice[pregunta.id];
    if (col === undefined) return;

    var conteo = {};
    var respondieron = 0;

    filas.forEach(function (fila) {
      var bruto = fila[col];
      if (bruto === '' || bruto === null || bruto === undefined) return;

      var texto = String(bruto).trim();
      if (!texto) return;

      respondieron++;

      if (pregunta.tipo === 'multiple') {
        texto.split('|').forEach(function (parte) {
          var v = parte.trim();
          if (v) conteo[v] = (conteo[v] || 0) + 1;
        });
      } else if (pregunta.tipo === 'ranking') {
        /* Del orden se publica solo qué quedó en primer lugar.
           El promedio de posiciones comprime todo al centro y sugiere
           una precisión que con estos tamaños de muestra no existe. */
        var primero = texto.split('|')[0].trim();
        if (primero) conteo[primero] = (conteo[primero] || 0) + 1;
      } else {
        conteo[texto] = (conteo[texto] || 0) + 1;
      }
    });

    /* REGLA DE PRIVACIDAD: por debajo del umbral, la clave no existe. */
    if (respondieron < MINIMO_PUBLICACION) return;

    var etiquetas = ETIQUETAS[pregunta.etiquetas] || {};

    /* Se ordena por el orden en que están declaradas las opciones en ETIQUETAS,
       no por cantidad. Así las escalas salen 1,2,3,4,5 y los rangos en orden
       lógico; además las barras no cambian de lugar cuando entran respuestas
       nuevas. Un valor no declarado va al final. */
    var orden = Object.keys(etiquetas);
    var opciones = Object.keys(conteo).map(function (valor) {
      return {
        valor: valor,
        etiqueta: etiquetas[valor] || valor,
        cantidad: conteo[valor]
      };
    }).sort(function (a, b) {
      var ia = orden.indexOf(a.valor);
      var ib = orden.indexOf(b.valor);
      if (ia === -1 && ib === -1) return b.cantidad - a.cantidad;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    resultado.preguntas[pregunta.id] = {
      etiqueta: pregunta.etiqueta,
      tipo: pregunta.tipo,
      grafico: pregunta.grafico,
      n: respondieron,
      opciones: opciones
    };
  });

  return resultado;
}

/* ===========================================================
   UTILIDADES
   =========================================================== */

function jsonResponse(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Crea (o pone al día) todas las hojas con sus encabezados.
 *
 * No es obligatorio ejecutarlo: doPost crea la hoja que necesite en el
 * momento. Sirve para dejar la planilla armada antes de la primera
 * respuesta, y para revisar los encabezados después de tocar el esquema.
 */
function configurarHojas() {
  Object.keys(HOJAS).forEach(function (track) {
    getHoja(HOJAS[track], columnasDeTrack(track));
  });
  getHoja(HOJA_CONTACTOS, ['fecha', 'nombre', 'contacto']);
}

/**
 * ===========================================================
 * CÓMO DEPLOYAR (a mano, una sola vez)
 * ===========================================================
 * 1. Crear una Google Sheet nueva para la encuesta.
 * 2. Extensiones > Apps Script. Pegar este archivo completo.
 * 3. (Opcional) Ejecutar configurarHojas() una vez, para dejar creadas
 *    las 5 hojas de trayecto + contactos_interes con sus encabezados.
 * 4. Implementar > Nueva implementación > Aplicación web:
 *      - Ejecutar como: yo
 *      - Quién tiene acceso: cualquier usuario
 * 5. Copiar la URL /exec y pegarla en assets/js/config.js del sitio.
 *
 * Cada vez que se edite este script hay que crear una NUEVA versión
 * de la implementación para que los cambios salgan a producción.
 * ===========================================================
 */
