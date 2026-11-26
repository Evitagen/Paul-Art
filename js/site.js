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
    }

    function open(i) {
      show(i);
      lb.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function close() {
      setTour(false);
      lb.classList.remove('open');
      document.body.style.overflow = '';
    }

    /* ---- detail tour: zoom in a little, then drift gently between
       different parts of the painting with soft eased transitions ---- */

    var zoomBtn = document.getElementById('lb-zoom');
    var touring = false;
    var tourTimer = null;
    var tourGeom = { s: 2.2, maxX: 15, maxY: 15 };
    var tourSeq = null;
    var tourSeqI = 0;

    // Tour geometry: how deep to zoom and how far the photo may pan.
    // Pan ranges are clamped exactly to the overflow, so +/- ranges put
    // the view flush against the photo's edges — i.e. its four corners.
    // Portrait photos zoom deep enough that when the zoomed width exceeds
    // the screen they pan side to side as well.
    function computeTourGeom() {
      // content box of the lightbox (viewport minus its padding) — that is
      // the actual "screen" the photo is shown in
      var cs = window.getComputedStyle(lb);
      var cw = lb.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      var ch = lb.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
      var fitW = img.offsetWidth || cw;  // layout size (ignores transform)
      var fitH = img.offsetHeight || ch;
      var portrait = (img.naturalHeight || fitH) > (img.naturalWidth || fitW);
      var s, maxX, maxY;
      function range(fit, c) {
        return Math.max(0, (s * fit - c) / (2 * s * fit) * 100);
      }
      if (portrait) {
        // deeper than before: at least 2x, scaled to the screen, capped at 3x
        s = Math.min(Math.max(2.0, (ch / fitH) * 1.7), 3.0);
        maxX = range(fitW, cw); // 0 automatically when no horizontal overflow
        maxY = range(fitH, ch);
      } else {
        s = 2.2;
        maxX = range(fitW, cw);
        maxY = range(fitH, ch);
      }
      tourGeom = { s: s, maxX: maxX, maxY: maxY };
    }

    // The tour walks the photo's four corners (all corners when both axes
    // overflow; top/bottom when only vertical). Each round the corner order
    // is shuffled with a touch of jitter so it never feels mechanical.
    function tourCorners(g) {
      var pts = [[-g.maxX, -g.maxY], [g.maxX, -g.maxY], [g.maxX, g.maxY], [-g.maxX, g.maxY]];
      var seen = {};
      pts = pts.filter(function (p) {
        var k = p[0].toFixed(2) + '|' + p[1].toFixed(2);
        if (seen[k]) return false;
        seen[k] = 1;
        return true;
      });
      for (var i = pts.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = pts[i]; pts[i] = pts[j]; pts[j] = t;
      }
      return pts;
    }

    function tourStep() {
      computeTourGeom(); // picks up new orientation after prev/next
      var g = tourGeom;
      if (!tourSeq || tourSeqI >= tourSeq.length) { tourSeq = tourCorners(g); tourSeqI = 0; }
      var p = tourSeq[tourSeqI++];
      // slight jitter away from dead-centre on each move (never past the edge)
      var x = p[0] === 0 ? 0 : p[0] * (0.93 + Math.random() * 0.07);
      var y = p[1] === 0 ? 0 : p[1] * (0.93 + Math.random() * 0.07);
      img.style.opacity = '0.82'; // gentle fade as each move begins
      img.style.transform = 'scale(' + g.s + ') translate(' + x + '%, ' + y + '%)';
      setTimeout(function () { if (touring) img.style.opacity = '1'; }, 1200);
    }

    function setTour(on) {
      touring = on;
      lb.classList.toggle('touring', on);
      if (tourTimer) { clearInterval(tourTimer); tourTimer = null; }
      if (zoomBtn) {
        zoomBtn.innerHTML = on
          ? '&#8854;<span class="zb-label">Stop</span>'
          : '&#10530;<span class="zb-label">Zoom</span>';
        zoomBtn.setAttribute('aria-label', on ? 'Stop the detail tour' : 'Tour the painting in detail');
        zoomBtn.title = on ? 'Stop the detail tour' : 'Tour the painting in detail';
      }
      if (on) {
        tourSeq = null; tourSeqI = 0;
        computeTourGeom();
        img.style.transition = 'transform 3.6s cubic-bezier(0.45, 0.05, 0.35, 1), opacity 1.5s ease';
        img.style.transformOrigin = '50% 50%';
        img.style.transform = 'scale(' + tourGeom.s + ')';
        tourTimer = setInterval(tourStep, 5000);
      } else {
        img.style.transition = 'transform 0.9s ease, opacity 0.9s ease';
        img.style.transform = '';
        img.style.opacity = '1';
      }
    }

    if (zoomBtn) {
      // the static page carries the bare icon — add the small text label
      if (!zoomBtn.querySelector('.zb-label')) {
        zoomBtn.innerHTML = '&#10530;<span class="zb-label">Zoom</span>';
      }
      zoomBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        setTour(!touring);
      });
    }

    items.forEach(function (item, i) {
      item.addEventListener('click', function () { open(i); });
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
      });
    });

    document.getElementById('lb-close').addEventListener('click', function (e) { e.stopPropagation(); close(); });
    document.getElementById('lb-prev').addEventListener('click', function (e) { e.stopPropagation(); if (touring) return; show(idx - 1); });
    document.getElementById('lb-next').addEventListener('click', function (e) { e.stopPropagation(); if (touring) return; show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb && !touring) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') { if (touring) setTour(false); else close(); }
      else if (e.key === 'ArrowLeft' && !touring) show(idx - 1);
      else if (e.key === 'ArrowRight' && !touring) show(idx + 1);
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
