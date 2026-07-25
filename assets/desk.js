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
      fetch(API + "/assets/offers.json", { cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) {
      var m = res[0], o = res[1];

      // ticker: live supply lots + market prices
      var seg = [], arrow = { up: "▲", down: "▼", flat: "–" };
      if (o && o.offers) seg.push('<span class="s"><b>LIVE SUPPLY</b> ' + o.offers.length + " lots on the desk</span>");
      if (m && m.items) {
        if (m.index && m.index.value) seg.push('<span class="s"><b>' + esc(m.index.name) + "</b> $" + f2(m.index.value) + "</span>");
        m.items.forEach(function (i) {
          seg.push('<span class="s">' + esc(i.sym) + " $" + f2(i.price) + ' <i class="' + i.dir + '">' + arrow[i.dir] + " " + Math.abs(i.chg).toFixed(1) + "%</i></span>");
        });
      }
      if (o && o.offers) o.offers.slice(0, 8).forEach(function (c) {
        seg.push('<span class="s">' + esc(c.gpu) + " · " + esc(c.region) + " · " + esc(c.available) + "</span>");
      });
      var run = seg.join('<span class="sep">·</span>');
      var tape = document.getElementById("tape");
      if (tape && run) tape.innerHTML = run + '<span class="sep">·</span>' + run;

      // hero supply board
      var body = document.getElementById("supply-body");
      if (body && o && o.offers) {
        body.innerHTML = o.offers.map(function (c) {
          return "<tr><td style='color:var(--brass)'>" + esc(c.gpu) + "</td><td>" + esc(c.region) +
            "</td><td>" + esc(c.term) + "</td><td>" + esc(c.interconnect) + "</td><td>" + esc(c.available) + "</td></tr>";
        }).join("") || "<tr><td colspan='5' style='padding:16px;color:var(--sage)'>Send an ask and we quote from the private book.</td></tr>";
        var cnt = document.getElementById("supply-count");
        if (cnt) cnt.textContent = o.offers.length + " lots";
        var stamp = document.getElementById("supply-stamp");
        if (stamp && o.updated) stamp.textContent = "anonymized · live from the desk · " + o.updated.slice(0, 16).replace("T", " ") + " UTC";
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
  function loadBoard() {
    fetch(API + "/api/board/public", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      var items = (d && d.items) || [];
      if (!items.length) return;
      // full detail under "From the desk"
      var feed = document.getElementById("feed-body");
      if (feed) feed.innerHTML = items.map(function (b) {
        var date = (b.updatedAt || "").slice(0, 10);
        return '<div class="it"><div class="d">' + esc(date) + '</div><div><h4>' + esc(b.title) +
          "</h4><p>" + esc(b.detailedContent || b.shortSummary || "") + "</p></div></div>";
      }).join("");
      // condensed summary under "Available supply"
      var sum = document.getElementById("board-summary");
      if (sum) sum.innerHTML = items.slice(0, 5).map(function (b) {
        return '<div class="bs"><div class="t">' + esc(b.title) + '</div><div class="s">' + esc(b.shortSummary || "") + "</div></div>";
      }).join("");
    }).catch(function () {});
  }

  loadLive(); loadStats(); loadBoard();
  setInterval(loadLive, 300000);
  setInterval(loadBoard, 300000);
})();
