/*!
 * ServiceHub i18n.js - automatic page translation (no need to tag every text).
 * Keep your code in English. This script finds visible text on the page, translates it
 * into the visitor's language (device language, or the one they pick) and swaps it in.
 *
 * Setup: nothing to configure. It reuses window.SERVICEHUB_APPS_SCRIPT_URL (backend-config.js).
 * Skip an element (names, phone numbers, etc.):  add  data-no-translate  to it.
 * Dynamic text in your own JS:  ServiceHubI18n.translate("Saved!").then(function (t) { alert(t); });
 */
(function () {
  'use strict';

  // Uses the same Apps Script web app as the rest of ServiceHub (backend-config.js / script.js).
  // The fallback below is only used on pages that do not load backend-config.js.
  var FALLBACK_URL = 'https://script.google.com/macros/s/AKfycbz5A8etpNb1sL8aLLBZf5cuB2v-QZHioXAMRMFHUSaZchoxnca4dJ4sSaC57L23M4Fu/exec';
  function apiUrl() {
    return String(window.SERVICEHUB_APPS_SCRIPT_URL || window.SERVICEHUB_API_URL || FALLBACK_URL).trim();
  }
  // Private content that must never be sent to the translator or saved in the Translations tab
  // (chat messages, bank details, payment codes). Chat translation is a separate, later stage.
  var NEVER_TRANSLATE = '[data-no-translate],.notranslate,.bubble,#messages,.active-messages,.active-chat-customer,#v-thread .b,.bank-value,.code-box,#paymentCodeNotice';
  var STORE_LANG = 'sh_lang';          // 'auto' or a language code
  var STORE_CACHE = 'sh_tr_';          // + language code
  var CHUNK = 40;
  var RTL = { ar: 1, he: 1, fa: 1, ur: 1, ps: 1, sd: 1, ug: 1, yi: 1 };

  var CODES = ('af sq am ar hy az eu be bn bs bg ca ceb zh-CN zh-TW co hr cs da nl en eo et fi fr fy gl ka de el gu ht ha haw he hi hmn hu is ig id ga it ja jv kn kk km rw ko ku ky lo la lv lt lb mk mg ms ml mt mi mr mn my ne no ny or ps fa pl pt pa ro ru sm gd sr st sn sd si sk sl so es su sw sv tl tg ta tt te th tr tk uk ur ug uz vi cy xh yi yo zu').split(' ');

  // Texts of offline.html. Translated and saved while the visitor is ONLINE, so the offline page
  // can show them in the visitor's language later with no internet.
  var OFFLINE_STRINGS = ["No internet connection", "You're offline", "ServiceHub is still here.", "We can't reach the internet right now. You can still look around what you've opened before.", "That page hasn't been opened before, so it isn't saved on this device. Continue to the home page instead.", "The site can't update in offline mode.", "Whatever you see is based on what was loaded the last time you opened ServiceHub, so it may be out of date.", "Continue in offline mode", "Try again", "Checking connection…", "Still offline. Check your data or Wi-Fi."];
  var offlineDone = {};

  var lang = 'en';
  var cache = {};                 // source text -> translation (current language)
  var failed = {};                // source texts the server could not translate this visit
  var busy = false;
  var textRecs = new WeakMap();   // text node -> {orig, applied}
  var attrRecs = new WeakMap();   // element -> { attr: {orig, applied} }
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, IFRAME: 1, OPTION: 0 };

  /* ---------- language choice ---------- */
  function norm(code) {
    code = String(code || '').replace('_', '-');
    var low = code.toLowerCase();
    if (low === 'zh' || low === 'zh-cn' || low === 'zh-sg' || low === 'zh-hans') return 'zh-CN';
    if (low.indexOf('zh') === 0) return 'zh-TW';
    var base = low.split('-')[0];
    if (base === 'nb' || base === 'nn') base = 'no';
    if (base === 'iw') base = 'he';
    if (base === 'fil') base = 'tl';
    return CODES.indexOf(base) > -1 ? base : 'en';
  }
  function deviceLang() {
    var l = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return norm(l);
  }
  function chosen() {
    var s = 'auto';
    try { s = localStorage.getItem(STORE_LANG) || 'auto'; } catch (e) {}
    return s === 'auto' ? deviceLang() : norm(s);
  }
  function loadCache(code) {
    try { return JSON.parse(localStorage.getItem(STORE_CACHE + code) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveCache() {
    try { localStorage.setItem(STORE_CACHE + lang, JSON.stringify(cache)); } catch (e) {}
  }

  /* ---------- finding text ---------- */
  function skipped(el) {
    while (el && el.nodeType === 1) {
      if (SKIP[el.tagName]) return true;
      if (el.isContentEditable) return true;
      try { if (el.matches(NEVER_TRANSLATE)) return true; } catch (e) {}
      el = el.parentElement;
    }
    return false;
  }
  function worthy(s) {
    return s.length > 0 && s.length <= 1000 && /\p{L}/u.test(s) && !/^(https?:\/\/|www\.)\S+$/i.test(s) && !/^\S+@\S+\.\S+$/.test(s);
  }
  function collect() {
    var items = [];
    if (!document.body) return items;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) {
      var cur = n.nodeValue;
      if (!cur || !cur.trim()) continue;
      var rec = textRecs.get(n);
      var raw = rec && cur === rec.applied ? rec.orig : cur;   // site changed it? then it is new English
      if (skipped(n.parentElement)) continue;
      var key = raw.trim();
      if (!worthy(key)) continue;
      items.push({ node: n, raw: raw, key: key });
    }
    var els = document.body.querySelectorAll('[placeholder],[title],[aria-label],[alt]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (skipped(el)) continue;
      var recs = attrRecs.get(el) || {};
      for (var j = 0; j < ATTRS.length; j++) {
        var a = ATTRS[j];
        if (!el.hasAttribute(a)) continue;
        var cv = el.getAttribute(a);
        var r = recs[a];
        var rw = r && cv === r.applied ? r.orig : cv;
        var k = (rw || '').trim();
        if (!worthy(k)) continue;
        items.push({ el: el, attr: a, raw: rw, key: k });
      }
    }
    return items;
  }

  /* ---------- applying ---------- */
  function setItem(it, value) {
    if (it.node) {
      var lead = it.raw.match(/^\s*/)[0], trail = it.raw.match(/\s*$/)[0];
      var out = value === null ? it.raw : lead + value + trail;
      if (it.node.nodeValue !== out) it.node.nodeValue = out;
      textRecs.set(it.node, { orig: it.raw, applied: out });
    } else {
      var outA = value === null ? it.raw : value;
      if (it.el.getAttribute(it.attr) !== outA) it.el.setAttribute(it.attr, outA);
      var recs = attrRecs.get(it.el) || {};
      recs[it.attr] = { orig: it.raw, applied: outA };
      attrRecs.set(it.el, recs);
    }
  }
  function applyAll() {
    stopObserving();
    var items = collect(), missing = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (lang === 'en') { setItem(it, null); continue; }
      var t = cache[it.key];
      if (t !== undefined) setItem(it, t);
      else { setItem(it, null); if (!failed[it.key]) missing[it.key] = 1; }
    }
    startObserving();
    return Object.keys(missing);
  }

  /* ---------- talking to Apps Script ---------- */
  function ask(code, texts) {
    return fetch(apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'translateTexts', lang: code, texts: texts })
    }).then(function (r) { return r.json(); });
  }
  function run() {
    if (busy || lang === 'en') return;
    var missing = applyAll();
    if (!navigator.onLine) return;               // offline: use saved translations only
    if (!missing.length) { prefetchOffline(); return; }
    busy = true;
    var code = lang;
    (function next() {
      if (code !== lang) { busy = false; return run(); }
      var chunk = missing.splice(0, CHUNK);
      if (!chunk.length) { busy = false; saveCache(); return run(); }
      ask(code, chunk).then(function (res) {
        var got = (res && res.ok && res.translations) || {};
        chunk.forEach(function (k) { if (got[k] !== undefined) cache[k] = got[k]; else failed[k] = 1; });
        if (code === lang) { saveCache(); applyAll(); }
        next();
      }).catch(function () {
        chunk.forEach(function (k) { failed[k] = 1; });
        next();
      });
    })();
  }

  function prefetchOffline() {
    if (lang === 'en' || offlineDone[lang] || !navigator.onLine) return;
    var code = lang;
    var need = OFFLINE_STRINGS.filter(function (k) { return cache[k] === undefined; });
    offlineDone[code] = 1;
    if (!need.length) return;
    ask(code, need).then(function (res) {
      var got = (res && res.ok && res.translations) || {};
      var any = false;
      need.forEach(function (k) { if (got[k] !== undefined) { if (code === lang) cache[k] = got[k]; any = true; } });
      if (any && code === lang) saveCache();
      if (!any) offlineDone[code] = 0;           // try again on a later visit
    }).catch(function () { offlineDone[code] = 0; });
  }
  window.addEventListener('online', function () { run(); });

  /* ---------- watching the page ---------- */
  var obs = null, timer = null;
  function startObserving() {
    if (!obs || !document.body) return;
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  function stopObserving() { if (obs) { obs.disconnect(); } }
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 200); }
  function initObserver() {
    obs = new MutationObserver(schedule);
    startObserving();
  }

  /* ---------- switching language ---------- */
  function setLang(code) {
    try { localStorage.setItem(STORE_LANG, code); } catch (e) {}
    lang = chosen();
    cache = lang === 'en' ? {} : loadCache(lang);
    failed = {};
    var h = document.documentElement;
    h.setAttribute('lang', lang);
    h.setAttribute('dir', RTL[lang.split('-')[0]] ? 'rtl' : 'ltr');
    applyAll();
    run();
    refreshPicker();
  }

  /* ---------- for your own JS (alerts, toasts) ---------- */
  function translate(text) {
    text = String(text);
    if (lang === 'en' || !worthy(text.trim())) return Promise.resolve(text);
    if (cache[text] !== undefined) return Promise.resolve(cache[text]);
    var code = lang;
    return ask(code, [text]).then(function (res) {
      var t = res && res.ok && res.translations && res.translations[text];
      if (t) { if (code === lang) { cache[text] = t; saveCache(); } return t; }
      return text;
    }).catch(function () { return text; });
  }

  /* ---------- picker ---------- */
  var btn, sheet, listEl, searchEl;
  function names(code) {
    var nat = code, eng = code;
    try { nat = new Intl.DisplayNames([code], { type: 'language' }).of(code) || code; } catch (e) {}
    try { eng = new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code; } catch (e) {}
    return { nat: nat, eng: eng };
  }
  function buildPicker() {
    var css = document.createElement('style');
    css.textContent =
      '#sh-lang-btn{position:fixed;left:14px;bottom:calc(' + (window.SERVICEHUB_I18N_BOTTOM || 14) + 'px + env(safe-area-inset-bottom,0px));width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(25,25,40,.78);color:#fff;display:flex;align-items:center;justify-content:center;z-index:99990;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 4px 16px rgba(0,0,0,.35)}' +
      '#sh-lang-btn svg{width:22px;height:22px}' +
      '#sh-lang-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99991;display:none;align-items:flex-end;justify-content:center}' +
      '#sh-lang-ov.open{display:flex}' +
      '#sh-lang-sheet{width:100%;max-width:480px;max-height:78vh;background:rgba(24,24,38,.96);border:1px solid rgba(255,255,255,.14);border-radius:22px 22px 0 0;display:flex;flex-direction:column;color:#fff;font-family:inherit}' +
      '#sh-lang-sheet h3{margin:0;padding:16px 18px 8px;font-size:17px}' +
      '#sh-lang-search{margin:6px 14px 10px;padding:11px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#fff;font-size:15px;outline:none}' +
      '#sh-lang-list{overflow-y:auto;padding:0 8px 16px}' +
      '.sh-lang-row{display:flex;justify-content:space-between;align-items:center;padding:12px 12px;border-radius:12px;cursor:pointer;font-size:15px}' +
      '.sh-lang-row:active,.sh-lang-row:hover{background:rgba(255,255,255,.09)}' +
      '.sh-lang-row small{opacity:.6;margin-left:8px}' +
      '.sh-lang-row.sel{background:linear-gradient(90deg,rgba(255,80,160,.22),rgba(70,120,255,.22))}';
    document.head.appendChild(css);

    btn = document.createElement('button');
    btn.id = 'sh-lang-btn';
    btn.type = 'button';
    btn.setAttribute('data-no-translate', '');
    btn.setAttribute('aria-label', 'Language');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>';
    btn.onclick = function () { sheet.classList.add('open'); searchEl.value = ''; fillList(''); };

    sheet = document.createElement('div');
    sheet.id = 'sh-lang-ov';
    sheet.setAttribute('data-no-translate', '');
    sheet.innerHTML = '<div id="sh-lang-sheet"><h3>Language</h3><input id="sh-lang-search" type="search" placeholder="Search" autocomplete="off"><div id="sh-lang-list"></div></div>';
    sheet.addEventListener('click', function (e) { if (e.target === sheet) sheet.classList.remove('open'); });
    document.body.appendChild(btn);
    document.body.appendChild(sheet);
    listEl = sheet.querySelector('#sh-lang-list');
    searchEl = sheet.querySelector('#sh-lang-search');
    searchEl.addEventListener('input', function () { fillList(searchEl.value); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') sheet.classList.remove('open'); });
  }
  function fillList(q) {
    q = (q || '').toLowerCase().trim();
    var saved = 'auto';
    try { saved = localStorage.getItem(STORE_LANG) || 'auto'; } catch (e) {}
    var rows = [{ code: 'auto', nat: 'Auto (device language)', eng: '' }];
    CODES.forEach(function (c) { var n = names(c); rows.push({ code: c, nat: n.nat, eng: n.eng }); });
    var rest = rows.slice(1).sort(function (a, b) { return a.eng.localeCompare(b.eng); });
    if (!navigator.onLine) {
      rest = rest.filter(function (r) {
        if (r.code === 'en') return true;
        try { return !!localStorage.getItem(STORE_CACHE + r.code); } catch (e) { return false; }
      });
    }
    rows = [rows[0]].concat(rest);
    listEl.innerHTML = '';
    rows.forEach(function (r) {
      if (q && (r.nat + ' ' + r.eng + ' ' + r.code).toLowerCase().indexOf(q) < 0) return;
      var d = document.createElement('div');
      d.className = 'sh-lang-row' + (r.code === saved ? ' sel' : '');
      var a = document.createElement('span');
      a.textContent = r.nat;
      if (r.eng && r.eng !== r.nat) { var s = document.createElement('small'); s.textContent = r.eng; a.appendChild(s); }
      d.appendChild(a);
      d.onclick = function () { sheet.classList.remove('open'); setLang(r.code); };
      listEl.appendChild(d);
    });
  }
  function refreshPicker() { if (listEl) fillList(searchEl ? searchEl.value : ''); }

  /* ---------- start ---------- */
  function init() {
    buildPicker();
    initObserver();
    lang = chosen();
    cache = lang === 'en' ? {} : loadCache(lang);
    var h = document.documentElement;
    h.setAttribute('lang', lang);
    h.setAttribute('dir', RTL[lang.split('-')[0]] ? 'rtl' : 'ltr');
    run();
  }
  window.ServiceHubI18n = { setLang: setLang, getLang: function () { return lang; }, translate: translate };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
