/* Tekonest home hero: Onde de Damas (background lines) + Médaillon {12/5}
   + "Poussière → nid" then "le nid qui bat" (~112 BPM, amber ring each beat).
   prefers-reduced-motion: final state drawn once, no motion. */
(function () {
  var cv = document.getElementById("nid-stage");
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext("2d");
  var C = { papier: "#F3EDE3", ambre: "#DD9349", prune: "#B5728F", noyer: "#8A6A4F" };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 0, H = 0, dpr = 1, g = {}, parts = [], t0 = 0, running = true, raf = 0;
  var PER = 150, BEAT = 60 / 112, FORM = 2.6;
  var ease = function (t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 4); };

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = cv.getBoundingClientRect(); W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var narrow = W < 760;
    var s = narrow ? Math.min(W * 0.6, 240) / 260 : Math.min(H * 0.78, W * 0.42) / 260;
    g = { cx: narrow ? W * 0.5 : W * 0.72, cy: narrow ? 30 + 130 * s : H * 0.5, s: s };
    build();
  }
  function build() {
    parts = [];
    for (var i = 0; i < 7; i++) {
      var rot = i * 2 * Math.PI / 7, ox = g.cx + 8 * g.s * Math.cos(rot), oy = g.cy + 8 * g.s * Math.sin(rot);
      for (var k = 0; k < PER; k++) {
        var t = k / PER * 2 * Math.PI, x = 100 * g.s * Math.cos(t), y = 82 * g.s * Math.sin(t);
        var a = Math.random() * Math.PI * 2, rr = Math.max(W, H) * (0.2 + Math.random() * 0.6);
        parts.push({ tx: ox + x * Math.cos(rot) - y * Math.sin(rot), ty: oy + x * Math.sin(rot) + y * Math.cos(rot),
          t: t, ei: i, sx: g.cx + Math.cos(a) * rr, sy: g.cy + Math.sin(a) * rr * 0.7, d: Math.random() * 0.8 + i * 0.05 });
      }
    }
    t0 = performance.now();
  }
  // Onde de Damas: layered sine lines folding like Damascus steel, tone on tone.
  function onde(time) {
    var n = 22, amp = H * 0.05;
    ctx.lineWidth = 1;
    for (var j = 0; j < n; j++) {
      var y0 = H * (j + 0.5) / n;
      ctx.beginPath();
      for (var x = 0; x <= W; x += 8) {
        var y = y0 + amp * Math.sin(x * 0.006 + j * 0.42 + time * 0.00025) * Math.sin(x * 0.0021 - j * 0.15)
          + amp * 0.5 * Math.sin(x * 0.013 + j * 0.9);
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = j % 3 === 0 ? C.ambre : C.noyer;
      ctx.globalAlpha = j % 3 === 0 ? 0.10 : 0.16;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // Médaillon: 12-point star {12/5}, hairline, behind the nest.
  function medaillon(alpha) {
    var R = 128 * g.s;
    ctx.beginPath();
    for (var k = 0; k <= 12; k++) {
      var a = -Math.PI / 2 + (k * 5 % 12) * 2 * Math.PI / 12;
      var x = g.cx + R * Math.cos(a), y = g.cy + R * Math.sin(a);
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = C.ambre; ctx.globalAlpha = 0.28 * alpha; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(g.cx, g.cy, R * 1.04, 0, Math.PI * 2); ctx.globalAlpha = 0.18 * alpha; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function frame(now) {
    var el = reduce ? 99 : (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    onde(reduce ? 0 : now);
    var settle = Math.min(1, Math.max(0, (el - 1.7) / 0.9));
    medaillon(settle);
    var ph = (el - FORM) / BEAT, env = (!reduce && el > FORM) ? Math.exp(-(ph % 1) * 5) : 0;
    var sc = 1 + 0.03 * env, lw = Math.max(1.6, 3.4 * g.s);
    // dust
    if (settle < 1) {
      ctx.fillStyle = C.papier;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i], k = ease((el - p.d) / 1.6);
        ctx.globalAlpha = (0.3 + 0.7 * k) * (1 - settle);
        ctx.fillRect(p.sx + (p.tx - p.sx) * k - 1, p.sy + (p.ty - p.sy) * k - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    // threads
    if (settle > 0) {
      for (var e = 0; e < 7; e++) {
        ctx.beginPath();
        for (var q = 0; q < PER; q++) {
          var pp = parts[e * PER + q];
          var n = reduce ? 0 : 1.4 * g.s * Math.sin(pp.t * 6 + now * 0.004 + e) * Math.sin(now * 0.0021 + e * 0.9);
          var dx = pp.tx - g.cx, dy = pp.ty - g.cy, L = Math.hypot(dx, dy) || 1;
          var x = g.cx + (dx + dx / L * n) * sc, y = g.cy + (dy + dy / L * n) * sc;
          q ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.strokeStyle = C.papier; ctx.globalAlpha = settle; ctx.lineWidth = lw; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // beat rings
    if (!reduce && el > FORM) {
      for (var r = 0; r < 3; r++) {
        if (ph < r) continue;
        var age = ((ph - r) % 3 + 3) % 3, a = Math.max(0, 0.5 - age * 0.18);
        ctx.beginPath(); ctx.arc(g.cx, g.cy, 112 * g.s * (1 + age * 0.3), 0, Math.PI * 2);
        ctx.strokeStyle = r % 2 ? C.prune : C.ambre; ctx.globalAlpha = a; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (running && !reduce) raf = requestAnimationFrame(frame);
  }
  function start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { size(); if (reduce) frame(0); }, 150); });
  if ("IntersectionObserver" in window && !reduce) {
    new IntersectionObserver(function (es) { es[0].isIntersecting ? start() : stop(); }).observe(cv);
  }
  document.addEventListener("visibilitychange", function () { if (reduce) return; document.hidden ? stop() : start(); });
  var replay = document.getElementById("nid-replay");
  if (replay) replay.addEventListener("click", function () { build(); if (reduce) frame(0); });
  size(); raf = requestAnimationFrame(frame);
})();
