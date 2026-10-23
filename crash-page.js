/* ServiceHub — "Backend crashed" lockout page.
 * Fully self-contained (styles, markup and animation all live in this file).
 * It covers every page it is loaded on and blocks all site interaction.
 *
 * TO REMOVE once the backend is fixed:
 *   1. delete this file
 *   2. delete the <!-- CRASH-PAGE:START --> ... <!-- CRASH-PAGE:END --> block from each HTML page
 */
(function () {
  'use strict';
  if (window.__shCrash) return;
  window.__shCrash = true;

  var TITLE = 'ServiceHub · Under construction';

  /* ---------- 1. LOCK EVERYTHING ---------- */
  // Capture-phase listeners on window run before any site handler and swallow the event.
  var BLOCKED = ['click', 'dblclick', 'auxclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup',
    'touchstart', 'touchmove', 'touchend', 'wheel', 'keydown', 'keyup', 'keypress', 'contextmenu',
    'submit', 'reset', 'input', 'beforeinput', 'change', 'dragstart', 'drop', 'copy', 'cut', 'paste',
    'selectstart', 'popstate', 'hashchange'];
  function reloadKey(e) {
    return e.type === 'keydown' && (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')));
  }
  BLOCKED.forEach(function (type) {
    window.addEventListener(type, function (e) {
      if (reloadKey(e)) return; // let people refresh to check if the site is back
      e.preventDefault();
      e.stopImmediatePropagation();
    }, { capture: true, passive: false });
  });

  // Stop the rest of the site from talking to the (crashed) backend or opening anything.
  try { window.fetch = function () { return Promise.reject(new TypeError('ServiceHub is temporarily offline')); }; } catch (_) {}
  try { XMLHttpRequest.prototype.open = function () { throw new DOMException('ServiceHub is temporarily offline', 'NetworkError'); }; } catch (_) {}
  try { navigator.sendBeacon = function () { return false; }; } catch (_) {}
  try { window.open = function () { return null; }; } catch (_) {}

  /* ---------- 2. STYLES ---------- */
  var css =
    'body{display:none!important}html{overflow:hidden!important;background:#080b12}' +
    '#sh-crash{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;' +
    'background:radial-gradient(60% 50% at 15% 0%,rgba(35,136,255,.2),transparent),radial-gradient(55% 50% at 95% 100%,rgba(168,85,247,.18),transparent),#080b12;' +
    'color:#f3f6fa;font-family:Arial,sans-serif;user-select:none;-webkit-user-select:none;cursor:default;overflow:hidden}' +
    '#sh-crash *{box-sizing:border-box}' +
    '.shc-tape{flex:none;width:100%;height:12px;background:repeating-linear-gradient(-45deg,#ffc247 0 14px,#0b0f1a 14px 28px);background-size:40px 100%;animation:shc-tape 1.2s linear infinite}' +
    '.shc-top{flex:none;width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 5%;border-bottom:1px solid rgba(255,255,255,.08)}' +
    '.shc-logo{display:flex;align-items:center;gap:10px;font-size:18px}' +
    '.shc-mark{width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:1px solid #2388ff;border-radius:10px;color:#2388ff;box-shadow:0 0 15px rgba(35,136,255,.2)}' +
    '.shc-chip{display:flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid rgba(255,190,55,.85);border-radius:999px;background:rgba(12,18,30,.84);color:#ffd34d;font-size:11px;font-weight:800;letter-spacing:.1em;white-space:nowrap}' +
    '.shc-chip i{width:8px;height:8px;border-radius:50%;background:#ff5b77;box-shadow:0 0 10px #ff5b77;animation:shc-blink 1s steps(2) infinite}' +
    '.shc-main{flex:1;min-height:0;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 5%;text-align:center}' +
    '.shc-kicker{color:#fbbf24;font-size:12px;font-weight:800;letter-spacing:.14em;margin-bottom:6px}' +
    '.shc-stage{width:min(94vw,700px);min-height:0;flex:0 1 auto;display:flex;justify-content:center}' +
    '#shc-svg{width:100%;height:auto;max-height:46dvh;max-height:46vh;filter:drop-shadow(0 20px 40px rgba(35,136,255,.14))}' +
    '.shc-main h1{font-size:clamp(24px,5.2vw,44px);line-height:1.15;margin:10px 0 8px;font-weight:800}' +
    '.shc-main h1 span{background:linear-gradient(90deg,#2388ff,#a855f7,#ff4fd8);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}' +
    '.shc-sub{color:#aab4c8;font-size:clamp(15px,2.6vw,19px);line-height:1.5}' +
    '.shc-bar{width:min(86vw,320px);height:6px;margin:16px 0 8px;border-radius:99px;background:#151c2b;border:1px solid rgba(255,255,255,.08);overflow:hidden}' +
    '.shc-bar span{display:block;width:40%;height:100%;border-radius:99px;background:linear-gradient(90deg,#2388ff,#a855f7,#ff4fd8);animation:shc-bar 1.6s ease-in-out infinite}' +
    '.shc-main small{color:#8994a6;font-size:12px}' +
    '.shc-foot{flex:none;color:#8994a6;font-size:11px;padding:6px 0 10px}' +
    '@keyframes shc-tape{to{background-position:40px 0}}@keyframes shc-blink{50%{opacity:.25}}' +
    '@keyframes shc-bar{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}' +
    '@media(max-height:560px){.shc-kicker,.shc-main small{display:none}}';
  var style = document.createElement('style');
  style.id = 'sh-crash-style';
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  /* ---------- 3. MARKUP ---------- */
  // Rubber-hose limb: dark outline underneath, coloured stroke on top.
  function limb(id, c1, c2, w) {
    var o = 'fill="none" stroke="#0b0f1a" stroke-linecap="round" stroke-linejoin="round" stroke-width="' + (w + 5) + '"';
    var k = 'fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="' + w + '"';
    return '<path id="' + id + '1o" ' + o + '/><path id="' + id + '2o" ' + o + '/>' +
      '<path id="' + id + '1" ' + k + ' stroke="' + c1 + '"/><path id="' + id + '2" ' + k + ' stroke="' + c2 + '"/>' +
      '<circle id="' + id + 'h" r="9" fill="#ffc247" stroke="#0b0f1a" stroke-width="3"/>';
  }
  var S = '#0b0f1a';
  var svg =
    '<svg id="shc-svg" viewBox="0 0 640 400" role="img" aria-label="A construction worker hammering a crashed computer">' +
    '<defs><radialGradient id="shc-rg"><stop offset="0" stop-color="#2388ff" stop-opacity=".6"/><stop offset="1" stop-color="#2388ff" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="shc-sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2388ff"/><stop offset=".6" stop-color="#a855f7"/><stop offset="1" stop-color="#ff4fd8"/></linearGradient></defs>' +
    // floor + cones
    '<rect x="0" y="360" width="640" height="3" fill="#1b2437"/><ellipse cx="170" cy="362" rx="60" ry="7" fill="#000" opacity=".35"/>' +
    '<g transform="translate(70 360)"><path d="M-18 0 L-8 -46 L8 -46 L18 0 Z" fill="#ff7a1a" stroke="' + S + '" stroke-width="3" stroke-linejoin="round"/><path d="M-11 -20 L11 -20 L9 -30 L-9 -30 Z" fill="#fff"/><rect x="-22" y="-3" width="44" height="6" rx="2" fill="#0f1524" stroke="' + S + '" stroke-width="2"/></g>' +
    '<g transform="translate(628 360)"><path d="M-18 0 L-8 -46 L8 -46 L18 0 Z" fill="#ff7a1a" stroke="' + S + '" stroke-width="3" stroke-linejoin="round"/><path d="M-11 -20 L11 -20 L9 -30 L-9 -30 Z" fill="#fff"/><rect x="-22" y="-3" width="44" height="6" rx="2" fill="#0f1524" stroke="' + S + '" stroke-width="2"/></g>' +
    '<g id="shc-cpu"><rect x="240" y="250" width="60" height="110" rx="7" fill="#151c2b" stroke="#2388ff" stroke-width="3"/>' +
    '<rect x="249" y="262" width="42" height="7" rx="2" fill="#0b0f1a"/><rect x="249" y="275" width="42" height="7" rx="2" fill="#0b0f1a"/>' +
    '<path d="M251 300h38M251 307h38M251 314h38" stroke="#26314a" stroke-width="2"/><circle cx="270" cy="338" r="6" fill="#0b0f1a" stroke="#3a4a6e" stroke-width="2"/><circle id="shc-led" cx="270" cy="338" r="3" fill="#ff5b77"/></g>' +
    // desk
    '<g transform="translate(50 0)"><g id="shc-desk"><rect x="238" y="290" width="340" height="13" rx="3" fill="#1b2437" stroke="#2d3b5a" stroke-width="2"/>' +
    '<rect x="252" y="303" width="12" height="57" fill="#151c2b" stroke="#2d3b5a" stroke-width="2"/><rect x="552" y="303" width="12" height="57" fill="#151c2b" stroke="#2d3b5a" stroke-width="2"/>' +
    '<ellipse id="shc-lite" cx="395" cy="288" rx="130" ry="26" fill="url(#shc-rg)" opacity="0"/>' +
    '<rect x="365" y="283" width="60" height="7" rx="3" fill="#26314a" stroke="#3a4a6e" stroke-width="2"/>' +
    // monitor
    '<g id="shc-mon"><rect x="388" y="236" width="14" height="48" fill="#26314a" stroke="#3a4a6e" stroke-width="2"/>' +
    '<rect x="320" y="148" width="150" height="88" rx="9" fill="#0f1524" stroke="#3a4a6e" stroke-width="3"/><rect x="329" y="157" width="132" height="70" rx="4" fill="#05080f"/>' +
    '<g id="shc-scr" opacity="0"><rect x="329" y="157" width="132" height="70" rx="4" fill="url(#shc-sg)"/><text x="395" y="208" text-anchor="middle" font-size="44" font-weight="700" fill="#fff" font-family="Arial,sans-serif">ϟ</text></g></g>' +
    // keyboard
    '<g id="shc-kb"><path d="M312 274 H402 L408 290 H306 Z" fill="#202a40" stroke="#3a4a6e" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M316 280h84M314 285h88" stroke="#3a4a6e" stroke-width="2" stroke-dasharray="5 3"/><rect id="shc-key" x="330" y="277" width="14" height="5" rx="1" fill="#2388ff" opacity="0"/></g></g></g>' +
    // worker: legs, back arm, body, front arm, hammer
    '<g id="shc-person">' + '<path id="shc-lg1o" fill="none" stroke="#0b0f1a" stroke-linecap="round" stroke-width="19"/><path id="shc-lg2o" fill="none" stroke="#0b0f1a" stroke-linecap="round" stroke-width="19"/><path id="shc-lg1" fill="none" stroke="#26314a" stroke-linecap="round" stroke-width="14"/><path id="shc-lg2" fill="none" stroke="#26314a" stroke-linecap="round" stroke-width="14"/>' +
    '<ellipse id="shc-ft1" cx="170" cy="354" rx="16" ry="8" fill="#5a3a22" stroke="' + S + '" stroke-width="3"/><ellipse id="shc-ft2" cx="206" cy="354" rx="16" ry="8" fill="#5a3a22" stroke="' + S + '" stroke-width="3"/>' +
    limb('shc-f', '#2388ff', '#e0a878', 13) +
    '<g id="shc-body"><rect x="-6" y="-84" width="12" height="14" fill="#e0a878" stroke="' + S + '" stroke-width="3"/>' +
    '<rect x="-25" y="-78" width="50" height="80" rx="15" fill="#ff7a1a" stroke="' + S + '" stroke-width="3"/><rect x="-25" y="-52" width="50" height="7" fill="#fff1a8"/><rect x="-25" y="-26" width="50" height="7" fill="#fff1a8"/><rect x="-25" y="-8" width="50" height="8" fill="#1b2437"/>' +
    '<g id="shc-head"><circle cx="0" cy="0" r="25" fill="#e0a878" stroke="' + S + '" stroke-width="3"/><circle cx="-19" cy="3" r="5" fill="#e0a878" stroke="' + S + '" stroke-width="2"/>' +
    '<circle cx="6" cy="-1" r="6.5" fill="#fff" stroke="' + S + '" stroke-width="2"/><circle cx="19" cy="-1" r="6.5" fill="#fff" stroke="' + S + '" stroke-width="2"/><circle id="shc-pl" r="3" fill="' + S + '"/><circle id="shc-pr" r="3" fill="' + S + '"/>' +
    '<path d="M0 -12 L11 -15M14 -15 L25 -12" stroke="' + S + '" stroke-width="3" stroke-linecap="round"/><ellipse id="shc-mouth" cx="13" cy="14" rx="5" ry="2" fill="#5a1d1d" stroke="' + S + '" stroke-width="2"/>' +
    '<path d="M-27 -7 A27 27 0 0 1 27 -7 Z" fill="#ffc247" stroke="' + S + '" stroke-width="3" stroke-linejoin="round"/><rect x="-5" y="-33" width="10" height="26" fill="#ffd96b" stroke="' + S + '" stroke-width="2"/><rect x="-31" y="-9" width="68" height="7" rx="3.5" fill="#ffb020" stroke="' + S + '" stroke-width="3"/></g></g>' +
    limb('shc-h', '#2388ff', '#e0a878', 13) +
    '<g id="shc-ham"><rect x="0" y="-4" width="48" height="8" rx="4" fill="#9a6a3a" stroke="' + S + '" stroke-width="2.5"/><rect x="40" y="-15" width="16" height="30" rx="3" fill="#aab4c8" stroke="' + S + '" stroke-width="3"/><rect x="43" y="-12" width="4" height="24" rx="2" fill="#e6ecf8"/></g></g>' +
    // sparks + bubble
    '<g id="shc-sp" stroke="#ffd34d" stroke-width="3.5" stroke-linecap="round">' + '<line/>'.repeat(7) + '</g>' +
    '<text id="shc-bub" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="26" fill="#ffd34d" stroke="' + S + '" stroke-width="5" paint-order="stroke" opacity="0"></text>' +
    '</svg>';

  var root = document.createElement('div');
  root.id = 'sh-crash';
  root.innerHTML =
    '<div class="shc-tape"></div>' +
    '<header class="shc-top"><span class="shc-logo"><span class="shc-mark">ϟ</span><b>ServiceHub</b></span><span class="shc-chip"><i></i>BACKEND OFFLINE</span></header>' +
    '<main class="shc-main"><p class="shc-kicker">🚧 SITE UNDER CONSTRUCTION</p><div class="shc-stage">' + svg + '</div>' +
    '<h1>Backend crashed <span>while adding features</span></h1><p class="shc-sub">But don’t worry, we’re working on it.</p>' +
    '<div class="shc-bar"><span></span></div><small>Fix in progress · Please check back soon</small></main>' +
    '<footer class="shc-foot">Powered by Solaceproeditz</footer><div class="shc-tape"></div>';
  document.documentElement.appendChild(root);

  // Keep the page up even if something tries to remove it.
  new MutationObserver(function () {
    if (!root.isConnected) document.documentElement.appendChild(root);
  }).observe(document.documentElement, { childList: true });
  function setTitle() { document.title = TITLE; }
  setTitle();
  document.addEventListener('DOMContentLoaded', setTitle);
  window.addEventListener('load', setTitle);

  /* ---------- 4. ANIMATION (10 s loop) ----------
   * hammer x3 -> tap keyboard -> screen flashes 1 s -> lift monitor & peek under -> drop it -> hammer again */
  var $ = function (id) { return document.getElementById(id); };
  var el = {};
  ['shc-desk', 'shc-cpu', 'shc-led', 'shc-mon', 'shc-scr', 'shc-lite', 'shc-kb', 'shc-key', 'shc-body', 'shc-head', 'shc-ham',
    'shc-pl', 'shc-pr', 'shc-mouth', 'shc-sp', 'shc-bub'].forEach(function (id) { el[id] = $(id); });
  var sparks = el['shc-sp'].children;

  function ease(x) { return x * x * (3 - 2 * x); }
  function seg(k, t) {
    var i = 0;
    while (i < k.length - 2 && t >= k[i + 1][0]) i++;
    var a = k[i], b = k[i + 1];
    return [a, b, ease(Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))))];
  }
  function num(k, t) { var s = seg(k, t); return s[0][1] + (s[1][1] - s[0][1]) * s[2]; }
  // target keyframes: [t, x, y, mode, angle]   mode 0 = world, 1 = relative to shoulder, 2 = world + monitor lift
  function aim(k, t, sh, mon) {
    var s = seg(k, t);
    function P(f) { return f[3] === 1 ? [sh[0] + f[1], sh[1] + f[2]] : [f[1], f[2] + (f[3] === 2 ? mon : 0)]; }
    var A = P(s[0]), B = P(s[1]);
    return [A[0] + (B[0] - A[0]) * s[2], A[1] + (B[1] - A[1]) * s[2], (s[0][4] || 0) + ((s[1][4] || 0) - (s[0][4] || 0)) * s[2]];
  }

  var HAM = [[0, 205, 120, 0, -110], [.4, 270, 194, 0, 90], [.8, 205, 120, 0, -110], [1.2, 270, 194, 0, 90], [1.6, 205, 120, 0, -110], [2, 270, 194, 0, 90],
    [2.5, 16, 50, 1, 65], [8.4, 16, 50, 1, 65], [9.4, 205, 120, 0, -110], [10, 205, 120, 0, -110]];
  var FREE = [[0, 12, 52, 1], [2.4, 12, 52, 1], [3.1, 385, 252, 0], [3.3, 385, 272, 0], [3.55, 385, 252, 0], [3.75, 385, 272, 0], [4, 385, 252, 0], [4.9, 385, 252, 0],
    [5.6, 372, 196, 2], [7.5, 372, 196, 2], [7.62, 372, 141, 0], [8.5, 12, 52, 1], [10, 12, 52, 1]];
  var MON = [[0, 0], [5.6, 0], [6.2, -55], [7.6, -55], [7.8, 6], [7.9, -3], [8, 0], [10, 0]];
  var SCR = [[0, 0], [3.75, 0], [3.88, 1], [4.8, 1], [4.95, 0], [10, 0]];
  var LEAN = [[0, 0], [5.3, 0], [6, 12], [6.7, 34], [7.5, 34], [7.95, 6], [8.5, 0], [10, 0]];
  var BX = [[0, 0], [2.6, 0], [3.1, 56], [5.2, 56], [6.7, 95], [7.5, 95], [8.2, 0], [10, 0]];
  var TILT = [[0, 0], [3, 0], [3.4, 8], [4, 4], [5.5, 0], [6.5, 30], [7.5, 30], [7.7, -8], [8.5, 0], [10, 0]];
  var HITS = [.4, 1.2, 2];
  var EVENTS = [[.4, 'BONK!', 300, 160], [1.2, 'CLANG!', 300, 160], [2, 'BANG!', 300, 160], [3.88, '?!', 445, 126], [7.8, 'THUD!', 445, 126]];
  var L = 92;

  function since(t, list) {
    var best = 99;
    for (var i = 0; i < list.length; i++) { var d = t - list[i]; if (d >= 0 && d < best) best = d; }
    return best;
  }
  function wobble(s, amp) { return s < .45 ? amp * Math.sin(s * 80) * Math.exp(-s * 11) : 0; }
  function f(p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }

  function arm(id, sh, tg, side) {
    var dx = tg[0] - sh[0], dy = tg[1] - sh[1], D = Math.hypot(dx, dy) || 1, d = Math.min(D, 2 * L - 2),
      ux = dx / D, uy = dy / D, a = d / 2, h = Math.sqrt(L * L - a * a),
      e = [sh[0] + ux * a + side * uy * h, sh[1] + uy * a - side * ux * h], hd = [sh[0] + ux * d, sh[1] + uy * d];
    $(id + '1').setAttribute('d', 'M' + f(sh) + 'L' + f(e)); $(id + '1o').setAttribute('d', 'M' + f(sh) + 'L' + f(e));
    $(id + '2').setAttribute('d', 'M' + f(e) + 'L' + f(hd)); $(id + '2o').setAttribute('d', 'M' + f(e) + 'L' + f(hd));
    var c = $(id + 'h'); c.setAttribute('cx', hd[0]); c.setAttribute('cy', hd[1]);
    return hd;
  }
  function leg(id, hip, foot) {
    var d = 'M' + f(hip) + 'L' + f(foot);
    $(id).setAttribute('d', d); $(id + 'o').setAttribute('d', d);
  }

  function frame(t) {
    var lean = num(LEAN, t), bx = num(BX, t), mon = num(MON, t), scr = num(SCR, t), tilt = num(TILT, t);
    var hip = [178 + bx, 275], r = lean * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    function up(x, y) { return [hip[0] + x * c - y * s, hip[1] + x * s + y * c]; }

    el['shc-body'].setAttribute('transform', 'translate(' + f(hip) + ') rotate(' + lean.toFixed(1) + ')');
    el['shc-head'].setAttribute('transform', 'translate(4 -106) rotate(' + tilt.toFixed(1) + ')');
    var fx = bx * .8;
    leg('shc-lg1', [hip[0] - 5, hip[1] - 2], [170 + fx, 350]); leg('shc-lg2', [hip[0] + 6, hip[1] - 2], [206 + fx, 350]);
    $('shc-ft1').setAttribute('cx', 170 + fx); $('shc-ft2').setAttribute('cx', 206 + fx);

    // arms (inverse kinematics keeps hands on the hammer / keyboard / monitor)
    var shF = up(8, -66), shB = up(-4, -68);
    var fh = aim(FREE, t, shB, mon);
    arm('shc-f', shB, fh, -1);
    var hh = aim(HAM, t, shF, mon);
    var hand = arm('shc-h', shF, hh, -1);
    el['shc-ham'].setAttribute('transform', 'translate(' + f(hand) + ') rotate(' + hh[2].toFixed(1) + ')');

    // face
    var peek = Math.max(0, Math.min(1, lean / 38));
    [['shc-pl', 6], ['shc-pr', 19]].forEach(function (p) {
      el[p[0]].setAttribute('cx', p[1] + 2.5); el[p[0]].setAttribute('cy', -1 + 1 + 2.5 * peek);
    });
    el['shc-mouth'].setAttribute('ry', (2 + 5 * Math.max(scr, peek)).toFixed(1));

    // desk objects
    var hitS = since(t, HITS), thudS = since(t, [7.8]);
    el['shc-cpu'].setAttribute('transform', 'translate(' + wobble(hitS, 3).toFixed(2) + ' 0)');
    el['shc-desk'].setAttribute('transform', 'translate(0 ' + wobble(thudS, 2.5).toFixed(2) + ')');
    el['shc-mon'].setAttribute('transform', 'translate(0 ' + mon.toFixed(1) + ')');
    var fl = scr * (0.88 + 0.12 * Math.sin(t * 70));
    el['shc-scr'].setAttribute('opacity', fl.toFixed(2));
    el['shc-lite'].setAttribute('opacity', (scr * .8).toFixed(2));
    el['shc-led'].setAttribute('opacity', (0.55 + 0.45 * Math.sin(t * 8)).toFixed(2));
    var pressed = fh[1] > 266 && fh[0] > 350 && fh[0] < 430;
    el['shc-key'].setAttribute('opacity', pressed ? 1 : 0);
    el['shc-kb'].setAttribute('transform', 'translate(0 ' + (pressed ? 1 : 0) + ')');

    // sparks on each hammer hit
    var p = hitS / .3;
    for (var i = 0; i < sparks.length; i++) {
      var a = (-170 + i * 22) * Math.PI / 180, r0 = 8 + p * 30, r1 = r0 + 12 * (1 - p);
      sparks[i].setAttribute('x1', 270 + Math.cos(a) * r0); sparks[i].setAttribute('y1', 248 + Math.sin(a) * r0);
      sparks[i].setAttribute('x2', 270 + Math.cos(a) * r1); sparks[i].setAttribute('y2', 248 + Math.sin(a) * r1);
      sparks[i].setAttribute('opacity', p < 1 ? (1 - p).toFixed(2) : 0);
    }

    // comic-book sound bubble
    var bub = el['shc-bub'], shown = false;
    EVENTS.forEach(function (ev) {
      var d = t - ev[0];
      if (d >= 0 && d < .55) {
        shown = true;
        bub.textContent = ev[1];
        bub.setAttribute('transform', 'translate(' + ev[2] + ' ' + ev[3] + ') rotate(-7) scale(' + (1 + .35 * Math.max(0, 1 - d / .12)).toFixed(2) + ')');
        bub.setAttribute('opacity', d < .4 ? 1 : (1 - (d - .4) / .15).toFixed(2));
      }
    });
    if (!shown) bub.setAttribute('opacity', 0);
  }

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { frame(3.3); return; }
  var t0 = performance.now();
  (function loop(now) {
    frame(((now - t0) / 1000) % 10);
    requestAnimationFrame(loop);
  })(t0);
})();
