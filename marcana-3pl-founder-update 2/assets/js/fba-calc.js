/* Marcana 3PL — FBA Prep Quote Calculator
   Pricing logic per handoff (LOCKED). Submits the full quote to info@marcana-3pl.com
   via FormSubmit (same inbox as the rest of the site) and sends the customer a
   confirmation auto-reply (the on-screen number is an ESTIMATE, confirmed after review).
   Bilingual: reads <html lang>. */
(function () {
  "use strict";
  var ES = (document.documentElement.lang || "en").slice(0, 2) === "es";
  var FORM_ENDPOINT = "https://formsubmit.co/ajax/info@marcana-3pl.com";
  var BOOKING = "https://calendar.app.google/SHJyJA1QesFnZVXs6";
  var WHATSAPP = "https://wa.me/13054698607";

  var CFG = {
    cartonRecv: 5, palletRecv: 25, container: { "20": 250, "40": 450 }, skuSetup: 5, monthly: 49,
    prep: {
      fnsku:    [[500, 0.55], [2000, 0.50], [5000, 0.42], [Infinity, 0.35]],
      standard: [[500, 1.25], [2000, 1.00], [5000, 0.85], [Infinity, 0.70]],
      fragile:  [[500, 1.75], [2000, 1.50], [5000, 1.35], [Infinity, 1.20]],
      forward:  [[2000, 0.25], [5000, 0.20], [Infinity, 0.15]]
    },
    addon: { expiration: 0.10, relabel: 0.10 },
    sizeMult: { small: 1.00, medium: 1.35, large: 1.85 },
    spdBox: 3.50, palletBuild: 25, plan: 20, storagePalletMo: 35, MIN: 75
  };

  var STR = ES ? {
    prep: { fnsku: "solo etiqueta FNSKU", standard: "etiqueta + poly bag + sello anti-asfixia", fragile: "etiqueta + burbuja", forward: "recibir y reenviar, sin etiquetar" },
    size: { small: "pequeño", medium: "mediano", large: "grande" },
    addon: { expiration: "etiqueta de fecha", relabel: "reetiquetado" },
    perUnit: " / unidad (prep)", enter: "ingresa los datos de tu envío",
    recv: "Recepción e inspección", prepL: "Prep FBA", add: "Extras", sku: "Manejo multi-SKU",
    out: "Prep de salida", plans: "planes de envío FBA", storage: "Almacenaje", minAdj: "Ajuste por mínimo",
    total: "TOTAL DE PREP (única vez)", monthly: "Cuota mensual de cuenta",
    note: "Nota: solo prep — el flete de salida a Amazon no está incluido. Estimado se confirma tras revisar el producto.",
    err: "Ingresa tu nombre, un correo válido, el plazo y la frecuencia.",
    okT: "¡Gracias", okB: " — tu estimado va en camino.</b><br>Es un <b>estimado</b>: revisaremos los detalles de tu producto y te enviaremos una cotización confirmada, normalmente el mismo día hábil. ¿Prefieres hablar?",
    book: "Reservar llamada", sending: "Enviando…", send: "Enviar mi cotización",
    auto: "Gracias por usar la calculadora de Prep FBA de Marcana 3PL. Recibimos tu estimado. Ten en cuenta que es un ESTIMADO — nuestro equipo revisará los detalles de tu producto y te enviará una cotización confirmada, normalmente en un día hábil. ¿Prefieres hablar? Reserva una llamada: " + BOOKING + ". — Marcana 3PL, Miami. Hablamos Español.",
    failLead: "No pudimos conectar con el servidor. Envíanos tu estimado por correo: ",
    head: "Estimado de Prep FBA — Marcana 3PL", inbound: "Entrada", unitsW: "Unidades", skusW: "SKUs"
  } : {
    prep: { fnsku: "FNSKU label only", standard: "label + poly bag + suffocation", fragile: "label + bubble wrap", forward: "receive & forward, no labeling" },
    size: { small: "small", medium: "medium", large: "large" },
    addon: { expiration: "date label", relabel: "relabel" },
    perUnit: " / unit (prep)", enter: "enter your shipment details",
    recv: "Receiving & inspection", prepL: "FBA prep", add: "Add-ons", sku: "Multi-SKU handling",
    out: "Outbound prep", plans: "FBA shipment plans", storage: "Storage", minAdj: "Minimum adjustment",
    total: "ONE-TIME PREP TOTAL", monthly: "Monthly account fee",
    note: "Note: prep only — outbound freight to Amazon not included. Estimate confirmed after product review.",
    err: "Please enter your name, a valid email, timeline and frequency.",
    okT: "Thanks", okB: " — your estimate is on its way.</b><br>This is an <b>estimate</b> — we'll review your product details and send a confirmed quote, usually the same business day. Prefer to talk now?",
    book: "Book a call", sending: "Sending…", send: "Email me this quote",
    auto: "Thanks for using the Marcana 3PL FBA Prep calculator. We've received your estimate. Please note this is an ESTIMATE — our team will review your product details and email you a confirmed quote, usually within one business day. Prefer to talk? Book a call: " + BOOKING + ". — Marcana 3PL, Miami. Hablamos Español.",
    failLead: "Couldn't reach the server. Email us your estimate: ",
    head: "FBA Prep Estimate — Marcana 3PL", inbound: "Inbound", unitsW: "Units", skusW: "SKUs"
  };

  var root = document.querySelector(".mfba");
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  function money(n, d) { d = d || 0; return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function rate(type, u) { var t = CFG.prep[type]; for (var i = 0; i < t.length; i++) { if (u < t[i][0]) return t[i][1]; } return t[t.length - 1][1]; }
  function pick(name, def) { return (document.querySelector("input[name=" + name + "]:checked") || {}).value || def; }
  function addons() { return Array.prototype.slice.call(document.querySelectorAll("#f-addons input:checked")).map(function (c) { return c.value; }); }
  var last = {};

  function calc() {
    var im = pick("inm", "cartons"), units = 0, recv = 0, recvD = "";
    if (im === "cartons") { var c = +$("in-cartons").value || 0, u = +$("in-upc").value || 0; units = c * u; recv = c * CFG.cartonRecv; recvD = c ? ("· " + c + " carton" + (c != 1 ? "s" : "") + " × $" + CFG.cartonRecv) : ""; }
    else if (im === "pallet") { var p = +$("in-pallets").value || 0; units = +$("in-units-p").value || 0; recv = p * CFG.palletRecv; recvD = p ? ("· " + p + " pallet" + (p != 1 ? "s" : "") + " × $" + CFG.palletRecv) : ""; }
    else { var sz2 = $("in-csize").value; units = +$("in-units-c").value || 0; recv = CFG.container[sz2]; recvD = "· " + sz2 + "ft container unload"; }
    $("f-units").textContent = units.toLocaleString("en-US");

    var type = pick("prep", "standard"), sz = pick("size", "small"), mult = CFG.sizeMult[sz], r = Math.round(rate(type, units) * mult * 100) / 100, prep = units * r;
    var fwd = (type === "forward");
    var addBox = $("addon-box"); if (addBox) { addBox.style.opacity = fwd ? "0.4" : "1"; addBox.style.pointerEvents = fwd ? "none" : "auto"; }
    document.querySelectorAll("#f-addons input").forEach(function (c) { c.disabled = fwd; if (fwd) { c.checked = false; if (c.parentNode) c.parentNode.classList.remove("sel"); } });
    var ad = fwd ? [] : addons(), adRate = ad.reduce(function (s, k) { return s + CFG.addon[k]; }, 0), addCost = units * adRate;
    var adNames = ad.map(function (k) { return STR.addon[k]; }).join(", ");

    var skus = Math.max(1, +$("in-skus").value || 1), skuFee = (skus - 1) * CFG.skuSetup;

    var om = pick("outm", "pallet"), out = 0, outD = "", dest = 0;
    if (om === "pallet") { var op = +$("out-pallets").value || 0; out = op * CFG.palletBuild; outD = op ? ("· " + op + " pallet" + (op != 1 ? "s" : "") + " × $" + CFG.palletBuild) : ""; dest = +$("out-dest").value || 0; }
    else { var ob = +$("out-boxes").value || 0; out = ob * CFG.spdBox; outD = ob ? ("· " + ob + " box" + (ob != 1 ? "es" : "") + " × $" + CFG.spdBox.toFixed(2)) : ""; dest = +$("out-dest2").value || 0; }
    dest = Math.max(0, dest); var plan = dest * CFG.plan;

    var storeOn = $("store-tog").checked, store = 0, storeD = "";
    if (storeOn) { var sp = +$("store-pallets").value || 0, sm = +$("store-months").value || 0; store = sp * sm * CFG.storagePalletMo; storeD = "· " + sp + " pallet" + (sp != 1 ? "s" : "") + " × " + sm + " mo × $" + CFG.storagePalletMo; }

    var subtotal = recv + prep + addCost + skuFee + out + plan + store;
    var minAdj = (units > 0 && subtotal < CFG.MIN) ? (CFG.MIN - subtotal) : 0;
    var total = subtotal + minAdj;

    $("r-recv-d").textContent = recvD; $("r-recv").textContent = money(recv);
    $("r-prep-d").textContent = units ? ("· " + units.toLocaleString("en-US") + " × $" + r.toFixed(2) + " (" + STR.prep[type] + ", " + STR.size[sz] + ")") : ""; $("r-prep").textContent = money(prep);
    $("r-add-row").style.display = ad.length ? "flex" : "none"; $("r-add-d").textContent = ad.length ? ("· " + units.toLocaleString("en-US") + " × $" + adRate.toFixed(2) + " (" + adNames + ")") : ""; $("r-add").textContent = money(addCost);
    $("r-sku-row").style.display = skuFee > 0 ? "flex" : "none"; $("r-sku-d").textContent = skuFee > 0 ? ("· " + (skus - 1) + " +SKU × $" + CFG.skuSetup) : ""; $("r-sku").textContent = money(skuFee);
    $("r-out-d").textContent = outD; $("r-out").textContent = money(out);
    $("r-plan-row").style.display = dest ? "flex" : "none"; $("r-plan-d").textContent = dest ? ("· " + dest + " × $" + CFG.plan) : ""; $("r-plan").textContent = money(plan);
    $("r-store-row").style.display = storeOn ? "flex" : "none"; $("r-store-d").textContent = storeD; $("r-store").textContent = money(store);
    $("r-min-row").style.display = minAdj > 0 ? "flex" : "none"; $("r-min").textContent = "+" + money(minAdj);
    $("r-total").textContent = money(total);
    $("r-per").textContent = units ? ("≈ " + money(total / units, 2) + STR.perUnit) : STR.enter;

    last = {
      inbound: im, units: units, skus: skus, prepType: STR.prep[type] + ", " + STR.size[sz], addons: adNames || "none",
      outbound: om, destinations: dest, storage: storeOn ? storeD.replace("· ", "") : "none",
      lines: { receiving: recv, prep: prep, addons: addCost, skuFee: skuFee, outbound: out, plans: plan, storage: store, minAdj: minAdj },
      total: total, perUnit: units ? total / units : 0, monthly: CFG.monthly
    };
  }

  function wireChips(sel) {
    var chips = document.querySelectorAll(sel + " .chip");
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        var inp = c.querySelector("input");
        if (inp.type === "radio") { chips.forEach(function (x) { x.classList.remove("sel"); }); c.classList.add("sel"); }
        else { setTimeout(function () { c.classList.toggle("sel", inp.checked); }, 0); }
        setTimeout(calc, 0);
      });
    });
  }
  wireChips("#in-method"); wireChips("#out-method"); wireChips("#f-prep"); wireChips("#f-size"); wireChips("#f-addons");
  document.querySelectorAll("input[name=inm]").forEach(function (r) { r.addEventListener("change", function () { document.querySelectorAll("[data-in]").forEach(function (el) { el.classList.toggle("show", el.getAttribute("data-in") === r.value); }); calc(); }); });
  document.querySelectorAll("input[name=outm]").forEach(function (r) { r.addEventListener("change", function () { document.querySelectorAll("[data-out]").forEach(function (el) { el.classList.toggle("show", el.getAttribute("data-out") === r.value); }); calc(); }); });
  $("store-tog").addEventListener("change", function () { document.querySelector("[data-store]").classList.toggle("show", this.checked); $("store-tog-l").textContent = this.checked ? (ES ? "✓ Almacenaje agregado" : "✓ Storage added") : (ES ? "+ Agregar almacenaje" : "+ Add storage"); calc(); });
  ["in-cartons", "in-upc", "in-pallets", "in-units-p", "in-units-c", "in-csize", "in-skus", "out-pallets", "out-dest", "out-boxes", "out-dest2", "store-pallets", "store-months"].forEach(function (id) { var e = $(id); if (e) e.addEventListener("input", calc); });

  function valid() { return $("c-name").value.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test($("c-email").value.trim()) && $("c-timeline").value && $("c-freq").value; }
  function summaryText() {
    var L = last.lines || {};
    var rows = [
      STR.recv + ": " + money(L.receiving),
      STR.prepL + " (" + last.prepType + ", " + last.units + " " + STR.unitsW.toLowerCase() + "): " + money(L.prep),
      (L.addons ? STR.add + " (" + last.addons + "): " + money(L.addons) : null),
      (L.skuFee ? STR.sku + " (" + last.skus + " SKUs): " + money(L.skuFee) : null),
      STR.out + " (" + last.outbound + "): " + money(L.outbound),
      (L.plans ? last.destinations + " " + STR.plans + ": " + money(L.plans) : null),
      (L.storage ? STR.storage + ": " + money(L.storage) : null),
      (L.minAdj ? STR.minAdj + ": " + money(L.minAdj) : null),
      STR.total + ": " + money(last.total) + " (≈" + money(last.perUnit, 2) + "/unit)",
      STR.monthly + ": " + money(last.monthly) + "/mo",
      STR.note
    ].filter(Boolean);
    return STR.head + "\n" + STR.inbound + ": " + last.inbound + " | " + STR.unitsW + ": " + last.units + " | " + STR.skusW + ": " + last.skus + "\n\n" + rows.join("\n");
  }

  $("c-send").addEventListener("click", function () {
    if (!valid()) { $("c-err").classList.add("show"); return; }
    $("c-err").classList.remove("show");
    var btn = $("c-send"), label = btn.textContent;
    var name = $("c-name").value.trim(), email = $("c-email").value.trim();
    var fields = {
      Name: name, email: email, Phone: $("c-phone").value.trim(), Company: $("c-company").value.trim(),
      Timeline: $("c-timeline").value, Frequency: $("c-freq").value,
      Product: $("c-desc").value.trim(), Link: $("c-url").value.trim(),
      "Estimated total": money(last.total), "Per unit": money(last.perUnit, 2),
      "Quote summary": summaryText(),
      "Form Type": ES ? "FBA Prep Quote (Español)" : "FBA Prep Quote (English)",
      "Submitted from page": location.pathname,
      _subject: "Marcana 3PL — FBA Prep Quote Request",
      _template: "table", _captcha: "false", _autoresponse: STR.auto
    };
    function ok() {
      try {
        var lv = (last && last.total) || 0;
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "generate_lead", form_type: "fba_prep_quote", language: ES ? "es" : "en", value: lv, currency: "USD" });
        if (typeof window.gtag === "function") window.gtag("event", "generate_lead", { form_type: "fba_prep_quote", language: ES ? "es" : "en", value: lv, currency: "USD" });
      } catch (e) {}
      $("lead-form").style.display = "none";
      var box = $("lead-ok"); box.classList.add("show");
      box.innerHTML = "<b>" + STR.okT + " " + name.replace(/[<>]/g, "") + STR.okB +
        ' <a href="' + BOOKING + '" target="_blank" rel="noopener" style="color:var(--teal-d);font-weight:700">' + STR.book + "</a>.";
    }
    function fail() {
      var body = encodeURIComponent(summaryText() + "\n\n— " + name + " / " + email);
      $("lead-err2") && $("lead-err2").remove();
      var p = document.createElement("p"); p.id = "lead-err2"; p.className = "consent";
      p.innerHTML = STR.failLead + '<a href="mailto:info@marcana-3pl.com?subject=' + encodeURIComponent("FBA Prep Quote — " + name) + "&body=" + body + '" style="color:var(--teal-d);font-weight:700;text-decoration:underline">info@marcana-3pl.com</a>.';
      btn.parentNode.parentNode.appendChild(p);
    }
    btn.disabled = true; btn.textContent = STR.sending;
    fetch(FORM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(fields) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (res) { if (res && (res.success === true || res.success === "true")) { ok(); } else { fail(); } })
      .catch(fail)
      .finally(function () { btn.disabled = false; btn.textContent = label; });
  });

  calc();
})();
