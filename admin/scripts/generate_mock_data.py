"""
Generates the admin portal's mock JSON (src/mock/data) from a fixed seed.

The one real-looking customer in the customer app (u-1001, Dhanush) is copied exactly from
mobile/src/mock-data, so the admin portal and the customer app tell the same story. Everyone
else is invented, with ids that slot around his (orders are numbered in the order they were
placed, as the customer app's ids imply).

Run from the admin folder:  python scripts/generate_mock_data.py
"""
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

random.seed(20261105)

HERE = Path(__file__).resolve().parent
ADMIN = HERE.parent
MOBILE_DATA = ADMIN.parent / "mobile" / "src" / "mock-data"
OUT = ADMIN / "src" / "mock" / "data"
OUT.mkdir(parents=True, exist_ok=True)

IST = timezone(timedelta(hours=5, minutes=30))
NOW = datetime(2026, 11, 5, 9, 30, tzinfo=IST)


def load(name):
    return json.loads((MOBILE_DATA / name).read_text(encoding="utf-8"))


def iso(dt):
    return dt.isoformat(timespec="seconds")


def day(dt):
    return dt.date().isoformat()


def write(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


pricing = load("pricing.json")
services = load("services.json")
slots = load("pickup-slots.json")
PRICE = {i["id"]: i for c in pricing["categories"] for i in c["items"]}
ITEMS_BY_SERVICE = {c["serviceId"]: [i["id"] for i in c["items"]] for c in pricing["categories"]}
TURNAROUND_DAYS = {"wash-fold": 2, "wash-iron": 2, "steam-iron": 1, "dry-clean": 3, "premium": 3, "special-care": 5}
SLOT_START = {"s-1": 8, "s-2": 10, "s-3": 14, "s-4": 16, "s-5": 18}


def total(items, discount=0):
    sub = sum(PRICE[i["priceItemId"]]["price"] * i["qty"] for i in items)
    fee = 0 if sub == 0 or sub >= pricing["fees"]["freeDeliveryAbove"] else pricing["fees"]["delivery"]
    return max(0, sub + fee - discount)


# ───────────────────────── Customers ─────────────────────────

me_profile = load("profile/customer.json")
me_addresses = load("profile/addresses.json")
me_orders = load("orders.json")
me_requests = load("requests.json")
me_wallet = load("wallet.json")["transactions"]
me_refs = load("referrals.json")
me_notifications = load("notifications.json")
support = load("support.json")
codes = {c["owner"]: c["code"] for c in load("referral-codes.json")["codes"]}

AREAS = [
    ("HSR Layout, Sector 2", "560102"),
    ("Koramangala 5th Block", "560095"),
    ("Indiranagar", "560038"),
    ("BTM Layout 2nd Stage", "560076"),
    ("Jayanagar 4th Block", "560041"),
    ("Whitefield", "560066"),
    ("Bellandur", "560103"),
]
STREETS = ["Lakeview Apartments", "Green Meadows", "Sobha Elite", "Prestige Shantiniketan", "Brigade Gardens",
           "Nandi Residency", "Purva Heights", "Mantri Classic", "Sai Krupa Nilaya", "Adarsh Palm Retreat"]
WORK = ["Embassy Tech Village", "RMZ Ecospace", "Manyata Tech Park", "Bagmane Tech Park", "Salarpuria Sattva"]
INSTRUCTIONS = [None, None, "Call when you reach the gate.", "Leave with the security guard if no one is home.",
                "Please use the service lift.", "Ring the bell once, a dog may bark."]

PEOPLE = [
    # (full name, joined, referred by)
    ("Meera Iyer", "2026-09-02", None),
    ("Arjun Sharma", "2026-09-04", None),
    ("Kavya Nair", "2026-09-08", None),
    ("Rohit Verma", "2026-09-10", None),
    ("Priya Shetty", "2026-09-15", None),
    ("Vikram Rao", "2026-09-18", None),
    ("Sana Khan", "2026-09-22", None),
    ("Kiran Thomas", "2026-09-25", None),
    ("Aditya Kulkarni", "2026-09-29", None),
    ("Neha Gupta", "2026-10-02", None),
    ("Ananya Reddy", "2026-10-08", "u-1001"),
    ("Farhan Ali", "2026-10-11", None),
    ("Divya Menon", "2026-10-14", "u-1005"),
    ("Suresh Babu", "2026-10-17", None),
    ("Ishita Bose", "2026-10-20", None),
    ("Manoj Pillai", "2026-10-22", "u-1008"),
    ("Pooja Hegde", "2026-10-25", None),
    ("Rahul Menon", "2026-10-30", "u-1001"),
    ("Tanvi Joshi", "2026-11-01", None),
    ("Nikhil Das", "2026-11-02", None),
    ("Lakshmi Prasad", "2026-11-03", None),
    ("Aman Singh", "2026-11-04", None),
    ("Shreya Patil", "2026-11-04", None),
]

customers = []
addresses = []
addr_seq = 3  # a-1 and a-2 are Dhanush's

customers.append({
    "id": me_profile["id"],
    "fullName": me_profile["fullName"],
    "phone": me_profile["phone"],
    "email": me_profile["email"],
    "customerSince": me_profile["customerSince"],
    "verification": me_profile["verification"],
    "avatarUrl": me_profile["avatarUrl"],
    "status": "active",
    "referralCode": "WBDHAN24",
    "referredBy": None,
    "lastActiveAt": "2026-11-03T08:31:00+05:30",
    "note": "",
})
for a in me_addresses:
    addresses.append({**a, "customerId": me_profile["id"]})


def phone():
    return f"+91 9{random.randint(1000, 9999)} {random.randint(10000, 99999)}"


for n, (name, joined, referred_by) in enumerate(PEOPLE):
    cid = f"u-{1002 + n}"
    first = name.split()[0]
    code = codes.get(f"{first} {name.split()[1][0]}.") or f"WB{first[:4].upper()}{random.randint(10, 99)}"
    status = "paused" if name in ("Suresh Babu",) else "active"
    customers.append({
        "id": cid,
        "fullName": name,
        "phone": phone(),
        "email": f"{first.lower()}.{name.split()[1].lower()}@example.com",
        "customerSince": joined,
        "verification": {"phone": True, "email": random.random() < 0.6},
        "status": status,
        "referralCode": code,
        "referredBy": referred_by,
        "lastActiveAt": None,
        "note": "Asked to pause the account while travelling." if status == "paused" else "",
    })
    area, pin = random.choice(AREAS)
    addresses.append({
        "id": f"a-{addr_seq}", "customerId": cid, "label": "Home",
        "line1": f"{random.choice(['Flat', 'House', 'Villa'])} {random.randint(11, 905)}, {random.choice(STREETS)}",
        "line2": area, "city": "Bengaluru", "pincode": pin, "isDefault": True,
        "pickupInstructions": random.choice(INSTRUCTIONS),
    })
    addr_seq += 1
    if random.random() < 0.35:
        addresses.append({
            "id": f"a-{addr_seq}", "customerId": cid, "label": "Work",
            "line1": f"{random.choice(['Tower', 'Block'])} {random.choice('ABCDE')}, {random.choice(WORK)}",
            "line2": random.choice(AREAS)[0], "city": "Bengaluru", "pincode": random.choice(AREAS)[1], "isDefault": False,
            "pickupInstructions": "Reception desk, ground floor.",
        })
        addr_seq += 1

CUSTOMER = {c["id"]: c for c in customers}
ADDR_OF = {}
for a in addresses:
    ADDR_OF.setdefault(a["customerId"], []).append(a["id"])

# ───────────────────────── Orders and requests ─────────────────────────
# Orders are numbered in the order they were placed. Dhanush's fixed ids leave gaps; each gap is
# filled with someone else's order placed between his neighbouring orders.

fixed = {o["id"]: o for o in me_orders}
fixed_times = {int(o["id"][2:]): datetime.fromisoformat(o["placedAt"]) for o in me_orders}
LAST_ID = 1034
LAUNCH = datetime(2026, 9, 2, 9, 0, tzinfo=IST)
END = datetime(2026, 11, 5, 8, 45, tzinfo=IST)

# anchor times for every order number, interpolated between Dhanush's fixed ones
anchors = sorted(fixed_times.items())
times = {}
bounds = [(1000, LAUNCH)] + anchors + [(LAST_ID + 1, END)]
for (n0, t0), (n1, t1) in zip(bounds, bounds[1:]):
    for n in range(n0 + 1, n1):
        frac = (n - n0) / (n1 - n0)
        jitter = random.uniform(-0.25, 0.25) / (n1 - n0)
        t = t0 + (t1 - t0) * min(0.97, max(0.03, frac + jitter))
        t = t.replace(hour=random.choice([8, 9, 10, 11, 13, 17, 18, 19, 20]), minute=random.choice([0, 5, 12, 20, 34, 41, 50]))
        if t <= t0:
            t = t0 + timedelta(minutes=30)
        if t >= t1:
            t = t1 - timedelta(minutes=30)
        times[n] = t


def eligible_customers(t):
    return [c for c in customers if c["id"] != "u-1001" and datetime.fromisoformat(c["customerSince"] + "T00:00:00+05:30") < t - timedelta(hours=6)]


def stage_for(placed, service):
    pickup = placed + timedelta(days=1)
    elapsed = (NOW - pickup).total_seconds() / 3600
    if elapsed < 0:
        return "pickup_scheduled"
    ta = TURNAROUND_DAYS[service] * 24
    if elapsed >= ta:
        return "delivered"
    frac = elapsed / ta
    stages = ["collected", "washing", "drying", "ironing", "packing", "out_for_delivery"]
    return stages[min(len(stages) - 1, int(frac * len(stages)))]


orders = []
requests = []
txns = []
order_customer = {}

# Dhanush's requests keep their ids; everyone else's are numbered around them
used_rq = {int(r["id"][2:]) for r in me_requests}
rq_counter = [2000]


def next_rq():
    rq_counter[0] += 1
    while rq_counter[0] in used_rq:
        rq_counter[0] += 1
    used_rq.add(rq_counter[0])
    return f"RQ{rq_counter[0]}"


for n in range(1001, LAST_ID + 1):
    oid = f"WB{n}"
    if oid in fixed:
        o = dict(fixed[oid])
        o["customerId"] = "u-1001"
        orders.append(o)
        continue
    placed = times[n]
    pool = eligible_customers(placed)
    # people who already ordered come back more often
    weights = [3 if any(order_customer.get(x["id"]) for x in [c]) else 1 for c in pool]
    cust = random.choices(pool, weights=weights)[0]
    order_customer[cust["id"]] = True
    service = random.choices(list(TURNAROUND_DAYS), weights=[5, 6, 3, 4, 2, 1])[0]
    item_ids = ITEMS_BY_SERVICE[service]
    picks = random.sample(item_ids, k=random.randint(1, min(3, len(item_ids))))
    items = []
    for pid in picks:
        unit = PRICE[pid]["unit"]
        qty = random.randint(3, 7) if unit == "kg" else random.randint(1, 3) if PRICE[pid]["price"] > 150 else random.randint(2, 8)
        items.append({"priceItemId": pid, "qty": qty})
    status = stage_for(placed, service)
    if status == "delivered" and random.random() < 0.08:
        status = "cancelled"
    if cust["status"] == "paused" and placed > datetime(2026, 10, 28, tzinfo=IST):
        status = "cancelled"
    slot = random.choice(list(SLOT_START))
    pickup_day = placed + timedelta(days=1)
    est = pickup_day + timedelta(days=TURNAROUND_DAYS[service])
    method = random.choices(["Pay on delivery", "UPI", "Wallet", "Card"], weights=[5, 4, 2, 1])[0]
    discount = 0
    if service == "dry-clean" and placed >= datetime(2026, 11, 1, tzinfo=IST) and random.random() < 0.6:
        discount = round(sum(PRICE[i["priceItemId"]]["price"] * i["qty"] for i in items) * 0.15)
    if status == "cancelled":
        pay = "not_charged"
    elif method == "Pay on delivery":
        pay = "paid" if status == "delivered" else "pending"
    else:
        pay = "paid"
    o = {
        "id": oid,
        "customerId": cust["id"],
        "serviceId": service,
        "status": status,
        "placedAt": iso(placed),
        "pickup": {"date": day(pickup_day), "slotId": slot, "addressId": ADDR_OF[cust["id"]][0]},
        "estimatedDelivery": day(est),
        "items": items,
        "discount": discount,
        "payment": {"method": method, "status": pay},
    }
    if status == "delivered":
        d = est.replace(hour=random.choice([11, 13, 15, 17, 19]), minute=random.choice([5, 20, 40]))
        if random.random() < 0.3:
            d -= timedelta(days=1)
        o["deliveredAt"] = iso(max(d, pickup_day + timedelta(hours=20)))
    if status == "cancelled":
        o["cancelReason"] = random.choice(["Cancelled by the customer before pickup.", "No one was available at the pickup address."])
    rq = next_rq()
    o["requestId"] = rq
    orders.append(o)
    requests.append({
        "id": rq,
        "customerId": cust["id"],
        "serviceId": service,
        "createdAt": iso(placed),
        "pickupDate": day(pickup_day),
        "slotId": slot,
        "addressId": o["pickup"]["addressId"],
        "status": "cancelled" if status == "cancelled" else ("confirmed" if status == "pickup_scheduled" else "picked_up"),
        "orderId": oid,
        **({"cancelReason": o["cancelReason"]} if status == "cancelled" else {}),
    })
    cust["lastActiveAt"] = max(cust["lastActiveAt"] or "", iso(placed))

for r in me_requests:
    requests.append({**r, "customerId": "u-1001"})

# a few new pickup requests that the team still has to confirm
for k in range(6):
    pool = [c for c in customers if c["id"] != "u-1001" and c["status"] == "active"]
    cust = random.choice(pool)
    created = NOW - timedelta(hours=random.randint(1, 30), minutes=random.randint(0, 59))
    pickup_day = NOW + timedelta(days=random.randint(0, 3))
    service = random.choice(list(TURNAROUND_DAYS))
    requests.append({
        "id": next_rq(),
        "customerId": cust["id"],
        "serviceId": service,
        "createdAt": iso(created),
        "pickupDate": day(pickup_day),
        "slotId": random.choice(list(SLOT_START)),
        "addressId": ADDR_OF[cust["id"]][0],
        "status": "pending",
        **({"notes": random.choice(["Two big bags this time.", "Please call before coming.", "Includes a silk saree, handle with care."])} if k % 2 == 0 else {}),
    })
    cust["lastActiveAt"] = max(cust["lastActiveAt"] or "", iso(created))

# ───────────────────────── Wallet ─────────────────────────
tx_seq = [100]


def tx(customer_id, type_, source, amount, title, at, status="completed", order_id=None):
    tx_seq[0] += 1
    t = {"id": f"tx-{tx_seq[0]}", "customerId": customer_id, "type": type_, "source": source, "amount": amount,
         "title": title, "date": iso(at), "status": status}
    if order_id:
        t["orderId"] = order_id
    txns.append(t)


for t in me_wallet:
    txns.append({**t, "customerId": "u-1001"})

for c in customers[1:]:
    joined = datetime.fromisoformat(c["customerSince"] + "T10:05:00+05:30")
    tx(c["id"], "credit", "bonus", 100, "Welcome bonus", joined)
    if random.random() < 0.55:
        amt = random.choice([500, 1000, 2000, 1000, 500])
        at = joined + timedelta(days=random.randint(0, 6), hours=random.randint(1, 9))
        if at < NOW:
            via = random.choice(["UPI", "UPI", "card"])
            tx(c["id"], "credit", "topup", amt, f"Added via {via}", at)
            if amt >= 2000:
                tx(c["id"], "credit", "bonus", round(amt * 0.05), "Top-up bonus", at + timedelta(minutes=1))

for o in orders:
    if o["customerId"] == "u-1001":
        continue
    if o["payment"]["method"] == "Wallet" and o["status"] != "cancelled":
        at = datetime.fromisoformat(o["placedAt"]) + timedelta(minutes=2)
        # make sure the wallet had the money: top it up just before if needed
        bal = sum((-t["amount"] if t["type"] == "debit" else t["amount"]) for t in txns if t["customerId"] == o["customerId"] and t["status"] == "completed")
        amount = total(o["items"], o["discount"])
        if bal < amount:
            topup = 1000 if amount - bal <= 1000 else 2000
            tx(o["customerId"], "credit", "topup", topup, "Added via UPI", at - timedelta(minutes=1))
        tx(o["customerId"], "debit", "order", amount, f"Order #{o['id']}", at, order_id=o["id"])

# one refund for a late delivery
late = next(o for o in orders if o["customerId"] != "u-1001" and o["status"] == "delivered" and o["payment"]["method"] != "Pay on delivery")
tx(late["customerId"], "refund", "refund", 49, f"Refund · {late['id']}", datetime.fromisoformat(late["deliveredAt"]) + timedelta(days=1))

# ───────────────────────── Referrals ─────────────────────────
referrals = []
for r in me_refs["history"]:
    friend = next((c for c in customers if c["fullName"].split()[0] == r["name"].split()[0] and c["id"] != "u-1001"), None)
    referrals.append({"id": r["id"], "referrerId": "u-1001", "friendName": r["name"],
                      "friendCustomerId": friend["id"] if friend and r["status"] != "invited" else None,
                      "date": r["date"], "status": r["status"], "reward": r["reward"]})
rf = 4
for c in customers:
    if c["referredBy"] and c["referredBy"] != "u-1001":
        has_delivered = any(o["customerId"] == c["id"] and o["status"] == "delivered" for o in orders)
        status = "rewarded" if has_delivered else "joined"
        referrals.append({"id": f"rf-{rf}", "referrerId": c["referredBy"], "friendName": f"{c['fullName'].split()[0]} {c['fullName'].split()[1][0]}.",
                          "friendCustomerId": c["id"], "date": c["customerSince"], "status": status, "reward": 200})
        rf += 1
        when = datetime.fromisoformat(c["customerSince"] + "T18:00:00+05:30") + timedelta(days=4)
        tx(c["referredBy"], "credit", "referral", 200, f"Referral · {c['fullName'].split()[0]} {c['fullName'].split()[1][0]}.",
           min(when, NOW - timedelta(hours=3)), status="completed" if status == "rewarded" else "pending")
referrals.append({"id": f"rf-{rf}", "referrerId": "u-1003", "friendName": "Harsha V.", "friendCustomerId": None, "date": "2026-11-02", "status": "invited", "reward": 0})

txns.sort(key=lambda t: t["date"], reverse=True)

# ───────────────────────── Notifications ─────────────────────────
notifications = []
for n_ in me_notifications:
    notifications.append({**n_, "customerId": "u-1001", "sentBy": "automatic"})
n_seq = 100
for o in sorted(orders, key=lambda o: o["placedAt"], reverse=True)[:14]:
    if o["customerId"] == "u-1001":
        continue
    n_seq += 1
    if o["status"] == "delivered":
        title, body, type_, at = "Order delivered", f"Order {o['id']} was delivered. Enjoy your fresh clothes!", "delivery", o["deliveredAt"]
    elif o["status"] == "cancelled":
        continue
    elif o["status"] == "pickup_scheduled":
        title, body, type_, at = "Pickup confirmed", f"Order {o['id']} will be collected on your chosen slot.", "pickup", o["placedAt"]
    else:
        title, body, type_, at = "Your clothes are on their way", f"Order {o['id']} is moving through our care process.", "order", o["placedAt"]
    notifications.append({"id": f"n-{n_seq}", "customerId": o["customerId"], "type": type_, "title": title, "body": body,
                          "createdAt": at, "read": random.random() < 0.5, "orderId": o["id"], "sentBy": "automatic"})
notifications.append({"id": "n-90", "customerId": None, "type": "account", "title": "Festive pickups are open",
                      "body": "Book early for Diwali: extra morning slots are now available.", "createdAt": "2026-10-28T10:00:00+05:30",
                      "read": False, "sentBy": "team"})
notifications.append({"id": "n-91", "customerId": None, "type": "account", "title": "New: Special Garment Care",
                      "body": "Bridal wear, leather and shoes now have their own careful service.", "createdAt": "2026-10-09T11:30:00+05:30",
                      "read": False, "sentBy": "team"})
notifications.sort(key=lambda n_: n_["createdAt"], reverse=True)

# ───────────────────────── Support ─────────────────────────
tickets = []
for t in support["tickets"]:
    tickets.append({**t, "customerId": "u-1001", "replies": []})
tickets[1]["replies"] = [{"id": "re-1", "from": "team", "body": "Sorry about that. We have added ₹49 back to your wallet.", "at": "2026-10-20T16:20:00+05:30"}]
extra = [
    ("T-3119", "Order taking longer than expected", "orders", "open", "My order was supposed to arrive yesterday. Any update?"),
    ("T-3116", "Wallet top-up not showing", "payments", "open", "I added ₹1,000 by UPI but the balance did not change for a few minutes."),
    ("T-3112", "Stain still visible on kurta", "care", "resolved", "There is a small turmeric stain left on one kurta."),
    ("T-3104", "How do I change my phone number?", "account", "resolved", "I have a new number. How can I update it?"),
]
for i, (tid, subj, cat, status, msg) in enumerate(extra):
    cust = customers[2 + i * 3]
    at = NOW - timedelta(days=i * 4 + 1, hours=3)
    replies = []
    if status == "resolved":
        replies.append({"id": f"re-{10 + i}", "from": "team", "body": "Thanks for letting us know. This is now sorted.", "at": iso(at + timedelta(hours=5))})
    tickets.append({"id": tid, "subject": subj, "categoryId": cat, "createdAt": iso(at), "status": status, "message": msg,
                    "customerId": cust["id"], "replies": replies})
tickets.sort(key=lambda t: t["createdAt"], reverse=True)

# ───────────────────────── Write everything ─────────────────────────
write("customers.json", customers)
write("addresses.json", addresses)
write("orders.json", sorted(orders, key=lambda o: o["placedAt"], reverse=True))
write("requests.json", sorted(requests, key=lambda r: r["createdAt"], reverse=True))
write("wallet-transactions.json", txns)
write("referrals.json", referrals)
write("notifications.json", notifications)
write("support.json", {"contact": support["contact"], "categories": support["categories"], "tickets": tickets})

# Content the customer app shows, copied with the few extra fields the team manages.
offers = load("offers.json")
write("offers.json", [{**o, "visible": True, "position": i + 1} for i, o in enumerate(offers)])
write("services.json", [{**s, "available": True, "position": i + 1} for i, s in enumerate(services)])
write("pricing.json", pricing)
write("pickup-slots.json", {**slots, "slots": [{**s, "enabled": True} for s in slots["slots"]]})
write("faq.json", load("faq.json"))
wallet_cfg = load("wallet.json")
write("wallet-settings.json", {"presets": wallet_cfg["presets"], "limits": wallet_cfg["limits"], "topUpBonus": wallet_cfg["topUpBonus"]})
rules = load("referral-codes.json")["rules"]
write("referral-program.json", {"rewardPerReferral": me_refs["rewardPerReferral"], "welcomeReward": rules["welcomeReward"],
                                 "codeLength": {"min": rules["minLength"], "max": rules["maxLength"]}, "steps": me_refs["steps"]})
dash = load("dashboard.json")
write("homepage.json", {
    "tagline": dash["tagline"],
    "sections": [
        {"id": "greeting", "name": "Greeting", "description": "\"Hello, name!\" with today's date.", "visible": True, "fixed": True},
        {"id": "overview", "name": "Order and wallet summary", "description": "Active orders, next pickup and wallet balance.", "visible": True, "fixed": True},
        {"id": "perks", "name": "Promise strip", "description": "Three short promises under the summary.", "visible": True, "fixed": False},
        {"id": "booking", "name": "Book a pickup banner", "description": "The large banner that opens booking.", "visible": True, "fixed": False},
        {"id": "recentOrders", "name": "Recent orders", "description": "The customer's last three orders.", "visible": True, "fixed": False},
        {"id": "services", "name": "Our services", "description": "Scrolling row of services with starting prices.", "visible": True, "fixed": False},
        {"id": "offers", "name": "Available offers", "description": "The offer coupons, shuffling in a card.", "visible": True, "fixed": False},
    ],
    "booking": {"kicker": "Book a pickup", "title": "Fresh clothes,\nat your door", "cta": "Book now", "art": "steam",
                "message": dash["booking"]["message"]},
    "perks": [
        {"id": "pk-1", "icon": "truck", "label": "Free pickup", "tint": "orange"},
        {"id": "pk-2", "icon": "clock", "label": "48h turnaround", "tint": "navy"},
        {"id": "pk-3", "icon": "shield", "label": "Quality assured", "tint": "green"},
    ],
    "promo": dash["promo"],
    "emptyOrder": dash["emptyOrder"],
    "trust": dash["trust"],
})
write("service-areas.json", [
    {"pincode": "123456", "area": "Demo test area", "city": "Bengaluru", "active": True, "note": "Test PIN code the demo app accepts."},
    *[{"pincode": pin, "area": area.split(",")[0], "city": "Bengaluru", "active": True, "note": ""} for area, pin in AREAS],
    {"pincode": "560037", "area": "Marathahalli", "city": "Bengaluru", "active": False, "note": "Opening once we have a second van."},
])
write("admin.json", {"user": {"id": "ad-1", "name": "Priya Nair", "role": "Store manager", "email": "priya.nair@washingbasket.example"},
                     "business": {"name": "Washing Basket", "city": "Bengaluru"}})

print(f"{len(customers)} customers, {len(orders)} orders, {len(requests)} requests, {len(txns)} wallet entries, "
      f"{len(referrals)} referrals, {len(notifications)} notifications, {len(tickets)} tickets")
