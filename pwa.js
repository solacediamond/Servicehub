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

    if (!reduce) show("welcome", 3500);
    else show("welcome", 3000);

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

    /* Installed PWA exit flow. Web apps cannot force-close their own window;
       on Android, backing out of the root screen can usually return to the launcher. */
    var isStandalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;

    if (isStandalone) {
      var exitDialog = document.createElement("div");
      exitDialog.id = "sh-exit-confirm";
      exitDialog.setAttribute("role", "dialog");
      exitDialog.setAttribute("aria-modal", "true");
      exitDialog.setAttribute("aria-labelledby", "sh-exit-title");
      exitDialog.hidden = true;
      exitDialog.innerHTML = '<div class="sh-exit-card"><div class="sh-vg-kicker">SERVICEHUB · EXIT</div>' +
        '<h2 id="sh-exit-title">Are you sure you want to exit this app?</h2>' +
        '<p>Your visit will end and you can come back anytime.</p>' +
        '<div class="sh-exit-actions"><button type="button" data-sh-exit="stay">No, stay</button>' +
        '<button type="button" data-sh-exit="yes">Yes, exit</button></div></div>';
      style.textContent +=
        '#sh-exit-confirm{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:22px;' +
        'background:rgba(3,7,16,.68);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%)}' +
        '#sh-exit-confirm[hidden]{display:none}' +
        '#sh-exit-confirm .sh-exit-card{width:min(420px,100%);padding:25px;border-radius:25px;color:#f5f8ff;' +
        'border:1px solid rgba(255,255,255,.27);background:linear-gradient(135deg,rgba(255,255,255,.2),rgba(255,255,255,.07));' +
        'box-shadow:0 24px 80px rgba(0,0,0,.45);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px)}' +
        '#sh-exit-confirm h2{margin:12px 0 8px;font:750 23px/1.2 system-ui;letter-spacing:-.035em}' +
        '#sh-exit-confirm p{margin:0;color:rgba(242,247,255,.76);font:14px/1.55 system-ui}' +
        '#sh-exit-confirm .sh-exit-actions{display:flex;gap:10px;margin-top:22px}' +
        '#sh-exit-confirm button{flex:1;border:1px solid rgba(255,255,255,.22);border-radius:13px;padding:12px 10px;' +
        'font:650 14px system-ui;color:#fff;background:rgba(255,255,255,.1)}' +
        '#sh-exit-confirm button[data-sh-exit="yes"]{background:linear-gradient(110deg,#2388ff,#7657f5);border-color:rgba(255,255,255,.3)}' +
        '#sh-exit-confirm button:disabled{opacity:.55}';
      document.body.appendChild(exitDialog);

      var exitPending = false;
      var exitAllowed = false;
      function showExitDialog() {
        if (exitPending || exitAllowed) return;
        exitDialog.hidden = false;
        var stay = exitDialog.querySelector('[data-sh-exit="stay"]');
        if (stay) stay.focus();
      }

      /* A history marker lets the Android back gesture reach this confirmation
         while keeping ordinary in-app link navigation intact. */
      try { history.pushState({ serviceHubExitGuard: true }, "", location.href); } catch (_) {}
      window.addEventListener("popstate", function () {
        if (exitAllowed) return;
        try { history.pushState({ serviceHubExitGuard: true }, "", location.href); } catch (_) {}
        showExitDialog();
      });

      exitDialog.addEventListener("click", function (event) {
        var button = event.target && event.target.closest ? event.target.closest("button[data-sh-exit]") : null;
        if (!button || exitPending) return;
        if (button.getAttribute("data-sh-exit") === "stay") {
          exitDialog.hidden = true;
          return;
        }
        exitPending = true;
        exitDialog.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
        show("thanks", 0);
        heading.textContent = "Thanks for visiting";
        message.textContent = "Your next great connection starts here. See you again soon.";
        window.setTimeout(function () {
          exitAllowed = true;
          /* Browsers may ignore window.close() for installed web apps. Going back
             after the animation lets Android close/leave the standalone window when supported. */
          try { window.close(); } catch (_) {}
          try { history.back(); } catch (_) {}
        }, reduce ? 2200 : 3500);
      });
    }

    /* Browsers may stop painting during tab/app shutdown, so pagehide is only a
       best-effort fallback. The installed-app confirmation above is the reliable path. */
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
