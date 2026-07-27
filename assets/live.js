/* live.js — makes the Claude Design page functional.
   Injects a branded "Place a bid or an offer" modal wired straight to the
   DealDesk (POST /api/public-order, same origin via the public gateway), and
   opens it from the design's CTAs plus an always-present floating button.
   The bundled design is otherwise left untouched. */
(function () {
  var API_BASE = window.SCD_API_BASE || "";   // "" = same origin (gateway proxies /api)
  var GREEN = "#0e2b23", GOLD = "#b08a46", BRASS = "#d9be84",
      PAPER = "#efeadd", FIELD = "#f3ede0", SAGE = "#5e7a6e";

  var css = document.createElement("style");
  css.textContent = [
    "#scd-fab{position:fixed;right:20px;bottom:20px;z-index:99998;background:" + BRASS + ";color:" + GREEN + ";",
    "font:600 14px/1 Georgia,serif;letter-spacing:.02em;padding:14px 20px;border:none;border-radius:2px;cursor:pointer;",
    "box-shadow:0 6px 24px rgba(0,0,0,.28)}",
    "#scd-ov{position:fixed;inset:0;z-index:99999;background:rgba(8,15,13,.72);display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:40px 16px}",
    "#scd-ov.on{display:flex}",
    "#scd-modal{background:" + PAPER + ";color:" + GREEN + ";max-width:680px;width:100%;border:1px solid " + BRASS + ";border-radius:4px;",
    "font-family:Archivo,Helvetica,Arial,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.4)}",
    "#scd-modal .hd{background:" + GREEN + ";color:" + PAPER + ";padding:18px 24px;display:flex;justify-content:space-between;align-items:center}",
    "#scd-modal .hd h3{margin:0;font-family:Georgia,serif;font-weight:600;font-size:20px;letter-spacing:.01em}",
    "#scd-modal .hd button{background:none;border:none;color:" + BRASS + ";font-size:24px;cursor:pointer;line-height:1}",
    "#scd-modal .bd{padding:22px 24px}",
    "#scd-seg{display:flex;gap:10px;margin-bottom:16px}",
    "#scd-seg label{flex:1;border:1px solid #ccc3ab;border-radius:3px;padding:11px;text-align:center;cursor:pointer;font-weight:600;font-size:13px;background:" + FIELD + "}",
    "#scd-seg label.on{border-color:" + GREEN + ";box-shadow:inset 0 0 0 1px " + GREEN + "}",
    "#scd-g{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
    "@media(max-width:560px){#scd-g{grid-template-columns:1fr}}",
    "#scd-modal label.f{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:" + SAGE + "}",
    "#scd-modal input{font:inherit;font-weight:400;color:" + GREEN + ";background:#fff;border:1px solid #ccc3ab;border-radius:3px;padding:10px 11px}",
    "#scd-modal input:focus{outline:none;border-color:" + GOLD + "}",
    "#scd-act{display:flex;align-items:center;gap:14px;margin-top:18px}",
    "#scd-send{background:" + GREEN + ";color:" + PAPER + ";border:none;border-radius:2px;padding:13px 26px;font:600 14px Georgia,serif;cursor:pointer}",
    "#scd-msg{font-size:13px;margin:0}#scd-msg.ok{color:#2c8a5e;font-weight:600}#scd-msg.err{color:#b23b30;font-weight:600}",
    "#scd-note{color:" + SAGE + ";font-size:11px;margin-top:14px;text-transform:uppercase;letter-spacing:.08em}"
  ].join("");
  document.head.appendChild(css);

  var ov = document.createElement("div");
  ov.id = "scd-ov";
  ov.innerHTML =
    '<div id="scd-modal" role="dialog" aria-modal="true">' +
      '<div class="hd"><h3>Place a bid or an offer</h3><button type="button" id="scd-x" aria-label="Close">×</button></div>' +
      '<div class="bd">' +
        '<p style="margin:0 0 16px;color:' + SAGE + ';font-size:14px">Straight onto our desk. We see it in seconds and come back with a firm number. Held in confidence.</p>' +
        '<form id="scd-form">' +
          '<div id="scd-seg">' +
            '<label class="on"><input type="radio" name="side" value="Bid" checked hidden>I need capacity (bid)</label>' +
            '<label><input type="radio" name="side" value="Offer" hidden>I have capacity (offer)</label>' +
          '</div>' +
          '<div id="scd-g">' +
            '<label class="f">GPU / SKU<input name="sku" list="scd-skus" required placeholder="H100, H200, B200, GB300 NVL72"></label>' +
            '<datalist id="scd-skus"><option>H100</option><option>H200</option><option>B200</option><option>B300</option><option>GB300 NVL72</option><option>RTX PRO 6000</option></datalist>' +
            '<label class="f">GPU quantity<input name="quantity" required placeholder="e.g. 256 (32 nodes x 8)"></label>' +
            '<label class="f">Time to deployment<input name="availability" required placeholder="ready now / 2 weeks / Q4"></label>' +
            '<label class="f">Price ($/GPU-hr)<input name="price" required placeholder="e.g. 2.85"></label>' +
            '<label class="f">Interconnect<input name="interconnect" list="scd-ic" required placeholder="InfiniBand / RoCE / Ethernet"></label>' +
            '<datalist id="scd-ic"><option>InfiniBand</option><option>RoCE</option><option>Ethernet</option><option>NVLink</option></datalist>' +
            '<label class="f">Contact email<input name="email" type="email" required placeholder="you@company.ai"></label>' +
            '<label class="f">Phone<input name="phone" required placeholder="+41 ..."></label>' +
            '<label class="f">Secondary contact<input name="secondary_contact" placeholder="name / email / phone (optional)"></label>' +
          '</div>' +
          '<div id="scd-act"><button type="submit" id="scd-send">Send to the desk</button><p id="scd-msg" role="status"></p></div>' +
          '<p id="scd-note">Goes straight into our private DealDesk. We reply with a firm quote.</p>' +
        '</form>' +
      '</div>' +
    '</div>';
  var fab = document.createElement("button");
  fab.id = "scd-fab"; fab.type = "button"; fab.textContent = "Place a bid or an offer";

  function host() { return document.body || document.documentElement; }
  function ensure() {
    if (document.head && !document.getElementById("scd-style")) { css.id = "scd-style"; document.head.appendChild(css); }
    var h = host();
    if (h && !document.getElementById("scd-ov")) h.appendChild(ov);
    if (h && !document.getElementById("scd-fab")) h.appendChild(fab);
  }
  ensure();
  // the bundled design replaces the whole document — re-inject on a timer forever
  setInterval(ensure, 600);

  function setSide(side) {
    ov.querySelectorAll("#scd-seg label").forEach(function (l) {
      var on = l.querySelector("input").value === side;
      l.classList.toggle("on", on); l.querySelector("input").checked = on;
    });
  }
  function open(side) { if (side) setSide(side); ov.classList.add("on"); }
  function close() { ov.classList.remove("on"); }
  fab.onclick = function () { open(); };
  document.getElementById("scd-x").onclick = close;
  ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  // segmented control
  ov.querySelectorAll("#scd-seg label").forEach(function (l) {
    l.addEventListener("click", function () {
      ov.querySelectorAll("#scd-seg label").forEach(function (x) { x.classList.remove("on"); });
      l.classList.add("on"); l.querySelector("input").checked = true;
    });
  });

  // wire the design's own CTAs to open the modal (matched by text)
  var OFFER_KW = ["have supply", "have capacity", "have gpu", "i have", "place an offer", "sell capacity", "list capacity"];
  var BID_KW = ["have demand", "need gpu", "need capacity", "i need", "place a bid", "get a quote", "buy capacity"];
  var ANY_KW = ["requirement", "post to the desk", "send the ask", "send a requirement", "place a bid or an offer"];
  function wireCtas() {
    [].forEach.call(document.querySelectorAll("a,button"), function (el) {
      if (el.dataset.scdWired || (el.id && el.id.indexOf("scd-") === 0)) return;
      var t = (el.textContent || "").trim().toLowerCase();
      if (!t) return;
      var side = OFFER_KW.some(function (k) { return t.indexOf(k) !== -1; }) ? "Offer"
               : BID_KW.some(function (k) { return t.indexOf(k) !== -1; }) ? "Bid"
               : ANY_KW.some(function (k) { return t.indexOf(k) !== -1; }) ? "" : null;
      if (side === null) return;
      el.dataset.scdWired = "1";
      el.addEventListener("click", function (e) { e.preventDefault(); open(side); });
    });
  }
  wireCtas();
  setInterval(wireCtas, 1200);   // keep wiring as the bundled design (re)renders its CTAs

  /* ---- live data strip: real market ticker + live supply, fed by the desk ---- */
  function fmt(n) { return (Math.round(n * 100) / 100).toFixed(2); }
  var live = document.createElement("div");
  live.id = "scd-live";
  var lcss = document.createElement("style");
  lcss.id = "scd-live-style";
  lcss.textContent = [
    "#scd-live{position:fixed;top:0;left:0;right:0;z-index:99997;height:30px;display:flex;align-items:center;",
    "background:" + GREEN + ";color:" + PAPER + ";font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.03em;overflow:hidden;border-bottom:1px solid " + BRASS + "}",
    "#scd-live .tag{flex:0 0 auto;background:" + BRASS + ";color:" + GREEN + ";height:30px;display:flex;align-items:center;padding:0 12px;font-weight:700}",
    "#scd-live .win{flex:1 1 auto;overflow:hidden;white-space:nowrap}",
    "#scd-live .trk{display:inline-block;white-space:nowrap;padding-left:100%;animation:scdtape 40s linear infinite}",
    "#scd-live:hover .trk{animation-play-state:paused}",
    "@keyframes scdtape{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
    "#scd-live .up{color:#7ddc9b}#scd-live .down{color:#e88c8c}#scd-live b{color:" + BRASS + "}",
    "#scd-live .s{padding:0 14px}"
  ].join("");

  function loadLive() {
    Promise.all([
      fetch("/assets/market.json", { cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch("/assets/offers.json", { cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) {
      var m = res[0], o = res[1], seg = [];
      if (o && o.offers) seg.push('<span class="s"><b>LIVE SUPPLY</b> ' + o.offers.length + " lots on the desk</span>");
      if (o && o.offers) o.offers.slice(0, 10).forEach(function (c) {
        seg.push('<span class="s">' + esc(c.gpu) + " · " + esc(c.region) + " · " + esc(c.available) + "</span>");
      });
      if (m && m.items) {
        var arrow = { up: "▲", down: "▼", flat: "–" };
        if (m.index && m.index.value) seg.push('<span class="s"><b>' + esc(m.index.name) + "</b> $" + fmt(m.index.value) + "</span>");
        m.items.forEach(function (i) {
          seg.push('<span class="s">' + esc(i.sym) + " $" + fmt(i.price) + ' <i class="' + i.dir + '">' + arrow[i.dir] + "</i></span>");
        });
      }
      var run = seg.join('<span style="opacity:.35">·</span>');
      window.__scd_live = '<span class="tag">DESK · LIVE</span><div class="win"><div class="trk">' + run + '<span style="opacity:.35">·</span>' + run + "</div></div>";
      paintLive();
    });
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[<>&]/g, ""); }
  function paintLive() { if (window.__scd_live && live.innerHTML !== window.__scd_live) live.innerHTML = window.__scd_live; }

  // keep the live strip present (design re-renders) and nudge the page down under it
  var push = document.createElement("style");
  push.id = "scd-push"; push.textContent = "html{margin-top:30px!important}";
  function ensureLive() {
    if (document.head && !document.getElementById("scd-live-style")) document.head.appendChild(lcss);
    if (document.head && !document.getElementById("scd-push")) document.head.appendChild(push);
    var h = host();
    if (h && !document.getElementById("scd-live")) { h.appendChild(live); paintLive(); }
  }
  ensureLive();
  setInterval(ensureLive, 600);
  loadLive();
  setInterval(loadLive, 300000);

  // submit -> DealDesk
  document.getElementById("scd-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, msg = document.getElementById("scd-msg"), btn = document.getElementById("scd-send");
    var data = {}; new FormData(f).forEach(function (v, k) { data[k] = v; });
    btn.disabled = true; msg.className = ""; msg.textContent = "Sending to the desk...";
    fetch(API_BASE + "/api/public-order", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.ok) { f.reset(); ov.querySelector("#scd-seg label").classList.add("on");
        msg.className = "ok"; msg.textContent = "Received. Your " + (j.side || "order") + " is on our desk (ref " + j.id + "). We come back with a firm quote."; }
      else { msg.className = "err"; msg.textContent = "Please check: " + (j.error || "missing fields") + "."; }
    }).catch(function () {
      msg.className = "err"; msg.textContent = "Could not reach the desk. Email desk@swisscomputedesk.ch and we'll pick it up.";
    }).finally(function () { btn.disabled = false; });
  });
})();
