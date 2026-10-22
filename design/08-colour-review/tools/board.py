#!/usr/bin/env python3
"""Compose comparison boards from renders/<option>/*.png.
usage: python3 board.py <rendersDir> <outDir> <option> [<option> ...]
Writes: comparison-board.png (all views × options), vision-board.png (semantics strip under
normal / protan / deutan / tritan / grayscale), one board per option."""
import sys, pathlib, numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = "/root/.claude/skills/synced/7c3885f0-f7bf-4d0c-a25b-1d5fc8d37f5f_5afd5e2f-8f9b-4c17-b5fc-fccaff5214a2/canvas-design/canvas-fonts/InstrumentSans-Bold.ttf"
FONT_R = FONT.replace("Bold", "Regular")
VIEWS = [("1-desktop-hero.png", "Desktop: hero + doors", 1.0), ("2-mobile-hero.png", "Mobile: hero + doors", 1.0),
         ("3-events.png", "Events page", 1.0), ("4-learning.png", "Learning / TekPractice", 1.0), ("5-poster.png", "Poster / social 4:5", 1.0)]
M = {'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
     'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
     'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]}

def font(size, bold=True): return ImageFont.truetype(FONT if bold else FONT_R, size)

def simulate(img, kind):
    a = np.asarray(img.convert("RGB")).astype(np.float64) / 255
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    if kind == "grayscale":
        y = lin @ np.array([0.2126, 0.7152, 0.0722]); out = np.stack([y, y, y], -1)
    else:
        out = lin @ np.array(M[kind]).T
    out = np.clip(out, 0, 1)
    srgb = np.where(out <= 0.0031308, 12.92 * out, 1.055 * out ** (1 / 2.4) - 0.055)
    return Image.fromarray((srgb * 255).round().astype(np.uint8))

def fit(img, w, h):
    im = img.copy(); im.thumbnail((w, h), Image.LANCZOS)
    canvas = Image.new("RGB", (w, h), (238, 238, 234)); canvas.paste(im, ((w - im.width) // 2, 0)); return canvas

def labels_for(rd, opt):
    p = rd / opt / "label.txt"; return p.read_text().strip() if p.exists() else opt

def comparison(rd, out, opts):
    cw = [560, 240, 520, 560, 380]; ch = 520; pad = 28; head = 64; left = 300
    W = left + sum(cw) + pad * (len(cw) + 1); H = head + (ch + pad) * len(opts) + pad + 60
    board = Image.new("RGB", (W, H), (250, 250, 247)); d = ImageDraw.Draw(board)
    d.text((pad, 18), "Tekonest — colour review: same pages, same type, same logo geometry; only colour changes", font=font(26), fill=(22, 22, 63))
    x = left + pad
    for (f, t, _), w in zip(VIEWS, cw):
        d.text((x, head - 6), t, font=font(18, False), fill=(74, 74, 110)); x += w + pad
    y = head + 24
    for o in opts:
        d.text((pad, y + 8), labels_for(rd, o), font=font(22), fill=(22, 22, 63))
        x = left + pad
        for (f, _, _), w in zip(VIEWS, cw):
            board.paste(fit(Image.open(rd / o / f), w, ch), (x, y)); x += w + pad
        y += ch + pad
    d.text((pad, H - 40), "Renders: Chromium via Playwright, reduced motion. Crops scaled to fit; full-size renders in renders/<option>/.", font=font(16, False), fill=(107, 107, 138))
    board.save(out / "comparison-board.png", optimize=True)

def vision(rd, out, opts):
    kinds = ["normal", "protan", "deutan", "tritan", "grayscale"]; cw, chh, pad, left, head = 470, 330, 22, 300, 96
    W = left + (cw + pad) * len(kinds) + pad; H = head + (chh + pad) * len(opts) + 40
    board = Image.new("RGB", (W, H), (250, 250, 247)); d = ImageDraw.Draw(board)
    d.text((pad, 18), "Status table + branch cables under colour-vision deficiencies (Machado 2009, severity 1.0) and grayscale", font=font(24), fill=(22, 22, 63))
    for i, k in enumerate(kinds): d.text((left + pad + i * (cw + pad), head - 26), k, font=font(18, False), fill=(74, 74, 110))
    y = head
    for o in opts:
        d.text((pad, y + 8), labels_for(rd, o), font=font(20), fill=(22, 22, 63))
        src = Image.open(rd / o / "6-semantics.png").convert("RGB")
        src = src.crop((110, 300, 690, 720))
        for i, k in enumerate(kinds):
            im = src if k == "normal" else simulate(src, k)
            board.paste(fit(im, cw, chh), (left + pad + i * (cw + pad), y))
        y += chh + pad
    board.save(out / "vision-board.png", optimize=True)

if __name__ == "__main__":
    rd, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]); opts = sys.argv[3:]
    out.mkdir(parents=True, exist_ok=True); comparison(rd, out, opts); vision(rd, out, opts); print("boards written")
