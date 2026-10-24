#!/usr/bin/env python3
"""Build the Tekonest umbrella prototype: shared layout + page fragments → static HTML.
Stdlib only. Run from anywhere:  python3 website-prototype/src/build.py
French typography: a narrow no-break space (U+202F) is inserted before ; : ! ? and inside « »
in text content (never inside tags)."""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = ROOT / "src" / "pages"

NAV = [
    ("apprendre.html", "Apprendre"),
    ("tekpractice.html", "TekPractice"),
    ("organiser.html", "Créer avec nous"),
    ("reseau.html", "Réseau"),
    ("histoire.html", "L'histoire"),
    ("contact.html", "Contact"),
]

LAYOUT = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="robots" content="noindex">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/css/tokens.css">
<link rel="stylesheet" href="assets/css/site.css">
<script src="assets/js/site.js"></script>
</head>
<body>
<a class="skip" href="#contenu">Aller au contenu</a>
<div class="proto-banner"><div class="wrap"><p>Prototype de site (brouillon). Rien n'est en vente et aucune donnée n'est collectée.</p></div></div>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="index.html"><img src="assets/img/lockup.svg" alt="Tekonest, accueil" width="150" height="32"></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav id="site-nav" class="site-nav" aria-label="Navigation principale">
      <ul>
{nav}
      </ul>
    </nav>
  </div>
</header>
<main id="contenu">
{content}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div>
      <img src="assets/img/lockup-reverse.svg" alt="Tekonest" width="140" height="30">
      <p>Un nid pour les cultures et les métiers du son : se former, créer ensemble, rejoindre un réseau payé correctement.</p>
    </div>
    <nav aria-label="Pied de page">
      <ul>
{footnav}
        <li><a href="accessibilite.html">Accessibilité</a></li>
      </ul>
    </nav>
    <p class="fine">Prototype de conception, 22 octobre 2026. Tekonest n'a pas encore de structure juridique ; les services marqués « en préparation », « en développement » ou « en réflexion » ne sont pas proposés aujourd'hui. Polices : Tektur et IBM Plex Sans (licence SIL OFL 1.1), hébergées sur ce site. Motifs inspirés de la marqueterie de Damas.</p>
  </div>
</footer>
</body>
</html>
"""

def nav_items(current, indent="        "):
    out = []
    for href, label in NAV:
        cur = ' aria-current="page"' if href == current else ""
        out.append(f'{indent}<li><a href="{href}"{cur}>{label}</a></li>')
    return "\n".join(out)

NNBSP = " "

def french_typography(html):
    """Insert narrow no-break spaces in text nodes only."""
    parts = re.split(r"(<[^>]+>)", html)
    for i, p in enumerate(parts):
        if p.startswith("<"):
            continue
        p = re.sub(r"\s+([;:!?»])", NNBSP + r"\1", p)
        p = re.sub(r"«\s*", "«" + NNBSP, p)
        parts[i] = p
    return "".join(parts)

def build():
    for frag in sorted(PAGES.glob("*.html")):
        text = frag.read_text(encoding="utf-8").replace("&#8239;", " ")
        m = re.match(r"<!--\s*title:\s*(.*?)\s*\|\s*description:\s*(.*?)\s*-->\s*", text, re.S)
        title, desc = m.group(1), m.group(2)
        content = text[m.end():]
        # typography on the content and the footer text (not on <head>)
        html = LAYOUT.format(title=title, description=desc, nav=nav_items(frag.name),
                             footnav=nav_items(None, "        "), content=content)
        head, body = html.split("<body>", 1)
        html = head + "<body>" + french_typography(body)
        (ROOT / frag.name).write_text(html, encoding="utf-8")
        print("built", frag.name)

if __name__ == "__main__":
    build()
