/* =================================
   SERVICEHUB JAVASCRIPT
================================= */

/* =================================
   SERVICEHUB CONFIG
   (previously in backend-config.js —
   now inlined here directly)
================================= */

window.SERVICEHUB_BACKEND_URL = "";

window.SERVICEHUB_SUPABASE_URL =
    "https://qqnvnceoipxyxkqsubsv.supabase.co";

window.SERVICEHUB_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxbnZuY2VvaXB4eXhrcXN1YnN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1ODg2NzMsImV4cCI6MjEwNTE2NDY3M30.a_6wsmD3fH2Dv_-Wd47DMQlfeTBRsP7XoDAOdXthUns";

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
   SUPABASE CONNECTION
   (listings, Naira payment codes,
   and live "approved" cards)
================================= */

let serviceHubSupabaseClient = null;

function getServiceHubSupabase() {

    if (serviceHubSupabaseClient) {
        return serviceHubSupabaseClient;
    }

    const url = window.SERVICEHUB_SUPABASE_URL;
    const key = window.SERVICEHUB_SUPABASE_ANON_KEY;

    if (!url || !key || typeof window.supabase === "undefined") {
        return null;
    }

    serviceHubSupabaseClient = window.supabase.createClient(url, key);

    return serviceHubSupabaseClient;

}


// Sends a new listing to the Supabase "create-listing" Edge Function.
// The function inserts the listing as "pending", generates the 6-character
// payment code, and returns both the listing id and the code.
async function createSupabaseListing(listingData) {

    const url = window.SERVICEHUB_SUPABASE_URL;
    const key = window.SERVICEHUB_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.log("Supabase is not configured yet.", listingData);
        return { ok: false, offline: true };
    }

    try {

        const response = await fetch(
            url.replace(/\/$/, "") + "/functions/v1/create-listing",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": key,
                    "Authorization": "Bearer " + key
                },
                body: JSON.stringify(listingData)
            }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok || !data || !data.ok) {
            throw new Error((data && data.error) || ("HTTP " + response.status));
        }

        return { ok: true, id: data.id, code: data.code };

    } catch (error) {
        console.error("Supabase create-listing error:", error);
        return { ok: false, error: error };
    }

}


// Fallback used on the Naira payment page if the payment code was not
// already stored locally (e.g. the page was reloaded on another device).
async function fetchSupabaseListingCode(listingId) {

    const url = window.SERVICEHUB_SUPABASE_URL;
    const key = window.SERVICEHUB_SUPABASE_ANON_KEY;

    if (!url || !key || !listingId) {
        return { ok: false };
    }

    try {

        const response = await fetch(
            url.replace(/\/$/, "") + "/functions/v1/get-listing-code",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": key,
                    "Authorization": "Bearer " + key
                },
                body: JSON.stringify({ id: listingId })
            }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok || !data || !data.ok) {
            throw new Error((data && data.error) || ("HTTP " + response.status));
        }

        return { ok: true, code: data.code, status: data.status };

    } catch (error) {
        console.error("Supabase get-listing-code error:", error);
        return { ok: false, error: error };
    }

}


function escapeServiceHubText(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
}


// Turns a listing (from the legacy Node backend OR a Supabase row) into a
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


function addServiceHubCardToPage(cardData, cardId) {

    const containers = [
        document.getElementById("featuredServices"),
        document.getElementById("exploreGrid")
    ].filter(Boolean);

    containers.forEach(function (container) {

        if (container.querySelector('[data-backend-card-id="' + CSS.escape(cardId) + '"]')) {
            return;
        }

        const card = document.createElement("a");
        card.href = "service.html?service=" + encodeURIComponent(cardId);
        card.className = "service-card";
        card.setAttribute("data-backend-card-id", cardId);

        card.innerHTML = `
            <div class="service-image">
                <span>${escapeServiceHubText(cardData.title)}</span>
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


// Maps a Supabase "listings" row (snake_case columns) into the same
// card shape used above.
function mapSupabaseListingToCard(row) {

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
   "approved" in Supabase, e.g. an
   admin flipped it back to pending)
================================= */

async function reconcileServiceHubCards() {

    const supabase = getServiceHubSupabase();

    if (!supabase) {
        return;
    }

    let data, error;

    try {

        const result = await supabase
            .from("listings")
            .select("id")
            .eq("status", "approved");

        data = result.data;
        error = result.error;

    } catch (fetchError) {

        console.error("ServiceHub reconcile fetch error:", fetchError);
        return;
    }

    if (error) {

        console.error("ServiceHub reconcile error:", error);
        return;
    }

    const approvedIds = new Set(
        (data || []).map(function (row) {
            return row.id;
        })
    );

    const cards = JSON.parse(
        localStorage.getItem("serviceHubBackendCards") || "{}"
    );

    let changed = false;

    Object.keys(cards).forEach(function (cardId) {

        if (!approvedIds.has(cardId)) {

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

}


/* =================================
   MAIN PAGE FUNCTIONS
================================= */

document.addEventListener("DOMContentLoaded", function () {


    /* ================================
       RECONCILE ON LOAD, THEN POLL
    ================================= */

    reconcileServiceHubCards();

    setInterval(
        reconcileServiceHubCards,
        2 * 60 * 1000 // every 2 minutes
    );



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

const services = {

    "video-editing": {

        image: "VIDEO",

        category: "Video & Motion",

        title: "Professional Video Editing",

        provider: "Solaceproeditz",

        rating: "4.9",

        reviews: "12 reviews",

        description:
            "Professional video editing for businesses, creators and digital projects. Get clean, engaging visuals designed to communicate your message clearly.",

        price: "₦5,000",

        included: [
            "Professional video editing",
            "Motion graphics",
            "Text and visual effects",
            "Social media-ready output"
        ]

    },


    "graphic-design": {

        image: "DESIGN",

        category: "Graphic Design",

        title: "Brand Identity Design",

        provider: "Creative Studio",

        rating: "4.8",

        reviews: "10 reviews",

        description:
            "Creative graphic design for brands, businesses and digital projects. Get polished visuals that communicate your message clearly.",

        price: "₦10,000",

        included: [
            "Brand identity design",
            "Social media graphics",
            "Marketing designs",
            "Promotional visuals"
        ]

    },


    "web-development": {

        image: "WEB",

        category: "Web Development",

        title: "Website Development",

        provider: "Digital Works",

        rating: "5.0",

        reviews: "8 reviews",

        description:
            "Modern, responsive websites for businesses and digital projects, designed to work smoothly across phones, tablets and computers.",

        price: "₦25,000",

        included: [
            "Responsive website",
            "Frontend development",
            "Mobile optimization",
            "Modern user interface"
        ]

    }

};
/* ========================================
   SERVICE PAGE
======================================== */

const params =
    new URLSearchParams(
        window.location.search
    );

const serviceId =
    params.get("service");

const backendCards = JSON.parse(
    localStorage.getItem("serviceHubBackendCards") || "{}"
);

const selectedService =
    services[serviceId] || backendCards[serviceId];


if (selectedService) {

    const setText =
        function (id, value) {

            const element =
                document.getElementById(id);

            if (element) {

                element.textContent =
                    value;

            }

        };


    setText(
        "serviceImage",
        selectedService.image
    );

    setText(
        "serviceCategory",
        selectedService.category
    );

    setText(
        "serviceTitle",
        selectedService.title
    );

    setText(
        "serviceProvider",
        selectedService.provider
    );

    setText(
        "serviceRating",
        selectedService.rating
    );

    setText(
        "serviceReviews",
        selectedService.reviews
    );

    setText(
        "serviceDescription",
        selectedService.description ||
        selectedService.about ||
        "Contact the provider to learn more about this service."
    );

    setText(
        "servicePrice",
        selectedService.price
    );


    const includedList =
        document.getElementById(
            "serviceIncluded"
        );


    if (includedList) {

        includedList.innerHTML = "";


        (selectedService.included || [
            "Contact the provider for service details",
            "Portfolio available from the provider",
            "Pricing can be discussed with the provider"
        ]).forEach(
            function (item) {

                const li =
                    document.createElement(
                        "li"
                    );


                li.textContent =
                    item;


                includedList.appendChild(
                    li
                );

            }
        );

    }

}


/* ========================================
   SERVICE LISTING SUBMISSION
======================================== */

const listingForm =
    document.getElementById(
        "serviceListingForm"
    );


if (listingForm) {

    listingForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


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

            const mediaInput =
                document.getElementById(
                    "media"
                );


            const mediaFiles = [];


            /*
               Uploads an actual file to Supabase Storage
               and returns the permanent public URL.
            */
            async function uploadServiceHubMedia(file) {

                const supabase =
                    getServiceHubSupabase();


                if (!supabase) {

                    throw new Error(
                        "Supabase is not configured."
                    );

                }


                /*
                   Give every upload its own unique folder.
                   This prevents two providers uploading
                   files with the same filename from
                   overwriting each other.
                */
                const uploadFolder =
                    crypto.randomUUID();


                /*
                   Make the filename Storage-safe.
                */
                const safeName =
                    file.name.replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );


                const filePath =
                    uploadFolder +
                    "/" +
                    Date.now() +
                    "_" +
                    safeName;


                /*
                   Upload the ACTUAL FILE.
                */
                const uploadResult =
                    await supabase
                        .storage
                        .from("service-media")
                        .upload(
                            filePath,
                            file,
                            {
                                cacheControl: "3600",
                                upsert: false,
                                contentType: file.type
                            }
                        );


                if (uploadResult.error) {

                    throw uploadResult.error;

                }


                /*
                   Get the public URL of the uploaded file.
                */
                const publicUrlResult =
                    supabase
                        .storage
                        .from("service-media")
                        .getPublicUrl(
                            uploadResult.data.path
                        );


                return {

                    name:
                        file.name,

                    type:
                        file.type,

                    size:
                        file.size,

                    path:
                        uploadResult.data.path,

                    url:
                        publicUrlResult
                            .data
                            .publicUrl

                };

            }


            /*
               Upload all selected media files.
            */
            async function uploadAllServiceHubMedia() {

                const uploadedMedia = [];


                if (
                    !mediaInput ||
                    !mediaInput.files ||
                    mediaInput.files.length === 0
                ) {

                    return uploadedMedia;

                }


                for (
                    const file of Array.from(
                        mediaInput.files
                    )
                ) {

                    try {

                        const uploadedFile =
                            await uploadServiceHubMedia(
                                file
                            );


                        uploadedMedia.push(
                            uploadedFile
                        );


                    } catch (error) {

                        console.error(
                            "Media upload failed:",
                            error
                        );


                        throw new Error(
                            "Failed to upload " +
                            file.name +
                            ". " +
                            (
                                error.message ||
                                "Unknown upload error."
                            )
                        );

                    }

                }


                return uploadedMedia;

            }


            /* ---------- UPLOAD MEDIA TO SUPABASE ---------- */

            let uploadedMediaFiles = [];

            try {

                uploadedMediaFiles =
                    await uploadAllServiceHubMedia();

            } catch (error) {

                alert(
                    error.message ||
                    "There was a problem uploading your media."
                );

                console.error(
                    "ServiceHub media upload error:",
                    error
                );

                return;

            }


            /* ---------- LISTING DATA ---------- */

            const listingData = {

                name:
                    name,

                company:
                    company,

                contact:
                    contact,

                phone:
                    phone,

                service:
                    service,

                portfolio:
                    portfolio,

                about:
                    about,

                media:
                    uploadedMediaFiles,

                startingPrice:
                    startingPrice,

                pricing:
                    pricing,

                customPricing:
                    customPricing,

                savedAt:
                    new Date().toISOString()

            };


            /* ---------- SAVE LISTING ---------- */

            const listingText =
                JSON.stringify(
                    listingData,
                    null,
                    2
                );


            localStorage.setItem(
                "serviceHubListing",
                listingText
            );


            localStorage.setItem(
                "serviceHubListingSaved",
                "true"
            );

            /* ---------- SEND LISTING TO LEGACY BACKEND (optional) ---------- */
            sendToServiceHubBackend(
                "listings",
                listingData
            ).then(function (result) {
                if (!result.ok && !result.offline) {
                    console.error("ServiceHub listing backend error:", result);
                }
            });


            /* ---------- SEND LISTING TO SUPABASE ---------- */
            /* Creates the listing as "pending" and generates the
               6-character payment code shown on the Naira payment page. */

            createSupabaseListing(listingData).then(function (result) {

                if (result.ok) {

                    localStorage.setItem(
                        "serviceHubListingId",
                        result.id
                    );

                    localStorage.setItem(
                        "serviceHubPaymentCode",
                        result.code
                    );

                } else if (!result.offline) {

                    console.error("Supabase listing error:", result);

                }

                /* ---------- GO TO PAYMENT ---------- */

                window.location.href =
                    "payment.html";

            });

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

    /* Clear the container */
    featuredServices.innerHTML = "";

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
   SUPABASE REALTIME → EXPLORE PAGE CARDS
   Watches the "listings" table for rows that
   become "approved" and turns each one into a
   card on the homepage / Explore grid.
======================================== */

(function connectServiceHubSupabaseRealtime() {

    const supabaseClient = getServiceHubSupabase();

    if (!supabaseClient) return;

    // Load every already-approved listing once, on page load.
    supabaseClient
        .from("listings")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .then(function (result) {
            if (result.error) {
                console.warn("Supabase approved-listings load failed:", result.error);
                return;
            }
            (result.data || []).forEach(function (row) {
                storeServiceHubCard(mapSupabaseListingToCard(row));
            });
        });

    // Listen for listings flipping to "approved" in real time.
    supabaseClient
        .channel("servicehub-approved-listings")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "listings",
                filter: "status=eq.approved"
            },
            function (payload) {
                if (payload.new) {
                    storeServiceHubCard(mapSupabaseListingToCard(payload.new));
                }
            }
        )
        .subscribe();

})();


/* ========================================
   NAIRA PAYMENT PAGE
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

    function renderCode() {
        codeEl.textContent = currentCode
            ? ("Alert Service hub Payment " + currentCode)
            : "Alert Service hub Payment …";
    }

    renderCode();

    function showApproved() {
        if (waitingStep) waitingStep.style.display = "none";
        if (approvedStep) approvedStep.style.display = "block";
    }

    function showRejected() {
        if (statusPill) {
            statusPill.classList.add("payment-status-pill-rejected");
            statusPill.innerHTML = "Payment could not be confirmed. Please contact support.";
        }
    }

    // Fetch the code from Supabase if it wasn't already saved locally
    // (e.g. this page was opened fresh / on another device).
    if (!currentCode && listingId) {
        fetchSupabaseListingCode(listingId).then(function (result) {
            if (result.ok && result.code) {
                currentCode = result.code;
                localStorage.setItem("serviceHubPaymentCode", currentCode);
                renderCode();
            }
            if (result.ok && result.status === "approved") {
                showApproved();
            }
        });
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

    if (!listingId) return;

    const supabaseClient = getServiceHubSupabase();

    if (!supabaseClient) return;

    // Real-time: the moment the backend marks this listing "approved",
    // this page updates without a refresh.
    supabaseClient
        .channel("listing-status-" + listingId)
        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "listings",
                filter: "id=eq." + listingId
            },
            function (payload) {
                if (!payload.new) return;
                if (payload.new.status === "approved") showApproved();
                if (payload.new.status === "rejected") showRejected();
            }
        )
        .subscribe();

    // Fallback poll in case the realtime socket doesn't connect
    // (some networks block WebSockets).
    const pollTimer = setInterval(function () {
        supabaseClient
            .from("listings")
            .select("status")
            .eq("id", listingId)
            .single()
            .then(function (result) {
                if (result.error || !result.data) return;
                if (result.data.status === "approved") {
                    clearInterval(pollTimer);
                    showApproved();
                } else if (result.data.status === "rejected") {
                    clearInterval(pollTimer);
                    showRejected();
                }
            });
    }, 8000);

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
======================================== */

const chatList =
    document.getElementById("chatList");

const chatWindow =
    document.getElementById("chatWindow");

let conversations = [];

let activeConversationId = null;


/* ========================================
   LOAD EXISTING CONVERSATIONS
======================================== */

async function loadConversations() {

    const { data, error } =
        await supabaseClient
            .from("conversations")
            .select("*")
            .eq("provider_id", PROVIDER_ID)
            .order("updated_at", {
                ascending: false
            });


    if (error) {

        console.error(error);

        setStatus(
            "Database error: " + error.message,
            false
        );

        return;
    }


    conversations = data || [];

    renderChatList();
}


/* ========================================
   RENDER CHAT LIST
======================================== */

function renderChatList() {

    chatList.innerHTML = "";


    const title =
        document.createElement("div");

    title.className =
        "chat-list-title";

    title.textContent = "Chats";

    chatList.appendChild(title);


    if (conversations.length === 0) {

        const empty =
            document.createElement("div");

        empty.className = "empty";

        empty.textContent =
            "No conversations yet.";

        chatList.appendChild(empty);

        return;
    }


    conversations.forEach(
        function (conversation) {

            renderChatItem(conversation);
        }
    );
}


/* ========================================
   RENDER CHAT ITEM
======================================== */

function renderChatItem(conversation) {

    const item =
        document.createElement("div");

    item.className = "chat-item";

    item.dataset.id =
        conversation.id;


    if (
        conversation.id ===
        activeConversationId
    ) {

        item.classList.add("active");
    }


    const header =
        document.createElement("div");

    header.className =
        "chat-item-header";


    const name =
        document.createElement("div");

    name.className =
        "chat-item-name";

    name.textContent =
        conversation.customer_name ||
        "Customer";


    const time =
        document.createElement("div");

    time.className =
        "chat-item-time";

    time.textContent =
        formatTime(conversation.updated_at);


    header.appendChild(name);
    header.appendChild(time);


    const service =
        document.createElement("div");

    service.className =
        "chat-item-service";

    service.textContent =
        conversation.service_name || "";


    const preview =
        document.createElement("div");

    preview.className =
        "chat-item-preview";

    preview.textContent =
        "Open conversation";


    item.appendChild(header);
    item.appendChild(service);
    item.appendChild(preview);


    item.addEventListener(
        "click",
        function () {

            openConversation(conversation);
        }
    );


    chatList.appendChild(item);


    /*
       Load the latest message so the
       inbox can show a preview.
    */

    loadLatestMessage(
        conversation.id,
        preview
    );
}


/* ========================================
   LOAD LATEST MESSAGE
======================================== */

async function loadLatestMessage(
    conversationId,
    previewElement
) {

    const { data, error } =
        await supabaseClient
            .from("messages")
            .select("*")
            .eq(
                "conversation_id",
                conversationId
            )
            .order("created_at", {
                ascending: false
            })
            .limit(1);


    if (error) {

        console.error(error);

        return;
    }


    if (
        data &&
        data.length > 0
    ) {

        previewElement.textContent =
            data[0].message;
    }
}


/* ========================================
   OPEN CONVERSATION
======================================== */

async function openConversation(
    conversation
) {

    activeConversationId =
        conversation.id;


    /*
       Highlight the selected chat.
    */

    document
        .querySelectorAll(".chat-item")
        .forEach(function (item) {

            item.classList.toggle(
                "active",
                item.dataset.id ===
                String(conversation.id)
            );
        });


    /*
       Build the chat window.
    */

    chatWindow.innerHTML = "";


    const header =
        document.createElement("div");

    header.className =
        "active-chat-header";


    const customer =
        document.createElement("div");

    customer.className =
        "active-chat-customer";

    customer.textContent =
        conversation.customer_name ||
        "Customer";


    const service =
        document.createElement("div");

    service.className =
        "active-chat-service";

    service.textContent =
        conversation.service_name || "";


    header.appendChild(customer);
    header.appendChild(service);


    /*
       Messages area
    */

    const messages =
        document.createElement("div");

    messages.className =
        "active-messages";


    /*
       Reply box
    */

    const replyBox =
        document.createElement("div");

    replyBox.className =
        "active-reply-box";


    const input =
        document.createElement("input");

    input.type = "text";

    input.placeholder =
        "Reply to customer...";


    const button =
        document.createElement("button");

    button.textContent =
        "Send";


    button.addEventListener(
        "click",
        function () {

            sendReply(
                conversation,
                input
            );
        }
    );


    input.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter"
            ) {

                sendReply(
                    conversation,
                    input
                );
            }
        }
    );


    replyBox.appendChild(input);
    replyBox.appendChild(button);


    chatWindow.appendChild(header);
    chatWindow.appendChild(messages);
    chatWindow.appendChild(replyBox);


    /*
       Load only this conversation's
       messages.
    */

    await loadMessages(
        conversation.id,
        messages
    );
}


/* ========================================
   LOAD MESSAGES
======================================== */

async function loadMessages(
    conversationId,
    container
) {

    const { data, error } =
        await supabaseClient
            .from("messages")
            .select("*")
            .eq(
                "conversation_id",
                conversationId
            )
            .order("created_at", {
                ascending: true
            });


    if (error) {

        console.error(error);

        container.textContent =
            "Could not load messages.";

        return;
    }


    container.innerHTML = "";


    if (
        !data ||
        data.length === 0
    ) {

        const empty =
            document.createElement("div");

        empty.className =
            "empty";

        empty.textContent =
            "No messages yet.";

        container.appendChild(empty);

        return;
    }


    data.forEach(function (message) {

        addMessageToContainer(
            message,
            container
        );

    });


    scrollMessagesToBottom(container);
}


/* ========================================
   ADD MESSAGE TO SCREEN
======================================== */

function addMessageToContainer(
    message,
    container
) {

    const messageElement =
        document.createElement("div");

    messageElement.className =
        "message";


    /*
       Make provider/customer messages
       visually different.
    */

    if (
        message.sender_type ===
        "provider"
    ) {

        messageElement.classList.add(
            "provider-message"
        );

    } else {

        messageElement.classList.add(
            "customer-message"
        );
    }


    const name =
        document.createElement("div");

    name.className =
        "message-name";

    name.textContent =
        message.sender_name ||
        (
            message.sender_type ===
            "provider"
                ? PROVIDER_NAME
                : "Customer"
        );


    const text =
        document.createElement("div");

    text.textContent =
        message.message;


    messageElement.appendChild(name);
    messageElement.appendChild(text);


    container.appendChild(
        messageElement
    );
}


/* ========================================
   SEND PROVIDER REPLY
======================================== */

async function sendReply(
    conversation,
    input
) {

    const message =
        input.value.trim();


    if (!message) {

        return;
    }


    input.disabled = true;


    const { error } =
        await supabaseClient
            .from("messages")
            .insert({

                conversation_id:
                    conversation.id,

                sender_type:
                    "provider",

                sender_name:
                    PROVIDER_NAME,

                message:
                    message
            });


    input.disabled = false;


    if (error) {

        console.error(error);

        alert(
            "Could not send message:\n" +
            error.message
        );

        return;
    }


    input.value = "";
}


/* ========================================
   REALTIME
======================================== */

function startRealtime() {

    const channel =
        supabaseClient
            .channel(
                "provider-messages-" +
                PROVIDER_ID
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages"
                },
                async function (payload) {

                    console.log(
                        "New message:",
                        payload.new
                    );


                    const message =
                        payload.new;


                    /*
                       Find which conversation
                       this message belongs to.
                    */

                    const {
                        data: conversation
                    } =
                        await supabaseClient
                            .from(
                                "conversations"
                            )
                            .select("*")
                            .eq(
                                "id",
                                message.conversation_id
                            )
                            .eq(
                                "provider_id",
                                PROVIDER_ID
                            )
                            .maybeSingle();


                    if (!conversation) {

                        return;
                    }


                    /*
                       If this is a brand-new
                       conversation, reload
                       the inbox.
                    */

                    const exists =
                        conversations.some(
                            function (item) {

                                return (
                                    item.id ===
                                    conversation.id
                                );
                            }
                        );


                    if (!exists) {

                        await loadConversations();

                        return;
                    }


                    /*
                       If the conversation is
                       currently open, display
                       the new message.
                    */

                    if (
                        activeConversationId ===
                        conversation.id
                    ) {

                        const messageContainer =
                            document.querySelector(
                                ".active-messages"
                            );


                        if (
                            messageContainer
                        ) {

                            /*
                               Remove empty message
                               placeholder if present.
                            */

                            const empty =
                                messageContainer
                                    .querySelector(
                                        ".empty"
                                    );

                            if (empty) {

                                empty.remove();
                            }


                            addMessageToContainer(
                                message,
                                messageContainer
                            );


                            scrollMessagesToBottom(
                                messageContainer
                            );
                        }

                    }


                    /*
                       Update conversation
                       information in memory.
                    */

                    const index =
                        conversations.findIndex(
                            function (item) {

                                return (
                                    item.id ===
                                    conversation.id
                                );
                            }
                        );


                    if (index !== -1) {

                        conversations[index] =
                            conversation;
                    }


                    /*
                       Refresh the inbox so
                       latest-message previews
                       and ordering update.
                    */

                    renderChatList();
                }
            )
            .subscribe(
                function (status) {

                    console.log(
                        "Realtime status:",
                        status
                    );


                    if (
                        status ===
                        "SUBSCRIBED"
                    ) {

                        setStatus(
                            "● Connected to ServiceHub",
                            true
                        );

                    } else if (
                        status ===
                        "CHANNEL_ERROR"
                    ) {

                        setStatus(
                            "Realtime connection error",
                            false
                        );
                    }
                }
            );
}


/* ========================================
   TIME FORMAT
======================================== */

function formatTime(
    timestamp
) {

    if (!timestamp) {

        return "";
    }


    return new Date(
        timestamp
    ).toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


/* ========================================
   SCROLL CHAT
======================================== */

function scrollMessagesToBottom(
    container
) {

    container.scrollTop =
        container.scrollHeight;
}