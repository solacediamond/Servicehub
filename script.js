/* =================================
   SERVICEHUB JAVASCRIPT
================================= */

/* =================================
   SERVICEHUB CONFIG
   (previously in backend-config.js —
   now inlined here directly)
================================= */

window.SERVICEHUB_BACKEND_URL = "";
window.SERVICEHUB_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyshp8ls2f-PTWGBaHveiAjDhhuOVxUhcdNjw7OWPVSfLyhSIwNAG4eGerwTH5SktRi/exec";


/* Keep existing diagnostic calls harmless without adding any visible UI. */
window.serviceHubDebug = window.serviceHubDebug || {
    addLog: function () {},
    test: function () {}
};

window.SERVICEHUB_BANK_DETAILS = {
    bankName: "Moniepoint",
    accountNumber: "5302022430",
    accountName: "SOLACE OGHENEKPAROBOR UNUOVO"
};


/* =================================
   SERVICEHUB BACKEND CONNECTION
================================= */

async function sendToServiceHubBackend(route, payload) {

    const baseUrl = window.SERVICEHUB_BACKEND_URL || "";

    if (!baseUrl) {
        console.log("ServiceHub backend URL is not configured.", payload);
        return { ok: false, offline: true, payload: payload };
    }

    try {
        const response = await fetch(
            baseUrl.replace(/\/$/, "") + "/" + route.replace(/^\//, ""),
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }
        );

        if (!response.ok) {
            throw new Error("Backend returned HTTP " + response.status);
        }

        return {
            ok: true,
            data: await response.json().catch(() => null)
        };

    } catch (error) {
        console.error("ServiceHub backend error:", error);
        return { ok: false, error: error };
    }

}



/* =================================
   GOOGLE APPS SCRIPT CONNECTION
   Listings + payment approval backend
================================= */

function getAppsScriptUrl() {
    return String(window.SERVICEHUB_APPS_SCRIPT_URL || "").replace(/\/$/, "");
}

async function callServiceHubAppsScript(action, params) {
    const baseUrl = getAppsScriptUrl();
    if (!baseUrl) {
        throw new Error("Apps Script URL is not configured.");
    }

    const query = new URLSearchParams();
    query.set("action", action);

    Object.keys(params || {}).forEach(function (key) {
        const value = params[key];
        if (value !== undefined && value !== null) {
            query.set(key, String(value));
        }
    });

    const url = baseUrl + "?" + query.toString() + "&_=" + Date.now();

    try {
        /*
         * The supplied Code.gs reads GET values from e.parameter.
         * Do not send this through /apps-script: that route only exists
         * inside server.js and is the reason the editor preview returned
         * "Error 404, file not found".
         */
        const response = await fetch(url, {
            method: "GET",
            redirect: "follow",
            cache: "no-store",
            mode: "cors"
        });

        const text = await response.text();
        let data;

        try {
            data = JSON.parse(text);
        } catch (_) {
            throw new Error(
                "Apps Script returned a non-JSON response: " + text.slice(0, 300)
            );
        }

        if (!response.ok) {
            throw new Error(
                (data && (data.error || data.message)) ||
                ("HTTP " + response.status)
            );
        }

        if (data && data.success === false) {
            throw new Error(
                data.error || data.message || "Apps Script request failed."
            );
        }

        return data;

    } catch (error) {
        /* Give a useful message instead of the old local /apps-script 404. */
        const message = String(error && error.message || error);
        if (/failed to fetch|networkerror|cors/i.test(message)) {
            throw new Error(
                "The Apps Script Web App could not be read directly by this browser. " +
                "The request URL is correct, but browser cross-origin access may be blocking the response. " +
                "This is separate from the old localhost /apps-script 404."
            );
        }
        throw error;
    }
}

/*
   Helpers for building the Apps Script listing payload.
*/
async function generateServiceHubListingId() {
    const data = await callServiceHubAppsScript("getNextListingId", {});
    const listingId = String(data.listingId || data.id || "").trim();

    if (!/^SH-\d+$/i.test(listingId)) {
        throw new Error("Apps Script returned an invalid Listing ID.");
    }

    return listingId.toUpperCase();
}

function slugifyServiceHubProvider(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 40);
}

function parseServiceHubAmount(value) {
    const cleaned = String(value == null ? "" : value).replace(/[^0-9.]/g, "");
    if (!cleaned) return "";
    const n = Number(cleaned);
    return isFinite(n) ? n : "";
}

/*
   Creates a listing in Google Apps Script.
   The browser proposes a Listing ID; Apps Script stores the row, generates
   the unique 6-character payment code and returns both (Apps Script has the
   final say on the ID if there is ever a collision).
*/
async function postToExistingAppsScript(payload) {
    const baseUrl = getAppsScriptUrl();
    if (!baseUrl) {
        throw new Error("Apps Script URL is not configured.");
    }

    try {
        /*
         * The supplied Code.gs does:
         *   JSON.parse(e.postData.contents)
         * so the request body must remain raw JSON.
         *
         * text/plain is intentionally used instead of application/json.
         * application/json can trigger a browser CORS preflight before
         * Apps Script ever reaches doPost(). text/plain keeps the POST a
         * simple request while e.postData.contents is still the JSON text
         * that Code.gs expects.
         */
        const response = await fetch(baseUrl, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=UTF-8"
            },
            body: JSON.stringify(payload),
            redirect: "follow",
            cache: "no-store",
            mode: "cors"
        });

        const text = await response.text();
        let data;

        try {
            data = JSON.parse(text);
        } catch (_) {
            throw new Error(
                "Apps Script returned a non-JSON response: " + text.slice(0, 300)
            );
        }

        if (!response.ok) {
            throw new Error(
                (data && (data.error || data.message)) ||
                ("HTTP " + response.status)
            );
        }

        if (data && data.success === false) {
            throw new Error(
                data.error || data.message || "Apps Script request failed."
            );
        }

        return data;

    } catch (error) {
        const message = String(error && error.message || error);
        if (/failed to fetch|networkerror|cors/i.test(message)) {
            throw new Error(
                "The listing could not read the Apps Script response from this browser. " +
                "The POST is now sent to the exact doPost() endpoint, but browser cross-origin " +
                "access may still be blocking the response."
            );
        }
        throw error;
    }
}

function parseAppsScriptMediaValue(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return [value];
    if (typeof value !== "string" || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

async function waitForAppsScriptListing(listingId, predicate, timeoutMs) {
    const timeout = Number(timeoutMs || 45000);
    const started = Date.now();
    let lastError = null;

    while ((Date.now() - started) < timeout) {
        try {
            const result = await fetchAppsScriptListing(listingId);
            if (result.ok && result.listing) {
                if (!predicate || predicate(result.listing)) return result;
            }
        } catch (error) {
            lastError = error;
        }

        await new Promise(function (resolve) {
            setTimeout(resolve, 1800);
        });
    }

    throw lastError || new Error("Apps Script did not confirm the requested operation in time.");
}

/*
   Creates a listing using the exact fields consumed by the supplied
   createListingWithPaymentCode() function. The frontend generates the ID,
   then Apps Script creates the row and owns the payment code.
*/
async function createAppsScriptListing(listingData) {
    const baseUrl = getAppsScriptUrl();
    if (!baseUrl) return { ok: false, offline: true };

    const listingId = String(listingData.listingId || await generateServiceHubListingId());
    const providerId = slugifyServiceHubProvider(
        listingData.company || listingData.name
    );

    const payload = {
        action: "createListing",
        listingId: listingId,
        providerId: providerId,
        serviceName: listingData.service || "",
        price: parseServiceHubAmount(listingData.startingPrice),

        /* Extra fields are retained in the request for compatibility with
           existing frontend data, but the supplied backend only requires the
           four fields above when creating the sheet row. */
        providerName: listingData.name || "",
        company: listingData.company || "",
        contact: listingData.contact || "",
        phone: listingData.phone || "",
        whatsapp: listingData.phone || "",
        about: listingData.about || "",
        portfolio: listingData.portfolio || "",
        category: listingData.service || "",
        pricingRank: listingData.pricing || "",
        customPricing: JSON.stringify(listingData.customPricing || [])
    };

    try {
        const createResponse = await postToExistingAppsScript(payload);
        const actualListingId = String(
            createResponse.listingId ||
            createResponse.id ||
            listingId
        ).trim();

        const confirmed = await waitForAppsScriptListing(
            actualListingId,
            function () { return true; },
            45000
        );

        const listing = confirmed.listing || {};
        const code =
            confirmed.code ||
            listing.paymentCode ||
            listing["Payment Code"] ||
            "";

        if (!code) {
            throw new Error("Apps Script created the listing but did not expose its payment code yet.");
        }

        return {
            ok: true,
            id: actualListingId,
            code: String(code),
            listing: listing
        };
    } catch (error) {
        console.error("Apps Script createListing error:", error);
        return { ok: false, error: error };
    }
}


/*
   Recovers a listing and its payment code from Apps Script.
*/
async function fetchAppsScriptListing(listingId) {
    if (!listingId) return { ok: false };

    try {
        const data = await callServiceHubAppsScript("getListing", {
            listingId: listingId
        });

        const listing = data.listing || data.data || {};
        const code =
            data.paymentCode ||
            data.code ||
            listing.paymentCode ||
            listing["Payment Code"] ||
            listing.code ||
            "";

        return {
            ok: data.success !== false && !!listing,
            listing: listing,
            code: code,
            status: data.status || listing.status || listing.Status || ""
        };
    } catch (error) {
        console.error("Apps Script getListing error:", error);
        return { ok: false, error: error };
    }
}


/*
   Checks ONE specific listing against ONE specific payment code.
   This endpoint only reads approval state. It never approves a payment.
*/
async function checkAppsScriptPayment(listingId, paymentCode) {
    if (!listingId || !paymentCode) {
        return { ok: false, status: "not_found" };
    }

    try {
        const data = await callServiceHubAppsScript("checkPayment", {
            listingId: listingId,
            code: paymentCode,
            paymentCode: paymentCode
        });

        return {
            ok: data.success !== false,
            status: String(data.status || "pending").toLowerCase(),
            listingId: data.listingId || listingId,
            approvedAt: data.approvedAt || null
        };
    } catch (error) {
        console.error("Apps Script payment check error:", error);
        return {
            ok: false,
            status: "error",
            error: error
        };
    }
}

function escapeServiceHubText(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
}


function addServiceHubCardToPage(cardData, cardId) {

    const containers = [
        document.getElementById("featuredServices"),
        document.getElementById("exploreGrid")
    ].filter(Boolean);

    containers.forEach(function (container) {

        if (container.querySelector('[data-backend-card-id="' + CSS.escape(String(cardId)) + '"]')) {
            return;
        }

        const card = document.createElement("a");
        card.href = "service.html?service=" + encodeURIComponent(cardId);
        card.className = "service-card";
        card.setAttribute("data-backend-card-id", cardId);

        const media = Array.isArray(cardData.media) ? cardData.media : [];
        const firstImage = media.find(function (item) {
            const type = String(item && (item.type || item.mimeType || "")).toLowerCase();
            return type.indexOf("image/") === 0 && (item.previewUrl || item.url);
        });
        const firstVideo = media.find(function (item) {
            const type = String(item && (item.type || item.mimeType || "")).toLowerCase();
            return type.indexOf("video/") === 0 && (item.previewUrl || item.url);
        });

        let imageHTML = '<span>' + escapeServiceHubText(cardData.title) + '</span>';
        if (firstImage) {
            imageHTML = '<img class="service-card-media" src="' + escapeServiceHubAttribute(firstImage.previewUrl || firstImage.url) + '" alt="' + escapeServiceHubAttribute(cardData.title) + '" loading="lazy">';
        } else if (firstVideo) {
            imageHTML = '<video class="service-card-media" src="' + escapeServiceHubAttribute(firstVideo.previewUrl || firstVideo.url) + '" muted playsinline preload="metadata"></video>';
        }

        card.innerHTML = `
            <div class="service-image">
                ${imageHTML}
            </div>
            <div class="service-info">
                <p class="service-category">
                    ${escapeServiceHubText(cardData.category || "SERVICE")}
                </p>
                <h3>${escapeServiceHubText(cardData.title)}</h3>
                <p class="provider">${escapeServiceHubText(cardData.provider)}</p>
                <div class="service-bottom">
                    <span>⭐ ${escapeServiceHubText(cardData.rating)}</span>
                    <strong>From ${escapeServiceHubText(cardData.price)}</strong>
                </div>
            </div>
        `;

        container.prepend(card);
    });

}


// Turns a listing (from the legacy Node backend OR a legacy backend row) into a
// card and adds it to whichever containers exist on the current page
// (the homepage's featured strip and/or the Explore grid).
function storeServiceHubCard(card) {

    if (!card || !card.id) return;

    const cards = JSON.parse(
        localStorage.getItem("serviceHubBackendCards") || "{}"
    );

    cards[card.id] = {
        image: "SERVICE",
        category: card.category || "SERVICE",
        title: card.title || "Service",
        provider: card.provider || "Provider",
        company: card.company || "",
        rating: card.rating || "New",
        reviews: String(card.reviews || 0) + " reviews",
        description: card.about || "",
        about: card.about || "",
        price: card.price || "Contact provider",
        portfolio: card.portfolio || "",
        contact: card.contact || "",
        phone: card.phone || "",
        whatsapp: card.whatsapp || card.phone || "",
        pricing: card.pricing || [],
        customPricing: card.customPricing || [],
        media: card.media || [],
        included: []
    };

    localStorage.setItem(
        "serviceHubBackendCards",
        JSON.stringify(cards)
    );

    addServiceHubCardToPage(cards[card.id], card.id);

}




// Maps a legacy backend "listings" row (snake_case columns) into the same
// card shape used above.
function mapLegacyBackendListingToCard(row) {

    return {
        id: row.id,
        title: row.service,
        provider: row.name,
        company: row.company,
        contact: row.contact,
        phone: row.phone,
        portfolio: row.portfolio,
        about: row.about,
        category: row.service,
        rating: row.rating || "New",
        reviews: row.reviews || 0,
        price: row.starting_price ? ("₦" + row.starting_price) : "Contact provider",
        pricing: row.pricing || [],
        customPricing: row.custom_pricing || [],
        media: row.media || []
    };

}



/* =================================
   RECONCILE PUBLISHED CARDS
   (removes any locally-cached card
   whose listing is no longer
   "approved" in legacy backend, e.g. an
   admin flipped it back to pending)
================================= */

async function reconcileServiceHubCards() {
    const baseUrl = getAppsScriptUrl();
    if (!baseUrl) return;

    try {
        const data = await callServiceHubAppsScript("getListings", {});
        const listings = Array.isArray(data.listings) ? data.listings : [];

        const approvedListings = listings.filter(function (listing) {
            return String(
                listing.status ||
                listing.Status ||
                ""
            ).toLowerCase() === "approved";
        });

        const approvedIds = new Set();

        approvedListings.forEach(function (listing) {
            const card = mapAppsScriptListingToCard(listing);
            if (!card.id) return;

            approvedIds.add(String(card.id));
            storeServiceHubCard(card);
        });

        const cards = JSON.parse(
            localStorage.getItem("serviceHubBackendCards") || "{}"
        );

        let changed = false;

        Object.keys(cards).forEach(function (cardId) {
            if (!approvedIds.has(String(cardId))) {
                delete cards[cardId];
                changed = true;

                document
                    .querySelectorAll(
                        '[data-backend-card-id="' +
                        CSS.escape(cardId) +
                        '"]'
                    )
                    .forEach(function (el) {
                        el.remove();
                    });
            }
        });

        if (changed) {
            localStorage.setItem(
                "serviceHubBackendCards",
                JSON.stringify(cards)
            );
        }

        window.serviceHubDebug && window.serviceHubDebug.addLog(
            "OK",
            "Marketplace sync completed",
            "Approved listings: " + approvedListings.length
        );

    } catch (error) {
        console.warn("Apps Script marketplace sync failed:", error);
        window.serviceHubDebug && window.serviceHubDebug.addLog(
            "ERROR",
            "Marketplace sync failed",
            error
        );
    }
}
function escapeServiceHubAttribute(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
function renderServiceMedia(selectedService) {

    const section =
        document.getElementById(
            "serviceMediaSection"
        );

    const gallery =
        document.getElementById(
            "serviceMediaGallery"
        );

    if (!section || !gallery) {
        return;
    }

    const media =
        Array.isArray(selectedService.media)
            ? selectedService.media
            : [];

    gallery.innerHTML = "";

    if (!media.length) {
        section.hidden = true;
        return;
    }

    section.hidden = false;

    media.forEach(function(item) {

        if (!item) return;

        const type =
            String(
                item.type ||
                item.mimeType ||
                ""
            ).toLowerCase();

        const name =
            item.name ||
            "Media";

        /*
         * IMAGE
         */
        if (type.indexOf("image/") === 0) {

            const img =
                document.createElement("img");

            img.src =
                item.previewUrl ||
                item.url ||
                "";

            img.alt = name;

            img.loading = "lazy";

            img.className =
                "service-gallery-image";

            gallery.appendChild(img);

            return;
        }

        /*
         * VIDEO
         */
        if (type.indexOf("video/") === 0) {

            const video =
                document.createElement("video");

            video.controls = true;
            video.playsInline = true;
            video.preload = "metadata";

            /*
             * Drive preview is more reliable for
             * marketplace viewing than putting the
             * Drive page itself inside <video>.
             */
            if (item.embedUrl) {

                const iframe =
                    document.createElement("iframe");

                iframe.src =
                    item.embedUrl;

                iframe.loading = "lazy";

                iframe.allow =
                    "autoplay; fullscreen";

                iframe.className =
                    "service-gallery-video";

                gallery.appendChild(iframe);

            } else if (item.url) {

                video.src = item.url;

                gallery.appendChild(video);
            }

            return;
        }

        /*
         * PDF
         */
        if (
            type === "application/pdf" ||
            name.toLowerCase().endsWith(".pdf")
        ) {

            const iframe =
                document.createElement("iframe");

            iframe.src =
                item.embedUrl ||
                item.url ||
                "";

            iframe.loading = "lazy";

            iframe.className =
                "service-gallery-document";

            gallery.appendChild(iframe);

            return;
        }

        /*
         * OTHER FILES
         */
        const link =
            document.createElement("a");

        link.href =
            item.url || "#";

        link.target = "_blank";
        link.rel = "noopener";

        link.textContent =
            "Open " + name;

        link.className =
            "service-media-file";

        gallery.appendChild(link);
    });
}
/*
   Normalises media entries. Supports direct URLs (legacy backend etc.) and
   Google Drive file IDs (turned into thumbnail / preview URLs).
*/
function normalizeServiceHubMedia(list) {
    if (!Array.isArray(list)) return [];

    return list.map(function (item) {
        if (typeof item === "string") {
            item = { url: item };
        }
        if (!item || typeof item !== "object") return null;

        const out = Object.assign({}, item);
        const driveId = out.driveId || out.fileId || out.id || "";

        if (driveId && !out.url) {
            out.url = "https://drive.google.com/uc?export=view&id=" + encodeURIComponent(driveId);
        }
        if (driveId && !out.previewUrl) {
            out.previewUrl = "https://drive.google.com/thumbnail?id=" + encodeURIComponent(driveId) + "&sz=w1000";
        }
        if (driveId && String(out.type || "").indexOf("video/") === 0 && !out.embedUrl) {
            out.embedUrl = "https://drive.google.com/file/d/" + encodeURIComponent(driveId) + "/preview";
        }
        return (out.url || out.previewUrl || out.embedUrl) ? out : null;
    }).filter(Boolean);
}

/*
   Turns a Nigerian/international number into a wa.me link.
*/
function buildServiceHubWhatsAppLink(number) {
    let digits = String(number || "").replace(/[^0-9]/g, "");
    if (!digits) return "";
    if (digits.indexOf("00") === 0) digits = digits.slice(2);
    else if (digits.charAt(0) === "0") digits = "234" + digits.slice(1);
    return "https://wa.me/" + digits;
}

/*
   Maps the Apps Script listing object into the existing card renderer.
   Supports both the Apps Script header names and the older frontend names.
*/
function mapAppsScriptListingToCard(listing) {
    const get = function () {
        for (let i = 0; i < arguments.length; i++) {
            const key = arguments[i];
            if (
                listing[key] !== undefined &&
                listing[key] !== null &&
                listing[key] !== ""
            ) {
                return listing[key];
            }
        }
        return "";
    };

    let pricing = get("pricing", "Pricing");
    let customPricing = get("customPricing", "Custom Pricing", "custom_pricing");
    let media = get("media", "Media");

    function parseMaybeJSON(value, fallback) {
        if (Array.isArray(value)) return value;
        if (typeof value !== "string" || !value.trim()) return fallback;
        try {
            const parsed = JSON.parse(value);
            return parsed;
        } catch (_) {
            return fallback;
        }
    }

    pricing = parseMaybeJSON(pricing, []);
    customPricing = parseMaybeJSON(customPricing, []);
    media = normalizeServiceHubMedia(parseMaybeJSON(media, []));

    const id = get(
        "listingId",
        "Listing ID",
        "id",
        "ID"
    );

    const service = get(
        "serviceName",
        "Service Name",
        "service",
        "Service"
    ) || "Service";

    const provider = get(
        "providerName",
        "Provider Name",
        "name",
        "provider",
        "Provider ID"
    ) || "Provider";

    const price = get(
        "price",
        "Price",
        "startingPrice",
        "Starting Price",
        "starting_price"
    );

    return {
        id: String(id || ""),
        title: service,
        provider: provider,
        company: get("company", "Company", "Company Name"),
        contact: get("contact", "Contact", "Contact Information"),
        phone: get("phone", "Phone", "Phone Number"),
        whatsapp: get("whatsapp", "WhatsApp", "Whatsapp") || get("phone", "Phone", "Phone Number"),
        portfolio: get("portfolio", "Portfolio"),
        about: get("about", "About"),
        category: service,
        rating: get("rating", "Rating") || "New",
        reviews: get("reviews", "Reviews") || 0,
        price: price !== ""
            ? ("₦" + (isNaN(Number(price)) ? price : Number(price).toLocaleString("en-NG")))
            : "Contact provider",
        pricing: pricing,
        customPricing: customPricing,
        media: media
    };
}


/* =================================
   MAIN PAGE FUNCTIONS
================================= */

document.addEventListener("DOMContentLoaded", function () {



    /* ================================
       MOBILE MENU
    ================================= */
document.body.classList.add("menu-open");
    const menuButton = document.querySelector(".menu-btn");
    const navPanel = document.querySelector(".nav-panel");
    const navLinks = document.querySelector(".nav-links");
    const navActions = document.querySelector(".nav-actions");
    const PORTRAIT_PHONE = "(orientation: portrait) and (max-width: 767px)";

    let menuOverlay =
        document.querySelector(".mobile-menu-overlay");


    if (menuButton && (navPanel || (navLinks && navActions))) {

        /* Create the blur/glass backdrop once */

        if (!menuOverlay) {

            menuOverlay =
                document.createElement("div");

            menuOverlay.className =
                "mobile-menu-overlay";

            menuOverlay.setAttribute(
                "aria-hidden",
                "true"
            );

            document.body.appendChild(
                menuOverlay
            );
        }


        function openMobileMenu() {

            if (navPanel) {
                navPanel.classList.add("mobile-open");
            }
            if (navLinks) navLinks.classList.add("mobile-open");
            if (navActions) navActions.classList.add("mobile-open");

            menuButton.classList.add(
                "active"
            );

            menuButton.setAttribute(
                "aria-expanded",
                "true"
            );

            menuOverlay.classList.add(
                "active"
            );

            menuOverlay.setAttribute(
                "aria-hidden",
                "false"
            );

            document.body.classList.add(
                "menu-open"
            );
        }


        function closeMobileMenu() {

            if (navPanel) {
                navPanel.classList.remove("mobile-open");
            }
            if (navLinks) navLinks.classList.remove("mobile-open");
            if (navActions) navActions.classList.remove("mobile-open");

            menuButton.classList.remove(
                "active"
            );

            menuButton.setAttribute(
                "aria-expanded",
                "false"
            );

            menuOverlay.classList.remove(
                "active"
            );

            menuOverlay.setAttribute(
                "aria-hidden",
                "true"
            );

            document.body.classList.remove(
                "menu-open"
            );
        }


        menuButton.setAttribute(
            "aria-expanded",
            "false"
        );


        menuButton.addEventListener(
            "click",
            function () {

                const isOpen =
                    (navPanel && navPanel.classList.contains("mobile-open")) ||
                    (navLinks && navLinks.classList.contains("mobile-open"));

                if (isOpen) {

                    closeMobileMenu();

                } else {

                    openMobileMenu();

                }

            }
        );


        /* Tap outside the menu to close it */

        menuOverlay.addEventListener(
            "click",
            closeMobileMenu
        );


        /* Close after choosing navigation link */

        navLinks
            .querySelectorAll("a")
            .forEach(function (link) {

                link.addEventListener(
                    "click",
                    closeMobileMenu
                );

            });


        /* Escape closes menu */

        document.addEventListener(
            "keydown",
            function (event) {

                if (event.key === "Escape") {

                    closeMobileMenu();

                }

            }
        );

        /* Close the button-menu when leaving portrait-phone mode */
        function closeIfNotPortraitPhone() {
            if (!window.matchMedia(PORTRAIT_PHONE).matches) {
                closeMobileMenu();
            }
        }

        window.matchMedia(PORTRAIT_PHONE).addEventListener(
            "change",
            closeIfNotPortraitPhone
        );
        window.addEventListener("orientationchange", closeIfNotPortraitPhone);
        window.addEventListener("resize", closeIfNotPortraitPhone);

    }

document.body.classList.remove("menu-open");
    /* ================================
       SMART SEARCH
    ================================= */

    const searchInput =
        document.querySelector(
            ".search-box input"
        );

    const searchButton =
        document.querySelector(
            ".search-box button"
        );


    if (searchInput && searchButton) {


        /* Words that don't add much meaning */

        const stopWords = new Set([

            "a",
            "an",
            "the",
            "and",
            "or",
            "to",
            "for",
            "of",
            "in",
            "on",
            "at",
            "with",
            "i",
            "im",
            "me",
            "my",
            "need",
            "want",
            "looking",
            "someone",
            "who",
            "can",
            "do",
            "does",
            "is",
            "are"

        ]);


        /* ---------- NORMALIZE TEXT ---------- */

        function normalizeText(text) {

            return text
                .toLowerCase()
                .replace(/[^\w\s]/g, " ")
                .replace(/\s+/g, " ")
                .trim();

        }


        /* ---------- WORD STEMMING ---------- */

        function stemWord(word) {

            word =
                word.toLowerCase();


            if (
                word.length > 5 &&
                word.endsWith("ing")
            ) {

                word =
                    word.slice(0, -3);

            }

            else if (
                word.length > 4 &&
                word.endsWith("ed")
            ) {

                word =
                    word.slice(0, -2);

            }

            else if (
                word.length > 4 &&
                word.endsWith("er")
            ) {

                word =
                    word.slice(0, -2);

            }

            else if (
                word.length > 4 &&
                word.endsWith("es")
            ) {

                word =
                    word.slice(0, -2);

            }

            else if (
                word.length > 3 &&
                word.endsWith("s")
            ) {

                word =
                    word.slice(0, -1);

            }


            return word;

        }


        /* ---------- GET SEARCH WORDS ---------- */

        function getSearchWords(text) {

            return normalizeText(text)
                .split(" ")
                .filter(function (word) {

                    return (
                        word.length > 1 &&
                        !stopWords.has(word)
                    );

                })
                .map(stemWord);

        }


        /* ---------- LEVENSHTEIN ---------- */

        function levenshteinDistance(a, b) {

            const matrix = [];


            for (
                let i = 0;
                i <= b.length;
                i++
            ) {

                matrix[i] = [i];

            }


            for (
                let j = 0;
                j <= a.length;
                j++
            ) {

                matrix[0][j] = j;

            }


            for (
                let i = 1;
                i <= b.length;
                i++
            ) {

                for (
                    let j = 1;
                    j <= a.length;
                    j++
                ) {

                    if (
                        b.charAt(i - 1) ===
                        a.charAt(j - 1)
                    ) {

                        matrix[i][j] =
                            matrix[i - 1][j - 1];

                    }

                    else {

                        matrix[i][j] =
                            Math.min(

                                matrix[i - 1][j - 1] + 1,

                                matrix[i][j - 1] + 1,

                                matrix[i - 1][j] + 1

                            );

                    }

                }

            }


            return matrix[b.length][a.length];

        }


        /* ---------- SEARCH SCORE ---------- */

        function calculateSearchScore(
            item,
            query
        ) {

            const queryWords =
                getSearchWords(query);


            if (queryWords.length === 0) {

                return 0;

            }


            const itemText =
                normalizeText(
                    item.textContent
                );


            const itemWords =
                itemText
                    .split(" ")
                    .filter(Boolean)
                    .map(stemWord);


            let score = 0;

            let matchedWords = 0;


            queryWords.forEach(
                function (queryWord) {


                    /* Exact match */

                    if (
                        itemWords.includes(
                            queryWord
                        )
                    ) {

                        score += 10;

                        matchedWords++;

                        return;

                    }


                    /* Partial match */

                    const partialMatch =
                        itemWords.some(
                            function (itemWord) {

                                return (
                                    itemWord.startsWith(
                                        queryWord
                                    ) ||
                                    queryWord.startsWith(
                                        itemWord
                                    )
                                );

                            }
                        );


                    if (partialMatch) {

                        score += 6;

                        matchedWords++;

                        return;

                    }


                    /* Fuzzy match */

                    const fuzzyMatch =
                        itemWords.some(
                            function (itemWord) {

                                if (
                                    Math.abs(
                                        itemWord.length -
                                        queryWord.length
                                    ) > 2
                                ) {

                                    return false;

                                }


                                return (
                                    levenshteinDistance(
                                        queryWord,
                                        itemWord
                                    ) <= 2
                                );

                            }
                        );


                    if (fuzzyMatch) {

                        score += 3;

                        matchedWords++;

                    }

                }
            );


            /* Exact phrase bonus */

            const normalizedQuery =
                normalizeText(query);


            if (
                normalizedQuery &&
                itemText.includes(
                    normalizedQuery
                )
            ) {

                score += 15;

            }


            if (matchedWords === 0) {

                return 0;

            }


            return score;

        }


        /* ---------- PERFORM SEARCH ---------- */

        function performSearch() {

            const term =
                searchInput.value.trim();


            if (!term) {

                alert(
                    "Please enter a service you're looking for."
                );

                return;

            }

            /* Smart Search is Explore-only.
               From the homepage, send the query to Explore.
               On Explore, search only the Explore service grid. */
            const isExplorePage =
                window.location.pathname.endsWith("explore.html");

            if (!isExplorePage) {
                window.location.href =
                    "explore.html?search=" + encodeURIComponent(term);
                return;
            }

            const exploreGrid =
                document.getElementById("exploreGrid");

            const items = exploreGrid
                ? Array.from(exploreGrid.querySelectorAll(".service-card"))
                : [];

            const uniqueItems =
                [...new Set(items)];


            const results = [];


            uniqueItems.forEach(
                function (item) {

                    const score =
                        calculateSearchScore(
                            item,
                            term
                        );


                    item.style.outline = "";


                    if (score > 0) {

                        results.push({
                            item: item,
                            score: score
                        });

                    }

                }
            );


            /* ---------- NO RESULTS ---------- */

            if (results.length === 0) {

                alert(
                    'No service found for "' +
                    term +
                    '".'
                );

                return;

            }


            /* ---------- SORT ---------- */

            results.sort(
                function (a, b) {

                    return b.score - a.score;

                }
            );


            /* ---------- HIGHLIGHT ---------- */

            results.forEach(
                function (result, index) {

                    result.item.style.outline =
                        "2px solid var(--blue)";


                    if (index === 0) {

                        result.item.scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });

                    }

                }
            );

        }


        /* Search button */

        searchButton.addEventListener(
            "click",
            performSearch
        );


        /* Enter key */

        searchInput.addEventListener(
            "keydown",
            function (event) {

                if (event.key === "Enter") {

                    performSearch();

                }

            }
        );

        /* If Explore was opened from the homepage with a search query,
           wait until its service cards have been rendered, then search them. */
        if (window.location.pathname.endsWith("explore.html")) {
            const exploreSearch =
                new URLSearchParams(window.location.search).get("search");

            if (exploreSearch) {
                searchInput.value = exploreSearch;

                let attempts = 0;
                const runExploreSearch = setInterval(function () {
                    attempts += 1;
                    const grid = document.getElementById("exploreGrid");
                    const cards = grid
                        ? grid.querySelectorAll(".service-card")
                        : [];

                    if (cards.length || attempts >= 20) {
                        clearInterval(runExploreSearch);
                        performSearch();
                    }
                }, 150);
            }
        }

    }

/* ========================================
   POPULAR SEARCHES
======================================== */

const popularSearchLinks = document.querySelectorAll(".popular a");
const popularSearchInput = document.querySelector(".search-box input");

popularSearchLinks.forEach(function (link) {

    link.addEventListener("click", function (event) {

        event.preventDefault();

        if (popularSearchInput) {
            popularSearchInput.value = link.textContent.trim();
            popularSearchInput.focus();
        }

    });

});/* ========================================
   BROWSE CATEGORIES → SEARCH
======================================== */

const categorySearchLinks = document.querySelectorAll(".category-card");
const categorySearchInput = document.querySelector(".search-box input");

categorySearchLinks.forEach(function (card) {

    card.addEventListener("click", function (event) {

        event.preventDefault();

        const categoryName = card.querySelector(
            ":scope > span:last-child"
        );

        if (categorySearchInput && categoryName) {

            categorySearchInput.value =
                categoryName.textContent.trim();

            categorySearchInput.focus();

            /* Bring the search box into view */
            categorySearchInput.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }

    });

});
    /* ================================
       CONTACT PROVIDER + CHAT
    ================================= */

    const contactButton = document.querySelector(".contact-btn");
    const contactModal = document.querySelector("#contactModal");
    const closeModal = document.querySelector("#closeModal");

    const continueContact = document.querySelector("#continueContact");
    const customerName = document.querySelector("#customerName");
    const savedName = document.querySelector("#savedName");

    const contactIdentity = document.querySelector("#contactIdentity");
    const chatInterface = document.querySelector("#chatInterface");
    const chatMessages = document.querySelector("#chatMessages");
    const chatInput = document.querySelector("#chatInput");
    const sendChatMessage = document.querySelector("#sendChatMessage");
    const chatProviderName = document.querySelector("#chatProviderName");

    function showChatInterface(name) {

        if (contactIdentity) {
            contactIdentity.style.display = "none";
        }

        if (chatInterface) {
            chatInterface.style.display = "flex";
        }

        if (chatProviderName) {
            chatProviderName.textContent =
    selectedService?.provider || "Service Provider";
        }

        if (chatInput) {
            chatInput.focus();
        }

    }

    /* Open contact modal */

    if (contactButton && contactModal) {

        contactButton.addEventListener("click", function () {

            const existingStoredName =
                localStorage.getItem("customerName");

            if (existingStoredName && existingStoredName.trim() !== "") {
                window.location.href = "chat.html?service=" + encodeURIComponent(serviceId || "");
                return;
            }

            contactModal.classList.add("active");

            const storedName =
                localStorage.getItem("customerName");

            if (storedName && customerName) {

                customerName.value = storedName;

                if (savedName) {
                    savedName.textContent = "Saved name: " + storedName;
                }

                if (continueContact) {
                    continueContact.textContent =
                        "Continue as " + storedName + " →";
                }

            } else if (continueContact) {

                continueContact.textContent = "Continue →";

            }

            if (chatInterface) {
                chatInterface.style.display = "none";
            }

            if (contactIdentity) {
                contactIdentity.style.display = "block";
            }

            if (customerName) {
                customerName.focus();
            }

        });

    }

    /* Close modal */

    if (closeModal && contactModal) {

        closeModal.addEventListener("click", function () {
            contactModal.classList.remove("active");
        });

    }

    /* Continue as saved/new name */

    if (continueContact && contactModal && customerName) {

        continueContact.addEventListener("click", function () {

            const name = customerName.value.trim();

            if (name === "") {
                alert("Please enter your name.");
                customerName.focus();
                return;
            }

            localStorage.setItem("customerName", name);

            if (savedName) {
                savedName.textContent = "Saved name: " + name;
            }

            continueContact.textContent =
                "Continue as " + name + " →";

            window.location.href =
                "chat.html?service=" +
                encodeURIComponent(serviceId || "");

        });

    }

    /* ================================
       CHAT MESSAGE → BACKEND
    ================================= */

    async function sendChatToBackend(message, name) {

        const payload = {
            type: "chat_message",
            name: name,
            message: message,
            provider: selectedService?.provider || "Service Provider",
            service: document.querySelector("#serviceTitle")?.textContent.trim() || "",
            timestamp: new Date().toISOString()
        };

        localStorage.setItem(
            "serviceHubLastChatMessage",
            JSON.stringify(payload)
        );

        return sendToServiceHubBackend("chat", payload);
    }

    function addChatMessage(text, sender) {

        if (!chatMessages) return;

        const bubble = document.createElement("div");

        bubble.className =
            "chat-message " +
            (sender === "user"
                ? "chat-message-user"
                : "chat-message-provider");

        bubble.textContent = text;

        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;

    }

    async function handleChatSend() {

        if (!chatInput) return;

        const message = chatInput.value.trim();

        if (!message) return;

        const name =
            localStorage.getItem("customerName") || "";

        addChatMessage(message, "user");
        chatInput.value = "";

        await sendChatToBackend(message, name);

    }

    if (sendChatMessage) {
        sendChatMessage.addEventListener("click", handleChatSend);
    }

    if (chatInput) {

        chatInput.addEventListener("keydown", function (event) {

            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleChatSend();
            }

        });

    }


    /* ================================
       CARD → PAGE TRANSITION
    ================================= */

    const transitionLinks =
        document.querySelectorAll(
            ".service-card, .category-card"
        );


    transitionLinks.forEach(
        function (link) {

            link.addEventListener(
                "click",
                function (event) {

                    const destination =
                        link.getAttribute(
                            "href"
                        );


                    if (
                        !destination ||
                        destination === "#"
                    ) {

                        return;

                    }


                    event.preventDefault();


                    const transition =
                        document.createElement(
                            "div"
                        );


                    transition.className =
                        "page-transition";


                    document.body.appendChild(
                        transition
                    );


                    document.body.classList.add(
                        "page-leaving"
                    );


                    requestAnimationFrame(
                        function () {

                            requestAnimationFrame(
                                function () {

                                    transition.classList.add(
                                        "active"
                                    );

                                }
                            );

                        }
                    );


                    window.location.assign(
                        destination
                    );

                }
            );

        }
    );

 /* ================================
       SERVICE PAGE → HOME
    ================================= */

    if (
        window.location.pathname.endsWith(
            "service.html"
        )
    ) {

        document
            .querySelectorAll(
                'a[href="index.html"], a[href="./index.html"], a[href="/"]'
            )
            .forEach(
                function (link) {

                    link.addEventListener(
                        "click",
                        function (event) {

                            const destination =
                                link.getAttribute(
                                    "href"
                                );


                            if (
                                !destination ||
                                destination === "#"
                            ) {

                                return;

                            }


                            event.preventDefault();


                            document.body.classList.remove(
                                "page-enter-right"
                            );


                            document.body.classList.add(
                                "page-exit-right"
                            );


                            setTimeout(
                                function () {

                                    window.location.assign(
                                        destination
                                    );

                                },
                                650
                            );

                        }
                    );

                }
            );

    }

});


/* ========================================
   SERVICE DATA
======================================== */

/* Cards now come only from approved listings in the Google Sheet
   (via Apps Script). No fixed/sample services remain. */
const services = {};

/* ========================================
   SERVICE PAGE
   Built from an approved Google Sheets listing
======================================== */

const params =
    new URLSearchParams(
        window.location.search
    );

const serviceId =
    params.get("service");

let selectedService = null;

function getCachedServiceHubCard(id) {
    try {
        const cards = JSON.parse(
            localStorage.getItem("serviceHubBackendCards") || "{}"
        );
        return cards[id] || null;
    } catch (_) {
        return null;
    }
}

function renderServicePage(card) {

    selectedService = card;

    const setText = function (id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    setText("serviceCategory", card.category || "SERVICE");
    setText("serviceTitle", card.title || "Service");
    setText("serviceProvider", card.provider || "Provider");
    setText("serviceRating", card.rating || "New");
    setText("serviceReviews", card.reviews || "0 reviews");
    setText(
        "serviceDescription",
        card.description ||
        card.about ||
        "Contact the provider to learn more about this service."
    );
    setText("servicePrice", card.price || "Contact provider");

    /* Big image = first uploaded image (image only, no video/docs here) */
    const media = Array.isArray(card.media) ? card.media : [];
    const faceImage = media.find(function (m) {
        return String(m && (m.type || m.mimeType || "")).toLowerCase().indexOf("image/") === 0 &&
            (m.previewUrl || m.url);
    });
    const heroImg = document.getElementById("serviceImage");
    if (heroImg && heroImg.tagName === "IMG") {
        if (faceImage) {
            heroImg.src = faceImage.previewUrl || faceImage.url;
            heroImg.alt = card.title || "";
            heroImg.hidden = false;
        } else {
            heroImg.hidden = true;
        }
    }

    /* What's included: pricing tiers if the provider set them */
    const includedList = document.getElementById("serviceIncluded");
    if (includedList) {
        includedList.innerHTML = "";

        let items = [];
        (Array.isArray(card.customPricing) ? card.customPricing : []).forEach(function (row) {
            if (row && row.category) {
                items.push(row.category + (row.price ? " — ₦" + row.price : ""));
            }
        });
        if (!items.length && Array.isArray(card.included) && card.included.length) {
            items = card.included;
        }
        if (!items.length) {
            items = [
                "Contact the provider for service details",
                "Portfolio available from the provider",
                "Pricing can be discussed with the provider"
            ];
        }
        items.forEach(function (text) {
            const li = document.createElement("li");
            li.textContent = text;
            includedList.appendChild(li);
        });
    }

    renderServiceProviderDetails(card);
    renderServiceMedia(card);
}

function renderServiceProviderDetails(card) {
    const box = document.getElementById("serviceProviderDetails");
    const list = document.getElementById("serviceProviderDetailsList");
    if (!box || !list) return;

    list.innerHTML = "";

    function addRow(label, valueNode) {
        const row = document.createElement("div");
        row.className = "provider-detail-row";
        const l = document.createElement("span");
        l.className = "provider-detail-label";
        l.textContent = label;
        const v = document.createElement("div");
        v.className = "provider-detail-value";
        v.appendChild(valueNode);
        row.appendChild(l);
        row.appendChild(v);
        list.appendChild(row);
    }

    function text(value) {
        return document.createTextNode(value);
    }

    function link(href, label, external) {
        const a = document.createElement("a");
        a.href = href;
        a.textContent = label;
        if (external) {
            a.target = "_blank";
            a.rel = "noopener";
        }
        return a;
    }

    let count = 0;

    if (card.provider) { addRow("Provider", text(card.provider)); count++; }
    if (card.company) { addRow("Company", text(card.company)); count++; }

    if (card.phone) {
        addRow("Phone", link("tel:" + String(card.phone).replace(/[^0-9+]/g, ""), card.phone, false));
        count++;
    }

    const wa = buildServiceHubWhatsAppLink(card.whatsapp || card.phone);
    if (wa) {
        const a = link(wa, "Chat on WhatsApp", true);
        a.className = "provider-whatsapp-btn";
        addRow("WhatsApp", a);
        count++;
    }

    if (card.contact) { addRow("Contact", text(card.contact)); count++; }

    if (card.portfolio) {
        const url = /^https?:\/\//i.test(card.portfolio) ? card.portfolio : "https://" + card.portfolio;
        addRow("Portfolio", link(url, card.portfolio, true));
        count++;
    }

    box.hidden = count === 0;
}

async function loadServicePage() {

    if (!document.getElementById("serviceTitle") || !serviceId) return;

    const cached = getCachedServiceHubCard(serviceId);

    if (cached) {
        renderServicePage(cached);
    } else if (getAppsScriptUrl()) {
        showListingUploadOverlay("Loading service, please wait");
    }

    if (!getAppsScriptUrl()) return;

    try {
        const data = await callServiceHubAppsScript("getListings", {});
        const listings = Array.isArray(data.listings) ? data.listings : [];

        const match = listings.find(function (listing) {
            const card = mapAppsScriptListingToCard(listing);
            return card.id === String(serviceId) &&
                String(listing.status || listing.Status || "").toLowerCase() === "approved";
        });

        if (match) {
            storeServiceHubCard(mapAppsScriptListingToCard(match));
            renderServicePage(getCachedServiceHubCard(serviceId));
        } else if (!cached) {
            const title = document.getElementById("serviceTitle");
            if (title) title.textContent = "This service is not available";
        }
    } catch (error) {
        console.warn("Could not load service from Apps Script:", error);
        if (!cached) {
            const title = document.getElementById("serviceTitle");
            if (title) title.textContent = "Could not load this service";
        }
    } finally {
        hideListingUploadOverlay();
    }
}

loadServicePage();


/* ========================================
   LISTING UPLOAD OVERLAY
   Floating indeterminate wait state while
   media uploads and Apps Script responds.
======================================== */

function getListingUploadOverlay() {

    let overlay =
        document.getElementById(
            "listingUploadOverlay"
        );

    if (overlay) {
        return overlay;
    }

    overlay = document.createElement("div");
    overlay.id = "listingUploadOverlay";
    overlay.className = "listing-upload-overlay";
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-busy", "false");

    overlay.innerHTML =
        '<div class="listing-upload-pill">' +
            '<span class="payment-spinner" aria-hidden="true"></span>' +
            '<span class="listing-upload-text">' +
                "Uploading media, please wait for a moment" +
            "</span>" +
        "</div>";

    document.body.appendChild(overlay);

    return overlay;

}

function showListingUploadOverlay(message) {

    const overlay = getListingUploadOverlay();
    const textEl =
        overlay.querySelector(
            ".listing-upload-text"
        );

    if (textEl) {
        textEl.textContent =
            message ||
            "Uploading media, please wait for a moment";
    }

    overlay.hidden = false;
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
    overlay.setAttribute("aria-busy", "true");
    document.body.classList.add("listing-upload-locked");

}

function hideListingUploadOverlay() {

    const overlay =
        document.getElementById(
            "listingUploadOverlay"
        );

    if (!overlay) {
        document.body.classList.remove(
            "listing-upload-locked"
        );
        return;
    }

    overlay.classList.remove("is-visible");
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("aria-busy", "false");
    document.body.classList.remove("listing-upload-locked");

}


/* ========================================
   SERVICE LISTING SUBMISSION
======================================== */

const listingForm =
    document.getElementById(
        "serviceListingForm"
    );


if (listingForm) {

    let listingSubmitInFlight = false;

    listingForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            if (listingSubmitInFlight) {
                return;
            }


            /* ---------- REQUIRED FIELDS ---------- */

            const requiredFields = [

                {
                    id: "providerName",
                    label: "Name"
                },

                {
                    id: "contactInfo",
                    label: "Contact Information"
                },

                {
                    id: "serviceType",
                    label: "Service"
                },

                {
                    id: "portfolio",
                    label: "Portfolio URL"
                }

            ];


            /* ---------- VALIDATE ---------- */

            for (
                const field of requiredFields
            ) {

                const element =
                    document.getElementById(
                        field.id
                    );


                if (
                    !element ||
                    !element.value.trim()
                ) {

                    alert(
                        `Please fill in "${field.label}" before continuing.`
                    );


                    if (element) {

                        element.scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });


                        setTimeout(
                            function () {

                                element.focus();

                            },
                            400
                        );


                        element.style.borderColor =
                            "var(--blue)";


                        element.style.boxShadow =
                            "0 0 0 3px rgba(35,136,255,0.15)";


                        setTimeout(
                            function () {

                                element.style.borderColor =
                                    "";

                                element.style.boxShadow =
                                    "";

                            },
                            2000
                        );

                    }


                    return;

                }

            }


            /* ---------- REQUIRED INFORMATION ---------- */

            const name =
                document
                    .getElementById(
                        "providerName"
                    )
                    .value
                    .trim();


            const contact =
                document
                    .getElementById(
                        "contactInfo"
                    )
                    .value
                    .trim();


            let service =
                document
                    .getElementById(
                        "serviceType"
                    )
                    .value;


            const portfolio =
                document
                    .getElementById(
                        "portfolio"
                    )
                    .value
                    .trim();


            /* ---------- OPTIONAL FIELDS ---------- */const company =
                document
                    .getElementById(
                        "companyName"
                    )
                    ?.value
                    .trim() || "";


            const about =
                document
                    .getElementById(
                        "about"
                    )
                    ?.value
                    .trim() || "";


            const phone =
                document
                    .getElementById(
                        "phone"
                    )
                    ?.value
                    .trim() || "";


            const startingPrice =
                document
                    .getElementById(
                        "price"
                    )
                    ?.value || "";


            /* ---------- OTHER SERVICE ---------- */

            if (service === "Other") {

                const otherServiceInput =
                    document.getElementById(
                        "otherService"
                    );


                const otherService =
                    otherServiceInput
                        ?.value
                        .trim() || "";


                if (!otherService) {

                    alert(
                        "Please specify the service you provide."
                    );


                    if (otherServiceInput) {

                        otherServiceInput.scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });


                        setTimeout(
                            function () {

                                otherServiceInput.focus();

                            },
                            400
                        );


                        otherServiceInput.style.borderColor =
                            "var(--blue)";


                        otherServiceInput.style.boxShadow =
                            "0 0 0 3px rgba(35,136,255,0.15)";


                        setTimeout(
                            function () {

                                otherServiceInput.style.borderColor =
                                    "";

                                otherServiceInput.style.boxShadow =
                                    "";

                            },
                            2000
                        );

                    }


                    return;

                }


                service =
                    otherService;

            }


            /* ---------- PRICING CATEGORIES ---------- */

            const pricing = [];


            document
                .querySelectorAll(
                    ".pricing-option"
                )
                .forEach(
                    function (option) {

                        const toggle =
                            option.querySelector(
                                ".pricing-toggle"
                            );


                        if (
                            toggle &&
                            toggle.checked
                        ) {

                            const category =
                                toggle.dataset.category;


                            const priceInput =
                                option.querySelector(
                                    ".pricing-price"
                                );


                            const price =
                                priceInput
                                    ? priceInput.value
                                    : "";


                            if (category) {

                                pricing.push({

                                    category:
                                        category,

                                    price:
                                        price

                                });

                            }

                        }

                    }
                );


            /* ---------- CUSTOM PRICING ---------- */

            const customPricing = [];


            document
                .querySelectorAll(
                    ".custom-pricing-row"
                )
                .forEach(
                    function (row) {

                        const nameInput =
                            row.querySelector(
                                ".custom-name"
                            );


                        const priceInput =
                            row.querySelector(
                                ".custom-price"
                            );


                        const categoryName =
                            nameInput
                                ? nameInput.value.trim()
                                : "";


                        const categoryPrice =
                            priceInput
                                ? priceInput.value
                                : "";


                        if (categoryName) {

                            customPricing.push({

                                category:
                                    categoryName,

                                price:
                                    categoryPrice

                            });

                        }

                    }
                );
/* ---------- MEDIA ---------- */

            const mediaInput = document.getElementById("media");

            async function fileToBase64(file) {
                return await new Promise(function (resolve, reject) {
                    const reader = new FileReader();
                    reader.onload = function () {
                        const result = String(reader.result || "");
                        const comma = result.indexOf(",");
                        resolve(comma >= 0 ? result.slice(comma + 1) : result);
                    };
                    reader.onerror = function () {
                        reject(new Error("Could not read " + file.name + "."));
                    };
                    reader.readAsDataURL(file);
                });
            }

            /*
             * The supplied backend requires the listing to exist first:
             * uploadListingMedia(data) calls appendMediaToListing().
             * Therefore media is uploaded only after createListing succeeds.
             *
             * The POST response is intentionally not read because the Apps
             * Script Web App can redirect cross-origin. After the POST we use
             * the backend's existing getListing GET endpoint to confirm that
             * the media row was stored and to obtain the Drive URLs returned
             * by uploadListingMedia().
             */
            async function uploadServiceHubMedia(file, listingId) {
                const appsScriptUrl = getAppsScriptUrl();
                if (!appsScriptUrl) throw new Error("Apps Script is not configured.");
                if (!listingId) throw new Error("Missing Listing ID for media upload.");
                if (!file || !file.size) throw new Error("The selected file is empty.");

                const MAX_MEDIA_BYTES = 30 * 1024 * 1024;
                if (file.size > MAX_MEDIA_BYTES) {
                    throw new Error(file.name + " is larger than the 30 MB upload limit.");
                }

                const before = await fetchAppsScriptListing(listingId);
                const beforeMedia = before.ok
                    ? parseAppsScriptMediaValue(
                        before.listing.Media !== undefined ? before.listing.Media : before.listing.media
                    )
                    : [];
                const beforeCount = beforeMedia.length;

                const base64 = await fileToBase64(file);

                await postToExistingAppsScript({
                    action: "uploadMedia",
                    listingId: String(listingId),
                    fileName: file.name,
                    mimeType: file.type || "application/octet-stream",
                    base64: base64
                });

                const confirmed = await waitForAppsScriptListing(
                    listingId,
                    function (listing) {
                        const media = parseAppsScriptMediaValue(
                            listing.Media !== undefined ? listing.Media : listing.media
                        );
                        return media.length > beforeCount && media.some(function (item) {
                            return String(item && item.name || "") === String(file.name);
                        });
                    },
                    120000
                );

                const media = parseAppsScriptMediaValue(
                    confirmed.listing.Media !== undefined
                        ? confirmed.listing.Media
                        : confirmed.listing.media
                );

                const matching = media.filter(function (item) {
                    return String(item && item.name || "") === String(file.name);
                });
                const uploaded = matching.length ? matching[matching.length - 1] : null;

                if (!uploaded || !uploaded.url) {
                    throw new Error("Apps Script stored the media but did not return its Drive URL.");
                }

                return {
                    name: uploaded.name || file.name,
                    type: uploaded.type || file.type || "application/octet-stream",
                    size: Number(uploaded.size || file.size),
                    path: uploaded.id || "",
                    driveId: uploaded.id || "",
                    url: uploaded.url,
                    previewUrl: uploaded.previewUrl || "",
                    embedUrl: uploaded.embedUrl || "",
                    isImage: !!uploaded.isImage,
                    isVideo: !!uploaded.isVideo,
                    isPdf: !!uploaded.isPdf
                };
            }

            /* Upload sequentially to preserve the existing listing workflow. */
            async function uploadAllServiceHubMedia(listingId) {
                const uploadedMedia = [];
                if (!mediaInput || !mediaInput.files || mediaInput.files.length === 0) {
                    return uploadedMedia;
                }

                for (const file of Array.from(mediaInput.files)) {
                    try {
                        uploadedMedia.push(await uploadServiceHubMedia(file, listingId));
                    } catch (error) {
                        console.error("Media upload failed:", error);
                        throw new Error(
                            "Failed to upload " + file.name + ". " +
                            (error.message || "Unknown upload error.")
                        );
                    }
                }
                return uploadedMedia;
            }

            /* ---------- SAVE LISTING IN APPS SCRIPT FIRST ---------- */

            const submitButton =
                listingForm.querySelector(
                    ".listing-submit"
                );

            let uploadedMediaFiles = [];

            listingSubmitInFlight = true;

            showListingUploadOverlay(
                "Saving your listing, please wait for a moment"
            );

            if (submitButton) {
                submitButton.disabled = true;
            }

            const listingData = {
                name: name,
                company: company,
                contact: contact,
                phone: phone,
                service: service,
                portfolio: portfolio,
                about: about,
                media: [],
                startingPrice: startingPrice,
                pricing: pricing,
                customPricing: customPricing,
                savedAt: new Date().toISOString(),
                listingId: ""
            };

            try {
                /* Ask Apps Script for the next sequential Listing ID before creation. */
                listingData.listingId = await generateServiceHubListingId();

                /* Apps Script remains authoritative when the row is created. */
                const result = await createAppsScriptListing(listingData);

                if (!result.ok) {
                    throw new Error(
                        result.offline
                            ? "ServiceHub Apps Script is not configured."
                            : ((result.error && result.error.message) || "Your listing could not be saved.")
                    );
                }

                const listingId = result.id;
                const paymentCode = result.code;

                listingData.listingId = listingId;
                listingData.paymentCode = paymentCode;

                localStorage.setItem(
                    "serviceHubListing",
                    JSON.stringify(listingData, null, 2)
                );

                localStorage.setItem(
                    "serviceHubListingSaved",
                    "true"
                );

                localStorage.setItem(
                    "serviceHubListingId",
                    listingId
                );

                localStorage.setItem(
                    "serviceHubPaymentCode",
                    paymentCode
                );

                /* ---------- UPLOAD MEDIA INTO THE EXISTING LISTING ---------- */
                if (mediaInput && mediaInput.files && mediaInput.files.length) {
                    showListingUploadOverlay(
                        "Uploading media, please wait for a moment"
                    );

                    uploadedMediaFiles =
                        await uploadAllServiceHubMedia(listingId);

                    listingData.media = uploadedMediaFiles;

                    localStorage.setItem(
                        "serviceHubListing",
                        JSON.stringify(listingData, null, 2)
                    );
                }

                /* Keep the existing navigation/UX. */
                window.location.href = "payment.html";

            } catch (error) {
                listingSubmitInFlight = false;
                hideListingUploadOverlay();

                if (submitButton) {
                    submitButton.disabled = false;
                }

                console.error(
                    "ServiceHub Apps Script listing/upload error:",
                    error
                );

                alert(
                    error && error.message
                        ? error.message
                        : "Your listing could not be saved. Please try again."
                );
            }
        }
    );

}


/* ========================================
   PRICING RANK
======================================== */

const pricingRankGroup =
    document.getElementById(
        "pricingRankGroup"
    );

const pricingRank =
    document.getElementById(
        "pricingRank"
    );

const startingPriceInput =
    document.getElementById(
        "price"
    );


if (
    pricingRankGroup &&
    pricingRank &&
    startingPriceInput
) {

    startingPriceInput.addEventListener(
        "input",
        function () {

            if (
                this.value.trim() !== ""
            ) {

                pricingRankGroup.style.display =
                    "block";

            }

            else {

                pricingRankGroup.style.display =
                    "none";

                pricingRank.value = "";

            }

        }
    );

}


/* ========================================
   PRICING CATEGORY TOGGLES
======================================== */

document
    .querySelectorAll(
        ".pricing-toggle"
    )
    .forEach(
        function (toggle) {

            toggle.addEventListener(
                "change",
                function () {

                    const option =
                        this.closest(
                            ".pricing-option"
                        );


                    if (!option) {

                        return;

                    }


                    const priceInput =
                        option.querySelector(
                            ".pricing-price"
                        );


                    if (!priceInput) {

                        return;

                    }


                    if (this.checked) {

                        priceInput.disabled =
                            false;

                        priceInput.focus();

                    }

                    else {

                        priceInput.disabled =
                            true;

                        priceInput.value =
                            "";

                    }

                }
            );

        }
    );


/* ========================================
   CUSTOM PRICING
======================================== */

const customPricingToggle =
    document.getElementById(
        "customPricingToggle"
    );

const customPricingList =
    document.getElementById(
        "customPricingList"
    );

const addCustomPricing =
    document.getElementById(
        "addCustomPricing"
    );


if (
    customPricingToggle &&
    customPricingList &&
    addCustomPricing
) {

    customPricingToggle.addEventListener(
        "change",
        function () {

            if (this.checked) {

                addCustomPricing.style.display =
                    "block";

            }

            else {

                addCustomPricing.style.display =
                    "none";

                customPricingList.innerHTML =
                    "";

            }

        }
    );


    addCustomPricing.addEventListener(
        "click",
        function () {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "custom-pricing-row";


            row.innerHTML = `

                <input
                    type="text"
                    class="custom-name"
                    placeholder="Category name"
                >

                <div class="pricing-price-box">

                    <span>₦</span>

                    <input
                        type="number"
                        class="custom-price"
                        placeholder="Price"
                        min="0"
                        inputmode="numeric"
                    >

                </div>

                <button
                    type="button"
                    class="remove-custom-pricing"
                >
                    ×
                </button>

            `;


            customPricingList.appendChild(
                row
            );


            const removeButton =
                row.querySelector(
                    ".remove-custom-pricing"
                );


            if (removeButton) {

                removeButton.addEventListener(
                    "click",
                    function () {

                        row.remove();

                    }
                );

            }

        }
    );

}


/* ========================================
   OTHER SERVICE FIELD
======================================== */

const serviceSelect =
    document.getElementById(
        "serviceType"
    );

const otherServiceBox =
    document.getElementById(
        "otherServiceBox"
    );

const otherServiceInput =
    document.getElementById(
        "otherService"
    );


if (
    serviceSelect &&
    otherServiceBox &&
    otherServiceInput
) {

    serviceSelect.addEventListener(
        "change",
        function () {

            if (
                this.value === "Other"
            ) {

                otherServiceBox.style.display =
                    "block";

                otherServiceInput.focus();

            }

            else {

                otherServiceBox.style.display =
                    "none";

                otherServiceInput.value =
                    "";

            }

        }
    );

}


/* ========================================
   PAYMENT METHOD
======================================== */

const paymentContinue =
    document.getElementById(
        "paymentContinue"
    );

const paymentMessage =
    document.getElementById(
        "paymentMessage"
    );


if (paymentContinue) {

    paymentContinue.addEventListener(
        "click",
        function () {

            const selectedPayment =
                document.querySelector(
                    'input[name="paymentMethod"]:checked'
                );


            if (!selectedPayment) {

                if (paymentMessage) {

                    paymentMessage.textContent =
                        "Please choose a payment method.";

                }

                return;

            }


            const method =
                selectedPayment.value;


            localStorage.setItem(
                "serviceHubPaymentMethod",
                method
            );


            if (
                method === "naira"
            ) {

                window.location.href =
                    "payment-naira.html";

            }

            else if (
                method === "usd"
            ) {

                window.location.href =
                    "payment-usd.html";

            }

            else if (
                method === "crypto"
            ) {

                window.location.href =
                    "payment-crypto.html";

            }

        }
    );

}
/* ========================================
   EXPLORE ALL SERVICES
======================================== */

const exploreGrid = document.getElementById("exploreGrid");

if (exploreGrid && typeof services !== "undefined") {

    Object.entries(services).forEach(([serviceId, service]) => {

        const card = document.createElement("a");

        card.href = `service.html?service=${serviceId}`;
        card.className = "service-card";

        card.innerHTML = `
            <div class="service-image">
                <span>${service.title}</span>
            </div>

            <div class="service-info">

                <p class="service-category">
                    SERVICE
                </p>

                <h3>
                    ${service.title}
                </h3>

                <p class="provider">
                    ${service.provider}
                </p>

                <div class="service-bottom">

                    <span>
                        ⭐ ${service.rating}
                        (${service.reviews})
                    </span>

                    <strong>
                        From ${service.price}
                    </strong>

                </div>

            </div>
        `;

        exploreGrid.appendChild(card);

    });

}
/* ========================================
   RANDOM FEATURED SERVICES
======================================== */

const featuredServices =
    document.getElementById("featuredServices");

if (featuredServices && typeof services !== "undefined") {

    const serviceEntries = Object.entries(services);

    /* Shuffle the services */
    const shuffledServices = [...serviceEntries].sort(
        () => Math.random() - 0.5
    );

    /* Show a maximum of 15 */
    const selectedServices = shuffledServices.slice(0, 15);

    /* Clear the container (only when there are fixed services to show) */
    if (selectedServices.length) featuredServices.innerHTML = "";

    /* Create the cards */
    selectedServices.forEach(([serviceId, service]) => {

        const card = document.createElement("a");

        card.href = `service.html?service=${serviceId}`;

        card.className = "service-card";

        card.innerHTML = `
            <div class="service-image">
                <span>${service.title}</span>
            </div>

            <div class="service-info">

                <p class="service-category">
                    SERVICE
                </p>

                <h3>
                    ${service.title}
                </h3>

                <p class="provider">
                    ${service.provider}
                </p>

                <div class="service-bottom">

                    <span>
                        ⭐ ${service.rating}
                    </span>

                    <strong>
                        From ${service.price}
                    </strong>

                </div>

            </div>
        `;

        featuredServices.appendChild(card);

    });

}

/* ========================================
   BACKEND REALTIME COMMANDS + SERVICE CARDS
======================================== */

(function connectServiceHubBackend() {

    const baseUrl =
        window.SERVICEHUB_BACKEND_URL || "";

    if (!baseUrl) return;

    const apiBase = baseUrl.replace(/\/$/, "");

    // Load cards that were created before this browser opened.
    fetch(apiBase + "/listings")
        .then(function (response) {
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response.json();
        })
        .then(function (data) {
            (data.cards || []).forEach(function (command) {
                if (command.card) storeServiceHubCard(command.card);
            });
        })
        .catch(function (error) {
            console.warn("ServiceHub listings sync unavailable:", error);
        });

    // Listen for commands sent by the backend in real time.
    if (typeof EventSource !== "undefined") {
        const events = new EventSource(apiBase + "/events");

        events.onmessage = function (event) {
            try {
                const command = JSON.parse(event.data);

                if (command.command === "add_card" && command.card) {
                    storeServiceHubCard(command.card);
                }

                if (command.type === "chat_message") {
                    window.dispatchEvent(
                        new CustomEvent("serviceHubChatMessage", {
                            detail: command.message
                        })
                    );
                }
            } catch (error) {
                console.error("Invalid ServiceHub backend event:", error);
            }
        };

        events.onerror = function () {
            console.warn("ServiceHub realtime connection interrupted; browser will retry.");
        };
    }

})();


/* ========================================
   APPS SCRIPT → EXPLORE PAGE CARDS
   Polls the source of truth continuously.
======================================== */

(function connectServiceHubAppsScriptListings() {

    if (!getAppsScriptUrl()) return;

    // Paint cached approved cards immediately, then sync with the sheet.
    try {
        const cachedCards = JSON.parse(
            localStorage.getItem("serviceHubBackendCards") || "{}"
        );
        Object.keys(cachedCards).forEach(function (id) {
            addServiceHubCardToPage(cachedCards[id], id);
        });
    } catch (_) {}

    // Initial load.
    reconcileServiceHubCards();

    // Keep the marketplace synchronized with the Listings sheet.
    // The backend decides what is approved; the browser only renders it.
    setInterval(function () {
        reconcileServiceHubCards();
    }, 15000);

})();


/* ========================================
   NAIRA PAYMENT PAGE
   Apps Script approval polling
======================================== */

(function serviceHubNairaPaymentPage() {

    const codeEl = document.getElementById("nairaDescription");

    if (!codeEl) return;

    const bankNameEl = document.getElementById("nairaBankName");
    const accountNumberEl = document.getElementById("nairaAccountNumber");
    const accountNameEl = document.getElementById("nairaAccountName");
    const copyBtn = document.getElementById("nairaCopyCode");
    const statusPill = document.getElementById("nairaStatusPill");
    const waitingStep = document.getElementById("nairaWaitingStep");
    const approvedStep = document.getElementById("nairaApprovedStep");

    const bankDetails = window.SERVICEHUB_BANK_DETAILS || {};

    if (bankNameEl) bankNameEl.textContent = bankDetails.bankName || "Not configured yet";
    if (accountNumberEl) accountNumberEl.textContent = bankDetails.accountNumber || "—";
    if (accountNameEl) accountNameEl.textContent = bankDetails.accountName || "—";

    const listingId = localStorage.getItem("serviceHubListingId");
    let currentCode = localStorage.getItem("serviceHubPaymentCode") || "";
    let pollingTimer = null;
    let stopped = false;
    let checking = false;

    function renderCode() {
        codeEl.textContent = currentCode
            ? ("Alert Service hub Payment " + currentCode)
            : "Alert Service hub Payment …";
    }

    renderCode();

    function setWaitingStatus(message) {
        if (statusPill) {
            statusPill.classList.remove("payment-status-pill-rejected");
            statusPill.textContent = message || "Waiting for payment confirmation…";
        }
    }

    function showApproved() {
        if (stopped) return;

        stopped = true;

        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
        }

        if (waitingStep) waitingStep.style.display = "none";
        if (approvedStep) approvedStep.style.display = "block";

        if (statusPill) {
            statusPill.textContent = "Payment confirmed";
        }

        window.serviceHubDebug && window.serviceHubDebug.addLog(
            "OK",
            "Listing approved by Apps Script",
            {
                listingId: listingId,
                paymentCode: currentCode
            }
        );
    }

    function showRejected() {
        if (statusPill) {
            statusPill.classList.add("payment-status-pill-rejected");
            statusPill.textContent =
                "Payment could not be confirmed. Please contact support.";
        }
    }

    async function recoverListingCode() {
        if (!listingId || currentCode) return true;

        const result = await fetchAppsScriptListing(listingId);

        if (result.ok && result.code) {
            currentCode = String(result.code);
            localStorage.setItem(
                "serviceHubPaymentCode",
                currentCode
            );
            renderCode();
            return true;
        }

        return false;
    }

    async function checkPaymentApproval() {
        if (stopped || checking || !listingId) return;

        checking = true;

        try {
            if (!currentCode) {
                await recoverListingCode();
            }

            if (!currentCode) {
                setWaitingStatus("Waiting for payment code…");
                return;
            }

            setWaitingStatus("Checking payment confirmation…");

            const result = await checkAppsScriptPayment(
                listingId,
                currentCode
            );

            if (result.status === "approved") {
                showApproved();
                return;
            }

            if (result.status === "not_found") {
                setWaitingStatus("Listing not found yet. Checking again…");
                return;
            }

            if (result.status === "pending") {
                setWaitingStatus("Payment received? Waiting for confirmation…");
                return;
            }

            setWaitingStatus("Waiting for payment confirmation…");

        } catch (error) {
            console.warn("Apps Script payment polling error:", error);
            setWaitingStatus("Connection check failed. Retrying…");

            window.serviceHubDebug && window.serviceHubDebug.addLog(
                "ERROR",
                "Payment confirmation poll failed",
                error
            );
        } finally {
            checking = false;
        }
    }

    if (copyBtn) {
        copyBtn.addEventListener("click", function () {
            const text = currentCode
                ? ("Alert Service hub Payment " + currentCode)
                : codeEl.textContent;

            navigator.clipboard.writeText(text).then(function () {
                const original = copyBtn.textContent;
                copyBtn.textContent = "Copied!";
                setTimeout(function () {
                    copyBtn.textContent = original;
                }, 2000);
            });
        });
    }

    if (!listingId) {
        setWaitingStatus("No listing ID was found. Please return and create the listing again.");
        return;
    }

    /*
       Immediately check, then continue checking every 5 seconds.
       The browser never writes approval and never talks to Payments.
       Apps Script only returns the state of this exact listing/code pair.
    */
    /*
       Floating loader while the unique 6-character code is retrieved
       from Apps Script. It disappears as soon as the code is on screen.
    */
    async function waitForPaymentCode() {

        if (currentCode) return true;

        showListingUploadOverlay(
            "Generating your unique payment code, please wait…"
        );

        const startedAt = Date.now();

        try {
            while (!stopped && !currentCode && (Date.now() - startedAt) < 90000) {
                await recoverListingCode();
                if (currentCode) break;
                await new Promise(function (resolve) { setTimeout(resolve, 2500); });
            }
        } finally {
            hideListingUploadOverlay();
        }

        return !!currentCode;
    }

    waitForPaymentCode().then(function (gotCode) {

        if (!gotCode) {
            setWaitingStatus("Could not get your payment code yet. Please refresh this page.");
            return;
        }

        checkPaymentApproval();

        pollingTimer = setInterval(
            checkPaymentApproval,
            5000
        );
    });

})();
/* ========================================
   LOGIN → BACKEND
======================================== */

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

if (loginForm) {

    loginForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const name = document.getElementById("loginName")?.value.trim() || "";
        const company = document.getElementById("loginCompany")?.value.trim() || "";
        const contact = document.getElementById("loginContact")?.value.trim() || "";
        const phone = document.getElementById("loginPhone")?.value.trim() || "";

        if (!name || !contact) {
            if (loginMessage) {
                loginMessage.textContent =
                    "Please fill in the required information.";
            }
            return;
        }

        const payload = {
            type: "login",
            "Name": name,
            "Company Name": company,
            "Contact Information": contact,
            "Phone Number": phone,
            timestamp: new Date().toISOString()
        };

        localStorage.setItem(
            "serviceHubLogin",
            JSON.stringify(payload)
        );

        if (loginMessage) {
            loginMessage.textContent = "Information prepared. Sending...";
        }

        const result =
            await sendToServiceHubBackend("login", payload);

        if (loginMessage) {
            if (result.ok) {
                loginMessage.textContent =
                    "Information sent successfully.";
            } else if (result.offline) {
                loginMessage.textContent =
                    "Saved locally. Backend is not connected yet.";
            } else {
                loginMessage.textContent =
                    "Could not reach the backend. Please try again.";
            }
        }

    });

}
/* ========================================
   PROVIDER CHAT INBOX
   The supplied Apps Script has no chat endpoints.
   Keep the existing provider UI available without a
   third-party database by reading the local chat store.
======================================== */
(function initLocalProviderChat() {
    const chatList = document.getElementById("chatList");
    const chatWindow = document.getElementById("chatWindow");
    if (!chatList || !chatWindow) return;

    const PROVIDER_NAME = "Service Provider";
    const STORAGE_PREFIX = "serviceHubChat_";

    function readChats() {
        const chats = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || key.indexOf(STORAGE_PREFIX) !== 0) continue;
            try {
                const value = JSON.parse(localStorage.getItem(key) || "null");
                if (value && value.providerId) chats.push(value);
            } catch (_) {}
        }
        return chats;
    }

    function render() {
        chatList.innerHTML = "";
        const title = document.createElement("div");
        title.className = "chat-list-title";
        title.textContent = "Chats";
        chatList.appendChild(title);

        const chats = readChats();
        if (!chats.length) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.textContent = "No conversations yet.";
            chatList.appendChild(empty);
            return;
        }

        chats.sort(function (a, b) {
            return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
        });

        chats.forEach(function (conversation) {
            const item = document.createElement("div");
            item.className = "chat-item";
            item.innerHTML =
                '<div class="chat-item-header"><div class="chat-item-name"></div><div class="chat-item-time"></div></div>' +
                '<div class="chat-item-service"></div><div class="chat-item-preview"></div>';
            item.querySelector(".chat-item-name").textContent = conversation.customerName || "Customer";
            item.querySelector(".chat-item-time").textContent = conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}) : "";
            item.querySelector(".chat-item-service").textContent = conversation.serviceName || "";
            const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
            item.querySelector(".chat-item-preview").textContent = messages.length ? messages[messages.length - 1].message : "Open conversation";
            item.addEventListener("click", function () { openConversation(conversation); });
            chatList.appendChild(item);
        });
    }

    function openConversation(conversation) {
        chatWindow.innerHTML = "";
        const header = document.createElement("div");
        header.className = "active-chat-header";
        const customer = document.createElement("div");
        customer.className = "active-chat-customer";
        customer.textContent = conversation.customerName || "Customer";
        const service = document.createElement("div");
        service.className = "active-chat-service";
        service.textContent = conversation.serviceName || "";
        header.appendChild(customer);
        header.appendChild(service);

        const messages = document.createElement("div");
        messages.className = "active-messages";
        (conversation.messages || []).forEach(function (message) {
            const el = document.createElement("div");
            el.className = "message " + (message.sender === "provider" ? "provider-message" : "customer-message");
            const name = document.createElement("div");
            name.className = "message-name";
            name.textContent = message.sender === "provider" ? PROVIDER_NAME : (conversation.customerName || "Customer");
            const text = document.createElement("div");
            text.textContent = message.message || "";
            el.appendChild(name);
            el.appendChild(text);
            messages.appendChild(el);
        });

        const reply = document.createElement("div");
        reply.className = "active-reply-box";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Reply to customer...";
        const button = document.createElement("button");
        button.textContent = "Send";
        function send() {
            const value = input.value.trim();
            if (!value) return;
            const stored = JSON.parse(localStorage.getItem(conversation.storageKey) || "null");
            if (!stored) return;
            stored.messages = Array.isArray(stored.messages) ? stored.messages : [];
            stored.messages.push({sender:"provider", message:value, createdAt:new Date().toISOString()});
            stored.updatedAt = new Date().toISOString();
            localStorage.setItem(conversation.storageKey, JSON.stringify(stored));
            input.value = "";
            openConversation(stored);
            render();
        }
        button.addEventListener("click", send);
        input.addEventListener("keydown", function (event) { if (event.key === "Enter") send(); });
        reply.appendChild(input);
        reply.appendChild(button);

        chatWindow.appendChild(header);
        chatWindow.appendChild(messages);
        chatWindow.appendChild(reply);
    }

    window.addEventListener("storage", render);
    window.addEventListener("serviceHubLocalChatUpdated", render);
    render();
})();

function formatTime(timestamp) {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
}

function scrollMessagesToBottom(container) {
    if (container) container.scrollTop = container.scrollHeight;
}
