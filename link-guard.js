/* ============================================================
   SERVICEHUB LINK GUARD
   ------------------------------------------------------------
   Stops scammers and hackers from sharing malicious or
   suspicious links anywhere on the site.

   HOW IT WORKS
   Every text box on the site is DEFAULT-DENY: it accepts no
   links at all unless it has been given a link policy.

     none        no links (names, company, about, requirements,
                 feedback, search, ...)                (default)
     contact     contact links only: WhatsApp, Telegram, Discord,
                 Signal, Messenger, Skype, Viber, LINE, plus the
                 main social profile sites (Instagram, X, ...)
     social      portfolio box: social platforms and the places
                 portfolios are stored (Behance, Drive, GitHub ...)
     googleform  job form box: Google Form links ONLY
     site        ServiceHub's own links only (manage links)
     all         chat: every link allowed anywhere on the site
                 combined, and nothing else
     off         not checked (use sparingly)

   Anything that is not allowed is deleted from the box straight
   away (pasted/autofilled text instantly, typed text as soon as
   it cannot become an allowed link), and a small notice tells
   the person why.

   TO CHANGE A BOX'S POLICY
   Add  data-link-policy="contact"  (etc.) to the <input> or
   <textarea>.  Boxes created by script.js are covered too.

   TO ALLOW ANOTHER WEBSITE
   Add its domain to the right list below (it also covers its
   subdomains). Nothing else needs to change.

   ABOUT THE LIMITS
   This runs in the browser, so it protects honest visitors and
   stops accidents and copy-paste scams. A determined attacker can
   talk to the backend directly, so the same rules should also be
   enforced server-side (see the suggestions that came with this
   update). Messages and listings already stored are cleaned again
   when they are DISPLAYED, via clean() / safeHref() below.
   ============================================================ */
(function () {
  "use strict";
  if (window.ServiceHubLinkGuard) return;

  /* ---------------- 1. Allowed websites ---------------- */

  var MESSAGING = [
    "wa.me", "whatsapp.com", "t.me", "telegram.me", "telegram.dog",
    "discord.gg", "discord.com", "discordapp.com",
    "signal.me", "signal.group",
    "m.me", "messenger.com",
    "join.skype.com", "skype.com",
    "viber.com", "line.me", "imo.im"
  ];

  /* Main social networks where people keep a profile / DM inbox */
  var PROFILES = [
    "facebook.com", "fb.com", "fb.me", "fb.watch",
    "instagram.com", "instagr.am", "ig.me",
    "x.com", "twitter.com",
    "linkedin.com", "lnkd.in",
    "tiktok.com", "snapchat.com", "threads.net", "threads.com",
    "youtube.com", "youtu.be", "bsky.app"
  ];

  /* More social / content platforms (portfolio box only) */
  var MEDIA = [
    "pinterest.com", "pin.it", "reddit.com", "twitch.tv", "kick.com",
    "tumblr.com", "medium.com", "vimeo.com", "vk.com",
    "soundcloud.com", "spotify.com", "spotify.link", "music.apple.com",
    "audiomack.com", "boomplay.com", "mixcloud.com", "bandcamp.com"
  ];

  /* Places portfolios are stored */
  var PORTFOLIO = [
    "behance.net", "dribbble.com", "github.com", "gitlab.com", "bitbucket.org",
    "codepen.io", "figma.com", "canva.com", "notion.so", "notion.site",
    "drive.google.com", "docs.google.com", "photos.google.com", "photos.app.goo.gl",
    "dropbox.com", "1drv.ms", "onedrive.live.com",
    "flickr.com", "500px.com", "artstation.com", "deviantart.com", "vsco.co",
    "portfolio.adobe.com", "express.adobe.com", "lightroom.adobe.com",
    "upwork.com", "fiverr.com", "freelancer.com", "contra.com", "toptal.com",
    "peopleperhour.com", "99designs.com",
    "linktr.ee", "bio.link", "beacons.ai",
    "loom.com", "frame.io"
  ];

  /* Google Form links only. A domain can carry a path rule. */
  var GFORM = ["docs.google.com", "forms.gle", "forms.google.com"];
  var GFORM_PATHS = {
    "docs.google.com": { prefix: "/forms/" },
    "forms.gle": { min: 2 }
  };

  /* URL shapes that bounce people to another site even on a trusted domain */
  var BAD_HOSTS = ["l.facebook.com", "lm.facebook.com", "l.instagram.com", "out.reddit.com"];
  var BAD_PATHS = [
    ["youtube.com", /^\/(redirect|attribution_link)\b/i],
    ["facebook.com", /^\/(l\.php|flx\/warn)/i],
    ["linkedin.com", /^\/safety\/go/i]
  ];

  var CONTACT_SCHEMES = ["mailto", "tel", "tg", "whatsapp", "skype"];

  var PUBLIC_HOST = "servicehub-amber.vercel.app";
  function ownHosts() {
    var h = [PUBLIC_HOST];
    try {
      var cur = String(location.hostname || "").toLowerCase();
      if (cur && /^[a-z0-9.\-]+$/.test(cur) && h.indexOf(cur) === -1) h.push(cur);
    } catch (e) {}
    return h;
  }

  function uniq(a) { var o = [], i; for (i = 0; i < a.length; i++) if (o.indexOf(a[i]) === -1) o.push(a[i]); return o; }

  var DEFS = {
    none: {
      msg: "Links aren't allowed in this box, so it was removed.",
      domains: function () { return []; }, schemes: [], emails: true
    },
    contact: {
      msg: "Only contact links (WhatsApp, Telegram, Discord, Instagram…) are allowed here. Anything else was removed.",
      domains: function () { return uniq(MESSAGING.concat(PROFILES)); }, schemes: CONTACT_SCHEMES, emails: true
    },
    social: {
      strict: true,
      msg: "Only social media and portfolio-platform links (Instagram, YouTube, Behance, Google Drive, GitHub…) are allowed here.",
      domains: function () { return uniq(PROFILES.concat(MEDIA, PORTFOLIO)); }, schemes: []
    },
    googleform: {
      strict: true, httpsOnly: true,
      msg: "Only Google Form links (docs.google.com/forms or forms.gle) are allowed here.",
      domains: function () { return GFORM.slice(); }, schemes: [], paths: GFORM_PATHS
    },
    site: {
      msg: "Only ServiceHub links are allowed here.",
      domains: function () { return ownHosts(); }, schemes: [], emails: true
    },
    all: {
      msg: "That link isn't from a platform supported on ServiceHub, so it was removed.",
      domains: function () {
        return uniq(MESSAGING.concat(PROFILES, MEDIA, PORTFOLIO, GFORM, ownHosts()));
      },
      schemes: CONTACT_SCHEMES, emails: true
    }
  };

  var POL = {};
  function getPolicy(name) {
    name = DEFS[name] ? name : "none";
    if (!POL[name]) {
      var d = DEFS[name];
      POL[name] = {
        name: name, strict: !!d.strict, httpsOnly: !!d.httpsOnly, msg: d.msg,
        domains: d.domains(), schemes: d.schemes, paths: d.paths || null, emails: !!d.emails
      };
    }
    return POL[name];
  }

  /* ---------------- 2. Top-level domains we treat as "a website" ---------------- */

  var TLDS = {};
  ("com net org info biz edu gov mil int io co ai app dev xyz online site store shop tech link click top club live " +
   "fyi icu vip pro mobi name asia cloud page cyou cfd sbs rest monster buzz work world today space website email " +
   "life news agency digital media network solutions services systems center company ltd inc group academy ninja " +
   "guru zip mov support help download stream win bid loan review trade date racing party science cricket faith men " +
   "gdn kim country accountant host press wiki blog art design studio photography photo pics gallery video movie " +
   "game games bet casino poker bingo lol wtf sex porn xxx adult tube dating singles gle " +
   "ac ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bm bn bo br bs bt bw by bz ca " +
   "cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg er es et eu fi fj fk fm fo " +
   "fr ga gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in io iq ir is it je " +
   "jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mg mh mk ml mm mn mo " +
   "mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt " +
   "pw py qa re ro rs ru rw sa sb sc sd se sg sh si sk sl sm sn so sr ss st su sv sx sy sz tc td tf tg th tj tk " +
   "tl tm tn to tr tt tv tw tz ua ug uk us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw")
    .split(" ").forEach(function (t) { TLDS[t] = 1; });
  /* every allowed domain's own ending counts as a website ending too */
  Object.keys(DEFS).forEach(function (k) {
    DEFS[k].domains().forEach(function (d) { TLDS[d.split(".").pop()] = 1; });
  });

  /* Everyday words that are also country endings: "ok.Me" is a sentence, not a site */
  var WORDY = { me: 1, so: 1, to: 1, "in": 1, is: 1, it: 1, at: 1, be: 1, by: 1, my: 1, no: 1, "do": 1, as: 1, am: 1,
                us: 1, we: 1, ad: 1, an: 1, la: 1, pm: 1, id: 1, re: 1, im: 1, ma: 1, pa: 1, ms: 1, mr: 1, "go": 1 };

  /* ---------------- 3. Reading a link ---------------- */

  function hostMatch(host, domains) {
    for (var i = 0; i < domains.length; i++) {
      var d = domains[i];
      if (host === d || (host.length > d.length && host.slice(-d.length - 1) === "." + d)) return d;
    }
    return "";
  }

  /* can this half-typed host still turn into an allowed one? */
  function hostPrefixOk(host, domains) {
    if (!domains.length) return false;
    if (host === "") return true;
    var labels = host.split("."), i, j, suf;
    for (i = 0; i < labels.length; i++) {
      suf = labels.slice(i).join(".");
      for (j = 0; j < domains.length; j++) if (domains[j].indexOf(suf) === 0) return true;
    }
    return false;
  }

  var BAD_CHARS = /[\\\u0000-\u001f\u007f<>"`{}|^]/;
  var REDIRECT_PARAM = /(?:[?&#=]|%3d)(?:https?|ftp|javascript|data)(?::|%3a)/i;
  var HOST_RE = /^[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?)*$/;

  /* Is this ONE link allowed under the policy?  partial=true: the person may still be typing it. */
  function analyse(raw, pol, partial) {
    var s = String(raw);
    if (!s || s.length > 2048 || BAD_CHARS.test(s)) return false;
    var scheme = "", rest = s;
    var m = /^([a-z][a-z0-9+.\-]*):(\/\/)?/i.exec(s);
    if (m) {
      scheme = m[1].toLowerCase();
      if (scheme === "http" || scheme === "https") {
        if (!m[2]) return false;
        rest = s.slice(m[0].length);
      } else {
        return pol.schemes.indexOf(scheme) !== -1;      /* mailto: tel: tg: ... only where contacts are allowed */
      }
    } else if (s.slice(0, 2) === "//") {
      scheme = "https"; rest = s.slice(2);
    }
    if (pol.httpsOnly && scheme === "http") return false;

    var cut = rest.search(/[\/?#]/);
    var authority = cut === -1 ? rest : rest.slice(0, cut);
    var tail = cut === -1 ? "" : rest.slice(cut);
    if (authority.indexOf("@") !== -1) return false;     /* https://wa.me@evil.com */

    var pm = /:(\d*)$/.exec(authority);
    if (pm) {
      if (pm[1] && pm[1] !== "443" && pm[1] !== "80") return false;
      if (!pm[1] && !partial) return false;
      authority = authority.slice(0, pm.index);
    }
    var host = authority.toLowerCase().replace(/\.$/, "");
    if (!pol.domains.length) return false;

    var dom = hostMatch(host, pol.domains);
    if (!dom) {
      if (partial && !tail && !pm) {
        if ("www.".indexOf(host) === 0) return true;     /* w, ww, www */
        return hostPrefixOk(host, pol.domains);
      }
      return false;
    }
    if (!HOST_RE.test(host)) return false;
    if (BAD_HOSTS.indexOf(host) !== -1) return false;
    for (var i = 0; i < BAD_PATHS.length; i++) {
      if (hostMatch(host, [BAD_PATHS[i][0]]) && BAD_PATHS[i][1].test(tail)) return false;
    }
    if (REDIRECT_PARAM.test(tail)) return false;

    var rule = pol.paths && pol.paths[dom];
    if (rule) {
      if (rule.prefix) {
        var okPath = tail.toLowerCase().indexOf(rule.prefix) === 0 ||
                     (partial && rule.prefix.indexOf(tail.toLowerCase()) === 0);
        if (!okPath) return false;
      }
      if (rule.min && !partial && tail.length < rule.min) return false;
    }
    return true;
  }

  /* ---------------- 4. Finding links inside text ---------------- */

  var INVISIBLE = /[­​⁠﻿᠎‪-‮⁦-⁩]/g;
  var SCHEME_RE = /(?:\b(?:javascript|vbscript|data|file|blob|mailto|tel|sms|tg|skype|whatsapp|view-source):(?=\S)|[a-z][a-z0-9+.\-]*:\/\/)\S*/i;
  var EMAIL_RE = /^[("'<\[]*[^\s@\/:()<>\[\]]+@[a-z0-9\-]+(?:\.[a-z0-9\-]+)*\.[a-z]{2,}[.,;:!?)"'>\]]*$/i;
  var OBF_RE = /\b([a-z0-9][a-z0-9\-]{0,62})\s*(\[\s*\.\s*\]|\(\s*\.\s*\)|\{\s*\.\s*\}|[\[({]\s*dot\s*[\])}]|\s+dot\s+)\s*([a-z]{2,24})\b/gi;
  var TRAIL = /[.,;:!?)\]}>'"”’*]+$/;
  /* strip sentence punctuation after a link, but keep a closing ")" that belongs to an opening "(" */
  function trimTail(raw) {
    var t = raw.replace(TRAIL, "");
    if (raw.indexOf("(") !== -1 && t.length < raw.length) {
      var extra = raw.slice(t.length), k = 0;
      while (k < extra.length && extra.charAt(k) === ")" && (t.split("(").length - 1) > (t.split(")").length - 1)) { t += ")"; k++; }
    }
    return t;
  }

  function norm(tok) {
    var n = tok;
    try { n = tok.normalize("NFKC"); } catch (e) {}
    return n.replace(/[。｡․﹒⸮]/g, ".");
  }

  function findCandidates(s) {
    var out = [], re = /\S+/g, m;
    while ((m = re.exec(s))) {
      var tok = m[0], ts = m.index, te = ts + tok.length;
      var n = norm(tok), same = n.length === tok.length;
      if (EMAIL_RE.test(n)) continue;

      function push(idx, type) {
        var raw = trimTail(n.slice(idx));
        if (!raw) return;
        if (same) out.push({ start: ts + idx, end: ts + idx + raw.length, raw: raw, type: type, tokEnd: te });
        else out.push({ start: ts, end: te, raw: raw, type: type, tokEnd: te });
      }

      var x = SCHEME_RE.exec(n);
      if (x) { push(x.index, "scheme"); continue; }

      x = /^[("'<\[]*(\/\/[a-z0-9][^\s]*\.[a-z]{2,}\S*)/i.exec(n);
      if (x) { push(n.indexOf(x[1]), "scheme"); continue; }

      x = /(?:^|[^a-z0-9])(www\d?\.[a-z0-9\-]+\S*)/i.exec(n);
      if (x) { push(x.index + x[0].length - x[1].length, "www"); continue; }

      /* bare domains: word.word with a real website ending */
      var runRe = /[^\s\/?#:,;!()<>\[\]{}"'|\\@]+/g, r;
      while ((r = runRe.exec(n))) {
        var run = r[0], idx = r.index, after = n.charAt(idx + run.length);
        if (run.indexOf(".") === -1) continue;
        var labels = run.split("."), last = labels[labels.length - 1], ok = true, k;
        for (k = 0; k < labels.length; k++) if (!labels[k]) { ok = false; break; }
        if (!ok) continue;
        var hasPath = /[\/?#:]/.test(after) && /^[\/?#:]/.test(n.slice(idx + run.length));
        if (n.charAt(idx - 1) === "@" && !hasPath) continue;           /* email domain */
        var isIp = labels.length === 4 && labels.every(function (p) { return /^\d{1,3}$/.test(p) && +p <= 255; });
        var tldOk = /^[a-z]{2,24}$/i.test(last) && TLDS[last.toLowerCase()];
        if (!isIp && !tldOk) continue;
        if (tldOk && !isIp && !hasPath && labels.length === 2 && /^[A-Z][a-z]+$/.test(last) && WORDY[last.toLowerCase()]) continue;
        var endIdx = hasPath ? n.length : idx + run.length;
        var raw = trimTail(n.slice(idx, endIdx));
        if (!raw) continue;
        if (same) out.push({ start: ts + idx, end: ts + idx + raw.length, raw: raw, type: isIp ? "ip" : "bare", tokEnd: te });
        else out.push({ start: ts, end: te, raw: raw, type: isIp ? "ip" : "bare", tokEnd: te });
        if (hasPath) break;
      }
    }

    /* deliberately disguised links:  wa[.]me   site (dot) com   evil dot com */
    var o;
    OBF_RE.lastIndex = 0;
    while ((o = OBF_RE.exec(s))) {
      var tl = o[3].toLowerCase();
      if (!TLDS[tl]) continue;
      if (/^\s+dot\s+$/i.test(o[2]) && WORDY[tl]) continue;
      var oe = o.index + o[0].length;
      if (s.charAt(oe) === "/") { var sp = s.slice(oe).search(/\s/); oe = sp === -1 ? s.length : oe + sp; }
      out.push({ start: o.index, end: oe, raw: s.slice(o.index, oe), type: "obf", tokEnd: oe });
    }
    return out;
  }

  function mergeRanges(rs) {
    rs.sort(function (a, b) { return a.start - b.start; });
    var out = [];
    rs.forEach(function (r) {
      var l = out[out.length - 1];
      if (l && r.start <= l.end) { if (r.end > l.end) l.end = r.end; l.raws.push(r.raw); }
      else out.push({ start: r.start, end: r.end, raws: [r.raw] });
    });
    return out;
  }

  /* ---------------- 5. Cleaning text ---------------- */

  function withHttps(v) {
    if (/^https?:\/\//i.test(v)) return v;
    if (v.slice(0, 2) === "//") return "https:" + v;
    return "https://" + v;
  }

  function strictPrefixOk(v, pol) {
    var l = v.toLowerCase(), sc = pol.httpsOnly ? ["https://"] : ["https://", "http://"], i;
    for (i = 0; i < sc.length; i++) if (sc[i].indexOf(l) === 0) return true;
    return analyse(v, pol, true);
  }

  function sanitizeStrict(s, pol, opts) {
    var v = s.replace(/\s+/g, "");
    if (!v) return { text: "", removed: [], ranges: [] };
    if (opts.typing) {
      if (strictPrefixOk(v, pol)) return { text: v, removed: v !== s ? [] : [], ranges: [] };
      for (var i = v.length - 1; i >= 0; i--) {
        if (strictPrefixOk(v.slice(0, i), pol)) return { text: v.slice(0, i), removed: [v.slice(i)], ranges: [] };
      }
      return { text: "", removed: [v], ranges: [] };
    }
    if (analyse(v, pol, false)) return { text: withHttps(v), removed: [], ranges: [] };
    var c = findCandidates(s);
    for (var j = 0; j < c.length; j++) {
      if (c[j].type !== "obf" && analyse(c[j].raw, pol, false)) {
        return { text: withHttps(c[j].raw), removed: [v.replace(c[j].raw, "") || v], ranges: [] };
      }
    }
    return { text: "", removed: [v], ranges: [] };
  }

  /* sanitize(text, policy, {typing, replacement}) -> {text, removed[], ranges[]} */
  function sanitize(text, policyName, opts) {
    opts = opts || {};
    var pol = getPolicy(policyName);
    text = String(text == null ? "" : text);
    var s = text.replace(INVISIBLE, "");
    if (pol.strict) return sanitizeStrict(s, pol, opts);

    var cands = findCandidates(s), kill = [];
    cands.forEach(function (x) {
      var atEnd = x.tokEnd === s.length;
      if (opts.typing && atEnd && x.type !== "obf") {
        if (x.type === "bare" || x.type === "ip") return;     /* still being typed: judge it when it is finished */
        if (analyse(x.raw, pol, true)) return;
        kill.push(x); return;
      }
      if (x.type === "obf" || !analyse(x.raw, pol, false)) kill.push(x);
    });
    if (!kill.length) return { text: s, removed: [], ranges: [] };

    var merged = mergeRanges(kill), out = "", pos = 0, removed = [];
    var rep = opts.replacement || "";
    if (!rep) merged.forEach(function (r) { while (r.end < s.length && ".,;:!?".indexOf(s.charAt(r.end)) !== -1) r.end++; });
    merged.forEach(function (r) {
      out += s.slice(pos, r.start) + rep;
      pos = r.end;
      removed.push(s.slice(r.start, r.end));
    });
    out += s.slice(pos);
    if (!rep) out = out.replace(/ {2,}/g, " ");
    return { text: out, removed: removed, ranges: merged };
  }

  /* For showing stored text: links that aren't allowed become "[link removed]" */
  function clean(text, policyName) {
    if (text == null) return "";
    return sanitize(String(text), policyName || "none", { replacement: "[link removed]" }).text;
  }

  /* For href attributes: returns the link if it is allowed, otherwise "" */
  function safeHref(url, policyName) {
    var v = String(url == null ? "" : url).trim();
    if (!v) return "";
    var pol = getPolicy(policyName);
    return analyse(v, pol, false) ? v : "";
  }


  /* ---------------- 5b. Protect links rendered from remote data ----------------
     Frontend input filtering is not a security boundary: messages/listings can be
     inserted by scripts or submitted directly to an API. Re-check every rendered
     anchor and turn unsupported URLs into visibly labelled, non-clickable text. */
  function installRenderedLinkGuard() {
    if (document.getElementById("sh-unsupported-link-style")) return;
    var style = document.createElement("style");
    style.id = "sh-unsupported-link-style";
    style.textContent =
      ".sh-unsupported-link{display:inline!important;max-width:100%;overflow-wrap:anywhere;" +
      "color:#ffd0d5!important;background:rgba(255,86,105,.10);border:1px solid rgba(255,107,129,.48);" +
      "border-radius:7px;padding:2px 6px;font-size:.92em;cursor:not-allowed;white-space:normal}" +
      ".sh-unsupported-link-tag{display:inline-block;margin-left:5px;color:#ffb4bd;font-size:.76em;" +
      "font-weight:700;letter-spacing:.01em;vertical-align:middle}";
    (document.head || document.documentElement).appendChild(style);

    function protect(root) {
      if (!root || root.nodeType !== 1) return;
      var links = [];
      if (root.matches && root.matches("a[href]")) links.push(root);
      if (root.querySelectorAll) {
        var found = root.querySelectorAll("a[href]");
        for (var i = 0; i < found.length; i++) links.push(found[i]);
      }
      links.forEach(function (a) {
        if (!a || a.dataset.shLinkChecked === "1") return;
        var raw = a.getAttribute("href") || "";
        if (!/^(https?:)?\/\//i.test(raw) && !/^(mailto:|tel:|tg:|whatsapp:|skype:)/i.test(raw)) {
          /* Non-web anchors such as #section are not external links. */
          if (raw.charAt(0) === "#" || raw.charAt(0) === "/" || raw.charAt(0) === ".") {
            a.dataset.shLinkChecked = "1";
            return;
          }
        }
        a.dataset.shLinkChecked = "1";
        if (safeHref(raw, "all")) {
          if (/^https?:/i.test(raw)) {
            a.setAttribute("rel", "noopener noreferrer nofollow");
            if (a.target === "_blank") a.setAttribute("referrerpolicy", "no-referrer");
          }
          return;
        }
        var span = document.createElement("span");
        span.className = "sh-unsupported-link";
        span.setAttribute("role", "note");
        span.setAttribute("aria-label", "Unsupported link. It may be malicious or dangerous.");
        span.setAttribute("title", "This link is not supported and may be malicious or dangerous.");
        span.textContent = a.textContent || raw;
        var tag = document.createElement("span");
        tag.className = "sh-unsupported-link-tag";
        tag.textContent = "⚠ Link not supported · may be dangerous";
        span.appendChild(tag);
        if (a.parentNode) a.parentNode.replaceChild(span, a);
      });
    }
    function start() {
      protect(document.body);
      if (window.MutationObserver && document.body) {
        var observer = new MutationObserver(function (records) {
          records.forEach(function (r) {
            for (var i = 0; i < r.addedNodes.length; i++) {
              var node = r.addedNodes[i];
              if (node.nodeType === 1) protect(node);
            }
          });
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }
  installRenderedLinkGuard();

  /* ---------------- 6. Wiring up the text boxes ---------------- */

  var BY_ID = {
    contactInfo: "contact", jobContact: "contact", jobTelegram: "contact", jobWhatsapp: "contact", phone: "contact",
    "f-contact": "contact", "f-telegram": "contact", "f-phone": "contact",
    portfolio: "social", "f-portfolio": "social",
    jobGoogleForm: "googleform", "f-googleForm": "googleform",
    chatInput: "all", messageInput: "all", say: "all",
    "f-seclink": "site", pl: "site"
  };
  var TEXT_TYPES = { "": 1, text: 1, search: 1, url: 1, tel: 1, email: 1 };

  function policyFor(el) {
    if (!el || !el.tagName) return "off";
    var tag = el.tagName.toLowerCase();
    if (tag !== "input" && tag !== "textarea") return "off";
    if (tag === "input" && !TEXT_TYPES[String(el.getAttribute("type") || "").toLowerCase()]) return "off";
    if (el.readOnly || el.disabled) return "off";
    var a = el.getAttribute("data-link-policy");
    if (a) return DEFS[a] ? a : (a === "off" ? "off" : "none");
    if (el.id && BY_ID[el.id]) return BY_ID[el.id];
    return "none";
  }

  /* small notice next to the box */
  var toast = null, toastTimer = 0, lastNote = 0;
  function ensureStyle() {
    if (document.getElementById("sh-lg-style")) return;
    var st = document.createElement("style");
    st.id = "sh-lg-style";
    st.textContent =
      "#sh-lg-toast{position:fixed;z-index:2147483000;max-width:min(320px,calc(100vw - 16px));padding:9px 12px;border-radius:12px;" +
      "font:600 12.5px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#fff;background:rgba(20,22,38,.94);" +
      "border:1px solid rgba(255,107,129,.65);box-shadow:0 8px 28px rgba(0,0,0,.45);opacity:0;transform:translateY(4px);" +
      "transition:opacity .18s ease,transform .18s ease;pointer-events:none}" +
      "#sh-lg-toast.on{opacity:1;transform:none}" +
      ".sh-lg-flash{outline:2px solid rgba(255,107,129,.9)!important;outline-offset:1px}";
    (document.head || document.documentElement).appendChild(st);
  }
  function notify(el, msg) {
    try {
      var now = Date.now();
      if (now - lastNote < 900) return;
      lastNote = now;
      ensureStyle();
      if (!toast) { toast = document.createElement("div"); toast.id = "sh-lg-toast"; toast.setAttribute("role", "status"); toast.setAttribute("aria-live", "polite"); document.body.appendChild(toast); }
      toast.textContent = "🛡️ " + msg;
      toast.classList.add("on");
      var r = el.getBoundingClientRect(), w = toast.offsetWidth, h = toast.offsetHeight;
      var left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      var top = r.top - h - 8;
      if (top < 8) top = Math.min(r.bottom + 8, window.innerHeight - h - 8);
      if (!r.width && !r.height) { left = Math.max(8, (window.innerWidth - w) / 2); top = window.innerHeight - h - 90; }
      toast.style.left = left + "px";
      toast.style.top = top + "px";
      el.classList.add("sh-lg-flash");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove("on"); el.classList.remove("sh-lg-flash"); }, 4200);
    } catch (e) {}
  }

  var lastLen = (typeof WeakMap === "function") ? new WeakMap() : null;

  function caretAfter(ranges, caret, newLen) {
    var c = caret;
    ranges.forEach(function (r) {
      if (r.end <= caret) c -= (r.end - r.start);
      else if (r.start < caret) c -= (caret - r.start);
    });
    return Math.max(0, Math.min(c, newLen));
  }

  function apply(el, typing) {
    var pol = policyFor(el);
    if (pol === "off") return true;
    var before = el.value, res = sanitize(before, pol, { typing: typing });
    if (res.text === before) { if (lastLen) lastLen.set(el, before.length); return true; }
    var caret = null;
    try { caret = el.selectionStart; } catch (e) {}
    el.value = res.text;
    try {
      if (caret !== null && document.activeElement === el) {
        var pos = (res.ranges && res.ranges.length && caret < before.length) ? caretAfter(res.ranges, caret, res.text.length) : res.text.length;
        el.setSelectionRange(pos, pos);
      }
    } catch (e) {}
    if (lastLen) lastLen.set(el, res.text.length);
    if (res.removed.length) { notify(el, getPolicy(pol).msg); return false; }
    return true;
  }

  function onInput(e) {
    var el = e.target;
    if (policyFor(el) === "off" || e.isComposing) return;
    var prev = lastLen ? (lastLen.get(el) || 0) : 0;
    var it = String(e.inputType || "");
    var pasteLike = /paste|drop|yank|replacement/i.test(it);
    var typing = !pasteLike && Math.abs(el.value.length - prev) <= 3;
    apply(el, typing);
  }
  function onBlur(e) { if (policyFor(e.target) !== "off") apply(e.target, false); }
  function onSubmit(e) {
    var f = e.target, bad = null, i;
    if (!f || !f.elements) return;
    for (i = 0; i < f.elements.length; i++) {
      var el = f.elements[i];
      if (policyFor(el) !== "off" && !apply(el, false) && !bad) bad = el;
    }
    if (bad) { e.preventDefault(); e.stopImmediatePropagation(); try { bad.focus(); } catch (x) {} }
  }
  /* Enter in a chat box: check first, send only if clean */
  function onKey(e) {
    if (e.key !== "Enter" || e.shiftKey) return;
    var el = e.target;
    if (policyFor(el) === "off") return;
    if (!apply(el, false)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }

  function checkField(el) { return apply(el, false); }
  function checkAll(root) {
    var ok = true, list = (root || document).querySelectorAll("input,textarea"), i;
    for (i = 0; i < list.length; i++) if (policyFor(list[i]) !== "off" && !apply(list[i], false)) ok = false;
    return ok;
  }

  document.addEventListener("input", onInput, true);
  document.addEventListener("compositionend", function (e) { if (policyFor(e.target) !== "off") apply(e.target, true); }, true);
  document.addEventListener("focusout", onBlur, true);
  document.addEventListener("change", onBlur, true);
  document.addEventListener("submit", onSubmit, true);
  document.addEventListener("keydown", onKey, true);

  window.ServiceHubLinkGuard = {
    version: "1.0",
    sanitize: sanitize, clean: clean, safeHref: safeHref,
    isAllowed: function (url, policy) { return !!safeHref(url, policy); },
    checkField: checkField, checkAll: checkAll, policyFor: policyFor,
    policyMessage: function (p) { return getPolicy(p).msg; },
    allowedDomains: function (p) { return getPolicy(p).domains.slice(); }
  };
})();
