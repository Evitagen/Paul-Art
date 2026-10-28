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
    var lastPt = { x: 0, y: 0 };
    var tourGeom = { s: 1.5, maxX: 15, maxY: 15 };

    // Orientation-aware tour geometry:
    //  - portrait photos drift up/down only (zoom raised just enough to
    //    cover the screen vertically, so no gaps appear)
    //  - landscape photos keep the current gentle both-ways drift
    // Pan ranges are always clamped so the photo never slides off-screen.
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
        s = Math.min(Math.max(1.5, (ch / fitH) * 1.35), 2.2);
        maxX = 0;
        maxY = range(fitH, ch);
      } else {
        s = 1.5;
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
    document.getElementById('lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(idx - 1); });
    document.getElementById('lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb && !touring) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') { if (touring) setTour(false); else close(); }
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
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

  } /* end init */

  /* the script lives in <head> — wait for the page to exist */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
