/* ServiceHub navigation guard
 *
 * Load in <head> (no defer) on every page that has a page-leaving effect, a
 * loader overlay, or is part of the payment flow.
 *
 * 1. BLURRY / FROZEN PAGE FIX
 *    When you leave a page, the browser can freeze it whole (back/forward
 *    cache) and unfreeze that exact snapshot when you come back. If you left
 *    while the blur "page-leaving" effect, the sliding "page-transition" panel
 *    or the "Saving your listing" loader was showing, you came back to it,
 *    with nothing left running to remove it. This file removes those leftovers
 *    whenever a page is restored from the back/forward cache.
 *
 * 2. PAYMENT PAGES STAY OUT OF BACK HISTORY ONCE PAYMENT IS CONFIRMED
 *    When the payment is approved the site records a "confirmed" marker for
 *    that listing + payment code. After that, going back into a payment page
 *    (payment, naira, crypto, usd) sends the person on to the form they came
 *    from instead, and the form comes back fresh (not the old filled-in one).
 *    Before confirmation nothing changes: back behaves normally.
 *
 *    A renewal uses a NEW payment code, so it is never mistaken for the
 *    earlier confirmed payment.
 */
(function () {
  "use strict";

  var MARKER_KEY = "serviceHubPaymentConfirmed";
  var DEFAULT_FORM = "list-service.html";
  var JOB_FORM = "login.html";          /* the "List a Job" page */
  var RENEWAL_BACK = "manage.html";

  function get(key) {
    try { return localStorage.getItem(key) || ""; } catch (_) { return ""; }
  }

  function page() {
    var p = location.pathname.split("/").pop() || "index.html";
    return p.toLowerCase();
  }

  function navType() {
    try {
      var e = performance.getEntriesByType("navigation")[0];
      if (e && e.type) return e.type;
    } catch (_) {}
    return "navigate";
  }

  /* ---------- 1. clear leftovers after a back/forward-cache restore ---------- */

  function resetStuckUi() {
    var body = document.body;
    if (!body) return;

    body.classList.remove("page-leaving", "page-exit-right", "listing-upload-locked");

    var panels = document.querySelectorAll(".page-transition");
    for (var i = 0; i < panels.length; i++) {
      if (panels[i].parentNode) panels[i].parentNode.removeChild(panels[i]);
    }

    var overlay = document.getElementById("listingUploadOverlay");
    if (overlay) {
      overlay.classList.remove("is-visible");
      overlay.hidden = true;
      overlay.setAttribute("aria-hidden", "true");
      overlay.setAttribute("aria-busy", "false");
    }
  }

  /* ---------- 2. confirmed-payment marker ---------- */

  function listingType() {
    try {
      var l = JSON.parse(get("serviceHubListing") || "{}");
      return String(l.listingType || l.type || "").toLowerCase();
    } catch (_) { return ""; }
  }

  /* Where "back" should land for the listing being paid for. */
  function formTarget() {
    if (get("serviceHubRenewal") === "true") return RENEWAL_BACK;
    return listingType() === "job" ? JOB_FORM : DEFAULT_FORM;
  }

  /* Called by the payment pages the moment approval is seen. */
  function markConfirmed() {
    var id = get("serviceHubListingId");
    var code = get("serviceHubPaymentCode");
    if (!id) return;
    try {
      localStorage.setItem(MARKER_KEY, JSON.stringify({
        id: id,
        code: code,
        back: formTarget(),
        at: Date.now()
      }));
    } catch (_) {}
  }

  function readMarker() {
    var m = null;
    try { m = JSON.parse(get(MARKER_KEY) || "null"); } catch (_) {}
    if (!m || !m.id) return null;
    return m;
  }

  /* True when the listing currently being worked on has already been paid. */
  function isConfirmed() {
    var m = readMarker();
    if (!m) return false;
    return m.id === get("serviceHubListingId") &&
           String(m.code || "") === get("serviceHubPaymentCode");
  }

  function sameOriginReferrer() {
    try { return !!document.referrer && new URL(document.referrer).origin === location.origin; }
    catch (_) { return false; }
  }

  var fallbackTimer = null;

  /* Step back one entry (the form), or jump straight to the form when there
     is no safe entry to step back to. */
  function leaveToForm(wentBack) {
    var m = readMarker();
    var target = (m && m.back) || DEFAULT_FORM;

    /* Hide this page while we leave so it never flashes on screen. */
    try { document.documentElement.style.visibility = "hidden"; } catch (_) {}

    if (wentBack && history.length > 1 && sameOriginReferrer()) {
      history.go(-1);
      /* If that did nothing, go to the form directly. */
      fallbackTimer = setTimeout(function () { location.replace(target); }, 900);
      return;
    }
    location.replace(target);
  }

  var PAY_PAGES_ALWAYS_BOUNCE = {
    "payment.html": 1,
    "payment-usd.html": 1,
    "payment-crypto.html": 1,
    "payment-crypto-return.html": 1
  };
  /* These two show the success popup, so a fresh load is left alone. */
  var PAY_PAGES_SUCCESS = {
    "payment-naira.html": 1,
    "payment-crypto-status.html": 1
  };

  function guardPaymentPage(restored) {
    var p = page();
    var isAlways = !!PAY_PAGES_ALWAYS_BOUNCE[p];
    var isSuccess = !!PAY_PAGES_SUCCESS[p];
    if (!isAlways && !isSuccess) return;
    if (!isConfirmed()) return;

    var wentBack = restored || navType() === "back_forward";

    if (wentBack) { leaveToForm(true); return; }
    if (isAlways) { leaveToForm(false); }
  }

  /* Form pages: coming back to one after its listing was paid gives a clean
     form instead of the old filled-in one (which would risk a duplicate). */
  function guardFormPage(restored) {
    var p = page();
    if (p !== DEFAULT_FORM && p !== JOB_FORM) return;
    if (!isConfirmed()) return;
    if (!(restored || navType() === "back_forward")) return;
    location.replace(location.pathname);
  }

  /* ---------- run ---------- */

  /* Runs immediately (before the page paints) for a normal load... */
  guardPaymentPage(false);
  guardFormPage(false);

  /* ...and again whenever the browser restores a frozen copy. */
  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    resetStuckUi();
    guardPaymentPage(true);
    guardFormPage(true);
  });

  window.addEventListener("pagehide", function () {
    if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
  });

  window.serviceHubNavGuard = {
    markPaymentConfirmed: markConfirmed,
    resetStuckUi: resetStuckUi
  };
})();
