/* Swiss Compute Desk - front end.
 *
 * CONFIG. Point these at the internal deal desk once the Apps Script gateway
 * is deployed (see gpu-brokering-os). Leave blank to run in static mode, where
 * live offers come from assets/offers.json and forms fall back to email.
 */
const SCD = {
  // Apps Script web app URL (legacy path).
  GATEWAY_URL: "",
  // Base for the live DealDesk API (bid/offer submit). Empty = same origin,
  // which is how the public gateway serves it (it proxies /api/* to the desk).
  API_BASE: "",
  // Business inbox used for the email fallback.
  EMAIL: "desk@swisscomputedesk.ch",
  // Live data files (served next to the site by the public gateway).
  OFFERS_FALLBACK: "/assets/offers.json",
  MARKET_FEED: "/assets/market.json"
};

/* ---------- market ticker (Bloomberg-style strip) ---------- */
async function loadMarket() {
  const strip = document.getElementById("ticker-track");
  if (!strip) return;
  let d;
  try { d = await (await fetch((SCD.API_BASE || "") + SCD.MARKET_FEED, { cache: "no-store" })).json(); }
  catch (e) { return; }
  const arrow = { up: "▲", down: "▼", flat: "–" };
  const items = (d.items || []).map(function (i) {
    return '<span class="tk"><b>' + i.sym + '</b> $' + i.price.toFixed(2) +
      ' <i class="' + i.dir + '">' + arrow[i.dir] + " " + Math.abs(i.chg).toFixed(1) +
      "%</i></span>";
  });
  if (d.index && d.index.value)
    items.unshift('<span class="tk idx"><b>' + d.index.name + "</b> $" +
      d.index.value.toFixed(2) + "</span>");
  // duplicate the run so the marquee loops seamlessly
  const run = items.join('<span class="dot">·</span>');
  strip.innerHTML = run + '<span class="dot">·</span>' + run;
  const stamp = document.getElementById("ticker-asof");
  if (stamp) stamp.textContent = "indicative · " + (d.asof || "");
}

/* ---------- bid / offer submission into the DealDesk ---------- */
function wireOrderForm() {
  const form = document.getElementById("order-form");
  if (!form) return;
  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const msg = form.querySelector(".form-msg");
    const btn = form.querySelector("button[type=submit]");
    const data = Object.fromEntries(new FormData(form).entries());
    btn.disabled = true; if (msg) { msg.textContent = "Sending to the desk..."; msg.className = "form-msg"; }
    try {
      const r = await fetch((SCD.API_BASE || "") + "/api/public-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const j = await r.json();
      if (j.ok) {
        form.reset();
        if (msg) { msg.textContent = "Received. Your " + (j.side || "order") +
          " is on our desk (ref " + j.id + "). We come back with a firm quote."; msg.className = "form-msg ok"; }
      } else {
        if (msg) { msg.textContent = "Please check: " + (j.error || "missing fields") + "."; msg.className = "form-msg err"; }
      }
    } catch (e) {
      if (msg) { msg.textContent = "Could not reach the desk. Email " + SCD.EMAIL + " and we'll pick it up."; msg.className = "form-msg err"; }
    } finally { btn.disabled = false; }
  });
}

/* ---------- theme ---------- */
(function () {
  const root = document.documentElement;
  const saved = localStorage.getItem("scd-theme");
  if (saved) root.setAttribute("data-theme", saved);
  window.addEventListener("DOMContentLoaded", function () {
    const btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      const cur = root.getAttribute("data-theme");
      const next = cur === "dark" ? "light" : (cur === "light" ? "dark" : (matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark"));
      root.setAttribute("data-theme", next);
      localStorage.setItem("scd-theme", next);
    });
  });
})();

/* ---------- live offers ---------- */
async function loadOffers() {
  const mount = document.getElementById("offers-body");
  if (!mount) return;
  const stamp = document.getElementById("offers-stamp");
  let rows = [];
  try {
    const src = SCD.GATEWAY_URL ? SCD.GATEWAY_URL + "?feed=offers" : (SCD.API_BASE || "") + SCD.OFFERS_FALLBACK;
    const res = await fetch(src, { cache: "no-store" });
    const data = await res.json();
    rows = Array.isArray(data) ? data : (data.offers || []);
  } catch (e) {
    try {
      const res = await fetch(SCD.OFFERS_FALLBACK, { cache: "no-store" });
      rows = (await res.json()).offers || [];
    } catch (_) { rows = []; }
  }
  const empty = document.getElementById("offers-empty");
  if (!rows.length) { if (empty) empty.style.display = "block"; return; }
  if (empty) empty.style.display = "none";
  mount.innerHTML = rows.map(function (o) {
    return "<tr>" +
      td(o.gpu) + td(o.qty) + td(o.region) + td(o.term) +
      td(o.interconnect || "") + td(o.available || "") + td(o.indicative || "on request") +
      "</tr>";
  }).join("");
  if (stamp) {
    const d = new Date();
    stamp.textContent = "Live from the desk book. Last sync " +
      d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  }
}
function td(v) { return "<td>" + String(v == null ? "" : v).replace(/[<>&]/g, "") + "</td>"; }

/* ---------- forms ---------- */
function wireForm(form) {
  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data._kind = form.getAttribute("data-kind") || "message";
    data._page = location.pathname;
    const msg = form.querySelector(".form-msg");
    const btn = form.querySelector("button[type=submit]");
    if (SCD.GATEWAY_URL) {
      try {
        if (btn) { btn.disabled = true; btn.textContent = "Sending"; }
        await fetch(SCD.GATEWAY_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight to Apps Script
          body: JSON.stringify(data)
        });
        show(msg, "Received. We come back inside one working day.");
        form.reset();
      } catch (e) {
        mailtoFallback(form, data);
        show(msg, "Opening your mail client so nothing is lost.");
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || "Send"; }
      }
    } else {
      mailtoFallback(form, data);
      show(msg, "Your mail client is opening with the request filled in. Send it and we take it from there.");
    }
  });
}
function mailtoFallback(form, data) {
  const subj = (form.getAttribute("data-kind") === "capacity-offer")
    ? "Capacity offer via swisscomputedesk.ch"
    : "GPU capacity request via swisscomputedesk.ch";
  const body = Object.keys(data)
    .filter(function (k) { return k[0] !== "_"; })
    .map(function (k) { return k.replace(/_/g, " ") + ": " + data[k]; })
    .join("\n");
  location.href = "mailto:" + SCD.EMAIL + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
}
function show(el, text) { if (!el) return; el.textContent = text; el.classList.add("show"); }

window.addEventListener("DOMContentLoaded", function () {
  loadOffers();
  loadMarket();
  wireOrderForm();
  document.querySelectorAll("form.desk").forEach(wireForm);
});
setInterval(loadMarket, 300000);   // refresh the ticker every 5 min
