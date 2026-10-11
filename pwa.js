/* ServiceHub app support: registers the service worker and shows a small
 * "offline mode" notice at the bottom of any page while there is no internet. */
(function () {
  "use strict";

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
