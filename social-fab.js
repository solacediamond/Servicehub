/* ServiceHub floating contact button ("social FAB")
 *
 * - Glass-style floating button, bottom-right by default, never rests in the middle
 *   (after dragging it always glides to the nearest left or right edge).
 * - The centre icon cycles through every contact below every 3 seconds.
 * - A small "Our socials / contacts" tab slides out on first load, then tucks back
 *   behind the button.
 * - Tap the button: the contact icons pop out on an arc. Tap an icon to open it.
 *   If there are more icons than fit the screen (max 7 at once) the arc becomes a
 *   wheel: drag along it (or use the mouse wheel) to turn it and reveal the rest.
 *
 * To add / remove / reorder a contact, edit the CONTACTS list below.
 */
(function () {
  "use strict";
  if (window.__shSocialFab || window.top !== window.self) return;
  window.__shSocialFab = true;

  /* ------------------------------------------------------------------ *
   * CONTACTS: edit here
   * ------------------------------------------------------------------ */
  var PHONE_INTL = "2348073410722";          // WhatsApp / call number, digits only
  var TEASER_TEXT = "Our socials / contacts";
  // WhatsApp's "wa.me/message/..." business links ignore pre-typed text. If you put the
  // sponsor's WhatsApp number here (digits only, e.g. "23480xxxxxxx") the pre-typed text
  // will arrive inside the chat. Until then the text is copied to the clipboard instead.
  var SPONSOR_PHONE = "2349072964285";

  // Pre-typed message so you can tell the chat came from the website.
  function pretyped() {
    var page = (document.title || "").replace(/\s*[|—–-]\s*ServiceHub.*$/i, "").trim();
    return "[ServiceHub Website] Hi! I tapped the contact button on your website" +
      (page ? " (page: " + page + ")" : "") + " and I'd like some help.";
  }

  var CONTACTS = [
    { id: "x", label: "X (Twitter)", color: "#ffffff",
      href: function () { return "https://x.com/ServiceHub_01"; } },
    { id: "whatsapp", label: "WhatsApp", color: "#25d366",
      href: function () { return "https://wa.me/" + PHONE_INTL + "?text=" + encodeURIComponent(pretyped()); } },
    { id: "telegram", label: "Telegram", color: "#38b6ff",
      href: function () { return "https://t.me/HubService_01?text=" + encodeURIComponent(pretyped()); } },
    { id: "facebook", label: "Facebook", color: "#4c8dff",
      href: function () { return "https://www.facebook.com/share/1QmF1DCzEB/"; } },
    { id: "instagram", label: "Instagram", color: "url(#shfab-ig)", plain: "#ff5fa2",
      href: function () { return "https://instagram.com/servicehub.01?mdxt=cWc2Z29oNm5maWdw"; } },
    { id: "phone", label: "Call us", color: "#ff9f0a", sameTab: true,
      href: function () { return "tel:+" + PHONE_INTL; } },
    // Sponsor: always keep this LAST. Shows the logo image (also joins the centre-icon cycle).
    { id: "sponsor", label: "Sponsor: Solaceproeditz", img: "/solaceproeditz-logo.png", copy: true,
      href: function () {
        return SPONSOR_PHONE
          ? "https://wa.me/" + SPONSOR_PHONE + "?text=" + encodeURIComponent(pretyped())
          : "https://wa.me/message/VCBCH6LJK2VYN1";
      } }
  ];

  var ICONS = {
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41Z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Zm-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88ZM20.46 3.49A11.8 11.8 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.9 11.9 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.49-8.41Z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.94 3.6a1.2 1.2 0 0 0-1.23-.2L2.5 10.42c-.8.31-.79 1.45.02 1.74l4.6 1.65 1.78 5.62c.22.7 1.1.9 1.62.38l2.5-2.45 4.56 3.35c.62.46 1.5.12 1.66-.63l3.2-15.2a1.2 1.2 0 0 0-.5-1.28ZM9.3 13.5l8.4-5.2-6.6 6.4-.3 3.3-1.5-4.5Z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 22v-8.2h2.8l.5-3.3h-3.3V8.4c0-.95.4-1.7 1.8-1.7h1.6V3.8s-1.3-.2-2.5-.2c-2.6 0-4.2 1.55-4.2 4.3v2.6H7.4v3.3h2.8V22h3.3Z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5.2" fill="none" stroke="currentColor" stroke-width="2.1"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="2.1"/><circle cx="17.4" cy="6.6" r="1.35" fill="currentColor"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C9.61 21 3 14.39 3 6c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2Z"/></svg>'
  };

  // Instagram uses a gradient fill instead of a flat colour.
  function iconFor(c) {
    var svg = ICONS[c.id] || "";
    return c.id === "instagram" ? svg.replace(/currentColor/g, "url(#shfab-ig)") : svg;
  }

  /* ------------------------------------------------------------------ *
   * Constants
   * ------------------------------------------------------------------ */
  var MAX_VISIBLE = 7;        // never show more than this many icons at once
  var CYCLE_MS = 3000;        // centre icon change interval
  var EDGE_X = 14;            // resting distance from the left / right edge
  var BOTTOM_DEFAULT = 88;    // default distance from the bottom (not the extreme corner)
  var EDGE_Y = 10;            // minimum distance from top / bottom
  var STORE_KEY = "shFabPos1";
  var SEEN_KEY = "shFabTeased1";

  var n = CONTACTS.length;
  if (!n) return;

  /* ------------------------------------------------------------------ *
   * Styles
   * ------------------------------------------------------------------ */
  var css = [
    "#shfab,#shfab *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}",
    "#shfab{position:fixed;left:0;top:0;width:var(--b);height:var(--b);z-index:2147482000;",
    "font-family:Arial,Helvetica,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;",
    "-webkit-touch-callout:none;-webkit-user-drag:none;will-change:transform}",
    "#shfab.snap{transition:transform .55s cubic-bezier(.2,1.3,.35,1)}",

    /* the glass look */
    "#shfab .glass{background:linear-gradient(145deg,rgba(255,255,255,.34),rgba(255,255,255,.07) 55%,rgba(255,255,255,.16)),rgba(22,28,46,.30);",
    "-webkit-backdrop-filter:blur(14px) saturate(190%);backdrop-filter:blur(14px) saturate(190%);",
    "border:1px solid rgba(255,255,255,.38);",
    "box-shadow:inset 0 1.5px 1px rgba(255,255,255,.65),inset 0 -2px 6px rgba(255,255,255,.12),inset 0 0 14px rgba(255,255,255,.08),0 10px 28px rgba(0,0,0,.32),0 2px 6px rgba(0,0,0,.2)}",
    "@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){#shfab .glass{background:rgba(40,48,72,.82)}}",
    "#shfab .glass::before{content:'';position:absolute;left:12%;right:12%;top:5%;height:42%;border-radius:50%;",
    "background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0));opacity:.7;pointer-events:none}",

    /* main button */
    "#shfab .main{position:absolute;inset:0;border-radius:50%;padding:0;margin:0;cursor:grab;outline:none;",
    "color:#fff;z-index:3;transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .25s}",
    "#shfab .main:focus-visible{box-shadow:0 0 0 3px rgba(255,255,255,.85),0 10px 28px rgba(0,0,0,.32)}",
    "#shfab.lift .main,#shfab.dragging .main{transform:scale(1.14);cursor:grabbing;",
    "box-shadow:inset 0 1.5px 1px rgba(255,255,255,.7),0 18px 38px rgba(0,0,0,.42)}",
    "#shfab.open .main{transform:scale(.94)}",
    "#shfab .bob{position:absolute;inset:0;border-radius:50%;animation:shfab-bob 4.2s ease-in-out infinite}",
    "#shfab.open .bob,#shfab.dragging .bob{animation-play-state:paused}",
    "@keyframes shfab-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}",
    "#shfab .face{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;",
    "opacity:0;transform:scale(.45) rotate(-70deg);transition:opacity .35s ease,transform .5s cubic-bezier(.34,1.56,.64,1);pointer-events:none}",
    "#shfab .face.on{opacity:1;transform:none}",
    "#shfab .face.off{opacity:0;transform:scale(.45) rotate(70deg)}",
    "#shfab .face svg{width:46%;height:46%;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}",
    "#shfab .face img{width:64%;height:64%;border-radius:50%;object-fit:cover;display:block;pointer-events:none;-webkit-user-drag:none;",
    "box-shadow:0 0 0 1.5px rgba(255,255,255,.55),0 2px 6px rgba(0,0,0,.35)}",
    "#shfab.open .face.on{opacity:0;transform:scale(.45) rotate(70deg)}",
    "#shfab.open .face.chatface{opacity:1;transform:none;color:#fff}",

    /* ring of contact icons */
    "#shfab .ring{position:absolute;inset:0;z-index:2;pointer-events:none}",
    "#shfab .item{position:absolute;left:calc((var(--b) - var(--s))/2);top:calc((var(--b) - var(--s))/2);",
    "width:var(--s);height:var(--s);border-radius:50%;display:flex;align-items:center;justify-content:center;",
    "text-decoration:none;opacity:0;pointer-events:none;transform:translate(0,0) scale(.3);outline:none;",
    "transition:transform .5s cubic-bezier(.34,1.56,.64,1),opacity .28s ease}",
    "#shfab.open .item{transform:translate(var(--tx),var(--ty)) scale(var(--sc));opacity:var(--op)}",
    "#shfab.rot .item{transition:none!important}",
    "#shfab .item svg{width:48%;height:48%;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}",
    "#shfab .item.sponsor{padding:3px}",
    "#shfab .item img{position:relative;width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;",
    "pointer-events:none;-webkit-user-drag:none;user-select:none}",
    "#shfab .item:focus-visible{box-shadow:0 0 0 3px rgba(255,255,255,.85)}",
    "#shfab .item:active{filter:brightness(1.2)}",

    /* intro tab that slides out from behind the button */
    "#shfab .tz{position:absolute;top:50%;transform:translateY(-50%);overflow:hidden;padding:16px 0;pointer-events:none;z-index:1;",
    "--dir:1}",
    "#shfab.side-right .tz{right:calc(var(--b)/2);padding-left:calc(var(--b)/2 + 18px)}",
    "#shfab.side-left .tz{left:calc(var(--b)/2);padding-right:calc(var(--b)/2 + 18px);--dir:-1}",
    "#shfab .tz span{display:block;white-space:nowrap;padding:0 18px;height:calc(var(--b)*.72);line-height:calc(var(--b)*.72);",
    "border-radius:999px;font-weight:700;font-size:calc(var(--s)*.29);letter-spacing:.2px;color:#fff;position:relative;",
    "text-shadow:0 1px 3px rgba(0,0,0,.45);",
    "transform:translateX(calc(var(--dir)*110%));transition:transform .75s cubic-bezier(.22,1.1,.36,1)}",
    "#shfab .tz.in span{transform:translateX(calc(var(--dir)*(var(--b)/2 + 8px)*-1))}",
    "#shfab .tz.out span{transition:transform .6s cubic-bezier(.5,0,.75,0)}",

    ".shfab-toast{position:fixed;left:50%;bottom:calc(28px + env(safe-area-inset-bottom,0px));z-index:2147482500;",
    "transform:translate(-50%,24px);opacity:0;pointer-events:none;padding:11px 18px;border-radius:999px;color:#fff;",
    "font:600 13px/1.3 Arial,Helvetica,sans-serif;text-shadow:0 1px 3px rgba(0,0,0,.45);max-width:88vw;text-align:center;",
    "transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .3s ease}",
    ".shfab-toast.show{transform:translate(-50%,0);opacity:1}",
    ".shfab-toast.glass{position:fixed;background:linear-gradient(145deg,rgba(255,255,255,.3),rgba(255,255,255,.08)),rgba(22,28,46,.55);",
    "-webkit-backdrop-filter:blur(14px) saturate(190%);backdrop-filter:blur(14px) saturate(190%);border:1px solid rgba(255,255,255,.35);",
    "box-shadow:inset 0 1px 1px rgba(255,255,255,.6),0 10px 28px rgba(0,0,0,.35)}",
    "@media (prefers-reduced-motion:reduce){#shfab .bob{animation:none}",
    "#shfab .item,#shfab .face,#shfab.snap{transition-duration:.01s}}",
    "@media print{#shfab{display:none!important}}"
  ].join("");

  var style = document.createElement("style");
  style.id = "shfab-style";
  style.textContent = css;
  document.head.appendChild(style);

  /* ------------------------------------------------------------------ *
   * DOM
   * ------------------------------------------------------------------ */
  var root = document.createElement("div");
  root.id = "shfab";
  root.className = "side-right";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Contact us");

  var defs = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<linearGradient id="shfab-ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ffd25a"/>' +
    '<stop offset=".35" stop-color="#ff5f6d"/><stop offset=".7" stop-color="#d63fb8"/><stop offset="1" stop-color="#7a5cff"/></linearGradient></defs></svg>';

  var tz = document.createElement("div");
  tz.className = "tz";
  tz.innerHTML = '<span class="glass"></span>';
  tz.firstChild.textContent = TEASER_TEXT;

  var ring = document.createElement("div");
  ring.className = "ring";

  var items = CONTACTS.map(function (c, i) {
    var a = document.createElement("a");
    a.className = "item glass";
    a.setAttribute("aria-label", c.label);
    a.title = c.label;
    a.tabIndex = -1;
    a.draggable = false;
    a.rel = "noopener noreferrer";
    if (!c.sameTab) a.target = "_blank";
    if (c.img) {
      a.classList.add("sponsor");
      a.innerHTML = '<img alt="" draggable="false" src="' + c.img + '">';
    } else {
      a.innerHTML = iconFor(c);
      var svg = a.firstChild;
      if (svg && svg.style) svg.style.color = c.color;
    }
    a.addEventListener("click", function (e) {
      if (suppressClick) { e.preventDefault(); return; }
      if (c.copy && !SPONSOR_PHONE) copyMessage();
      a.href = c.href();           // build link at click time (page name in the message)
    });
    a.href = c.href();
    ring.appendChild(a);
    return a;
  });

  var main = document.createElement("div");
  main.className = "main glass";
  main.setAttribute("role", "button");
  main.setAttribute("tabindex", "0");
  main.setAttribute("aria-haspopup", "true");
  main.setAttribute("aria-expanded", "false");
  main.setAttribute("aria-label", "Contact us. Tap to open, hold and drag to move");
  var bob = document.createElement("div");
  bob.className = "bob";
  var faces = CONTACTS.map(function (c) {
    var f = document.createElement("span");
    f.className = "face";
    if (c.img) f.innerHTML = '<img alt="" draggable="false" src="' + c.img + '">';
    else {
      f.innerHTML = iconFor(c);
      if (f.firstChild && f.firstChild.style) f.firstChild.style.color = c.color;
    }
    bob.appendChild(f);
    return f;
  });
  // Shown in the centre while the menu is open (a chat bubble).
  var chatFace = document.createElement("span");
  chatFace.className = "face chatface";
  chatFace.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M5 4h14a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 19 17h-8.2L6 21v-4H5A2.5 2.5 0 0 1 2.5 14.500v-8A2.5 2.5 0 0 1 5 4Z"/><circle cx="8.200" cy="10.500" r="1.300" fill="currentColor"/><circle cx="12" cy="10.500" r="1.300" fill="currentColor"/><circle cx="15.800" cy="10.500" r="1.300" fill="currentColor"/></svg>';
  bob.appendChild(chatFace);
  main.appendChild(bob);

  root.insertAdjacentHTML("beforeend", defs);
  root.appendChild(tz);
  root.appendChild(ring);
  root.appendChild(main);

  /* ------------------------------------------------------------------ *
   * Sizing (follows the browser's text-size setting) and safe areas
   * ------------------------------------------------------------------ */
  var B = 58, S = 48, safeTop = 0, safeBottom = 0;

  var probe = document.createElement("div");
  probe.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
    "padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";

  function vw() { return document.documentElement.clientWidth || window.innerWidth; }
  function vh() { return window.innerHeight; }

  function measure() {
    var fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var k = Math.min(1.7, Math.max(0.9, fs / 16));
    B = Math.round(58 * k);
    S = Math.round(48 * k);
    root.style.setProperty("--b", B + "px");
    root.style.setProperty("--s", S + "px");
    var cs = getComputedStyle(probe);
    safeTop = parseFloat(cs.paddingTop) || 0;
    safeBottom = parseFloat(cs.paddingBottom) || 0;
  }

  /* ------------------------------------------------------------------ *
   * Position, drag, snap-to-side
   * ------------------------------------------------------------------ */
  var side = "right";
  var cyFrac = null;          // vertical centre as a fraction of the viewport height
  var posX = 0, posY = 0;

  function loadPos() {
    try {
      var o = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (o && (o.side === "left" || o.side === "right") && typeof o.y === "number" && o.y > 0 && o.y < 1) {
        side = o.side; cyFrac = o.y;
      }
    } catch (e) {}
  }
  function savePos() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ side: side, y: cyFrac })); } catch (e) {}
  }

  function minY() { return Math.max(EDGE_Y, safeTop + EDGE_Y); }
  function maxY() { return vh() - B - Math.max(EDGE_Y, safeBottom + EDGE_Y); }
  function clampY(y) { return Math.min(Math.max(y, minY()), Math.max(minY(), maxY())); }
  function homeX() { return side === "left" ? EDGE_X : vw() - EDGE_X - B; }

  function applySide() {
    root.classList.toggle("side-left", side === "left");
    root.classList.toggle("side-right", side === "right");
  }
  function place(x, y, animate) {
    posX = x; posY = y;
    root.classList.toggle("snap", !!animate);
    root.style.transform = "translate3d(" + x + "px," + y + "px,0)";
  }
  function home(animate) {
    var y;
    if (cyFrac === null) y = vh() - BOTTOM_DEFAULT - Math.max(0, safeBottom) - B;
    else y = cyFrac * vh() - B / 2;
    y = clampY(y);
    cyFrac = (y + B / 2) / vh();
    applySide();
    place(homeX(), y, animate);
  }

  /* ------------------------------------------------------------------ *
   * Arc layout
   * ------------------------------------------------------------------ */
  var isOpen = false;
  var arc = null;             // { R, step, start, k, wheel }
  var offset = 0;             // wheel rotation, in "items"

  function mod(a, m) { return ((a % m) + m) % m; }

  function computeArc() {
    // The arc always has the same size (radius and spacing), wherever the button sits.
    // If fewer icons fit in the free space than you have, the arc turns like a wheel.
    var cx = posX + B / 2, cy = posY + B / 2;
    var dir = side === "right" ? 180 : 0;
    var W = vw(), H = vh(), half = S / 2, pad = 8;
    var R = 2.2 * S;
    var step = 2 * Math.asin(Math.min(1, (S * 1.14) / (2 * R))) * 180 / Math.PI;
    var LIM = 135;
    function ok(rel) {
      var a = (dir + rel) * Math.PI / 180;
      var x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      return x - half >= pad && x + half <= W - pad &&
             y - half >= pad + safeTop && y + half <= H - pad - safeBottom;
    }
    var lo = 0, hi = 0;
    if (ok(0)) {
      while (lo > -LIM && ok(lo - 1)) lo--;
      while (hi < LIM && ok(hi + 1)) hi++;
    } else { lo = -step; hi = step; }
    var cap = Math.max(1, Math.min(MAX_VISIBLE, Math.floor((hi - lo) / step + 1e-6) + 1));
    var k = Math.min(n, cap);
    var mid = (lo + hi) / 2;
    return {
      R: R, step: step, k: k, wheel: n > k,
      start: dir + mid - ((k - 1) / 2) * step
    };
  }

  function layout() {
    if (!arc) return;
    var k = arc.k;
    for (var i = 0; i < n; i++) {
      var tt;
      if (arc.wheel) {
        var t = mod(i - offset, n);
        tt = t > (k - 1) + (n - k + 1) / 2 ? t - n : t;
      } else tt = i;
      var out = tt < 0 ? -tt : (tt > k - 1 ? tt - (k - 1) : 0);
      var vis = Math.max(0, Math.min(1, 1 - out / 0.9));
      var ang = (arc.start + tt * arc.step) * Math.PI / 180;
      var el = items[i];
      el.style.setProperty("--tx", (arc.R * Math.cos(ang)).toFixed(1) + "px");
      el.style.setProperty("--ty", (arc.R * Math.sin(ang)).toFixed(1) + "px");
      el.style.setProperty("--sc", (0.4 + 0.6 * vis).toFixed(3));
      el.style.setProperty("--op", vis.toFixed(3));
      var live = isOpen && vis > 0.6;
      el.style.pointerEvents = live ? "auto" : "none";
      el.tabIndex = live ? 0 : -1;
      el.style.zIndex = Math.round(vis * 10);
    }
  }

  /* ------------------------------------------------------------------ *
   * Copy the pre-typed message (used when a link cannot carry it by itself)
   * ------------------------------------------------------------------ */
  var toastEl = null, toastTimer = null;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "shfab-toast glass";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(function () { toastEl.classList.add("show"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 4200);
  }
  function copyMessage() {
    var text = pretyped();
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e) {}
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(fallback);
      else fallback();
    } catch (e) { fallback(); }
    showToast("Message copied \u2014 paste it in the chat");
  }

  /* ------------------------------------------------------------------ *
   * Sound: short two-part "click-clack", like a pen being pulled out / pushed
   * back in. Generated with the Web Audio API, so there is no audio file.
   * ------------------------------------------------------------------ */
  var actx = null, noiseBuf = null;
  function ensureAudio() {
    try {
      if (!actx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        actx = new AC();
      }
      if (actx.state === "suspended") actx.resume();
      return actx;
    } catch (e) { return null; }
  }
  function tick(ctx, t, freq, vol, dur) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 3.2;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + dur + 0.02);
    // a tiny plastic "body" under the click
    var o = ctx.createOscillator(), og = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq / 2.4, t);
    o.frequency.exponentialRampToValueAtTime(freq / 4, t + dur);
    og.gain.setValueAtTime(vol * 0.55, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(og); og.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function playClick(opening) {
    var ctx = ensureAudio();
    if (!ctx) return;
    var t = ctx.currentTime + 0.005;
    if (opening) { tick(ctx, t, 2300, 0.5, 0.035); tick(ctx, t + 0.055, 3200, 0.38, 0.03); }   // pen out: click, higher clack
    else         { tick(ctx, t, 3000, 0.4, 0.03);  tick(ctx, t + 0.05, 1800, 0.55, 0.045); }   // pen in: click, lower clack
  }

  /* ------------------------------------------------------------------ *
   * Open / close
   * ------------------------------------------------------------------ */
  var readyTimer = null;

  function open(silent) {
    if (isOpen) return;
    if (silent !== true) playClick(true);
    hideTeaser(true);
    arc = computeArc();
    offset = 0;
    isOpen = true;
    root.classList.remove("rot");
    items.forEach(function (el, i) { el.style.transitionDelay = (i * 34) + "ms"; });
    layout();
    // Two frames so the pop-out transition runs from the closed state.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { root.classList.add("open"); });
    });
    main.setAttribute("aria-expanded", "true");
    clearTimeout(readyTimer);
    readyTimer = setTimeout(function () {
      items.forEach(function (el) { el.style.transitionDelay = "0ms"; });
    }, n * 34 + 520);
  }

  function close(silent) {
    if (!isOpen) return;
    if (silent !== true) playClick(false);
    isOpen = false;
    clearTimeout(readyTimer);
    items.forEach(function (el, i) { el.style.transitionDelay = ((n - 1 - i) * 22) + "ms"; });
    root.classList.remove("open");
    root.classList.remove("rot");
    main.setAttribute("aria-expanded", "false");
    items.forEach(function (el) { el.style.pointerEvents = "none"; el.tabIndex = -1; });
  }

  /* ------------------------------------------------------------------ *
   * Main button: tap = toggle, hold + drag = move
   * ------------------------------------------------------------------ */
  var dragging = false, held = false, holdTimer = null, suppressClick = false;
  var sx = 0, sy = 0, ox = 0, oy = 0, activeId = null;

  main.addEventListener("pointerdown", function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    ensureAudio();
    activeId = e.pointerId;
    try { main.setPointerCapture(e.pointerId); } catch (_) {}
    sx = e.clientX; sy = e.clientY; ox = posX; oy = posY;
    dragging = false; held = false;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () {
      held = true;
      root.classList.add("lift");
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) {} }
    }, 320);
  });

  main.addEventListener("pointermove", function (e) {
    if (e.pointerId !== activeId) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    if (!dragging && Math.hypot(dx, dy) > 7) {
      dragging = true;
      clearTimeout(holdTimer);
      close(true);
      hideTeaser(true);
      root.classList.remove("lift");
      root.classList.add("dragging");
      root.classList.remove("snap");
    }
    if (dragging) {
      var x = Math.min(Math.max(ox + dx, 0), vw() - B);
      var y = clampY(oy + dy);
      posX = x; posY = y;
      root.style.transform = "translate3d(" + x + "px," + y + "px,0)";
    }
  });

  function endPress(e, cancelled) {
    if (e.pointerId !== activeId) return;
    activeId = null;
    clearTimeout(holdTimer);
    try { main.releasePointerCapture(e.pointerId); } catch (_) {}
    root.classList.remove("lift");
    root.classList.remove("dragging");
    if (dragging) {
      // Never rest in the middle: glide to whichever side is closer.
      side = (posX + B / 2) < vw() / 2 ? "left" : "right";
      cyFrac = (posY + B / 2) / vh();
      savePos();
      applySide();
      place(homeX(), clampY(posY), true);
    } else if (!held && !cancelled) {
      isOpen ? close() : open();
    }
    dragging = false; held = false;
  }
  main.addEventListener("pointerup", function (e) { endPress(e, false); });
  main.addEventListener("pointercancel", function (e) { endPress(e, true); });

  main.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); isOpen ? close() : open(); }
    else if (e.key === "Escape") close();
  });
  root.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { close(); main.focus(); }
  });
  root.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  // Links must not start the browser's own link-dragging while the wheel is turned.
  root.addEventListener("dragstart", function (e) { e.preventDefault(); });

  document.addEventListener("pointerdown", function (e) {
    if (isOpen && !root.contains(e.target)) close();
  }, true);

  /* ------------------------------------------------------------------ *
   * Wheel: drag along the arc (or mouse wheel) to reveal hidden icons
   * ------------------------------------------------------------------ */
  var rot = null, wheelAcc = 0;

  function snapTo(target) {
    root.classList.remove("rot");
    offset = target;
    layout();
  }

  ring.addEventListener("pointerdown", function (e) {
    if (!isOpen || !arc || !arc.wheel) return;
    var r = main.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    rot = {
      id: e.pointerId, cx: cx, cy: cy, sx: e.clientX, sy: e.clientY,
      a0: Math.atan2(e.clientY - cy, e.clientX - cx), off0: offset, moved: false, last: 0
    };
  });
  ring.addEventListener("pointermove", function (e) {
    if (!rot || e.pointerId !== rot.id) return;
    if (!rot.moved) {
      if (Math.hypot(e.clientX - rot.sx, e.clientY - rot.sy) < 7) return;
      rot.moved = true;
      suppressClick = true;
      try { ring.setPointerCapture(e.pointerId); } catch (_) {}
      root.classList.add("rot");
    }
    var a = Math.atan2(e.clientY - rot.cy, e.clientX - rot.cx);
    var d = a - rot.a0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    // unwrap so a long drag keeps turning
    var prev = rot.last;
    var diff = d - prev;
    if (diff > Math.PI) d -= 2 * Math.PI; else if (diff < -Math.PI) d += 2 * Math.PI;
    rot.last = d;
    offset = rot.off0 - (d * 180 / Math.PI) / arc.step;
    layout();
  });
  function endRot(e) {
    if (!rot || e.pointerId !== rot.id) return;
    var moved = rot.moved;
    rot = null;
    try { ring.releasePointerCapture(e.pointerId); } catch (_) {}
    if (moved) {
      snapTo(Math.round(offset));
      setTimeout(function () { suppressClick = false; }, 60);
    }
  }
  ring.addEventListener("pointerup", endRot);
  ring.addEventListener("pointercancel", endRot);

  root.addEventListener("wheel", function (e) {
    if (!isOpen || !arc || !arc.wheel) return;
    e.preventDefault();
    wheelAcc += (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX);
    if (Math.abs(wheelAcc) >= 40) {
      snapTo(Math.round(offset) + (wheelAcc > 0 ? 1 : -1));
      wheelAcc = 0;
    }
  }, { passive: false });

  /* ------------------------------------------------------------------ *
   * Centre icon: changes every 3 seconds
   * ------------------------------------------------------------------ */
  var cur = 0, cycleTimer = null, nf = faces.length;
  function nextFace() {
    if (isOpen || dragging || document.hidden) return;
    var prev = cur;
    cur = (cur + 1) % nf;
    faces[prev].classList.remove("on");
    faces[prev].classList.add("off");
    faces[cur].classList.remove("off");
    faces[cur].classList.add("on");
    // reset the outgoing face after its exit animation so it can rotate in again
    setTimeout(function () { if (prev !== cur) faces[prev].classList.remove("off"); }, 560);
  }
  function startCycle() {
    clearInterval(cycleTimer);
    if (nf < 2) return;
    cycleTimer = setInterval(nextFace, CYCLE_MS);
  }

  /* ------------------------------------------------------------------ *
   * Intro tab
   * ------------------------------------------------------------------ */
  var tzShow = null, tzHide = null;
  function hideTeaser(immediate) {
    clearTimeout(tzShow); clearTimeout(tzHide);
    if (!tz.classList.contains("in")) return;
    tz.classList.toggle("out", !immediate);
    tz.classList.remove("in");
  }
  function maybeTeaser() {
    var seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch (e) {}
    if (seen) return;
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch (e) {}
    tzShow = setTimeout(function () {
      if (isOpen || dragging) return;
      tz.classList.remove("out");
      tz.classList.add("in");
      tzHide = setTimeout(function () { hideTeaser(false); }, 3800);
    }, 1400);
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  function boot() {
    document.body.appendChild(probe);
    document.body.appendChild(root);
    loadPos();
    measure();
    home(false);
    faces[0].classList.add("on");
    startCycle();
    maybeTeaser();
  }

  var rz = null;
  function onResize() {
    clearTimeout(rz);
    rz = setTimeout(function () {
      measure();
      var was = isOpen;
      if (was) { close(true); }
      home(false);
      if (was) setTimeout(function () { open(true); }, 60);
    }, 80);
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
