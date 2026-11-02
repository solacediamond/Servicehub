/* ServiceHub visitor analytics tracker.
 *
 * Sends tiny, anonymous pings to the separate analytics Apps Script:
 *   - "hit"  once per page load (counts a page view)
 *   - "beat" every ~45s while the tab is visible (keeps "active now" accurate)
 * Only the page path is sent (no query string, no #hash, no personal data).
 * Never shows anything, never throws, backs off when the backend is struggling.
 *
 * >>> PASTE YOUR NEW ANALYTICS WEB APP URL BELOW (ends with /exec) <<<
 */
(function () {
  "use strict";

  var URL_ = "https://script.google.com/macros/s/AKfycbx_ulhnB086NyUF5o3v8T2dXJgm0x3a-ko54piihkJ1dXGQrD6jYb-QBEpLilX0ULBR/exec";
  window.SERVICEHUB_ANALYTICS_URL = window.SERVICEHUB_ANALYTICS_URL || URL_;

  try {
    var api = String(window.SERVICEHUB_ANALYTICS_URL || "").trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(api)) return;   // not configured yet
    if (navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse|preview/i.test(navigator.userAgent || "")) return;

    var BEAT_MS = 45000, MAX_BACKOFF_MS = 10 * 60 * 1000;
    var store = {
      get: function (s, k) { try { return window[s].getItem(k); } catch (e) { return null; } },
      set: function (s, k, v) { try { window[s].setItem(k, v); } catch (e) {} }
    };

    /* anonymous visitor id (random, stored in this browser only) */
    var vid = store.get("localStorage", "shVid"), isNewVisitor = false;
    if (!vid) {
      vid = (Math.random().toString(36).slice(2, 10) + Date.now().toString(36)).slice(0, 20);
      store.set("localStorage", "shVid", vid);
      isNewVisitor = true;
    }
    var isNewSession = !store.get("sessionStorage", "shSess");
    if (isNewSession) store.set("sessionStorage", "shSess", "1");

    var device = /ipad|tablet/i.test(navigator.userAgent) ? "tablet" : /mobi|android|iphone/i.test(navigator.userAgent) ? "mobile" : "desktop";

    /* failed pings are counted in this browser and reported with the next ping that gets through */
    var failed = Number(store.get("localStorage", "shAnFail")) || 0;
    var pausedUntil = 0, interval = BEAT_MS, timer = null, lastSent = 0;

    function send(type, first) {
      var now = Date.now();
      if (now < pausedUntil) return;
      lastSent = now;
      var q = "action=ping&t=" + type +
        "&v=" + encodeURIComponent(vid) +
        "&p=" + encodeURIComponent(location.pathname.slice(0, 80)) +
        "&d=" + device;
      if (first) {
        q += "&r=" + encodeURIComponent((document.referrer || "").slice(0, 200)) +
             (isNewVisitor ? "&nv=1" : "") + (isNewSession ? "&ns=1" : "");
      }
      if (failed > 0) q += "&f=" + failed;
      q += "&_=" + now;

      var ctrl = window.AbortController ? new AbortController() : null;
      var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
      fetch(api + "?" + q, { method: "GET", cache: "no-store", credentials: "omit", signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          clearTimeout(to);
          if (failed > 0) { failed = 0; store.set("localStorage", "shAnFail", "0"); }
          if (j && j.busy) { interval = Math.min(interval * 2, MAX_BACKOFF_MS); }   // server says it is busy: slow down
          else interval = BEAT_MS;
          schedule();
        })
        .catch(function () {
          clearTimeout(to);
          failed = Math.min(failed + 1, 1000);
          store.set("localStorage", "shAnFail", String(failed));
          interval = Math.min(interval * 2, MAX_BACKOFF_MS);                        // back off: do not hammer a failing backend
          pausedUntil = Date.now() + Math.min(interval, MAX_BACKOFF_MS);
          schedule();
        });
    }

    function schedule() {
      clearTimeout(timer);
      if (document.hidden) return;
      timer = setTimeout(function () { send("beat"); }, interval);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { clearTimeout(timer); return; }
      if (Date.now() - lastSent > BEAT_MS) send("beat"); else schedule();
    });

    send("hit", true);
  } catch (e) { /* tracking must never break the site */ }
})();
