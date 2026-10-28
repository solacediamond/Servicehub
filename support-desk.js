/* ServiceHub "Support & Feedback" button
 *
 * - Lives in the site's menu, never floating over the page:
 *     phones (portrait):  a round glass button in the empty space at the top-right of the
 *                         dropdown menu, next to "Explore" (nothing else moves)
 *     wide / landscape:   a pill button at the end of the menu bar links
 *   Pages without the site menu (e.g. provider.html) simply do not show it.
 * - Tap it: glass notification-style cards float over the site.
 *
 *     Feedback        -> "Talk to team" -> Suggestion | Complaint -> text box -> Google Sheet
 *     Contact support -> Private | Public
 *                          Private -> list of supporters (WhatsApp / Telegram) from the sheet
 *                          Public  -> opens the Telegram channel
 *
 * Talks to the same Apps Script web app the rest of the site uses
 * (window.SERVICEHUB_APPS_SCRIPT_URL). The matching Apps Script file is SupportDesk.gs.
 *
 * Things you may want to change are in the SETTINGS block just below.
 */
(function () {
  "use strict";
  if (window.__shSupportDesk || window.top !== window.self) return;
  window.__shSupportDesk = true;

  /* ------------------------------------------------------------------ *
   * SETTINGS
   * ------------------------------------------------------------------ */
  // Same Apps Script URL the site already uses for cards (used only if the page has not set it).
  var FALLBACK_URL = "https://script.google.com/macros/s/AKfycbz5A8etpNb1sL8aLLBZf5cuB2v-QZHioXAMRMFHUSaZchoxnca4dJ4sSaC57L23M4Fu/exec";
  var TELEGRAM_CHANNEL = "https://t.me/HubService_01";   // opened by Support > Public
  var MAX_CHARS = 1000;                                   // longest feedback message
  var MIN_CHARS = 3;

  /* ------------------------------------------------------------------ *
   * Icons (static markup only)
   * ------------------------------------------------------------------ */
  function stroke(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";
  }
  var IC = {
    chat: stroke('<path d="M21 11.5a8.4 8.4 0 0 1-12.2 7.5L3 21l2-5.6A8.4 8.4 0 1 1 21 11.5z"/>'),
    headset: stroke('<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>'),
    bulb: stroke('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>'),
    alert: stroke('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
    lock: stroke('<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    globe: stroke('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
    gear: stroke('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    next: stroke('<path d="m9 6 6 6-6 6"/>'),
    back: stroke('<path d="m15 6-6 6 6 6"/>'),
    close: stroke('<path d="M6 6l12 12M18 6 6 18"/>'),
    check: stroke('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Zm-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88ZM20.46 3.49A11.8 11.8 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.9 11.9 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.49-8.41Z"/></svg>',
    tg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.94 3.6a1.2 1.2 0 0 0-1.23-.2L2.5 10.42c-.8.31-.79 1.45.02 1.74l4.6 1.65 1.78 5.62c.22.7 1.1.9 1.62.38l2.5-2.45 4.56 3.35c.62.46 1.5.12 1.66-.63l3.2-15.2a1.2 1.2 0 0 0-.5-1.28ZM9.3 13.5l8.4-5.2-6.6 6.4-.3 3.3-1.5-4.5Z"/></svg>'
  };

  /* ------------------------------------------------------------------ *
   * Styles
   * ------------------------------------------------------------------ */
  var css = [
    /* ---- the menu button (shared look) ---- */
    ".shsd-btn{box-sizing:border-box;margin:0;padding:0;cursor:pointer;color:#fff;flex:none;display:flex;align-items:center;justify-content:center;",
    "font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,Arial,sans-serif;",
    "background:linear-gradient(150deg,rgba(255,255,255,.30),rgba(255,255,255,.05) 55%,rgba(255,255,255,.12)),rgba(35,136,255,.42);",
    "-webkit-backdrop-filter:blur(14px) saturate(190%);backdrop-filter:blur(14px) saturate(190%);",
    "border:1px solid rgba(255,255,255,.38);",
    "box-shadow:inset 0 1.5px 1px rgba(255,255,255,.6),inset 0 -2px 6px rgba(255,255,255,.1),0 8px 22px rgba(0,0,0,.35),0 0 0 3px rgba(35,136,255,.14);",
    "-webkit-tap-highlight-color:transparent;transition:transform .2s cubic-bezier(.34,1.56,.64,1),filter .2s ease}",
    ".shsd-btn:active{transform:scale(.94)}",
    ".shsd-btn:focus-visible{outline:3px solid rgba(255,255,255,.85);outline-offset:3px}",
    ".shsd-btn svg{flex:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}",
    ".shsd-btn span{display:block;font-weight:800;text-align:center;text-shadow:0 1px 3px rgba(0,0,0,.5);white-space:nowrap}",

    /* phones, portrait: round button in the free space at the top-right of the dropdown */
    "@media (orientation:portrait) and (max-width:767px){",
    ".shsd-btn{position:absolute;top:16px;right:5%;z-index:3;width:84px;height:84px;border-radius:50%;flex-direction:column;gap:4px}",
    ".shsd-btn svg{width:25px;height:25px}",
    ".shsd-btn span{font-size:10.5px;line-height:1.08;letter-spacing:.1px}}",

    /* wide screens and landscape: pill at the end of the menu bar links */
    "@media (orientation:landscape),(min-width:768px){",
    ".shsd-btn{position:static;height:40px;padding:0 16px 0 12px;margin-left:10px;border-radius:999px;flex-direction:row;gap:8px}",
    ".shsd-btn svg{width:19px;height:19px}",
    ".shsd-btn span{font-size:14px;line-height:1;letter-spacing:.1px}",
    ".shsd-br{display:none}}",
    "@media (orientation:landscape) and (max-width:920px),(orientation:landscape) and (max-height:500px){",
    ".shsd-btn{height:32px;padding:0 11px 0 9px;margin-left:4px;gap:6px}",
    ".shsd-btn svg{width:15px;height:15px}",
    ".shsd-btn span{font-size:12px}}",
    /* medium widths (small tablets / narrow windows): keep the bar from getting crowded */
    "@media (min-width:960px) and (max-width:1239px){.shsd-btn{width:32px;height:32px;padding:0;margin-left:-18px;border-radius:50%}",
    ".shsd-btn svg{width:17px;height:17px}",
    ".shsd-btn span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}",
    /* narrow tablets (768-959): the bar has no spare room, so the pill hangs from the bar's lower edge at the right instead of squeezing the links */
    "@media (min-width:768px) and (max-width:959px){.shsd-btn{position:absolute;top:calc(100% + 8px);right:5%;margin:0;height:34px;padding:0 12px 0 10px;gap:6px;z-index:2}",
    ".shsd-btn svg{width:16px;height:16px}.shsd-btn span{font-size:12.5px}}",
    "@media (hover:hover){.shsd-btn:hover{filter:brightness(1.14)}}",

    /* ---- Settings button: sits right under Support & Feedback ---- */
    ".nav-links a.shsd-set,.nav-links a.shsd-set:hover{color:#fff;text-decoration:none}",
    "@media (orientation:portrait) and (max-width:767px){.nav-links a.shsd-set{position:absolute;top:108px;right:calc(5% + 13px);width:58px;height:58px;min-height:0;padding:0;gap:2px;flex-direction:column;justify-content:center;align-items:center;font-size:inherit}",
    ".nav-links a.shsd-set svg{width:21px;height:21px}.nav-links a.shsd-set span{font-size:9.5px;letter-spacing:0}}",
    "@media (min-width:960px) and (max-width:1239px){.shsd-set{margin-left:6px}}",
    "@media (min-width:768px) and (max-width:959px){.shsd-set{top:calc(100% + 50px)}}",

    /* ---- overlay ---- */
    ".shsd-ov{position:fixed;inset:0;z-index:2147482400;opacity:0;visibility:hidden;",
    "background:radial-gradient(120% 70% at 50% 0%,rgba(30,52,110,.55),rgba(4,7,14,.84));",
    "-webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px);",
    "transition:opacity .25s ease,visibility 0s linear .25s;",
    "font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,Arial,sans-serif;color:#fff}",
    ".shsd-ov.shsd-on{opacity:1;visibility:visible;transition:opacity .25s ease}",
    ".shsd-scroll{position:absolute;inset:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;display:flex;",
    "padding:max(18px,env(safe-area-inset-top)) 14px max(22px,env(safe-area-inset-bottom))}",
    ".shsd-stack{margin:auto;width:100%;max-width:400px;display:flex;flex-direction:column;gap:8px}",

    /* entrance / exit, like notifications arriving */
    ".shsd-item{animation:shsd-in .45s cubic-bezier(.2,.9,.25,1.05) both}",
    "@keyframes shsd-in{from{opacity:0;transform:translateY(22px) scale(.965)}to{opacity:1;transform:none}}",
    ".shsd-stack.shsd-leaving>.shsd-item{animation:shsd-out .15s ease both!important;animation-delay:0s!important}",
    "@keyframes shsd-out{to{opacity:0;transform:translateY(-8px) scale(.985)}}",

    /* header */
    ".shsd-head{padding:0 4px 6px}",
    ".shsd-bar{display:flex;align-items:center;justify-content:space-between;min-height:38px;margin-bottom:10px}",
    ".shsd-brand{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.62)}",
    ".shsd-round{width:38px;height:38px;border-radius:50%;padding:0;border:1px solid rgba(255,255,255,.2);cursor:pointer;color:#fff;",
    "display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;",
    "background:linear-gradient(145deg,rgba(255,255,255,.22),rgba(255,255,255,.05)),rgba(60,66,90,.45);",
    "-webkit-backdrop-filter:blur(18px) saturate(180%);backdrop-filter:blur(18px) saturate(180%);",
    "box-shadow:inset 0 1px 1px rgba(255,255,255,.4),0 4px 14px rgba(0,0,0,.28)}",
    ".shsd-round svg{width:19px;height:19px}",
    ".shsd-round:active{transform:scale(.92)}",
    ".shsd-title{font-size:29px;line-height:1.15;font-weight:800;letter-spacing:-.3px;margin:0}",
    ".shsd-sub{font-size:14.5px;line-height:1.4;color:rgba(255,255,255,.66);margin:5px 0 0}",

    /* the glass notification card */
    ".shsd-card{position:relative;width:100%;display:flex;align-items:center;gap:13px;padding:14px 14px 14px 14px;",
    "border-radius:22px;text-align:left;font:inherit;color:inherit;text-decoration:none;cursor:pointer;border:1px solid rgba(255,255,255,.17);",
    "background:linear-gradient(145deg,rgba(255,255,255,.20),rgba(255,255,255,.04) 60%,rgba(255,255,255,.09)),rgba(52,58,82,.50);",
    "-webkit-backdrop-filter:blur(26px) saturate(190%);backdrop-filter:blur(26px) saturate(190%);",
    "box-shadow:inset 0 1px 1px rgba(255,255,255,.38),inset 0 -1px 4px rgba(255,255,255,.06),0 10px 30px rgba(0,0,0,.34),0 2px 6px rgba(0,0,0,.2);",
    "-webkit-tap-highlight-color:transparent;transition:transform .15s ease,filter .15s ease}",
    "@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.shsd-card,.shsd-round{background:rgba(38,44,66,.94)}}",
    "button.shsd-card:active,a.shsd-card:active{transform:scale(.985);filter:brightness(1.15)}",
    ".shsd-card:focus-visible,.shsd-chan:focus-visible,.shsd-send:focus-visible,.shsd-round:focus-visible{outline:2px solid rgba(255,255,255,.85);outline-offset:2px}",
    ".shsd-tile{flex:none;width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;",
    "box-shadow:inset 0 1px 1px rgba(255,255,255,.45),0 3px 8px rgba(0,0,0,.3)}",
    ".shsd-tile svg{width:23px;height:23px}",
    ".shsd-txt{flex:1;min-width:0}",
    ".shsd-txt b{display:block;font-size:16.5px;font-weight:650;line-height:1.25;letter-spacing:-.1px}",
    ".shsd-txt small{display:block;margin-top:2px;font-size:14px;line-height:1.35;color:rgba(255,255,255,.66)}",
    ".shsd-chev{flex:none;width:18px;height:18px;color:rgba(255,255,255,.42)}",

    /* text box card */
    ".shsd-form{display:block;cursor:default;padding:14px}",
    ".shsd-ta{display:block;width:100%;min-height:158px;resize:none;border-radius:15px;padding:13px 14px;font:inherit;font-size:16px;line-height:1.45;color:#fff;",
    "background:rgba(6,10,20,.38);border:1px solid rgba(255,255,255,.14);outline:none;box-shadow:inset 0 2px 8px rgba(0,0,0,.25)}",
    ".shsd-ta::placeholder{color:rgba(255,255,255,.42)}",
    ".shsd-ta:focus{border-color:rgba(80,160,255,.8);box-shadow:inset 0 2px 8px rgba(0,0,0,.25),0 0 0 3px rgba(35,136,255,.25)}",
    ".shsd-meta{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin:8px 4px 12px;font-size:12.5px;line-height:1.35;color:rgba(255,255,255,.5)}",
    ".shsd-meta>span:last-child{flex:none;white-space:nowrap;margin-left:auto}",
    ".shsd-err{flex:1;color:#ff9b9b;text-align:left}",
    ".shsd-send{width:100%;height:50px;border:0;border-radius:15px;cursor:pointer;color:#fff;font:inherit;font-size:16px;font-weight:700;",
    "background:linear-gradient(180deg,#3c9bff,#1f7ae8);box-shadow:inset 0 1px 1px rgba(255,255,255,.45),0 8px 20px rgba(35,136,255,.35);",
    "transition:opacity .2s ease,transform .15s ease;-webkit-tap-highlight-color:transparent}",
    ".shsd-send:active:not(:disabled){transform:scale(.985)}",
    ".shsd-send:disabled{opacity:.42;cursor:not-allowed;box-shadow:none}",
    ".shsd-spin{display:inline-block;width:15px;height:15px;margin-right:9px;vertical-align:-2px;border-radius:50%;",
    "border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:shsd-rot .7s linear infinite}",
    "@keyframes shsd-rot{to{transform:rotate(360deg)}}",

    /* success */
    ".shsd-done{display:block;text-align:center;cursor:default;padding:26px 18px 20px}",
    ".shsd-ok{width:62px;height:62px;border-radius:50%;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;color:#fff;",
    "background:linear-gradient(145deg,#34d27b,#16a35a);box-shadow:inset 0 1px 1px rgba(255,255,255,.5),0 8px 22px rgba(22,163,90,.4);animation:shsd-pop .5s cubic-bezier(.34,1.56,.64,1) both}",
    ".shsd-ok svg{width:30px;height:30px;stroke-width:2.6}",
    "@keyframes shsd-pop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}",
    ".shsd-done h3{margin:0 0 6px;font-size:20px;font-weight:750}",
    ".shsd-done p{margin:0;font-size:14.5px;line-height:1.45;color:rgba(255,255,255,.7)}",
    ".shsd-ref{margin-top:10px!important;font-size:12.5px!important;letter-spacing:.06em;color:rgba(255,255,255,.45)!important}",
    ".shsd-done .shsd-send{margin-top:18px}",

    /* supporters */
    ".shsd-person{display:block;cursor:default;padding:14px}",
    ".shsd-who{display:flex;align-items:center;gap:12px;margin-bottom:11px}",
    ".shsd-avatar{flex:none;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;",
    "background:linear-gradient(145deg,#a855f7,#6d28d9);box-shadow:inset 0 1px 1px rgba(255,255,255,.45),0 3px 8px rgba(0,0,0,.3)}",
    ".shsd-chan{display:flex;align-items:center;gap:11px;padding:10px 12px;margin-top:7px;border-radius:15px;text-decoration:none;color:#fff;",
    "background:rgba(6,10,20,.34);border:1px solid rgba(255,255,255,.12);-webkit-tap-highlight-color:transparent;transition:background .15s ease,transform .15s ease}",
    ".shsd-chan:first-of-type{margin-top:0}",
    ".shsd-chan:active{transform:scale(.985);background:rgba(255,255,255,.14)}",
    ".shsd-chan .shsd-ci{flex:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center}",
    ".shsd-chan .shsd-ci svg{width:18px;height:18px}",
    ".shsd-chan.wa .shsd-ci{background:#25d366}",
    ".shsd-chan.tg .shsd-ci{background:#2aa7e8}",
    ".shsd-chan .shsd-txt b{font-size:15px}",
    ".shsd-chan .shsd-txt small{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".shsd-skel{height:118px}",
    ".shsd-skel::after{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.12) 50%,transparent 70%);",
    "background-size:200% 100%;animation:shsd-shim 1.3s linear infinite}",
    "@keyframes shsd-shim{from{background-position:200% 0}to{background-position:-200% 0}}",
    ".shsd-retry{margin-top:12px}",

    /* wide screens */
    "@media (min-width:768px){.shsd-stack{max-width:460px}.shsd-title{font-size:33px}.shsd-sub{font-size:15.5px}",
    ".shsd-card{padding:17px 18px;gap:15px;border-radius:24px}.shsd-tile{width:50px;height:50px;border-radius:14px}.shsd-tile svg{width:25px;height:25px}",
    ".shsd-txt b{font-size:17.5px}.shsd-txt small{font-size:14.5px}.shsd-form,.shsd-person{padding:18px}.shsd-ta{min-height:180px}}",
    "@media (hover:hover){button.shsd-card:hover,a.shsd-card:hover{filter:brightness(1.14);transform:translateY(-2px)}",
    ".shsd-round:hover{filter:brightness(1.2)}.shsd-chan:hover{background:rgba(255,255,255,.13)}.shsd-send:hover:not(:disabled){filter:brightness(1.08)}}",
    /* short screens (landscape phones) */
    "@media (max-height:520px){.shsd-scroll{padding-top:10px;padding-bottom:12px}.shsd-bar{margin-bottom:2px}.shsd-title{font-size:22px}.shsd-sub{display:none}",
    ".shsd-card{padding:10px 12px}.shsd-ta{min-height:96px}.shsd-ok{width:46px;height:46px;margin-bottom:8px}}",
    "@media (prefers-reduced-motion:reduce){.shsd-item,.shsd-ok,.shsd-skel::after{animation:none!important}",
    ".shsd-ov{transition:none}}",
    "@media print{.shsd-btn,.shsd-ov{display:none!important}}"
  ].join("");

  var style = document.createElement("style");
  style.id = "shsd-style";
  style.textContent = css;
  document.head.appendChild(style);

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */
  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;   // textContent: nothing from the sheet is ever parsed as HTML
    return e;
  }
  function tile(iconHtml, bg) {
    var t = h("span", "shsd-tile");
    t.style.background = bg;
    t.innerHTML = iconHtml;
    return t;
  }
  function endpoint() {
    var u = String(window.SERVICEHUB_APPS_SCRIPT_URL || "").trim();
    return u || FALLBACK_URL;
  }

  // Same transport the site already uses for POSTs: JSON as text/plain (no CORS preflight).
  function post(payload, ms) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 25000);
    return fetch(endpoint(), {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  // 08012345678 -> 2348012345678 ; +234 801 234 5678 -> 2348012345678 ; anything else must already be international.
  function waNumber(v) {
    var d = String(v || "").replace(/[^\d]/g, "");
    if (!d) return "";
    if (d.indexOf("00") === 0) d = d.slice(2);
    else if (d.charAt(0) === "0" && d.length >= 10 && d.length <= 11) d = "234" + d.slice(1);
    return d.length >= 8 && d.length <= 15 ? d : "";
  }
  // @name, name, t.me/name, https://t.me/name, or a phone number
  function tgTarget(v) {
    v = String(v || "").trim();
    if (!v) return null;
    var m = v.match(/(?:t\.me|telegram\.me)\/(\+?\w+)/i);
    if (m) v = m[1];
    v = v.replace(/^@/, "");
    if (/^\+?\d{7,15}$/.test(v)) {
      var digits = v.replace(/^\+/, "");
      return { href: "https://t.me/+" + digits, label: "+" + digits };
    }
    if (/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(v)) return { href: "https://t.me/" + v, label: "@" + v };
    return null;
  }

  /* ------------------------------------------------------------------ *
   * The round button
   * ------------------------------------------------------------------ */
  var btn = h("button", "shsd-btn");
  btn.type = "button";
  btn.setAttribute("aria-haspopup", "dialog");
  btn.title = "Support & Feedback";
  btn.setAttribute("aria-label", "Support and feedback. Open help options");
  btn.innerHTML = IC.chat + '<span>Support &amp; <br class="shsd-br">Feedback</span>';

  /* Settings: a plain link to settings.html, styled like the Support button */
  var setBtn = h("a", "shsd-btn shsd-set");
  setBtn.href = "settings.html";
  setBtn.title = "Settings";
  setBtn.setAttribute("aria-label", "Settings");
  setBtn.innerHTML = IC.gear + "<span>Settings</span>";

  /* ------------------------------------------------------------------ *
   * Overlay (built the first time it is needed)
   * ------------------------------------------------------------------ */
  var ov = null, scroller = null, stack = null;
  var isOpen = false, leaving = false, viewId = 0, showSeq = 0, doneTimer = null, pending = null;
  var prevOverflow = "";

  function build() {
    ov = h("div", "shsd-ov");
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-label", "Support and feedback");
    ov.tabIndex = -1;
    scroller = h("div", "shsd-scroll");
    stack = h("div", "shsd-stack");
    scroller.appendChild(stack);
    ov.appendChild(scroller);
    document.body.appendChild(ov);
    // tap on the dimmed area closes
    scroller.addEventListener("click", function (e) {
      if (e.target === scroller) close();
    });
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
  }

  function open() {
    if (isOpen) return;
    if (!ov) build();
    isOpen = true;
    leaving = false;
    pending = null;
    stack.classList.remove("shsd-leaving");
    prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    // phone dropdown: fold it away so the overlay is the only thing on screen
    var panel = document.querySelector(".nav-panel.mobile-open"), mb = document.querySelector(".menu-btn");
    if (panel && mb) mb.click();
    document.addEventListener("keydown", onKey);
    goRoot(true);
    requestAnimationFrame(function () {
      ov.classList.add("shsd-on");
      try { ov.focus({ preventScroll: true }); } catch (e) {}
    });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    pending = null;
    viewId++;
    clearTimeout(doneTimer);
    ov.classList.remove("shsd-on");
    document.documentElement.style.overflow = prevOverflow;
    document.removeEventListener("keydown", onKey);
    try { btn.focus({ preventScroll: true }); } catch (e) {}
    // clear the cards once the fade finishes so the next open starts fresh
    setTimeout(function () { if (!isOpen && stack) stack.innerHTML = ""; }, 320);
  }

  // Swap what is on screen: old cards slide out, new cards float in one after another.
  function show(builder, instant) {
    if (leaving) { pending = { b: builder, i: instant }; return; }   // keep the latest request, play it right after
    var seq = ++showSeq;
    var run = function () {
      if (seq !== showSeq) return;
      stack.innerHTML = "";
      stack.classList.remove("shsd-leaving");
      leaving = false;
      var nodes = builder();
      nodes.forEach(function (node, i) {
        node.classList.add("shsd-item");
        node.style.animationDelay = (i * 55) + "ms";
        stack.appendChild(node);
      });
      scroller.scrollTop = 0;
      if (pending) { var p = pending; pending = null; show(p.b, p.i); }
    };
    if (!instant && stack.children.length) {
      leaving = true;
      stack.classList.add("shsd-leaving");
      setTimeout(run, 150);
    } else run();
  }

  function header(opts) {
    var wrap = h("div", "shsd-head");
    var bar = h("div", "shsd-bar");
    if (opts.back) {
      var b = h("button", "shsd-round");
      b.type = "button";
      b.setAttribute("aria-label", "Back");
      b.innerHTML = IC.back;
      b.addEventListener("click", opts.back);
      bar.appendChild(b);
    } else {
      bar.appendChild(h("span", "shsd-brand", "ServiceHub"));
    }
    var x = h("button", "shsd-round");
    x.type = "button";
    x.setAttribute("aria-label", "Close");
    x.innerHTML = IC.close;
    x.addEventListener("click", close);
    bar.appendChild(x);
    wrap.appendChild(bar);
    wrap.appendChild(h("h2", "shsd-title", opts.title));
    if (opts.sub) wrap.appendChild(h("p", "shsd-sub", opts.sub));
    return wrap;
  }

  // One notification-style card: coloured icon tile, title, subtitle, chevron.
  function card(o) {
    var el;
    if (o.href) {
      el = h("a", "shsd-card");
      el.href = o.href;
      el.target = "_blank";
      el.rel = "noopener noreferrer";
    } else {
      el = h("button", "shsd-card");
      el.type = "button";
    }
    el.appendChild(tile(o.icon, o.tint));
    var t = h("span", "shsd-txt");
    t.appendChild(h("b", "", o.title));
    t.appendChild(h("small", "", o.sub));
    el.appendChild(t);
    var chev = h("span", "shsd-chev");
    chev.innerHTML = IC.next;
    el.appendChild(chev);
    if (o.onClick) el.addEventListener("click", o.onClick);
    return el;
  }

  /* ------------------------------------------------------------------ *
   * Views
   * ------------------------------------------------------------------ */
  function goRoot(instant) {
    viewId++;
    show(function () {
      return [
        header({ title: "How can we help?", sub: "Pick an option below." }),
        card({ icon: IC.chat, tint: "linear-gradient(145deg,#4aa8ff,#1f6fe0)", title: "Feedback",
               sub: "Suggestions and complaints for our team", onClick: goFeedback }),
        card({ icon: IC.headset, tint: "linear-gradient(145deg,#b678ff,#7a35e0)", title: "Contact support",
               sub: "Chat with someone on our team", onClick: goSupport })
      ];
    }, instant);
  }

  function goFeedback() {
    viewId++;
    show(function () {
      return [
        header({ title: "Talk to team", sub: "We read every message.", back: function () { goRoot(); } }),
        card({ icon: IC.bulb, tint: "linear-gradient(145deg,#ffc84a,#f08a00)", title: "Suggestion",
               sub: "Have an idea? Tell us", onClick: function () { goCompose("suggestion"); } }),
        card({ icon: IC.alert, tint: "linear-gradient(145deg,#ff7a7a,#e0383e)", title: "Complaint",
               sub: "Something wrong? Let us know", onClick: function () { goCompose("complaint"); } })
      ];
    });
  }

  function goCompose(type) {
    var my = ++viewId;
    var isC = type === "complaint";
    var label = isC ? "Complaint" : "Suggestion";
    var ta = null;

    show(function () {
      var form = h("div", "shsd-card shsd-form");
      ta = h("textarea", "shsd-ta");
      ta.maxLength = MAX_CHARS;
      ta.rows = 6;
      ta.placeholder = isC ? "Tell us what went wrong…" : "Tell us your idea…";
      ta.setAttribute("aria-label", label + " message");

      var meta = h("div", "shsd-meta");
      var err = h("span", "shsd-err");
      err.setAttribute("role", "alert");
      var count = h("span", "", "0 / " + MAX_CHARS);
      meta.appendChild(err);
      meta.appendChild(count);

      var send = h("button", "shsd-send", "Send " + label.toLowerCase());
      send.type = "button";
      send.disabled = true;

      function sync() {
        var len = ta.value.trim().length;
        count.textContent = ta.value.length + " / " + MAX_CHARS;
        send.disabled = len < MIN_CHARS;
        err.textContent = "";
      }
      ta.addEventListener("input", sync);

      send.addEventListener("click", function () {
        var message = ta.value.trim();
        if (message.length < MIN_CHARS) return;
        send.disabled = true;
        ta.disabled = true;
        err.textContent = "";
        send.innerHTML = '<span class="shsd-spin"></span>Sending…';

        post({
          action: "submitFeedback",
          type: type,
          message: message,
          pageUrl: location.href
        }).then(function (res) {
          if (!res || res.success !== true) throw new Error((res && res.error) || "Could not send");
          if (my === viewId && isOpen) showSent(label, res.feedbackId);
        }).catch(function () {
          if (my !== viewId || !isOpen) return;
          ta.disabled = false;
          send.disabled = false;
          send.textContent = "Try again";
          err.textContent = "Couldn’t send. Check your connection and try again.";
        });
      });

      form.appendChild(ta);
      form.appendChild(meta);
      form.appendChild(send);

      return [
        header({
          title: label,
          sub: isC ? "Tell us what went wrong. We’ll look into it." : "Got an idea? We’d love to hear it.",
          back: goFeedback
        }),
        form
      ];
    });

    setTimeout(function () {
      if (my === viewId && isOpen && ta) { try { ta.focus({ preventScroll: true }); } catch (e) {} }
    }, 520);
  }

  function showSent(label, id) {
    var my = ++viewId;
    show(function () {
      var box = h("div", "shsd-card shsd-done");
      var ok = h("div", "shsd-ok");
      ok.innerHTML = IC.check;
      box.appendChild(ok);
      box.appendChild(h("h3", "", "Sent to the team"));
      box.appendChild(h("p", "", "Thank you. Your " + label.toLowerCase() + " has been received."));
      if (id) box.appendChild(h("p", "shsd-ref", "REF " + id));
      var done = h("button", "shsd-send", "Done");
      done.type = "button";
      done.addEventListener("click", close);
      box.appendChild(done);
      return [box];
    });
    clearTimeout(doneTimer);
    doneTimer = setTimeout(function () { if (my === viewId && isOpen) close(); }, 4000);
  }

  function goSupport() {
    viewId++;
    show(function () {
      return [
        header({ title: "Contact support", sub: "How would you like to reach us?", back: function () { goRoot(); } }),
        card({ icon: IC.lock, tint: "linear-gradient(145deg,#b678ff,#7a35e0)", title: "Private",
               sub: "Message one of our supporters directly", onClick: goPrivate }),
        card({ icon: IC.globe, tint: "linear-gradient(145deg,#4cc3ff,#1e8fd8)", title: "Public",
               sub: "Join our Telegram channel", href: TELEGRAM_CHANNEL })
      ];
    });
  }

  // Pre-typed first message, so the supporter knows straight away who is writing and why.
  // The person only has to add their problem after "I need help with:" and press send.
  function supportText(c) {
    var page = (document.title || "").replace(/\s*[|\u2014\u2013-]\s*ServiceHub.*$/i, "").trim();
    if (/^servicehub$/i.test(page)) page = "";   // the home page title is just the site name
    var name = (c && c.name ? String(c.name).trim() : "");
    return "[ServiceHub Support] Hi" + (name ? " " + name : "") + ", I'm contacting you from the ServiceHub website (Private support)" +
      (page ? ", from the \"" + page + "\" page" : "") + ". I need help with: ";
  }

  var contactsCache = null, contactsAt = 0;
  var CONTACTS_TTL = 5 * 60 * 1000;   // reuse the loaded list for 5 minutes

  function goPrivate() {
    var my = ++viewId;
    var back = goSupport;
    var head = function () {
      return header({ title: "Private support", sub: "Pick a supporter and the app you prefer.", back: back });
    };

    function skeleton() {
      var a = h("div", "shsd-card shsd-skel"), b = h("div", "shsd-card shsd-skel");
      a.setAttribute("aria-hidden", "true"); b.setAttribute("aria-hidden", "true");
      return [head(), a, b];
    }

    function list(contacts) {
      var out = [head()];
      contacts.forEach(function (c) {
        var wa = waNumber(c.whatsapp);
        var tg = tgTarget(c.telegram);
        if (!wa && !tg) return;
        var el = h("div", "shsd-card shsd-person");

        var who = h("div", "shsd-who");
        who.appendChild(h("span", "shsd-avatar", (c.name || "S").trim().charAt(0).toUpperCase()));
        var t = h("span", "shsd-txt");
        t.appendChild(h("b", "", c.name || "Support"));
        t.appendChild(h("small", "", wa && tg ? "WhatsApp or Telegram" : (wa ? "WhatsApp" : "Telegram")));
        who.appendChild(t);
        el.appendChild(who);

        var msg = supportText(c);
        function chan(cls, icon, name, value, href, copyText) {
          var a = h("a", "shsd-chan " + cls);
          a.href = href;
          if (copyText) {   // Telegram may ignore the pre-typed text, so also copy it: the person can just paste it
            a.addEventListener("click", function () {
              try { navigator.clipboard.writeText(copyText).catch(function () {}); } catch (e) {}
            });
          }
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          var ci = h("span", "shsd-ci");
          ci.innerHTML = icon;
          a.appendChild(ci);
          var tx = h("span", "shsd-txt");
          tx.appendChild(h("b", "", name));
          tx.appendChild(h("small", "", value));
          a.appendChild(tx);
          var chev = h("span", "shsd-chev");
          chev.innerHTML = IC.next;
          a.appendChild(chev);
          el.appendChild(a);
        }
        if (wa) chan("wa", IC.wa, "WhatsApp", "+" + wa, "https://wa.me/" + wa + "?text=" + encodeURIComponent(msg));
        if (tg) chan("tg", IC.tg, "Telegram", tg.label, tg.href.indexOf("/+") > -1 ? tg.href : tg.href + "?text=" + encodeURIComponent(msg), msg);
        out.push(el);
      });

      if (out.length === 1) return message("No supporters available right now", "Please try the public channel instead.", "Open public channel", function () { goSupport(); });
      return out;
    }

    function message(title, text, actionLabel, action) {
      var box = h("div", "shsd-card shsd-done");
      box.appendChild(h("h3", "", title));
      box.appendChild(h("p", "", text));
      var b = h("button", "shsd-send shsd-retry", actionLabel);
      b.type = "button";
      b.addEventListener("click", action);
      box.appendChild(b);
      return [head(), box];
    }

    function load() {
      show(skeleton);
      post({ action: "getSupportContacts" }, 20000).then(function (res) {
        if (!res || res.success !== true || !Array.isArray(res.contacts)) throw new Error("bad response");
        contactsCache = res.contacts;
        contactsAt = Date.now();
        if (my === viewId && isOpen) show(function () { return list(contactsCache); });
      }).catch(function () {
        if (my === viewId && isOpen) {
          show(function () {
            return message("Couldn’t load supporters", "Check your connection and try again.", "Try again", function () { goPrivate(); });
          });
        }
      });
    }

    if (contactsCache && Date.now() - contactsAt < CONTACTS_TTL) show(function () { return list(contactsCache); });
    else load();
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  btn.addEventListener("click", open);

  // Goes inside the site's menu (".nav-links"), so it appears in the dropdown on phones and
  // in the menu bar on wide screens. No menu on the page -> nothing is added.
  function boot() {
    var links = document.querySelector(".nav-panel .nav-links");
    if (links && !btn.parentNode) links.appendChild(btn);
    if (links && !setBtn.parentNode) links.appendChild(setBtn);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
