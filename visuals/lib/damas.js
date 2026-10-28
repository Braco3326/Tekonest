/* Damas: a small, deterministic library that builds Damascus-style marquetry from its construction logic.
   One circle division (12, with 24 and 48 nested), pieces that tile exactly on shared vertices,
   colour by symmetry, hand imperfection applied to VERTICES (so pieces never gap), kerf joints.
   Everything depends only on its inputs (no Math.random, no Date), so renders are reproducible.
   Inspired by Damascus marquetry; construction after standard star-polygon geometry. */
(function (g) {
  var TAU = Math.PI * 2;
  var C = {
    nuit: "#131114", papier: "#F3EDE3", creme: "#EAE2D5", ambre: "#DD9349", prune: "#612D45",
    noyer: "#6B4A33", noyerDark: "#3A281C", ebony: "#14100E", kerf: "#070505"
  };

  /* ---------- deterministic helpers ---------- */
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function r01(seed, key, salt) { return (hash(seed + ":" + key + ":" + salt) % 100000) / 100000; }
  function rad(d) { return d * Math.PI / 180; }
  function mixHex(a, b, k) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), hx = function (n) { n = Math.max(0, Math.min(255, Math.round(n))); return (n < 16 ? "0" : "") + n.toString(16); };
    return "#" + hx((pa >> 16) * (1 - k) + (pb >> 16) * k) + hx(((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k) + hx((pa & 255) * (1 - k) + (pb & 255) * k);
  }

  /* A vertex registry: the same key always returns the same (slightly displaced) point, so adjacent
     pieces share exact corners. amp is the maximum displacement in pixels (hand = 0 gives the perfect version). */
  function Registry(seed, amp) {
    var m = {};
    return {
      v: function (key, x, y) {
        if (!m[key]) {
          var a = r01(seed, key, "a") * TAU, d = (r01(seed, key, "d") - 0.5) * 2 * amp;
          m[key] = [x + Math.cos(a) * d, y + Math.sin(a) * d];
        }
        return m[key];
      }
    };
  }
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }

  /* A quad split like a rod slice: a diamond at the edge midpoints plus four corner triangles. Exact tiling. */
  function cell(a, b, c, d) {
    var ab = mid(a, b), bc = mid(b, c), cd = mid(c, d), da = mid(d, a);
    return { diamond: [ab, bc, cd, da], corners: [[da, a, ab], [ab, b, bc], [bc, c, cd], [cd, d, da]] };
  }

  /* ---------- the lid: a circular composition on one circle division ---------- */
  /* Rings are 48-gons (straight-cut). Angles are measured from the top, clockwise. */
  function buildLid(seed, cx, cy, R, hand) {
    var reg = Registry(seed, hand * R * 0.0045), P = [];
    var ANG = function (k, per) { return rad(-90 + 360 * k / per); };
    var pt = function (id, k, per, r) { var a = ANG(k, per); return reg.v(id + ":" + k, cx + r * R * Math.cos(a), cy + r * R * Math.sin(a)); };
    var ring48 = function (id, r) { var o = []; for (var k = 0; k < 48; k++) o.push(pt(id, k, 48, r)); return o; };
    var add = function (pts, role, layer, orbit, tone) { P.push({ pts: pts, role: role, layer: layer, orbit: orbit, tone: tone === undefined ? r01(seed, layer + ":" + P.length, "t") : tone }); };

    // Radii (fractions of R). Medallion tips at RT; its dodecagon vertices at RM = RT / cos 15 deg.
    var RT = 0.575, RM = RT / Math.cos(rad(15)), RV = RT * 2 * Math.sin(rad(15));  // valley radius = 0.5176 RT
    var HOLE = 0.168, GOLD0 = 0.148;
    var B = { m: RM, s1: RM + 0.02, f1: RM + 0.02 + 0.17, s2: RM + 0.02 + 0.17 + 0.02, b1: RM + 0.02 + 0.17 + 0.02 + 0.13, fr: RM + 0.02 + 0.17 + 0.02 + 0.13 + 0.04 };

    // layer 0: the medallion, {12/5} star kites plus outer kites inside a dodecagon (24 pieces, no gaps)
    var O = reg.v("M:O", cx, cy), tip = [], val = [], dod = [];
    for (var j = 0; j < 12; j++) {
      tip.push(reg.v("M:tip:" + j, cx + RT * R * Math.cos(ANG(j, 12)), cy + RT * R * Math.sin(ANG(j, 12))));
      val.push(reg.v("M:val:" + j, cx + RV * R * Math.cos(ANG(j + 0.5, 12)), cy + RV * R * Math.sin(ANG(j + 0.5, 12))));
      dod.push(pt("r48m", 2 + 4 * j, 48, RM));                                 // shared with the 48-gon ring
    }
    for (j = 0; j < 12; j++) {
      add([O, val[(j + 11) % 12], tip[j], val[j]], j % 2 ? "prune" : "nacre", 0, j);               // star kite, 2-coloured by symmetry
      add([tip[j], dod[j], tip[(j + 1) % 12], val[j]], j % 2 ? "ebony" : "walnut", 0, j);          // outer kite
    }

    // layer 1: twelve spandrels between the dodecagon and the 48-gon (dark filler, like real offcuts)
    var m48 = ring48("r48m", RM);
    for (j = 0; j < 12; j++) {
      var s = [dod[(j + 11) % 12], tip[j], dod[j]];
      for (var q = 4 * j + 2; q >= 4 * j - 2; q--) if (q !== 4 * j + 2 && q !== 4 * j - 2) s.push(m48[(q + 48) % 48]);
      add(s, "ebony", 1, j);
    }

    // stringing: a thin nacre ring (single piece), then the field of rod slices (24 sectors, 48 triangles)
    var annulus = function (idA, rA, idB, rB, role, layer) {                    // a ring as one polygon with a hole: outer then inner reversed
      var o = ring48(idB, rB), i = ring48(idA, rA);
      return { pts: o.concat(i.slice().reverse()), loops: [o, i], role: role, layer: layer, orbit: 0, tone: 0.5, ring: true };
    };
    P.push(annulus("r48m", B.m, "r48s1", B.s1, "nacre", 2));
    var fIn = ring48("r48s1", B.s1), fOut = ring48("r48f1", B.f1);
    for (j = 0; j < 24; j++) {
      var a0 = fIn[2 * j], a1 = fIn[(2 * j + 2) % 48], b0 = fOut[2 * j], b1 = fOut[(2 * j + 2) % 48], orb = j % 12;
      if (j % 2 === 0) { add([a0, a1, b1], j % 4 === 0 ? "nacre" : "prune", 3, orb); add([a0, b1, b0], "walnut", 3, orb); }
      else { add([a0, a1, b0], "walnut", 3, orb); add([a1, b1, b0], j % 4 === 1 ? "prune" : "nacre", 3, orb); }
    }
    P.push(annulus("r48f1", B.f1, "r48s2", B.s2, "nacre", 4));

    // border: 48 rod-slice cells (diamond plus four corner triangles), alternating by symmetry
    var bIn = ring48("r48s2", B.s2), bOut = ring48("r48b1", B.b1);
    for (j = 0; j < 48; j++) {
      var cl = cell(bIn[j], bIn[(j + 1) % 48], bOut[(j + 1) % 48], bOut[j]);
      add(cl.diamond, j % 2 ? "prune" : "nacre", 5, j % 12);
      for (var c = 0; c < 4; c++) add(cl.corners[c], (j + c) % 2 ? "ebony" : "walnut", 5, j % 12);
    }

    // frame: an ebony band with a walnut filet and a nacre hairline
    P.push(annulus("r48b1", B.b1, "r48fr", B.fr, "ebony", 6));
    P.push(annulus("r48fr", B.fr, "r48fr2", B.fr + 0.012, "walnut", 6));

    // the gold: one ring around the open centre, the only gold in the piece
    var g0 = [], g1 = [];
    for (j = 0; j < 12; j++) { g0.push(reg.v("G:in:" + j, cx + GOLD0 * R * Math.cos(ANG(j, 12)), cy + GOLD0 * R * Math.sin(ANG(j, 12)))); g1.push(reg.v("G:out:" + j, cx + HOLE * R * Math.cos(ANG(j, 12)), cy + HOLE * R * Math.sin(ANG(j, 12)))); }
    P.push({ pts: g1.concat(g0.slice().reverse()), loops: [g1, g0], role: "gold", layer: 7, orbit: 0, tone: 0.5, ring: true });

    return { pieces: P, cx: cx, cy: cy, R: R, hole: GOLD0 * R, radii: B };
  }

  /* ---------- an 8-fold khatam-style field on the 4.8.8 tiling ---------- */
  function buildKhatam(seed, x0, y0, cols, rows, S, hand) {              // S = pixels per unit (octagon apothem = S)
    var reg = Registry(seed, hand * S * 0.012), P = [], K = Math.tan(rad(22.5)), RV8 = 0.7654, RO = 1 / Math.cos(rad(22.5));
    var add = function (pts, role, layer, orbit) { P.push({ pts: pts, role: role, layer: layer, orbit: orbit, tone: r01(seed, "k" + P.length, "t") }); };
    // vertices are keyed by position, so neighbouring octagons and squares share exact corners
    var vx = function (x, y) { return reg.v(Math.round(x * 1e4) + ":" + Math.round(y * 1e4), x0 + x * S, y0 + y * S); };
    for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) {
      var ox = 2 * i, oy = 2 * j, tip = [], val = [], oct = [];
      for (var k = 0; k < 8; k++) {
        var at = rad(45 * k), av = rad(45 * k + 22.5);
        tip.push(vx(ox + Math.cos(at), oy + Math.sin(at)));
        val.push(vx(ox + RV8 * Math.cos(av), oy + RV8 * Math.sin(av)));
        oct.push(vx(ox + RO * Math.cos(av), oy + RO * Math.sin(av)));
      }
      var cen = vx(ox, oy);
      for (k = 0; k < 8; k++) {
        add([cen, val[(k + 7) % 8], tip[k], val[k]], k % 2 ? "walnut" : "nacre", 0, k);
        add([tip[k], oct[k], tip[(k + 1) % 8], val[k]], "ebony", 0, k);
      }
    }
    // the squares between four octagons: a diamond with half-diagonal 1 - tan 22.5 deg
    for (i = 0; i < cols - 1; i++) for (j = 0; j < rows - 1; j++) {
      var qx = 2 * i + 1, qy = 2 * j + 1, h = 1 - K;
      add([vx(qx + h, qy), vx(qx, qy + h), vx(qx - h, qy), vx(qx, qy - h)], (i + j) % 2 ? "prune" : "walnut", 1, (i + j) % 2);
    }
    return { pieces: P };
  }

  /* ---------- materials ---------- */
  function roleFill(p) {
    var t = p.tone;
    switch (p.role) {
      case "nacre": return mixHex(mixHex(C.papier, C.creme, t), t > 0.5 ? "#F6EEE2" : "#E9E4DC", 0.35);   // faint warm/cool drift
      case "walnut": return mixHex(C.noyerDark, C.noyer, 0.15 + 0.5 * t);
      case "ebony": return mixHex(C.ebony, "#241B17", t * 0.6);
      case "prune": return mixHex("#4F2338", C.prune, 0.4 + 0.6 * t);
      case "gold": return C.ambre;
    }
    return C.nuit;
  }
  function pathOf(ctx, pts) { ctx.beginPath(); pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); }
  function longestEdgeAngle(pts) {
    var best = 0, ang = 0;
    for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d > best) { best = d; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); } }
    return ang;
  }
  function drawPiece(ctx, p, o) {
    o = o || {};
    var alpha = o.alpha === undefined ? 1 : o.alpha;
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = roleFill(p);
    if (p.ring) { ctx.beginPath(); p.loops.forEach(function (lp) { lp.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); }); ctx.fill("evenodd"); }
    else { pathOf(ctx, p.pts); ctx.fill(); }
    if (!p.ring && (p.role === "walnut" || p.role === "prune" || p.role === "ebony")) {          // grain along the long edge, angle changes piece to piece
      ctx.save(); pathOf(ctx, p.pts); ctx.clip();
      var cxm = 0, cym = 0; p.pts.forEach(function (q) { cxm += q[0]; cym += q[1]; }); cxm /= p.pts.length; cym /= p.pts.length;
      var ang = longestEdgeAngle(p.pts) + (p.tone - 0.5) * 0.12;
      ctx.translate(cxm, cym); ctx.rotate(ang);
      ctx.strokeStyle = p.role === "prune" ? "rgba(255,190,215,.10)" : "rgba(0,0,0,.28)"; ctx.lineWidth = 1;
      for (var y = -40; y <= 40; y += 4.5 + p.tone * 2) { ctx.beginPath(); ctx.moveTo(-90, y + Math.sin(y * 0.7 + p.tone * 9) * 1.2); ctx.lineTo(90, y - Math.sin(y * 0.5 + p.tone * 7) * 1.2); ctx.stroke(); }
      ctx.restore();
    }
    if (!p.ring && p.role === "nacre") {                                                          // two flat facets, no gradient
      ctx.save(); pathOf(ctx, p.pts); ctx.clip();
      var mx = 0, my = 0; p.pts.forEach(function (q) { mx += q[0]; my += q[1]; }); mx /= p.pts.length; my /= p.pts.length;
      ctx.translate(mx, my); ctx.rotate(longestEdgeAngle(p.pts) + 0.6);
      ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.fillRect(-120, -120, 240, 120);
      ctx.restore();
    }
    ctx.lineJoin = "miter"; ctx.lineWidth = o.kerf || 1.5; ctx.strokeStyle = C.kerf;
    if (p.ring) p.loops.forEach(function (lp) { pathOf(ctx, lp); ctx.stroke(); }); else { pathOf(ctx, p.pts); ctx.stroke(); }    // the glue joint
    ctx.restore();
  }
  function drawPieces(ctx, pieces, o) { pieces.forEach(function (p) { drawPiece(ctx, p, o); }); }

  /* ---------- an over-under interlace ring {n/k}: alternation at TRUE crossings ---------- */
  function interlace(cx, cy, r, n, k, w, cols) {
    var V = []; for (var i = 0; i < n; i++) { var a = rad(-90 + 360 * (i * k % n) / n); V.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    var segs = V.map(function (p, i) { return [p, V[(i + 1) % n]]; }), ev = [];
    function inter(s, t) {
      var p = s[0], r1 = [s[1][0] - p[0], s[1][1] - p[1]], q = t[0], s1 = [t[1][0] - q[0], t[1][1] - q[1]];
      var den = r1[0] * s1[1] - r1[1] * s1[0]; if (Math.abs(den) < 1e-9) return null;
      var u = ((q[0] - p[0]) * s1[1] - (q[1] - p[1]) * s1[0]) / den, v = ((q[0] - p[0]) * r1[1] - (q[1] - p[1]) * r1[0]) / den;
      return (u > 1e-6 && u < 1 - 1e-6 && v > 1e-6 && v < 1 - 1e-6) ? [u, v] : null;
    }
    for (i = 0; i < n; i++) for (var j = i + 1; j < n; j++) { var x = inter(segs[i], segs[j]); if (x) { ev.push({ a: i, ta: x[0], b: j, tb: x[1] }); } }
    var visits = []; ev.forEach(function (e) { visits.push({ seg: e.a, t: e.ta, e: e }); visits.push({ seg: e.b, t: e.tb, e: e }); });
    visits.sort(function (p, q) { return p.seg - q.seg || p.t - q.t; });
    visits.forEach(function (v, idx) { v.over = idx % 2 === 0; });
    return { segs: segs, visits: visits, w: w, cols: cols, V: V };
  }
  function drawInterlace(ctx, L, opt) {
    var f = (opt && opt.progress) === undefined ? 1 : opt.progress;
    function strand(s, col, t0, t1, wide) {
      var a = s[0], b = s[1];
      ctx.beginPath(); ctx.moveTo(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0); ctx.lineTo(a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1);
      ctx.lineCap = "butt"; ctx.strokeStyle = col; ctx.lineWidth = wide; ctx.stroke();
    }
    L.segs.forEach(function (s, i) { var col = L.cols[i % L.cols.length]; strand(s, C.kerf, 0, 1, L.w + 5); strand(s, col, 0, 1, L.w); });
    var pad = (L.w * 1.6);
    L.visits.forEach(function (v) {
      if (!v.over) return;
      var s = L.segs[v.seg], len = Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]), d = pad / len;
      var col = L.cols[v.seg % L.cols.length];
      strand(s, C.nuit, Math.max(0, v.t - d - 0.012), Math.min(1, v.t + d + 0.012), L.w + 11);   // the gap the under strand passes through
      strand(s, C.kerf, Math.max(0, v.t - d), Math.min(1, v.t + d), L.w + 5);
      strand(s, col, Math.max(0, v.t - d), Math.min(1, v.t + d), L.w);
    });
  }

  g.Damas = { C: C, Registry: Registry, cell: cell, buildLid: buildLid, buildKhatam: buildKhatam, drawPiece: drawPiece, drawPieces: drawPieces, interlace: interlace, drawInterlace: drawInterlace, r01: r01, rad: rad, mixHex: mixHex };
})(window);
