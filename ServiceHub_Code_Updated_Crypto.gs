/**
 * SERVICEHUB PAYMENT APPROVAL SYSTEM
 * 
 * LISTINGS SHEET:
 *   A  Listing ID
 *   B  Provider ID
 *   C  Service Name
 *   D  Payment Code
 *   E  Price
 *   F  Status
 *   G  Payment Code Used
 *   H  Created At
 *   I  Approved At
 *   J  Updated At
 * 
 *   * Auto-created after column J the first time a listing is
 *     inserted (no need to add these by hand - see ensureColumn()):
 *     Provider Name, Company, Contact, Phone, Whatsapp, About
 *     Portfolios, Category, Pricing, Custom Pricing, Media
 * 
 * PAYMENTS SHEET:
 *   A  Transaction ID
 *   B  Listing ID
 *   C  Payment Code
 *   D  Amount
 *   E  Currency
 *   F  Provider Reference
 *   G  Payment Status
 *   H  Rejection Reason
 *   I  Processed At
 *   J  Updated At
 */

const CONFIG = {
  // Spreadsheet containing Listings
  LISTINGS_SPREADSHEET_ID: '1F7Q2iE5DN-8s1f4nrCp2rIDA0M3-e3Hto8ij1MsoC1U',

  // Spreadsheet containing Payments.
  // If Payments is in the SAME spreadsheet as Listings,
  // use the same ID here.
  PAYMENTS_SPREADSHEET_ID: '1F7Q2iE5DN-8s1f4nrCp2rIDA0M3-e3Hto8ij1MsoC1U',

  LISTINGS_SHEET_NAME: 'Listings',
  PAYMENTS_SHEET_NAME: 'Payments',

  // Optional.
  // Leave empty and Apps Script will create/find:
  // "ServiceHub Media"
  MEDIA_FOLDER_ID: ''
};

/*****
 * GET REQUEST
 *****/

function doGet(e) {
  const action = e && e.parameter
    ? String(e.parameter.action || '').trim()
    : '';

  try {
    switch (action) {

      case 'nowalletconnect':
        return jsonResponse(
          recordNoWalletConnectPayment(
            e.parameter || {}
          )
        );

      case 'getListings':
        return jsonResponse(
          getApprovedListings()
        );

      case 'getListing':
        return jsonResponse(
          getSingleListing(
            e.parameter.listingId
          )
        );

      case 'checkPayment':
        try {
          checkPaymentsAndApproveListings();
        } catch (approvalError) {
          console.warn(
            'Auto-approval check failed:',
            approvalError
          );
        }

        return jsonResponse(
          checkPaymentStatus(
            e.parameter.listingId,
            e.parameter.code
          )
        );

      case 'health':
        return jsonResponse({
          success: true,
          status: 'online'
        });

      case 'getNextListingId':
        return jsonResponse(
          getNextListingId()
        );

      default:
        return jsonResponse({
          success: false,
          error: 'Unknown action'
        });
    }
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    });
  }
}

/*****
 * MAIN APPROVAL CHECK
 * 
 * Reads Payments.
 * Updates Listings.
 * 
 * NEVER modifies Payments.
 *****/

function checkPaymentsAndApproveListings() {
  const listingsSheet = getListingsSheet();
  const paymentsSheet = getPaymentsSheet();

  const listingsData = listingsSheet.getDataRange().getValues();
  const paymentsData = paymentsSheet.getDataRange().getValues();

  if (listingsData.length < 2 || paymentsData.length < 2) {
    return;
  }

  const listingHeaders = getHeaderIndexes(listingsData[0]);
  const paymentHeaders = getHeaderIndexes(paymentsData[0]);

  /*****
   * REQUIRED LISTINGS COLUMNS
   *****/

  requireColumn(listingHeaders, 'Listing ID');
  requireColumn(listingHeaders, 'Payment Code');
  requireColumn(listingHeaders, 'Status');
  requireColumn(listingHeaders, 'Payment Code Used');
  requireColumn(listingHeaders, 'Approved At');
  requireColumn(listingHeaders, 'Updated At');

  requireColumn(paymentHeaders, 'Listing ID');
  requireColumn(paymentHeaders, 'Payment Code');

  const paidCodes = new Set();

  for (let i = 1; i < paymentsData.length; i++) {
    const row = paymentsData[i];

    const listingId =
      cleanString(row[paymentHeaders['Listing ID']]);

    const paymentCode =
      normalizePaymentCode(row[paymentHeaders['Payment Code']]);

    if (!listingId) continue;
    if (!paymentCode) continue;

    const key = listingId + '|' + paymentCode;
    paidCodes.add(key);
  }

  for (let i = 1; i < listingsData.length; i++) {
    const row = listingsData[i];

    const listingId =
      cleanString(row[listingHeaders['Listing ID']]);

    const paymentCode =
      normalizePaymentCode(row[listingHeaders['Payment Code']]);

    const status =
      cleanString(row[listingHeaders['Status']]).toLowerCase();

    const paymentCodeUsed =
      toBoolean(row[listingHeaders['Payment Code Used']]);

    if (!listingId) continue;
    if (!paymentCode) continue;
    if (status === 'approved') continue;
    if (paymentCodeUsed === true) continue;

    const key = listingId + '|' + paymentCode;

    if (!paidCodes.has(key)) continue;

    /*****
     * APPROVE LISTING
     *****/

    listingsSheet
      .getRange(
        i + 1,
        listingHeaders['Status'] + 1
      )
      .setValue('approved');

    listingsSheet
      .getRange(
        i + 1,
        listingHeaders['Payment Code Used'] + 1
      )
      .setValue(true);

    const now = new Date();

    listingsSheet
      .getRange(
        i + 1,
        listingHeaders['Approved At'] + 1
      )
      .setValue(now);

    listingsSheet
      .getRange(
        i + 1,
        listingHeaders['Updated At'] + 1
      )
      .setValue(now);
  }
}

/*****
 * FRONTEND PAYMENT STATUS CHECK
 * 
 * Frontend sends:
 * 
 *   ?action=checkPayment
 *   &listingId=XXXXX
 *   &code=ABC123
 * 
 * THIS function ONLY READS.
 *****/

function checkPaymentStatus(listingId, paymentCode) {
  listingId =
    cleanString(listingId);

  paymentCode =
    normalizePaymentCode(paymentCode);

  if (!listingId || !paymentCode) {
    return {
      success: false,
      status: 'invalid_request'
    };
  }

  const sheet =
    getListingsSheet();

  const data =
    sheet.getDataRange().getValues();

  if (data.length < 2) {
    return {
      success: true,
      status: 'not_found'
    };
  }

  const headers =
    getHeaderIndexes(data[0]);

  requireColumn(headers, 'Listing ID');
  requireColumn(headers, 'Status');
  requireColumn(headers, 'Payment Code Used');
  requireColumn(headers, 'Approved At');

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const rowListingId =
      cleanString(
        row[headers['Listing ID']]
      );

    const rowPaymentCode =
      normalizePaymentCode(
        row[headers['Payment Code']]
      );

    if (rowListingId !== listingId) {
      continue;
    }

    if (rowPaymentCode !== paymentCode) {
      continue;
    }

    const status =
      cleanString(
        row[headers['Status']]
      ).toLowerCase();

    const codeUsed =
      toBoolean(
        row[headers['Payment Code Used']]
      );

    const approvedAt =
      row[headers['Approved At']];

    /*****
     * APPROVED
     *****/

    if (
      status === 'approved' &&
      codeUsed === true
    ) {
      return {
        success: true,
        status: 'approved',
        listingId: listingId,
        approvedAt:
          approvedAt instanceof Date
            ? approvedAt.toISOString()
            : String(approvedAt || '')
      };
    }

    /*****
     * STILL WAITING
     *****/

    return {
      success: true,
      status: 'pending',
      listingId: listingId
    };
  }

  return {
    success: true,
    status: 'not_found'
  };
}

/*****
 * GET APPROVED LISTINGS
 * 
 * Frontend marketplace calls this repeatedly.
 *****/

function getApprovedListings() {
  const sheet =
    getListingsSheet();

  const data =
    sheet.getDataRange().getValues();

  if (data.length < 2) {
    return {
      success: true,
      listings: []
    };
  }

  const headers =
    getHeaderIndexes(data[0]);

  const listings = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const status =
      cleanString(
        row[headers['Status']]
      ).toLowerCase();

    if (status !== 'approved') {
      continue;
    }

    listings.push(
      rowToObject(row, headers)
    );
  }

  return {
    success: true,
    listings: listings
  };
}

/*****
 * GET SINGLE LISTING
 *****/

function getSingleListing(listingId) {
  listingId =
    cleanString(listingId);

  if (!listingId) {
    return {
      success: false,
      error: 'Missing Listing ID'
    };
  }

  const sheet =
    getListingsSheet();

  const data =
    sheet.getDataRange().getValues();

  const headers =
    getHeaderIndexes(data[0]);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const id =
      cleanString(
        row[headers['Listing ID']]
      );

    if (id === listingId) {
      return {
        success: true,
        listing:
          rowToObject(row, headers)
      };
    }
  }

  return {
    success: false,
    error: 'Listing not found'
  };
}

/*****
 * SHEET ACCESS
 *****/

function getListingsSheet() {
  const spreadsheet =
    SpreadsheetApp.openById(
      CONFIG.LISTINGS_SPREADSHEET_ID
    );

  const sheet =
    spreadsheet.getSheetByName(
      CONFIG.LISTINGS_SHEET_NAME
    );

  if (!sheet) {
    throw new Error(
      'Listings sheet not found'
    );
  }

  return sheet;
}

function getPaymentsSheet() {
  const spreadsheet =
    SpreadsheetApp.openById(
      CONFIG.PAYMENTS_SPREADSHEET_ID
    );

  const sheet =
    spreadsheet.getSheetByName(
      CONFIG.PAYMENTS_SHEET_NAME
    );

  if (!sheet) {
    throw new Error(
      'Payments sheet not found'
    );
  }

  return sheet;
}

/*****
 * HEADER HELPERS
 *****/

function getHeaderIndexes(headers) {
  const indexes = {};

  headers.forEach(function (header, index) {
    const name =
      cleanString(header);

    if (name) {
      indexes[name] = index;
    }
  });

  return indexes;
}

function requireColumn(headers, name) {
  if (
    headers[name] === undefined
  ) {
    throw new Error(
      'Missing required column: ' + name
    );
  }
}

/*****
 * ENSURE COLUMN EXISTS
 * 
 * Unlike requireColumn (which throws), this creates the
 * header cell if it doesn't exist yet - the same pattern
 * already used for the "Media" values. Used for the extra
 * listing-form fields so older sheets don't need to be
 * edited by hand and nothing throws if they're missing.
 * 
 * Mutates and returns the same headers map with the new
 * column's index added.
 *****/

function ensureColumn(sheet, headers, name) {
  if (headers[name] !== undefined) {
    return headers;
  }

  const nextIndex =
    Object.keys(headers).length
      ? Math.max.apply(null, Object.values(headers)) + 1
      : 0;

  sheet
    .getRange(1, nextIndex + 1)
    .setValue(name);

  headers[name] = nextIndex;

  return headers;
}

/*****
 * ROW -> OBJECT
 *****/

function rowToObject(row, headers) {
  const object = {};

  Object.keys(headers).forEach(function (key) {
    let value =
      row[headers[key]];

    if (value instanceof Date) {
      value = value.toISOString();
    }

    object[key] = value;
  });

  return object;
}

/*****
 * CLEANING
 *****/

function cleanString(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}

function normalizePaymentCode(value) {
  return cleanString(value)
    .toUpperCase();
}

function normalizeAmount(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  const cleaned =
    String(value)
      .replace(/,/g, '')
      .replace(/ /g, '')
      .trim();

  const number =
    Number(cleaned);

  return Number.isFinite(number)
    ? number
    : null;
}

function amountsMatch(a, b) {
  return Math.abs(a - b) < 0.01;
}

function toBoolean(value) {
  if (value === true) {
    return true;
  }

  const normalized =
    cleanString(value)
      .toLowerCase();

  return (
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === '1'
  );
}

/*****
 * JSON RESPONSE
 *****/

function jsonResponse(data) {
  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}

/*****
 * MEDIA FOLDERS
 * 
 * NOTE: Your file had these two functions twice (lines ~802-838 and
 * ~829-855). The duplicate copy was removed. MEDIA_FOLDER_ID was
 * also sitting loose at line 869; it now lives inside CONFIG above.
 *****/

function getServiceHubMediaFolder() {
  const configuredId = String(CONFIG.MEDIA_FOLDER_ID || '').trim();

  if (configuredId) {
    return DriveApp.getFolderById(configuredId);
  }

  const folders = DriveApp.getFoldersByName('ServiceHub Media');

  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder('ServiceHub Media');
}

function getListingMediaFolder(listingId) {
  const parentFolder = getServiceHubMediaFolder();
  const folderName = String(listingId).trim();

  const folders = parentFolder.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parentFolder.createFolder(folderName);
}

/*****
 * DRIVE FILE NAMING
 * 
 * The Drive FILE is named after the Listing ID (not the
 * visitor's original filename), so anyone browsing the
 * 'ServiceHub Media' folder tree can tell at a glance which
 * listing a file belongs to.
 * 
 *   * First file for a listing -> 'SH-014.mp4'
 *   * Second file for the same listing -> 'SH-014-2.jpg'
 *     (an incrementing suffix is added only when needed, so two
 *     files never collide in the same listing folder).
 * 
 *     * NOTE: the 'name' stored on the media object returned to the
 *       frontend is still the ORIGINAL uploaded filename, not this
 *       Drive filename - script.js's upload-confirmation polling
 *       matches on the original filename, so that stays unchanged.
 *****/

function getFileExtension(fileName) {
  const match =
    /\.([a-zA-Z0-9]+)$/.exec(
      String(fileName || '').trim()
    );

  return match
    ? match[1].toLowerCase()
    : '';
}

function countFilesInFolder(folder) {
  let count = 0;

  const iterator =
    folder.getFiles();

  while (iterator.hasNext()) {
    iterator.next();
    count++;
  }

  return count;
}

function buildListingDriveFileName(listingId, originalFileName, existingFileCount) {
  const extension =
    getFileExtension(originalFileName);

  const base =
    existingFileCount > 0
      ? listingId + '-' + (existingFileCount + 1)
      : listingId;

  return base + '.' + extension;
}

/*****
 * MEDIA UPLOAD
 *****/

function uploadListingMedia(data) {
  const listingId = String(data.listingId || '').trim();
  const fileName = String(data.fileName || '').trim();
  const mimeType = String(
    data.mimeType || 'application/octet-stream'
  ).trim();
  const base64 = String(data.base64 || '').trim();

  if (!listingId) {
    throw new Error('Missing listing ID.');
  }

  if (!fileName) {
    throw new Error('Missing media filename.');
  }

  if (!base64) {
    throw new Error('Missing media data.');
  }

  // Find/create
  // ServiceHub Media / Listing ID
  const folder = getListingMediaFolder(listingId);

  // Count files already in this listing's folder BEFORE adding
  // the new one, so the new file gets the next unique name.
  const existingFileCount =
    countFilesInFolder(folder);

  const driveFileName =
    buildListingDriveFileName(
      listingId,
      fileName,
      existingFileCount
    );

  // Convert browser base64 -> Drive Blob
  const bytes = Utilities.base64Decode(base64);

  const blob = Utilities.newBlob(
    bytes,
    mimeType,
    driveFileName
  );

  // THIS is the actual Google Drive upload
  const file = folder.createFile(blob);

  // Marketplace media needs to be viewable by visitors
  try {
    file.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW
    );
  } catch (sharingError) {
    console.warn(
      'Drive sharing could not be changed:',
      sharingError
    );
  }

  const fileId = file.getId();

  const isImage = mimeType.indexOf('image/') === 0;
  const isVideo = mimeType.indexOf('video/') === 0;
  const isPdf = mimeType === 'application/pdf';

  const media = {
    id: fileId,

    // Kept as the ORIGINAL filename - script.js matches on this
    // to confirm an upload finished. Do not change to driveFileName
    name: fileName,

    // The name actually shown in Google Drive.
    driveFileName: driveFileName,

    type: mimeType,
    size: bytes.length,

    // Generic Drive page
    url:
      'https://drive.google.com/file/d/' +
      fileId +
      '/view',

    // Useful for images
    previewUrl:
      isImage
        ? 'https://drive.google.com/thumbnail?id=' + fileId
        : '',

    // Useful for video/PDF preview
    embedUrl:
      isVideo || isPdf
        ? 'https://drive.google.com/file/d/' + fileId + '/preview'
        : ''
  };

  // Store the media information in the listing
  appendMediaToListing(listingId, media);

  return {
    success: true,
    media: media
  };
}

function appendMediaToListing(listingId, media) {
  const sheet = getListingsSheet();
  const values = sheet.getDataRange().getValues();

  if (values.length < 1) {
    throw new Error('Listings sheet is empty.');
  }

  const headers = values[0].map(function (header) {
    return String(header).trim();
  });

  const listingIdColumn = headers.findIndex(function (header) {
    return header.toLowerCase() === 'listing id';
  });

  if (listingIdColumn === -1) {
    throw new Error('Listings sheet is missing "Listing ID"');
  }

  let mediaColumn = headers.findIndex(function (header) {
    return header.toLowerCase() === 'media';
  });

  // Create Media column if necessary
  if (mediaColumn === -1) {
    mediaColumn = headers.length;

    sheet
      .getRange(1, mediaColumn + 1)
      .setValue('Media');
  }

  for (let row = 1; row < values.length; row++) {
    const currentListingId =
      String(values[row][listingIdColumn]).trim();

    if (currentListingId !== String(listingId).trim()) {
      continue;
    }

    const cell =
      sheet.getRange(
        row + 1,
        mediaColumn + 1
      );

    const existing = cell.getValue();

    let mediaList = [];

    if (existing) {
      try {
        mediaList = JSON.parse(existing);
      } catch (_) {
        mediaList = [];
      }
    }

    if (!Array.isArray(mediaList)) {
      mediaList = [];
    }

    mediaList.push(media);

    cell.setValue(
      JSON.stringify(mediaList)
    );

    return true;
  }

  throw new Error(
    'Listing not found: ' + listingId
  );
}

/*****
 * JOB MANAGEMENT UPDATE
 * Uses the existing manage-token verification and the same Listings row.
 *****/
function updateManageJobDetails(data) {
  const found = verifyManageToken_(data.listingId, data.token);
  if (!found) return { success: false, error: 'Invalid link' };

  const sheet = found.sheet;
  const headers = found.headers;
  const rowIndex = found.rowIndex;
  const fields = {
    'Job Type': cleanString(data.jobType),
    'Job Requirements': cleanString(data.jobRequirements),
    'Google Form Link': cleanString(data.googleFormLink),
    'Telegram': cleanString(data.telegram),
    'Provider Name': cleanString(data.providerName),
    'Company': cleanString(data.company),
    'Contact': cleanString(data.contact),
    'WhatsApp': cleanString(data.phone)
  };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const refreshed = verifyManageToken_(data.listingId, data.token);
    if (!refreshed) return { success: false, error: 'Invalid link' };

    Object.keys(fields).forEach(function(name) {
      ensureColumn(sheet, refreshed.headers, name);
      sheet.getRange(refreshed.rowIndex, refreshed.headers[name] + 1).setValue(fields[name]);
    });

    ensureColumn(sheet, refreshed.headers, 'Listing Type');
    sheet.getRange(refreshed.rowIndex, refreshed.headers['Listing Type'] + 1).setValue('job');

    if (refreshed.headers['Updated At'] !== undefined) {
      sheet.getRange(refreshed.rowIndex, refreshed.headers['Updated At'] + 1).setValue(new Date());
    }

    return { success: true, updated: true };
  } finally {
    lock.releaseLock();
  }
}

/*****
 * POST REQUEST
 *****/

function doPost(e) {
  try {
    const data =
      JSON.parse(
        e.postData.contents
      );

    // NO-WALLET-CONNECT CRYPTO PAYMENT
    if (data.action === 'recordNoWalletConnectPayment') {
      return jsonResponse(
        recordNoWalletConnectPayment(data)
      );
    }

    /*****
     * CREATE LISTING
     *****/

    if (data.action === 'createListing') {
      const result =
        createListingWithPaymentCode(
          data
        );

      return ContentService
        .createTextOutput(
          JSON.stringify(result)
        )
        .setMimeType(
          ContentService.MimeType.JSON
        );
    }

    /*****
     * LIKE / UNLIKE LISTING
     *****/

    if (data.action === 'toggleLike') {
      const result =
        toggleListingLike(data);

      return ContentService
        .createTextOutput(
          JSON.stringify(result)
        )
        .setMimeType(
          ContentService.MimeType.JSON
        );
    }

    /*****
     * MEDIA UPLOAD
     *****/

    if (data.action === 'uploadMedia') {
      const result =
        uploadListingMedia(data);

      return ContentService
        .createTextOutput(
          JSON.stringify(result)
        )
        .setMimeType(
          ContentService.MimeType.JSON
        );
    }

    if (data.action === 'sendManageLink') {
      const result = sendManageLink(data);

      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'getManageListing') {
      return jsonResponse(getManageListing(data));
    }

    if (data.action === 'updateManageJobDetails') {
      return jsonResponse(updateManageJobDetails(data));
    }

    if (data.action === 'updateManageListing') {
      return jsonResponse(updateManageListing(data));
    }

    if (data.action === 'updateManagePrice') {
      return jsonResponse(updateManagePrice(data));
    }

    if (data.action === 'uploadManageMedia') {
      return jsonResponse(uploadManageMedia(data));
    }

    if (data.action === 'deleteManageListing') {
      return jsonResponse(deleteManageListing(data));
    }

    /*****
     * UNKNOWN ACTION
     *****/

    return ContentService
      .createTextOutput(
        JSON.stringify({
          success: false,
          error: 'Unknown action'
        })
      )
      .setMimeType(
        ContentService.MimeType.JSON
      );

  } catch (error) {

    return ContentService
      .createTextOutput(
        JSON.stringify({
          success: false,
          error: error.message
        })
      )
      .setMimeType(
        ContentService.MimeType.JSON
      );
  }
}

/*****
 * SERVICEHUB LISTING + PAYMENT CODE SYSTEM
 * 
 * This file works together with your existing
 * ServiceHub Code.gs in the SAME Apps Script project.
 * 
 * LISTINGS SHEET:
 *   A Listing ID
 *   B Provider ID
 *   C Service Name
 *   D Payment Code
 *   E Price
 *   F Status
 *   G Payment Code Used
 *   H Created At
 *   I Approved At
 *   J Updated At
 *****/

/*****
 * CREATE LISTING + ASSIGN PAYMENT CODE
 * 
 * FRONTEND SENDS:
 * 
 *   {
 *     action: "createListing",
 *     listingId: "SH-001",
 *     providerId: "solopreneur1",
 *     serviceName: "Video Editing",
 *     price: 300
 *   }
 * 
 * APPS SCRIPT:
 *   1. Checks the listing ID
 *   2. Creates the listing row
 *   3. Generates a unique 6-character code
 *   4. Writes it into Payment Code
 *   5. Returns the stored code
 *****/

function createListingWithPaymentCode(data) {
  if (!data) {
    throw new Error('Missing listing data.');
  }

  /* READ FRONTEND DATA */

  const requestedListingId =
    cleanString(data.listingId);

  let listingId =
    requestedListingId;

  const providerId =
    cleanString(data.providerId);

  const serviceName =
    cleanString(data.serviceName);

  const listingType =
    cleanString(data.listingType || data.type).toLowerCase() === 'job'
      ? 'job'
      : 'service';

  const price =
    normalizeAmount(data.price);

  const jobType = cleanString(data.jobType);
  const jobRequirements = cleanString(data.expectedQualifications || data.jobRequirements);
  const googleFormLink = cleanString(data.googleFormLink || data.googleForm);
  const telegram = cleanString(data.telegram);

  /* EXTRA LIST-SERVICE FORM FIELDS
   * 
   * These all come from list-service.html via script.js's
   * createAppsScriptListing() payload. None of them are
   * required to create the listing (unlike the fields above);
   * they're just stored alongside it.
   * 
   * Note: script.js currently sends the pricing-category
   * checkbox selections (an array) under the key
   * "pricingRank" -- the actual pricing-tier selectbox value
   * isn't sent under a separate key. That's read here as-is,
   * unchanged, so the frontend doesn't need to be touched.
   */

  const providerName =
    cleanString(data.providerName);

  const company =
    cleanString(data.company);

  const contact =
    cleanString(data.contact);

  const phone =
    cleanString(data.phone);

  const whatsapp =
    cleanString(data.whatsapp);

  const about =
    cleanString(data.about);

  const mediaList = portfolio =
    cleanString(data.portfolio);

  const category =
    cleanString(data.category);

  const pricingSelections =
    Array.isArray(data.pricingRank)
      ? data.pricingRank
      : [];

  let pricingJson = '[]';

  try {
    pricingJson =
      JSON.stringify(pricingSelections);
  } catch (pricingError) {
    pricingJson = '[]';
  }

  // Frontend already JSON.stringify()s this before sending it,
  // so it arrives here as a JSON encoded string - store as-is.
  const customPricingJson =
    cleanString(data.customPricing) || '[]';

  /* REQUIRED INFORMATION */

  if (!listingId) {
    throw new Error('Missing Listing ID.');
  }

  if (!providerId) {
    throw new Error('Missing Provider ID.');
  }

  if (!serviceName) {
    throw new Error('Missing Service Name.');
  }

  if (price === null) {
    throw new Error('Invalid listing price.');
  }

  /* GET LISTINGS SHEET */

  const sheet =
    getListingsSheet();

  const dataRange =
    sheet.getDataRange();

  const values =
    dataRange.getValues();

  if (values.length < 1) {
    throw new Error(
      'Listings sheet must contain a header row.'
    );
  }

  /* READ HEADERS */

  const headers =
    getHeaderIndexes(values[0]);

  requireColumn(
    headers,
    'Listing ID'
  );

  requireColumn(
    headers,
    'Provider ID'
  );

  requireColumn(
    headers,
    'Service Name'
  );

  requireColumn(
    headers,
    'Payment Code'
  );

  requireColumn(
    headers,
    'Price'
  );

  requireColumn(
    headers,
    'Status'
  );

  requireColumn(
    headers,
    'Payment Code Used'
  );

  requireColumn(
    headers,
    'Created At'
  );

  requireColumn(
    headers,
    'Approved At'
  );

  requireColumn(
    headers,
    'Updated At'
  );

  /*****
   * CHECK WHETHER LISTING ALREADY EXISTS
   * 
   * This prevents accidentally creating the same
   * listing twice.
   *****/

  const listingIdColumn =
    headers['Listing ID'];

  /* If the requested ID already exists, keep the existing idempotent
   * behavior below. Otherwise the backend assigns the next sequential
   * SH-number from the actual sheet.
   */

  let requestedListingExists = false;

  for (let i = 1; i < values.length; i++) {
    if (cleanString(values[i][listingIdColumn]) === requestedListingId) {
      requestedListingExists = true;
      break;
    }
  }

  if (!requestedListingExists) {
    listingId = getNextSequentialListingId(
      values,
      listingIdColumn
    );
  }

  for (
    let i = 1;
    i < values.length;
    i++
  ) {
    const existingListingId =
      cleanString(
        values[i][listingIdColumn]
      );

    if (
      existingListingId === listingId
    ) {
      /*****
       * LISTING ALREADY EXISTS
       *****/

      const existingPaymentCode =
        normalizePaymentCode(
          values[i][headers['Payment Code']]
        );

      /* If it already has a payment code,
       * return that exact code.
       */

      if (existingPaymentCode) {
        return {
          success: true,
          created: false,
          listingId: listingId,
          providerId: providerId,
          serviceName: serviceName,
          price: price,
          paymentCode: existingPaymentCode,
          status:
            cleanString(
              values[i][headers['Status']]
            ).toLowerCase()
        };
      }

      /* If the listing exists but has no code,
       * assign one to the existing row.
       */

      const paymentCode =
        generateUniquePaymentCode();

      sheet
        .getRange(
          i + 1,
          headers['Payment Code'] + 1
        )
        .setValue(paymentCode);

      return {
        success: true,
        created: false,
        listingId: listingId,
        providerId: providerId,
        serviceName: serviceName,
        price: price,
        paymentCode: paymentCode,
        status:
          cleanString(
            values[i][headers['Status']]
          ).toLowerCase()
      };
    }
  }

  /*****
   * LISTING DOES NOT EXIST
   * 
   * Re-read the sheet while holding a Script Lock so
   * simultaneous users can never receive the same ID.
   *****/

  const listingLock = LockService.getScriptLock();
  listingLock.waitLock(10000);

  try {
    const freshValues =
      sheet.getDataRange().getValues();

    const freshHeaders =
      getHeaderIndexes(freshValues[0]);

    requireColumn(freshHeaders, 'Listing ID');

    /* Auto-create columns for the extra form fields if the
     * sheet doesn't have them yet (same pattern as "Media"). */
    ensureColumn(sheet, freshHeaders, 'Listing Type');
    ensureColumn(sheet, freshHeaders, 'Job Type');
    ensureColumn(sheet, freshHeaders, 'Job Requirements');
    ensureColumn(sheet, freshHeaders, 'Google Form Link');
    ensureColumn(sheet, freshHeaders, 'Telegram');
    ensureColumn(sheet, freshHeaders, 'Currency');
    ensureColumn(sheet, freshHeaders, 'Provider Name');
    ensureColumn(sheet, freshHeaders, 'Company');
    ensureColumn(sheet, freshHeaders, 'Contact');
    ensureColumn(sheet, freshHeaders, 'Phone');
    ensureColumn(sheet, freshHeaders, 'WhatsApp');
    ensureColumn(sheet, freshHeaders, 'About');
    ensureColumn(sheet, freshHeaders, 'Portfolio');
    ensureColumn(sheet, freshHeaders, 'Category');
    ensureColumn(sheet, freshHeaders, 'Pricing');
    ensureColumn(sheet, freshHeaders, 'Custom Pricing');
    ensureColumn(sheet, freshHeaders, 'Manage Token Hash');
    ensureColumn(sheet, freshHeaders, 'Manage Link Emailed');

    /* A concurrent request may have created the requested ID. */
    if (requestedListingId) {
      for (let i = 1; i < freshValues.length; i++) {
        const existingId =
          cleanString(
            freshValues[i][freshHeaders['Listing ID']]
          );

        if (existingId !== requestedListingId) continue;

        const existingPaymentCode =
          normalizePaymentCode(
            freshValues[i][freshHeaders['Payment Code']]
          );

        if (existingPaymentCode) {
          return {
            success: true,
            created: false,
            listingId: requestedListingId,
            providerId: providerId,
            serviceName: serviceName,
            price: price,
            paymentCode: existingPaymentCode,
            status:
              cleanString(
                freshValues[i][freshHeaders['Status']]
              ).toLowerCase()
          };
        }
      }
    }

    listingId =
      getNextSequentialListingId(
        freshValues,
        freshHeaders['Listing ID']
      );

    const paymentCode =
      generateUniquePaymentCode();

    const now =
      new Date();

    const newRow =
      new Array(
        Math.max(
          ...Object.values(freshHeaders)
        ) + 1
      ).fill('');

    newRow[freshHeaders['Listing ID']] =
      listingId;

    newRow[freshHeaders['Provider ID']] =
      providerId;

    newRow[freshHeaders['Service Name']] =
      serviceName;

    newRow[freshHeaders['Payment Code']] =
      paymentCode;

    newRow[freshHeaders['Price']] =
      price;

    newRow[freshHeaders['Status']] =
      'pending';

    newRow[freshHeaders['Payment Code Used']] =
      false;

    newRow[freshHeaders['Created At']] =
      now;

    newRow[freshHeaders['Approved At']] =
      '';

    newRow[freshHeaders['Updated At']] =
      now;

    newRow[freshHeaders['Listing Type']] =
      listingType;

    newRow[freshHeaders['Job Type']] =
      jobType;

    newRow[freshHeaders['Job Requirements']] =
      jobRequirements;

    newRow[freshHeaders['Google Form Link']] =
      googleFormLink;

    newRow[freshHeaders['Telegram']] =
      telegram;

    newRow[freshHeaders['Currency']] =
      cleanString(data.currency).toUpperCase();

    newRow[freshHeaders['Provider Name']] =
      providerName;

    newRow[freshHeaders['Company']] =
      company;

    newRow[freshHeaders['Contact']] =
      contact;

    newRow[freshHeaders['Phone']] =
      phone;

    newRow[freshHeaders['WhatsApp']] =
      whatsapp;

    newRow[freshHeaders['About']] =
      about;

    newRow[freshHeaders['Portfolio']] =
      portfolio;

    newRow[freshHeaders['Category']] =
      category;

    newRow[freshHeaders['Pricing']] =
      pricingJson;

    newRow[freshHeaders['Custom Pricing']] =
      customPricingJson;

    const manageToken = generateManageToken();
    newRow[freshHeaders['Manage Token Hash']] = hashManageToken(manageToken);
    saveManageLinkBackup(listingId, manageToken);
    registerListingKeyInSupabase({listingId: listingId, hashManageToken: hashManageToken(manageToken)});

    sheet.appendRow(newRow);

    return {
      success: true,
      created: true,
      listingId: listingId,
      providerId: providerId,
      serviceName: serviceName,
      price: price,
      paymentCode: paymentCode,
      manageToken: manageToken,
      status: 'pending'
    };

  } finally {
    listingLock.releaseLock();
  }
}

/*****
 * GET NEXT SEQUENTIAL LISTING ID
 *****/

function getNextListingId() {
  const sheet = getListingsSheet();
  const values = sheet.getDataRange().getValues();

  if (values.length < 1) {
    throw new Error('Listings sheet must contain a header row.');
  }

  const headers = getHeaderIndexes(values[0]);
  requireColumn(headers, 'Listing ID');

  return {
    success: true,
    listingId: getNextSequentialListingId(
      values,
      headers['Listing ID']
    )
  };
}

function getNextSequentialListingId(values, listingIdColumn) {
  let highestNumber = 0;

  for (let i = 1; i < values.length; i++) {
    const value = cleanString(values[i][listingIdColumn]).toUpperCase();
    const match = /^SH-(\d+)$/.exec(value);

    if (!match) continue;

    const number = Number(match[1]);

    if (Number.isFinite(number) && number > highestNumber) {
      highestNumber = number;
    }
  }

  return 'SH-' + String(highestNumber + 1).padStart(3, '0');
}

/*****
 * NEW ID SCHEME - replace the whole body of your existing
 * getNextSequentialListingId(values, listingIdColumn) function with
 * this, and the next listing ID suffix to it:
 * 
 *   SH-001 ... SH-999, then SHA-001 ... SHA-999, then SHB-001 ... and
 *   so on. If you ever somehow reach SHZ-999, it rolls to SHAA-001;
 *   the same way spreadsheet columns go ... X, Y, Z, AA, AB...
 * 
 *     * Plain alphabetical sort still matches creation order: "SH-001" <
 *       "SHA-000" < "SHA-001" < "SHA-999" < "SHB-001", because "-" sorts
 *       before any letter. Nothing that reads listing IDs elsewhere needs
 *       to change - it's still just a string.
 *****/

function getNextSequentialListingId(values, listingIdColumn) {
  let bestSuffix = '';
  let bestNumber = 0;
  let found = false;

  const pattern = /^SH([A-Z]*)-(\d+)$/;

  for (let i = 1; i < values.length; i++) {
    const value = cleanString(values[i][listingIdColumn]).toUpperCase();
    const match = pattern.exec(value);

    if (!match) continue;

    const suffix = match[1] || '';
    const number = Number(match[2]);

    if (!Number.isFinite(number)) continue;

    const isHigher =
      !found ||
      suffix.length > bestSuffix.length ||
      (suffix.length === bestSuffix.length && suffix > bestSuffix) ||
      (suffix === bestSuffix && number > bestNumber);

    if (isHigher) {
      bestSuffix = suffix;
      bestNumber = number;
      found = true;
    }
  }
    if (!found) return 'SH-001';

    if (bestNumber >= 999) {
      return 'SH' + nextListingIdSuffix(bestSuffix) + '-001';
    }

    return 'SH' + bestSuffix + '-' + String(bestNumber + 1).padStart(3, '0');
  }

  /* '' -> 'A' -> 'B' -> ... -> 'Z' -> 'AA' -> 'AB' ... same idea as
   * spreadsheet column letters. */
  function nextListingIdSuffix(suffix) {
    if (!suffix) return 'A';

    const letters = suffix.split('');
    let i = letters.length - 1;

    while (i >= 0) {
      if (letters[i] === 'Z') {
        letters[i] = 'A';
        i--;
      } else {
        letters[i] = String.fromCharCode(letters[i].charCodeAt(0) + 1);
        return letters.join('');
      }
    }

    return 'A' + letters.join('');
  }

  /*****
   * GENERATE 6-CHARACTER PAYMENT CODE
   * 
   * Characters:
   *   A-Z
   *   0-9
   * 
   *   (sample)
   *     A7X02E
   *     48002
   *     0912TR
   *     ...
   *****/

  function generatePaymentCode() {
    const characters =
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    let code = '';

    for (
      let i = 0;
      i < 6;
      i++
    ) {
      const randomIndex =
        Math.floor(
          Math.random() *
          characters.length
        );

      code +=
        characters.charAt(
          randomIndex
        );
    }

    return code;
  }

  /*****
   * GENERATE UNIQUE PAYMENT CODE
   * 
   * Checks the entire Payment Code column so the
   * same code cannot be assigned to two listings.
   *****/

  function generateUniquePaymentCode() {
    const sheet =
      getListingsSheet();

    const values =
      sheet.getDataRange().getValues();

    if (values.length < 1) {
      throw new Error(
        'Listings sheet has no header row.'
      );
    }

    const headers =
      getHeaderIndexes(values[0]);

    requireColumn(
      headers,
      'Payment Code'
    );

    const paymentCodeColumn =
      headers['Payment Code'];

    const existingCodes =
      new Set();

    /* COLLECT EXISTING CODES */

    for (
      let i = 1;
      i < values.length;
      i++
    ) {
      const code =
        normalizePaymentCode(
          values[i][paymentCodeColumn]
        );

      if (code) {
        existingCodes.add(code);
      }
    }

    /* KEEP GENERATING UNTIL UNIQUE */

    let code;

    do {
      code =
        generatePaymentCode();
    } while (
      existingCodes.has(code)
    );

    return code;
  }

  /*****
   * POST REQUEST ROUTER
   * 
   * Your existing doPost() may already handle
   * media uploads.
   * 
   * If so, add the createListing condition to
   * your existing doPost() instead of having two
   * doPost() functions.
   *****/

  function handleServiceHubListingPost(data) {
    if (
      data &&
      data.action === 'createListing'
    ) {
      return createListingWithPaymentCode(
        data
      );
    }

    throw new Error(
      'Unknown listing action.'
    );
  }


/*****
 * NOWALLETCONNECT CRYPTO PAYMENT
 *
 * Receives the browser return data from NoWalletConnect,
 * writes the payment into the existing Payments sheet,
 * replaces the temporary listing Payment Code with the
 * NoWalletConnect payment_id, then runs the existing
 * payment-code approval checker.
 *
 * IMPORTANT:
 * NoWalletConnect's browser return parameters are not a
 * cryptographic proof of an on-chain transaction. This
 * function validates the expected merchant, amount, network,
 * status and required identifiers, but it does not perform
 * independent blockchain verification.
 *****/

const CRYPTO_PAYMENT_CONFIG = {
  MERCHANT_ID: 'Solace',
  USDT_AMOUNT: 1.45,
  NETWORKS: ['polygon', 'solana'],
  CURRENCY: 'USDT'
};

function recordNoWalletConnectPayment(data) {
  data = data || {};

  const merchant =
    cleanString(data.merchant);

  const status =
    cleanString(data.status).toLowerCase();

  const listingId =
    cleanString(data.listingId);

  const paymentId =
    normalizePaymentCode(data.payment_id);

  const txHash =
    cleanString(data.tx_hash);

  const network =
    cleanString(data.network).toLowerCase();

  const amount =
    normalizeAmount(data.amount);

  if (merchant !== CRYPTO_PAYMENT_CONFIG.MERCHANT_ID) {
    throw new Error('Invalid NoWalletConnect merchant.');
  }

  if (status !== 'success') {
    throw new Error('Crypto payment was not successful.');
  }

  if (!listingId) {
    throw new Error('Missing Listing ID.');
  }

  if (!paymentId) {
    throw new Error('Missing NoWalletConnect payment ID.');
  }

  if (!txHash) {
    throw new Error('Missing transaction hash.');
  }

  if (CRYPTO_PAYMENT_CONFIG.NETWORKS.indexOf(network) === -1) {
    throw new Error('Unsupported crypto network.');
  }

  if (
    amount === null ||
    Math.abs(
      amount - CRYPTO_PAYMENT_CONFIG.USDT_AMOUNT
    ) > 0.000001
  ) {
    throw new Error(
      'Invalid crypto payment amount. Expected ' +
      CRYPTO_PAYMENT_CONFIG.USDT_AMOUNT +
      ' USDT.'
    );
  }

  const listingsSheet =
    getListingsSheet();

  const paymentsSheet =
    getPaymentsSheet();

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const listingData =
      listingsSheet
        .getDataRange()
        .getValues();

    if (listingData.length < 2) {
      throw new Error('Listing not found.');
    }

    const listingHeaders =
      getHeaderIndexes(listingData[0]);

    requireColumn(
      listingHeaders,
      'Listing ID'
    );

    requireColumn(
      listingHeaders,
      'Payment Code'
    );

    requireColumn(
      listingHeaders,
      'Status'
    );

    requireColumn(
      listingHeaders,
      'Payment Code Used'
    );

    let listingRow = -1;

    for (
      let i = 1;
      i < listingData.length;
      i++
    ) {
      if (
        cleanString(
          listingData[i][
            listingHeaders['Listing ID']
          ]
        ) === listingId
      ) {
        listingRow = i + 1;
        break;
      }
    }

    if (listingRow === -1) {
      throw new Error(
        'Listing not found: ' + listingId
      );
    }

    const paymentHeaders =
      getHeaderIndexes(
        paymentsSheet
          .getDataRange()
          .getValues()[0]
      );

    requireColumn(
      paymentHeaders,
      'Transaction ID'
    );

    requireColumn(
      paymentHeaders,
      'Listing ID'
    );

    requireColumn(
      paymentHeaders,
      'Payment Code'
    );

    requireColumn(
      paymentHeaders,
      'Amount'
    );

    requireColumn(
      paymentHeaders,
      'Currency'
    );

    requireColumn(
      paymentHeaders,
      'Provider Reference'
    );

    requireColumn(
      paymentHeaders,
      'Payment Status'
    );

    ensureColumn(
      paymentsSheet,
      paymentHeaders,
      'Rejection Reason'
    );

    ensureColumn(
      paymentsSheet,
      paymentHeaders,
      'Processed At'
    );

    ensureColumn(
      paymentsSheet,
      paymentHeaders,
      'Updated At'
    );

    ensureColumn(
      paymentsSheet,
      paymentHeaders,
      'Network'
    );

    // Refresh the header map after possible new columns.
    const refreshedPaymentHeaders =
      getHeaderIndexes(
        paymentsSheet
          .getDataRange()
          .getValues()[0]
      );

    // Prevent the same NoWalletConnect payment or transaction
    // hash from being recorded twice.
    const existingPayments =
      paymentsSheet
        .getDataRange()
        .getValues();

    for (
      let i = 1;
      i < existingPayments.length;
      i++
    ) {
      const existingPaymentId =
        normalizePaymentCode(
          existingPayments[i][
            refreshedPaymentHeaders['Payment Code']
          ]
        );

      const existingReference =
        cleanString(
          existingPayments[i][
            refreshedPaymentHeaders['Provider Reference']
          ]
        );

      if (
        existingPaymentId === paymentId ||
        existingReference === txHash
      ) {
        return {
          success: true,
          alreadyRecorded: true,
          listingId: listingId,
          paymentCode: paymentId,
          amount: amount,
          currency: CRYPTO_PAYMENT_CONFIG.CURRENCY,
          network: network,
          txHash: txHash
        };
      }
    }

    // Replace the temporary 6-character ServiceHub code with
    // NoWalletConnect's payment_id. The existing approval
    // checker then matches this same code in Payments.
    listingsSheet
      .getRange(
        listingRow,
        listingHeaders['Payment Code'] + 1
      )
      .setValue(paymentId);

    // Ensure the listing remains eligible for the approval
    // checker if it was originally pending.
    const currentStatus =
      cleanString(
        listingsSheet.getRange(
          listingRow,
          listingHeaders['Status'] + 1
        ).getValue()
      ).toLowerCase();

    if (currentStatus === 'pending') {
      listingsSheet
        .getRange(
          listingRow,
          listingHeaders['Status'] + 1
        )
        .setValue('awaiting_payment');
    }

    const transactionId =
      'NWC-' +
      paymentId +
      '-' +
      Utilities.getUuid()
        .replace(/-/g, '')
        .substring(0, 8)
        .toUpperCase();

    const now =
      new Date();

    const paymentRow =
      new Array(
        Math.max(
          ...Object.values(
            refreshedPaymentHeaders
          )
        ) + 1
      ).fill('');

    paymentRow[
      refreshedPaymentHeaders['Transaction ID']
    ] = transactionId;

    paymentRow[
      refreshedPaymentHeaders['Listing ID']
    ] = listingId;

    paymentRow[
      refreshedPaymentHeaders['Payment Code']
    ] = paymentId;

    paymentRow[
      refreshedPaymentHeaders['Amount']
    ] = amount;

    paymentRow[
      refreshedPaymentHeaders['Currency']
    ] = CRYPTO_PAYMENT_CONFIG.CURRENCY;

    paymentRow[
      refreshedPaymentHeaders['Provider Reference']
    ] = txHash;

    paymentRow[
      refreshedPaymentHeaders['Payment Status']
    ] = 'approved';

    paymentRow[
      refreshedPaymentHeaders['Rejection Reason']
    ] = '';

    paymentRow[
      refreshedPaymentHeaders['Processed At']
    ] = now;

    paymentRow[
      refreshedPaymentHeaders['Updated At']
    ] = now;

    paymentRow[
      refreshedPaymentHeaders['Network']
    ] = network;

    paymentsSheet.appendRow(
      paymentRow
    );

    // This is the SAME approval mechanism used by the
    // ServiceHub payment-code system.
    checkPaymentsAndApproveListings();

    // Read the listing again so the response reflects the
    // actual state after the approval pass.
    const finalData =
      listingsSheet
        .getDataRange()
        .getValues();

    const finalHeaders =
      getHeaderIndexes(finalData[0]);

    let finalStatus = '';

    for (
      let i = 1;
      i < finalData.length;
      i++
    ) {
      if (
        cleanString(
          finalData[i][
            finalHeaders['Listing ID']
          ]
        ) === listingId
      ) {
        finalStatus =
          cleanString(
            finalData[i][
              finalHeaders['Status']
            ]
          ).toLowerCase();
        break;
      }
    }

    return {
      success: true,
      listingId: listingId,
      paymentCode: paymentId,
      amount: amount,
      currency: CRYPTO_PAYMENT_CONFIG.CURRENCY,
      network: network,
      txHash: txHash,
      transactionId: transactionId,
      listingStatus: finalStatus
    };

  } finally {
    lock.releaseLock();
  }
}
