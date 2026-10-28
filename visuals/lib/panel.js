/* Panel: a square marquetry panel as a NEST OF BANDS around one strapwork field, with the Tekonest mark in a plain roundel.
   Built from the research (Damascene marquetry design language, 28 Oct 2026):
   - 6 to 8 narrow bands separated by hairline fillets; the frame takes about 18% of the width on each side;
   - near-black ground, pearl as the accent, walnut as the wood family, one amber wire as the only gold;
   - strapwork field on the 4.8.8 grid: double hairline straps, pearl slabs set smaller than their cells (a dark halo);
   - the mark is NOT forced into the star grammar: it sits in a plain roundel cut out of the field.
   Everything is deterministic. Inspired by Damascene wood marquetry; geometry reconstructed by the designer. */
(function (g) {
  var D = g.Damas, C = D.C, TAU = Math.PI * 2;
  var GROUND = "#0C0A0B", PEARL = "#EFE8DC", WIRE = C.ambre;

  /* ---------- small helpers ---------- */
  function pearl(t) {                                                       // satin pearl: two or three close tones, slight warm/pink drift, never rainbow
    var base = D.mixHex("#F3EDE3", "#E0D6C8", t);
    return t > 0.72 ? D.mixHex(base, "#EBD9D6", 0.45) : base;
  }
  function poly(ctx, pts) { ctx.beginPath(); pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); }
  function inset(pts, d) {                                                  // inward offset of a simple polygon with mitred corners
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

  /* a pearl slab: flat satin tone with one soft facet, no outline, no bevel */
  function slab(ctx, pts, tone) {
    poly(ctx, pts); ctx.fillStyle = pearl(tone); ctx.fill();
    ctx.save(); poly(ctx, pts); ctx.clip();
    var c = centroid(pts); ctx.translate(c[0], c[1]); ctx.rotate(longest(pts) + 0.5 + tone);
    ctx.fillStyle = "rgba(255,255,255,.20)"; ctx.fillRect(-200, -200, 400, 200);
    ctx.fillStyle = "rgba(70,50,50,.07)"; ctx.fillRect(-200, 40 * (tone - 0.5), 400, 200);
    ctx.restore();
  }
  function hair(ctx, pts, col, w) { poly(ctx, pts); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = "miter"; ctx.stroke(); }
  function wood(ctx, pts, role, tone) { D.drawPiece(ctx, { pts: pts, role: role, tone: tone }); }
  function rect(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }

  /* ---------- band strips, drawn in local coordinates: centre (0,0), x in [-L/2, L/2], y in [-t/2, t/2] ---------- */
  function stripRope(ctx, L, t, seed) {
    ctx.fillStyle = GROUND; ctx.fillRect(-L / 2, -t / 2, L, t);
    var n = Math.max(2, Math.round(L / (1.6 * t))), p = L / n, A = 0.27 * t, w = 0.2 * t, x, k;
    function y(x, ph) { return A * Math.sin(TAU * (x + L / 2) / p + ph); }
    function strand(ph, col) { ctx.beginPath(); for (x = -L / 2; x <= L / 2; x += 2) { x === -L / 2 ? ctx.moveTo(x, y(x, ph)) : ctx.lineTo(x, y(x, ph)); } ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "butt"; ctx.stroke(); }
    strand(0, pearl(0.15)); strand(Math.PI, pearl(0.62));
    for (k = 0; k <= 2 * n; k++) {                                          // over/under alternates at every true crossing
      var cx = -L / 2 + k * p / 2, ph = k % 2 === 0 ? 0 : Math.PI, col = k % 2 === 0 ? pearl(0.15) : pearl(0.62), a = cx - 0.3 * p, b = cx + 0.3 * p;
      [[w + 5, GROUND], [w, col]].forEach(function (s) {
        ctx.beginPath(); for (x = Math.max(-L / 2, a); x <= Math.min(L / 2, b); x += 1.5) { x === Math.max(-L / 2, a) ? ctx.moveTo(x, y(x, ph)) : ctx.lineTo(x, y(x, ph)); }
        ctx.strokeStyle = s[1]; ctx.lineWidth = s[0]; ctx.stroke();
      });
    }
  }
  function stripTri(ctx, L, t, seed) {                                      // diamond-in-triangle band
    var reg = D.Registry(seed, 0.5), n = Math.max(2, Math.round(L / (0.95 * t))), u = L / n, top = -t / 2, bot = t / 2, x0 = -L / 2, i;
    ctx.fillStyle = GROUND; ctx.fillRect(-L / 2, -t / 2, L, t);
    var V = function (key, x, y) { return reg.v(seed + key, x, y); };
    for (i = 0; i <= n; i++) {                                              // wood triangles pointing down, half-triangles at both ends
      var a = V("t" + i, x0 + (i - 0.5) * u, top), b = V("t" + (i + 1), x0 + (i + 0.5) * u, top), c = V("b" + i, x0 + i * u, bot), pts;
      if (i === 0) pts = [V("t0e", x0, top), b, c]; else if (i === n) pts = [a, V("tne", x0 + n * u, top), V("bne", x0 + n * u, bot)]; else pts = [a, b, c];
      wood(ctx, pts, "walnut", D.r01(seed, "w" + i, "t"));
    }
    for (i = 0; i < n; i++) {                                               // dark triangles pointing up, each holding a pearl diamond
      var tri = [V("b" + i, x0 + i * u, bot), V("b" + (i + 1), x0 + (i + 1) * u, bot), V("t" + (i + 1), x0 + (i + 0.5) * u, top)];
      ctx.fillStyle = "#0F0C0D"; poly(ctx, tri); ctx.fill();
      hair(ctx, inset(tri, 2.2), "#CFC6B8", 1.1);
      var cx = x0 + (i + 0.5) * u, cy = bot - 0.40 * t, hw = 0.16 * u, hh = 0.20 * t;
      slab(ctx, [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], D.r01(seed, "d" + i, "t"));
    }
  }
  function stripSaw(ctx, L, t, seed) {                                      // sawtooth: isosceles teeth, base:height about 2:3, apex toward the field
    var reg = D.Registry(seed, 0.5), n = Math.max(2, Math.round(L / (t * 0.667))), u = L / n, x0 = -L / 2, i;
    ctx.fillStyle = GROUND; ctx.fillRect(-L / 2, -t / 2, L, t);
    for (i = 0; i < n; i++) {
      var tri = [reg.v(seed + "s" + i, x0 + i * u, -t / 2), reg.v(seed + "s" + (i + 1), x0 + (i + 1) * u, -t / 2), reg.v(seed + "a" + i, x0 + (i + 0.5) * u, t / 2 - 1)];
      slab(ctx, tri, D.r01(seed, "s" + i, "t"));
    }
  }
  function cornerCell(ctx, s, kind) {                                       // dark square with a pearl star: the spandrel of a band
    ctx.fillStyle = GROUND; ctx.fillRect(-s / 2, -s / 2, s, s);
    var r = s * 0.42;
    function sq(rot) { var pts = []; for (var k = 0; k < 4; k++) { var a = rot + k * Math.PI / 2; pts.push([r * Math.cos(a), r * Math.sin(a)]); } return pts; }
    if (kind === "diamond") { slab(ctx, [[0, -r], [r * 0.7, 0], [0, r], [-r * 0.7, 0]], 0.3); return; }
    hair(ctx, sq(Math.PI / 4), "#CFC6B8", 1.1); hair(ctx, sq(0), "#CFC6B8", 1.1);
    slab(ctx, sq(Math.PI / 4).map(function (p) { return [p[0] * 0.52, p[1] * 0.52]; }), 0.25);
  }
  function stripFor(type) { return { rope: stripRope, tri: stripTri, saw: stripSaw }[type]; }

  /* ---------- the panel ---------- */
  var BANDS = [
    { id: "margin", t: 18, type: "wood" }, { id: "f1", t: 5, type: "fillet", col: "pearl" },
    { id: "rope", t: 40, type: "rope", corner: "star" }, { id: "f2", t: 5, type: "fillet", col: "pearl" },
    { id: "tri", t: 70, type: "tri", corner: "star" }, { id: "f3", t: 5, type: "fillet", col: "pearl" },
    { id: "saw", t: 28, type: "saw", corner: "diamond" }, { id: "f4", t: 5, type: "fillet", col: "gold" }
  ];

  function drawFrameBand(ctx, b, a) {                                       // wood margin and fillets: four mitred strips
    var t = b.t, o = a, i = a - t;
    [[[-o, -o], [o, -o], [i, -i], [-i, -i]], [[o, -o], [o, o], [i, i], [i, -i]], [[o, o], [-o, o], [-i, i], [i, i]], [[-o, o], [-o, -o], [-i, -i], [-i, i]]].forEach(function (pts, s) {
      if (b.type === "wood") wood(ctx, pts, "walnut", D.r01(7, b.id + s, "t"));
      else { poly(ctx, pts); ctx.fillStyle = b.col === "gold" ? WIRE : pearl(0.2); ctx.fill(); }
    });
  }
  function drawPatternBand(ctx, b, a, seed) {
    var t = b.t, L = 2 * (a - t), s;
    for (s = 0; s < 4; s++) {
      ctx.save(); ctx.rotate(s * Math.PI / 2); ctx.translate(0, -(a - t / 2)); stripFor(b.type)(ctx, L, t, seed + b.id + s); ctx.restore();
      ctx.save(); ctx.rotate(s * Math.PI / 2); ctx.translate(a - t / 2, -(a - t / 2)); cornerCell(ctx, t, b.corner); ctx.restore();
    }
  }

  function drawField(ctx, half, hand, seed) {                               // strapwork on the 4.8.8 grid, clipped to the field square
    var S = half / 5.05, K = D.buildKhatam(seed, -4 * S, -4 * S, 5, 5, S, hand);
    ctx.save(); ctx.beginPath(); ctx.rect(-half, -half, 2 * half, 2 * half); ctx.clip();
    ctx.fillStyle = GROUND; ctx.fillRect(-half, -half, 2 * half, 2 * half);
    K.pieces.forEach(function (p) {
      var o1 = inset(p.pts, 2.3), tone = p.tone;
      if (p.role === "walnut" && p.layer === 0) { slab(ctx, inset(p.pts, 8), tone); }                       // star kites: pearl slabs set in their cells
      else if (p.role === "nacre") { slab(ctx, inset(p.pts, 8), tone); }
      else if (p.layer === 1) { poly(ctx, o1); ctx.fillStyle = p.role === "prune" ? "#4B2036" : "#34241A"; ctx.fill(); wood(ctx, o1, p.role === "prune" ? "prune" : "walnut", tone); }
      hair(ctx, o1, "#B9B0A2", 1.1);                                                                           // the double hairline strap between cells
    });
    ctx.restore();
    return S;
  }

  function drawRoundel(ctx, r, hand) {
    ctx.fillStyle = GROUND; ctx.beginPath(); ctx.arc(0, 0, r + 12, 0, TAU); ctx.fill();                       // the disc is cut out of the field
    ctx.strokeStyle = "#B9B0A2"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, TAU); ctx.stroke();
    ctx.strokeStyle = WIRE; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();       // the one gold wire
    ctx.strokeStyle = "#B9B0A2"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r - 7, 0, TAU); ctx.stroke();
    var nest = g.Nest.build(0, 0, (r - 17) / 108);
    g.Nest.draw(ctx, nest, { w: Math.max(2.2, r * 0.026), gap: Math.max(1.6, r * 0.02), ground: GROUND, cols: [PEARL, "#E4DACB", PEARL, "#E4DACB", PEARL, "#E4DACB", PEARL] });
    return nest;
  }

  /* draw the whole panel centred at (cx, cy); W is the outer width in pixels */
  function drawPanel(ctx, cx, cy, W, o) {
    o = o || {};
    var a0 = W / 2, hand = o.hand === undefined ? 1.4 : o.hand, a = a0, i, nest;
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = GROUND; ctx.fillRect(-a0, -a0, W, W);
    var inner = a0 - BANDS.reduce(function (s, b) { return s + b.t; }, 0);
    var S = drawField(ctx, inner, hand, o.seed || 1306);
    nest = drawRoundel(ctx, 2.1 * S, hand);
    BANDS.forEach(function (b) {
      if (b.type === "wood" || b.type === "fillet") drawFrameBand(ctx, b, a); else drawPatternBand(ctx, b, a, o.seed || 1306);
      a -= b.t;
    });
    ctx.restore();
    return { S: S, field: inner, nest: nest };
  }

  g.Panel = { drawPanel: drawPanel, BANDS: BANDS, strip: function (ctx, type, L, t, seed) { stripFor(type)(ctx, L, t, seed); }, corner: cornerCell, slab: slab, pearl: pearl, GROUND: GROUND, inset: inset };
})(window);
