# Washing Basket (customer & staff app)

Expo app for Washing Basket customers, plus role-based screens for laundry staff in the same app.

> **Laundry orders run on mock data only.** No backend, database, payment gateway or real wallet is involved. The demo sign-in, PIN codes, QR rules and location checks are written to behave like the real thing, but they run on the phone and are **not security**. A production build needs a server that owns the records, signs QR tokens and checks staff permissions.

## Commands

Run these inside `mobile/`:

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies (first time only) |
| `npm run web` / `npm start` | Start Expo (web, or the dev menu for a phone) |
| `npm run typecheck` | Type-check |
| `npm run lint` | Lint |
| `npm run laundry:test` | Run the laundry scenarios (payment, QR, isolation, verification, issues) against the engine |
| `npm run laundry:seed` | Regenerate the laundry demo JSON in `src/mock/data/` |

To see the customer app, the staff screens and the admin portal update together, also start the portal (`cd ../admin && npm run dev`). It serves a small relay at `http://localhost:5180/__wb-mock` that every client syncs through. Without it, each app keeps its own copy on the device. On a phone, start the portal with `npm run dev -- --host`, or set `EXPO_PUBLIC_MOCK_RELAY_URL`; set that variable to `off` to turn syncing off.

## Demo sign-in

The OTP is always **123456**.

| Who | Phone number | Then |
| --- | --- | --- |
| Staff | **9876543210** (this number only) | Enter a location PIN: **654321** LPU, **123456** NIT Jalandhar, **000000** Outside Campus |
| New customer | Any other 10-digit number | Name and email, then your PIN code. The three PINs above pick that location; any other PIN opens a sheet listing the active locations. New customers get a ₹1,500 demo wallet credit |
| Seed customer | e.g. 9218721686 (Kiran Thomas) or 9347489248 (Meera Iyer) | Opens their existing orders: WB-1008 with a failed payment (low balance), WB-1003 with an open issue |

Tip: on the web, `localhost:8082` and `127.0.0.1:8082` keep separate sign-ins, so you can be a customer in one tab and staff in the other.

## Laundry flow

| Step | Customer | Staff |
| --- | --- | --- |
| Order | **New order** tab: location (LPU and NIT offer office drop-off only; Outside Campus also offers home pickup), items with + / −, pickup address and time for home pickup, review, submit | |
| Pay | The QR is blurred and locked. Pay from the wallet; it is charged once. A low balance fails cleanly and nothing is taken | |
| Hand in | Show the unlocked QR (or its short code). It works once, for that location only, until it expires | **Scan QR** (camera, typed code, or the dev-only demo scanner), count the clothes, then accept or reject with a reason. Rejecting refunds the wallet |
| Receipt | Opens once with a print animation; share or download (copy on a phone) | |
| Wash | The timeline updates live | Start processing → Mark ready. For home pickup, the partner brings the order back |
| Check | **Check my clothes**: confirm the pieces match, or report an issue (missing, damaged, wrong items) | Optionally *Hand over for checking*. An open issue blocks delivery until an admin resolves it in the portal |
| Collect | A one-time delivery QR appears | Scan it and confirm collected or delivered |

Staff only see and act on their own location's orders. A code from another location is refused with a clear message, and the refusal is logged.

## Code map

```
src/mock/types.ts            records shared by the app, the staff screens and the portal
src/mock/engine/*            pure TypeScript rules: lifecycle, QR, payments, permissions, selectors
src/mock/store/mockStore.ts  one store: device storage + the dev relay, with optimistic concurrency
src/mock/services/*          what screens call (submitOrder, payForOrder, scanQr, acceptOrder, …)
src/mock/data/*.json         seed records (npm run laundry:seed)
src/laundry/*                app setup, hooks and the live notification banner
src/screens/laundry/*        customer screens: New order, order, receipt, check clothes
src/screens/staff/*          staff screens: home, scan, review, order, delivery
scripts/laundry/*            seed generator and scenario tests
```

**Reset demo data:** the staff menu or any laundry page in the portal ("Reset demo data") puts every order, wallet and QR back to the seed on every connected device.
