/* ========================================
   SERVICEHUB MANAGE-LINK MODAL
   Load on index.html AFTER script.js.

   Flow:
   1. list-service saves the manage token in localStorage
      ("serviceHubManageTokens", keyed by listing ID).
   2. When payment is approved, script.js sets
      "serviceHubManageLinkPending" = listing ID.
   3. The existing success popup runs and redirects to index.html.
   4. This file sees the pending flag and shows the modal.
   5. It also asks Apps Script to email the link (server only sends
      if the contact is an email and the daily quota allows).
   6. "I've saved it" removes the token from this browser.
======================================== */
(function () {
    "use strict";

    var PENDING_KEY = "serviceHubManageLinkPending";
    var TOKENS_KEY = "serviceHubManageTokens";

    var listingId = "";
    var tokens = {};

    try {
        listingId = localStorage.getItem(PENDING_KEY) || "";
        tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || "{}") || {};
    } catch (_) {
        return;
    }

    if (!listingId) return;

    var token = tokens[listingId];

    if (!token) {
        try { localStorage.removeItem(PENDING_KEY); } catch (_) {}
        return;
    }

    var manageUrl =
        new URL("manage.html", window.location.href).href.split("#")[0] +
        "#" + token;

    /* ---------- styles ---------- */
    var style = document.createElement("style");
    style.textContent =
        ".sh-manage-overlay{position:fixed;inset:0;z-index:99999;display:flex;" +
        "align-items:center;justify-content:center;padding:18px;" +
        "background:rgba(3,7,18,.78);backdrop-filter:blur(4px);}" +
        ".sh-manage-box{width:100%;max-width:440px;background:#0b1220;color:#e8eefc;" +
        "border:1px solid rgba(59,130,246,.35);border-radius:18px;padding:24px 20px;" +
        "box-shadow:0 20px 60px rgba(0,0,0,.55);font-family:inherit;}" +
        ".sh-manage-box h2{margin:0 0 10px;font-size:1.25rem;}" +
        ".sh-manage-warning{margin:0 0 14px;font-size:.92rem;line-height:1.5;" +
        "color:#c7d2ee;}" +
        ".sh-manage-sub{margin:0 0 16px;font-size:.9rem;font-weight:600;" +
        "color:#93c5fd;}" +
        ".sh-manage-linkrow{display:flex;align-items:stretch;gap:8px;margin-bottom:10px;}" +
        ".sh-manage-link{flex:1;min-width:0;padding:11px 12px;border-radius:12px;" +
        "background:#060b16;border:1px solid rgba(148,163,184,.25);color:#e8eefc;" +
        "font-size:.82rem;word-break:break-all;line-height:1.35;}" +
        ".sh-manage-copy{flex:0 0 46px;border:0;border-radius:12px;cursor:pointer;" +
        "background:#2563eb;color:#fff;display:flex;align-items:center;" +
        "justify-content:center;}" +
        ".sh-manage-copy:active{transform:scale(.96);}" +
        ".sh-manage-note{min-height:1.2em;margin:0 0 12px;font-size:.82rem;color:#86efac;}" +
        ".sh-manage-done{width:100%;padding:12px;border:0;border-radius:12px;" +
        "cursor:pointer;background:#1e293b;color:#e8eefc;font-size:.95rem;" +
        "font-weight:600;}";
    document.head.appendChild(style);

    /* ---------- markup ---------- */
    var overlay = document.createElement("div");
    overlay.className = "sh-manage-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "shManageTitle");

    var box = document.createElement("div");
    box.className = "sh-manage-box";

    var title = document.createElement("h2");
    title.id = "shManageTitle";
    title.textContent = "Manage your listing";

    var warning = document.createElement("p");
    warning.className = "sh-manage-warning";
    warning.textContent =
        "This is the link to manage your listed service/job keep this and be " +
        "cautious of who you share it with as anyone with this link can " +
        "access your chats and make any possible edits";

    var sub = document.createElement("p");
    sub.className = "sh-manage-sub";
    sub.textContent = "Your current subscription would last 6 months";

    var row = document.createElement("div");
    row.className = "sh-manage-linkrow";

    var linkBox = document.createElement("div");
    linkBox.className = "sh-manage-link";
    linkBox.textContent = manageUrl;

    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "sh-manage-copy";
    copyBtn.setAttribute("aria-label", "Copy link");
    copyBtn.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/>' +
        '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

    var note = document.createElement("p");
    note.className = "sh-manage-note";

    var done = document.createElement("button");
    done.type = "button";
    done.className = "sh-manage-done";
    done.textContent = "I've saved it";

    row.appendChild(linkBox);
    row.appendChild(copyBtn);
    box.appendChild(title);
    box.appendChild(warning);
    box.appendChild(sub);
    box.appendChild(row);
    box.appendChild(note);
    box.appendChild(done);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    /* ---------- copy ---------- */
    function fallbackCopy() {
        var range = document.createRange();
        range.selectNodeContents(linkBox);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        try { document.execCommand("copy"); } catch (_) {}
        sel.removeAllRanges();
    }

    copyBtn.addEventListener("click", function () {
        function ok() {
            note.textContent = "Link copied";
            setTimeout(function () {
                if (note.textContent === "Link copied") note.textContent = "";
            }, 2500);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(manageUrl).then(ok, function () {
                fallbackCopy();
                ok();
            });
        } else {
            fallbackCopy();
            ok();
        }
    });

    /* ---------- finish ---------- */
    done.addEventListener("click", function () {
        try {
            delete tokens[listingId];
            localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
            localStorage.removeItem(PENDING_KEY);
        } catch (_) {}
        overlay.remove();
        style.remove();
    });

    /* ---------- email a copy (silent unless it worked) ---------- */
    try {
        if (typeof postToExistingAppsScript === "function") {
            postToExistingAppsScript({
                action: "sendManageLink",
                listingId: listingId,
                token: token,
                manageUrl: manageUrl
            }).then(function (result) {
                if (result && result.emailed === true) {
                    note.textContent = "A copy was also sent to your email.";
                }
            }).catch(function () { /* stay quiet */ });
        }
    } catch (_) { /* stay quiet */ }
})();
