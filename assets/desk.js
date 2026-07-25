/* desk.js — native live wiring for the Swiss Compute Desk site.
   Feeds the ticker, the hero supply board and the stats from the live DealDesk,
   and sends the bid/offer form straight into it. Same origin (public gateway
   proxies /api/*), so no CORS gymnastics. */
(function () {
  var API = window.SCD_API_BASE || "";
  var f2 = function (n) { return (Math.round(n * 100) / 100).toFixed(2); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[<>&]/g, ""); };

  /* ---- ticker + supply board from the desk ---- */
  function loadLive() {
    Promise.all([
      fetch(API + "/assets/market.json", { cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch(API + "/assets/offers.json", { cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch(API + "/api/board/live", { cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) {
      var m = res[0], o = res[1], bl = res[2];

      // ticker (below the nav): board prices + supply mentions
      var seg = [], arrow = { up: "▲", down: "▼", flat: "–" };
      if (bl && bl.items) bl.items.forEach(function (r) {
        seg.push('<span class="s">' + esc(r.sku) + " · " + esc(r.qty) + ' · <b>OFR ' + esc(r.price) + "</b></span>");
      });
      if (m && m.items) {
        if (m.index && m.index.value) seg.push('<span class="s"><b>' + esc(m.index.name) + "</b> $" + f2(m.index.value) + "</span>");
        m.items.forEach(function (i) {
          seg.push('<span class="s">' + esc(i.sym) + " $" + f2(i.price) + ' <i class="' + i.dir + '">' + arrow[i.dir] + " " + Math.abs(i.chg).toFixed(1) + "%</i></span>");
        });
      }
      if (o && o.offers) o.offers.slice(0, 6).forEach(function (c) {
        seg.push('<span class="s">' + esc(c.gpu) + " · " + esc(c.region) + " · RFQ</span>");
      });
      var run = seg.join('<span class="sep">|</span>');
      var tape = document.getElementById("tape");
      // two IDENTICAL halves (each ending in a separator) so the -50% -> 0
      // left-to-right animation tiles seamlessly with no visible jump.
      if (tape && run) { var half = run + '<span class="sep">|</span>'; tape.innerHTML = half + half; }

      // THE BOARD (hero right) — anonymized SKU / QTY / USD-HR from active offers
      var body = document.getElementById("supply-body");
      var rows = (bl && bl.items) || [];
      if (body) {
        body.innerHTML = rows.length ? rows.map(function (r) {
          return "<tr><td>" + esc(r.sku) + "</td><td class='r'>" + Number(r.qty || 0).toLocaleString("en-US") +
            "</td><td class='r' style='color:var(--brass)'>" + esc(r.price || "RFQ") + "</td></tr>";
        }).join("") : "<tr><td colspan='3' style='padding:16px;color:var(--sage)'>Send an ask and we quote from the private book.</td></tr>";
        var stamp = document.getElementById("supply-stamp");
        if (stamp && bl && bl.asof) stamp.textContent = "Levels last touched today, " + bl.asof + ". Indicative only — counterparties, contract length and terms are never published. Ask the desk for a firm quote.";
      }
    });
  }

  /* ---- stats from the desk health ---- */
  function loadStats() {
    fetch(API + "/api/health", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (h) {
      var c = h.counts || {};
      set("s-supply", c.supply); set("s-demand", c.demand);
      set("s-bids", h.bids); set("s-offers", h.offers);
    }).catch(function () {});
  }
  function set(id, v) { var e = document.getElementById(id); if (e && v != null) e.textContent = Number(v).toLocaleString("en-US"); }

  /* ---- modal popup: CTAs open a smooth dialog (no page scroll) ---- */
  var ov = document.getElementById("ov");
  function setSide(side) {
    if (!side) return;
    document.querySelectorAll("#order-form .seg label").forEach(function (l) {
      var on = l.querySelector("input").value === side;
      l.classList.toggle("on", on); l.querySelector("input").checked = on;
    });
  }
  function openModal(side) {
    if (side) setSide(side);
    ov.classList.add("on"); document.body.style.overflow = "hidden";
    var first = ov.querySelector("input[name=sku]"); if (first) setTimeout(function () { first.focus(); }, 120);
  }
  function closeModal() { ov.classList.remove("on"); document.body.style.overflow = ""; }
  document.querySelectorAll('a[href="#place"]').forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); openModal(a.getAttribute("data-side")); });
  });
  var xbtn = document.getElementById("ov-x"); if (xbtn) xbtn.addEventListener("click", closeModal);
  ov.addEventListener("click", function (e) { if (e.target === ov) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ov.classList.contains("on")) closeModal(); });
  document.querySelectorAll("#order-form .seg label").forEach(function (l) {
    l.addEventListener("click", function () {
      document.querySelectorAll("#order-form .seg label").forEach(function (x) { x.classList.remove("on"); });
      l.classList.add("on"); l.querySelector("input").checked = true;
    });
  });

  /* ---- form -> DealDesk ---- */
  var form = document.getElementById("order-form");
  if (form) form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var msg = document.getElementById("form-msg"), btn = form.querySelector("button[type=submit]");
    var data = {}; new FormData(form).forEach(function (v, k) { data[k] = v; });
    btn.disabled = true; msg.className = "msg"; msg.textContent = "Sending to the desk…";
    fetch(API + "/api/public-order", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.ok) { form.reset(); setSide("Bid");
        msg.className = "msg ok"; msg.textContent = "Received. Your " + (j.side || "order") + " is on our desk (ref " + j.id + "). We come back with a firm quote."; }
      else { msg.className = "msg err"; msg.textContent = "Please check: " + (j.error || "missing fields") + "."; }
    }).catch(function () {
      msg.className = "msg err"; msg.textContent = "Could not reach the desk. Email desk@swisscomputedesk.ch and we'll pick it up.";
    }).finally(function () { btn.disabled = false; });
  });

  /* ---- Board items (managed in the internal Board Manager) ---- */
  var BOARD_ITEMS = {};   // id -> item, so the CTA can look up the cluster safely
  function loadBoard() {
    fetch(API + "/api/board/public", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      var items = (d && d.items) || [];
      if (!items.length) return;
      // full detail under "The Board" (manually-editable Board Manager items).
      // These render ONLY here — never under the green "The Dealdesk" box.
      var feed = document.getElementById("feed-body");
      if (feed) feed.innerHTML = items.map(function (b) {
        BOARD_ITEMS[b.id] = b;
        var date = (b.updatedAt || "").slice(0, 10);
        var tag = (b.kind && b.kind !== "General")
          ? '<span class="tag ' + (b.kind === "Supply" ? "supply" : "demand") + '">' + esc(b.kind) + "</span> "
          : "";
        // Supply -> a buyer can "Request This Cluster"; Demand -> a supplier can "Offer This Cluster"
        var cta = "";
        if (b.kind === "Supply") cta = '<div class="it-cta"><button class="btn" data-cluster="' + esc(b.id) + '">Request This Cluster</button></div>';
        else if (b.kind === "Demand") cta = '<div class="it-cta"><button class="btn" data-cluster="' + esc(b.id) + '">Offer This Cluster</button></div>';
        return '<div class="it"><div class="d">' + esc(date) + '</div><div><h4>' + tag + esc(b.title) +
          "</h4><p>" + esc(b.detailedContent || b.shortSummary || "") + "</p>" + cta + "</div></div>";
      }).join("");
    }).catch(function () {});
  }

  /* ---- cluster request/offer modal (per Board item) ---- */
  var cov = document.getElementById("cluster-ov");
  function openCluster(b) {
    if (!cov || !b) return;
    var isSupply = b.kind === "Supply";
    var action = isSupply ? "request" : "offer";
    var label = (b.shortSummary ? b.title + " (" + b.shortSummary + ")" : b.title);
    document.getElementById("cluster-title").textContent = isSupply ? "Request this cluster" : "Offer this cluster";
    document.getElementById("cluster-intro").textContent = isSupply
      ? "Tell us who you are and we come back with a firm number for this cluster. Held in confidence."
      : "Let us know what you can provide against this demand. Held in confidence.";
    var f = document.getElementById("cluster-form");
    f.reset();
    f.querySelector('[name=board_id]').value = b.id;
    f.querySelector('[name=board_title]').value = label;
    f.querySelector('[name=kind]').value = b.kind || "";
    f.querySelector('[name=action]').value = action;
    f.querySelector('[name=message]').value = isSupply
      ? "Hi — I would like to request this cluster:\n\n" + label + "\n\nPlease send a firm quote, availability and terms."
      : "Hi — I can offer capacity for this demand:\n\n" + label + "\n\nHere is what I can provide (SKU, count, region, term, price):\n";
    document.getElementById("cluster-msg").textContent = "";
    document.getElementById("cluster-msg").className = "msg";
    cov.classList.add("on"); document.body.style.overflow = "hidden";
    var first = f.querySelector('input[name=name]'); if (first) setTimeout(function () { first.focus(); }, 120);
  }
  function closeCluster() { if (cov) { cov.classList.remove("on"); document.body.style.overflow = ""; } }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("[data-cluster]") : null;
    if (btn) { e.preventDefault(); openCluster(BOARD_ITEMS[btn.getAttribute("data-cluster")]); }
  });
  var cx = document.getElementById("cluster-x"); if (cx) cx.addEventListener("click", closeCluster);
  if (cov) cov.addEventListener("click", function (e) { if (e.target === cov) closeCluster(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && cov && cov.classList.contains("on")) closeCluster(); });

  var cform = document.getElementById("cluster-form");
  if (cform) cform.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var msg = document.getElementById("cluster-msg"), btn = document.getElementById("cluster-submit");
    var data = {}; new FormData(cform).forEach(function (v, k) { data[k] = v; });
    btn.disabled = true; msg.className = "msg"; msg.textContent = "Sending to the desk…";
    fetch(API + "/api/board-inbound", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.ok) {
        msg.className = "msg ok";
        msg.textContent = "Sent — this is with our desk now (ref " + j.id + "). We come back shortly.";
        setTimeout(closeCluster, 1800);
      } else { msg.className = "msg err"; msg.textContent = "Please check: " + (j.error || "missing fields") + "."; }
    }).catch(function () {
      msg.className = "msg err"; msg.textContent = "Could not reach the desk. Email deals@swisscomputedesk.ch and we'll pick it up.";
    }).finally(function () { btn.disabled = false; });
  });

  loadLive(); loadStats(); loadBoard();
  setInterval(loadLive, 300000);
  setInterval(loadBoard, 300000);
})();
