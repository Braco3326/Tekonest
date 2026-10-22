import os, sys
F = "file:///root/.claude/skills/synced/7c3885f0-f7bf-4d0c-a25b-1d5fc8d37f5f_5afd5e2f-8f9b-4c17-b5fc-fccaff5214a2/canvas-design/canvas-fonts"
OUT = sys.argv[1]; LOGO = "../../03-logos"
os.makedirs(OUT, exist_ok=True)
FACES = "".join(f"@font-face{{font-family:'{n}';src:url('{F}/{f}');font-weight:{w}}}" for n, f, w in [
    ("Bricolage", "BricolageGrotesque-Bold.ttf", 700), ("Bricolage", "BricolageGrotesque-Regular.ttf", 400),
    ("BigShoulders", "BigShoulders-Bold.ttf", 700), ("Instrument", "InstrumentSans-Regular.ttf", 400),
    ("Instrument", "InstrumentSans-Bold.ttf", 700), ("Plex", "IBMPlexSerif-Regular.ttf", 400),
    ("PlexMono", "IBMPlexMono-Regular.ttf", 400), ("PlexMono", "IBMPlexMono-Bold.ttf", 700)])

def swatches(cols, ink):
    return "".join(f'<div style="display:flex;flex-direction:column;gap:6px;width:92px"><div style="height:56px;border-radius:6px;background:{h};box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)"></div><div style="font:12px/1.3 Instrument;color:{ink}">{n}<br><span style="opacity:.7">{h}</span></div></div>' for n, h in cols)

def branches(items, ink, font):
    return "".join(f'<div style="display:flex;align-items:center;gap:10px;font:15px {font};color:{ink}"><span style="width:28px;height:4px;border-radius:2px;background:{c}"></span>{n}</div>' for n, c in items)

def page(bg, ink, body):
    return f"<!doctype html><meta charset=utf-8><style>{FACES}body{{margin:0}}*{{box-sizing:border-box}}</style><div style='width:1600px;height:1000px;background:{bg};color:{ink};position:relative;overflow:hidden'>{body}</div>"

# ── A. Bobine ──
A_br = [("Soirées", "#E8590C"), ("Réseau", "#12775A"), ("Organisateurs", "#6A4BC4"), ("Apprendre", "#E8A33D"), ("TekPractice", "#2E5FE6")]
a = page("#FAFAF7", "#16163F", f"""
<div style="position:absolute;left:72px;top:64px;right:640px;bottom:64px;display:flex;flex-direction:column;justify-content:space-between">
  <img src="{LOGO}/a-bobine/lockup.svg" style="height:40px;align-self:flex-start">
  <div>
    <div style="font:700 92px/0.98 Bricolage;letter-spacing:-0.035em;max-width:820px">Un nid pour les cultures et les métiers du son.</div>
    <div style="font:400 22px/1.45 Instrument;max-width:640px;margin-top:28px;color:#3D3D63">Soirées métissées à Paris, réseau créatif équitable, outils pour apprendre le son.</div>
  </div>
  <div style="display:flex;gap:16px">
    {''.join(f'<div style="flex:1;border-top:3px solid {c};padding-top:14px;font:700 20px Bricolage">{t}<div style="font:400 14px/1.4 Instrument;color:#4A4A6E;margin-top:6px">{s}</div></div>' for t,s,c in [("Venir aux soirées","Pilote en préparation","#E8590C"),("Rejoindre le réseau","Artistes, techniciennes et techniciens","#12775A"),("Organiser avec nous","Plus tard — besoins recueillis","#6A4BC4")])}
  </div>
</div>
<svg style="position:absolute;right:60px;top:120px" width="520" height="520" viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="30" cy="37.5" r="21" fill="none" stroke="#16163F" stroke-width="1.1"/><circle cx="30" cy="32" r="15.5" fill="none" stroke="#16163F" stroke-width="1.1"/><circle cx="30" cy="26.5" r="10" fill="none" stroke="#16163F" stroke-width="1.1"/>
  <path d="M30 16.5 C40 14.5 50 16 60 22" fill="none" stroke="#E8590C" stroke-width="1.1" stroke-linecap="round"/>
</svg>
<div style="position:absolute;right:64px;bottom:64px;width:520px;display:flex;flex-direction:column;gap:18px">
  <div style="display:flex;gap:10px">{swatches([("Papier","#FAFAF7"),("Encre de nuit","#16163F"),("Sodium","#E8590C"),("Sodium texte","#B4430A")],"#16163F")}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px">{branches(A_br,"#16163F","Instrument")}</div>
</div>
<div style="position:absolute;left:72px;bottom:24px;font:12px Instrument;color:#6B6B8A">Direction A · Bobine · Bricolage Grotesque + IBM Plex Sans · brouillon</div>
""")
# ── B. Nuit ouverte ──
B_br = [("Soirées", "#FFB547"), ("Réseau", "#7CE0B8"), ("Organisateurs", "#B9A6FF"), ("Apprendre", "#FFD27A"), ("TekPractice", "#8FB2FF")]
b = page("#15122B", "#F4F0FF", f"""

<div style="position:absolute;left:72px;top:64px"><img src="{LOGO}/b-jonction/lockup-reverse.svg" style="height:40px"></div>
<div style="position:absolute;left:72px;top:210px;font:700 160px/0.86 BigShoulders;letter-spacing:0.005em;text-transform:uppercase;max-width:880px">La porte reste ouverte</div>
<div style="position:absolute;left:76px;top:744px;font:400 22px/1.45 Instrument;max-width:620px;color:#D9D3F0">Des soirées à Paris où les musiques arabes, afro et électroniques se rencontrent — et l'équipe qui les fait vivre.</div>
<div style="position:absolute;left:72px;bottom:72px;display:flex;gap:14px">{''.join(f'<span style="padding:12px 18px;border:1.5px solid {c};border-radius:999px;font:700 16px Instrument;color:{c}">{t}</span>' for t,c in [("Les soirées","#FFB547"),("Le réseau","#7CE0B8"),("Organiser","#B9A6FF")])}</div>
<div style="position:absolute;right:64px;top:64px;width:520px;display:flex;flex-direction:column;gap:22px">
  <div style="height:420px;border-radius:4px;background:#221D44;display:flex;align-items:flex-end;padding:18px;font:13px Instrument;color:#B8B0D8">[Photo documentaire, lumière disponible — soirée pilote, avec accord des personnes]</div>
  <div style="display:flex;gap:10px">{swatches([("Nuit","#15122B"),("Lumière","#FFB547"),("Texte","#F4F0FF"),("Brume","#2A2450")],"#F4F0FF")}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px">{branches(B_br,"#F4F0FF","Instrument")}</div>
</div>
<div style="position:absolute;left:72px;bottom:24px;font:12px Instrument;color:#9C94C0">Direction B · Nuit ouverte · Big Shoulders + Instrument Sans · brouillon</div>
""")
# ── C. Fiche technique ──
C_br = [("CH 01 Soirées", "#F5C400"), ("CH 02 Réseau", "#2BB673"), ("CH 03 Organisateurs", "#FF5A36"), ("CH 04 Apprendre", "#F29F05"), ("CH 05 TekPractice", "#2E5FE6")]
rows = "".join(f'<div style="display:grid;grid-template-columns:70px 1fr 240px 160px;border-top:1px solid #000;padding:12px 0;font:15px PlexMono"><span>{i:02d}</span><span style="font:700 17px Instrument">{t}</span><span>{a}</span><span><span style="background:{c};padding:2px 8px;border-radius:3px;font:700 13px PlexMono">{st}</span></span></div>' for i,(t,a,st,c) in enumerate([("Soirées métissées","public, Paris","EN PRÉPARATION","#F5C400"),("Réseau créatif","artistes, technique","EN CONSTRUCTION","#2BB673"),("Organisateurs","organisateurs, lieux","PLUS TARD","#FF5A36"),("Apprendre le son","étudiants BTS Son","EN DÉVELOPPEMENT","#F29F05"),("TekPractice","étudiants, techniciens","EN DÉVELOPPEMENT","#8FB2FF")],1))
c = page("#FFFFFF", "#000000", f"""
<div style="position:absolute;left:72px;top:64px"><img src="{LOGO}/c-etiquette/lockup.svg" style="height:40px"></div>
<div style="position:absolute;left:72px;top:190px;font:700 68px/1.02 Instrument;letter-spacing:-0.03em;max-width:900px">Fiche technique d'un collectif&#8239;: qui fait quoi, pour qui, et où on en est.</div>
<div style="position:absolute;left:72px;top:540px;width:900px">{rows}<div style="border-top:1px solid #000"></div></div>
<div style="position:absolute;right:64px;top:64px;width:500px;display:flex;flex-direction:column;gap:22px">
  <div style="height:380px;background:#F2F2F2;border:1px dashed #000;display:flex;align-items:center;justify-content:center;font:14px PlexMono;text-align:center;padding:24px">[Plan de scène / synoptique dessiné à la main — scanné]</div>
  <div style="display:flex;gap:10px">{swatches([("Papier","#FFFFFF"),("Encre","#000000"),("Gaffer jaune","#F5C400"),("Gaffer rouge","#FF5A36")],"#000")}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px">{branches(C_br,"#000","PlexMono")}</div>
</div>
<div style="position:absolute;left:72px;bottom:24px;font:12px PlexMono;color:#555">Direction C · Fiche technique · Instrument Sans + IBM Plex Mono · brouillon</div>
""")
for n, h in [("a-bobine", a), ("b-nuit-ouverte", b), ("c-fiche-technique", c)]:
    open(os.path.join(OUT, n + ".html"), "w").write(h)
print("ok")
