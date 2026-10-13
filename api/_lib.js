/* Shared helpers for the link-preview functions.
 * Files that start with "_" inside /api are NOT turned into web addresses. */
const fs = require("fs");
const path = require("path");

/* The public address used inside previews. Change it here (or set a SITE_ORIGIN
 * environment variable in Vercel) if you ever move to your own domain. */
const ORIGIN = (process.env.SITE_ORIGIN || "https://servicehub-amber.vercel.app").replace(/\/$/, "");

/* ---------- Apps Script address ---------- */
let cachedBase = "";

function parseBase(text) {
  const m = String(text).match(/SERVICEHUB_APPS_SCRIPT_URL\s*=\s*["']([^"']+)["']/);
  return m ? m[1] : "";
}

async function appsScriptUrl() {
  if (cachedBase) return cachedBase;
  if (process.env.SERVICEHUB_APPS_SCRIPT_URL) return (cachedBase = process.env.SERVICEHUB_APPS_SCRIPT_URL);

  // 1) the file bundled with the function (literal paths so Vercel includes it)
  const attempts = [
    () => fs.readFileSync(path.join(__dirname, "..", "backend-config.js"), "utf8"),
    () => fs.readFileSync(path.join(process.cwd(), "backend-config.js"), "utf8")
  ];
  for (const read of attempts) {
    try {
      const base = parseBase(read());
      if (base) return (cachedBase = base);
    } catch (_) { /* try the next way */ }
  }

  // 2) fall back to downloading the same public file from the site
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(ORIGIN + "/backend-config.js", { signal: ctrl.signal });
    clearTimeout(timer);
    const base = parseBase(await r.text());
    if (base) return (cachedBase = base);
  } catch (_) { /* give up */ }
  return "";
}

/* ---------- small helpers ---------- */
function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseMaybeJSON(value, fallback) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

const SYMBOLS = {
  NGN: "₦", USD: "$", GBP: "£", EUR: "€", GHS: "₵", KES: "KSh ", ZAR: "R", CAD: "C$",
  AUD: "A$", NZD: "NZ$", INR: "₹", JPY: "¥", CNY: "¥", AED: "د.إ ", SAR: "﷼ ",
  XOF: "CFA ", XAF: "FCFA "
};

function formatPrice(price, currency) {
  if (price === null || price === undefined || String(price).trim() === "") return "";
  const code = String(currency || "NGN").trim().toUpperCase();
  const sym = SYMBOLS[code] || (code + " ");
  const n = Number(price);
  if (!Number.isNaN(n)) {
    const locale = code === "USD" ? "en-US" : code === "GBP" ? "en-GB" : code === "EUR" ? "de-DE" : code === "INR" ? "en-IN" : "en-NG";
    return sym + n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return sym + String(price);
}

function driveIdFrom(item) {
  if (!item) return "";
  if (typeof item === "string") item = { url: item };
  const direct = item.driveId || item.fileId || item.id;
  if (direct && /^[A-Za-z0-9_-]{10,120}$/.test(String(direct))) return String(direct);
  const url = String(item.previewUrl || item.url || "");
  let m = url.match(/[?&]id=([A-Za-z0-9_-]{10,120})/);
  if (m) return m[1];
  m = url.match(/\/d\/([A-Za-z0-9_-]{10,120})/);
  return m ? m[1] : "";
}

/* ---------- listing lookup (public fields of approved services only) ---------- */
const memory = new Map(); // remembers results for 5 minutes so repeat requests are fast
const MEMORY_MS = 5 * 60 * 1000;

async function fetchPublicListing(id) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;

  const key = id.toLowerCase();
  const hit = memory.get(key);
  if (hit && Date.now() - hit.t < MEMORY_MS) return hit.v;

  const base = await appsScriptUrl();
  if (!base) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(base + "?action=getListing&listingId=" + encodeURIComponent(id), {
      redirect: "follow",
      signal: ctrl.signal
    });
    const data = JSON.parse(await res.text());
    if (!data || data.success === false) return null;
    const listing = data.listing || data.data;
    if (!listing || typeof listing !== "object") return null;

    const get = (...keys) => {
      for (const k of keys) {
        const v = listing[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
      return "";
    };

    const status = String(data.status || get("status", "Status")).toLowerCase();
    const type = String(get("listingType", "Listing Type", "type") || "service").toLowerCase();
    if (status !== "approved" || type === "job") return null;

    const gotId = String(get("listingId", "Listing ID", "id", "ID"));
    if (gotId && gotId.toLowerCase() !== key) return null;

    const media = parseMaybeJSON(get("media", "Media"), []);
    const firstImage = (Array.isArray(media) ? media : []).find((m) => {
      if (!m || typeof m !== "object") return false;
      const t = String(m.type || m.mimeType || "").toLowerCase();
      return t.indexOf("image/") === 0 && driveIdFrom(m);
    });

    const value = {
      title: String(get("serviceName", "Service Name", "service", "Service") || "Service"),
      provider: String(get("providerName", "Provider Name", "name", "provider") || ""),
      category: String(get("category", "Category") || ""),
      about: String(get("about", "About", "description", "Description") || ""),
      price: formatPrice(get("price", "Price", "startingPrice", "Starting Price"), get("currency", "Currency")),
      imageId: firstImage ? driveIdFrom(firstImage) : ""
    };
    if (memory.size > 200) memory.clear();
    memory.set(key, { t: Date.now(), v: value });
    return value;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { ORIGIN, esc, fetchPublicListing };
