/* ============================================================
   Platho — about.platho.app
   - Signal field: a living lattice behind the whole page (canvas, fixed).
     Lattice nodes light up and link into short routes (information
     propagating), then fade as new ones spark. Soft "flashlights" roam and
     brighten the lattice beneath them. Everything snaps to lattice points.
     Fixed to the viewport, so it stays on screen while you scroll.
   - Decrypt headline (one pass), scroll reveal, FAQ accordion.
   No external dependencies, no inline code (CSP-clean).
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TEAL = "48, 213, 176";
  var TWO_PI = Math.PI * 2;

  /* ---------- Signal field (full-page canvas) ---------- */
  function initSignalField() {
    var canvas = document.getElementById("signal");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var GAP = 38;
    var AMBIENT = 0.11;   // base dot brightness everywhere
    var BOOST = 0.34;     // extra brightness inside a flashlight
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, cols = 0, rows = 0, ox = 0, oy = 0, cx = 0, cy = 0;
    var lights = [];

    function sizeLights() {
      var m = Math.min(W, H);
      if (!lights.length) {
        lights = [
          { x: W * 0.30, y: H * 0.34, ang: 0.8, sp: 92 },
          { x: W * 0.72, y: H * 0.66, ang: 3.7, sp: 72 }
        ];
      }
      var radii = [
        Math.max(240, Math.min(520, m * 0.44)),
        Math.max(180, Math.min(400, m * 0.30))
      ];
      for (var i = 0; i < lights.length; i++) {
        var L = lights[i];
        L.R = radii[i] || radii[radii.length - 1];
        L.r2 = L.R * L.R;
        if (L.x > W) L.x = W;
        if (L.y > H) L.y = H;
      }
    }

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      if (!W || !H) return;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / GAP) + 1;
      rows = Math.ceil(H / GAP) + 1;
      ox = (W - (cols - 1) * GAP) / 2;
      oy = (H - (rows - 1) * GAP) / 2;
      cx = W / 2;
      cy = H / 2;
      sizeLights();
    }

    function nx(c) { return ox + c * GAP; }
    function ny(r) { return oy + r * GAP; }

    // Gentle centre bias: a touch brighter mid-screen, softer at the edges.
    function edgeFade(x, y) {
      var dx = (x - cx) / (W * 0.5);
      var dy = (y - cy) / (H * 0.5);
      var d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      return 1 - 0.32 * d;
    }

    // Flashlight contribution at a point (0..1), using squared distance (no sqrt).
    function lightAt(x, y) {
      var b = 0;
      for (var i = 0; i < lights.length; i++) {
        var L = lights[i];
        var ddx = x - L.x, ddy = y - L.y;
        var d2 = ddx * ddx + ddy * ddy;
        if (d2 < L.r2) {
          var f = 1 - d2 / L.r2;
          f *= f;
          if (f > b) b = f;
        }
      }
      return b;
    }

    function drawDots() {
      for (var c = 0; c < cols; c++) {
        for (var r = 0; r < rows; r++) {
          var x = nx(c), y = ny(r);
          var lb = lightAt(x, y);
          var a = (AMBIENT + BOOST * lb) * edgeFade(x, y);
          ctx.beginPath();
          ctx.arc(x, y, 1.3 + 1.1 * lb, 0, TWO_PI);
          ctx.fillStyle = "rgba(" + TEAL + "," + a.toFixed(3) + ")";
          ctx.fill();
        }
      }
    }

    function updateLights(dt) {
      var s = dt / 1000;
      for (var i = 0; i < lights.length; i++) {
        var L = lights[i];
        L.ang += (Math.random() - 0.5) * 1.4 * s; // wander the heading
        L.x += Math.cos(L.ang) * L.sp * s;
        L.y += Math.sin(L.ang) * L.sp * s;
        if (L.x < 0) { L.x = 0; L.ang = Math.PI - L.ang; }
        else if (L.x > W) { L.x = W; L.ang = Math.PI - L.ang; }
        if (L.y < 0) { L.y = 0; L.ang = -L.ang; }
        else if (L.y > H) { L.y = H; L.ang = -L.ang; }
      }
    }

    var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    var signals = [];
    var HOP = 170;   // ms to traverse one edge
    var TAU = 620;   // trail fade time-constant (ms)

    function maxSignals() {
      return Math.min(24, Math.max(12, Math.round((W * H) / 26000)));
    }

    function spawn() {
      var path = [{ c: Math.floor(Math.random() * cols), r: Math.floor(Math.random() * rows) }];
      var len = 6 + Math.floor(Math.random() * 7); // 6..12 hops
      var prev = null;
      for (var i = 0; i < len; i++) {
        var cur = path[path.length - 1];
        var cand = [];
        for (var d = 0; d < DIRS.length; d++) {
          var nc = cur.c + DIRS[d][0], nr = cur.r + DIRS[d][1];
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          if (prev && nc === prev.c && nr === prev.r) continue;
          cand.push({ c: nc, r: nr });
        }
        if (!cand.length) break;
        path.push(cand[Math.floor(Math.random() * cand.length)]);
        prev = cur;
      }
      if (path.length >= 2) signals.push({ path: path, t: 0 });
    }

    function strokeEdge(x0, y0, x1, y1, a) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = "rgba(" + TEAL + "," + a.toFixed(3) + ")";
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    function litNode(x, y, inten, v) {
      if (inten > 0.55) {
        ctx.save();
        ctx.shadowColor = "rgba(" + TEAL + ",0.9)";
        ctx.shadowBlur = 10 * inten;
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + 2.4 * inten, 0, TWO_PI);
        ctx.fillStyle = "rgba(210, 255, 244," + (0.9 * inten * v).toFixed(3) + ")";
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 1.4 + 2 * inten, 0, TWO_PI);
        ctx.fillStyle = "rgba(" + TEAL + "," + (0.85 * inten * v).toFixed(3) + ")";
        ctx.fill();
      }
    }

    function drawSignals(dt) {
      for (var s = signals.length - 1; s >= 0; s--) {
        var sig = signals[s];
        sig.t += dt;
        var prog = sig.t / HOP;
        var hi = Math.floor(prog);
        var n = sig.path.length;
        var top = Math.min(hi, n - 1);

        for (var i = 0; i <= top; i++) {
          var since = (prog - i) * HOP;
          var inten = Math.exp(-since / TAU);
          if (inten < 0.02) continue;
          var p = sig.path[i];
          var x = nx(p.c), y = ny(p.r), v = edgeFade(x, y);
          if (i > 0) {
            var pp = sig.path[i - 1];
            strokeEdge(nx(pp.c), ny(pp.r), x, y, 0.5 * inten * v);
          }
          litNode(x, y, inten, v);
        }

        // Leading edge grows along the lattice from the last node toward the next.
        if (hi < n - 1) {
          var a = sig.path[hi], b = sig.path[hi + 1];
          var f = prog - hi;
          var ax = nx(a.c), ay = ny(a.r);
          var bx = nx(b.c), by = ny(b.r);
          strokeEdge(ax, ay, ax + (bx - ax) * f, ay + (by - ay) * f, 0.55 * edgeFade(ax, ay));
        }

        if (prog > (n - 1) + (TAU * 3) / HOP) signals.splice(s, 1);
      }
    }

    var raf = null, last = 0, acc = 0, gate = 0;

    function schedule() {
      if (raf === null) raf = requestAnimationFrame(frame);
    }

    function frame(now) {
      raf = null;
      var dt = last ? Math.min(now - last, 60) : 16;
      last = now;
      gate += dt;
      if (gate >= 30) {
        updateLights(gate);
        ctx.clearRect(0, 0, W, H);
        drawDots();
        acc += gate;
        if (acc > 240 && signals.length < maxSignals()) { spawn(); acc = 0; }
        drawSignals(gate);
        gate = 0;
      }
      schedule();
    }

    function paintOnce() {
      if (!W || !H) return;
      ctx.clearRect(0, 0, W, H);
      drawDots();
      drawSignals(0);
    }

    function staticFrame() {
      if (!W || !H) return;
      ctx.clearRect(0, 0, W, H);
      drawDots();
      var routes = [
        [[2, 3], [3, 3], [4, 4], [5, 4]],
        [[cols - 4, 2], [cols - 5, 3], [cols - 6, 3]],
        [[3, rows - 3], [4, rows - 4], [5, rows - 4]]
      ];
      for (var k = 0; k < routes.length; k++) {
        var rt = routes[k];
        for (var i = 0; i < rt.length; i++) {
          var x = nx(rt[i][0]), y = ny(rt[i][1]), v = edgeFade(x, y);
          if (i > 0) strokeEdge(nx(rt[i - 1][0]), ny(rt[i - 1][1]), x, y, 0.4 * v);
          litNode(x, y, 0.85, v);
        }
      }
    }

    resize();
    window.addEventListener("resize", function () {
      resize();
      if (reduceMotion) staticFrame(); else paintOnce();
    });
    document.addEventListener("visibilitychange", function () { last = 0; schedule(); });

    if (reduceMotion) { staticFrame(); return; }

    // Seed a few routes and paint immediately, so the field is alive on the first
    // frame and stays visible even if the host throttles requestAnimationFrame.
    for (var i = 0; i < maxSignals(); i++) {
      spawn();
      if (signals.length) signals[signals.length - 1].t = Math.random() * HOP * 4;
    }
    paintOnce();
    schedule();
  }

  /* ---------- Decrypt headline (subtle, runs once) ---------- */
  function initScramble() {
    var el = document.querySelector("[data-scramble]");
    if (!el) return;

    var lines = [];
    var current = "";
    Array.prototype.forEach.call(el.childNodes, function (node) {
      if (node.nodeName === "BR") { lines.push(current); current = ""; }
      else { current += node.textContent; }
    });
    lines.push(current);

    if (reduceMotion) return;

    var total = lines.reduce(function (sum, l) { return sum + l.length; }, 0);
    var pool = "ｱｲｳｴｵｶｷｸｹｺ0123456789=/*#$%@".split("");
    var revealed = 0;

    function rnd() { return pool[Math.floor(Math.random() * pool.length)]; }

    function render() {
      var idx = 0;
      el.innerHTML = lines.map(function (line) {
        var out = "";
        for (var i = 0; i < line.length; i++) {
          var c = line.charAt(i);
          if (c === " ") { out += " "; idx++; continue; }
          out += idx < revealed ? c : rnd();
          idx++;
        }
        return out;
      }).join("<br>");
    }

    var last = 0;
    function step(now) {
      if (now - last > 28) { revealed += 3; render(); last = now; }
      if (revealed < total) requestAnimationFrame(step);
      else el.innerHTML = lines.join("<br>");
    }
    render();
    requestAnimationFrame(step);
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    var items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(items, function (it) { it.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    Array.prototype.forEach.call(items, function (it) { io.observe(it); });
  }

  /* ---------- FAQ: single-open accordion ---------- */
  function initAccordion() {
    var root = document.querySelector("[data-accordion]");
    if (!root) return;
    var items = root.querySelectorAll("details");
    Array.prototype.forEach.call(items, function (d) {
      d.addEventListener("toggle", function () {
        if (!d.open) return;
        Array.prototype.forEach.call(items, function (other) {
          if (other !== d) other.open = false;
        });
      });
    });
  }

  function init() {
    initSignalField();
    initScramble();
    initReveal();
    initAccordion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
