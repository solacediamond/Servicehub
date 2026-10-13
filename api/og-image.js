/* Serves a listing's first photo for link previews.
 * It only ever fetches Google Drive thumbnails by file id, so it cannot be used to
 * reach other websites. If the photo can't be loaded, the default ServiceHub
 * preview image is returned instead. */
const fs = require("fs");
const path = require("path");
const { ORIGIN } = require("./_lib");

const MAX_BYTES = 400 * 1024; // WhatsApp ignores big preview images, so keep them small

async function tryThumbnail(id, width) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch("https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w" + width, {
      redirect: "follow",
      signal: ctrl.signal
    });
    const type = String(r.headers.get("content-type") || "").toLowerCase();
    if (!r.ok || type.indexOf("image/") !== 0) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > 4 * 1024 * 1024) return null;
    return { buf, type };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function readDefaultImage() {
  const attempts = [
    () => fs.readFileSync(path.join(__dirname, "..", "og-default.jpg")),
    () => fs.readFileSync(path.join(process.cwd(), "og-default.jpg"))
  ];
  for (const read of attempts) {
    try { return read(); } catch (_) { /* try next */ }
  }
  return null;
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url || "", "http://x");
  const id = String(url.searchParams.get("id") || "");

  let img = null;
  if (/^[A-Za-z0-9_-]{10,120}$/.test(id)) {
    img = await tryThumbnail(id, 800);
    if (img && img.buf.length > MAX_BYTES) {
      const smaller = await tryThumbnail(id, 600);
      if (smaller && smaller.buf.length < img.buf.length) img = smaller;
    }
  }

  if (img) {
    res.statusCode = 200;
    res.setHeader("Content-Type", img.type);
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
    res.end(img.buf);
    return;
  }

  const fallback = readDefaultImage();
  if (fallback) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
    res.end(fallback);
    return;
  }

  // Last resort: point at the copy served as a normal file.
  res.statusCode = 302;
  res.setHeader("Location", ORIGIN + "/og-default.jpg");
  res.end();
};
