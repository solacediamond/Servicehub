/* Share links look like  https://servicehub-amber.vercel.app/s/SH-001
 *
 *  - Preview bots (WhatsApp, Facebook, X, Telegram, iMessage, ...) get a tiny page that
 *    carries that card's title, description and photo, so the link shows a real preview.
 *  - Everyone else is sent straight to the normal card page (service.html?service=ID).
 *
 * Only public details are used (title, provider, price, short description, photo), and
 * only for approved service listings. Anything else gets the generic ServiceHub preview. */
const { ORIGIN, esc, fetchPublicListing } = require("./_lib");

const BOT_RE = /(facebookexternalhit|facebot|whatsapp|twitterbot|telegrambot|slackbot|slack-imgproxy|linkedinbot|discordbot|pinterest|skypeuripreview|applebot|vkshare|redditbot|embedly|quora link preview|tumblr|bitlybot|googlebot|google-inspectiontool|bingbot|bingpreview|line-poker|kakaotalk|snapchat|viber|mastodon|iframely|opengraph|signal|curl\/|wget\/)/i;

function getId(req) {
  const q = req.query || {};
  let id = q.service || q.id;
  if (Array.isArray(id)) id = id[0];
  if (!id) {
    try {
      const u = new URL(req.url || "", "http://x");
      id = u.searchParams.get("service") || u.searchParams.get("id");
      if (!id) {
        const m = u.pathname.match(/^\/s\/([^/]+)/);
        if (m) id = decodeURIComponent(m[1]);
      }
    } catch (_) { /* no id */ }
  }
  return String(id || "").trim();
}

function snippet(text, max) {
  const clean = String(text || "")
    .replace(/<(?:br|\/p|\/div|\/li)[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

function previewPage(m) {
  const tags = [
    '<meta name="description" content="' + esc(m.desc) + '">',
    '<link rel="canonical" href="' + esc(m.pageUrl) + '">',
    '<meta property="og:site_name" content="ServiceHub">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="' + esc(m.title) + '">',
    '<meta property="og:description" content="' + esc(m.desc) + '">',
    '<meta property="og:url" content="' + esc(m.pageUrl) + '">',
    '<meta property="og:image" content="' + esc(m.image) + '">',
    '<meta property="og:image:alt" content="' + esc(m.imageAlt) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + esc(m.title) + '">',
    '<meta name="twitter:description" content="' + esc(m.desc) + '">',
    '<meta name="twitter:image" content="' + esc(m.image) + '">'
  ].map((t) => "  " + t).join("\n");

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <meta name="theme-color" content="#080b12">\n' +
    "  <title>" + esc(m.title) + "</title>\n" +
    tags + "\n" +
    "  <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080b12;color:#f3f6fa;font-family:Arial,sans-serif;text-align:center}a{color:#2388ff}</style>\n" +
    "</head>\n<body>\n" +
    '  <p>Opening ServiceHub… <a href="' + esc(m.target) + '">Tap here if nothing happens</a></p>\n' +
    "  <script>location.replace(" + JSON.stringify(m.target).replace(/</g, "\\u003c") + ");</script>\n" +
    "</body>\n</html>\n";
}

module.exports = async function handler(req, res) {
  const id = getId(req);
  const validId = /^[A-Za-z0-9_-]{1,64}$/.test(id);
  const target = validId ? "/service.html?service=" + encodeURIComponent(id) : "/explore.html";

  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "User-Agent");

  try {
    const ua = String((req.headers && req.headers["user-agent"]) || "");

    // People: go straight to the real card page. No waiting, no lookup.
    if (!BOT_RE.test(ua)) {
      res.statusCode = 302;
      res.setHeader("Location", target);
      res.end();
      return;
    }

    // Preview bots: build the preview.
    const listing = validId ? await fetchPublicListing(id) : null;
    const pageUrl = validId ? ORIGIN + "/s/" + encodeURIComponent(id) : ORIGIN + "/";
    let model;

    if (listing) {
      const parts = [];
      if (listing.price) parts.push("From " + listing.price);
      if (listing.category && listing.category.toLowerCase() !== listing.title.toLowerCase()) parts.push(listing.category);
      if (listing.provider) parts.push("by " + listing.provider);
      let desc = parts.join(" · ");
      const about = snippet(listing.about, 150);
      if (about) desc += (desc ? " — " : "") + about;
      if (!desc) desc = "Discover skilled people, businesses and professionals on ServiceHub.";

      model = {
        title: listing.title + " · ServiceHub",
        desc: desc,
        pageUrl: pageUrl,
        target: target,
        image: listing.imageId
          ? ORIGIN + "/api/og-image?id=" + encodeURIComponent(listing.imageId)
          : ORIGIN + "/og-default.jpg",
        imageAlt: listing.title
      };
    } else {
      model = {
        title: "ServiceHub",
        desc: "Discover skilled people, businesses and professionals offering the services you need.",
        pageUrl: pageUrl,
        target: target,
        image: ORIGIN + "/og-default.jpg",
        imageAlt: "ServiceHub"
      };
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(req.method === "HEAD" ? undefined : previewPage(model));
  } catch (_) {
    res.statusCode = 302;
    res.setHeader("Location", target);
    res.end();
  }
};
