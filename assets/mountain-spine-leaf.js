/* Mountain Spine-Leaf — standalone scroll-triggered loop.
   Ported from the Claude Design export: the composition there is a pure
   function of global time, so React, ReactDOM, Babel-standalone and the
   SceneStage runtime (~1 MB) are not needed at runtime and are gone.
   No dependencies. */
(function () {
  'use strict';

  var W = 1920, H = 1080, LOOP = 10;
  var NODE_W = 196, NODE_H = 115;
  var SPINES = [{ x: 476, y: 46 }, { x: 1743, y: -7 }, { x: 3786, y: -57 }];
  var LEAF_X = [0, 826, 1652, 2478, 3304, 4130];
  var LEAVES = LEAF_X.map(function (x) { return { x: x, y: 808 }; });
  var UPLINK = { 0: 1, 1: 2, 2: 4 };
  var NS = 'http://www.w3.org/2000/svg';

  function sAnchor(s) { return [s.x + NODE_W / 2, s.y + NODE_H]; }
  function lAnchor(l) { return [l.x + NODE_W / 2, l.y]; }

  var LINKS = [];
  SPINES.forEach(function (s, si) {
    LEAVES.forEach(function (l, li) {
      var a = sAnchor(s), b = lAnchor(l);
      LINKS.push({ si: si, li: li, a: a, b: b,
        len: Math.hypot(b[0] - a[0], b[1] - a[1]), up: UPLINK[si] === li });
    });
  });

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(v) { var p = clamp01(v); return p * p * (3 - 2 * p); }
  function ramp(t, a, b) { return ease((t - a) / (b - a)); }
  function hash(n) { var v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }

  var T = { drawStart: 2.0, drawEnd: 4.6, linkDur: 0.55, spineStart: 2.0, spineEnd: 4.3,
            liveIn: [4.2, 5.0], liveOut: [8.0, 8.9], dissolveStart: 8.2, dissolveEnd: 9.95 };

  var STAGGER = (T.drawEnd - T.drawStart - T.linkDur) / (LINKS.length - 1);
  var DSTAG = (T.dissolveEnd - T.dissolveStart - 0.5) / (LINKS.length - 1);

  function linkProgress(t, i) {
    var fwd = ease((t - (T.drawStart + i * STAGGER)) / T.linkDur);
    var back = 1 - ease((t - (T.dissolveStart + (LINKS.length - 1 - i) * DSTAG)) / 0.5);
    return Math.min(fwd, back);
  }

  /* attribute writes are the hot path; skip ones that would be no-ops */
  function set(el, k, v) { if (el.__c[k] !== v) { el.__c[k] = v; el.setAttribute(k, v); } }
  function sty(el, v) { if (el.__c.s !== v) { el.__c.s = v; el.style.cssText = v; } }
  function mk(tag, parent) {
    var e = document.createElementNS(NS, tag); e.__c = {}; parent.appendChild(e); return e;
  }
  function r2(n) { return Math.round(n * 100) / 100; }
  /* The mountain's two glows are the most expensive thing on the page: a
     ~90px blur over a 1920x1061 bitmap, re-rasterised on every write. Their
     shimmer cycles take ~6s and ~3.7s, so quantising the radius to whole
     pixels is imperceptible and drops the write rate from 60/s to ~9/s. */
  function r0(n) { return Math.round(n); }
  function r3(n) { return Math.round(n * 1000) / 1000; }

  function build(root, opts) {
    var src = opts.image;
    root.innerHTML =
      '<div class="msl-canvas">' +
        '<div class="msl-cam">' +
          '<img class="msl-mtn" alt="" src="' + src + '">' +
          '<img class="msl-mtn msl-mtn--bloom" alt="" aria-hidden="true" src="' + src + '">' +
          '<svg class="msl-net" viewBox="0 -200 4325 1124" preserveAspectRatio="none" aria-hidden="true">' +
            '<g class="msl-links" opacity="0.95"></g><g class="msl-pulses"></g>' +
            '<g class="msl-leaves"></g><g class="msl-spines"></g><g class="msl-beam"></g>' +
          '</svg>' +
        '</div>' +
      '</div>';

    var q = function (s) { return root.querySelector(s); };
    var els = { canvas: q('.msl-canvas'), cam: q('.msl-cam'), mtn: q('.msl-mtn'),
                bloom: q('.msl-mtn--bloom'), net: q('.msl-net') };
    els.cam.__c = {}; els.mtn.__c = {}; els.bloom.__c = {}; els.net.__c = {};

    els.links = LINKS.map(function (L) {
      var e = mk('line', q('.msl-links'));
      set(e, 'x1', L.a[0]); set(e, 'y1', L.a[1]); set(e, 'x2', L.b[0]); set(e, 'y2', L.b[1]);
      set(e, 'stroke-linecap', 'round'); set(e, 'stroke-dasharray', r2(L.len));
      return e;
    });
    els.pulses = LINKS.map(function (L) {
      if (L.up || !opts.pulses) return null;
      var e = mk('circle', q('.msl-pulses'));
      set(e, 'r', 13); set(e, 'fill', '#ffffff');
      sty(e, 'filter:drop-shadow(0 0 16px rgba(255,255,255,.85))');
      return e;
    });
    els.leaves = LEAVES.map(function (l) {
      var e = mk('rect', q('.msl-leaves'));
      set(e, 'x', l.x); set(e, 'y', l.y); set(e, 'width', NODE_W); set(e, 'height', NODE_H);
      set(e, 'rx', 30); set(e, 'fill', 'none'); set(e, 'stroke-width', 3);
      return e;
    });
    els.spines = SPINES.map(function (s) {
      var e = mk('rect', q('.msl-spines'));
      set(e, 'x', s.x); set(e, 'y', s.y); set(e, 'width', NODE_W); set(e, 'height', NODE_H);
      set(e, 'rx', 30); set(e, 'fill', 'none'); set(e, 'stroke-width', 3.5);
      set(e, 'stroke-dasharray', 2 * (NODE_W + NODE_H));
      return e;
    });
    els.beam = mk('circle', q('.msl-beam'));
    set(els.beam, 'r', 150); sty(els.beam, 'filter:blur(60px)');
    return els;
  }

  function frame(els, t, tw) {
    var lt = ((t % LOOP) + LOOP) % LOOP;
    var cam = 1 + tw.pushIn / 100 * (1 - Math.cos((lt / LOOP) * Math.PI * 2)) / 2;
    var sh1 = 0.5 + 0.5 * Math.sin(lt * 1.05);
    var sh2 = 0.5 + 0.5 * Math.sin(lt * 1.7 + 1.2);
    var live = ramp(lt, T.liveIn[0], T.liveIn[1]) * (1 - ramp(lt, T.liveOut[0], T.liveOut[1]));
    var sweep = ease((lt - T.spineStart) / (T.spineEnd - T.spineStart));
    var sOut = 1 - ramp(lt, T.dissolveEnd - 0.9, T.dissolveEnd);
    var archFade = clamp01(ramp(lt, 1.95, 2.35)) * sOut;
    var grey = tw.linkColor, purple = tw.spineColor, magenta = tw.uplinkColor;

    sty(els.cam, 'transform:scale(' + r2(cam) + ');transform-origin:50% 62%;will-change:transform');
    sty(els.mtn, 'filter:drop-shadow(0 0 ' + r0(36 + 14 * sh1) + 'px rgba(88,214,208,' + r2(0.30 + 0.10 * sh1) +
                 ')) drop-shadow(0 0 ' + r0(70 + 20 * sh2) + 'px rgba(232,120,224,' + r2(0.14 + 0.07 * sh2) + '))');
    sty(els.bloom, 'mix-blend-mode:screen;opacity:' + r2(0.06 + 0.09 * sh2) +
                   ';filter:blur(9px) saturate(1.4);transform:scale(' + r3(1 + 0.004 * sh1) + ');transform-origin:50% 100%');
    sty(els.net, 'opacity:' + r2(archFade) + ';filter:drop-shadow(0 0 6px rgba(8,12,26,.9))');
    if (archFade <= 0.001) return;

    for (var i = 0; i < LINKS.length; i++) {
      var L = LINKS[i], e = els.links[i], p = linkProgress(lt, i);
      if (p <= 0.001) { set(e, 'opacity', 0); continue; }
      var upMix = L.up ? clamp01(ramp(lt, 4.2, 4.7)) : 0;
      var stroke = grey, width = 2.5, op = 0.9, glowR = 0;
      if (upMix > 0) {
        var slot = 0.16 + hash(i * 3.7) * 0.2;
        var r = hash((Math.floor(lt / slot) + i * 13) * 1.7 + i * 3.3);
        var burst = hash(Math.floor(lt / 1.3) + i * 5) < 0.35 ? 0.85 : 0.45;
        var b = r < burst ? 1 : 0.28;
        var blink = 0.34 + 0.66 * (b * live + (1 - live) * 0.55);
        stroke = magenta; width = 2.5 + 1 * upMix * blink;
        op = 0.9 * (1 - upMix) + blink * upMix; glowR = 8 * upMix * blink;
      }
      set(e, 'stroke', stroke); set(e, 'stroke-width', r2(width)); set(e, 'opacity', r2(op));
      set(e, 'stroke-dashoffset', r2(L.len * (1 - p)));
      sty(e, glowR ? 'filter:drop-shadow(0 0 ' + r2(glowR) + 'px ' + magenta + ')' : '');
    }

    for (var j = 0; j < LINKS.length; j++) {
      var pe = els.pulses[j]; if (!pe) continue;
      if (live <= 0.02) { set(pe, 'opacity', 0); continue; }
      var Lp = LINKS[j];
      var period = 2.2 + hash(j * 1.3) * 2.4;
      var travel = (1.1 + hash(j * 7.1) * 0.9) / tw.pulseSpeed;
      var c = ((lt + hash(j * 11.7) * period) % period);
      if (c > travel) { set(pe, 'opacity', 0); continue; }
      var u = c / travel;
      set(pe, 'cx', r2(Lp.a[0] + (Lp.b[0] - Lp.a[0]) * u));
      set(pe, 'cy', r2(Lp.a[1] + (Lp.b[1] - Lp.a[1]) * u));
      set(pe, 'opacity', r2(0.9 * Math.sin(u * Math.PI) * live * clamp01(linkProgress(lt, j) * 4 - 3)));
    }

    for (var k = 0; k < LEAVES.length; k++) {
      var lp = 0;
      for (var m = 0; m < LINKS.length; m++) if (LINKS[m].li === k) lp = Math.max(lp, linkProgress(lt, m));
      var le = els.leaves[k];
      set(le, 'stroke', grey); set(le, 'opacity', r2(0.98 * clamp01(lp * 2)));
      sty(le, 'filter:drop-shadow(0 0 ' + r2(8 * clamp01(lp)) + 'px ' + grey + ')');
    }

    var x0 = sAnchor(SPINES[0])[0], x2 = sAnchor(SPINES[2])[0], per = 2 * (NODE_W + NODE_H);
    for (var n = 0; n < SPINES.length; n++) {
      var uu = (sAnchor(SPINES[n])[0] - x0) / (x2 - x0);
      var sp = clamp01((sweep - uu * 0.85) * 5) * sOut, se = els.spines[n];
      set(se, 'stroke', purple); set(se, 'opacity', r2(0.7 + 0.3 * sp));
      set(se, 'stroke-dashoffset', r2(per * (1 - sp)));
      sty(se, 'filter:drop-shadow(0 0 ' + r2(10 + 12 * sp) + 'px ' + purple + ')');
    }

    var on = (sweep > 0.001 && sweep < 0.999) ? Math.sin(sweep * Math.PI) : 0;
    var ay = sAnchor(SPINES[0])[1], by = sAnchor(SPINES[2])[1];
    set(els.beam, 'cx', r2(x0 + (x2 - x0) * sweep));
    set(els.beam, 'cy', r2(ay + (by - ay) * sweep - NODE_H / 2));
    set(els.beam, 'fill', purple); set(els.beam, 'opacity', r2(0.30 * on));
  }


  /* ---------- runtime: scroll-arm, clock, scale-to-fit ---------- */

  var DEFAULTS = { pushIn: 5, pulseSpeed: 0.9, pulses: true,
    linkColor: '#ccd4e4', spineColor: '#b9a8ff', uplinkColor: '#ff6ee0' };

  function init(root) {
    if (root.__msl) return root.__msl;

    var tw = Object.assign({}, DEFAULTS);
    ['pushIn', 'pulseSpeed'].forEach(function (k) {
      var v = parseFloat(root.dataset[k]); if (isFinite(v)) tw[k] = v;
    });
    ['linkColor', 'spineColor', 'uplinkColor'].forEach(function (k) {
      if (root.dataset[k]) tw[k] = root.dataset[k];
    });
    if (root.dataset.pulses != null) tw.pulses = !/^(0|off|false|no)$/i.test(root.dataset.pulses);

    var els = build(root, { image: root.dataset.mslImage || root.getAttribute('data-msl-image'),
                            pulses: tw.pulses });
    var sentinel = document.createElement('span');
    sentinel.className = 'msl-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    root.appendChild(sentinel);

    /* The pre-roll state IS frame 0 of the loop: at t=0 the network hasn't
       drawn yet (archFade is 0 until t=1.95), so the mountain simply sits
       there. Starting the clock is therefore invisible — nothing pops. */
    frame(els, 0, tw);

    var armed = false, running = false, raf = 0, origin = 0, elapsed = 0, onScreen = false, done = false;

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

    /* Play exactly one loop, then rest on the pure mountains forever. The clock
       is a one-shot timeline in [0, LOOP], NOT a modulo — so pausing (scroll
       away / tab hidden) preserves progress and the single loop always finishes
       once, whenever the viewer is actually looking. At t=LOOP the network has
       fully dissolved, so the resting frame is the mountain alone. */
    function finish() {
      running = false; done = true; cancelAnimationFrame(raf);
      frame(els, 0, tw);              /* pure mountains — the resting pose */
      arm.disconnect(); gov.disconnect();
      root.classList.remove('is-live'); root.classList.add('is-rested');
    }
    function tick(now) {
      var t = elapsed + (now - origin) / 1000;
      if (t >= LOOP) { finish(); return; }
      frame(els, t, tw);
      raf = requestAnimationFrame(tick);
    }
    function play() {
      if (running || !armed || done || document.hidden) return;
      running = true; origin = performance.now(); raf = requestAnimationFrame(tick);
    }
    function pause() {
      if (!running) return;
      running = false; cancelAnimationFrame(raf);
      elapsed = elapsed + (performance.now() - origin) / 1000;   /* no modulo: keep one-shot progress */
    }

    /* Trigger: fires the first time the BOTTOM edge of the stage crosses into
       the viewport — i.e. the full mountain panorama is open. A 1px sentinel
       pinned to that edge reports the crossing exactly; observing the stage
       itself would only report its top edge. */
    var arm = new IntersectionObserver(function (e) {
      if (!e[0].isIntersecting) return;
      arm.disconnect();
      armed = true; root.classList.add('is-live');
      if (onScreen) play();
    }, { threshold: 0, rootMargin: root.dataset.mslMargin || '0px 0px -6% 0px' });

    /* Governor: never burn a frame on something nobody is looking at. Pausing
       keeps the playhead, so scrolling away mid-loop and back resumes the same
       loop rather than restarting or skipping it. */
    var gov = new IntersectionObserver(function (e) {
      onScreen = e[0].isIntersecting;
      if (done) return;
      onScreen ? play() : pause();
    }, { threshold: 0, rootMargin: '120px 0px' });

    document.addEventListener('visibilitychange', function () {
      if (done) return;
      document.hidden ? pause() : play();
    });

    var ro = new ResizeObserver(function (e) {
      var w = e[0].contentRect.width;
      if (w) root.style.setProperty('--msl-scale', w / W);
    });
    ro.observe(root);
    root.style.setProperty('--msl-scale', (root.clientWidth || W) / W);

    function applyMotionPref() {
      if (reduced && reduced.matches) {
        arm.disconnect(); gov.disconnect(); pause();
        armed = false; done = true; root.classList.add('is-static');
        frame(els, 0, tw);             /* pure mountains — matches the post-loop resting pose */
      } else if (!root.classList.contains('is-rested')) {
        done = false; root.classList.remove('is-static');
        gov.observe(root); arm.observe(sentinel);
      }
    }
    applyMotionPref();
    if (reduced && reduced.addEventListener) reduced.addEventListener('change', applyMotionPref);

    var api = { play: play, pause: pause, seek: function (t) { elapsed = t % LOOP; origin = performance.now(); frame(els, elapsed, tw); },
                destroy: function () { pause(); arm.disconnect(); gov.disconnect(); ro.disconnect(); root.__msl = null; } };
    root.__msl = api;
    return api;
  }

  function boot() {
    document.querySelectorAll('[data-msl]').forEach(init);
  }
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();

  window.MountainSpineLeaf = { init: init, boot: boot };
})();
