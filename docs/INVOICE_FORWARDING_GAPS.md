# Invoice Forwarding Flow — Gap Analysis

> **This document has been merged.**  
> See **[`DEPARTMENT_FORWARD_CASHIER_FLOW_GAPS.md`](./DEPARTMENT_FORWARD_CASHIER_FLOW_GAPS.md)** for the canonical flow trace, full gap inventory (23 gaps), safe/unsafe reporting table, fix phases, and test plan.

The merged doc includes everything from this file plus:

- `sale_date` deferred until checkout (G-02)
- Transactions void/edit/reprint on pending rows (G-05)
- `/api/department/loaded` never wired (G-07)
- Resume vs Add here sync behaviour (Resume is local-only)
- Department “Paid” filter bug (G-12)
- Cart abandon/merge edge cases (G-11, G-15)
- Sync orphan/duplicate risk (G-22)
- Discarded sales retaining `payment_method` (G-06)
