# ServiceHub + NoWalletConnect integration

## What changed

- Added `payment-crypto.html`
  - Lets the customer choose Polygon or Solana.
  - Uses merchant `Solace`.
  - Uses 1.45 USDT.
  - Sends the customer to NoWalletConnect.
- Added `payment-crypto-return.html`
  - Receives the documented NoWalletConnect success parameters.
  - Recovers the ServiceHub Listing ID from the same browser session.
  - Sends the result to Apps Script.
  - Uses NoWalletConnect `payment_id` as the ServiceHub Payment Code.
- Added `Code.gs`
  - Handles `recordNoWalletConnectPayment`.
  - Writes the payment directly into the Payments sheet.
  - Stores USDT, network and tx hash.
  - Replaces the temporary listing Payment Code with `payment_id` for crypto.
  - Runs the existing `checkPaymentsAndApproveListings()` approval system.
  - Includes an optional GET action named `nowalletconnect`.
- Existing Naira payment flow remains based on its original generated payment code.

## NoWalletConnect dashboard setting

Set the NoWalletConnect merchant/return (webhook) URL to the ServiceHub return page:

https://solacediamond.github.io/Servicehub/payment-crypto-return.html

The return page is necessary because the documented NoWalletConnect result does not contain the ServiceHub Listing ID. The return page can recover that Listing ID from the same browser's localStorage and then send the complete payment result to Apps Script.

## Apps Script deployment

1. Open your existing Apps Script project.
2. Replace the deployed `Code.gs` with the `Code.gs` included in this ZIP.
3. Save the project.
4. Deploy a new version of the existing Web App deployment (do not create a different backend URL unless you intentionally change the frontend configuration).
5. Keep the Web App accessible to the users who need to make payments.

## Payments sheet

The existing required columns remain:

A Transaction ID
B Listing ID
C Payment Code
D Amount
E Currency
F Provider Reference
G Payment Status
H Rejection Reason
I Processed At
J Updated At

The crypto handler also creates a `Network` column if it is missing.

For a successful crypto payment, the row will look conceptually like:

Listing ID: SH-xxx
Payment Code: pay_xxxxx
Amount: 1.45
Currency: USDT
Provider Reference: transaction hash
Payment Status: approved
Network: polygon or solana

## Important verification note

The supplied NoWalletConnect guide documents a browser redirect carrying status, amount, tx_hash, merchant, network and payment_id. The ServiceHub backend validates those documented values, prevents duplicate payment IDs/transaction hashes, and only accepts the configured merchant, network and 1.45 USDT amount.

If NoWalletConnect later provides a signed server-to-server webhook or payment-verification API, that should be added for stronger anti-tampering verification. The current integration does not invent such an API.

## Payment ID behavior

For Naira payments, the existing 6-character ServiceHub payment code remains unchanged.

For Crypto payments, after a successful NoWalletConnect return:

`payment_id` -> `Listings.Payment Code`

That same value is written to:

`Payments.Payment Code`

The existing approval checker then matches:

`Listing ID + Payment Code`

and updates the listing to approved.
