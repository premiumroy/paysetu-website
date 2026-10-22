/* ==========================================================================
   PaySetu - motion.js
   The live layer behind the page.

   One canvas, two cached sprites per colour field, and a perspective grid
   that recedes toward a vanishing point the pointer can move. The grid is
   what reads as depth: lines running to the vanishing point, and lines
   travelling toward the viewer with quadratic spacing, which is how a real
   floor looks. The four colour fields drift over it on their own clocks.

   Everything is drawn with drawImage and straight lines - no filters, no
   per-frame gradients - so a frame costs a handful of calls. It stops when
   the tab is hidden, renders one still frame when the visitor asks for
   reduced motion, and follows the light/dark switch.
   ========================================================================== */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;
  var root = document.documentElement;

  var pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  window.addEventListener("pointermove", function (e) {
    pointer.tx = e.clientX / window.innerWidth;
    pointer.ty = e.clientY / window.innerHeight;
  }, { passive: true });

  /* ---------- the phone tilts toward the pointer ------------------------- */
  var phone = document.querySelector("[data-phone]");
  if (phone && phone.parentNode && !reduce && fine) {
    var tilt = document.createElement("div");
    tilt.className = "tilt3d";
    phone.parentNode.insertBefore(tilt, phone);
    tilt.appendChild(phone);
    var stage = tilt.closest(".stage") || tilt.parentNode;
    stage.addEventListener("pointermove", function (e) {
      var r = stage.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = "rotateY(" + (px * 15).toFixed(2) + "deg) rotateX(" + (-py * 12).toFixed(2) + "deg)";
    }, { passive: true });
    stage.addEventListener("pointerleave", function () { tilt.style.transform = ""; });
  }

  var canvas = document.getElementById("motion");
  if (!canvas) return;
  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = 0, h = 0, horizon = 0, scrollY = 0, running = true, light = false;
  var sprites = [];

  var FIELDS = [
    { c: "--indigo", r: 0.62, x: 0.16, y: 0.20, ax: 0.13, ay: 0.09, sp: 0.000060, a: 0.42 },
    { c: "--cyan", r: 0.54, x: 0.86, y: 0.26, ax: 0.10, ay: 0.12, sp: 0.000045, a: 0.34 },
    { c: "--green", r: 0.50, x: 0.52, y: 0.86, ax: 0.15, ay: 0.07, sp: 0.000075, a: 0.30 },
    { c: "--saffron", r: 0.34, x: 0.28, y: 0.60, ax: 0.18, ay: 0.13, sp: 0.000052, a: 0.20 }
  ];

  function hexToRgb(value, fallback) {
    var h = (value || "").trim();
    if (h.charAt(0) !== "#") return fallback;
    if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    return parseInt(h.slice(1, 3), 16) + "," + parseInt(h.slice(3, 5), 16) + "," + parseInt(h.slice(5, 7), 16);
  }

  function makeSprite(rgb, alpha) {
    var size = 256;
    var c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    var g = c.getContext("2d");
    var grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, "rgba(" + rgb + "," + alpha + ")");
    grd.addColorStop(0.55, "rgba(" + rgb + "," + (alpha * 0.34).toFixed(3) + ")");
    grd.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return c;
  }

  function buildSprites() {
    var cs = getComputedStyle(root);
    light = root.getAttribute("data-theme") === "light";
    sprites = FIELDS.map(function (f) {
      var rgb = hexToRgb(cs.getPropertyValue(f.c), "120,130,180");
      return makeSprite(rgb, light ? f.a * 0.5 : f.a);
    });
  }

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    horizon = h * 0.36;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function grid(t) {
    var vx = w * (0.5 + (pointer.x - 0.5) * 0.16);
    var vy = horizon + (pointer.y - 0.5) * 26;
    var drift = (t * 0.000045) + scrollY * 0.00042;
    var tone = light ? "70,90,150," : "150,170,255,";
    var scale = light ? 0.6 : 1;

    ctx.lineWidth = 1;

    for (var i = -12; i <= 12; i++) {
      var a = i * 0.16 + (pointer.x - 0.5) * 0.09;
      ctx.strokeStyle = "rgba(" + tone + Math.max(0, (0.105 - Math.abs(i) * 0.0042) * scale).toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.lineTo(vx + Math.sin(a) * w * 2.4, vy + Math.cos(a) * h * 2.4);
      ctx.stroke();
    }

    var rows = 20;
    for (var k = 0; k < rows; k++) {
      var z = (k + (drift % 1)) / rows;
      var y = vy + (h - vy) * (z * z * 2.1);
      if (y < vy + 2 || y > h + 40) continue;
      ctx.strokeStyle = "rgba(" + tone + ((0.05 + z * 0.20) * scale).toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // a band of light sitting on the horizon, so the depth has a source
    var band = ctx.createLinearGradient(0, vy - h * 0.16, 0, vy + h * 0.06);
    band.addColorStop(0, "rgba(120,140,255,0)");
    band.addColorStop(0.72, light ? "rgba(90,110,190,0.10)" : "rgba(150,175,255,0.16)");
    band.addColorStop(1, "rgba(120,140,255,0)");
    ctx.fillStyle = band;
    ctx.fillRect(0, vy - h * 0.16, w, h * 0.22);
  }

  function fields(t) {
    ctx.globalCompositeOperation = light ? "source-over" : "screen";
    for (var i = 0; i < FIELDS.length; i++) {
      var f = FIELDS[i];
      var dx = Math.sin(t * f.sp + i * 1.7) * f.ax + (pointer.x - 0.5) * 0.06;
      var dy = Math.cos(t * f.sp * 1.3 + i * 2.1) * f.ay + (pointer.y - 0.5) * 0.04;
      var size = Math.max(w, h) * f.r * 2;
      ctx.drawImage(sprites[i], (f.x + dx) * w - size / 2, (f.y + dy) * h - size / 2, size, size);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function paint(t) {
    ctx.clearRect(0, 0, w, h);
    grid(t);
    fields(t);
  }

  function frame(t) {
    if (!running) return;
    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;
    paint(t);
    window.requestAnimationFrame(frame);
  }

  buildSprites();
  resize();
  window.addEventListener("resize", function () { resize(); paint(performance.now()); });
  window.addEventListener("scroll", function () { scrollY = window.scrollY || 0; }, { passive: true });

  var toggle = document.getElementById("theme");
  if (toggle) {
    toggle.addEventListener("click", function () {
      window.setTimeout(function () { buildSprites(); paint(performance.now()); }, 80);
    });
  }

  if (reduce) {
    paint(0);
    return;
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      window.requestAnimationFrame(frame);
    }
  });

  window.requestAnimationFrame(frame);
})();
