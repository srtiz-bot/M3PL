/* Marcana 3PL — shared UI interactions */
(function () {
  "use strict";

  /* ---- Header shadow on scroll ---- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Mobile menu toggle ---- */
  var toggle = document.querySelector(".nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      document.body.classList.toggle("menu-open");
      var open = document.body.classList.contains("menu-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---- Mobile dropdown (Services) accordion ---- */
  document.querySelectorAll(".has-drop > .nav-trigger").forEach(function (t) {
    t.addEventListener("click", function (e) {
      if (window.matchMedia("(max-width: 940px)").matches) {
        e.preventDefault();
        t.parentElement.classList.toggle("open");
      }
    });
  });

  /* ---- Close mobile menu when a link is tapped ---- */
  document.querySelectorAll(".nav-links a").forEach(function (a) {
    a.addEventListener("click", function () {
      document.body.classList.remove("menu-open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    });
  });

  /* ---- FAQ accordion ---- */
  document.querySelectorAll(".qa button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var item = btn.closest(".qa");
      var ans = item.querySelector(".ans");
      var isOpen = item.classList.contains("open");
      // optional: close siblings
      var parent = item.parentElement;
      parent.querySelectorAll(".qa.open").forEach(function (o) {
        if (o !== item) { o.classList.remove("open"); o.querySelector(".ans").style.maxHeight = null; o.querySelector("button").setAttribute("aria-expanded", "false"); }
      });
      if (isOpen) {
        item.classList.remove("open");
        ans.style.maxHeight = null;
        btn.setAttribute("aria-expanded", "false");
      } else {
        item.classList.add("open");
        ans.style.maxHeight = ans.scrollHeight + "px";
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  /* ---- Scroll reveal ---- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- Floating contact widget ---- */
  var fab = document.querySelector(".fab-wrap");
  var fabToggle = document.querySelector(".fab-toggle");
  if (fab && fabToggle) {
    fabToggle.addEventListener("click", function () {
      fab.classList.toggle("open");
      var open = fab.classList.contains("open");
      fabToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (!fab.contains(e.target)) fab.classList.remove("open");
    });
  }

  /* ---- Footer year ---- */
  var y = document.getElementById("yr");
  if (y) y.textContent = new Date().getFullYear();

  /* ---- Active nav link highlight ---- */
  var path = location.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
  document.querySelectorAll(".nav-links a[href]").forEach(function (a) {
    var href = a.getAttribute("href").replace(/\.html$/, "");
    if (href !== "/" && (path === href || path === href + "/")) {
      a.style.color = "var(--brand)";
      a.style.background = "var(--mist)";
    }
  });
})();
