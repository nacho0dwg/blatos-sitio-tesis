# Sitio de la tesis + encuestas

Subproyecto dentro de `TFC-VivIntergeneracional`. Ver `../../CLAUDE.md` para el contexto general del TFC (cátedra, tema-problema, ubicación).

## Objetivo
Sitio web simple que:
1. Divulga el TFC (vivienda intergeneracional, Cosquín) para público general y potenciales entrevistados/encuestados.
2. Aloja encuestas como instrumento de relevamiento social (Etapa 1 - Relevamiento social / in-situ del TFC), dirigidas a adultos mayores, familias y vecinos de Cosquín.

Hoy hay **dos encuestas**, independientes entre sí:

| | Página | Forma | Tema |
|---|---|---|---|
| **Vivienda** | `encuesta-vivienda.html` | árbol de 5 trayectos | la casa, la convivencia entre generaciones |
| **Ciudad** | `encuesta-ciudad.html` | plana, un solo recorrido | el espacio público, el río, las 7 propuestas |

`encuesta.html` es el selector: dos tarjetas, una por encuesta. Es a donde
apunta el link "Encuesta" del nav en todo el sitio. **Cada encuesta conserva su
URL propia y se abre directo sin pasar por el selector**, que es lo que hace
falta para difundir una sola por WhatsApp con adultos mayores.

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
encuesta.html               selector: dos tarjetas, una por encuesta
encuesta-vivienda.html      cascarón de la encuesta de vivienda (los pasos)
encuesta-ciudad.html        cascarón de la encuesta de ciudad (mismos ids)
resultados-vivienda.html    dashboard público (las dos encuestas)
gracias.html                confirmación post-envío (compartida)
assets/css/style.css
assets/js/config.js         ← ÚNICO lugar donde va la URL del Apps Script
assets/js/main.js           nav + año del footer
assets/js/divulgacion.js    hero, parallax y reveals (GSAP) de las páginas oscuras
assets/js/galeria.js        grilla del imaginario + lightbox (solo el-proyecto)
assets/js/portada-encuesta.js  contador en vivo + preview de gráfico (solo index)
assets/js/encuesta-motor.js      MOTOR compartido: render, validación, flujo, envío
assets/js/encuesta-vivienda.js   esquema de vivienda + las 6 reglas de derivación
assets/js/encuesta-ciudad.js     esquema de ciudad (plano)
assets/js/dashboard.js      fetch de agregados + gráficos
assets/img/imaginarios/     13 imágenes del imaginario (1600×900)
assets/img/imaginarios/thumb/  las mismas a 800×450 para la grilla
tests/todos.js              corre las cuatro suites (node tests/todos.js)
tests/_ayuda.js             ok/igual/titulo compartidos
tests/derivacion.js         esquema y derivación de vivienda
tests/ciudad.js             esquema de ciudad, escape del ranking, privacidad
tests/backend.js            Code.gs evaluado en un sandbox: columnas y publicables
tests/contraste.js          WCAG y jerarquía de las tarjetas del ranking
tools/dump-esquema.js       vuelca el esquema de LAS DOS encuestas a JSON
tools/_lienzo.py            paleta y primitivas compartidas por los dos diagramas
tools/arbol-encuesta.py     dibuja docs/arbol-encuesta.png desde ese JSON
tools/arbol-ciudad.py       dibuja docs/arbol-ciudad.png desde ese JSON
docs/arbol-encuesta.png     el árbol de vivienda entero, para mirar de un vistazo
docs/arbol-ciudad.png       el recorrido de ciudad entero, ídem
apps-script/Code.gs         backend (fuente de verdad; se sube con clasp push)
apps-script/appsscript.json  manifest: fija los permisos del Web App y la zona horaria
.clasp.json                 ata esta carpeta al proyecto de Apps Script (scriptId + rootDir)
```

**Orden de los `<script>` en las páginas de encuesta**: `config.js`, `main.js`,
`encuesta-motor.js` y recién después el archivo de la encuesta. El motor deja
`window.TFC_ENCUESTA`; el esquema lo llama en `DOMContentLoaded`. Al revés no
arranca (y falla en silencio: el `if (window.TFC_ENCUESTA)` simplemente no
entra).

## Hosting: GitHub + Railway

El sitio está publicado en **https://blatos-sitio-production.up.railway.app**

| | |
|---|---|
| Repo | https://github.com/nacho0dwg/blatos-sitio-tesis (público, rama `main`) |
| Proyecto Railway | `BLATOS-sitio-tesis` · `124595b8-e56e-4d8e-a394-014f5ecf9c84` |
| Servicio | `blatos-sitio`, enganchado al repo |

**Deploy continuo: cada push a `main` redeploya solo.** No hay que correr nada
de Railway a mano:

```
git add -A && git commit -m "…" && git push
```

Railway lo detecta como **sitio estático** con su builder (Railpack) y lo sirve
tal cual: no hay `package.json`, ni build, ni `Dockerfile`, y **no hace falta
agregarlos**. Si alguna vez se suma un `package.json` al repo, Railway va a
dejar de tratarlo como estático y va a intentar levantarlo como app de Node.

Ojo con la identidad de git: está configurada **local al repo** (`git config`
sin `--global`) con el usuario de GitHub y su mail `noreply`, para no publicar
la dirección real en cada commit.

### Los dos backends son independientes

Conviven dos deploys que no se tocan entre sí:

- **el sitio** → GitHub → Railway (automático con cada push);
- **el Apps Script** → `clasp push` + `clasp deploy -i` (a mano, ver abajo).

Cambiar `apps-script/Code.gs` y pushear a GitHub **no** actualiza el backend:
el push sube el archivo al repo, pero a Google hay que mandarlo con clasp.

### CORS

El navegador llama al Apps Script desde el dominio de Railway, que es otro
origen. Funciona sin configurar nada:

- el **GET** del tablero y del contador devuelve 200 desde el dominio nuevo
  (verificado en producción);
- el **POST** viaja con `Content-Type: text/plain`, que evita el preflight
  `OPTIONS` —el que Apps Script no responde—. Verificado también en producción
  contra el `/exec` real.

Si algún día hubiera que agregar un dominio nuevo, no hay lista blanca que
tocar: el Web App está publicado con acceso "cualquier usuario".

## Backend: deploy con clasp

El backend se sube y deploya con `clasp` (CLI oficial de Apps Script, v3). Ya está
creado, deployado y enganchado al sitio: **`config.js` no se toca más**.

Un solo Web App atiende a las dos encuestas y a los contactos. `doPost` rutea
por el cuerpo del pedido:

| Payload | Va a |
|---|---|
| `tipo: 'contacto'` | hoja `contactos_interes` (compartida) |
| `encuesta: 'ciudad'` | hoja `ciudad` |
| `track: 'A'…'D2'` | hoja `track_a` … `track_d2` |

La encuesta de vivienda **no** manda campo `encuesta`, así que su camino es
exactamente el de siempre. `doGet` devuelve `tracks` como antes y suma
`ciudad` como clave hermana: un cliente que solo mire `tracks` sigue andando.

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
- **`encuesta.html`**: mismo lenguaje oscuro que el resto de divulgación
  (`.hero-cine.hero-corto.hero-encuestas` + dos `.tarjeta-encuesta` en
  `.elector-encuestas`, que pasa a una columna abajo de 860px).
- **`encuesta-vivienda.html` y `encuesta-ciudad.html`**
  (`<body class="pagina-encuesta">`): **spotlight**.
  La página tiene el fondo oscuro del sitio —imagen ambiental al 10%, viñeta y un
  halo cálido— pero **no cambia de tema**: los tokens semánticos siguen siendo los
  claros, así que la tarjeta donde se lee y se responde conserva los mismos
  colores y contrastes de siempre (texto 16.9:1, título 9.35:1, borde de control
  3.78:1). Cada `.paso` ES la tarjeta: fondo hueso, sombra que la despega del
  fondo y un halo difuso, con entrada de 0.42s.

  Las dos páginas de encuesta comparten esta clase y todo su CSS: no hay nada
  específico de una sola.

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

`portada-encuesta.js` suma `tracks[X].n` de los cinco trayectos **más
`ciudad.n`** —el contador es del relevamiento entero, no de una encuesta— del
mismo `doGet` que usa el tablero (`window.TFC_DASHBOARD.pedirDatos`) y lo anima
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
ninguna variable CSS. La encuesta de ciudad tiene su propia entrada `ciudad` en
las dos, en un ocre que no compite con los cinco trayectos.

En `resultados-vivienda.html`, la de ciudad se dibuja con el mismo `renderTrack`
en `#contenedor-ciudad`, separada por una línea. **No lleva divisoria con texto
encima**: su único bloque ya se llama "Encuesta sobre la ciudad" y el nombre
quedaría escrito dos veces seguidas. Si el backend todavía no devuelve la clave
`ciudad`, la sección no se dibuja y la página queda como antes.

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
"Bloque N de M" y barra de progreso. El último bloque es siempre el cierre común:
interés en el tema, opt-in de contacto y los dos campos de contacto.

El cierre **ya no incluye el ranking de proyectos urbanos**: eso se mudó entero
a la encuesta de ciudad. Preguntar por la ciudad al final de una encuesta sobre
la casa mezclaba dos temas y alargaba un cuestionario que ya era largo.

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
  Una opción de `orden` puede ser una etiqueta corta (`texto` sola) o una
  **tarjeta de tres niveles**, si además trae `propuesta` y `detalle`. Se usa
  en el ranking de ciudad; ver "Las siete propuestas" más abajo.
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

## Encuesta de ciudad: plana

`encuesta-ciudad.js`. **No hay árbol**: `resolver()` devuelve siempre el mismo
recorrido de cuatro bloques. El gating existe solo para tomar contexto.

### Gating (una sola pantalla)
`localidad` (+ "¿cuál?" si es del Valle) · `edad` · `modalidad`.

No hay convivencia ni vínculo. La de vivienda parte el gating en dos pantallas
porque las opciones de convivencia dependen de la edad; acá no hay nada que
dependa de nada, así que va todo junto.

**El único corte son los menores de 18**, por la misma razón que en vivienda: el
sitio se presenta como dirigido a mayores de edad y no pide el consentimiento de
un adulto responsable. `resolver()` devuelve `null` y no se guarda nada.

**`edad` es una columna propia de la hoja `ciudad`** y no filtra ni deriva
ninguna pregunta: está para poder leer cualquier respuesta por rango etario
desde la planilla, a mano y sin tocar código. Usa los mismos códigos que las
hojas de trayecto (`18_29`, `30_39`, …), así un filtro sirve para las dos
encuestas. `tests/backend.js` lo verifica.

### Los cuatro bloques

| Bloque | Preguntas |
|---|---|
| **La ciudad que ves** (3) | sector con más potencial hoy abandonado (abierta) · relación con el río (+ "¿por qué?" colgado) · problemática que más preocupa, 8 opciones + "otra" |
| **Dónde pasa la vida** (4) | qué equipamiento falta fuera de temporada (abierta) · qué otro motor tendría la ciudad (abierta) · dónde transcurre la vida social, 7 opciones + "otro" · qué gran proyecto de arquitectura te gustaría (abierta) |
| **Qué haría falta primero** (3) | casilla de escape · ranking de las 7 propuestas · otro proyecto o problemática (abierta) |
| **Para cerrar** (5) | catch-all general (abierta) · interés en el espacio público · opt-in + los dos campos de contacto |

La relación con el río va como **`radio`, no como `escala`**: son cuatro
etiquetas de palabra entera (Excelente / Buena / Regular / Deficiente) y la
escala del sitio se dibuja en una fila `nowrap` pensada para los números 1 a 5;
en un celular de 390px esas cuatro palabras no se leen. Sigue siendo ordinal:
el orden de las opciones es el que manda en la Sheet y en el tablero.

### Los dos catch-all son distintos a propósito
`ciudad_otra_propuesta` cierra el bloque del ranking y pregunta por
**proyectos** ("¿algún otro proyecto o problemática urgente que no esté en la
lista?"). `ciudad_algo_mas` abre el cierre y pregunta por **vivir acá** ("¿algo
más sobre cómo es vivir en Cosquín?"). Son dos columnas separadas en la hoja:
juntarlas mezclaría una lista de obras con testimonio.

`ciudad_proyecto_deseado` cierra el bloque 2 y hace de puente: pide el proyecto
propio **antes** de que aparezca la lista de las siete, para no contaminar la
respuesta con las opciones que vienen después.

### El "¿por qué?" del río no es una pregunta aparte
Va como **`campoExtra` sin `siValor`** de la pregunta del río, así se dibuja
dentro de la misma tarjeta —debajo de las opciones, con una línea y un
sangrado— en vez de llevarse un número propio del bloque. El bloque 1 tiene 3
preguntas, no 4.

Para eso el motor aprendió dos cosas en `campoExtra`, que antes solo servía
para el "¿cuál?" condicional:

| Campo | Qué hace |
|---|---|
| sin `siValor` | el campo está **siempre a la vista** (no depende de qué opción se marque) |
| `tipo: 'textarea'` | dibuja un `<textarea>` en vez de un renglón |

Los dos son opcionales y compatibles hacia atrás: el "¿en cuál?" del Valle y el
"¿cuál?" de la problemática siguen siendo `input` condicionales, sin tocar.
La clase `.campo-anidado` es la que lo despega visualmente, con la etiqueta en
peso 400 y color suave para que no compita con el enunciado de la pregunta
(18,4px contra 20,2px medidos en el navegador).

**El texto de un `campoExtra` es texto libre igual que cualquier abierta**: es
opcional y no sale nunca por el endpoint público. `tests/ciudad.js` lo verifica
para los cuatro que hay, y `tests/backend.js` los saca del esquema en vez de
tenerlos escritos a mano.

### Escape del ranking
La casilla "No conozco lo suficiente estos proyectos como para opinar" tiene la
misma mecánica que tenía en vivienda: es la `condicion` del ranking. Marcarla
lo esconde, y como el motor solo valida lo que está visible, esconderlo también
lo desobliga. **No conocer los proyectos es un dato**, por eso la casilla se
guarda y se publica.

Sin marcarla, hay que **tocar la lista al menos una vez** para poder seguir: la
lista arranca mezclada al azar y un orden que nadie eligió no es un dato.

### Las siete propuestas: tres niveles tipográficos
Cada tarjeta del ranking se lee en tres niveles, y los tres se separan por
tamaño **y** peso **y** color a la vez —apoyarse en una sola señal se rompe al
agrandar la tipografía del sistema o al mirar la pantalla al sol—:

| Nivel | Campo | CSS | Token | Contraste |
|---|---|---|---|---|
| Nombre | `texto` | `.orden-nombre` 1.08rem/700 | `--color-texto` | 16.94:1 |
| Propuesta | `propuesta` | `.orden-propuesta` 0.94rem/600 | `--color-primario-oscuro` | 9.35:1 |
| Explicación | `detalle` | `.orden-detalle` 0.85rem/400 | `--color-texto-suave` | 7.63:1 |

Los tres pasan **AAA** sobre la tarjeta de la encuesta (`--color-superficie`,
#fffdf8). `tests/contraste.js` lo recalcula leyendo el CSS de verdad, así que si
alguien cambia un token la prueba avisa.

`texto` es además el **nombre corto**: es lo que se lee en el `aria-label` de
las flechas y lo que anuncia el `role="status"` al mover un ítem ("Escuela de
artesanías: posición 1 de 7"). Si ahí se leyeran los tres niveles, nadie podría
seguir el reordenamiento sin ver la pantalla.

**En celular los controles pasan a una fila propia** (`@media (max-width: 620px)`
sobre `.item-orden:has(.orden-nombre)`): con el agarre, el número y las dos
flechas en la misma fila que el texto, a 390px al texto le quedaban 169px y la
explicación se partía en quince renglones. Con los controles arriba pasa a
~275px y la tarjeta más alta baja de 428 a 351px.

La lista igual mide ~2100px en un celular: **arrastrar de la posición 7 a la 1
no es práctico ahí, las flechas ↑ ↓ son el camino real**. Es el costo de mostrar
los tres niveles completos, que es lo que se pidió.

## Los dos diagramas de `docs/`

Dos PNG de referencia rápida, con **todas las preguntas** de cada encuesta:

```
node tools/dump-esquema.js > docs/esquema-encuesta.json
python tools/arbol-encuesta.py     # vivienda: el árbol de 5 trayectos
python tools/arbol-ciudad.py       # ciudad: el recorrido plano de 4 bloques
```

Los datos salen de los esquemas por `module.exports`, no de una transcripción:
**si se agrega una pregunta, el diagrama la muestra al regenerarlo**. El alto de
cada caja se calcula desde el texto que le toca, así que el layout se reacomoda
solo. Lo único escrito a mano en cada script es el texto de las reglas
(`REGLAS`), que hay que actualizar si cambian `derivarTrack()` o `resolver()`.

`_lienzo.py` tiene la paleta, los cuerpos de tipografía y las primitivas de
dibujo, para que los dos se vean como el mismo material. Requiere `matplotlib`
(no hay Graphviz en la máquina).

Regenerarlos después de tocar un esquema: el de ciudad fue el que hizo notar que
la bajada del bloque 1 decía "Tres preguntas" y eran cuatro.

## Pruebas

```
node tests/todos.js
```

Sin dependencias: node y nada más. Cuatro suites, ~460 comprobaciones, y cada
una se puede correr sola (`node tests/ciudad.js`).

| Suite | Qué cubre |
|---|---|
| `derivacion.js` | las 6 reglas de vivienda (con un barrido de las 1100 combinaciones del gating), el gating en dos pantallas, las convivencias por edad, los bloques de cada trayecto, y que el ranking urbano ya no esté en el cierre |
| `ciudad.js` | el gating de ciudad, el corte de menores, los cuatro bloques, el "¿por qué?" colgado del río, el escape del ranking, las siete propuestas con sus tres niveles, y la privacidad (abiertas y campos colgados opcionales, contacto fuera del payload) |
| `backend.js` | **evalúa `Code.gs` de verdad** en un sandbox de `vm` y lo cruza contra los dos esquemas: que toda pregunta que se manda tenga columna, que ninguna columna quede sin llenar, que `edad` esté en columna propia, y que lo publicable no incluya abiertas ni localidad |
| `contraste.js` | lee `style.css` y calcula el contraste WCAG real de los tres niveles de la tarjeta del ranking, que la jerarquía no dependa de una sola señal, y que los targets táctiles sigan en 40/48/56px |

`backend.js` es el que más paga: si se agrega una pregunta al esquema y se
olvida la columna en `Code.gs`, falla ahí en vez de perderse el dato en
producción.

Los tres archivos de encuesta exportan lo necesario con un
`typeof module !== 'undefined'` al final del IIFE, que en el navegador no hace
nada.

Correrlo después de tocar cualquier esquema, las reglas o `Code.gs`.

### Lo que las pruebas NO cubren
El arrastre con Pointer Events y el layout responsive no se pueden verificar en
node. Eso se mira en el navegador, sirviendo la carpeta
(`python -m http.server 8777`) y abriendo las páginas. Al mover el ranking a
tarjetas de tres niveles, medir a 390px fue lo que encontró que al texto le
quedaban 169px de ancho: ver el comentario del `@media (max-width: 620px)` de
`.item-orden:has(.orden-nombre)`.

## Reglas de privacidad (no negociables)
- Las preguntas abiertas son **siempre opcionales** y **nunca** salen por el endpoint público. Solo viven en la Sheet.
- La agregación se hace **en el servidor** (`doGet` en `Code.gs`), nunca en el cliente: si el frontend recibiera filas crudas, cualquiera las vería en la pestaña de Red.
- Una pregunta con **menos de 5 respuestas** no se incluye en el JSON de salida: la clave directamente no existe (no se manda "oculta").
- El JSON público nunca incluye desglose por localidad/barrio, ni texto libre, ni nada de `contactos_interes`.
- Los contactos van en **dos POST separados**, sin ningún ID en común con la respuesta. Además la hoja de contactos guarda **fecha sin hora**, para que no se pueda cruzar por timestamp con la fila de la encuesta.
- Lo que sí es publicable está declarado en `PREGUNTAS_PUBLICAS` (vivienda) y `PUBLICAS_CIUDAD` (ciudad), en `Code.gs`. **Lo que no esté ahí no puede salir nunca**: para publicar una pregunta nueva hay que agregarla explícitamente.
- Los dos POST y su orden importan: primero la respuesta, y **el contacto solo si esa primera llamada salió bien**. Si el contacto falla, la respuesta ya está guardada y no se molesta a la persona; al revés se guardaría un contacto sin la respuesta que lo justifica.

## Para agregar otra encuesta más adelante
(alquiler/festival, seguridad — todavía no construidas)

**El motor vive aparte y no se copia.** `encuesta-motor.js` tiene todo lo que no
cambia entre una encuesta y otra: el render de los seis tipos de pregunta, las
condiciones, las opciones dinámicas, los topes de selección, el arrastre, la
lectura del DOM, la validación, el gating, los bloques, el botón de atrás y los
dos POST. El archivo de cada encuesta es solo contenido más una config.

> Antes acá decía "copiar el archivo y reemplazar el esquema". Al aparecer la
> segunda encuesta eso hubiera dejado ~900 líneas de motor duplicadas, con el
> arrastre y la validación en dos lugares. Se extrajo el motor en su lugar.

Para una encuesta nueva:

1. Escribir `assets/js/encuesta-<tema>.js` con el esquema y esta config:

```js
window.TFC_ENCUESTA.iniciar({
  gatingPasos: [ { titulo, bajada, preguntas: [...] }, ... ],
  bloquesEstimados: 4,      // para la barra durante el gating
  iconos: { … },            // opcional (solo si se usa presentacion: 'grilla')
  resolver: function (gating) {
    // { clave, bloques } | null   ← null es el corte: no se guarda nada
  },
  armarPayload: function (ctx) {
    // ctx = { clave, gating, respuestas, cierre }
    // { payload, contacto }       ← contacto puede ser null
  }
});
```

2. Copiar `encuesta-ciudad.html` (es el cascarón más simple) y cambiar el copy
   del consentimiento, el del corte y el último `<script>`. **Los ids del HTML
   no se tocan**: el motor busca `paso-consentimiento`, `paso-gating`,
   `paso-bloque`, `paso-corte`, `paso-enviando`, `contenedor-gating`,
   `contenedor-bloque`, `form-gating`, `form-bloque`, `btn-siguiente`,
   `btn-atras`, `btn-atras-gating`, `progreso`, `progreso-barra` y
   `anuncio-paso`. `paso-corte` es opcional: si la encuesta no corta a nadie,
   se puede omitir.

3. En `Code.gs`: una hoja nueva con sus columnas, el ruteo en `doPost`, su
   bloque en `PUBLICAS_*` y las etiquetas de sus opciones. `agregarHoja()` ya es
   genérico: no hay que escribir agregación nueva.

4. Sumar una suite en `tests/` y engancharla en `tests/todos.js`.

5. Sumar la tarjeta en `encuesta.html`.

`Code.gs` es autocontenido: crea las hojas que falten y sincroniza los
encabezados solo. Con la hoja vacía los reescribe enteros; con respuestas
cargadas solo **agrega al final** las columnas nuevas, nunca inserta en el
medio. Además cada fila se arma contra el encabezado real de la hoja, no contra
el esquema, así un desfasaje no corre todos los datos un lugar.

**Ojo con eso último**: sacar una columna del esquema **no** la borra de una
hoja que ya tiene datos. Al mudar el ranking urbano de vivienda a ciudad, las
hojas `track_*` que tuvieran filas conservan las columnas
`cierre_urbano_*` vacías. Es a propósito: borrarlas correría los datos viejos.

`Code.gs` es autocontenido: crea las hojas que falten y sincroniza los encabezados solo. Con la hoja vacía los reescribe enteros; con respuestas cargadas solo **agrega al final** las columnas nuevas, nunca inserta en el medio. Además cada fila se arma contra el encabezado real de la hoja, no contra el esquema, así un desfasaje no corre todos los datos un lugar.

## Pendientes
- **El backend de la encuesta de ciudad todavía no está deployado.** El código
  está en `apps-script/Code.gs` y las pruebas pasan, pero a Google hay que
  mandarlo a mano:

  ```
  clasp push
  clasp deploy -i AKfycbz4ADkzPwXcUroimeqC4FcT1PItIcSXwfyJT4DM9L2uSf2Edle66fHEdkhM0R9epNtJ
  ```

  Hasta que eso pase, `encuesta-ciudad.html` **no puede guardar respuestas**
  (el `doPost` viejo no conoce `encuesta: 'ciudad'` y responde `track_invalido`).
  El resto del sitio funciona igual: el tablero degrada solo —si el `doGet` no
  devuelve la clave `ciudad`, esa sección no se dibuja, verificado en el
  navegador—. **Conviene no difundir el link de la encuesta de ciudad antes
  del push.**

  Después del deploy, ejecutar `configurarHojas()` una vez desde el editor para
  que quede creada la hoja `ciudad` con sus encabezados (o dejar que la cree
  sola la primera respuesta).
- **Todavía no hay datos de producción**: el esquema se puede seguir cambiando sin cuidado por compatibilidad.

  La zona horaria de la planilla ya quedó en Buenos Aires y las filas de prueba
  del deploy ya se borraron: lo que haya en la Sheet de acá en adelante es dato.
- `gracias.html` es compartida por las dos encuestas y su copy todavía habla
  solo de vivienda ("adultos mayores, familias que conviven entre varias
  generaciones"). No molesta, pero conviene generalizarlo.
- Favicon (hoy da 404).
- Completar el contenido de `el-proyecto.html` (la estructura y la galería ya
  están; falta el material propio de la tesis a medida que avance).
- Definir si las respuestas se exportan a la carpeta de Drive del TFC (`01_Etapa 1/04_Relevamiento social`).
- Sistema de incentivo/beneficio para quienes dejan contacto: **sin definir**, el flujo de `contactos_interes` quedó listo y desacoplado pero sin lógica de sorteo.
