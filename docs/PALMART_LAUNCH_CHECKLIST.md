# Palmart Mini Mart — Launch Checklist

**One-page staff onboarding · Print & post at till**  
**Location:** Mirema Drive, Safari Park Gardens · **Owner:** Fabian Amino  
**Full SRS:** [`PALMART_SRS_v1.1.md`](./PALMART_SRS_v1.1.md)

---

## Before doors open (Owner — one-time)

| ☐ | Task | Where |
|---|------|-------|
| ☐ | Product types: `retail` · `produce` · `grocery` · `dairy` | Admin → Settings |
| ☐ | Every item tagged with correct type (matches zone) | Admin → Items |
| ☐ | Aisles: Entrance · Produce · Dry Goods · Chillers · Till | Admin → Aisles |
| ☐ | Users: cashiers (PIN), dept staff, sourcing | Admin → Users |
| ☐ | Dept staff → `produce` + `grocery` assigned | Admin → Users |
| ☐ | Suppliers + department assignments | Admin → Department Supply |
| ☐ | Test M-Pesa on one sale | POS |

---

## Zones → who sells

| Zone | What | Who | App |
|------|------|-----|-----|
| **A** | Snacks, drinks | Cashier | `/pos` |
| **B** | Produce, fruits | Dept → Forward | `/department` |
| **C** | Rice, beans, spices | Dept → Forward | `/department` |
| **D** | Milk, chilled drinks | Cashier | `/pos` |
| **E** | Payment | Cashier | `/pos` |

---

## Cashier — daily

**Open:** Log in → Open shift → count float (KES 1–1000, incl. 40) → wait for approval if needed  
**Sell:** Scan/tap items · Resume **Pending** dept orders · Checkout  
**Pay:** Cash · M-Pesa · Tab · Wallet · Split  
**Close:** Close shift → recount cash → report variance  

**Cannot:** View profit · Change stock without approval

---

## Department staff — daily

**Sell:** Build cart (produce/grocery) → **Forward to cashier** (never take payment)  
**Stock:** Record spoilage, damage, theft same day  
**Supply:** PO only for assigned suppliers  

**App:** `/department` on phone

---

## Opening · Closing

| Opening | Closing |
|---------|---------|
| ☐ Open shift + float | ☐ Record wastage |
| ☐ Restock Zone A | ☐ Close shift + cash count |
| ☐ Check chillers | ☐ Admin approve close |
| ☐ Record overnight loss | ☐ Owner: daily report + M-Pesa |

**Variance target:** ≤ KES 200 per shift

---

## Payments

| Method | Affects drawer? |
|--------|-----------------|
| Cash | Yes |
| M-Pesa | No |
| Tab / Wallet | No |
| Split | Cash part only |

Wallet spends **before** other payment.

---

## Problems?

| Issue | Fix |
|-------|-----|
| Pending order stuck | Cashier → Pending panel → Resume |
| Wrong stock | Stock adjust + reason (dept/admin) |
| Tab payment | Customer `/c/[phone]` or Admin → Credits |
| No internet | Cash only; syncs when back |

---

## Contacts

| Role | Name | Phone |
|------|------|-------|
| Owner | Fabian Amino | _____________ |
| Admin | _____________ | _____________ |

---

*Palmart POS · KES · Africa/Nairobi · v1.1*
