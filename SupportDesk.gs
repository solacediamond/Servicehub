/*****************************************************************
 * SERVICEHUB SUPPORT DESK  (standalone file: SupportDesk.gs)
 *
 * Handles the website's "Support & Feedback" button.
 *
 *   1. submitFeedback      -> writes a row to the "Feedback" tab
 *                             (Type column = Complaint or Suggestion)
 *   2. getSupportContacts  -> reads the "Support Team" tab and returns
 *                             the supporters' WhatsApp / Telegram contacts
 *
 * Both tabs, and any missing columns, are created automatically.
 *
 * This file does NOT define doGet / doPost, so it cannot clash with
 * Code.gs. Code.gs only needs the ONE line shown in README (inside
 * doPost). Every function here ends in "_" or starts with
 * "supportDesk" so it cannot clash with your existing function names.
 *
 * Both actions use POST, so doGet is not touched at all.
 *****************************************************************/

/* ---------- SETTINGS ---------- */

// Leave '' when Code.gs uses SpreadsheetApp.getActiveSpreadsheet()
// (script opened from the sheet via Extensions > Apps Script).
// If Code.gs opens the sheet with openById('...'), paste that SAME ID here.
var SUPPORT_DESK_SPREADSHEET_ID = '';

var SUPPORT_DESK_FEEDBACK_TAB = 'Feedback';
var SUPPORT_DESK_TEAM_TAB     = 'Support Team';

var SUPPORT_DESK_FEEDBACK_HEADERS = [
  'Timestamp', 'Feedback ID', 'Type', 'Message', 'Page', 'Status'
];
// One row per supporter. One supporter can have WhatsApp, Telegram, or both.
var SUPPORT_DESK_TEAM_HEADERS = [
  'Name', 'WhatsApp', 'Telegram', 'Active'
];

var SUPPORT_DESK_MAX_MESSAGE = 2000;


/* ---------- ENTRY POINT (called from doPost in Code.gs) ---------- */

/**
 * Returns a ready JSON response when the request is one of ours,
 * or null when it is not (so Code.gs carries on as normal).
 */
function supportDeskRoute_(e) {
  var data;
  try {
    data = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : '');
  } catch (err) {
    return null;                       // not JSON -> not ours
  }
  if (!data || typeof data !== 'object') return null;

  var action = String(data.action || '');
  try {
    if (action === 'submitFeedback')     return supportDeskJson_(supportDeskSubmitFeedback_(data));
    if (action === 'getSupportContacts') return supportDeskJson_(supportDeskGetContacts_());
  } catch (err2) {
    return supportDeskJson_({ success: false, error: String(err2 && err2.message ? err2.message : err2) });
  }
  return null;                         // some other action -> let Code.gs handle it
}

function supportDeskJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ---------- 1. FEEDBACK ---------- */

function supportDeskSubmitFeedback_(data) {
  var typeRaw = String(data.type || '').trim().toLowerCase();
  var type = typeRaw === 'complaint' ? 'Complaint' : (typeRaw === 'suggestion' ? 'Suggestion' : '');
  if (!type) return { success: false, error: 'Type must be Complaint or Suggestion.' };

  var message = String(data.message || '').trim();
  if (!message) return { success: false, error: 'Please write a message.' };
  if (message.length > SUPPORT_DESK_MAX_MESSAGE) message = message.slice(0, SUPPORT_DESK_MAX_MESSAGE);

  // Ignore an identical message sent again within 60 seconds (double taps).
  var cache = CacheService.getScriptCache();
  var key = 'sdfb_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, type + '|' + message)
  );
  var earlier = cache.get(key);
  if (earlier) return { success: true, feedbackId: earlier, duplicate: true };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = supportDeskEnsureSheet_(SUPPORT_DESK_FEEDBACK_TAB, SUPPORT_DESK_FEEDBACK_HEADERS);
    var cols = supportDeskHeaderMap_(sheet);

    var feedbackId = 'FB-' + supportDeskRandomId_(6);
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    var values = {
      'Timestamp':   now,
      'Feedback ID': feedbackId,
      'Type':        type,
      'Message':     message,
      'Page':        String(data.pageUrl || '').slice(0, 500),
      'Status':      'New'
    };

    var row = [];
    for (var c = 0; c < sheet.getLastColumn(); c++) row.push('');
    Object.keys(values).forEach(function (h) {
      if (cols[h] !== undefined) row[cols[h]] = values[h];
    });

    // Plain-text format on the new row, so a message that starts with
    // = + - @ is stored as text and never run as a formula.
    var target = sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length);
    target.setNumberFormat('@');
    target.setValues([row]);

    cache.put(key, feedbackId, 60);
    return { success: true, feedbackId: feedbackId };
  } finally {
    lock.releaseLock();
  }
}


/* ---------- 2. SUPPORT CONTACTS ---------- */

function supportDeskGetContacts_() {
  var sheet = supportDeskEnsureSheet_(SUPPORT_DESK_TEAM_TAB, SUPPORT_DESK_TEAM_HEADERS);
  var cols = supportDeskHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  var contacts = [];

  if (lastRow >= 2) {
    var rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getDisplayValues();
    rows.forEach(function (r) {
      var name     = String(r[cols['Name']]     || '').trim();
      var whatsapp = String(r[cols['WhatsApp']] || '').trim();
      var telegram = String(r[cols['Telegram']] || '').trim();
      var active   = String(r[cols['Active']]   || '').trim().toLowerCase();

      if (!whatsapp && !telegram) return;                       // nothing to show
      if (['no', 'n', 'false', '0', 'off', 'inactive', 'hidden'].indexOf(active) !== -1) return;

      contacts.push({ name: name || 'Support', whatsapp: whatsapp, telegram: telegram });
    });
  }
  // Only these three fields ever leave the sheet.
  return { success: true, contacts: contacts };
}


/* ---------- SHEET HELPERS (auto-create tabs + columns) ---------- */

function supportDeskSpreadsheet_() {
  var ss = SUPPORT_DESK_SPREADSHEET_ID
    ? SpreadsheetApp.openById(SUPPORT_DESK_SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('SupportDesk: no spreadsheet found. Paste the sheet ID into SUPPORT_DESK_SPREADSHEET_ID.');
  }
  return ss;
}

/** Gets the tab (creating it if missing) and adds any missing header columns. */
function supportDeskEnsureSheet_(name, headers) {
  var ss = supportDeskSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  var isNew = false;
  if (!sheet) { sheet = ss.insertSheet(name); isNew = true; }

  var lastCol = sheet.getLastColumn();
  var existing = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); })
    : [];

  var added = false;
  headers.forEach(function (h) {
    if (existing.indexOf(h) === -1) {
      sheet.getRange(1, existing.length + 1).setValue(h);
      existing.push(h);
      added = true;
    }
  });

  if (isNew || added) {
    var headerRange = sheet.getRange(1, 1, 1, existing.length);
    headerRange.setFontWeight('bold').setBackground('#e8f0fe');
    sheet.setFrozenRows(1);

    // Phone numbers / handles must stay exactly as typed (keep "+" and leading zeros).
    ['WhatsApp', 'Telegram'].forEach(function (h) {
      var idx = existing.indexOf(h);
      if (idx !== -1 && sheet.getMaxRows() > 1) {
        sheet.getRange(2, idx + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
      }
    });
    if (name === SUPPORT_DESK_FEEDBACK_TAB) {
      var msgIdx = existing.indexOf('Message');
      if (msgIdx !== -1) sheet.setColumnWidth(msgIdx + 1, 420);
    }
  }
  return sheet;
}

/** { 'Header name': zeroBasedColumnIndex } */
function supportDeskHeaderMap_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  headers.forEach(function (h, i) { map[String(h).trim()] = i; });
  return map;
}

function supportDeskRandomId_(len) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}


/* ---------- OPTIONAL: run once by hand ----------
 * Creates both tabs right now (so you can fill in "Support Team"
 * before launch). Pick supportDeskSetup in the function menu and press Run.
 * It also triggers Google's permission prompt if one is needed.
 */
function supportDeskSetup() {
  supportDeskEnsureSheet_(SUPPORT_DESK_FEEDBACK_TAB, SUPPORT_DESK_FEEDBACK_HEADERS);
  supportDeskEnsureSheet_(SUPPORT_DESK_TEAM_TAB, SUPPORT_DESK_TEAM_HEADERS);
  Logger.log('Support Desk tabs are ready.');
}
