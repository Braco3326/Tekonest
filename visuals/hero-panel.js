/* hero-panel: starts the panel's making animation inside figure.hero-panel on the home page.
   The poster (an <img>) is what loads first and stays in the DOM. This script only reveals the canvas when motion is allowed:
   not under prefers-reduced-motion, not under Save-Data, not without JavaScript. One pause button (aria-pressed); it goes away
   when the animation has finished. The animation holds its last frame, which is the poster. Plays once, never restarts. */
(function () {
  var fig = document.querySelector("figure.hero-panel");
  if (!fig) return;
  var cv = fig.querySelector("canvas.hero-panel__canvas"), btn = fig.querySelector("button.hero-panel__pause");
  if (!cv || !btn) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  if (reduce || saveData) return;

  var PAUSE = "Mettre en pause l'animation", RESUME = "Reprendre l'animation";
  var started = false, running = false, finished = false, userPaused = false, autoPaused = false;
  var elapsed = 0, last = 0, raf = 0, model = null, ctx = null, scale = 1, resizeTimer = 0;

  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), px = Math.round((fig.clientWidth || 560) * dpr);
    cv.width = px; cv.height = px; scale = px / 980; ctx = cv.getContext("2d");
  }
  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    window.Panel.render(ctx, 490, 490, model, Math.min(elapsed, model.duration), { live: true });
  }
  function frame(now) {
    if (!running) return;
    elapsed += last ? Math.min((now - last) / 1000, 0.1) : 0; last = now;
    draw();
    if (elapsed >= model.duration) { running = false; finished = true; btn.hidden = true; return; }
    raf = window.requestAnimationFrame(frame);
  }
  function play() { if (running || finished) return; running = true; last = 0; raf = window.requestAnimationFrame(frame); }
  function stop() { running = false; window.cancelAnimationFrame(raf); }

  function begin() {
    if (started) return;
    started = true;
    model = window.Panel.build(980, { seed: 1306, hand: 1.4 });
    window.Panel.warm(model);
    size(); draw();
    cv.hidden = false; btn.hidden = false; btn.textContent = PAUSE; btn.setAttribute("aria-pressed", "false");
    play();
  }

  btn.addEventListener("click", function () {
    if (finished) return;
    userPaused = !userPaused;
    btn.setAttribute("aria-pressed", String(userPaused)); btn.textContent = userPaused ? RESUME : PAUSE;
    if (userPaused) stop(); else play();
  });
  document.addEventListener("visibilitychange", function () {
    if (!started || finished) return;
    if (document.hidden) { if (running) { autoPaused = true; stop(); } }
    else if (autoPaused) { autoPaused = false; if (!userPaused) play(); }
  });
  window.addEventListener("resize", function () {
    if (!model) return;
    clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { size(); draw(); }, 150);
  });

  function arm() {
    if (!("IntersectionObserver" in window)) { begin(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && !document.hidden) { io.disconnect(); begin(); }
    }, { threshold: 0.4 });
    io.observe(fig);
  }
  function whenIdle() { (window.requestIdleCallback || function (f) { setTimeout(f, 300); })(arm); }
  if (document.readyState === "complete") whenIdle(); else window.addEventListener("load", whenIdle);
})();
