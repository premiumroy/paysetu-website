/* Apply the saved theme before first paint, so there is no flash of the wrong one. */
  (function () {
    var d = document.documentElement;
    d.classList.add("js");
    try {
      var t = localStorage.getItem("paysetu-theme");
      d.setAttribute("data-theme", t === "light" ? "light" : "dark");
    } catch (e) { d.setAttribute("data-theme", "dark"); }
  })();
