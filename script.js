/* ==========================================================================
   PaySetu — script.js
   Vanilla, no dependencies. Every effect degrades to "just show it" when the
   user prefers reduced motion, and nothing runs on the critical path.
   ========================================================================== */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- theme ------------------------------------------------------ */
  var root = document.documentElement;
  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "light" ? "#f4f6fb" : "#07090f");
  }
  // Dark is the designed default. The system preference is deliberately NOT followed -
  // the brief asks for a dark premium theme, and a first-time visitor should get it.
  var stored = null;
  try { stored = localStorage.getItem("paysetu-theme"); } catch (e) {}
  if (stored !== "light" && stored !== "dark") stored = "dark";
  applyTheme(stored);

  var themeBtn = $("#theme");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      applyTheme(next);
      try { localStorage.setItem("paysetu-theme", next); } catch (e) {}
    });
  }

  /* ---------- scroll progress + sticky nav ------------------------------- */
  var bar = $("#progress");
  var nav = $("#nav");
  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = "scaleX(" + (h > 0 ? Math.min(window.scrollY / h, 1) : 0) + ")";
    if (nav) nav.classList.toggle("is-stuck", window.scrollY > 12);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ------------------------------------------------ */
  var burger = $("#burger"), menu = $("#mobilemenu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", String(!open));
      menu.classList.toggle("is-open", !open);
    });
    $$("a", menu).forEach(function (a) {
      a.addEventListener("click", function () {
        burger.setAttribute("aria-expanded", "false");
        menu.classList.remove("is-open");
      });
    });
  }

  /* ---------- hero headline: word-by-word -------------------------------- */
  $$("[data-split-words]").forEach(function (el) {
    var words = [];
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        node.nodeValue.split(/(\s+)/).forEach(function (piece) {
          if (!piece.trim()) return;
          words.push({ text: piece, grad: false });
        });
      } else if (node.nodeType === 1) {
        var grad = node.classList.contains("w--grad");
        node.textContent.split(/(\s+)/).forEach(function (piece) {
          if (!piece.trim()) return;
          words.push({ text: piece, grad: grad });
        });
      }
    });
    el.textContent = "";
    words.forEach(function (w, i) {
      var span = document.createElement("span");
      span.className = "w" + (w.grad ? " w--grad" : "");
      span.textContent = w.text;
      span.style.animationDelay = (120 + i * 70) + "ms";
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
  });

  /* ---------- scroll reveal --------------------------------------------- */
  var revealables = $$(".reveal");
  var revealedSomething = false;
  function revealAll() { revealables.forEach(function (el) { el.classList.add("is-in"); }); }
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { revealedSomething = true; en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    revealables.forEach(function (el) { io.observe(el); });
    // Safety net: reveal anything the observer has not reached, whatever happened.
    // The old test was `if (!revealedSomething)`, which went quiet the moment a single
    // element revealed - so any section the observer skipped stayed invisible for good.
    setTimeout(revealAll, 1800);
  } else {
    revealAll();
  }

  /* ---------- counters --------------------------------------------------- */
  function runCounters(scope) {
    $$("[data-count]", scope).forEach(function (el) {
      var target = parseFloat(el.getAttribute("data-count")) || 0;
      var node = el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild : null;
      if (!node) return;
      if (reduce || target === 0) { node.nodeValue = String(target); return; }
      var start = performance.now(), dur = 1400;
      (function step(now) {
        var p = Math.min((now - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        node.nodeValue = String(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(step);
      })(start);
    });
  }
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { runCounters(en.target); cio.unobserve(en.target); }
      });
    }, { threshold: 0.3 });
    $$(".ledger").forEach(function (el) { cio.observe(el); });
  } else { runCounters(document); }

  /* ---------- cursor glow + card glow + magnetic buttons ----------------- */
  var cursor = $("#cursor");
  if (fine && cursor && !reduce) {
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2, tx = cx, ty = cy;
    window.addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY; cursor.classList.add("is-on");
    }, { passive: true });
    (function loop() {
      cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
      cursor.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
      requestAnimationFrame(loop);
    })();
  }

  if (fine && !reduce) {
    $$("[data-glow]").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%");
        card.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%");
      });
    });
    $$("[data-magnetic]").forEach(function (btn) {
      btn.addEventListener("mousemove", function (e) {
        var r = btn.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        btn.style.transform = "translate(" + (dx * 8).toFixed(1) + "px," + (dy * 6 - 2).toFixed(1) + "px)";
      });
      btn.addEventListener("mouseleave", function () { btn.style.transform = ""; });
    });
  }

  /* ---------- phone: hero cycle + parallax tilt -------------------------- */
  var heroPhone = $('[data-phone="cycle"]');
  if (heroPhone && !reduce) {
    var screens = $$(".screen", heroPhone), idx = 0;
    setInterval(function () {
      screens[idx].classList.remove("is-active");
      idx = (idx + 1) % screens.length;
      screens[idx].classList.add("is-active");
    }, 2800);
  }
  if (heroPhone && fine && !reduce) {
    var stage = heroPhone.closest(".stage") || heroPhone;
    stage.addEventListener("mousemove", function (e) {
      var r = stage.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      heroPhone.style.setProperty("--tilt-y", (dx * 12).toFixed(2) + "deg");
      heroPhone.style.setProperty("--tilt-x", (-dy * 10).toFixed(2) + "deg");
    });
    stage.addEventListener("mouseleave", function () {
      heroPhone.style.setProperty("--tilt-y", "0deg");
      heroPhone.style.setProperty("--tilt-x", "0deg");
    });
  }

  /* ---------- how it works: scroll-driven timeline ----------------------- */
  var stepsWrap = $("#steps");
  if (stepsWrap) {
    var stepEls = $$(".step", stepsWrap);
    var barEl = $("#stepsbar");
    var howPhone = $('[data-phone="steps"]');
    var order = ["scan", "dial", "bank", "done"];

    function syncSteps() {
      var r = stepsWrap.getBoundingClientRect();
      var centre = window.innerHeight * 0.5;
      var best = 0, bestDist = Infinity;
      stepEls.forEach(function (el, i) {
        var s = el.getBoundingClientRect();
        var d = Math.abs((s.top + s.height / 2) - centre);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      stepEls.forEach(function (el, i) { el.classList.toggle("is-active", i === best); });
      if (barEl) {
        var total = r.height || 1;
        var p = ((centre - r.top) / total) * 100;
        barEl.style.setProperty("--p", Math.max(0, Math.min(100, p)) + "%");
      }
      if (howPhone) {
        var want = order[best];
        $$(".screen", howPhone).forEach(function (sc) {
          sc.classList.toggle("is-active", sc.getAttribute("data-screen") === want);
        });
      }
    }
    window.addEventListener("scroll", syncSteps, { passive: true });
    window.addEventListener("resize", syncSteps);
    syncSteps();
  }

  /* ---------- FAQ accordion ---------------------------------------------- */
  $$(".q").forEach(function (q) {
    var btn = $(".q__btn", q), body = $(".q__body", q);
    if (!btn || !body) return;
    btn.addEventListener("click", function () {
      var open = q.classList.contains("is-open");
      $$(".q.is-open").forEach(function (other) {
        if (other !== q) {
          other.classList.remove("is-open");
          $(".q__btn", other).setAttribute("aria-expanded", "false");
          $(".q__body", other).style.maxHeight = "0px";
        }
      });
      q.classList.toggle("is-open", !open);
      btn.setAttribute("aria-expanded", String(!open));
      body.style.maxHeight = open ? "0px" : body.scrollHeight + "px";
    });
  });

  /* ---------- legal pages: sticky table of contents ---------------------- */
  var toc = $(".toc");
  if (toc && "IntersectionObserver" in window) {
    var heads = $$(".prose h2[id]");
    var links = {};
    $$("a", toc).forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    var tio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.remove("is-current"); });
        var a = links[en.target.id];
        if (a) a.classList.add("is-current");
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    heads.forEach(function (h) { tio.observe(h); });
  }
})();
