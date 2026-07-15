/* Marcana 3PL — quote calculator + form handling
   ----------------------------------------------------------------------------
   FORMS: delivered by FormSubmit (https://formsubmit.co) — no account, no API
   key, no server. Submissions are emailed straight to info@marcana-3pl.com with
   the subject "Marcana 3PL Online form Submission".

   ONE-TIME ACTIVATION: the very first submission triggers a confirmation email
   to info@marcana-3pl.com. Click the activation link in that email once, and all
   future submissions deliver automatically. If a network error ever occurs, the
   form falls back to a one-click email / WhatsApp prompt so no lead is lost.
   ---------------------------------------------------------------------------- */
(function () {
  "use strict";

  var FORM_EMAIL = "info@marcana-3pl.com";
  var FORM_ENDPOINT = "https://formsubmit.co/ajax/" + FORM_EMAIL;
  var DEFAULT_SUBJECT = "Marcana 3PL Online form Submission";
  var WHATSAPP_URL = "https://wa.me/13054698607";

  // localization for dynamic strings (calculator + form)
  var ES = (document.documentElement.lang || "en").slice(0, 2) === "es";
  var T = {
    perOrder: ES ? " efectivo / pedido" : " effective / order",
    addOrders: ES ? "Agrega pedidos para ver tu tarifa" : "Add orders to see your rate",
    sending: ES ? "Enviando tu solicitud…" : "Sending your request…",
    sendingBtn: ES ? "Enviando…" : "Sending…",
    ok: ES ? "<strong>¡Gracias!</strong> Tu mensaje va en camino a nuestro equipo. Espera respuesta en un día hábil."
           : "<strong>Thanks!</strong> Your message is on its way to our team. Expect a reply within one business day.",
    failLead: ES ? "<strong>No pudimos conectar con el servidor.</strong> Envía tus datos en un clic: "
                 : "<strong>Couldn't reach the server.</strong> Send your details in one click: ",
    emailUs: ES ? "envíanos un correo" : "email us",
    waUs: ES ? "escríbenos por WhatsApp" : "WhatsApp us",
    orWord: ES ? " o " : " or "
  };

  /* =========================================================================
     QUOTE CALCULATOR
     Published pricing: $149/mo + $1.95 per order (up to 2 lb, 2 items).
     Additional item picks beyond 2 are an editable estimate ($0.35 each) and
     are clearly labelled. Carrier shipping is billed separately at cost.
     ========================================================================= */
  var calc = document.querySelector("[data-calc]");
  if (calc) {
    var BASE = 149;
    var PER_ORDER = 1.95;
    var EXTRA_ITEM = 0.35;

    var ordersInput = calc.querySelector("#orders");
    var ordersVal = calc.querySelector("#ordersVal");
    var itemsSeg = calc.querySelector("#itemsSeg");
    var totalEl = calc.querySelector("#calcTotal");
    var perOrderEl = calc.querySelector("#calcPerOrder");
    var rowBase = calc.querySelector("#rowBase");
    var rowOrders = calc.querySelector("#rowOrders");
    var rowExtra = calc.querySelector("#rowExtra");
    var rowExtraWrap = calc.querySelector("#rowExtraWrap");

    var items = 1;

    function money(n) {
      return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function money0(n) { return "$" + Math.round(n).toLocaleString("en-US"); }

    function update() {
      var orders = parseInt(ordersInput.value, 10) || 0;
      ordersVal.textContent = orders.toLocaleString("en-US");

      var orderCost = orders * PER_ORDER;
      var extraPicks = Math.max(0, items - 2);
      var extraCost = orders * extraPicks * EXTRA_ITEM;
      var total = BASE + orderCost + extraCost;

      totalEl.innerHTML = '<span class="cur">$</span>' + Math.round(total).toLocaleString("en-US");
      var perOrder = orders > 0 ? total / orders : 0;
      perOrderEl.textContent = orders > 0 ? money(perOrder) + T.perOrder : T.addOrders;

      rowBase.textContent = money0(BASE);
      rowOrders.textContent = orders.toLocaleString("en-US") + " × $1.95 = " + money0(orderCost);
      if (extraPicks > 0) {
        rowExtraWrap.style.display = "";
        rowExtra.textContent = "+" + money0(extraCost);
      } else {
        rowExtraWrap.style.display = "none";
      }
    }

    ordersInput.addEventListener("input", update);
    itemsSeg.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        itemsSeg.querySelectorAll("button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        items = parseInt(b.dataset.items, 10) || 1;
        update();
      });
    });
    update();
  }

  /* =========================================================================
     FORMS  (contact + quote request) — via FormSubmit
     ========================================================================= */
  function prettyLabel(k) {
    return k.replace(/^_+/, "").replace(/_/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  document.querySelectorAll("form[data-form]").forEach(function (form) {
    var statusEl = form.querySelector(".form-status");
    var submitBtn = form.querySelector("[type=submit]");
    var submitLabel = submitBtn ? submitBtn.textContent : "Submit";

    function setStatus(type, html) {
      if (!statusEl) return;
      statusEl.className = "form-status show " + type;
      statusEl.innerHTML = html;
    }

    function mailtoFallback(data, subject) {
      var lines = Object.keys(data)
        .filter(function (k) { return k.charAt(0) !== "_"; })
        .map(function (k) { return prettyLabel(k) + ": " + data[k]; });
      var mailto = "mailto:" + FORM_EMAIL + "?subject=" + encodeURIComponent(subject) +
                   "&body=" + encodeURIComponent(lines.join("\n"));
      setStatus("info",
        T.failLead +
        '<a href="' + mailto + '" style="text-decoration:underline;color:inherit"><strong>' + T.emailUs + '</strong></a>' +
        T.orWord + '<a href="' + WHATSAPP_URL + '" target="_blank" rel="noopener" style="text-decoration:underline;color:inherit"><strong>' + T.waUs + '</strong></a>.');
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var data = Object.fromEntries(new FormData(form).entries());
      data["Submitted from page"] = location.pathname + (ES ? "  (Español)" : "  (English)");
      var subject = form.dataset.subject || DEFAULT_SUBJECT;
      var payload = Object.assign({
        _subject: subject,
        _template: "table",
        _captcha: "false"
      }, data);

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = T.sendingBtn; }
      setStatus("info", T.sending);

      fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (res) {
          if (res && (res.success === true || res.success === "true")) {
            try {
              var ft = form.getAttribute("data-form") || "site_form";
              window.dataLayer = window.dataLayer || [];
              window.dataLayer.push({ event: "generate_lead", form_type: ft, form_name: subject, language: ES ? "es" : "en" });
              if (typeof window.gtag === "function") window.gtag("event", "generate_lead", { form_type: ft, form_name: subject, language: ES ? "es" : "en" });
            } catch (e) {}
            setStatus("ok", T.ok);
            form.reset();
          } else {
            mailtoFallback(data, subject);
          }
        })
        .catch(function () { mailtoFallback(data, subject); })
        .finally(function () {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitLabel; }
        });
    });
  });
})();
