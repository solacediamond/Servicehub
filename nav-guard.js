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

  /* ---------- 3. LOGO = HOME + FRESH HISTORY ----------
   * Tapping the ServiceHub logo goes to the homepage AND makes the homepage the
   * start of the history: pressing back afterwards no longer returns to the pages
   * visited before the logo was tapped.
   *
   * A browser cannot delete history entries, so the homepage keeps a hidden extra
   * entry in front of it and steps forward again whenever back lands behind it.
   * Opening other pages from the homepage and coming back still works normally.
   * It only switches on after the logo has been tapped (for that browser tab), so
   * a first visit to the homepage behaves as usual.
   */
  var FLOOR_KEY = "serviceHubHomeFloor";

  function isHome() {
    var p = page();
    return p === "index.html" || p === "index";
  }
  function floorOn() {
    try { return sessionStorage.getItem(FLOOR_KEY) === "1"; } catch (_) { return false; }
  }
  function st() { return history.state && typeof history.state === "object" ? history.state : null; }
  function atBase() { var s = st(); return !!(s && s.shHomeBase); }
  function atFloor() { var s = st(); return !!(s && s.shHomeFloor); }

  /* Adds the hidden entry. Needs a real tap/click/key press, because browsers
     skip history entries a page adds without any user action.

     It is also what lets the "Thanks for visiting" screen (welcome-exit.js)
     appear: pressing back on the home page lands on the entry behind the
     hidden one, and that is the moment the thanks screen is shown. So the
     entry is now added on every home page visit, not only after the logo tap. */
  function armHomeFloor() {
    if (!isHome() || atFloor() || atBase()) return;
    try {
      var keep = st() || {};
      var base = {}; for (var k in keep) base[k] = keep[k];
      base.shHomeBase = 1;
      history.replaceState(base, "", location.href);
      history.pushState({ shHomeFloor: 1 }, "", location.href);
    } catch (_) {}
  }

  function exitScreen() { return window.serviceHubExitScreen || null; }

  /* Landed on the entry behind the hidden one = pressed back on the home page.
     Show "Thanks for visiting ... Back again to exit" and stay there: the next
     back press leaves, because there is nothing behind this entry for us to hold.
     If the thanks screen is missing for any reason, fall back to the old
     behaviour (step forward again when the logo was tapped). */
  function holdHomeFloor() {
    if (!isHome()) return;

    if (!atBase()) {
      /* moved off the exit entry (forward button, "Stay" button): hide the screen */
      var s = exitScreen();
      if (s && s.isShowing()) s.hide();
      return;
    }

    var screen = exitScreen();
    if (screen) { screen.show(); return; }

    if (!floorOn()) return;
    history.go(1);
    setTimeout(function () {
      if (atBase()) {
        try { history.pushState({ shHomeFloor: 1 }, "", location.href); } catch (_) {}
      }
    }, 300);
  }

  /* "Stay on ServiceHub" on the thanks screen: step forward onto the hidden
     entry again, so the next back press shows the thanks screen once more. */
  function stayOnHome() {
    var s = exitScreen();
    if (s) s.hide();
    if (!isHome() || !atBase()) return;
    history.go(1);
    setTimeout(function () {
      if (atBase()) {
        try { history.pushState({ shHomeFloor: 1 }, "", location.href); } catch (_) {}
      }
    }, 350);
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest("a.logo") : null;
    if (!a) return;
    try { sessionStorage.setItem(FLOOR_KEY, "1"); } catch (_) {}
    if (isHome()) {
      /* already home: no new "#" entry, just back to the top, and switch it on now */
      e.preventDefault();
      armHomeFloor();
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) { window.scrollTo(0, 0); }
    }
  }, true);

  if (isHome()) {
    var gestures = ["pointerup", "touchend", "click", "keydown"];
    var onGesture = function () {
      gestures.forEach(function (g) { document.removeEventListener(g, onGesture, true); });
      armHomeFloor();
    };
    gestures.forEach(function (g) { document.addEventListener(g, onGesture, true); });
    window.addEventListener("popstate", holdHomeFloor);
    window.addEventListener("pageshow", holdHomeFloor);
    holdHomeFloor();
  }

  /* ---------- 4. BACK BUTTONS WORK LIKE THE PHONE'S BACK BUTTON ----------
   * The "← Back" buttons on the pages used to either step back properly
   * (history.back) or open the earlier page as a brand new visit
   * (location.href = ...), which adds another history entry. Pressing the
   * phone's back button then had to walk through all of those extra entries.
   *
   * Now every in-page back button does exactly what the phone's back button
   * does: it goes back ONE entry in the history and adds nothing new.
   * Only when there is nothing of ours to go back to (the page was opened
   * straight from a link, a bookmark or the installed app) does it swap the
   * current page for a sensible one (location.replace), which still adds no
   * history entry.
   */
  var BACK_TARGET = {
    "payment-naira.html": "payment.html",
    "payment-crypto.html": "payment.html"
  };

  function referrerPage() {
    try {
      if (!document.referrer) return "";
      var u = new URL(document.referrer);
      if (u.origin !== location.origin) return "";
      return (u.pathname.split("/").pop() || "index.html").toLowerCase();
    } catch (_) { return ""; }
  }

  function goBack(target) {
    var want = target ? String(target).toLowerCase() : "";
    var prev = referrerPage();

    /* There is an earlier page of ours (and, when a specific page is expected,
       it is that page): step back exactly like the phone's back button. */
    if (prev && history.length > 1 && (!want || prev === want)) {
      history.back();
      return;
    }
    /* Otherwise swap this page for the expected one without adding history. */
    location.replace(target || "index.html");
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    var el = t && t.closest
      ? t.closest(".how-back-btn, .settings-back, a.back-to-services, a.contact-provider-btn")
      : null;
    if (!el) return;

    var p = page();
    var target = BACK_TARGET[p] || "";

    if (el.tagName === "A") {
      /* only the "Back to Home / Back to Services" links, not other buttons */
      var href = (el.getAttribute("href") || "").toLowerCase();
      if (href !== "index.html" && href !== "./index.html") return;
      if (!el.classList.contains("back-to-services") && p !== "how-it-works.html") return;
      target = "index.html";
      /* going "home" from a page we reached from home = just go back */
      if (referrerPage() !== "index.html" && referrerPage() !== "") {
        e.preventDefault();
        e.stopImmediatePropagation();
        location.replace("index.html");
        return;
      }
    }

    e.preventDefault();
    e.stopImmediatePropagation();
    goBack(target);
  }, true);

  window.serviceHubNavGuard = {
    markPaymentConfirmed: markConfirmed,
    resetStuckUi: resetStuckUi,
    stayOnHome: stayOnHome,
    goBack: goBack
  };
})();
