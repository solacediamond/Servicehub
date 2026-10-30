/* ServiceHub page intro drop-down
 *
 * A small, transparent "liquid glass" card that slides down from under the menu
 * bar when someone opens a page, tells them what the page is for, stays long
 * enough to read, then slides back up.
 *
 *  - Shows only the FIRST time a page is opened in a visit (per browser tab,
 *    kept in sessionStorage). Opening the same page again, or coming back to
 *    it with the back button, does not show it again. A brand new visit
 *    (new tab / browser reopened) shows it again.
 *  - Never adds a history entry, so it can't affect the back button.
 *  - Tap the card to dismiss it early.
 *
 * Load with:  <script src="page-intro.js" defer></script>
 * To change a message, edit the PAGES list below.
 */
(function () {
  "use strict";

  var PAGES = {
    "explore.html": {
      icon: "🧭",
      title: "Welcome to the Services page",
      text: "Here you can explore all the available services."
    },
    "jobs.html": {
      icon: "💼",
      title: "Welcome to the Jobs page",
      text: "Here you can browse jobs that people have posted."
    },
    "list-service.html": {
      icon: "🛠️",
      title: "List your service",
      text: "Fill in your details to put your service in front of customers."
    },
    "login.html": {
      icon: "📝",
      title: "List a job",
      text: "Share the job details so the right people can find and apply."
    },
    "manage.html": {
      icon: "⚙️",
      title: "Listing management",
      text: "Open your listing with your manage link to update it, check chats and change your price."
    },
    "search.html": {
      icon: "🔎",
      title: "Search results",
      text: "Services and jobs that match your search show up here."
    },
    "service.html": {
      icon: "📄",
      title: "Service details",
      text: "See the provider, pricing and portfolio, then contact them."
    },
    "how-it-works.html": {
      icon: "💡",
      title: "How ServiceHub works",
      text: "A quick guide to finding services, listing and getting paid."
    },
    "payment.html": {
      icon: "💳",
      title: "Complete your listing",
      text: "Choose how you want to pay to make your listing live."
    },
    "settings.html": {
      icon: "🎛️",
      title: "Settings",
      text: "Personalise ServiceHub on this device."
    }
  };

  var STORE_PREFIX = "serviceHubPageIntro:";

  function pageName() {
    var p = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (p.indexOf(".") === -1) p += ".html";
    return p;
  }

  var name = pageName();
  var info = PAGES[name];
  if (!info) return;

  /* ---- once per visit ---- */
  function alreadySeen() {
    try { return sessionStorage.getItem(STORE_PREFIX + name) === "1"; }
    catch (_) { return false; }
  }
  function markSeen() {
    try { sessionStorage.setItem(STORE_PREFIX + name, "1"); } catch (_) {}
  }
  if (alreadySeen()) return;

  /* ---- styles ---- */
  var CSS = [
    "#sh-intro-wrap{position:fixed;left:0;right:0;z-index:1995;display:flex;justify-content:center;",
    "padding:0 14px 22px;overflow:hidden;pointer-events:none;}",

    "#sh-intro{pointer-events:auto;box-sizing:border-box;width:100%;max-width:460px;",
    "display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:20px;",
    "color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;",
    "background:linear-gradient(135deg,rgba(255,255,255,.20),rgba(255,255,255,.06) 55%,rgba(120,140,255,.10)),rgba(14,18,30,.42);",
    "border:1px solid rgba(255,255,255,.28);",
    "backdrop-filter:blur(14px) saturate(1.7);-webkit-backdrop-filter:blur(14px) saturate(1.7);",
    "box-shadow:0 14px 36px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(255,255,255,.08);",
    "transform:translateY(-130%);opacity:0;",
    "transition:transform .62s cubic-bezier(.22,1.1,.36,1),opacity .4s ease;}",

    "#sh-intro.sh-intro-in{transform:translateY(0);opacity:1;}",
    "#sh-intro.sh-intro-out{transform:translateY(-130%);opacity:0;",
    "transition:transform .5s cubic-bezier(.5,0,.75,0),opacity .35s ease .1s;}",

    "#sh-intro .sh-intro-icon{flex:0 0 auto;width:38px;height:38px;border-radius:12px;",
    "display:flex;align-items:center;justify-content:center;font-size:19px;",
    "background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25);",
    "box-shadow:inset 0 1px 0 rgba(255,255,255,.35);}",

    "#sh-intro .sh-intro-body{min-width:0;flex:1;}",
    "#sh-intro .sh-intro-title{margin:0;font-size:14.5px;font-weight:700;line-height:1.25;",
    "text-shadow:0 1px 3px rgba(0,0,0,.65);}",
    "#sh-intro .sh-intro-text{margin:3px 0 0;font-size:13px;line-height:1.4;color:rgba(255,255,255,.96);",
    "text-shadow:0 1px 3px rgba(0,0,0,.7);}",

    "@media (prefers-reduced-motion:reduce){#sh-intro,#sh-intro.sh-intro-out{transition:opacity .3s ease;transform:none;}}"
  ].join("");

  function addStyles() {
    if (document.getElementById("sh-intro-style")) return;
    var s = document.createElement("style");
    s.id = "sh-intro-style";
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---- where "below the menu" is on this page ---- */
  function menuBottom() {
    var bar = document.querySelector(".navbar") || document.querySelector("body > header, header");
    if (!bar) return 0;
    var r = bar.getBoundingClientRect();
    return Math.max(0, Math.round(r.bottom));
  }

  var wrap = null, card = null, hideTimer = null, removeTimer = null, shown = false;

  function place() {
    if (wrap) wrap.style.top = menuBottom() + "px";
  }

  function remove() {
    if (removeTimer) { clearTimeout(removeTimer); removeTimer = null; }
    window.removeEventListener("resize", place);
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    wrap = card = null;
  }

  function hide() {
    if (!card) return;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    card.classList.remove("sh-intro-in");
    card.classList.add("sh-intro-out");
    removeTimer = setTimeout(remove, 800);
  }

  /* Long enough to read: about 4.5s plus a little per character (max 9s). */
  function readTime() {
    var len = (info.title + " " + info.text).length;
    return Math.min(9000, 4500 + len * 40);
  }

  function show() {
    if (shown || !document.body) return;
    /* leaving the page already, or a full-screen overlay is showing */
    if (document.body.classList.contains("page-leaving")) return;
    shown = true;
    markSeen();
    addStyles();

    wrap = document.createElement("div");
    wrap.id = "sh-intro-wrap";
    wrap.setAttribute("role", "status");
    wrap.setAttribute("aria-live", "polite");

    card = document.createElement("div");
    card.id = "sh-intro";

    var icon = document.createElement("div");
    icon.className = "sh-intro-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = info.icon;

    var body = document.createElement("div");
    body.className = "sh-intro-body";
    var t = document.createElement("p");
    t.className = "sh-intro-title";
    t.textContent = info.title;
    var d = document.createElement("p");
    d.className = "sh-intro-text";
    d.textContent = info.text;
    body.appendChild(t);
    body.appendChild(d);

    card.appendChild(icon);
    card.appendChild(body);
    wrap.appendChild(card);
    document.body.appendChild(wrap);

    place();
    window.addEventListener("resize", place);
    card.addEventListener("click", hide);

    /* two frames so the starting (hidden) position is painted first */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (card) card.classList.add("sh-intro-in");
      });
    });

    hideTimer = setTimeout(hide, readTime());
  }

  /* Leaving the page (or it going into the back/forward cache): clean up so the
     card is never frozen on screen when the person comes back. */
  window.addEventListener("pagehide", function () {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    remove();
  });

  function start() {
    /* small delay so it appears after the page has settled / any splash */
    setTimeout(show, 600);
  }

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);
})();
