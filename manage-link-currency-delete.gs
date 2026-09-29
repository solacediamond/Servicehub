/*****************************************************
 * CURRENCY + DELETE UPDATES  (for "manage link.gs")
 *
 * 1. In manageRowToObject_ : replace the hard-coded
 *        currency: 'NGN',
 *    line with the line shown in STEP 1 below.
 *
 * 2. Replace the WHOLE existing updateManagePrice
 *    function with the one below.
 *
 * 3. Paste deleteManageListing at the bottom of the file.
 *
 * 4. Route the new action in doPost (code.gs), next to
 *    where 'updateManagePrice' is routed:
 *        if (action === 'deleteManageListing') return json(deleteManageListing(data));
 *    (use whatever response helper your other manage actions use)
 *****************************************************/


/* ---------- STEP 1: inside manageRowToObject_ ----------
   BEFORE:  currency: 'NGN',
   AFTER:   currency: (val('Currency') || 'NGN').toUpperCase(),
-------------------------------------------------------- */


/* Accepts NGN / USD / naira / dollar / ₦ / $ and returns 'NGN', 'USD' or ''. */
function normalizeManageCurrency_(value) {
  const v = String(value == null ? '' : value).trim().toUpperCase();
  if (v === 'NGN' || v === 'NAIRA' || v === '₦') return 'NGN';
  if (v === 'USD' || v === 'DOLLAR' || v === 'DOLLARS' || v === '$') return 'USD';
  return '';
}


/*************
 * doPost {action:'updateManagePrice', token, price, currency?}
 * currency is optional; when sent it must be NGN or USD.
 *************/
function updateManagePrice(data) {

  const found = verifyManageToken_(data.listingId, data.token);
  if (!found) return { success: false, error: 'Invalid link' };

  const price = normalizeAmount(data.price);
  if (price === null || price <= 0) {
    return { success: false, error: 'Enter a valid price.' };
  }

  const sentCurrency = data.currency !== undefined && String(data.currency).trim() !== '';
  const currency = normalizeManageCurrency_(data.currency);
  if (sentCurrency && !currency) {
    return { success: false, error: 'Choose Naira or Dollar.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const refreshed = verifyManageToken_(data.listingId, data.token);
    if (!refreshed) return { success: false, error: 'Invalid link' };

    const sheet = refreshed.sheet;
    const headers = refreshed.headers;
    const rowIndex = refreshed.rowIndex;

    sheet.getRange(rowIndex, headers['Price'] + 1).setValue(price);

    let savedCurrency = '';
    if (currency) {
      /* Creates the Currency column if the sheet does not have it yet. */
      ensureColumn(sheet, headers, 'Currency');
      sheet.getRange(rowIndex, headers['Currency'] + 1).setValue(currency);
      savedCurrency = currency;
    } else if (headers['Currency'] !== undefined) {
      savedCurrency = cleanString(refreshed.row[headers['Currency']]).toUpperCase() || 'NGN';
    } else {
      savedCurrency = 'NGN';
    }

    if (headers['Updated At'] !== undefined) {
      sheet.getRange(rowIndex, headers['Updated At'] + 1).setValue(new Date());
    }

    return { success: true, price: price, currency: savedCurrency };

  } finally {
    lock.releaseLock();
  }
}


/*************
 * doPost {action:'deleteManageListing', token}
 *
 * Soft delete: the row stays in the sheet for your records but
 *  - Status becomes 'deleted' (so getListings / Explore stop showing it,
 *    because the site only renders status = 'approved')
 *  - the Manage Token Hash is cleared, so the manage link stops working
 *************/
function deleteManageListing(data) {

  const found = verifyManageToken_(data.listingId, data.token);
  if (!found) return { success: false, error: 'Invalid link' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const refreshed = verifyManageToken_(data.listingId, data.token);
    if (!refreshed) return { success: false, error: 'Invalid link' };

    const sheet = refreshed.sheet;
    const headers = refreshed.headers;
    const rowIndex = refreshed.rowIndex;

    if (headers['Status'] === undefined) {
      return { success: false, error: 'Listings sheet has no Status column.' };
    }

    sheet.getRange(rowIndex, headers['Status'] + 1).setValue('deleted');

    ensureColumn(sheet, headers, 'Deleted At');
    sheet.getRange(rowIndex, headers['Deleted At'] + 1).setValue(new Date());

    /* Kill the manage link. */
    sheet.getRange(rowIndex, headers[MANAGE_COL_HASH] + 1).setValue('');

    if (headers['Updated At'] !== undefined) {
      sheet.getRange(rowIndex, headers['Updated At'] + 1).setValue(new Date());
    }

    return { success: true, deleted: true };

  } finally {
    lock.releaseLock();
  }
}
