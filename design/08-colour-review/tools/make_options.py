#!/usr/bin/env python3
"""Writes options/A|B|C-*.json — the three colour systems under review (single source for renders + metrics)."""
import json, pathlib
OUT = pathlib.Path(__file__).resolve().parents[1] / "options"

# Council consensus (all three systems): status = ink SHAPE + label, never hue.  ● existe · ◐ dev · ○ projet · ◌ later
SHAPES = """
.status::before{width:11px;height:11px;box-sizing:border-box;border:2px solid var(--color-ink);background:transparent}
.status--now::before{background:var(--color-ink)}
.status--dev::before{background:linear-gradient(90deg,var(--color-ink) 50%,transparent 50%)}
.status--prep::before{}
.status--later::before{border:2px dotted var(--color-ink)}
"""
def checks(paper, ink, ink2, ink3, sigtext, signal, line_strong, extra):
    return [["Body text ink on paper", ink, paper, 4.5], ["Secondary text", ink2, paper, 4.5], ["Captions", ink3, paper, 4.5],
            ["Sodium as text", sigtext, paper, 4.5], ["Focus ring (ink) vs paper", ink, paper, 3],
            ["Sodium strand / plug vs paper (non-text)", signal, paper, 3], ["Input border", line_strong, paper, 3],
            ["White on ink (primary button)", "#FFFFFF", ink, 4.5]] + extra

A = {"name": "A-refined-bobine", "label": "A · Bobine affinée (minimal change)",
 "tokens": {"--focus-ring": "3px solid var(--color-ink)", "--cable-apprendre": "#7A5200", "--cable-apprendre-text": "#7A5200",
            "--cable-organiser": "#8A3FA8", "--cable-organiser-text": "#8A3FA8",
            "--status-now": "var(--color-ink)", "--status-dev": "var(--color-ink)", "--status-prep": "var(--color-ink)", "--status-later": "var(--color-ink)",
            "--poster-bg": "#16163F", "--poster-ink": "#FAFAF7", "--poster-ink-2": "#D2D2E4", "--poster-accent": "#E8590C", "--poster-loop": "#FAFAF7"},
 "extra_css": SHAPES, "logo": {"ink": "#16163F", "signal": "#E8590C"}, "poster": {"logo": "lockup-reverse.svg"},
 "semantic": {"ground": "#FAFAF7", "branches": {"soirees": "#E8590C", "reseau": "#12775A", "organiser": "#8A3FA8", "apprendre": "#7A5200", "tekpractice": "#2E5FE6"},
   "status": {}, "contrast_checks": checks("#FAFAF7", "#16163F", "#4A4A6E", "#6B6B8A", "#B4430A", "#E8590C", "#8E8EA8", [
     ["Réseau cable", "#12775A", "#FAFAF7", 3], ["Organiser cable (prune)", "#8A3FA8", "#FAFAF7", 3], ["Apprendre cable (bronze)", "#7A5200", "#FAFAF7", 3],
     ["TekPractice cable", "#2E5FE6", "#FAFAF7", 3], ["Poster text on ink", "#FAFAF7", "#16163F", 4.5], ["Sodium on ink (poster)", "#E8590C", "#16163F", 3]])}}

NIGHT, NTXT, BRUME, SCLAIR = "#1B1736", "#F4F0EA", "#B9B2CC", "#FF8A4C"
B = {"name": "B-nuit-editoriale", "label": "B · Nuit éditoriale (warmer, cultural)",
 "tokens": {"--color-paper": "#F7F4EE", "--color-surface": "#FFFDF9", "--color-sunken": "#F2EEE7", "--color-ink": NIGHT, "--color-ink-2": "#4D4560",
            "--color-ink-3": "#6B6480", "--color-line": "#E2DCD0", "--color-line-strong": "#8A8399", "--focus-ring": "3px solid var(--color-ink)",
            "--cable-reseau": "#0F6B6B", "--cable-reseau-text": "#0F6B6B", "--cable-organiser": "#B0306A", "--cable-organiser-text": "#B0306A",
            "--cable-apprendre": "#7A5200", "--cable-apprendre-text": "#7A5200",
            "--status-now": "var(--color-ink)", "--status-dev": "var(--color-ink)", "--status-prep": "var(--color-ink)", "--status-later": "var(--color-ink)",
            "--poster-bg": NIGHT, "--poster-ink": NTXT, "--poster-ink-2": BRUME, "--poster-accent": SCLAIR, "--poster-loop": NTXT},
 "extra_css": SHAPES + f"""
.btn-primary:hover{{background:#2C2550}}
.site-footer p{{color:{BRUME}}} .site-footer .fine{{border-top-color:#3A3358}}
/* Soirées = the night: full-bleed Nuit de salle hero, sodium clair as the light source */
.branch-hero[style*="--cable-soirees"]{{background:{NIGHT};color:{NTXT};padding-block:72px;--color-ink:{NTXT};--color-ink-2:{BRUME};--color-ink-3:{BRUME};
  --color-signal:{SCLAIR};--cable:{SCLAIR};--color-line-strong:#7E7699}}
.branch-hero[style*="--cable-soirees"] .btn-primary{{background:{NTXT};color:{NIGHT}}}
.branch-hero[style*="--cable-soirees"] .btn:disabled{{background:#2C2550;color:{BRUME};border-color:#7E7699}}
""", "logo": {"ink": NIGHT, "signal": "#E8590C"}, "poster": {"logo": "lockup-reverse.svg"},
 "semantic": {"ground": "#F7F4EE", "branches": {"soirees": "#E8590C", "reseau": "#0F6B6B", "organiser": "#B0306A", "apprendre": "#7A5200", "tekpractice": "#2E5FE6"},
   "status": {}, "contrast_checks": checks("#F7F4EE", NIGHT, "#4D4560", "#6B6480", "#B4430A", "#E8590C", "#8A8399", [
     ["Sodium vs sunken band", "#E8590C", "#F2EEE7", 3],
     ["Réseau cable (sarcelle)", "#0F6B6B", "#F7F4EE", 3], ["Organiser cable (framboise)", "#B0306A", "#F7F4EE", 3], ["Apprendre cable (bronze)", "#7A5200", "#F7F4EE", 3],
     ["TekPractice cable", "#2E5FE6", "#F7F4EE", 3], ["Night text on Nuit", NTXT, NIGHT, 4.5], ["Brume (secondary) on Nuit", BRUME, NIGHT, 4.5],
     ["Sodium clair on Nuit (text-capable)", SCLAIR, NIGHT, 4.5], ["Sodium on Nuit (logo plug)", "#E8590C", NIGHT, 3]])}}

INK = "#16163F"
PAT = {"soirees": f"linear-gradient({INK},{INK})",
       "reseau": f"linear-gradient({INK} 0 2px,transparent 2px 4px,{INK} 4px 6px)",
       "organiser": f"repeating-linear-gradient(90deg,{INK} 0 16px,transparent 16px 24px)",
       "apprendre": f"repeating-linear-gradient(90deg,{INK} 0 5px,transparent 5px 11px)",
       "tekpractice": f"repeating-linear-gradient(90deg,{INK} 0 18px,transparent 18px 24px,{INK} 24px 29px,transparent 29px 35px)"}
cpat = "".join(f'[style*="--cable-{k}"]{{--pat:{v}}}\n' for k, v in PAT.items())
GUEST, GTXT = "#5B2A4E", "#F4F0EA"
C = {"name": "C-encre-invitee", "label": "C · Encre + couleur invitée (council alternative)",
 "tokens": {"--focus-ring": "3px solid var(--color-ink)", **{f"--cable-{k}": INK for k in PAT}, **{f"--cable-{k}-text": INK for k in PAT},
            "--status-now": "var(--color-ink)", "--status-dev": "var(--color-ink)", "--status-prep": "var(--color-ink)", "--status-later": "var(--color-ink)",
            "--poster-bg": GUEST, "--poster-ink": GTXT, "--poster-ink-2": "#E6D6E0", "--poster-accent": SCLAIR, "--poster-loop": GTXT},
 "extra_css": SHAPES + "/* branch = name + ink cable PATTERN (solid · double · dashed · dotted · dash-dot); colour is reserved for sodium and the one guest colour per event */\n" + cpat + f"""
.door{{border-top:none;padding-top:calc(var(--space-5) + 6px);background:var(--pat,linear-gradient({INK},{INK})) top left/100% 6px no-repeat}}
.branch-hero .cable{{height:6px;width:96px;background:var(--pat,{INK})}}
.board tbody th a{{border-bottom:none;padding-bottom:8px;background:var(--pat,linear-gradient({INK},{INK})) bottom left/100% 6px no-repeat}}
""", "logo": {"ink": INK, "signal": "#E8590C"}, "poster": {"logo": "lockup-reverse.svg"},
 "semantic": {"ground": "#FAFAF7", "branches": {}, "status": {}, "contrast_checks": checks("#FAFAF7", INK, "#4A4A6E", "#6B6B8A", "#B4430A", "#E8590C", "#8E8EA8", [
     ["Ink cable patterns vs paper", INK, "#FAFAF7", 3], ["Guest text on guest (Prune invitée)", GTXT, GUEST, 4.5], ["Guest secondary", "#E6D6E0", GUEST, 4.5],
     ["Sodium clair on guest (accent)", SCLAIR, GUEST, 3], ["Sodium on ink (dark mode plug)", "#E8590C", INK, 3]])}}

for o in (A, B, C):
    (OUT / f"{o['name']}.json").write_text(json.dumps(o, indent=1, ensure_ascii=False)); print("wrote", o["name"])

# ── Council recommendation (post round 2): C frame, native border patterns, Soirées night ground, focus colour per ground ──
NAT = {"soirees": "solid", "reseau": "double", "organiser": "dashed", "apprendre": "dotted", "tekpractice": "dotted"}
nat = "".join(f'[style*="--cable-{k}"]{{--cable-style:{v}}}\n' for k, v in NAT.items())
FORCED = """
@media (forced-colors: active){.status::before{forced-color-adjust:none;border-color:CanvasText}
 .status--now::before{background:CanvasText}.status--dev::before{background:linear-gradient(90deg,CanvasText 50%,transparent 50%)}}
"""
R = {"name": "R-recommended-hybrid", "label": "R · Council hybrid (C frame + night Soirées)",
 "tokens": {"--focus-color": INK, "--focus-ring": "3px solid var(--focus-color)", **{f"--cable-{k}": INK for k in PAT}, **{f"--cable-{k}-text": INK for k in PAT},
            "--signal-on-dark": SCLAIR,
            "--status-now": "var(--color-ink)", "--status-dev": "var(--color-ink)", "--status-prep": "var(--color-ink)", "--status-later": "var(--color-ink)",
            "--poster-bg": INK, "--poster-ink": "#FAFAF7", "--poster-ink-2": "#D2D2E4", "--poster-accent": SCLAIR, "--poster-loop": "#FAFAF7"},
 "extra_css": SHAPES + FORCED + "/* branch = name + NATIVE border style (survives forced colours, zoom, one-colour print). Implementation: data-branch, not [style*=] */\n" + nat + f"""
.door{{border-top:5px var(--cable-style,solid) {INK}}}
.branch-hero .cable{{height:0;width:96px;background:none;border-top:5px var(--cable-style,solid) {INK}}}
.board tbody th a{{border-bottom:4px var(--cable-style,solid) {INK};padding-bottom:4px}}
.signup{{border-top:5px var(--cable-style,solid) {INK}}}
.site-footer{{--focus-color:#FAFAF7}}
.branch-hero[style*="--cable-soirees"]{{background:{INK};color:#FAFAF7;padding-block:72px;--focus-color:#FAFAF7;--color-ink:#FAFAF7;--color-ink-2:#D2D2E4;--color-ink-3:#D2D2E4;--color-signal:{SCLAIR}}}
.branch-hero[style*="--cable-soirees"] .cable{{border-top-color:{SCLAIR}}}
""", "logo": {"ink": INK, "signal": "#E8590C"}, "poster": {"logo": "lockup-reverse.svg"},
 "semantic": {"ground": "#FAFAF7", "branches": {}, "status": {}, "contrast_checks": checks("#FAFAF7", INK, "#4A4A6E", "#6B6B8A", "#B4430A", "#E8590C", "#8E8EA8", [
     ["Focus ring on footer (paper colour on ink)", "#FAFAF7", INK, 3], ["Text on night (Soirées hero)", "#FAFAF7", INK, 4.5], ["Secondary on night", "#D2D2E4", INK, 4.5],
     ["Sodium clair on night (text-capable)", SCLAIR, INK, 4.5], ["Sodium on night (logo plug)", "#E8590C", INK, 3]])}}
(OUT / f"{R['name']}.json").write_text(json.dumps(R, indent=1, ensure_ascii=False)); print("wrote", R["name"])
