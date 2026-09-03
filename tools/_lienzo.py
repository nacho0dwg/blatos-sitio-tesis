# -*- coding: utf-8 -*-
u"""
Lo compartido por los dos diagramas de docs/ (arbol-encuesta.py y
arbol-ciudad.py): la paleta, los cuerpos de tipografía y las primitivas
de dibujo. Está acá para que los dos PNG se vean como el mismo material,
que es medio el punto de tenerlos.

El lienzo mide siempre 100 unidades de ancho y las unidades son
CUADRADAS: una unidad en x mide lo mismo, en pulgadas, que una en y. Por
eso se puede calcular el alto de un párrafo en unidades y apilarlo sin
sorpresas, que es lo que deja que las cajas se dimensionen solas a partir
del texto que les toca.
"""
import textwrap

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

# ------------------------------------------------------------------ paleta
TINTA = "#1c1a17"
GRIS = "#5a534a"
GRIS_CLARO = "#7d766c"
HUESO = "#faf7f2"
PAPEL = "#efe9df"
PAPEL_TENUE = "#f2ede5"

# ------------------------------------------------------------- tipografías
FS_TITULO = 26
FS_SUB = 13
FS_GATING = 17
FS_GATING_SUB = 13
FS_REGLA = 14
FS_TRACK = 19
FS_TRACK_SUB = 11.5
FS_BLOQUE_META = 10.5
FS_BLOQUE_TITULO = 13.5
FS_PREGUNTA = 9.5
FS_NOTA = 8.5


def etiquetas_de(pregunta):
    u"""Marcas cortas que van debajo del texto de una pregunta.

    Salen del dump, así que dicen lo que el esquema dice de verdad: el
    tipo, si se puede dejar vacía, y por qué podría no aparecer."""
    marcas = [pregunta["tipo"]]
    if pregunta["opcional"]:
        marcas.append(u"opcional")
    if pregunta.get("extra"):
        marcas.append(u"solo si convive entre generaciones")
    elif pregunta["condicional"]:
        marcas.append(u"condicional")
    marca = u"[" + u" · ".join(marcas) + u"]"
    extra = pregunta.get("campoExtra")
    if extra:
        marca += u" + campo abierto: “%s”" % extra["etiqueta"]
    return marca


class Lienzo(object):
    u"""Escala primero, figura después.

    Medir tiene que poder hacerse ANTES de crear la figura, porque el
    alto del lienzo sale de cuánto ocupa el contenido. Por eso `alto` y
    `envolver` funcionan apenas se construye el objeto, y `abrir` —que
    crea la figura— se llama recién cuando ya se sabe el YMAX."""

    def __init__(self, ancho_in):
        self.ancho_in = ancho_in
        self.u = ancho_in / 100.0        # pulgadas por unidad de lienzo
        self.fig = None
        self.ax = None

    # ---------------------------------------------------------- medición
    def alto(self, fs, lineas=1, interlineado=1.34):
        u"""Alto en unidades de `lineas` renglones a `fs` puntos."""
        return lineas * fs * interlineado / 72.0 / self.u

    def envolver(self, texto, fs, ancho_u):
        u"""Parte un texto en líneas que entren en `ancho_u` unidades.

        DejaVu Sans promedia ~0.55 em de avance por caracter; es una
        estimación, pero con el margen interno de las cajas alcanza."""
        cpp = ancho_u * self.u * 72.0 / (fs * 0.55)
        return textwrap.wrap(texto, max(12, int(cpp)))

    # ----------------------------------------------------------- figura
    def abrir(self, ymax):
        self.ymax = ymax
        self.fig, self.ax = plt.subplots(
            figsize=(self.ancho_in, self.ancho_in * ymax / 100.0))
        self.ax.set_xlim(0, 100)
        self.ax.set_ylim(0, ymax)
        self.ax.invert_yaxis()
        self.ax.axis("off")
        self.ax.set_position([0, 0, 1, 1])
        self.fig.patch.set_facecolor(HUESO)
        return self

    # ---------------------------------------------------------- dibujo
    def caja(self, x, y0, y1, ancho, borde, relleno="white", lw=1.6, radio=0.5):
        self.ax.add_patch(FancyBboxPatch(
            (x - ancho / 2.0, y0), ancho, y1 - y0,
            boxstyle="round,pad=0,rounding_size=%s" % radio,
            linewidth=lw, edgecolor=borde, facecolor=relleno, zorder=2))

    def texto(self, x, y, s, size=11, weight="normal", color=TINTA,
              va="center", ha="center"):
        self.ax.text(x, y, s, ha=ha, va=va, fontsize=size, fontweight=weight,
                     color=color, zorder=3, linespacing=1.34)

    def flecha(self, x0, y0, x1, y1, color=TINTA, lw=1.4, estilo="arc3,rad=0"):
        self.ax.add_patch(FancyArrowPatch(
            (x0, y0), (x1, y1), connectionstyle=estilo,
            arrowstyle="-|>", mutation_scale=14,
            linewidth=lw, color=color, zorder=1))

    def guardar(self, destino, dpi=100):
        self.fig.savefig(destino, dpi=dpi, facecolor=HUESO)
        return destino
