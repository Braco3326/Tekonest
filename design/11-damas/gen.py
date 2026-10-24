import math
N,P,A,PR="#131114","#F3EDE3","#DD9349","#8A4466"
def ell_pts(cx,cy,rx,ry,rot,n=280):
    c,s=math.cos(rot),math.sin(rot)
    return [(cx+rx*math.cos(t)*c-ry*math.sin(t)*s, cy+rx*math.cos(t)*s+ry*math.sin(t)*c) for t in [k/n*2*math.pi for k in range(n+1)]]
def path(pts): return "M"+" L".join(f"{x:.2f} {y:.2f}" for x,y in pts)
def woven_nest(cx,cy,sc,col,bg,w,segs=14):
    low,high=[],[]
    for i in range(7):
        rot=i*2*math.pi/7; ox,oy=cx+8*sc*math.cos(rot),cy+8*sc*math.sin(rot)
        pts=ell_pts(ox,oy,100*sc,82*sc,rot,segs*20)
        for k in range(segs):
            seg=pts[k*20:(k+1)*20+1]
            (high if (k+i)%2==0 else low).append(path(seg))
    out=""
    for layer in (low,high):
        for d in layer: out+=f'<path d="{d}" fill="none" stroke="{bg}" stroke-width="{w*2.6:.2f}" stroke-linecap="butt"/>'
        for d in layer: out+=f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w:.2f}" stroke-linecap="round"/>'
    return out
def plain_nest(cx,cy,sc,col,w):
    return "".join(f'<path d="{path(ell_pts(cx+8*sc*math.cos(i*2*math.pi/7),cy+8*sc*math.sin(i*2*math.pi/7),100*sc,82*sc,i*2*math.pi/7))}" fill="none" stroke="{col}" stroke-width="{w}"/>' for i in range(7))
def star8(cx,cy,r,col,w):
    sq=lambda a:[(cx+r*math.cos(a+k*math.pi/2),cy+r*math.sin(a+k*math.pi/2)) for k in range(5)]
    return "".join(f'<path d="{path(sq(a))}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linejoin="round"/>' for a in (math.pi/4,0))
cards=[]
# 1 woven nest (over/under like strapwork)
cards.append(("1 · Le nid tressé dessus-dessous","Comme les entrelacs damascènes : chaque fil passe alternativement dessus et dessous.",
 f'<svg viewBox="0 0 400 400"><rect width="400" height="400" fill="{N}"/>{woven_nest(200,195,1.45,P,N,4.2)}</svg>'))
# 2 khatam: 8-point star framing the nest
cards.append(("2 · Le nid dans l'étoile à 8 branches","L'étoile à 8 branches (deux carrés croisés), motif courant de la géométrie islamique, encadre le nid.",
 f'<svg viewBox="0 0 400 400"><rect width="400" height="400" fill="{N}"/>{star8(200,200,170,A,3)}{star8(200,200,150,A,1.2)}{woven_nest(200,197,1.1,P,N,3.4)}</svg>'))
# 3 rosace of 8 nests
ros="".join(f'<g>{plain_nest(200+118*math.cos(k*math.pi/4),200+118*math.sin(k*math.pi/4),0.42,P if k%2==0 else A,1.8)}</g>' for k in range(8))
cards.append(("3 · La rosace de nids","Huit nids en couronne, nacre et or en alternance : une symétrie radiale.",
 f'<svg viewBox="0 0 400 400"><rect width="400" height="400" fill="{N}"/>{ros}{woven_nest(200,197,0.62,A,N,2.6)}</svg>'))
# 4 frieze / inlay band
tile=lambda x: star8(x,60,44,P,1.6)+f'<circle cx="{x}" cy="60" r="4" fill="{A}"/><path d="M{x+44} 20 L{x+56} 60 L{x+44} 100" fill="none" stroke="{PR}" stroke-width="1.2"/>'
band="".join(tile(52+k*100) for k in range(4))
cards.append(("4 · La frise incrustée","Une bordure répétée, comme la nacre sur bois sombre : séparateurs de sections, affiches, merch.",
 f'<svg viewBox="0 0 400 400"><rect width="400" height="400" fill="{N}"/><g transform="translate(0 40)">{band}</g><g transform="translate(0 150)">{band}</g><g transform="translate(-50 260)">{band}{tile(452)}</g></svg>'))
html=''.join(f'<div class="c">{s}<b>{t}</b><small>{d}</small></div>' for t,d,s in cards)
open("board.html","w").write(f'''<!doctype html><html><head><meta charset="utf-8"><style>@font-face{{font-family:T;src:url(T.ttf)}}@font-face{{font-family:UI;src:url(UI.ttf)}}
body{{margin:0;background:#1C181B;color:{P};font-family:UI;padding:30px 36px}}h1{{font:500 26px T;margin:0 0 4px}}p{{color:#C9BFB4;margin:0 0 18px;font-size:14px}}
.r{{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}}.c{{display:flex;flex-direction:column;gap:6px}}svg{{width:100%;height:auto;display:block}}b{{font:500 17px T}}small{{color:#C9BFB4;font-size:13px;line-height:1.4}}</style></head><body>
<h1>TEKONEST × l'art de Damas — 4 pistes</h1><p>Nacre et papier sur bois sombre (nuit), ambre comme la feuille d'or de l'ajami. Géométrie et symétrie, pas d'ornement collé.</p><div class="r">{html}</div></body></html>''')
