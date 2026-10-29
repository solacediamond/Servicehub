# Link Guard (link safety) — what changed

New file: `link-guard.js` (loaded first on every page that has a text box).
Every text box is default-deny: it accepts NO links unless it has a policy.

| Policy       | Where                                                                 | Allowed links |
|--------------|-----------------------------------------------------------------------|---------------|
| none         | names, company, job title, about, requirements, feedback, search      | none          |
| contact      | Contact info, Telegram, WhatsApp, Phone (both listing types + manage) | WhatsApp, Telegram, Discord, Signal, Messenger, Skype, Viber, LINE + Instagram, Facebook, X, LinkedIn, TikTok, Snapchat, Threads, YouTube |
| social       | Portfolio (service form + manage page)                                | social platforms + portfolio places (Behance, Dribbble, GitHub, Drive, Dropbox, Figma, Canva, Notion, Linktree ...) |
| googleform   | "Google Form link" (job form + manage page)                           | docs.google.com/forms, forms.gle, forms.google.com (https only) |
| site         | manage-link boxes                                                     | ServiceHub's own address |
| all          | every chat box (customer, provider, legacy)                           | all of the above combined + ServiceHub's own links |

Disallowed text is deleted from the box straight away and a small notice explains why.
Stored listings and chat messages are re-checked when they are shown, so old bad links disappear too.

## Change what a box allows
Add `data-link-policy="contact"` (or none / social / googleform / site / all / off) to the `<input>` or `<textarea>`.

## Allow another website
Open `link-guard.js`, add the domain to the matching list at the top (MESSAGING, PROFILES, MEDIA, PORTFOLIO or GFORM).
Subdomains are covered automatically.

## Also changed
`script.js`, `jobs.html`, `chat.html`, `manage.html`, `service.html`, `conversation.html`, `provider.html`,
`list-service.html`, `login.html`, `index.html`, `explore.html`, `search.html`: script tag, send/save checks, display cleaning, hint text.
`sw.js`: caches link-guard.js and bumps the cache version so phones pick up the update.

Important: this runs in the browser. Enforce the same rules in Apps Script and Supabase too (see the suggestions).
