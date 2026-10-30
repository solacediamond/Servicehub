/* ServiceHub bottom bar
 *
 * A fixed, solid (no glass) bar at the bottom of the screen with four sections:
 *   Home (default, bottom-left)  ·  Products  ·  Activities  ·  Account
 *
 *  - Stays fixed; the page scrolls underneath it.
 *  - Setting (Settings page): "Stay fixed" or "Hide while scrolling down".
 *    In the hide mode the bar slides away as you scroll down the page and comes
 *    back as soon as you scroll up (and always at the very top / bottom).
 *    Stored on this device in localStorage ("serviceHubBottomBarMode").
 *  - Switching between Products / Activities / Account replaces the current
 *    page instead of stacking history, and tapping Home from one of them goes
 *    back to it, so the phone's back button is never made to walk through tabs.
 *  - Floating buttons (social button, language button) rest above the bar. They
 *    follow it when it hides or shows: the bar publishes its height in the CSS
 *    variable --sh-bar-offset and fires a "sh-bottombar" event.
 *
 * Load in <head> WITHOUT defer, before i18n.js:  <script src="bottom-nav.js"></script>
 */
(function () {
  "use strict";

  var BAR_H = 64;                       /* bar height without the phone's safe area */
  var MODE_KEY = "serviceHubBottomBarMode";   /* "fixed" | "auto" */

  var TABS = [
    { id: "home", label: "Home", href: "index.html",
      svg: '<path d="M3 11.2 12 3.5l9 7.7V20a1 1 0 0 1-1 1h-5v-6.2H9V21H4a1 1 0 0 1-1-1z"/>' },
    { id: "products", label: "Products", href: "products.html",
      svg: '<path d="m21 8-9-5-9 5v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>' },
    { id: "activities", label: "Activities", href: "activities.html",
      svg: '<path d="M3 12h4l3-8 4 16 3-8h4"/>' },
    { id: "account", label: "Account", href: "account.html",
      svg: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>' }
  ];

  /* Which tab each page belongs to. Everything not listed belongs to Home. */
  var PAGE_TAB = {
    "products.html": "products",
    "activities.html": "activities",
    "account.html": "account"
  };

  function pageName() {
    var p = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (p.indexOf(".") === -1) p += ".html";
    return p;
  }

  var page = pageName();
  var current = PAGE_TAB[page] || "home";

  /* The language button (i18n.js) reads this once when it is created, so it
     is set right now, before the deferred scripts run. */
  if (typeof window.SERVICEHUB_I18N_BOTTOM === "undefined") {
    window.SERVICEHUB_I18N_BOTTOM = BAR_H + 14;
  }

  /* ---------- mode ---------- */
  function getMode() {
    try { return localStorage.getItem(MODE_KEY) === "auto" ? "auto" : "fixed"; }
    catch (_) { return "fixed"; }
  }
  function setMode(m) {
    m = m === "auto" ? "auto" : "fixed";
    try { localStorage.setItem(MODE_KEY, m); } catch (_) {}
    applyMode();
  }

  /* ---------- styles ---------- */
  var CSS = [
    "html.sh-has-bar body{padding-bottom:calc(" + BAR_H + "px + env(safe-area-inset-bottom,0px))!important;}",

    "#sh-bottom-bar{position:fixed;left:0;right:0;bottom:0;z-index:1980;display:flex;",
    "background:#0e1422;border-top:1px solid rgba(255,255,255,.10);",
    "padding:0 max(0px,env(safe-area-inset-right,0px)) env(safe-area-inset-bottom,0px) max(0px,env(safe-area-inset-left,0px));",
    "transform:translateY(0);transition:transform .32s cubic-bezier(.3,.7,.3,1);will-change:transform;}",
    "#sh-bottom-bar.sh-bb-hidden{transform:translateY(105%);}",

    "#sh-bottom-bar .sh-bb-item{position:relative;flex:1 1 0;min-width:0;height:" + BAR_H + "px;",
    "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;",
    "color:#8f9aae;text-decoration:none;font:600 11.5px/1 Arial,sans-serif;letter-spacing:.1px;",
    "-webkit-tap-highlight-color:transparent;transition:color .2s ease;}",
    "#sh-bottom-bar .sh-bb-item svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.8;",
    "stroke-linecap:round;stroke-linejoin:round;transition:transform .2s ease;}",
    "#sh-bottom-bar .sh-bb-item:active svg{transform:scale(.88);}",
    "#sh-bottom-bar .sh-bb-item.active{color:#2388ff;}",
    "#sh-bottom-bar .sh-bb-item.active svg{stroke-width:2.1;}",
    "#sh-bottom-bar .sh-bb-item.active::before{content:'';position:absolute;top:0;left:28%;right:28%;height:3px;",
    "border-radius:0 0 4px 4px;background:#2388ff;}",
    "#sh-bottom-bar .sh-bb-item:focus-visible{outline:2px solid #2388ff;outline-offset:-4px;border-radius:10px;}",

    /* the language button rides above the bar (and drops down when it hides) */
    "#sh-lang-btn{bottom:calc(max(var(--sh-bar-offset,0px),env(safe-area-inset-bottom,0px)) + 14px)!important;",
    "transition:bottom .32s cubic-bezier(.3,.7,.3,1);}",

    "@media (min-width:900px){#sh-bottom-bar{justify-content:center;}#sh-bottom-bar .sh-bb-item{max-width:190px;}}",
    "@media (prefers-reduced-motion:reduce){#sh-bottom-bar,#sh-bottom-bar .sh-bb-item svg{transition:none;}}"
  ].join("");

  /* ---------- state ---------- */
  var bar = null, hidden = false, kbOpen = false, lastY = 0, ticking = false;

  function visibleHeight() {
    if (!bar || hidden || kbOpen) return 0;
    return bar.offsetHeight || BAR_H;
  }

  function publish() {
    var h = visibleHeight();
    document.documentElement.style.setProperty("--sh-bar-offset", h + "px");
    try { window.dispatchEvent(new CustomEvent("sh-bottombar", { detail: { inset: h } })); } catch (_) {}
  }

  function setHidden(v) {
    if (hidden === v) return;
    hidden = v;
    if (bar) bar.classList.toggle("sh-bb-hidden", hidden || kbOpen);
    publish();
  }

  /* ---------- hide on scroll down / show on scroll up ---------- */
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (getMode() !== "auto") { setHidden(false); return; }

      var y = Math.max(0, window.pageYOffset || document.documentElement.scrollTop || 0);
      var maxY = Math.max(0, (document.documentElement.scrollHeight || 0) - window.innerHeight);
      var d = y - lastY;

      if (y < 24 || y >= maxY - 6) {                /* very top or very bottom: always show */
        setHidden(false); lastY = y; return;
      }
      if (Math.abs(d) < 7) return;                  /* ignore tiny jitters */
      setHidden(d > 0);                             /* down = hide, up = show */
      lastY = y;
    });
  }

  function applyMode() {
    lastY = Math.max(0, window.pageYOffset || 0);
    if (getMode() !== "auto") setHidden(false);
  }

  /* ---------- tab taps ---------- */
  function referrerPage() {
    try {
      if (!document.referrer) return "";
      var u = new URL(document.referrer);
      if (u.origin !== location.origin) return "";
      return (u.pathname.split("/").pop() || "index.html").toLowerCase();
    } catch (_) { return ""; }
  }

  function onTap(e) {
    var a = e.target && e.target.closest ? e.target.closest(".sh-bb-item") : null;
    if (!a) return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;

    var target = a.getAttribute("data-tab");
    var root = a.getAttribute("href");

    /* Already on this tab's own page: just go to the top */
    if (page === root) {
      e.preventDefault();
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) { window.scrollTo(0, 0); }
      return;
    }

    /* Going to Home */
    if (target === "home") {
      e.preventDefault();
      if (current !== "home" && referrerPage() === "index.html" && history.length > 1) history.back();
      else if (current !== "home") location.replace("index.html");
      else location.assign("index.html");
      return;
    }

    /* From Home (or a Home page like Explore) to another tab: a normal visit,
       so back returns to where the person was. */
    if (current === "home") return;

    /* Tab to tab: swap the page, no extra history */
    e.preventDefault();
    location.replace(root);
  }

  /* ---------- build ---------- */
  function build() {
    if (document.getElementById("sh-bottom-bar") || !document.body) return;

    var st = document.createElement("style");
    st.id = "sh-bottom-bar-style";
    st.textContent = CSS;
    document.head.appendChild(st);

    bar = document.createElement("nav");
    bar.id = "sh-bottom-bar";
    bar.setAttribute("aria-label", "Main sections");

    TABS.forEach(function (t) {
      var a = document.createElement("a");
      a.className = "sh-bb-item" + (t.id === current ? " active" : "");
      a.href = t.href;
      a.setAttribute("data-tab", t.id);
      if (t.id === current) a.setAttribute("aria-current", "page");
      a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + t.svg + "</svg><span>" + t.label + "</span>";
      bar.appendChild(a);
    });

    document.body.appendChild(bar);
    document.documentElement.classList.add("sh-has-bar");
    bar.addEventListener("click", onTap);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", publish);
    window.addEventListener("orientationchange", publish);

    /* The on-screen keyboard: tuck the bar away while typing */
    document.addEventListener("focusin", function (e) {
      var t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !/^(checkbox|radio|button|submit)$/i.test(t.type || "")) {
        kbOpen = true; bar.classList.add("sh-bb-hidden"); publish();
      }
    });
    document.addEventListener("focusout", function () {
      setTimeout(function () {
        var a = document.activeElement;
        if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
        kbOpen = false; bar.classList.toggle("sh-bb-hidden", hidden); publish();
      }, 120);
    });

    /* back/forward-cache restore: show it fresh */
    window.addEventListener("pageshow", function (ev) {
      if (!ev.persisted) return;
      kbOpen = false; hidden = false; bar.classList.remove("sh-bb-hidden"); publish();
    });

    /* the setting changed in another tab */
    window.addEventListener("storage", function (ev) {
      if (ev.key === MODE_KEY) applyMode();
    });

    lastY = Math.max(0, window.pageYOffset || 0);
    publish();
  }

  window.serviceHubBottomBar = {
    inset: visibleHeight,
    getMode: getMode,
    setMode: setMode,
    height: function () { return BAR_H; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
