/* Nest: the Tekonest mark (seven woven ellipses) with a TRUE over-under weave.
   Geometry is the brand's: ellipses rx 100, ry 82, centres offset 8 units along each rotation, rotated by 360/7.
   Crossings are found numerically; over/under alternates along every ellipse, and the one free choice per ellipse
   is solved so that at every crossing exactly one of the two strands is over (always possible: every link
   diagram has an alternating version). Deterministic; no randomness. */
(function (g) {
  var TAU = Math.PI * 2;

  function ellipsePts(cx, cy, rx, ry, rot, n) {
    var c = Math.cos(rot), s = Math.sin(rot), P = [];
    for (var k = 0; k < n; k++) { var t = k / n * TAU; P.push([cx + rx * Math.cos(t) * c - ry * Math.sin(t) * s, cy + rx * Math.cos(t) * s + ry * Math.sin(t) * c]); }
    return P;
  }
  function segInter(p1, p2, p3, p4) {
    var d1x = p2[0] - p1[0], d1y = p2[1] - p1[1], d2x = p4[0] - p3[0], d2y = p4[1] - p3[1], den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-12) return null;
    var u = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / den, v = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / den;
    return (u >= 0 && u < 1 && v >= 0 && v < 1) ? [u, v] : null;
  }

  function build(cx, cy, sc, N) {
    N = N || 360;
    var E = [], i, a, b, j;
    for (i = 0; i < 7; i++) {
      var rot = i * TAU / 7;
      E.push(ellipsePts(cx + 8 * sc * Math.cos(rot), cy + 8 * sc * Math.sin(rot), 100 * sc, 82 * sc, rot, N));
    }
    var X = [];
    for (a = 0; a < 7; a++) for (b = a + 1; b < 7; b++) for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
      var r = segInter(E[a][i], E[a][(i + 1) % N], E[b][j], E[b][(j + 1) % N]);
      if (r) X.push({ a: a, b: b, pa: i + r[0], pb: j + r[1] });
    }
    // index of each crossing along its own ellipse
    var per = [[], [], [], [], [], [], []];
    X.forEach(function (c, ci) { per[c.a].push({ ci: ci, pos: c.pa, s: "a" }); per[c.b].push({ ci: ci, pos: c.pb, s: "b" }); });
    per.forEach(function (list) { list.sort(function (p, q) { return p.pos - q.pos; }).forEach(function (e, k) { X[e.ci]["k" + e.s] = k; }); });
    // solve the free parity bit of every ellipse by breadth-first search over the crossing graph
    var f = [0, null, null, null, null, null, null], queue = [0], guard = 0;
    while (queue.length && guard++ < 1000) {
      var u = queue.shift();
      X.forEach(function (c) {
        var need = (c.ka + c.kb + 1) & 1;                                  // f[a] xor f[b] must equal this
        if (c.a === u && f[c.b] === null) { f[c.b] = f[u] ^ need; queue.push(c.b); }
        if (c.b === u && f[c.a] === null) { f[c.a] = f[u] ^ need; queue.push(c.a); }
      });
    }
    var conflicts = 0;
    X.forEach(function (c) {
      var overA = ((c.ka + f[c.a]) % 2 === 0), overB = ((c.kb + f[c.b]) % 2 === 0);
      if (overA === overB) conflicts++;
      c.over = overA ? c.a : c.b;
    });
    return { E: E, X: X, N: N, f: f, conflicts: conflicts, sc: sc, cx: cx, cy: cy };
  }

  /* opts: w (strand width), gap (extra dark each side at a crossing), cols[7] (strand colours), ground (colour of the gap) */
  function draw(ctx, nest, o) {
    var w = o.w, gap = o.gap === undefined ? w * 0.45 : o.gap, N = nest.N;
    function trace(pts, from, to) {
      ctx.beginPath();
      for (var k = from; k <= to; k++) { var p = pts[((k % N) + N) % N]; k === from ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); }
    }
    ctx.lineJoin = "round"; ctx.lineCap = "butt";
    nest.E.forEach(function (pts, e) {
      ctx.beginPath(); pts.forEach(function (p, k) { k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath();
      ctx.strokeStyle = o.cols[e % o.cols.length]; ctx.lineWidth = w; ctx.stroke();
    });
    nest.X.forEach(function (c) {
      var e = c.over, pos = e === c.a ? c.pa : c.pb, pts = nest.E[e];
      var arc = 2 * Math.PI * 91 * nest.sc / N, m = Math.ceil((w + 2 * gap) * 1.1 / arc) + 1;
      trace(pts, Math.floor(pos) - m, Math.ceil(pos) + m); ctx.strokeStyle = o.ground; ctx.lineWidth = w + 2 * gap; ctx.stroke();
      trace(pts, Math.floor(pos) - m + 1, Math.ceil(pos) + m - 1); ctx.strokeStyle = o.cols[e % o.cols.length]; ctx.lineWidth = w; ctx.stroke();
    });
  }

  g.Nest = { build: build, draw: draw };
})(window);
