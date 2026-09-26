SERVICEHUB — DIRECT APPS SCRIPT FRONTEND BUILD

This build keeps the supplied Google Apps Script Code.gs unchanged.

Existing Apps Script Web App ID:
AKfycbyshp8ls2f-PTWGBaHveiAjDhhuOVxUhcdNjw7OWPVSfLyhSIwNAG4eGerwTH5SktRi

Frontend transport:
- GET requests go directly to the Apps Script /exec URL using the doGet(e) contract.
- POST requests go directly to the Apps Script /exec URL using the doPost(e) contract.
- POST bodies remain JSON text, so Code.gs can continue using JSON.parse(e.postData.contents).
- Content-Type is text/plain rather than application/json to avoid a CORS preflight.
- The old local /apps-script relay is no longer used by the frontend, so editor Preview no longer asks localhost for a route that does not exist there.

NO Apps Script code was changed.
NO new Apps Script project or Web App ID was created.
NO Supabase dependency was added.

Important browser note:
A browser may still block a cross-origin Apps Script response if the deployed Web App does not permit browser CORS reads. This build removes the localhost 404 caused by the old relay path and uses the exact doGet/doPost contract from Code.gs, but it cannot add CORS permissions from the frontend itself.

The UI/UX, listing/payment/media workflow, payment polling, and Drive media handling remain intact.
