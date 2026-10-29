/* ServiceHub welcome + "thanks for visiting" screens.  Home page (index.html) only.
 *
 * WELCOME
 *   Plays when someone opens the site (once per browser session, so moving
 *   around the site and coming back to the home page does not replay it).
 *   It fades away by itself after about 3 seconds; a tap or a key press skips it.
 *   The hero typing on the home page starts as the welcome fades out
 *   (script.js waits for the "sh:welcome-done" event).
 *
 * THANKS FOR VISITING
 *   Shown ONLY when the person presses back while on the home page, i.e. when
 *   they are about to leave the site. It never closes by itself and says
 *   "Back again to exit". Going from the home page to another page does not
 *   show it. nav-guard.js owns the history entries and calls show() / hide()
 *   below when the person lands on, or moves off, the "exit" entry.
 *
 * Load this in <head> (no defer) BEFORE nav-guard.js, so the welcome covers
 * the page from the very first paint and the hooks exist when nav-guard runs.
 */
(function () {
  "use strict";
  if (window.serviceHubExitScreen) return;

  var root = document.documentElement;
  var WELCOME_KEY = "serviceHubWelcomed";
  var WELCOME_MS = 3000;
  var FADE_MS = 650;

  var reduceMotion = false;
  try { reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (_) {}

  function historyState() {
    return history.state && typeof history.state === "object" ? history.state : null;
  }

  /* ---------- markup ---------- */

  function build(kind) {
    var el = document.createElement("div");
    el.className = "sh-fx sh-fx--" + kind;
    el.setAttribute("role", kind === "exit" ? "dialog" : "status");
    if (kind === "exit") {
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-labelledby", "sh-fx-exit-title");
    } else {
      el.setAttribute("aria-live", "polite");
    }

    var chrome =
      '<div class="sh-fx-blobs" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="sh-fx-grid" aria-hidden="true"></div>' +
      '<div class="sh-fx-scan" aria-hidden="true"></div>';

    var corners =
      '<span class="sh-fx-corner tl" aria-hidden="true"></span><span class="sh-fx-corner tr" aria-hidden="true"></span>' +
      '<span class="sh-fx-corner bl" aria-hidden="true"></span><span class="sh-fx-corner br" aria-hidden="true"></span>';

    var orb =
      '<div class="sh-fx-orb" aria-hidden="true"><span class="sh-fx-ring r2"></span><span class="sh-fx-ring"></span><span class="sh-fx-bolt">ϟ</span></div>';

    if (kind === "welcome") {
      el.innerHTML = chrome +
        '<div class="sh-fx-card">' + corners + orb +
        '<p class="sh-fx-kicker">SERVICEHUB // SYSTEM ONLINE</p>' +
        '<h2 class="sh-fx-title">Welcome to <em>ServiceHub</em></h2>' +
        '<p class="sh-fx-sub">Find the right person for the job.</p>' +
        '<div class="sh-fx-bar" aria-hidden="true"><i></i></div>' +
        '<p class="sh-fx-status" aria-hidden="true"><b></b><span class="sh-fx-status-text">INITIALIZING</span></p>' +
        '</div>' +
        '<button type="button" class="sh-fx-skip">Tap to skip</button>';
    } else {
      el.innerHTML = chrome +
        '<div class="sh-fx-card">' + corners + orb +
        '<p class="sh-fx-kicker">SERVICEHUB // SESSION COMPLETE</p>' +
        '<h2 class="sh-fx-title" id="sh-fx-exit-title">Thanks for <em>visiting</em></h2>' +
        '<p class="sh-fx-sub">Hope to see you again soon.</p>' +
        '<div class="sh-fx-hint"><span class="sh-fx-chev" aria-hidden="true">‹</span><span>Back again to exit</span></div>' +
        '<button type="button" class="sh-fx-stay">Stay on ServiceHub</button>' +
        '</div>';
    }
    return el;
  }

  /* ---------- welcome ---------- */

  var welcomeEl = null;
  var welcomeFinish = null;

  function welcomeAlreadySeen() {
    try { return !!sessionStorage.getItem(WELCOME_KEY); } catch (_) { return false; }
  }

  function startWelcome() {
    var s = historyState();
    if (s && s.shHomeBase) return;      /* sitting on the exit entry: no welcome */
    if (welcomeAlreadySeen()) return;
    try { sessionStorage.setItem(WELCOME_KEY, "1"); } catch (_) {}

    var duration = reduceMotion ? 1600 : WELCOME_MS;
    welcomeEl = build("welcome");
    welcomeEl.style.setProperty("--sh-dur", duration + "ms");
    root.classList.add("sh-welcome-on");
    root.appendChild(welcomeEl);
    welcomeEl.classList.add("is-on");

    var label = welcomeEl.querySelector(".sh-fx-status-text");
    var timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    if (label) {
      later(function () { label.textContent = "CONNECTING PROVIDERS"; }, Math.round(duration * 0.28));
      later(function () { label.textContent = "LOADING SERVICES"; }, Math.round(duration * 0.58));
      later(function () { label.textContent = "READY"; }, Math.round(duration * 0.86));
    }

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      document.removeEventListener("keydown", onKey, true);
      var el = welcomeEl;
      el.classList.add("is-leaving");
      /* let the page underneath start its own intro as the glass fades */
      root.classList.remove("sh-welcome-on");
      try { window.dispatchEvent(new Event("sh:welcome-done")); } catch (_) {}
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (welcomeEl === el) { welcomeEl = null; welcomeFinish = null; }
      }, reduceMotion ? 350 : FADE_MS + 50);
    }
    function onKey(e) {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.preventDefault(); finish(); }
    }
    welcomeFinish = finish;
    welcomeEl.addEventListener("click", finish);
    document.addEventListener("keydown", onKey, true);
    later(finish, duration);
  }

  /* ---------- thanks for visiting (exit screen) ---------- */

  var exitEl = null;
  var exitOn = false;
  var exitHideTimer = null;

  function ensureExit() {
    if (exitEl) return exitEl;
    exitEl = build("exit");
    root.appendChild(exitEl);
    var stay = exitEl.querySelector(".sh-fx-stay");
    stay.addEventListener("click", function () {
      var guard = window.serviceHubNavGuard;
      if (guard && typeof guard.stayOnHome === "function") guard.stayOnHome();
      else hideExit();
    });
    return exitEl;
  }

  function onExitKey(e) {
    if (e.key === "Escape" && exitOn) {
      e.preventDefault();
      var stay = exitEl && exitEl.querySelector(".sh-fx-stay");
      if (stay) stay.click();
    }
  }

  function showExit() {
    if (welcomeFinish) welcomeFinish();
    var el = ensureExit();
    if (exitHideTimer) { clearTimeout(exitHideTimer); exitHideTimer = null; }
    if (exitOn) return true;
    exitOn = true;
    el.classList.remove("is-leaving");
    el.classList.add("is-on");
    root.classList.add("sh-exit-on");
    document.addEventListener("keydown", onExitKey, true);
    var stay = el.querySelector(".sh-fx-stay");
    setTimeout(function () { try { if (exitOn && stay) stay.focus({ preventScroll: true }); } catch (_) {} }, 80);
    return true;
  }

  function hideExit() {
    if (!exitOn || !exitEl) return;
    exitOn = false;
    var el = exitEl;
    el.classList.add("is-leaving");
    root.classList.remove("sh-exit-on");
    document.removeEventListener("keydown", onExitKey, true);
    exitHideTimer = setTimeout(function () {
      exitHideTimer = null;
      if (!exitOn) el.classList.remove("is-on", "is-leaving");
    }, reduceMotion ? 350 : FADE_MS);
  }

  window.serviceHubExitScreen = {
    show: showExit,
    hide: hideExit,
    isShowing: function () { return exitOn; }
  };

  startWelcome();
})();
