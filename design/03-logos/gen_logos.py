"""Generate the three Tekonest logo concepts as editable SVG (outlined type, no font dependency)."""
import math, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONTS = "/root/.claude/skills/synced/7c3885f0-f7bf-4d0c-a25b-1d5fc8d37f5f_5afd5e2f-8f9b-4c17-b5fc-fccaff5214a2/canvas-design/canvas-fonts"
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

INK = "#16163F"      # encre de nuit
SODIUM = "#E8590C"   # lampe sodium
PAPER = "#FAFAF7"


def text_path(font_file, text, size, x0=0.0, y_base=0.0, tracking=0.0, skip=()):
    """Return (svg path d, advance width, positions) for text set at `size` px, baseline y_base."""
    f = TTFont(os.path.join(FONTS, font_file))
    gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm
    s = size / upm
    x = x0; ds = []; pos = []
    for i, ch in enumerate(text):
        g = cmap[ord(ch)]
        adv = f["hmtx"][g][0] * s
        pos.append((x, adv))
        if i not in skip:
            pen = SVGPathPen(gs)
            tp = TransformPen(pen, (s, 0, 0, -s, x, y_base))
            gs[g].draw(tp)
            ds.append(pen.getCommands())
        x += adv + tracking * size
    return " ".join(ds), x - x0 - tracking * size, pos


def arc_point(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def coil(cx, cy, scale=1.0, sw=4.2, color=INK, accent=SODIUM, tail=True, loops=3):
    """Bobine: a cable coil hanging from one point (the hook). Loops of decreasing size share
    the top point, so the form reads as a coil and as a nest bowl. The tail leaves from the hook."""
    R = [21 * scale, 15.5 * scale, 10 * scale][:loops]
    top = cy - R[0]                      # common tangent point (the hook)
    parts = []
    for i, r in enumerate(R):
        c = top + r
        if i == 0 and tail:
            # outer loop open at the hook so the tail can leave it
            x1, y1 = cx + r * math.sin(math.radians(28)), c - r * math.cos(math.radians(28))
            parts.append(f'<path d="M{x1:.2f} {y1:.2f} A{r:.2f} {r:.2f} 0 1 1 {cx:.2f} {top:.2f}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round"/>')
        else:
            parts.append(f'<circle cx="{cx:.2f}" cy="{c:.2f}" r="{r:.2f}" fill="none" stroke="{color}" stroke-width="{sw}"/>')
    if tail:
        ex, ey = cx + 30 * scale, top + 4 * scale
        parts.append(f'<path d="M{cx:.2f} {top:.2f} C{cx+10*scale:.2f} {top-2*scale:.2f} {ex-10*scale:.2f} {ey-8*scale:.2f} {ex:.2f} {ey:.2f}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round"/>')
        parts.append(f'<circle cx="{ex:.2f}" cy="{ey:.2f}" r="{3.6*scale:.2f}" fill="{accent}"/>')
    return "\n  ".join(parts)


def svg(w, h, body, title, desc=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-labelledby="t">\n'
            f'  <title id="t">{title}</title>\n' + (f'  <desc>{desc}</desc>\n' if desc else "") + f'  {body}\n</svg>\n')


def write(name, content):
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(content)

DRAFT = "Draft concept, pending founder review (2026-10-22)."

# ───────────────────────── A. BOBINE ─────────────────────────
def bobine(color, accent, suffix):
    # symbol
    write(f"a-bobine/symbol{suffix}.svg", svg(64, 64, coil(24, 36, 1.0, 4.2, color, accent), "Tekonest — symbole Bobine", DRAFT))
    # favicon: two loops, thicker stroke, no tail
    write(f"a-bobine/favicon{suffix}.svg", svg(32, 32, coil(16, 16, 0.66, 3.2, color, accent, tail=False, loops=2), "Tekonest", DRAFT))
    # wordmark: tekonest, the "o" replaced by a small coil
    size = 64
    d, adv, pos = text_path("BricolageGrotesque-Bold.ttf", "tekonest", size, 0, 52, tracking=-0.02, skip=(3,))
    ox, oadv = pos[3]
    ring = coil(ox + oadv / 2, 52 - 15.5, 0.70, 5.6, color, accent, tail=False, loops=2)
    body = f'<path d="{d}" fill="{color}"/>\n  {ring}'
    write(f"a-bobine/wordmark{suffix}.svg", svg(adv + 2, 68, body, "Tekonest", DRAFT))
    # lockup: symbol + wordmark
    sym = coil(28, 37, 1.15, 4.8, color, accent)
    d2, adv2, pos2 = text_path("BricolageGrotesque-Bold.ttf", "tekonest", 56, 92, 52, tracking=-0.02)
    write(f"a-bobine/lockup{suffix}.svg", svg(92 + adv2 + 8, 72, f'{sym}\n  <path d="{d2}" fill="{color}"/>', "Tekonest", DRAFT))

bobine(INK, SODIUM, "")
bobine("#000000", "#000000", "-mono")
bobine("#FFFFFF", SODIUM, "-reverse")

# ───────────────────────── B. JONCTION ─────────────────────────
def jonction_symbol(cx, cy, s, color, accent, sw):
    strands = [(-26, 0), (13, -22.5), (13, 22.5)]   # three strands arriving from three directions
    out = []
    for (ex, ey) in strands:
        x2, y2 = cx + ex * s, cy + ey * s
        mx, my = cx + ex * s * 0.5 + ey * s * 0.18, cy + ey * s * 0.5 - ex * s * 0.18
        out.append(f'<path d="M{cx:.2f} {cy:.2f} Q{mx:.2f} {my:.2f} {x2:.2f} {y2:.2f}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round"/>')
        out.append(f'<circle cx="{x2:.2f}" cy="{y2:.2f}" r="{3.2*s:.2f}" fill="{color}"/>')
    out.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{8*s:.2f}" fill="{accent}"/>')
    return "\n  ".join(out)

def jonction(color, accent, suffix):
    write(f"b-jonction/symbol{suffix}.svg", svg(64, 64, jonction_symbol(34, 32, 1.0, color, accent, 4.2), "Tekonest — symbole Jonction", DRAFT))
    write(f"b-jonction/favicon{suffix}.svg", svg(32, 32, jonction_symbol(17, 16, 0.5, color, accent, 3.2), "Tekonest", DRAFT))
    d, adv, _ = text_path("BigShoulders-Bold.ttf", "TEKONEST", 64, 0, 56, tracking=0.02)
    write(f"b-jonction/wordmark{suffix}.svg", svg(adv + 2, 64, f'<path d="{d}" fill="{color}"/>', "Tekonest", DRAFT))
    sym = jonction_symbol(36, 36, 1.1, color, accent, 4.6)
    d2, adv2, _ = text_path("BigShoulders-Bold.ttf", "TEKONEST", 58, 84, 58, tracking=0.02)
    write(f"b-jonction/lockup{suffix}.svg", svg(84 + adv2 + 6, 72, f'{sym}\n  <path d="{d2}" fill="{color}"/>', "Tekonest", DRAFT))

jonction(INK, SODIUM, "")
jonction("#000000", "#000000", "-mono")
jonction("#FFFFFF", "#FFB547", "-reverse")

# ───────────────────────── C. ÉTIQUETTE ─────────────────────────
def tag(x, y, s, color, accent, paper, sw):
    w, h, r = 52 * s, 34 * s, 7 * s
    hole = (x + 10 * s, y + h / 2)
    tdesc, tadv, _ = text_path("IBMPlexMono-Bold.ttf", "tk", 20 * s, 0, 0)
    tx = x + 19 * s; ty = y + h / 2 + 7 * s
    d, _, _ = text_path("IBMPlexMono-Bold.ttf", "tk", 20 * s, tx, ty)
    return "\n  ".join([
        f'<path d="M{x-14*s:.2f} {hole[1]:.2f} H{hole[0]:.2f}" stroke="{accent}" stroke-width="{sw}" stroke-linecap="round"/>',
        f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" rx="{r:.2f}" fill="{color}"/>',
        f'<circle cx="{hole[0]:.2f}" cy="{hole[1]:.2f}" r="{3.4*s:.2f}" fill="{paper}"/>',
        f'<path d="{d}" fill="{paper}"/>',
    ])

def etiquette(color, accent, paper, suffix):
    write(f"c-etiquette/symbol{suffix}.svg", svg(64, 64, tag(10, 15, 1.0, color, accent, paper, 3.6), "Tekonest — symbole Étiquette", DRAFT))
    write(f"c-etiquette/favicon{suffix}.svg", svg(32, 32, f'<rect x="1" y="6" width="30" height="20" rx="4.5" fill="{color}"/><circle cx="7" cy="16" r="2.4" fill="{paper}"/>' + text_path("IBMPlexMono-Bold.ttf", "tk", 13, 11.5, 20.5)[0].join(['<path fill="%s" d="' % paper, '"/>']), "Tekonest", DRAFT))
    d, adv, _ = text_path("InstrumentSans-Bold.ttf", "tekonest", 64, 0, 50, tracking=-0.015)
    write(f"c-etiquette/wordmark{suffix}.svg", svg(adv + 2, 66, f'<path d="{d}" fill="{color}"/>', "Tekonest", DRAFT))
    t = tag(18, 19, 1.0, color, accent, paper, 3.6)
    d2, adv2, _ = text_path("InstrumentSans-Bold.ttf", "tekonest", 52, 82, 52, tracking=-0.015)
    write(f"c-etiquette/lockup{suffix}.svg", svg(82 + adv2 + 6, 72, f'{t}\n  <path d="{d2}" fill="{color}"/>', "Tekonest", DRAFT))

etiquette(INK, SODIUM, PAPER, "")
etiquette("#000000", "#000000", "#FFFFFF", "-mono")
etiquette("#FFFFFF", "#FFB547", INK, "-reverse")
print("ok")
