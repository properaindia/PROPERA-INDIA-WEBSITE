/**
 * Gallery lightbox for the SBR landing page.
 * Click (or press Enter on) any gallery image to open it in a full-screen viewer.
 * Close: X button, Esc, or click outside the image. Navigate: arrow buttons, left/right keys, or swipe.
 * No dependencies. The viewer markup is created by this script, so no extra HTML is needed.
 */
(function () {
  'use strict';
  var gallery = document.querySelector('.gallery');
  if (!gallery) return;

  var overlay, imgEl, capEl, countEl, closeBtn, prevBtn, nextBtn;
  var current = 0, lastFocus = null, touchX = 0, touchY = 0;

  /* Images that actually loaded (hides broken / missing ones) */
  function items() {
    return Array.prototype.filter.call(gallery.querySelectorAll('img'), function (i) {
      return !i.classList.contains('broken') && (i.naturalWidth > 0 || !i.complete);
    });
  }

  var ICON = {
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'
  };

  function build() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'lb';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Image gallery');
    overlay.innerHTML =
      '<div class="lb-count" aria-live="polite"></div>' +
      '<button type="button" class="lb-btn lb-close" aria-label="Close gallery">' + ICON.close + '</button>' +
      '<button type="button" class="lb-btn lb-prev" aria-label="Previous image">' + ICON.prev + '</button>' +
      '<figure class="lb-fig"><img class="lb-img" alt=""><figcaption class="lb-cap"></figcaption></figure>' +
      '<button type="button" class="lb-btn lb-next" aria-label="Next image">' + ICON.next + '</button>';
    document.body.appendChild(overlay);

    imgEl = overlay.querySelector('.lb-img');
    capEl = overlay.querySelector('.lb-cap');
    countEl = overlay.querySelector('.lb-count');
    closeBtn = overlay.querySelector('.lb-close');
    prevBtn = overlay.querySelector('.lb-prev');
    nextBtn = overlay.querySelector('.lb-next');

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function () { go(-1); });
    nextBtn.addEventListener('click', function () { go(1); });

    /* Click on the dark background closes; clicks on image or buttons do not */
    overlay.addEventListener('click', function (e) {
      if (!e.target.closest('.lb-img, .lb-btn, .lb-cap')) close();
    });

    /* Swipe left / right on phones */
    overlay.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0]; touchX = t.clientX; touchY = t.clientY;
    }, { passive: true });
    overlay.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0], dx = t.clientX - touchX, dy = t.clientY - touchY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    }, { passive: true });

    imgEl.addEventListener('load', function () { imgEl.classList.remove('is-loading'); });
  }

  function show(i) {
    var list = items();
    if (!list.length) return;
    current = (i + list.length) % list.length;
    var src = list[current];
    imgEl.classList.add('is-loading');
    imgEl.src = src.currentSrc || src.src;
    imgEl.alt = src.alt || '';
    capEl.textContent = src.alt || '';
    countEl.textContent = (current + 1) + ' / ' + list.length;
    overlay.classList.toggle('single', list.length < 2);
    /* Preload the neighbours so next/prev feel instant */
    [1, -1].forEach(function (d) {
      var n = list[(current + d + list.length) % list.length];
      if (n && n !== src) { new Image().src = n.currentSrc || n.src; }
    });
  }

  function go(step) { show(current + step); }

  function open(i) {
    build();
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('lb-open');
    show(i);
    requestAnimationFrame(function () { overlay.classList.add('is-open'); });
    closeBtn.focus();
    try {
      if (window.gtag) gtag('event', 'gallery_open', { event_category: 'sbr_landing', event_label: String(current + 1) });
    } catch (e) { /* tracking must never break the viewer */ }
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('is-open');
    document.body.classList.remove('lb-open');
    setTimeout(function () { overlay.hidden = true; imgEl.removeAttribute('src'); }, 180);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* Keyboard: Esc, arrows, and keep Tab inside the viewer */
  document.addEventListener('keydown', function (e) {
    if (!overlay || overlay.hidden) return;
    if (e.key === 'Escape') { close(); }
    else if (e.key === 'ArrowLeft') { go(-1); }
    else if (e.key === 'ArrowRight') { go(1); }
    else if (e.key === 'Tab') {
      var f = [closeBtn, prevBtn, nextBtn].filter(function (b) { return b.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* Make every gallery image clickable and keyboard-accessible */
  gallery.addEventListener('click', function (e) {
    var t = e.target.closest('img');
    if (!t) return;
    var i = items().indexOf(t);
    if (i > -1) open(i);
  });
  gallery.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.tagName === 'IMG') {
      e.preventDefault(); e.target.click();
    }
  });
  Array.prototype.forEach.call(gallery.querySelectorAll('img'), function (img) {
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'View larger: ' + (img.alt || 'project image'));
  });
})();
