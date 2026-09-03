# -*- coding: utf-8 -*-
u"""
Arma las imágenes de vista previa (Open Graph) y el favicon.

    python tools/hacer-og.py

Sale assets/img/og/*.jpg y assets/img/favicon.svg + favicon-180.png.

Por qué existe: la encuesta se difunde por WhatsApp, muchas veces a
adultos mayores. Un link sin vista previa llega como una URL pelada de
railway.app —que no dice nada y da desconfianza—; con imagen, título y
bajada llega como una tarjeta que se entiende sin abrirla. Es la
diferencia entre que la abran y que no.

Las imágenes salen de las mismas del imaginario que usa cada hero, así
que la tarjeta de WhatsApp y la página que se abre después muestran lo
mismo. 1200x630 es el formato que piden Facebook y WhatsApp (1.91:1).
"""
import io
import os

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RAIZ, "assets", "img")
SALIDA = os.path.join(IMG, "og")

ANCHO, ALTO = 1200, 630

# Los mismos tokens del sitio (style.css).
HUESO = (243, 237, 226)
CARBON = (28, 23, 18)
TERRACOTA = (176, 90, 42)

# Cada tarjeta: archivo de salida, imagen de base (la del hero de esa
# página) y las dos líneas de texto.
TARJETAS = [
    ("og-general.jpg", "Imaginario 0 (4).jpeg",
     u"VIVIR JUNTOS", u"Vivienda intergeneracional en Cosquín"),
    ("og-encuestas.jpg", "Imaginario 0 (5).jpeg",
     u"LAS ENCUESTAS", u"Dos encuestas anónimas · 5 minutos cada una"),
    ("og-ciudad.jpg", "Imaginario 0 (5).jpeg",
     u"LA CIUDAD", u"El río, los accesos, la plaza · 5 minutos, anónima"),
    ("og-vivienda.jpg", "Imaginario 0 (13).jpeg",
     u"LA CASA", u"Convivir entre generaciones · 6 minutos, anónima"),
]


def fuente(nombres, tam):
    u"""La primera de la lista que exista en el sistema.

    Archivo Black no está instalada —la carga el sitio por Google Fonts—,
    así que para la imagen se usa la de sistema más parecida. Si no hay
    ninguna, Pillow devuelve su bitmap por defecto: feo pero legible, y
    vale más una vista previa fea que ninguna."""
    for n in nombres:
        for base in (r"C:\Windows\Fonts", "/usr/share/fonts/truetype/dejavu"):
            ruta = os.path.join(base, n)
            if os.path.exists(ruta):
                try:
                    return ImageFont.truetype(ruta, tam)
                except Exception:
                    pass
    return ImageFont.load_default()


TITULO = fuente(["ariblk.ttf", "DejaVuSans-Bold.ttf"], 96)
BAJADA = fuente(["georgia.ttf", "DejaVuSerif.ttf"], 36)
MARCA = fuente(["ariblk.ttf", "DejaVuSans-Bold.ttf"], 26)


def recortar(im):
    u"""Recorta al 1.91:1 tomando el centro, sin deformar."""
    objetivo = ANCHO / float(ALTO)
    w, h = im.size
    if w / float(h) > objetivo:
        nuevo = int(h * objetivo)
        izq = (w - nuevo) // 2
        im = im.crop((izq, 0, izq + nuevo, h))
    else:
        nuevo = int(w / objetivo)
        arriba = (h - nuevo) // 2
        im = im.crop((0, arriba, w, arriba + nuevo))
    return im.resize((ANCHO, ALTO), Image.LANCZOS)


def velo(im):
    u"""El mismo gradiente oscuro del hero: sin esto el texto hueso se
    pierde contra el cielo."""
    im = ImageEnhance.Brightness(im).enhance(0.62)
    capa = Image.new("L", (ANCHO, ALTO), 0)
    pinta = ImageDraw.Draw(capa)
    for y in range(ALTO):
        t = y / float(ALTO)
        pinta.line([(0, y), (ANCHO, y)], fill=int(60 + 165 * (t ** 1.5)))
    negro = Image.new("RGB", (ANCHO, ALTO), CARBON)
    return Image.composite(negro, im, capa)


def envolver(pinta, texto, fnt, ancho_max):
    palabras = texto.split()
    lineas, actual = [], u""
    for p in palabras:
        prueba = (actual + u" " + p).strip()
        if pinta.textlength(prueba, font=fnt) <= ancho_max:
            actual = prueba
        else:
            if actual:
                lineas.append(actual)
            actual = p
    if actual:
        lineas.append(actual)
    return lineas


def marca(pinta):
    u"""Los nueve cuadraditos del logo, dibujados a mano."""
    x0, y0, lado, sep = 64, 56, 9, 13
    for f in range(3):
        for c in range(3):
            x = x0 + c * sep
            y = y0 + f * sep
            pinta.rectangle([x, y, x + lado, y + lado], fill=TERRACOTA)
    pinta.text((x0 + 3 * sep + 12, y0 - 4), u"BLATOS", font=MARCA, fill=HUESO)


def tarjeta(salida, base, titulo, bajada):
    im = velo(recortar(Image.open(os.path.join(IMG, "imaginarios", base)).convert("RGB")))
    pinta = ImageDraw.Draw(im)
    marca(pinta)

    margen = 64
    ancho_max = ANCHO - 2 * margen

    lineas_t = envolver(pinta, titulo, TITULO, ancho_max)
    lineas_b = envolver(pinta, bajada, BAJADA, ancho_max)

    alto_t = len(lineas_t) * 104
    alto_b = len(lineas_b) * 48
    y = ALTO - margen - alto_b - alto_t - 8

    for l in lineas_t:
        pinta.text((margen, y), l, font=TITULO, fill=HUESO)
        y += 104
    y += 8
    for l in lineas_b:
        pinta.text((margen, y), l, font=BAJADA, fill=(225, 214, 198))
        y += 48

    destino = os.path.join(SALIDA, salida)
    im.save(destino, "JPEG", quality=86, optimize=True, progressive=True)
    return destino, os.path.getsize(destino)


def favicon():
    u"""El mismo logo de nueve cuadrados. El SVG lo usan los navegadores
    modernos; el PNG es para iOS, que no acepta SVG como touch icon."""
    svg = (
        u'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">\n'
        u'  <rect width="20" height="20" rx="3" fill="#1c1712"/>\n'
        u'  <g fill="#b05a2a">\n'
    )
    for f in range(3):
        for c in range(3):
            svg += u'    <rect x="%s" y="%s" width="3.6" height="3.6"/>\n' % (
                3.4 + c * 5.4, 3.4 + f * 5.4)
    svg += u'  </g>\n</svg>\n'
    ruta_svg = os.path.join(IMG, "favicon.svg")
    io.open(ruta_svg, "w", encoding="utf-8", newline="\n").write(svg)

    lado = 180
    im = Image.new("RGB", (lado, lado), (28, 23, 18))
    pinta = ImageDraw.Draw(im)
    caja, sep = 32, 48
    origen = (lado - (2 * sep + caja)) // 2
    for f in range(3):
        for c in range(3):
            x = origen + c * sep
            y = origen + f * sep
            pinta.rectangle([x, y, x + caja, y + caja], fill=TERRACOTA)
    ruta_png = os.path.join(IMG, "favicon-180.png")
    im.save(ruta_png, "PNG", optimize=True)
    return ruta_svg, ruta_png


if __name__ == "__main__":
    if not os.path.isdir(SALIDA):
        os.makedirs(SALIDA)
    for args in TARJETAS:
        ruta, peso = tarjeta(*args)
        print("%-52s %6.1f KB" % (os.path.relpath(ruta, RAIZ), peso / 1024.0))
    for r in favicon():
        print(os.path.relpath(r, RAIZ))
