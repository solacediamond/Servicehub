/* =================================
   SERVICEHUB JAVASCRIPT
================================= */

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


            const items =
                Array.from(
                    document.querySelectorAll(
                        ".service-card, .category-card, [data-service], [data-category]"
                    )
                );


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
            chatProviderName.textContent = "Solaceproeditz";
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
            provider: "Solaceproeditz",
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
        function (event) {

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


            if (
                mediaInput &&
                mediaInput.files
            ) {

                Array
                    .from(mediaInput.files)
                    .forEach(
                        function (file) {

                            mediaFiles.push({

                                name:
                                    file.name,

                                type:
                                    file.type,

                                size:
                                    file.size

                            });

                        }
                    );

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
                    mediaFiles,

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

            /* ---------- SEND LISTING TO BACKEND ---------- */
            sendToServiceHubBackend(
                "listings",
                listingData
            ).then(function (result) {
                if (!result.ok && !result.offline) {
                    console.error("ServiceHub listing backend error:", result);
                }
            });


            /* ---------- GO TO PAYMENT ---------- */

            window.location.href =
                "payment.html";

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

    function storeBackendCard(card) {
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

        addBackendCardToPage(cards[card.id], card.id);
    }

    function addBackendCardToPage(cardData, cardId) {
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
                    <span>${escapeCardText(cardData.title)}</span>
                </div>
                <div class="service-info">
                    <p class="service-category">
                        ${escapeCardText(cardData.category || "SERVICE")}
                    </p>
                    <h3>${escapeCardText(cardData.title)}</h3>
                    <p class="provider">${escapeCardText(cardData.provider)}</p>
                    <div class="service-bottom">
                        <span>⭐ ${escapeCardText(cardData.rating)}</span>
                        <strong>From ${escapeCardText(cardData.price)}</strong>
                    </div>
                </div>
            `;

            container.prepend(card);
        });
    }

    function escapeCardText(value) {
        const div = document.createElement("div");
        div.textContent = value == null ? "" : String(value);
        return div.innerHTML;
    }

    // Load cards that were created before this browser opened.
    fetch(apiBase + "/listings")
        .then(function (response) {
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response.json();
        })
        .then(function (data) {
            (data.cards || []).forEach(function (command) {
                if (command.card) storeBackendCard(command.card);
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
                    storeBackendCard(command.card);
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
