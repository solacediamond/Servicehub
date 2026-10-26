SUPPORT & FEEDBACK BUTTON — SETUP

FILES
  support-desk.js     new  (button + glass overlays; uses the site's existing Apps Script URL)
  SupportDesk.gs      new  (add to the Apps Script project as a new file)
  9 pages             one line added after the social-fab line:
                      index, explore, how-it-works, jobs, list-service, login,
                      provider, search, service
                      <script src="/support-desk.js" defer></script>

APPS SCRIPT (2 steps)
  1. Apps Script editor > + > Script > name it SupportDesk > paste SupportDesk.gs.
     If your Code.gs opens the sheet with openById('...'), paste that same ID into
     SUPPORT_DESK_SPREADSHEET_ID at the top. If it uses getActiveSpreadsheet(), leave it empty.
  2. In Code.gs, make this the FIRST line inside doPost(e) { ... } :

        var sd = supportDeskRoute_(e); if (sd) return sd;

     That is the only change to Code.gs. It does nothing for any other action.
     (SupportDesk.gs cannot have its own doPost, because Code.gs already has one.)
  3. Deploy > Manage deployments > edit the existing deployment > New version > Deploy.
     Keep the same web app URL.
  Optional: run supportDeskSetup once to create both tabs before launch.

SHEET TABS (created automatically, missing columns are added)
  Feedback      Timestamp | Feedback ID | Type (Complaint / Suggestion) | Message | Page | Status
  Support Team  Name | WhatsApp | Telegram | Active
     - one row per supporter; fill WhatsApp, Telegram, or both
     - WhatsApp: international format, e.g. 2348012345678 or +234 801 234 5678
       (a Nigerian 0801... number is also converted)
     - Telegram: @username, username, a t.me link, or a phone number
     - Active: leave empty or "yes" to show; type "no" to hide a supporter
  Only Name, WhatsApp and Telegram are ever sent to the website.

CHANGING THE PUBLIC CHANNEL
  Top of support-desk.js: TELEGRAM_CHANNEL (currently https://t.me/HubService_01, the one the site already uses).
