/**
 * SBR One Residence - landing page script
 * - Google Ads / GA4 tracking (conversion events on WhatsApp click, call click, form submit)
 * - Captures keyword / campaign / gclid from the ad click and sends them with the lead
 * - Validates the mobile number, blocks bots (honeypot + too-fast submit), posts to the existing Apps Script
 *
 * Needs js/form-handler.js loaded first (it defines GOOGLE_APPS_SCRIPT_URL).
 */
(function () {
  'use strict';

  /* ===================== CONFIG: fill these in ===================== */
  var CONFIG = {
    waNumber: '917975954357',                    // WhatsApp number, country code first, no +
    waMessage: 'Hi, I am interested in SBR One Residence, Whitefield. Please share the price and details.',
    property: 'SBR One Residence',
    leadSource: 'Google Ads - SBR Landing',

    // Google Ads conversion tracking. Replace the X placeholders with your own IDs.
    adsId: 'AW-16990959723',                      // Google Ads > Goals > Conversions > Tag setup
    labels: {
      whatsapp: 'DbuMCJ2F17kdEOvw9aU_',           // conversion label for "WhatsApp click"
      call: '3JYlCJqF17kdEOvw9aU_',               // conversion label for "Call click"
      form: 'W2OuCJ-E17kdEOvw9aU_'                // conversion label for "Form submit"
    },
    ga4Id: '',                                   // optional, e.g. 'G-ABC123XYZ'
    clarityId: ''                                // optional, Microsoft Clarity project id
  };
  /* ================================================================= */

  var isPlaceholder = function (v) { return !v || /X{5,}/.test(v); };
  var pageLoadedAt = Date.now();

  /* ---------- 1. Capture ad parameters (kept for the whole visit) ---------- */
  var PARAM_KEYS = ['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'matchtype', 'adgroupid'];
  var params = {};
  try {
    var qs = new URLSearchParams(window.location.search);
    PARAM_KEYS.forEach(function (k) { if (qs.get(k)) params[k] = qs.get(k); });
    if (Object.keys(params).length) {
      sessionStorage.setItem('sbr_params', JSON.stringify(params));
    } else {
      var saved = sessionStorage.getItem('sbr_params');
      if (saved) params = JSON.parse(saved) || {};
    }
  } catch (e) { /* storage blocked: carry on with what we have */ }

  /* ---------- 2. Load Google tag (and optional GA4 / Clarity) ---------- */
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  var tagId = !isPlaceholder(CONFIG.adsId) ? CONFIG.adsId : (CONFIG.ga4Id || '');
  if (tagId) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(tagId);
    document.head.appendChild(s);
    gtag('js', new Date());
    if (!isPlaceholder(CONFIG.adsId)) gtag('config', CONFIG.adsId);
    if (CONFIG.ga4Id) gtag('config', CONFIG.ga4Id);
  }
  if (CONFIG.clarityId) {
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CONFIG.clarityId);
  }

  /* Fire a Google Ads conversion + a GA4 event. Safe if IDs are still placeholders. */
  function track(kind, where) {
    try {
      var evt = { whatsapp: 'whatsapp_click', call: 'call_click', form: 'generate_lead', cta: 'cta_click' }[kind] || kind;
      gtag('event', evt, { event_category: 'sbr_landing', event_label: where || '', keyword: params.utm_term || '' });
      var label = CONFIG.labels[kind];
      if (!isPlaceholder(CONFIG.adsId) && !isPlaceholder(label)) {
        gtag('event', 'conversion', { send_to: CONFIG.adsId + '/' + label, transport_type: 'beacon' });
      }
    } catch (e) { /* never block the user on tracking errors */ }
  }

  /* ---------- 3. WhatsApp links (pre-filled message, keyword ref for the sales team) ---------- */
  function waLink() {
    var msg = CONFIG.waMessage;
    if (params.utm_term) msg += ' (Ref: ' + params.utm_term.slice(0, 40) + ')';
    return 'https://wa.me/' + CONFIG.waNumber + '?text=' + encodeURIComponent(msg);
  }
  document.querySelectorAll('a[data-wa]').forEach(function (a) { a.href = waLink(); });

  /* Click tracking for every tracked button */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-track]');
    if (!el) return;
    track(el.getAttribute('data-track'), el.getAttribute('data-loc'));
  });

  /* ---------- 4. Gallery: show the section only if at least one image loads ---------- */
  var gallery = document.getElementById('gallery');
  if (gallery) {
    gallery.querySelectorAll('img').forEach(function (img) {
      function ok() { gallery.hidden = false; }
      function bad() { img.classList.add('broken'); }
      if (img.complete && img.naturalWidth > 0) ok();
      img.addEventListener('load', ok);
      img.addEventListener('error', bad);
    });
  }

  /* ---------- 5. Lead form ---------- */
  var form = document.getElementById('leadForm');
  if (!form) return;
  var msgEl = document.getElementById('formMsg');
  var btn = document.getElementById('submitBtn');
  var nameEl = document.getElementById('f-name');
  var phoneEl = document.getElementById('f-phone');
  var phoneWrap = phoneEl.parentNode;
  var submitting = false;

  function normalisePhone(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    return d;
  }
  function validPhone(d) {
    if (!/^[6-9]\d{9}$/.test(d)) return false;        // Indian mobile numbers start with 6-9
    if (/^(\d)\1{9}$/.test(d)) return false;            // 9999999999
    if (d === '9876543210' || d === '6789012345') return false;
    return true;
  }
  function showError(text, field) {
    msgEl.textContent = text;
    [nameEl, phoneWrap].forEach(function (n) { n.classList.remove('invalid'); });
    if (field) { field.classList.add('invalid'); (field === phoneWrap ? phoneEl : field).focus(); }
  }

  phoneEl.addEventListener('input', function () { phoneWrap.classList.remove('invalid'); msgEl.textContent = ''; });
  nameEl.addEventListener('input', function () { nameEl.classList.remove('invalid'); msgEl.textContent = ''; });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (submitting) return;

    var name = nameEl.value.trim();
    var phone = normalisePhone(phoneEl.value);

    if (name.length < 2) return showError('Please enter your name.', nameEl);
    if (!validPhone(phone)) return showError('Please enter a valid 10-digit Indian mobile number.', phoneWrap);
    if (!document.getElementById('f-consent').checked) return showError('Please tick the consent box so we can contact you.');

    // Bot checks: honeypot filled, or form submitted unrealistically fast.
    var tooFast = (Date.now() - pageLoadedAt) < 1200;
    if (form.company_website.value || tooFast) { return showThanks(false); }

    if (typeof GOOGLE_APPS_SCRIPT_URL === 'undefined') {
      return showError('The form is not available right now. Please use WhatsApp or call us.');
    }

    submitting = true;
    msgEl.textContent = '';
    btn.disabled = true;
    var original = btn.textContent;
    btn.textContent = 'Submitting...';

    var payload = {
      name: name,
      phone: '+91' + phone,
      source: CONFIG.leadSource,
      property: CONFIG.property,
      interestedIn: form.interestedIn.value,
      budget: form.budget.value,
      message: 'Consent given on landing page',
      utm_term: params.utm_term || '',
      matchtype: params.matchtype || '',
      utm_campaign: params.utm_campaign || '',
      adgroupid: params.adgroupid || '',
      gclid: params.gclid || '',
      page: window.location.pathname
    };

    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);

    fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        clearTimeout(timer);
        if (!res || !res.success) throw new Error((res && res.error) || 'failed');
        showThanks(true);
      })
      .catch(function () {
        clearTimeout(timer);
        submitting = false;
        btn.disabled = false;
        btn.textContent = original;
        showError('Could not send your details. Please try again, or message us on WhatsApp.');
      });
  });

  function showThanks(real) {
    if (real) track('form', 'lead_form');     // only real leads count as conversions
    document.getElementById('formPanel').hidden = true;
    var t = document.getElementById('thanksPanel');
    t.hidden = false;
    t.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();
