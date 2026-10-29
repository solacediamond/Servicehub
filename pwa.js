/* ServiceHub app support: registers the service worker and shows a small
 * "offline mode" notice at the bottom of any page while there is no internet. */
(function () {
  "use strict";

  /* Apple-inspired liquid-glass visit greeting for web and installed PWA. */
  function installVisitGreeting() {
    if (document.getElementById("sh-visit-greeting")) return;
    var style = document.createElement("style");
    style.id = "sh-visit-greeting-style";
    style.textContent =
      "#sh-visit-greeting{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;" +
      "padding:24px;background:radial-gradient(ellipse at 20% 15%,rgba(35,136,255,.24),transparent 45%)," +
      "radial-gradient(ellipse at 80% 85%,rgba(255,79,216,.18),transparent 42%),rgba(4,8,18,.48);" +
      "backdrop-filter:blur(18px) saturate(155%);-webkit-backdrop-filter:blur(18px) saturate(155%);" +
      "opacity:0;visibility:hidden;transition:opacity .42s ease,visibility .42s ease;pointer-events:none}" +
      "#sh-visit-greeting.sh-vg-show{opacity:1;visibility:visible}" +
      "#sh-visit-greeting .sh-vg-card{position:relative;overflow:hidden;width:min(440px,100%);padding:30px 26px 27px;" +
      "text-align:center;color:#f5f8ff;border:1px solid rgba(255,255,255,.27);border-radius:28px;" +
      "background:linear-gradient(135deg,rgba(255,255,255,.19),rgba(255,255,255,.055));" +
      "box-shadow:0 24px 80px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.28);" +
      "backdrop-filter:blur(28px) saturate(170%);-webkit-backdrop-filter:blur(28px) saturate(170%);" +
      "transform:translateY(12px) scale(.97);transition:transform .55s cubic-bezier(.2,.8,.2,1)}" +
      "#sh-visit-greeting.sh-vg-show .sh-vg-card{transform:translateY(0) scale(1)}" +
      "#sh-visit-greeting .sh-vg-orb{width:58px;height:58px;margin:0 auto 15px;border-radius:19px;" +
      "display:grid;place-items:center;font:800 25px/1 system-ui;color:white;" +
      "background:linear-gradient(145deg,rgba(62,164,255,.9),rgba(132,91,255,.78) 55%,rgba(255,79,216,.76));" +
      "border:1px solid rgba(255,255,255,.45);box-shadow:0 8px 32px rgba(67,127,255,.35),inset 0 1px 0 rgba(255,255,255,.5)}" +
      "#sh-visit-greeting .sh-vg-kicker{font:700 10px/1.4 system-ui;letter-spacing:.22em;text-transform:uppercase;color:#b9d9ff}" +
      "#sh-visit-greeting h2{margin:9px 0 8px;font:750 clamp(24px,6vw,32px)/1.15 system-ui;letter-spacing:-.045em}" +
      "#sh-visit-greeting p{margin:0;color:rgba(242,247,255,.78);font:400 13px/1.65 system-ui}" +
      "#sh-visit-greeting .sh-vg-line{height:2px;width:74px;margin:19px auto 0;border-radius:9px;" +
      "background:linear-gradient(90deg,#2388ff,#a855f7,#ff4fd8);box-shadow:0 0 18px rgba(108,120,255,.6)}" +
      "@media(prefers-reduced-motion:reduce){#sh-visit-greeting,#sh-visit-greeting .sh-vg-card{transition:none}}";
    (document.head || document.documentElement).appendChild(style);

    var overlay = document.createElement("div");
    overlay.id = "sh-visit-greeting";
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("role", "status");
    overlay.innerHTML = '<div class="sh-vg-card"><div class="sh-vg-orb" aria-hidden="true">S</div>' +
      '<div class="sh-vg-kicker">SERVICEHUB · CONNECTED</div><h2></h2><p></p><div class="sh-vg-line"></div></div>';
    document.body.appendChild(overlay);
    var heading = overlay.querySelector("h2");
    var message = overlay.querySelector("p");
    var hideTimer = 0;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function show(kind, duration) {
      heading.textContent = kind === "thanks" ? "Thanks for visiting" : "Welcome to ServiceHub";
      message.textContent = kind === "thanks"
        ? "Your next great connection starts here. See you again soon."
        : "Discover services, connect with people, and get things done.";
      overlay.classList.remove("sh-vg-show");
      window.clearTimeout(hideTimer);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { overlay.classList.add("sh-vg-show"); });
      });
      if (duration) hideTimer = window.setTimeout(function () {
        overlay.classList.remove("sh-vg-show");
      }, duration);
    }

    if (!reduce) show("welcome", 1850);
    else show("welcome", 900);

    /* A short farewell before normal same-tab navigation. Avoid hijacking modified,
       download, external, or new-tab links. */
    document.addEventListener("click", function (event) {
      var a = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!a || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
          event.shiftKey || event.altKey || a.target === "_blank" || a.hasAttribute("download")) return;
      var dest;
      try { dest = new URL(a.href, location.href); } catch (e) { return; }
      if (dest.origin !== location.origin || dest.href === location.href ||
          a.getAttribute("href").charAt(0) === "#") return;
      event.preventDefault();
      show("thanks", 0);
      window.setTimeout(function () { location.href = dest.href; }, reduce ? 180 : 480);
    }, true);

    /* Best effort for tab/app closure. Browsers may stop painting during unload,
       so the reliable farewell animation is the same-tab navigation above. */
    window.addEventListener("pagehide", function () {
      heading.textContent = "Thanks for visiting";
      message.textContent = "See you again soon.";
      overlay.classList.add("sh-vg-show");
    });
  }

  function readyGreeting() {
    if (!document.body) return;
    installVisitGreeting();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", readyGreeting, { once: true });
  } else {
    readyGreeting();
  }


  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {});
    });
  }

  var bar = null;

  function build() {
    var style = document.createElement("style");
    style.textContent =
      ".sh-offline-bar{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));" +
      "z-index:2147483000;max-width:520px;margin:0 auto;padding:11px 14px;border-radius:12px;" +
      "background:#101522;color:#f3f6fa;font:600 13px/1.45 Arial,sans-serif;text-align:center;" +
      "border:1px solid transparent;" +
      "background-image:linear-gradient(#101522,#101522),linear-gradient(90deg,#2388ff,#ff4fd8);" +
      "background-origin:border-box;background-clip:padding-box,border-box;" +
      "box-shadow:0 8px 30px rgba(0,0,0,.45);transform:translateY(160%);transition:transform .3s ease}" +
      ".sh-offline-bar.show{transform:none}" +
      ".sh-offline-bar span{color:#8994a6;font-weight:400}";
    document.head.appendChild(style);

    bar = document.createElement("div");
    bar.className = "sh-offline-bar";
    bar.setAttribute("role", "status");
    bar.innerHTML = "Offline mode <span>· Not updating. Showing what was loaded before.</span>";
    document.body.appendChild(bar);
  }

  function sync() {
    if (!document.body) return;
    if (!bar) build();
    // Two frames so the slide-in transition runs.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        bar.classList.toggle("show", !navigator.onLine);
      });
    });
  }

  window.addEventListener("offline", sync);
  window.addEventListener("online", sync);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { if (!navigator.onLine) sync(); });
  } else if (!navigator.onLine) {
    sync();
  }
})();
