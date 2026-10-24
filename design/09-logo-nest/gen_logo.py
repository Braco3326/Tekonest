#!/usr/bin/env python3
"""Tekonest logo L4 'Tressage' — chosen 24 Oct 2026. Generates the master SVGs (text outlined from Tektur Medium, OFL)."""
import math, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
INK, PAPER = "#141414", "#F4F1EA"
FONT = sys.argv[1] if len(sys.argv) > 1 else "Tektur-Medium.ttf"
CX, CY = 150, 125

def nest(col, sw=4.5):
    out = []
    for i in range(7):
        rot = i * 360 / 7
        ox, oy = CX + 8 * math.cos(math.radians(rot)), CY + 8 * math.sin(math.radians(rot))
        out.append(f'<ellipse cx="{ox:.2f}" cy="{oy:.2f}" rx="100" ry="82" transform="rotate({rot:.2f} {ox:.2f} {oy:.2f})" fill="none" stroke="{col}" stroke-width="{sw}"/>')
    return "".join(out)

def word(text, size, cx, baseline, col, tracking=-1):
    f = TTFont(FONT); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm
    s = size / upm; names = [cmap[ord(c)] for c in text]
    width = sum(f["hmtx"][n][0] * s + tracking for n in names) - tracking
    x = cx - width / 2; paths = []
    for n in names:
        pen = SVGPathPen(gs)
        gs[n].draw(TransformPen(pen, (s, 0, 0, -s, x, baseline)))
        paths.append(pen.getCommands()); x += f["hmtx"][n][0] * s + tracking
    return f'<path d="{" ".join(paths)}" fill="{col}"/>'

def svg(w, h, body, vb, bg=None):
    b = f'<rect x="{vb[0]}" y="{vb[1]}" width="{vb[2]}" height="{vb[3]}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{" ".join(map(str, vb))}">{b}{body}</svg>\n'

files = {
 "tekonest-lockup.svg": svg(600, 660, nest(INK) + word("tekonest", 46, 150, 304, INK), (0, 0, 300, 330)),
 "tekonest-lockup-reverse.svg": svg(600, 660, nest(PAPER) + word("tekonest", 46, 150, 304, PAPER), (0, 0, 300, 330), INK),
 "tekonest-mark.svg": svg(512, 512, nest(INK), (20, -5, 260, 260)),
 "tekonest-mark-reverse.svg": svg(512, 512, nest(PAPER), (20, -5, 260, 260), INK),
 "tekonest-favicon.svg": svg(64, 64, nest(INK, 9), (20, -5, 260, 260)),
 "tekonest-wordmark.svg": svg(560, 90, word("tekonest", 46, 140, 34, INK), (0, 0, 280, 45)),
}
for name, data in files.items(): open(name, "w").write(data)
print("wrote", ", ".join(files))
