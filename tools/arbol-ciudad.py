# -*- coding: utf-8 -*-
u"""
Dibuja la encuesta de CIUDAD entera como PNG de referencia.

    node tools/dump-esquema.js > docs/esquema-encuesta.json
    python tools/arbol-ciudad.py

Sale docs/arbol-ciudad.png.

Esta encuesta es PLANA: no hay trayectos, así que no hay árbol que
abrirse en columnas paralelas. Los cuatro bloques son una secuencia, y el
diagrama los pone en fila de izquierda a derecha, que es el orden en que
se responden. Lo único que se bifurca es el corte de los menores.

Los datos salen de encuesta-ciudad.js vía el dump; lo único transcrito a
mano son las dos reglas de `resolver()` (REGLAS, abajo).
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
PNG_OUT = os.path.join(RAIZ, "docs", "arbol-ciudad.png")

with io.open(JSON_IN, encoding="utf-8") as f:
    D = json.load(f)["ciudad"]

# Las dos reglas de resolver(), en orden de evaluación.
REGLAS = [
    (u"0", u"edad = menor de 18", u"CORTE"),
    (u"1", u"cualquier otro caso", u"LOS 4 BLOQUES"),
]

COLOR = "#8a6a12"          # el mismo ocre que usa la encuesta en el tablero
COLOR_CORTE = "#6b6b6b"

NOMBRE_CORTE = (u"No pedimos el consentimiento\n"
                u"de un adulto responsable:\ngracias y NO se guarda nada")

# ------------------------------------------------------------------ escala
L = Lienzo(ancho_in=20.0)

ANCHO_COL = 22.6
GAP_COL = 2.0
X0 = 1.6
CENTROS = [X0 + ANCHO_COL / 2 + i * (ANCHO_COL + GAP_COL) for i in range(4)]
X_MEDIO = 50.0

PAD_COL = 0.85
ANCHO_TEXTO_COL = ANCHO_COL - 2 * PAD_COL

Y_TITULO = 2.0
Y_GATING = (7.4, 15.4)
Y_REGLAS = (19.6, 32.6)
Y_HEAD = (37.4, 44.0)
Y_BLOQUES = 47.6


def medir_bloque(bloque):
    u"""Devuelve (alto, lineas_titulo, lineas_bajada, filas)."""
    lin_titulo = L.envolver(bloque["titulo"], FS_BLOQUE_TITULO, ANCHO_TEXTO_COL)
    lin_bajada = L.envolver(bloque["bajada"], FS_NOTA, ANCHO_TEXTO_COL) if bloque["bajada"] else []

    h = PAD_COL + L.alto(FS_BLOQUE_META) + L.alto(FS_BLOQUE_TITULO, len(lin_titulo))
    if lin_bajada:
        h += L.alto(FS_NOTA, len(lin_bajada)) + 0.25
    h += 0.8

    filas = []
    for i, p in enumerate(bloque["preguntas"]):
        lin_p = L.envolver(u"%d. %s" % (i + 1, p["etiqueta"]), FS_PREGUNTA, ANCHO_TEXTO_COL)
        lin_m = L.envolver(etiquetas_de(p), FS_NOTA, ANCHO_TEXTO_COL)
        filas.append((lin_p, lin_m))
        h += L.alto(FS_PREGUNTA, len(lin_p)) + L.alto(FS_NOTA, len(lin_m)) + 0.6

    return h - 0.6 + PAD_COL, lin_titulo, lin_bajada, filas


# Se mide todo antes de dibujar para saber cuánto lienzo hace falta. Las
# cuatro columnas arrancan a la misma altura, así que el alto lo fija la
# más larga.
MEDIDAS = [medir_bloque(b) for b in D["bloques"]]
YMAX = Y_BLOQUES + max(m[0] for m in MEDIDAS) + 8.0

L.abrir(YMAX)

TOTAL = sum(len(b["preguntas"]) for b in D["bloques"])
ABIERTAS = sum(1 for b in D["bloques"] for p in b["preguntas"] if p["opcional"] and p["tipo"] in ("texto", "textarea"))

# --------------------------------------------------------------- encabezado
L.texto(X_MEDIO, Y_TITULO, u"Encuesta sobre la ciudad — recorrido completo",
        size=FS_TITULO, weight="bold")
L.texto(X_MEDIO, Y_TITULO + 2.3,
        u"generado desde assets/js/encuesta-ciudad.js  ·  "
        u"es plana: un solo recorrido, sin trayectos",
        size=FS_SUB, color=GRIS_CLARO)

# ------------------------------------------------------------------- gating
paso = D["gating"][0]
L.caja(X_MEDIO, Y_GATING[0], Y_GATING[1], 46.0, TINTA, PAPEL, lw=2.2)
L.texto(X_MEDIO, Y_GATING[0] + 1.6,
        u"GATING  ·  %s  ·  una sola pantalla" % paso["titulo"],
        size=FS_GATING, weight="bold")
L.texto(X_MEDIO, Y_GATING[0] + 3.6,
        u"%d preguntas:  %s" % (paso["n"], u"  ·  ".join(p["id"] for p in paso["preguntas"])),
        size=FS_GATING_SUB, color="#4a443c")
L.texto(X_MEDIO, Y_GATING[0] + 5.6,
        u"sin convivencia ni vínculo: acá no se deriva a ningún trayecto,\n"
        u"y la edad queda como columna propia para filtrar la Sheet",
        size=FS_NOTA + 2, color=GRIS_CLARO)

L.flecha(X_MEDIO, Y_GATING[1], X_MEDIO, Y_REGLAS[0] - 0.3, lw=2.2)

# ------------------------------------------------------------------ reglas
ANCHO_REGLAS = 52.0
X_REGLAS = 32.0
L.caja(X_REGLAS, Y_REGLAS[0], Y_REGLAS[1], ANCHO_REGLAS, TINTA, "white", lw=2.2)
L.texto(X_REGLAS, Y_REGLAS[0] + 1.8, u"resolver()  —  el único corte",
        size=FS_GATING, weight="bold")

x_izq = X_REGLAS - ANCHO_REGLAS / 2.0 + 2.4
x_der = X_REGLAS + ANCHO_REGLAS / 2.0 - 2.4
y = Y_REGLAS[0] + 5.4
for num, cond, destino in REGLAS:
    L.texto(x_izq, y, u"%s ·" % num, size=FS_REGLA, weight="bold", ha="left", color=GRIS_CLARO)
    L.texto(x_izq + 2.4, y, cond, size=FS_REGLA, ha="left")
    L.texto(x_der, y, u"→  %s" % destino, size=FS_REGLA, weight="bold", ha="right",
            color=COLOR_CORTE if destino == u"CORTE" else COLOR)
    y += 3.0

L.texto(X_REGLAS, Y_REGLAS[1] - 2.0,
        u"todo el mundo responde los mismos cuatro bloques",
        size=FS_NOTA + 1.5, color=GRIS_CLARO)

# ------------------------------------------------------------------- corte
X_CORTE = 84.0
ANCHO_CORTE = 26.0
L.caja(X_CORTE, Y_REGLAS[0] + 2.2, Y_REGLAS[1] - 2.2, ANCHO_CORTE,
       COLOR_CORTE, "#e6e2dc", lw=2.2)
L.texto(X_CORTE, Y_REGLAS[0] + 4.4, u"CORTE", size=FS_TRACK, weight="bold", color=COLOR_CORTE)
L.texto(X_CORTE, Y_REGLAS[0] + 7.8, NOMBRE_CORTE, size=FS_TRACK_SUB, color="#4a443c")

L.flecha(X_REGLAS + ANCHO_REGLAS / 2.0, Y_REGLAS[0] + 5.4,
         X_CORTE - ANCHO_CORTE / 2.0 - 0.3, Y_REGLAS[0] + 5.4,
         color=COLOR_CORTE, lw=1.7)

# ---------------------------------------------------------- barra del recorrido
L.caja(X_MEDIO, Y_HEAD[0], Y_HEAD[1], 100.0 - 2 * X0, COLOR, COLOR, lw=2.2)
L.texto(X_MEDIO, Y_HEAD[0] + 2.0, u"UN SOLO RECORRIDO", size=FS_TRACK,
        weight="bold", color="white")
L.texto(X_MEDIO, Y_HEAD[0] + 4.6,
        u"%d bloques  ·  %d preguntas  ·  %d abiertas, todas opcionales, "
        u"que nunca salen por el endpoint público"
        % (len(D["bloques"]), TOTAL, ABIERTAS),
        size=FS_TRACK_SUB, color="#f6efe2")

L.flecha(X_REGLAS, Y_REGLAS[1], X_MEDIO, Y_HEAD[0] - 0.3, color=COLOR, lw=2.0,
         estilo="arc3,rad=0.05")

# ------------------------------------------------------------------ bloques
for i, (bloque, medida) in enumerate(zip(D["bloques"], MEDIDAS)):
    x = CENTROS[i]
    h, lin_titulo, lin_bajada, filas = medida
    y0, y1 = Y_BLOQUES, Y_BLOQUES + h
    ultimo = i == len(D["bloques"]) - 1

    L.flecha(x, Y_HEAD[1], x, y0 - 0.25, color=COLOR, lw=1.4)
    L.caja(x, y0, y1, ANCHO_COL, COLOR, PAPEL_TENUE if ultimo else "white", lw=1.6)

    # La flecha entre bloques: son una secuencia, no cuatro caminos.
    if i < len(D["bloques"]) - 1:
        L.flecha(x + ANCHO_COL / 2.0, y0 + 3.0,
                 CENTROS[i + 1] - ANCHO_COL / 2.0 - 0.2, y0 + 3.0,
                 color=COLOR, lw=1.6)

    xt = x - ANCHO_COL / 2.0 + PAD_COL
    yc = y0 + PAD_COL

    L.texto(xt, yc, u"Bloque %d de %d  ·  %d pregunta%s"
            % (i + 1, len(D["bloques"]), len(bloque["preguntas"]),
               u"" if len(bloque["preguntas"]) == 1 else u"s"),
            size=FS_BLOQUE_META, weight="bold", color=COLOR, ha="left", va="top")
    yc += L.alto(FS_BLOQUE_META)

    L.texto(xt, yc, u"\n".join(lin_titulo), size=FS_BLOQUE_TITULO,
            weight="bold", ha="left", va="top")
    yc += L.alto(FS_BLOQUE_TITULO, len(lin_titulo))

    if lin_bajada:
        L.texto(xt, yc, u"\n".join(lin_bajada), size=FS_NOTA, color=GRIS_CLARO,
                ha="left", va="top")
        yc += L.alto(FS_NOTA, len(lin_bajada)) + 0.25
    yc += 0.8

    for lin_p, lin_m in filas:
        L.texto(xt, yc, u"\n".join(lin_p), size=FS_PREGUNTA, ha="left", va="top")
        yc += L.alto(FS_PREGUNTA, len(lin_p))
        L.texto(xt + 0.9, yc, u"\n".join(lin_m), size=FS_NOTA, color=GRIS_CLARO,
                ha="left", va="top")
        yc += L.alto(FS_NOTA, len(lin_m)) + 0.6

L.texto(X_MEDIO, YMAX - 4.6,
        u"El bloque 3 es el único con lógica: marcar “no conozco” esconde el ranking, "
        u"y como el motor solo valida lo visible, esconderlo también lo desobliga.",
        size=FS_SUB, color=GRIS)
L.texto(X_MEDIO, YMAX - 2.4,
        u"El contacto (nombre y medio) viaja en un POST aparte, sin ningún id en común "
        u"con la fila de respuestas.",
        size=FS_SUB, color=GRIS_CLARO)

print(L.guardar(PNG_OUT))
