/* Panel: a square marquetry panel as a NEST OF BANDS around one strapwork field, with the Tekonest mark in a plain roundel.
   Built from the research (Damascene marquetry design language, 28 Oct 2026). Everything is a list of timed ITEMS so the
   same data draws the still and the making-order animation: carcass, guides, margin and wire, bands laid from the corners
   toward the middle (all four sides land together), field laid outside in, roundel cut, mark set last, then a slow polish.
   Deterministic: render(t) depends only on t. Inspired by Damascene wood marquetry; geometry reconstructed by the designer. */
(function (g) {
  var D = g.Damas, C = D.C, TAU = Math.PI * 2;
  var GROUND = "#0C0A0B", PEARL = "#E4DAC9", WIRE = C.ambre, MASK = { on: false };
  var clamp = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var ease = function (x) { x = clamp(x); return 1 - Math.pow(1 - x, 4); };            // ease-out-quart for laying pieces
  var softOut = function (x) { x = clamp(x); return 1 - Math.pow(1 - x, 2); };         // gentler ease-out for the slow polish

  /* ---------- helpers ---------- */
  function pearl(t) { var base = D.mixHex("#E8DFD0", "#CBBFAD", t); return t > 0.72 ? D.mixHex(base, "#DCC8C4", 0.45) : base; }
  function poly(ctx, pts) { ctx.beginPath(); pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); }
  function inset(pts, d) {
    var n = pts.length, area = 0, i;
    for (i = 0; i < n; i++) { var q = pts[(i + 1) % n]; area += pts[i][0] * q[1] - q[0] * pts[i][1]; }
    var sg = area > 0 ? 1 : -1, out = [];
    for (i = 0; i < n; i++) {
      var p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      var e1 = [p1[0] - p0[0], p1[1] - p0[1]], e2 = [p2[0] - p1[0], p2[1] - p1[1]], l1 = Math.hypot(e1[0], e1[1]) || 1, l2 = Math.hypot(e2[0], e2[1]) || 1;
      var n1 = sg > 0 ? [-e1[1] / l1, e1[0] / l1] : [e1[1] / l1, -e1[0] / l1], n2 = sg > 0 ? [-e2[1] / l2, e2[0] / l2] : [e2[1] / l2, -e2[0] / l2];
      var k = Math.max(0.2, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
      out.push([p1[0] + d * (n1[0] + n2[0]) / k, p1[1] + d * (n1[1] + n2[1]) / k]);
    }
    return out;
  }
  function centroid(pts) { var x = 0, y = 0; pts.forEach(function (p) { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; }
  function longest(pts) { var best = 0, ang = 0; for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d > best) { best = d; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); } } return ang; }
  function slab(ctx, pts, tone) {                                                   // pearl: flat satin tone with one soft facet; in mask mode just white
    poly(ctx, pts);
    if (MASK.on) { ctx.fillStyle = "#fff"; ctx.fill(); return; }
    ctx.fillStyle = pearl(tone); ctx.fill();
    ctx.save(); poly(ctx, pts); ctx.clip();
    var c = centroid(pts); ctx.translate(c[0], c[1]); ctx.rotate(longest(pts) + 0.5 + tone);
    ctx.fillStyle = "rgba(255,255,255,.20)"; ctx.fillRect(-200, -200, 400, 200);
    ctx.fillStyle = "rgba(70,50,50,.07)"; ctx.fillRect(-200, 40 * (tone - 0.5), 400, 200);
    ctx.restore();
  }
  function hair(ctx, pts, col, w) { if (MASK.on) return; poly(ctx, pts); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = "miter"; ctx.stroke(); }
  function wood(ctx, pts, role, tone) { if (MASK.on) return; D.drawPiece(ctx, { pts: pts, role: role, tone: tone }); }
  function fill(ctx, pts, col) { if (MASK.on) return; poly(ctx, pts); ctx.fillStyle = col; ctx.fill(); }

  /* ---------- band strips: local coords, centre (0,0); each returns { base(ctx), cells: [{ k, pts, dir, draw(ctx) }] } ---------- */
  function rope(L, t, seed, hand) {
    var ov = hand === 0 ? 0 : 0.5;                                                  // the two half-cells overlap in the panel so a reveal never leaves a hairline; tiles do not need it
    var n = Math.max(2, Math.round(L / (1.6 * t))), p = L / n, A = 0.27 * t, w = 0.2 * t;
    function y(x, ph) { return A * Math.sin(TAU * (x + L / 2) / p + ph); }
    function drawRange(ctx, x0, x1) {
      if (MASK.on) return;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, -t / 2, x1 - x0, t); ctx.clip();
      function strand(ph, col) { ctx.beginPath(); for (var x = -L / 2 - 8; x <= L / 2 + 8; x += 2) { x === -L / 2 - 8 ? ctx.moveTo(x, y(x, ph)) : ctx.lineTo(x, y(x, ph)); } ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "butt"; ctx.stroke(); }   // runs past both ends; the clip cuts it square, so repeated tiles meet without a gap
      strand(0, pearl(0.15)); strand(Math.PI, pearl(0.62));
      for (var k = 0; k <= 2 * n; k++) {
        var cx = -L / 2 + k * p / 2, ph = k % 2 === 0 ? 0 : Math.PI, col = k % 2 === 0 ? pearl(0.15) : pearl(0.62), a = cx - 0.3 * p, b = cx + 0.3 * p;
        [[w + 5, GROUND], [w, col]].forEach(function (s) { ctx.beginPath(); for (var x = a; x <= b; x += 1.5) { x === a ? ctx.moveTo(x, y(x, ph)) : ctx.lineTo(x, y(x, ph)); } ctx.strokeStyle = s[1]; ctx.lineWidth = s[0]; ctx.stroke(); });
      }
      ctx.restore();
    }
    return {
      base: function (ctx) { if (!MASK.on) { ctx.fillStyle = GROUND; ctx.fillRect(-L / 2, -t / 2, L, t); } },
      cells: [
        { k: 0, pts: rect(-L / 2, -t / 2, 0, t / 2), dir: [1, 0], draw: function (ctx) { drawRange(ctx, -L / 2, ov); } },
        { k: 0, pts: rect(0, -t / 2, L / 2, t / 2), dir: [-1, 0], draw: function (ctx) { drawRange(ctx, -ov, L / 2); } }
      ]
    };
  }
  function rect(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  function tri(L, t, seed, hand) {
    var per = hand === 0, tk = function (i) { return per ? i % 2 : i; };
    var reg = D.Registry(seed, hand === undefined ? 0.5 : hand), n = Math.max(2, Math.round(L / (0.95 * t))), u = L / n, top = -t / 2, bot = t / 2, x0 = -L / 2, i, cells = [];
    var V = function (key, x, y) { return reg.v(seed + key, x, y); };
    for (i = 0; i <= n; i++) {
      (function (i) {
        var a = V("t" + i, x0 + (i - 0.5) * u, top), b = V("t" + (i + 1), x0 + (i + 0.5) * u, top), c = V("b" + i, x0 + i * u, bot), pts;
        if (i === 0) pts = [V("t0e", x0, top), b, c]; else if (i === n) pts = [a, V("tne", x0 + n * u, top), V("bne", x0 + n * u, bot)]; else pts = [a, b, c];
        cells.push({ k: Math.min(i, n - i), pts: pts, dir: [0, 1], draw: function (ctx) { wood(ctx, pts, "walnut", D.r01(seed, "w" + tk(i), "t")); } });
      })(i);
    }
    for (i = 0; i < n; i++) {
      (function (i) {
        var pts = [V("b" + i, x0 + i * u, bot), V("b" + (i + 1), x0 + (i + 1) * u, bot), V("t" + (i + 1), x0 + (i + 0.5) * u, top)];
        var cx = x0 + (i + 0.5) * u, cy = bot - 0.40 * t, hw = 0.16 * u, hh = 0.20 * t;
        cells.push({ k: Math.min(i, n - 1 - i) + 0.4, pts: pts, dir: [0, 1], draw: function (ctx) {
          fill(ctx, pts, "#0F0C0D"); hair(ctx, inset(pts, 2.2), "#CFC6B8", 1.1);
          slab(ctx, [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], D.r01(seed, "d" + tk(i), "t"));
        } });
      })(i);
    }
    return { base: function (ctx) { if (!MASK.on) { ctx.fillStyle = GROUND; ctx.fillRect(-L / 2, -t / 2, L, t); } }, cells: cells };
  }
  function saw(L, t, seed, hand) {
    var per = hand === 0, tk = function (i) { return per ? i % 2 : i; };
    var reg = D.Registry(seed, hand === undefined ? 0.5 : hand), n = Math.max(2, Math.round(L / (t * 0.667))), u = L / n, x0 = -L / 2, i, cells = [];
    for (i = 0; i < n; i++) {
      (function (i) {
        var pts = [reg.v(seed + "s" + i, x0 + i * u, -t / 2), reg.v(seed + "s" + (i + 1), x0 + (i + 1) * u, -t / 2), reg.v(seed + "a" + i, x0 + (i + 0.5) * u, t / 2 - 1)];
        cells.push({ k: Math.min(i, n - 1 - i), pts: pts, dir: [0, 1], draw: function (ctx) { slab(ctx, pts, D.r01(seed, "s" + tk(i), "t")); } });
      })(i);
    }
    return { base: function (ctx) { if (!MASK.on) { ctx.fillStyle = GROUND; ctx.fillRect(-L / 2, -t / 2, L, t); } }, cells: cells };
  }
  function cornerDraw(ctx, s, kind) {
    fill(ctx, rect(-s / 2, -s / 2, s / 2, s / 2), GROUND);
    var r = s * 0.42;
    function sq(rot) { var pts = []; for (var k = 0; k < 4; k++) { var a = rot + k * Math.PI / 2; pts.push([r * Math.cos(a), r * Math.sin(a)]); } return pts; }
    if (kind === "diamond") { slab(ctx, [[0, -r], [r * 0.7, 0], [0, r], [-r * 0.7, 0]], 0.3); return; }
    hair(ctx, sq(Math.PI / 4), "#CFC6B8", 1.1); hair(ctx, sq(0), "#CFC6B8", 1.1);
    slab(ctx, sq(Math.PI / 4).map(function (p) { return [p[0] * 0.52, p[1] * 0.52]; }), 0.25);
  }
  var STRIPS = { rope: rope, tri: tri, saw: saw };

  /* the look of one field piece: double hairline strap, pearl slab or wood set inside its cell */
  function drawFieldPiece(ctx, p) {
    var o1 = inset(p.pts, 2.3), tone = p.tone;
    if (p.role === "nacre") slab(ctx, inset(p.pts, 8), tone);
    else if (p.role === "walnut" && p.layer === 0) { fill(ctx, inset(p.pts, 6.5), "#3A281C"); wood(ctx, inset(p.pts, 6.5), "walnut", tone); }
    else if (p.layer === 1) { fill(ctx, o1, p.role === "prune" ? "#4B2036" : "#34241A"); wood(ctx, o1, p.role === "prune" ? "prune" : "walnut", tone); }
    hair(ctx, o1, "#B9B0A2", 1.1);
  }
  /* the roundel: radii, the mark and its stroke, shared by the animated items and the static drawer */
  function roundelSpec(r, mark) {
    return { r: r, disc: r + 12, ring1: r + 9, ring2: r - 7, nest: g.Nest.build(0, 0, (r - 17) / 108),
      NW: { w: Math.max(2.4, r * 0.03), weave: false, ground: GROUND, cols: [mark || "#F3EDE3"] } };
  }

  /* ---------- the model ---------- */
  var BANDS = [
    { id: "margin", t: 18, type: "wood" }, { id: "f1", t: 5, type: "fillet", col: "pearl" },
    { id: "rope", t: 40, type: "rope", corner: "star" }, { id: "f2", t: 5, type: "fillet", col: "pearl" },
    { id: "tri", t: 70, type: "tri", corner: "star" }, { id: "f3", t: 5, type: "fillet", col: "pearl" },
    { id: "saw", t: 28, type: "saw", corner: "diamond" }, { id: "f4", t: 5, type: "fillet", col: "gold" }
  ];
  function rot90(v, s) { for (var i = 0; i < s; i++) v = [-v[1], v[0]]; return v; }                  // clockwise quarter turns in y-down coordinates

  function build(W, o) {
    o = o || {};
    var seed = o.seed || 1306, hand = o.hand === undefined ? 1.4 : o.hand, a0 = W / 2, items = [], a = a0, s, i;
    function add(it) { it.t0 = 0; it.dur = 0.35; if (it.key === undefined) it.key = 0; items.push(it); return it; }
    function prep(it) {                                                                  // projection range along the reveal direction
      if (it.pts && it.dir) { var u = it.pts.map(function (p) { return p[0] * it.dir[0] + p[1] * it.dir[1]; }); it.u0 = Math.min.apply(null, u); it.u1 = Math.max.apply(null, u); }
      return it;
    }
    var inner = a0 - BANDS.reduce(function (acc, b) { return acc + b.t; }, 0);

    // wood margin and fillets: four mitred strips each, swept clockwise along their own length
    BANDS.forEach(function (b) {
      var t = b.t, oo = a, ii = a - t;
      if (b.type === "wood" || b.type === "fillet") {
        [[[-oo, -oo], [oo, -oo], [ii, -ii], [-ii, -ii]], [[oo, -oo], [oo, oo], [ii, ii], [ii, -ii]], [[oo, oo], [-oo, oo], [-ii, ii], [ii, ii]], [[-oo, oo], [-oo, -oo], [-ii, -ii], [-ii, ii]]].forEach(function (pts, side) {
          var dir = rot90([1, 0], side);
          add(prep({ layer: b.id, key: side, pts: pts, dir: dir, gold: b.col === "gold", draw: function (ctx) {
            if (b.type === "wood") wood(ctx, pts, "walnut", D.r01(7, b.id + side, "t"));
            else if (!MASK.on || b.col !== "gold") { poly(ctx, pts); ctx.fillStyle = MASK.on ? "#fff" : (b.col === "gold" ? WIRE : pearl(0.2)); ctx.fill(); }
          } }));
        });
      } else {
        var L = 2 * (a - t);
        for (s = 0; s < 4; s++) {
          (function (s) {
            var strip = STRIPS[b.type](L, t, seed + b.id + s), off = [0, -(a - t / 2)];
            function toPanel(p) { var q = [p[0] + off[0], p[1] + off[1]]; for (var k = 0; k < s; k++) q = [-q[1], q[0]]; return q; }
            function wrap(fn) { return function (ctx) { ctx.save(); ctx.rotate(s * Math.PI / 2); ctx.translate(off[0], off[1]); fn(ctx); ctx.restore(); }; }
            add({ layer: b.id, key: -1, pts: null, base: true, draw: wrap(strip.base) });                       // the dark ground of the strip, there from the start of its layer
            strip.cells.forEach(function (c) { add(prep({ layer: b.id, key: c.k, pts: c.pts.map(toPanel), dir: rot90(c.dir, s), draw: wrap(c.draw) })); });
            var cp = [[a - t, -a], [a, -a], [a, -a + t], [a - t, -a + t]].map(function (p) { for (var k = 0; k < s; k++) p = [-p[1], p[0]]; return p; });
            var cc = centroid(cp), dd = [-cc[0], -cc[1]], ll = Math.hypot(dd[0], dd[1]);
            add(prep({ layer: b.id, key: -0.5, pts: cp, dir: [dd[0] / ll, dd[1] / ll], draw: (function (cc2) { return function (ctx) { ctx.save(); ctx.translate(cc2[0], cc2[1]); ctx.rotate(s * Math.PI / 2); cornerDraw(ctx, t, b.corner); ctx.restore(); }; })(cc) }));
          })(s);
        }
      }
      a -= t;
    });

    // the field: pieces laid outside in, symmetric images landing together (same distance, same key)
    var S = inner / 5.05, K = D.buildKhatam(seed, -4 * S, -4 * S, 5, 5, S, hand);
    K.pieces.forEach(function (p, idx) {
      var c = centroid(p.pts), dist = Math.hypot(c[0], c[1]), d = dist > 1e-6 ? [-c[0] / dist, -c[1] / dist] : [0, 1];
      add(prep({ layer: "field", key: Math.round(dist / 3), pts: p.pts, dir: d, draw: function (ctx) {
        ctx.save(); ctx.beginPath(); ctx.rect(-inner, -inner, 2 * inner, 2 * inner); ctx.clip();
        drawFieldPiece(ctx, p);
        ctx.restore();
      } }));
    });

    // construction guides: the 4.8.8 lattice (octagons), the axes and the roundel circle; drawn first, withdrawn before the end
    var guideLines = [], RO = S / Math.cos(Math.PI / 8), ci, cj, k2;
    for (ci = 0; ci < 5; ci++) for (cj = 0; cj < 5; cj++) {
      var pts2 = []; for (k2 = 0; k2 <= 8; k2++) { var ag = Math.PI / 8 + k2 * Math.PI / 4; pts2.push([(2 * ci - 4) * S + RO * Math.cos(ag), (2 * cj - 4) * S + RO * Math.sin(ag)]); }
      guideLines.push(pts2);
    }
    guideLines.push([[-inner, 0], [inner, 0]], [[0, -inner], [0, inner]], [[-inner, -inner], [inner, -inner], [inner, inner], [-inner, inner], [-inner, -inner]]);
    add({ layer: "guides", custom: true, draw: function (ctx, p, t) {
      if (MASK.on) return;
      var q = p * (1 - ease((t - 5.3) / 1.0)); if (q <= 0) return;
      ctx.save(); ctx.strokeStyle = "rgba(185,176,162,.34)"; ctx.lineWidth = 1; ctx.lineJoin = "miter";
      guideLines.forEach(function (ln) {
        var len = 0, i3; for (i3 = 1; i3 < ln.length; i3++) len += Math.hypot(ln[i3][0] - ln[i3 - 1][0], ln[i3][1] - ln[i3 - 1][1]);
        ctx.setLineDash([len + 2, len + 2]); ctx.lineDashOffset = (len + 2) * (1 - q);
        ctx.beginPath(); ln.forEach(function (pt, i4) { i4 ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]); }); ctx.stroke();
      });
      ctx.setLineDash([2 * Math.PI * (2.1 * S) + 2, 2 * Math.PI * (2.1 * S) + 2]); ctx.lineDashOffset = (2 * Math.PI * (2.1 * S) + 2) * (1 - q);
      ctx.beginPath(); ctx.arc(0, 0, 2.1 * S, -Math.PI / 2, 1.5 * Math.PI); ctx.stroke();
      ctx.restore();
    } });

    // the roundel and the mark
    var r = 2.1 * S, rs = roundelSpec(r, o.mark), nest = rs.nest, NW = rs.NW;
    add({ layer: "disc", custom: true, draw: function (ctx, p) { if (MASK.on) return; ctx.save(); ctx.beginPath(); ctx.arc(0, 0, rs.disc * p, 0, TAU); ctx.clip(); ctx.fillStyle = GROUND; ctx.fillRect(-r - 20, -r - 20, 2 * r + 40, 2 * r + 40); ctx.restore(); } });
    function ringArc(rad, col, w) { return function (ctx, p) { if (MASK.on || p <= 0) return; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, rad, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke(); }; }
    add({ layer: "ring1", custom: true, draw: ringArc(rs.ring1, "#B9B0A2", 1.2) });
    add({ layer: "ring2", custom: true, draw: ringArc(rs.ring2, "#B9B0A2", 1) });
    add({ layer: "wire", custom: true, draw: ringArc(r, WIRE, 2) });
    add({ layer: "mark", custom: true, draw: function (ctx, p, t, model) { if (MASK.on) return; var prog = []; for (var e = 0; e < 7; e++) prog.push(clamp((p * 1.45 - e * 0.07) / 0.55)); g.Nest.drawPartial(ctx, nest, NW, prog); } });

    var gi = items.findIndex(function (it) { return it.layer === "guides"; }); items.unshift(items.splice(gi, 1)[0]);
    return { W: W, a0: a0, inner: inner, S: S, r: r, nest: nest, items: items };
  }

  /* ---------- timeline ---------- */
  var DURATION = 10.0;
  var PLAN = {                                  // layer: [start, end, item duration, order]
    guides: [0.3, 0.3, 1.3], margin: [1.1, 1.8, 0.45], f1: [1.7, 2.3, 0.45], rope: [2.0, 2.9, 0.4], f2: [2.8, 3.2, 0.4], tri: [3.0, 4.1, 0.38], f3: [3.9, 4.3, 0.4], saw: [4.0, 4.9, 0.34],
    field: [3.4, 5.5, 0.42], disc: [5.3, 5.3, 0.5], ring1: [5.6, 5.6, 0.55], ring2: [5.75, 5.75, 0.5], f4: [6.0, 6.5, 0.45], wire: [6.2, 6.2, 0.7], mark: [6.4, 6.4, 1.5]
  };
  function schedule(model) {
    var byLayer = {};
    model.items.forEach(function (it) { (byLayer[it.layer] = byLayer[it.layer] || []).push(it); });
    Object.keys(byLayer).forEach(function (L) {
      var pl = PLAN[L], list = byLayer[L], keys = list.filter(function (i) { return !i.base; }).map(function (i) { return i.key; });
      var kmin = Math.min.apply(null, keys), kmax = Math.max.apply(null, keys), field = L === "field";
      list.forEach(function (it) {
        it.dur = pl[2];
        if (it.base) { it.t0 = pl[0] - 0.05; return; }
        var f = kmax === kmin ? 0 : (it.key - kmin) / (kmax - kmin);
        if (field) f = 1 - f;                                       // largest distance first: outside in
        it.t0 = pl[0] + (pl[1] - pl[0]) * (1 - Math.pow(1 - f, 2));   // pace slows toward the end
      });
    });
    model.duration = DURATION;
    model.layerList = [];
    model.items.forEach(function (it) {
      var last = model.layerList[model.layerList.length - 1];
      if (!last || last.name !== it.layer) { last = { name: it.layer, items: [], end: 0, cache: null }; model.layerList.push(last); }
      last.items.push(it); last.end = Math.max(last.end, it.t0 + it.dur);
    });
    model.layerList.forEach(function (L) { if (L.name === "guides") L.end = Infinity; });   // the guides withdraw by the clock, not by their own duration
    return model;
  }

  function drawItem(ctx, it, t, model) {
    if (t < it.t0) return;
    var p = clamp((t - it.t0) / it.dur);
    if (it.base) { it.draw(ctx); return; }
    if (it.custom) { it.draw(ctx, ease(p), t, model); return; }
    if (p >= 1) { it.draw(ctx); return; }
    var f = it.u0 + (it.u1 - it.u0) * ease(p), d = it.dir, n = [-d[1], d[0]], R = 3000;
    ctx.save(); ctx.beginPath();
    [[it.u0 - 3, -R], [f, -R], [f, R], [it.u0 - 3, R]].forEach(function (q, i) { var x = q[0] * d[0] + q[1] * n[0], y = q[0] * d[1] + q[1] * n[1]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath(); ctx.clip(); it.draw(ctx); ctx.restore();
  }

  var maskCache = null;
  function pearlMask(model) {                                                          // all pearl, in white, drawn once
    if (maskCache && maskCache.W === model.W) return maskCache.cv;
    var cv = document.createElement("canvas"); cv.width = cv.height = model.W; var c = cv.getContext("2d");
    c.translate(model.W / 2, model.W / 2); MASK.on = true;
    model.items.forEach(function (it) { if (!it.custom && !it.base) it.draw(c); });
    MASK.on = false;
    c.globalCompositeOperation = "destination-out"; c.beginPath(); c.arc(0, 0, model.r + 12, 0, TAU); c.fill();        // the roundel is cut out: what it covers is not lit
    maskCache = { W: model.W, cv: cv }; return cv;
  }
  function sheen(ctx, model, p) {                                                      // a slow raking light across the pearl, no glow
    if (p <= 0 || p >= 1) return;
    var W = model.W, cv = model.sheenCv || (model.sheenCv = document.createElement("canvas")); cv.width = cv.height = W; var c = cv.getContext("2d");
    var x = -0.25 * W + (1.5 * W) * p, gr = c.createLinearGradient(x - 0.18 * W, 0, x + 0.18 * W, 0.0);
    gr.addColorStop(0, "rgba(236,186,200,0)"); gr.addColorStop(0.38, "rgba(236,186,200,.6)"); gr.addColorStop(0.62, "rgba(176,214,226,.6)"); gr.addColorStop(1, "rgba(176,214,226,0)");   // nacre drift: pink then cool, never a rainbow
    c.save(); c.translate(W / 2, W / 2); c.rotate(0.35); c.translate(-W / 2, -W / 2); c.fillStyle = gr; c.fillRect(-W, -W, 3 * W, 3 * W); c.restore();
    c.globalCompositeOperation = "destination-in"; c.drawImage(pearlMask(model), 0, 0);
    ctx.save(); ctx.globalAlpha = 0.8; ctx.drawImage(cv, -W / 2, -W / 2); ctx.restore();
  }

  function layerCache(L, model) {                                                     // the finished look of a layer, drawn once
    if (!L.cache) {
      L.cache = document.createElement("canvas"); L.cache.width = L.cache.height = model.W;
      var cc = L.cache.getContext("2d"); cc.translate(model.W / 2, model.W / 2);
      L.items.forEach(function (it) { drawItem(cc, it, 1e9, model); });
    }
    return L.cache;
  }
  function warm(model) { model.layerList.forEach(function (L) { if (L.name !== "guides") layerCache(L, model); }); pearlMask(model); }
  function release(model) {                                                            // drop every canvas this model holds; rendering again rebuilds them
    model.layerList.forEach(function (L) { L.cache = null; L.live = null; });
    model.sheenCv = null; maskCache = null;
  }

    /* opts.live: finished pieces of a layer still in progress are baked once, so playback stays light. Rendering for video
     leaves it off, because then the frame is a pure function of t. */
  function render(ctx, cx, cy, model, t, opts) {
    var live = opts && opts.live;
    if (live && model.lastT !== undefined && t < model.lastT) model.layerList.forEach(function (L) { L.live = null; });
    model.lastT = t;
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = GROUND; ctx.fillRect(-model.a0, -model.a0, model.W, model.W);
    model.layerList.forEach(function (L) {
      if (t >= L.end) {
        L.live = null;                                                                 // a finished layer's live bake is no longer needed
        ctx.drawImage(layerCache(L, model), -model.W / 2, -model.W / 2);
      } else if (live) {
        if (!L.live) { L.live = { cv: document.createElement("canvas"), done: {} }; L.live.cv.width = L.live.cv.height = model.W; L.live.cx = L.live.cv.getContext("2d"); L.live.cx.translate(model.W / 2, model.W / 2); }
        L.items.forEach(function (it, i) { if (!L.live.done[i] && t >= it.t0 + it.dur && !it.custom) { drawItem(L.live.cx, it, 1e9, model); L.live.done[i] = true; } });
        ctx.drawImage(L.live.cv, -model.W / 2, -model.W / 2);
        L.items.forEach(function (it, i) { if (!L.live.done[i]) drawItem(ctx, it, t, model); });
      } else L.items.forEach(function (it) { drawItem(ctx, it, t, model); });
    });
    sheen(ctx, model, softOut((t - 7.4) / 1.6));
    ctx.restore();
  }
  /* static roundel at (cx, cy) with radius r: cut-out disc, hairline rings, gold wire and the mark as continuous loops */
  function drawRoundel(ctx, cx, cy, r, opts) {
    var rs = roundelSpec(r, opts && opts.mark);
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = GROUND; ctx.beginPath(); ctx.arc(0, 0, rs.disc, 0, TAU); ctx.fill();
    [[rs.ring1, "#B9B0A2", 1.2], [rs.ring2, "#B9B0A2", 1], [r, WIRE, 2]].forEach(function (ring) {
      ctx.strokeStyle = ring[1]; ctx.lineWidth = ring[2]; ctx.beginPath(); ctx.arc(0, 0, ring[0], 0, TAU); ctx.stroke();
    });
    g.Nest.draw(ctx, rs.nest, rs.NW);
    ctx.restore();
  }
  /* the 8-fold strapwork field on a cols x rows lattice of octagons with apothem S, in the panel's piece styling; the caller paints the ground */
  function fieldTexture(ctx, x0, y0, cols, rows, S, opts) {
    var K = D.buildKhatam((opts && opts.seed) || 1306, x0, y0, cols, rows, S, opts && opts.hand !== undefined ? opts.hand : 1.4);
    K.pieces.forEach(function (p) { drawFieldPiece(ctx, p); });
  }
  /* one seamless repeating tile of a band: transparent ground, no hand irregularity, width two units. The strip is drawn two
     units longer on each side and the canvas edge cuts it, so every piece is whole where it matters and repeats are exact. */
  function tile(ctx, type, t) {
    var unit = { rope: 1.6, tri: 0.95, saw: 0.667 }[type], u = Math.round(unit * t), w = 2 * u, strip = STRIPS[type](w + 4 * u, t, "tile" + type, 0);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, t); ctx.clip();
    ctx.translate(w / 2, t / 2); strip.cells.forEach(function (c) { c.draw(ctx); }); ctx.restore();
    return { w: w, h: t };
  }
  function drawPanel(ctx, cx, cy, W, o) { var m = schedule(build(W, o)); render(ctx, cx, cy, m, 1e9); return { S: m.S, field: m.inner, nest: m.nest }; }

  g.Panel = { build: function (W, o) { return schedule(build(W, o)); }, render: render, drawPanel: drawPanel, DURATION: DURATION, PLAN: PLAN, ease: ease,
    strip: function (ctx, type, L, t, seed, hand) { var s = STRIPS[type](L, t, seed, hand); s.base(ctx); s.cells.forEach(function (c) { c.draw(ctx); }); },
    maskOf: pearlMask, warm: warm, release: release, drawRoundel: drawRoundel, fieldTexture: fieldTexture, tile: tile, corner: cornerDraw, slab: slab, pearl: pearl, GROUND: GROUND };
})(window);
