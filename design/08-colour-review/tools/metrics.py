#!/usr/bin/env python3
"""Colour metrics for one option: WCAG contrast, colour-vision-deficiency confusions, grayscale.
usage: python3 metrics.py <option.json> [<option.json> ...]  → prints Markdown

CVD simulation: Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear sRGB.
Distances: CIE76 ΔE in CIELAB (D65). A pair under ΔE 12 is flagged as "hard to tell apart".
"""
import json, sys, itertools

def hex2rgb(h): h = h.lstrip('#'); return [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
def lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def unlin(c): c = max(0, min(1, c)); return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
def lum(h): r, g, b = (lin(c) for c in hex2rgb(h)); return 0.2126 * r + 0.7152 * g + 0.0722 * b
def cr(a, b): la, lb = lum(a), lum(b); return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

M = {  # Machado 2009, severity 1.0
 'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
 'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
 'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}
def sim(h, kind):
    if kind == 'normal': return h
    r = [lin(c) for c in hex2rgb(h)]
    o = [sum(M[kind][i][j] * r[j] for j in range(3)) for i in range(3)]
    return '#' + ''.join(f'{round(unlin(c) * 255):02X}' for c in o)

def lab(h):
    r, g, b = (lin(c) for c in hex2rgb(h))
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = (0.2126 * r + 0.7152 * g + 0.0722 * b)
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)
def de(a, b): return sum((p - q) ** 2 for p, q in zip(lab(a), lab(b))) ** 0.5

def report(spec):
    s = spec['semantic']; ground = s['ground']; out = [f"### {spec['label']}\n"]
    out.append("| Pair (fg on bg) | Ratio | Needs | Pass |\n| --- | --- | --- | --- |")
    for name, fg, bg, need in s['contrast_checks']:
        r = cr(fg, bg); out.append(f"| {name} (`{fg}` on `{bg}`) | {r:.2f}:1 | {need}:1 | {'✅' if r >= need else '❌'} |")
    groups = {'branch': s['branches'], 'status': s.get('status', {})}
    items = [(f"{g}:{k}", v) for g, d in groups.items() for k, v in d.items()]
    out.append("\n**Hard-to-tell-apart pairs (ΔE < 12) among branch and status colours**\n")
    out.append("| Vision | Pairs |\n| --- | --- |")
    for kind in ['normal', 'protan', 'deutan', 'tritan']:
        bad = [f"{a[0]}↔{b[0]} ({de(sim(a[1], kind), sim(b[1], kind)):.0f})" for a, b in itertools.combinations(items, 2)
               if a[1] != b[1] and de(sim(a[1], kind), sim(b[1], kind)) < 12]
        same = [f"{a[0]}={b[0]}" for a, b in itertools.combinations(items, 2) if a[1].upper() == b[1].upper()]
        txt = ", ".join(bad) or "none"
        if kind == 'normal' and same: txt += " · **identical:** " + ", ".join(same)
        out.append(f"| {kind} | {txt} |")
    out.append("\n**Grayscale lightness (L\\*)** — " + ", ".join(f"{k} {lab(v)[0]:.0f}" for k, v in items) + f" · ground {lab(ground)[0]:.0f}\n")
    return "\n".join(out)

if __name__ == "__main__":
    print("\n\n".join(report(json.load(open(p))) for p in sys.argv[1:]))
