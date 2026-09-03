# -*- coding: utf-8 -*-
u"""
Dibuja el árbol completo de la encuesta de vivienda como PNG de referencia:
el gating, las reglas de derivación y, dentro de cada trayecto, los bloques
temáticos con el texto de todas sus preguntas.

    node tools/dump-esquema.js > docs/esquema-encuesta.json
    python tools/arbol-encuesta.py

Sale docs/arbol-encuesta.png. Los datos salen de encuesta-vivienda.js vía el
dump: lo único transcrito a mano es el texto de las reglas (REGLAS, abajo),
que hay que actualizar si cambia derivarTrack().

El alto de cada caja se calcula a partir del texto que le toca, así que el
diagrama se reacomoda solo cuando se agregan o sacan preguntas.
"""
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lienzo import (Lienzo, etiquetas_de, TINTA, GRIS, GRIS_CLARO, PAPEL,
                     PAPEL_TENUE, FS_TITULO, FS_SUB, FS_GATING, FS_GATING_SUB,
                     FS_REGLA, FS_TRACK, FS_TRACK_SUB, FS_BLOQUE_META,
                     FS_BLOQUE_TITULO, FS_PREGUNTA, FS_NOTA)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_IN = os.path.join(RAIZ, "docs", "esquema-encuesta.json")
PNG_OUT = os.path.join(RAIZ, "docs", "arbol-encuesta.png")

with io.open(JSON_IN, encoding="utf-8") as f:
    D = json.load(f)

# Las 6 reglas de derivarTrack(), en orden de evaluación.
REGLAS = [
    (u"0", u"edad = menor de 18", u"CORTE"),
    (u"1", u"60 o más y vive en Cosquín / el Valle", u"A"),
    (u"2", u"menos de 60, en la zona, conviviendo con padres-abuelos o con hijos adultos", u"B"),
    (u"3", u"vive en Córdoba Capital y tiene algún vínculo con Cosquín", u"C"),
    (u"4", u"resto de la zona, 18 a 39", u"D1"),
    (u"5", u"resto de la zona, 40 a 59", u"D2"),
    (u"6", u"cualquier otro caso", u"CORTE"),
]

COLUMNAS = [u"A", u"B", u"C", u"D1", u"D2", u"CORTE"]

COLOR = {
    u"A":     "#8c4a2f",
    u"B":     "#2f6b57",
    u"C":     "#3a5a8c",
    u"D1":    "#7a5a1f",
    u"D2":    "#6b3f6b",
    u"CORTE": "#6b6b6b",
}

NOMBRE_CORTE = u"No hay trayecto que le corresponda:\npantalla de agradecimiento\ny NO se guarda nada"

# ------------------------------------------------------------------ escala
L = Lienzo(ancho_in=25.0)

ANCHO_COL = 15.2
GAP_COL = 1.4
X0 = 0.9
CENTROS = {t: X0 + ANCHO_COL / 2 + i * (ANCHO_COL + GAP_COL)
           for i, t in enumerate(COLUMNAS)}
X_MEDIO = 50.0

PAD_COL = 0.75                # margen interno de las cajas de bloque
ANCHO_TEXTO_COL = ANCHO_COL - 2 * PAD_COL


def envolver(texto, fs, ancho_u=ANCHO_TEXTO_COL):
    return L.envolver(texto, fs, ancho_u)


def alto(fs, lineas=1):
    return L.alto(fs, lineas)


# ------------------------------------------------------- alturas del encabezado
Y_G1 = (7.0, 13.2)
Y_G2 = (16.2, 23.4)
Y_REGLAS = (26.6, 48.2)
Y_HEAD = (52.4, 62.0)
Y_BLOQUES_0 = 65.4

GAP_BLOQUE = 1.5


def medir_bloque(bloque):
    u"""Devuelve (alto, lineas_titulo, [(lineas_pregunta, lineas_marca)])."""
    lin_titulo = envolver(bloque["titulo"], FS_BLOQUE_TITULO)
    h = PAD_COL + alto(FS_BLOQUE_META) + alto(FS_BLOQUE_TITULO, len(lin_titulo)) + 0.75

    filas = []
    for i, p in enumerate(bloque["preguntas"]):
        lin_p = envolver(u"%d. %s" % (i + 1, p["etiqueta"]), FS_PREGUNTA)
        lin_m = envolver(etiquetas_de(p), FS_NOTA)
        filas.append((lin_p, lin_m))
        h += alto(FS_PREGUNTA, len(lin_p)) + alto(FS_NOTA, len(lin_m)) + 0.55

    return h - 0.55 + PAD_COL, lin_titulo, filas


# Se mide todo antes de dibujar para saber cuánto lienzo hace falta.
MEDIDAS = {}
fin_columna = {}
for track in COLUMNAS:
    if track == u"CORTE":
        fin_columna[track] = Y_HEAD[1]
        continue
    y = Y_BLOQUES_0
    MEDIDAS[track] = []
    for bloque in D["tracks"][track]["bloques"]:
        h, lin_titulo, filas = medir_bloque(bloque)
        MEDIDAS[track].append((y, h, lin_titulo, filas))
        y += h + GAP_BLOQUE
    fin_columna[track] = y - GAP_BLOQUE

Y_FIN = max(fin_columna.values())
YMAX = Y_FIN + 7.0

L.abrir(YMAX)

caja = L.caja
texto = L.texto
flecha = L.flecha


# --------------------------------------------------------------- encabezado
texto(X_MEDIO, 2.0, u"Encuesta de vivienda intergeneracional — árbol completo",
      size=FS_TITULO, weight="bold")
texto(X_MEDIO, 4.3,
      u"generado desde assets/js/encuesta-vivienda.js  ·  "
      u"las preguntas del gating se listan arriba; las de cada trayecto, en su columna",
      size=FS_SUB, color=GRIS_CLARO)

# ------------------------------------------------------------------- gating
ANCHO_GATING = 40.0
for i, paso in enumerate(D["gating"]):
    y0, y1 = (Y_G1, Y_G2)[i]
    caja(X_MEDIO, y0, y1, ANCHO_GATING, TINTA, PAPEL, lw=2.2)
    texto(X_MEDIO, y0 + 1.5,
          u"GATING %d de %d  ·  %s" % (i + 1, len(D["gating"]), paso["titulo"]),
          size=FS_GATING, weight="bold")
    ids = u"  ·  ".join(p["id"] for p in paso["preguntas"])
    texto(X_MEDIO, y0 + 3.5,
          u"%d pregunta%s:  %s" % (paso["n"], u"" if paso["n"] == 1 else u"s", ids),
          size=FS_GATING_SUB, color="#4a443c")
    if i == 1:
        texto(X_MEDIO, y0 + 5.4,
              u"las opciones dependen de la edad respondida arriba",
              size=FS_NOTA + 2, color=GRIS_CLARO)

flecha(X_MEDIO, Y_G1[1], X_MEDIO, Y_G2[0] - 0.3, lw=2.2)
flecha(X_MEDIO, Y_G2[1], X_MEDIO, Y_REGLAS[0] - 0.3, lw=2.2)

# ------------------------------------------------------------------- reglas
ANCHO_REGLAS = 62.0
caja(X_MEDIO, Y_REGLAS[0], Y_REGLAS[1], ANCHO_REGLAS, TINTA, "white", lw=2.2)
texto(X_MEDIO, Y_REGLAS[0] + 1.7,
      u"derivarTrack()  —  las reglas se evalúan en orden y la primera que matchea gana",
      size=FS_GATING, weight="bold")

x_izq = X_MEDIO - ANCHO_REGLAS / 2.0 + 2.2
x_der = X_MEDIO + ANCHO_REGLAS / 2.0 - 2.2
y = Y_REGLAS[0] + 4.9
for num, cond, destino in REGLAS:
    texto(x_izq, y, u"%s ·" % num, size=FS_REGLA, weight="bold", ha="left", color=GRIS_CLARO)
    texto(x_izq + 2.2, y, cond, size=FS_REGLA, ha="left")
    texto(x_der, y, u"→  %s" % destino, size=FS_REGLA, weight="bold",
          ha="right", color=COLOR[destino])
    y += 2.55

# -------------------------------------------------------- trayectos y bloques
for track in COLUMNAS:
    x = CENTROS[track]
    color = COLOR[track]

    flecha(X_MEDIO, Y_REGLAS[1], x, Y_HEAD[0] - 0.3, color=color, lw=1.7,
           estilo="arc3,rad=0.06")

    if track == u"CORTE":
        caja(x, Y_HEAD[0], Y_HEAD[1], ANCHO_COL, color, "#e6e2dc", lw=2.2)
        texto(x, Y_HEAD[0] + 2.0, u"CORTE", size=FS_TRACK, weight="bold", color=color)
        texto(x, Y_HEAD[0] + 6.0, NOMBRE_CORTE, size=FS_TRACK_SUB, color="#4a443c")
        continue

    datos = D["tracks"][track]
    total = sum(len(b["preguntas"]) for b in datos["bloques"])

    caja(x, Y_HEAD[0], Y_HEAD[1], ANCHO_COL, color, color, lw=2.2)
    texto(x, Y_HEAD[0] + 2.0, u"TRACK %s" % track, size=FS_TRACK,
          weight="bold", color="white")
    texto(x, Y_HEAD[0] + 5.2, u"\n".join(envolver(datos["nombre"], FS_TRACK_SUB)),
          size=FS_TRACK_SUB, color="white")
    texto(x, Y_HEAD[1] - 1.3,
          u"%d bloques  ·  %d preguntas" % (len(datos["bloques"]), total),
          size=FS_NOTA + 1, color="#f0e7de")

    prev_y = Y_HEAD[1]
    for i, (bloque, medida) in enumerate(zip(datos["bloques"], MEDIDAS[track])):
        y0, h, lin_titulo, filas = medida
        y1 = y0 + h
        ultimo = i == len(datos["bloques"]) - 1

        flecha(x, prev_y, x, y0 - 0.25, color=color, lw=1.3)
        caja(x, y0, y1, ANCHO_COL, color, PAPEL_TENUE if ultimo else "white", lw=1.5)

        xt = x - ANCHO_COL / 2.0 + PAD_COL
        yc = y0 + PAD_COL

        texto(xt, yc, u"Bloque %d de %d  ·  %d pregunta%s"
              % (i + 1, len(datos["bloques"]), len(bloque["preguntas"]),
                 u"" if len(bloque["preguntas"]) == 1 else u"s"),
              size=FS_BLOQUE_META, weight="bold", color=color, ha="left", va="top")
        yc += alto(FS_BLOQUE_META)

        texto(xt, yc, u"\n".join(lin_titulo), size=FS_BLOQUE_TITULO,
              weight="bold", ha="left", va="top")
        yc += alto(FS_BLOQUE_TITULO, len(lin_titulo)) + 0.75

        for lin_p, lin_m in filas:
            texto(xt, yc, u"\n".join(lin_p), size=FS_PREGUNTA, ha="left", va="top")
            yc += alto(FS_PREGUNTA, len(lin_p))
            texto(xt + 0.9, yc, u"\n".join(lin_m), size=FS_NOTA,
                  color=GRIS_CLARO, ha="left", va="top")
            yc += alto(FS_NOTA, len(lin_m)) + 0.55

        prev_y = y1

    texto(x, fin_columna[track] + 1.4, u"envío a la Sheet",
          size=FS_NOTA + 1, color=GRIS, va="top")

# ---------------------------------------------------------------------- pie
texto(X_MEDIO, YMAX - 2.4,
      u'El bloque "Para cerrar" es idéntico en los cinco trayectos.  '
      u'Las preguntas abiertas nunca salen por el endpoint público: solo viven en la Sheet.',
      size=FS_SUB, color=GRIS_CLARO)

print(L.guardar(PNG_OUT))
