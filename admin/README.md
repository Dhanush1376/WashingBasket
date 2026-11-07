# Washing Basket Admin

The team's portal for running Washing Basket: confirming pickups, moving orders through the wash, looking after customers, and changing what the customer app shows.

It runs entirely on **sample data**. Nothing here talks to a server, sends a message or moves money. Every change is kept in memory until you reload the page. The "Sample data" pill in the top bar says so on every screen.

## Commands

Run these inside `admin/`:

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies (first time only) |
| `npm run dev` | Start the portal at http://localhost:5180 |
| `npm run build` | Type-check, then build a production bundle into `dist/` |
| `npm run preview` | Serve the built bundle at http://localhost:5181 |
| `npm run typecheck` | Type-check only |
| `npm run mock-data` | Rebuild the sample JSON in `src/mock/data/` (Python 3) |

## What's in it

**Daily work**

| Page | What you can do |
| --- | --- |
| Overview | Today's numbers, orders per day for the last 14 days, a "needs your attention" list, where the open orders are, recent activity, and shortcuts |
| Pickup requests | Filter and search bookings, then confirm a pickup, mark it picked up (this opens an order) or cancel it with a reason |
| Orders | Tabs for in progress, delivered, cancelled and all, plus filters by step, service and search. Open an order to move it to the next step, correct the step, count the items (the bill updates), mark pay-on-delivery orders as paid, or cancel |
| Customers | Search, filter and sort customers. Open a profile to see contact details, addresses, orders, wallet, referrals and help requests; edit details, add a team note, or pause and reactivate the account |
| Help requests | Reply to requests and resolve or reopen them; manage the common questions (add, edit, reorder, delete) and the contact details shown on the Help screen |

**Laundry operations** (mock data shared live with the app; see `mobile/README.md`)

| Page | What you can do |
| --- | --- |
| Live dashboard | Pending, processing, ready and delivered counts by location, open orders per location, open issues and live activity |
| Laundry orders | Search, filter by status, location, service and payment, sort and page. Open an order for its status history, payments, QR codes and scans, staff actions and customer details, and resolve an issue a customer reported |
| Locations | Each location's services, demo PIN code, open orders and staff; pause or resume new orders |
| Staff | Staff per location, what they're working on and their latest action; pause or reactivate an account |

**Money**

| Page | What you can do |
| --- | --- |
| Wallet | Read-only wallet activity and the balance per customer; set the top-up buttons, limits and bonus. No money moves |
| Refer & earn | Every referral and its status; set the reward amounts, code length rules and the "how it works" steps |

**Customer app**

| Page | What you can do |
| --- | --- |
| Home page | Show, hide and reorder Home sections; edit the booking banner and the three promises; a live phone preview |
| Offers | Add, edit, hide, reorder and delete offers, with a live preview of the customer's coupon ticket. The status (running, starts soon, ended) comes from the dates |
| Services & prices | Reorder services or pause them; edit names, descriptions and pictures; add, edit and remove price-list items; set the delivery fee |
| Pickup times & areas | Add, edit, switch off and delete time slots; set how many days ahead customers can book; mark a slot full on a busy day; manage the PIN codes you collect from |
| Messages | All notifications sent to customers, with filters. Write a message to one customer or to everyone; it is listed here but never delivered |

The portal covers only what the customer app already has. For example, there is no coupon engine beyond the offer codes the app already shows.

## How it's built

- **Vite, React 19, TypeScript (strict), React Router.** No UI library: the components are in `src/components/ui`.
- **One design system.** `src/theme/tokens.ts` reads the customer app's own theme (`mobile/src/theme/index.ts`) and writes it to CSS variables. Colours, radii and spacing match the app exactly, and change with it. The fonts (Inter), icons, pill filters, dark cards, coupon ticket and order journey are the app's, redrawn for the web.
- **Shared types and formatters.** Admin types extend the customer app's models (`mobile/src/types/models.ts`), and dates and money use the app's formatters (`mobile/src/lib/format.ts`). Both are imported read-only through the `@customer` alias. The portal never writes to `mobile/`.
- **Pages** are in `src/pages/<area>`, one folder per menu item. Filters, search, page number and the open record live in the address bar, so links like `/orders?open=WB1024` or `/support?view=faqs` open the right view, and Back works as expected.
- **Responsive.**
  - At 1100px and wider: a full sidebar, which can be folded to icons.
  - From 768 to 1099px: an icon rail, with the menu as an overlay.
  - Under 768px: a bottom tab bar like the customer app's. Tables become cards, dialogs become bottom sheets and side panels go full screen.
  - Checked at 360, 375, 390, 430, 768, 1024, 1280 and 1440 with no sideways scrolling.

### Data layer

```
src/mock/data/*.json        sample records (generated by scripts/generate_mock_data.py)
src/services/mock/*.ts      mock services: read the JSON into memory, add a short delay, apply changes
src/services/index.ts       the only import pages use: customersApi, ordersApi, … and DATA_MODE
```

- Components never contain records; every list comes from a service through `useQuery`.
- Every service that changes data is commented `SIMULATED`. The change lasts until the page is reloaded.
- The sample data is consistent with the customer app: customer `u-1001` and their orders are the same records the app shows.

**Connecting a real backend:** write modules with the same function names and return types (for example `src/services/api/orders.service.ts` calling `fetch`), point the exports in `src/services/index.ts` at them, and set `DATA_MODE` to `'live'`. Pages and components don't change.

### Laundry demo data

The laundry pages don't use `src/services`. They share one store with the customer app and staff screens: the engine and records in `mobile/src/mock/` (imported through `@customer/mock/*`). While `npm run dev` runs, `mock-relay.ts` serves `/__wb-mock/state`, which every client syncs through, so a payment in the app or a scan by staff appears here within a second or two. The portal keeps its copy in `localStorage`; "Reset demo data" restores the seed everywhere. This is a development relay only: it has no authentication and isn't part of the production build.

**Testing error states:** add `?fail=<area>` to any URL to make that area's data fail to load, for example `/orders?fail=orders` or `/wallet?fail=wallet`. Use `?fail=all` to fail everything. Each page shows a "This didn't load" message with a Try again button.
