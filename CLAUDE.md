# Sitio de la tesis + encuestas

Subproyecto dentro de `TFC-VivIntergeneracional`. Ver `../../CLAUDE.md` para el contexto general del TFC (cátedra, tema-problema, ubicación).

## Objetivo
Sitio web simple que:
1. Divulga el TFC (vivienda intergeneracional, Cosquín) para público general y potenciales entrevistados/encuestados.
2. Aloja encuestas como instrumento de relevamiento social (Etapa 1 - Relevamiento social / in-situ del TFC), dirigidas a adultos mayores, familias y vecinos de Cosquín.

## Stack
- Sitio estático: HTML/CSS/JS vanilla, **sin frameworks ni build step**.
- Backend: **Google Apps Script** como Web App escribiendo a una Google Sheet. Sin servidor propio, sin base de datos.
- Gráficos: Chart.js por CDN.
- Hosting previsto: GitHub Pages o Netlify (todavía sin configurar).
- Mobile-first y accesible: parte de la encuesta se completa de forma asistida con adultos mayores en el celular (tipografía grande, alto contraste, targets de 56px).
- Todo el copy en español (Argentina).

## Archivos
```
index.html                  divulgación / landing
el-proyecto.html            sobre la tesis (a completar a mano)
encuesta-vivienda.html      cascarón de la encuesta (los pasos)
resultados-vivienda.html    dashboard público
gracias.html                confirmación post-envío
assets/css/style.css
assets/js/config.js         ← ÚNICO lugar donde va la URL del Apps Script
assets/js/main.js           nav + año del footer
assets/js/divulgacion.js    hero, parallax y reveals (GSAP) de las páginas oscuras
assets/js/galeria.js        grilla del imaginario + lightbox (solo el-proyecto)
assets/js/portada-encuesta.js  contador en vivo + preview de gráfico (solo index)
assets/js/encuesta-vivienda.js   esquema de preguntas + árbol + envío
assets/js/dashboard.js      fetch de agregados + gráficos
assets/img/imaginarios/     13 imágenes del imaginario (1600×900)
assets/img/imaginarios/thumb/  las mismas a 800×450 para la grilla
tests/derivacion.js         pruebas del esquema (node tests/derivacion.js)
apps-script/Code.gs         backend (fuente de verdad; se sube con clasp push)
apps-script/appsscript.json  manifest: fija los permisos del Web App y la zona horaria
.clasp.json                 ata esta carpeta al proyecto de Apps Script (scriptId + rootDir)
```

## Backend: deploy con clasp

El backend se sube y deploya con `clasp` (CLI oficial de Apps Script, v3). Ya está
creado, deployado y enganchado al sitio: **`config.js` no se toca más**.

Flujo para cualquier cambio futuro a `apps-script/Code.gs`:
```
clasp push
clasp deploy -i AKfycbz4ADkzPwXcUroimeqC4FcT1PItIcSXwfyJT4DM9L2uSf2Edle66fHEdkhM0R9epNtJ
```
El `-i` reusa el deployment existente, así la URL `/exec` **nunca cambia**. Sin `-i`
se crea un deployment nuevo con otra URL y habría que volver a editar `config.js`
(exactamente lo que este esquema evita).

### IDs del proyecto
Todo vive en la **cuenta institucional de la UNC** (`@mi.unc.edu.ar`), la misma
del Drive de la cátedra. La dirección completa está en el `CLAUDE.md` del repo
padre, que no se publica: este repo es público y un mail escrito acá es carne de
scrapers.

| | |
|---|---|
| scriptId | `1ZOvy5QgBDlCsExtggRfuqrhTtGP6LJWxZMRcAYSfovLlPG02ap9bQ0IN` |
| Sheet (parentId) | `1mJCg6fOpB9Bk1-l7mBJ3DW6Ws0hOeeQfnrt0B6OfLvo` |
| deploymentId fijo (v1) | `AKfycbz4ADkzPwXcUroimeqC4FcT1PItIcSXwfyJT4DM9L2uSf2Edle66fHEdkhM0R9epNtJ` |

- Sheet: https://docs.google.com/spreadsheets/d/1mJCg6fOpB9Bk1-l7mBJ3DW6Ws0hOeeQfnrt0B6OfLvo/edit
- Editor de Apps Script: https://script.google.com/d/1ZOvy5QgBDlCsExtggRfuqrhTtGP6LJWxZMRcAYSfovLlPG02ap9bQ0IN/edit
- Web App: https://script.google.com/macros/s/AKfycbz4ADkzPwXcUroimeqC4FcT1PItIcSXwfyJT4DM9L2uSf2Edle66fHEdkhM0R9epNtJ/exec

El script es **container-bound** a esa Sheet (`getActiveSpreadsheet()`), no hay
`SPREADSHEET_ID` que configurar.

### Cosas para no volver a tropezar
- Los permisos del Web App (**ejecutar como yo / acceso: cualquier usuario**) y la zona
  horaria salen de `apps-script/appsscript.json`, no de la UI. Por eso el deploy no
  requiere tocar nada a mano. `clasp create` **pisa** ese archivo con el default: si
  alguna vez se recrea el proyecto, hay que volver a escribir el manifest antes del push.
- El primer `clasp push` sobre un proyecto recién creado necesita `-f` (fuerza pisar el
  manifest remoto).
- **Autorización (una sola vez, a mano):** el Web App corre como el dueño, así que los
  permisos de Sheets los tiene que otorgar una persona. Se hace abriendo el editor y
  ejecutando `configurarHojas()` una vez — eso autoriza los scopes *y* crea las hojas
  (`track_a`…`track_d2` + `contactos_interes`). Sin eso, `/exec` responde 403.
- clasp v3 cambió nombres: `clasp login --status` ya no existe → `clasp show-authorized-user`.
- **No usar `clasp pull`**: baja el código como `Code.js` al lado de `Code.gs` y duplica
  el archivo. El fuente de verdad es el local; el remoto es solo un destino de deploy.
- Ojo con la cuenta activa: la Apps Script API se habilita **por cuenta**
  (https://script.google.com/u/2/home/usersettings) y `clasp login` guarda una sola sesión.

Si `config.js` quedara sin URL, la encuesta y el dashboard muestran un mensaje de
"todavía no está conectado" en vez de fallar en silencio.

## Tipografías

| Rol | Familia | Token |
|---|---|---|
| Cuerpo (todo el sitio) | Source Serif 4 | `--fuente-cuerpo` |
| Títulos display | Archivo Black | `--fuente-display` |
| Acento en cursiva | Instrument Serif | `--fuente-script` |

**`--fuente-cuerpo` se declara en un solo lugar**: `:root`, en
`assets/css/style.css`. La usa `body` y de ahí hereda todo, las cinco páginas
incluida la encuesta. Para cambiar la tipografía de cuerpo del sitio se toca esa
línea y los `<link>` de Google Fonts, que son idénticos en las cinco páginas.
No hay overrides de familia por página: si aparece uno, es un bug.

Se cargan tres pesos de Source Serif 4 (400, 600 y 700) porque el sistema usa
700 en botones, consignas y `<strong>`: sin ese peso el navegador lo simula y se
ve sucio.

## Dos lenguajes visuales, una sola marca

- **Divulgación** (`index`, `el-proyecto`, `resultados`, `gracias`):
  `<body class="tema-oscuro">`, fondo carbón cálido, Archivo Black + itálica
  Instrument Serif, hero con imagen y parallax, reveals al scrollear.
  Las cuatro cargan GSAP + ScrollTrigger por CDN y `divulgacion.js`.
- **`encuesta-vivienda.html`** (`<body class="pagina-encuesta">`): **spotlight**.
  La página tiene el fondo oscuro del sitio —imagen ambiental al 10%, viñeta y un
  halo cálido— pero **no cambia de tema**: los tokens semánticos siguen siendo los
  claros, así que la tarjeta donde se lee y se responde conserva los mismos
  colores y contrastes de siempre (texto 16.9:1, título 9.35:1, borde de control
  3.78:1). Cada `.paso` ES la tarjeta: fondo hueso, sombra que la despega del
  fondo y un halo difuso, con entrada de 0.42s.

  Lo que NO cambia: targets de 56px, sin parallax, sin GSAP, y la única animación
  sigue siendo la entrada del paso —apagada por el corte de movimiento reducido—.
  Se completa de forma asistida con adultos mayores: **la tarjeta manda
  legibilidad, el fondo es solo ambiente y ahí no vive nada que haya que leer.**

  El cuerpo va un punto más grande y con más interlineado que en el resto del
  sitio (misma familia), porque acá hay consignas largas que a veces se leen a los
  80 años y desde un celular.

El hero de las páginas interiores es el mismo componente que el de portada
(`.hero-cine`) con la clase `.hero-corto`: más bajo, el título en bloque en
vez de repartido letra por letra, y un velo más cargado porque esas imágenes
son de día. La imagen de cada página se elige con una clase
(`.hero-el-proyecto`, `.hero-resultados`, `.hero-gracias`) que solo redefine
`--hero-imagen`. Como `divulgacion.js` busca `.hero-cine`, la entrada y el
parallax salen gratis.

Reveals: `data-revelar` (bloque entero), `data-revelar="grupo"` (escalona los
hijos) y `data-revelar="grupo-escala"` (igual pero sumando un acercamiento; es
el de la galería). Todo respeta `prefers-reduced-motion`, y si GSAP no carga
`divulgacion.js` saca la clase `es-animable` y el contenido queda visible.

**`[hidden]` está forzado con `!important`** en el CSS base: varias clases
propias declaran `display`, y sin eso el atributo no oculta nada (el contador
de la portada aparecía en cero mientras cargaba).

## Galería del imaginario (el-proyecto.html)

Las 13 imágenes se listan en `galeria.js` con título corto (el que se ve) y
`alt` descriptivo (el que se escucha). La grilla usa las miniaturas de
`thumb/` —1 MB en total contra 3,8 MB de las originales— y el lightbox recién
ahí carga la grande. Las miniaturas se regeneran con Pillow:

```
python -c "from PIL import Image; import glob,re,os; [Image.open(f).convert('RGB').resize((800,450), Image.LANCZOS).save('assets/img/imaginarios/thumb/imaginario-%02d.jpg' % int(re.search(r'\((\d+)\)', f).group(1)), 'JPEG', quality=76, optimize=True, progressive=True) for f in glob.glob('assets/img/imaginarios/*.jpeg')]"
```

El lightbox es propio (sin librería): Escape cierra, flechas navegan y dan la
vuelta, el foco queda atrapado en los tres botones y vuelve a la tarjeta que lo
abrió.

## Contador en vivo de la portada

`portada-encuesta.js` suma `tracks[X].n` de los cinco trayectos del mismo
`doGet` que usa el tablero (`window.TFC_DASHBOARD.pedirDatos`) y lo anima
contando hacia arriba cuando la sección entra en pantalla. Tres estados, y
ninguno es un cero pelado:

| Situación | Qué se muestra |
|---|---|
| total ≥ `minimo_publicacion` | el número, animado |
| total < mínimo | "La encuesta recién empieza…" |
| sin conexión o sin configurar | "Los resultados se van a publicar acá." |

El número se anima con `requestAnimationFrame`, así que para un lector de
pantalla sería un chorro de cifras: el dato va una sola vez por un
`role="status"` invisible. Si hay alguna pregunta publicada, debajo se dibuja
una tarjeta del tablero reusando `renderGrafico`.

`dashboard.js` tiene **dos paletas** de trayecto —la original para fondo claro
y una aclarada para el carbón— porque Chart.js dibuja en canvas y no hereda
ninguna variable CSS.

## Encuesta de vivienda: árbol de trayectos

Un solo formulario. El gating (5 preguntas, en dos pantallas) deriva a un
trayecto. **Las reglas se evalúan en orden y la primera que matchea gana**
(en `derivarTrack()`):

0. `edad = menor_18` → **corte**, siempre. Ningún trayecto cubre a un menor y
   la encuesta no pide consentimiento de un adulto responsable. Es una regla
   explícita porque las demás no alcanzaban: la 3 (Capital + vínculo) no mira la
   edad, y un chico de 16 en Córdoba Capital con familia en Cosquín entraba a
   Track C. Lo detectó `tests/derivacion.js`.
1. `edad ≥ 60` **y** localidad ∈ {Cosquín, Valle} → **Track A** (adultos mayores residentes)
2. `edad < 60` **y** localidad ∈ {Cosquín, Valle} **y** convivencia ∈ {padres/abuelos, hijos adultos} → **Track B** (familias intergeneracionales)
3. localidad = Córdoba Capital **y** vínculo ≠ ninguno → **Track C** (migrantes; captura también a 60+ en Capital, porque no cumplen la localidad de la regla 1)
4. localidad ∈ {Cosquín, Valle} **y** edad 18–39 → **Track D1** (vecinos jóvenes)
5. localidad ∈ {Cosquín, Valle} **y** edad 40–59 → **Track D2** (= D1 + una pregunta final)
6. cualquier otro caso → **corte**: pantalla de agradecimiento, **no se guarda nada**

Casos resueltos explícitamente:
- Alguien en "otra localidad" (ni Cosquín/Valle ni Capital) **con** vínculo declarado cae en el corte — Track C es sobre la migración a Córdoba Capital, no sobre vínculo genérico.
- **Menores de 18**: siempre caen en el corte, por la regla 0. El texto del corte lo dice.

### Gating: dos pantallas (`GATING_PASOS`)

| Pantalla | Preguntas |
|---|---|
| **Para empezar** | `localidad` (+ "¿cuál?" si es Valle) · `vinculo` (solo si no vive en la zona) · `edad` · `modalidad` |
| **Tu convivencia** | `convivencia`, sola |

La convivencia va aparte **porque sus opciones dependen de la edad**: recién
cuando esa respuesta existe se puede armar la lista que le corresponde a quien
responde. Es un corte de presentación: los ids, los valores y la columna
`convivencia` de la hoja no cambiaron, y `Code.gs` no se tocó.

Para que funcione, `renderPreguntas` recibe un **contexto** —lo respondido en
pantallas anteriores— que se guarda en el contenedor y se fusiona en cada
`actualizar()`. Sin eso, la convivencia no vería la edad y ofrecería la lista
genérica.

**La convivencia es dinámica**: menores de 18 no ven "con hijos adultos"; los
menores de 60 no ven "en una residencia". Si se vuelve atrás y se cambia la
edad, la lista se redibuja y lo que estaba marcado se conserva **solo si esa
opción sigue existiendo**; si no, hay que volver a responder.

El botón "Atrás" aparece en la segunda pantalla y en los bloques; desde la
primera no vuelve al consentimiento. La barra de progreso cuenta las dos
pantallas de gating más los bloques del trayecto (`porcentajeDe`).

### Bloques temáticos
Cada trayecto se recorre en bloques cortos, uno por pantalla, con indicador
"Bloque N de M" y barra de progreso. El último bloque es siempre el cierre común.

| Trayecto | Bloques |
|---|---|
| **A** (5) | Su casa hoy · Su día a día · Cómo se imagina vivir · Qué compartiría y qué no · Para cerrar |
| **B** (3) | Quiénes conviven · Cómo funciona hoy · Para cerrar |
| **C** (4) | Por qué te fuiste · Tu familia en la zona · ¿Volverías? · Para cerrar |
| **D1** (4) | Tu zona hoy · Cómo ves la idea · Vos, en un lugar así · Para cerrar |
| **D2** (4) | igual que D1, con `d2_familiar_mayor` al final del bloque 3 |

Track A tiene un bloque más porque tiene el doble de preguntas que cualquier otro.
El bloque "Su día a día" incluye `a_extra_calidad_convivencia`, que solo aparece
si la convivencia declarada es intergeneracional.

### Tipos de pregunta del motor
`radio` · `checkbox` · `escala` · `orden` · `texto` · `textarea`.

- **`orden`** (arrastre) se reordena de dos maneras equivalentes: arrastrando
  desde el agarre (Pointer Events, funciona con mouse y con el dedo; el arrastre
  HTML5 nativo no existe en móviles) o con los botones ↑ ↓, que además son el
  único camino con teclado. La lista **arranca mezclada al azar** y **hay que
  tocarla al menos una vez** para poder seguir: si arrancara en el orden escrito,
  quien no la toca dejaría ese orden como respuesta. El porqué está en
  `docs/encuesta-vivienda-fundamentacion.md`.
- **`presentacion: 'grilla'`** dibuja las opciones como tarjetas con ícono en dos
  columnas (una sola en celular). Se usa para la lista de 12 espacios.
- **`grupos`** parte una lista larga en sub-bloques con subtítulo, cada uno con
  `role="group"` + `aria-labelledby` para que el subtítulo no sea decorativo.

### Preguntas que se repiten entre trayectos
La **lista de 12 espacios** se pregunta dos veces en A y en D1/D2: qué
compartiría y qué NO. Es la misma lista a propósito — la distancia entre las dos
respuestas es el dato. En el dashboard se grafican **por trayecto separado, sin
comparativa cruzada** entre A y D1/D2 (aunque los datos sean comparables para el
análisis propio).

## Pruebas

```
node tests/derivacion.js
```

Sin dependencias. Cubre las reglas de derivación (incluido un barrido de las
1100 combinaciones posibles del gating), que partir el gating en dos pantallas
no haya perdido ni duplicado preguntas, el filtrado de convivencias por edad y
la cantidad de bloques de cada trayecto. `encuesta-vivienda.js` exporta lo
necesario con un `typeof module !== 'undefined'` al final del IIFE, que en el
navegador no hace nada.

Correrlo después de tocar el esquema o las reglas.

## Reglas de privacidad (no negociables)
- Las preguntas abiertas son **siempre opcionales** y **nunca** salen por el endpoint público. Solo viven en la Sheet.
- La agregación se hace **en el servidor** (`doGet` en `Code.gs`), nunca en el cliente: si el frontend recibiera filas crudas, cualquiera las vería en la pestaña de Red.
- Una pregunta con **menos de 5 respuestas** no se incluye en el JSON de salida: la clave directamente no existe (no se manda "oculta").
- El JSON público nunca incluye desglose por localidad/barrio, ni texto libre, ni nada de `contactos_interes`.
- Los contactos van en **dos POST separados**, sin ningún ID en común con la respuesta. Además la hoja de contactos guarda **fecha sin hora**, para que no se pueda cruzar por timestamp con la fila de la encuesta.
- Lo que sí es publicable está declarado en `PREGUNTAS_PUBLICAS` en `Code.gs`. **Lo que no esté ahí no puede salir nunca**: para publicar una pregunta nueva hay que agregarla explícitamente.

## Para agregar otra encuesta más adelante
(espacio público/seguridad, alquiler/festival — todavía no construidas)

El motor de `encuesta-vivienda.js` está separado del contenido: las preguntas son datos (`GATING`, `BLOQUES_A`…, `BLOQUE_CIERRE`) y el render, la validación, la navegación por bloques y el envío son genéricos. Para una encuesta nueva: copiar el archivo, reemplazar el esquema, y sumar en `Code.gs` las hojas + su bloque en `PREGUNTAS_PUBLICAS`.

`Code.gs` es autocontenido: crea las hojas que falten y sincroniza los encabezados solo. Con la hoja vacía los reescribe enteros; con respuestas cargadas solo **agrega al final** las columnas nuevas, nunca inserta en el medio. Además cada fila se arma contra el encabezado real de la hoja, no contra el esquema, así un desfasaje no corre todos los datos un lugar.

## Pendientes
- **Todavía no hay datos de producción**: el esquema se puede seguir cambiando sin cuidado por compatibilidad.
- **Zona horaria de la Sheet**: el manifest fija la del *script*, pero la *planilla* quedó con el default de Google (US Pacific), así que los timestamps se ven 4 h atrasados. Se arregla a mano una vez en Archivo > Configuración > Zona horaria → (GMT-03:00) Buenos Aires. El instante guardado es correcto; lo que está mal es cómo se muestra e interpreta.
- Configurar hosting.
- Favicon (hoy da 404).
- Completar el contenido de `el-proyecto.html` (la estructura y la galería ya
  están; falta el material propio de la tesis a medida que avance).
- Definir si las respuestas se exportan a la carpeta de Drive del TFC (`01_Etapa 1/04_Relevamiento social`).
- Sistema de incentivo/beneficio para quienes dejan contacto: **sin definir**, el flujo de `contactos_interes` quedó listo y desacoplado pero sin lógica de sorteo.
