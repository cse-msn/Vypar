---
name: purchases
description: Work on MNM Fashion purchases (stock received from suppliers) — recording a purchase, editing a saved purchase, cancelling, and supplier payable balances. Use for the Purchase form/list or purchase stock-in logic.
---

# Purchases (stock-in)

## Where it lives
- **UI:** `frontend/src/pages/PurchaseForm.tsx` (create + **edit**, same form via `/purchases/new` and
  `/purchases/:id/edit`) and `frontend/src/pages/Purchases.tsx` (list with Edit + Cancel). A line is flat:
  `{ key, productId, variantId, designNumber, productName, color, size, quantity, costPrice }`.
- **Hooks:** `frontend/src/hooks/purchases.ts` — `useCreatePurchase`, `useUpdatePurchase(id)`, `useCancelPurchase`,
  `usePurchase(id)`. Mutations invalidate purchases + products + suppliers + reports.
- **Backend:** `backend/src/services/purchases.ts` — `createPurchase`, `updatePurchase`, `cancelPurchase`;
  routes `POST /api/purchases`, `PUT /api/purchases/:id`, `POST /api/purchases/:id/cancel`.

## Stock & balance rules (important)
- **Create** → `addStock` (increments variant qty, refreshes latest cost) and adds `balance` to the supplier payable.
- **Edit** (`updatePurchase`) → reconciles stock by **net delta per variant**: increases `addStock`, decreases
  `removeStockSafe` (refused if it would push stock negative, e.g. already sold). Moves the payable by the difference,
  and **between suppliers** if the supplier changed. Preserves `purchaseNumber`/status.
- **Cancel** → `removeStockSafe` (fails if received items were already sold) + reverses the payable.
- All stock mutations go through `services/stock.ts` — never ad-hoc `$inc`. Lines are snapshotted on the purchase.

## Gotchas
- A cancelled purchase can't be edited.
- Verify any change by exercising create→edit→cancel and asserting variant quantity + supplier balance before/after
  (there's no DB transaction; correctness relies on the net-delta logic).
