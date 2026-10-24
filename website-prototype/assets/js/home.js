/* Tekonest home.
   Hero canvas: Onde de Damas (background lines) + Médaillon {12/5} in a dodecagon
   + "Poussière → nid" then "le nid qui bat" (112 BPM, amber/plum ring each beat).
   "Son" button: optional Web Audio pulse locked to the visual beat (off by default).
   Direction section: a nest of light that slowly turns over the stage photo.
   prefers-reduced-motion: final state, no motion, no sound button. */
(function () {
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var C = { papier: "#F3EDE3", ambre: "#DD9349", prune: "#B5728F", noyer: "#8A6A4F" };
  var BEAT = 60 / 112, FORM = 2.6, PER = 150;
  var ease = function (t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 4); };
  var beatOrigin = 0; // ms timestamp of beat 0 (shared by visuals and sound)

  /* ---------- hero ---------- */
  var cv = document.getElementById("nid-stage");
  if (cv && cv.getContext) (function () {
    var ctx = cv.getContext("2d");
    var W = 0, H = 0, dpr = 1, g = {}, parts = [], t0 = 0, running = true, raf = 0;

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var r = cv.getBoundingClientRect(); W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var narrow = W < 760;
      var s = narrow ? Math.min(W * 0.56, 230) / 260 : Math.min(H * 0.62, W * 0.36) / 260;
      g = { cx: narrow ? W * 0.5 : W * 0.71, cy: narrow ? 48 + 130 * s : H * 0.5, s: s };
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
            t: t, sx: g.cx + Math.cos(a) * rr, sy: g.cy + Math.sin(a) * rr * 0.7, d: Math.random() * 0.8 + i * 0.05 });
        }
      }
      t0 = performance.now(); beatOrigin = t0 + FORM * 1000;
    }
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
        ctx.globalAlpha = j % 3 === 0 ? 0.09 : 0.14;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    function poly(R, step, n, rot) {
      ctx.beginPath();
      for (var k = 0; k <= n; k++) {
        var a = rot + (k * step % n) * 2 * Math.PI / n;
        var x = g.cx + R * Math.cos(a), y = g.cy + R * Math.sin(a);
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    function medaillon(alpha, spin) {
      var R = 140 * g.s;
      ctx.lineWidth = 1.2; ctx.strokeStyle = C.ambre;
      ctx.globalAlpha = 0.55 * alpha; poly(R, 5, 12, -Math.PI / 2 + spin);          // star {12/5}
      ctx.globalAlpha = 0.35 * alpha; poly(R * 1.2, 1, 12, -Math.PI / 2 + Math.PI / 12); // dodecagon frame
      ctx.beginPath(); ctx.arc(g.cx, g.cy, R * 1.08, 0, Math.PI * 2);
      ctx.globalAlpha = 0.22 * alpha; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    function frame(now) {
      var el = reduce ? 99 : (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      onde(reduce ? 0 : now);
      var settle = Math.min(1, Math.max(0, (el - 1.7) / 0.9));
      medaillon(settle, reduce ? 0 : now * 0.00002);
      var ph = (now - beatOrigin) / 1000 / BEAT;
      var env = (!reduce && ph > 0) ? Math.exp(-(ph % 1) * 5) : 0;
      var sc = 1 + 0.03 * env, lw = Math.max(1.6, 3.4 * g.s);
      if (settle < 1) {
        ctx.fillStyle = C.papier;
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i], k = ease((el - p.d) / 1.6);
          ctx.globalAlpha = (0.3 + 0.7 * k) * (1 - settle);
          ctx.fillRect(p.sx + (p.tx - p.sx) * k - 1, p.sy + (p.ty - p.sy) * k - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }
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
      if (!reduce && ph > 0) {
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

  /* ---------- sound: a soft pulse at 112 BPM, locked to the nest's beat ---------- */
  var sonBtn = document.getElementById("nid-son");
  if (sonBtn && !reduce && (window.AudioContext || window.webkitAudioContext)) {
    sonBtn.hidden = false;
    var ac = null, master = null, timer = 0, nextBeat = 0, on = false;
    function kick(t, accent) {
      var o = ac.createOscillator(), gn = ac.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(accent ? 92 : 78, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.6, t + 0.006);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      o.connect(gn).connect(master); o.start(t); o.stop(t + 0.45);
    }
    function pad() { // a quiet open fifth, the "room" of the nest
      [73.42, 110].forEach(function (f, i) {
        var o = ac.createOscillator(), gn = ac.createGain(), lp = ac.createBiquadFilter();
        o.type = "triangle"; o.frequency.value = f; lp.type = "lowpass"; lp.frequency.value = 420;
        gn.gain.value = i ? 0.035 : 0.05; o.connect(lp).connect(gn).connect(master); o.start();
      });
    }
    function schedule() {
      while (nextBeat < ac.currentTime + 0.25) {
        var n = Math.round((nextBeat - schedule.origin) / BEAT);
        kick(nextBeat, n % 4 === 0); nextBeat += BEAT;
      }
    }
    sonBtn.addEventListener("click", function () {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination); pad();
      }
      on = !on;
      sonBtn.setAttribute("aria-pressed", String(on));
      sonBtn.querySelector("span").textContent = on ? "Couper le son" : "Écouter le nid";
      if (on) {
        ac.resume();
        // next visual beat → audio clock
        var nowMs = performance.now(), ph = (nowMs - beatOrigin) / 1000 / BEAT;
        var wait = ph < 0 ? -ph * BEAT : (Math.ceil(ph) - ph) * BEAT;
        nextBeat = ac.currentTime + wait; schedule.origin = nextBeat;
        master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(0.5, ac.currentTime, 0.3);
        timer = setInterval(schedule, 60);
      } else {
        clearInterval(timer); master.gain.setTargetAtTime(0, ac.currentTime, 0.15);
      }
    });
    document.addEventListener("visibilitychange", function () { if (document.hidden && on) sonBtn.click(); });
  }

  /* ---------- direction: nest of light over the stage, turns slowly while in view ---------- */
  var halo = document.querySelector(".direction__halo");
  if (halo && !reduce && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { halo.classList.toggle("is-on", es[0].isIntersecting); }).observe(halo);
  }
})();
