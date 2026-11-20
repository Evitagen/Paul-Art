/* Shared site behaviour: lightbox + contact form. No external dependencies. */
(function () {
  'use strict';

  function init() {

  /* ---------------- lightbox ---------------- */

  var items = Array.prototype.slice.call(document.querySelectorAll('.painting'));

  if (items.length) {
    var lb = document.getElementById('lightbox');
    var img = document.getElementById('lb-img');
    var cap = document.getElementById('lb-caption');
    var idx = 0;

    function captionOf(item) {
      var title = item.querySelector('.p-title');
      var medium = item.querySelector('.p-medium');
      var dims = item.querySelector('.p-dims');
      return (
        '<div class="p-title">' + (title ? title.textContent : '') + '</div>' +
        (medium && medium.textContent ? '<div class="p-medium">' + medium.textContent + '</div>' : '') +
        (dims && dims.textContent ? '<div class="p-dims">' + dims.textContent + '</div>' : '')
      );
    }

    function show(i) {
      idx = (i + items.length) % items.length;
      var item = items[idx];
      var pic = item.querySelector('img');
      img.src = pic.src;
      img.alt = pic.alt;
      cap.innerHTML = captionOf(item);
      if (!touring) setManual(1, 0, 0, true);
    }

    function open(i) {
      show(i);
      lb.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (!hintShown) {
        hintShown = true;
        hintEl.classList.add('show');
        setTimeout(function () { hintEl.classList.remove('show'); }, 3600);
      }
    }

    function close() {
      setTour(false);
      setManual(1, 0, 0, true);
      lb.classList.remove('open');
      document.body.style.overflow = '';
    }

    /* ---- zoom ----
       Direct manipulation, the way people expect from any photo app:
         * double-tap / double-click the painting -> zoom to that spot
           (again -> back out)
         * pinch (touch) or scroll wheel (mouse) -> zoom towards the point
           you are aiming at
         * drag -> move around while zoomed in
         * Esc zooms out first, closes only when already back out
       The ⤢ button additionally runs the automatic detail tour (a gentle
       zoom that drifts across the painting) — nice for browsing hands-free. */

    var zoomBtn = document.getElementById('lb-zoom');
    var touring = false;
    var tourTimer = null;
    var lastPt = { x: 0, y: 0 };
    var zs = { s: 1, x: 0, y: 0 }; // manual zoom state: scale + pan (percent)
    var MAXZOOM = 4;

    var hintShown = false;
    var hintEl = document.createElement('div');
    hintEl.className = 'lb-hint';
    hintEl.textContent = 'Double-tap or double-click to zoom \u00b7 pinch or scroll to zoom \u00b7 drag to move';
    lb.appendChild(hintEl);

    function geom() {
      var cw = lb.clientWidth, ch = lb.clientHeight;
      var fw = img.offsetWidth || cw, fh = img.offsetHeight || ch;
      return { cw: cw, ch: ch, fw: fw, fh: fh };
    }

    // keep the (scaled) painting covering the viewport
    function clampPan(s, x, y) {
      var g = geom();
      var mx = Math.max(0, (s * g.fw - g.cw) / (2 * s * g.fw) * 100);
      var my = Math.max(0, (s * g.fh - g.ch) / (2 * s * g.fh) * 100);
      return {
        x: Math.min(mx, Math.max(-mx, x)),
        y: Math.min(my, Math.max(-my, y))
      };
    }

    function setManual(s, x, y, animate) {
      s = Math.min(MAXZOOM, Math.max(1, s));
      if (s <= 1.02) { s = 1; x = 0; y = 0; }
      var p = clampPan(s, x, y);
      if (!isFinite(p.x)) p.x = 0;
      if (!isFinite(p.y)) p.y = 0;
      zs = { s: s, x: p.x, y: p.y };
      img.style.transition = animate
        ? 'transform 0.45s cubic-bezier(0.25, 0.6, 0.3, 1)'
        : 'none';
      img.style.transformOrigin = '50% 50%';
      img.style.transform = s === 1
        ? ''
        : 'scale(' + s + ') translate(' + p.x + '%, ' + p.y + '%)';
      lb.classList.toggle('zoomed', s > 1);
    }

    // zoom while keeping the point under (px, py) exactly where it is
    function zoomAt(newS, px, py, animate) {
      newS = Math.min(MAXZOOM, Math.max(1, newS));
      var r = img.getBoundingClientRect();
      // the image may not be laid out yet (just opened): then zoom centred
      var qx = r.width ? (px - r.left - r.width / 2) / r.width : 0;
      var qy = r.height ? (py - r.top - r.height / 2) / r.height : 0;
      var x = zs.x + 100 * qx * (zs.s / newS - 1);
      var y = zs.y + 100 * qy * (zs.s / newS - 1);
      setManual(newS, x, y, animate);
    }

    /* ---- automatic detail tour (⤢) ---- */

    // Orientation-aware tour geometry:
    //  - portrait photos drift up/down only (zoom raised just enough to
    //    cover the screen vertically, so no gaps appear)
    //  - landscape photos keep the current gentle both-ways drift
    // Pan ranges are always clamped so the photo never slides off-screen.
    var tourGeom = { s: 1.8, maxX: 15, maxY: 15 };

    function computeTourGeom() {
      var cw = lb.clientWidth;
      var ch = lb.clientHeight;
      var fitW = img.offsetWidth || cw;  // layout size (ignores transform)
      var fitH = img.offsetHeight || ch;
      var portrait = (img.naturalHeight || fitH) > (img.naturalWidth || fitW);
      var s, maxX, maxY;
      function range(fit, c) {
        return Math.max(0, (s * fit - c) / (2 * s * fit) * 100);
      }
      if (portrait) {
        s = Math.min(Math.max(1.8, (ch / fitH) * 1.45), 2.6);
        maxX = 0;
        maxY = range(fitH, ch);
      } else {
        s = 1.8;
        maxX = range(fitW, cw);
        maxY = range(fitH, ch);
      }
      tourGeom = { s: s, maxX: maxX, maxY: maxY };
    }

    function tourStep() {
      computeTourGeom(); // picks up new orientation after prev/next
      var g = tourGeom;
      // pick a point on the opposite side of the last one so every move
      // is a visible transition to a different part of the painting
      var x = (Math.random() * 2 - 1) * g.maxX;
      var y = (Math.random() * 2 - 1) * g.maxY;
      if (g.maxX > 0 && Math.abs(x - lastPt.x) < g.maxX * 0.6) x = lastPt.x >= 0 ? -Math.random() * g.maxX : Math.random() * g.maxX;
      if (g.maxY > 0 && Math.abs(y - lastPt.y) < g.maxY * 0.6) y = lastPt.y >= 0 ? -Math.random() * g.maxY : Math.random() * g.maxY;
      lastPt = { x: x, y: y };
      img.style.opacity = '0.82'; // gentle fade as each move begins
      img.style.transform = 'scale(' + g.s + ') translate(' + x + '%, ' + y + '%)';
      setTimeout(function () { if (touring) img.style.opacity = '1'; }, 1200);
    }

    function setTour(on) {
      touring = on;
      lb.classList.toggle('touring', on);
      if (tourTimer) { clearInterval(tourTimer); tourTimer = null; }
      if (zoomBtn) {
        zoomBtn.innerHTML = on ? '&#8854;' : '&#10530;';
        zoomBtn.setAttribute('aria-label', on ? 'Stop the detail tour' : 'Tour the painting in detail');
        zoomBtn.title = on ? 'Stop the detail tour' : 'Tour the painting in detail';
      }
      if (on) {
        lastPt = { x: 0, y: 0 };
        zs = { s: 1, x: 0, y: 0 };
        lb.classList.remove('zoomed', 'grabbing');
        computeTourGeom();
        img.style.transition = 'transform 3.6s cubic-bezier(0.45, 0.05, 0.35, 1), opacity 1.5s ease';
        img.style.transformOrigin = '50% 50%';
        img.style.transform = 'scale(' + tourGeom.s + ')';
        tourTimer = setInterval(tourStep, 5000);
      } else {
        img.style.transition = 'transform 0.9s ease, opacity 0.9s ease';
        img.style.transform = '';
        img.style.opacity = '1';
        lb.classList.remove('zoomed', 'grabbing');
        zs = { s: 1, x: 0, y: 0 };
      }
    }

    if (zoomBtn) {
      zoomBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        setTour(!touring);
      });
    }

    /* ---- gestures ---- */

    // double-click (mouse) zooms to that spot; again zooms back out
    img.addEventListener('dblclick', function (e) {
      e.preventDefault();
      if (touring) setTour(false);
      if (zs.s > 1.05) setManual(1, 0, 0, true);
      else zoomAt(2.4, e.clientX, e.clientY, true);
    });

    // scroll wheel zoom (towards the cursor)
    lb.addEventListener('wheel', function (e) {
      if (!lb.classList.contains('open')) return;
      e.preventDefault();
      if (touring) setTour(false);
      zoomAt(zs.s * Math.exp(-e.deltaY * 0.0016), e.clientX, e.clientY, false);
    }, { passive: false });

    // mouse drag pans while zoomed
    var drag = null;
    img.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return; // touch handled below
      if (touring) setTour(false);
      if (zs.s <= 1.02) return;
      drag = { x: e.clientX, y: e.clientY };
      lb.classList.add('grabbing');
      e.preventDefault();
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var g = geom();
      setManual(zs.s,
        zs.x + (e.clientX - drag.x) * 100 / (zs.s * g.fw),
        zs.y + (e.clientY - drag.y) * 100 / (zs.s * g.fh),
        false);
      drag = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointerup', function () {
      drag = null;
      lb.classList.remove('grabbing');
    });

    // touch: pinch zooms, one-finger drag pans while zoomed,
    // quick double-tap zooms to that spot
    function tdist(e) {
      var a = e.touches[0], b = e.touches[1];
      var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
      return Math.sqrt(dx * dx + dy * dy) || 1;
    }
    var pinch = null, panStart = null, panLast = null;
    var tapT = 0, tapP = { x: 0, y: 0 };

    img.addEventListener('touchstart', function (e) {
      if (touring) setTour(false);
      if (e.touches.length === 2) {
        pinch = { d: tdist(e) };
      } else if (e.touches.length === 1) {
        panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        panLast = { x: panStart.x, y: panStart.y };
      }
    }, { passive: true });

    img.addEventListener('touchmove', function (e) {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        var d = tdist(e);
        var mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomAt(zs.s * (d / pinch.d), mx, my, false);
        pinch.d = d;
      } else if (e.touches.length === 1 && zs.s > 1.02 && panLast) {
        e.preventDefault();
        var g = geom();
        setManual(zs.s,
          zs.x + (e.touches[0].clientX - panLast.x) * 100 / (zs.s * g.fw),
          zs.y + (e.touches[0].clientY - panLast.y) * 100 / (zs.s * g.fh),
          false);
        panLast = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: false });

    img.addEventListener('touchend', function (e) {
      if (e.touches.length < 2) pinch = null;
      var t = e.changedTouches[0];
      if (panStart &&
          Math.abs(t.clientX - panStart.x) < 24 &&
          Math.abs(t.clientY - panStart.y) < 24) {
        var now = Date.now();
        if (now - tapT < 350 &&
            Math.abs(t.clientX - tapP.x) < 48 &&
            Math.abs(t.clientY - tapP.y) < 48) {
          if (zs.s > 1.05) setManual(1, 0, 0, true);
          else zoomAt(2.4, t.clientX, t.clientY, true);
          tapT = 0;
        } else {
          tapT = now;
          tapP = { x: t.clientX, y: t.clientY };
        }
      } else {
        tapT = 0;
      }
      if (e.touches.length === 0) { panStart = null; panLast = null; }
    });

    items.forEach(function (item, i) {
      item.addEventListener('click', function () { open(i); });
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
      });
    });

    document.getElementById('lb-close').addEventListener('click', function (e) { e.stopPropagation(); close(); });
    document.getElementById('lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(idx - 1); });
    document.getElementById('lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb && !touring) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') {
        if (touring) setTour(false);
        else if (zs.s > 1) setManual(1, 0, 0, true);
        else close();
      }
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === '+' || e.key === '=') zoomAt(zs.s * 1.35, window.innerWidth / 2, window.innerHeight / 2, true);
      else if (e.key === '-' || e.key === '_') zoomAt(zs.s / 1.35, window.innerWidth / 2, window.innerHeight / 2, true);
      else if (e.key === '0') setManual(1, 0, 0, true);
    });
  }

  /* ---------------- gallery section tabs ---------------- */

  var tabs = Array.prototype.slice.call(document.querySelectorAll('.section-btn'));

  if (tabs.length) {
    var groups = Array.prototype.slice.call(document.querySelectorAll('.gallery-section'));
    tabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        tabs.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var target = btn.getAttribute('data-target');
        groups.forEach(function (g) {
          g.classList.toggle('hidden', target !== 'all' && g.getAttribute('data-section') !== target);
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  /* ---------------- contact form ---------------- */

  var form = document.getElementById('contact-form');

  if (form) {
    var note = document.getElementById('form-note');
    var cfg = window.__CONTACT || {};

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('cf-name').value.trim();
      var email = document.getElementById('cf-email').value.trim();
      var message = document.getElementById('cf-message').value.trim();

      if (!name || !email || !message) {
        note.textContent = 'Please fill in all three fields.';
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        note.textContent = 'That email address doesn\u2019t look quite right.';
        return;
      }

      if (cfg.formUrl) {
        note.textContent = 'Sending\u2026';
        var body = new FormData();
        body.append('name', name);
        body.append('email', email);
        body.append('message', message);
        body.append('_subject', 'Website message from ' + name);
        fetch(cfg.formUrl, { method: 'POST', body: body, headers: { Accept: 'application/json' } })
          .then(function (r) {
            if (r.ok) {
              form.style.display = 'none';
              note.textContent = 'Thank you \u2014 your message has been sent. I\u2019ll be in touch soon.';
            } else {
              note.textContent = 'Sorry, the message could not be sent. Please email me directly below.';
            }
          })
          .catch(function () {
            note.textContent = 'Sorry, the message could not be sent. Please email me directly below.';
          });
      } else {
        var subject = encodeURIComponent('Website message from ' + name);
        var text = encodeURIComponent('From: ' + name + ' <' + email + '>\n\n' + message);
        window.location.href = 'mailto:' + cfg.email + '?subject=' + subject + '&body=' + text;
        note.textContent = 'This opens your email app with the message pre-filled \u2014 just hit send.';
      }
    });
  }

    /* Gallery cards: give portrait photos an identical 3:4 frame so every
       portrait painting reads the same height regardless of its own ratio
       (landscape photos keep their natural proportions). */
    document.querySelectorAll('.grid:not(.grid-home) figure.painting').forEach(function (fig) {
      var img = fig.querySelector('img');
      if (!img) return;
      var mark = function () {
        if (img.naturalWidth && img.naturalHeight && img.naturalHeight > img.naturalWidth * 1.02) {
          fig.classList.add('portrait');
        }
      };
      if (img.complete) mark(); else img.addEventListener('load', mark);
    });

  } /* end init */

  /* the script lives in <head> — wait for the page to exist */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
