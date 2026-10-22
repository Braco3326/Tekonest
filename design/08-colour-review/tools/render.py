#!/usr/bin/env python3
"""Colour review harness: renders the SAME prototype pages with one palette override per option.
The real prototype and its tokens are never modified: the site is copied to a scratch folder,
an override stylesheet is appended, and the logo SVGs are recoloured in the copy only.

usage: python3 render.py <option.json> <scratchDir> <outDir> <node_modules_dir>
"""
import json, os, re, shutil, subprocess, sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parents[2] / "website-prototype"

POSTER = """<!doctype html><html lang="fr"><head><meta charset="utf-8">
<link rel="stylesheet" href="assets/css/tokens.css"><link rel="stylesheet" href="assets/css/site.css"><link rel="stylesheet" href="assets/css/option.css">
<style>
body{margin:0}
.poster{width:1080px;height:1350px;box-sizing:border-box;padding:88px;display:flex;flex-direction:column;justify-content:space-between;
  background:var(--poster-bg);color:var(--poster-ink);font-family:var(--font-text);position:relative;overflow:hidden}
.poster .cable{width:120px;height:6px;border-radius:3px;background:var(--poster-accent)}
.poster h1{font-family:var(--font-display);font-weight:700;font-size:100px;line-height:.98;letter-spacing:-.035em;margin:0;max-width:11ch;color:var(--poster-ink)}
.poster .sub{font-size:34px;line-height:1.3;max-width:20ch;margin:28px 0 0;color:var(--poster-ink-2)}
.poster .meta{display:flex;justify-content:space-between;align-items:flex-end;font-size:26px;color:var(--poster-ink)}
.poster .tag{display:inline-flex;align-items:center;gap:14px;font-weight:600}
.poster .tag::before{content:"";width:16px;height:16px;border-radius:50%;border:3px solid var(--poster-ink)}
.poster svg.coil{position:absolute;right:70px;top:170px;width:420px;height:420px}
.poster svg.coil .loop{fill:none;stroke:var(--poster-loop);stroke-width:1.1}
.poster svg.coil .strand{fill:none;stroke:var(--poster-accent);stroke-width:1.1;stroke-linecap:round}
.poster svg.coil .plug{fill:var(--poster-accent)}
.poster img{height:56px;width:auto}
</style></head><body>
<div class="poster">
  <div style="display:flex;justify-content:space-between;align-items:center"><img src="assets/img/{logo}" alt="Tekonest"><span class="tag">Soirée pilote en projet</span></div>
  <svg class="coil" viewBox="0 0 64 64" aria-hidden="true"><circle class="loop" cx="30" cy="37.5" r="21"/><circle class="loop" cx="30" cy="32" r="15.5"/><circle class="loop" cx="30" cy="26.5" r="10"/><path class="strand" d="M30 16.5 C40 14.5 50 16 59 21.5"/><circle class="plug" cx="59" cy="21.5" r="1.6"/></svg>
  <div><div class="cable"></div><h1 style="margin-top:36px">Musiques arabes, afro et électroniques.</h1><p class="sub">Soirées métissées à Paris, réseau créatif équitable.</p></div>
  <div class="meta"><span>Paris · date à venir</span><span>tekonest</span></div>
</div></body></html>"""


def main(spec_path, scratch, out, node_modules):
    spec = json.load(open(spec_path))
    name = spec["name"]
    dst = pathlib.Path(scratch) / name
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(SITE, dst, ignore=shutil.ignore_patterns("src"))
    # override stylesheet
    css = ":root{\n" + "".join(f"  {k}: {v};\n" for k, v in spec["tokens"].items()) + "}\n" + spec.get("extra_css", "")
    (dst / "assets/css/option.css").write_text(css)
    for html in dst.glob("*.html"):
        t = html.read_text()
        t = t.replace('<link rel="stylesheet" href="assets/css/site.css">',
                      '<link rel="stylesheet" href="assets/css/site.css">\n<link rel="stylesheet" href="assets/css/option.css">')
        html.write_text(t)
    # recolour logos in the copy only (geometry unchanged)
    lg = spec["logo"]
    for svgf in (dst / "assets/img").glob("*.svg"):
        t = svgf.read_text()
        t = t.replace("#16163F", lg["ink"]).replace("#E8590C", lg["signal"])
        svgf.write_text(t)
    logo = spec["poster"].get("logo", "lockup-reverse.svg")
    (dst / "poster.html").write_text(POSTER.replace("{logo}", logo))
    os.makedirs(out, exist_ok=True)
    env = dict(os.environ, NODE_PATH=node_modules)
    subprocess.run(["node", str(HERE / "views.js"), str(dst), out], check=True, env=env)
    print("rendered", name)

if __name__ == "__main__":
    main(*sys.argv[1:5])
