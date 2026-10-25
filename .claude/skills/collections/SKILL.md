---
name: collections
description: Work on MNM Fashion product collections — curated/featured groups of products shown on the storefront, how products are assigned to them, and the collection browsing pages. Use for anything about collections, product grouping, or featured storefront sections.
---

# Collections

Curated groups of products for the storefront (e.g. "Festive", "New Arrivals"). Manual membership:
a product references its collections via `Product.collections: ObjectId[]`.

## Model (`backend/src/models/Collection.ts`)
`title`, `handle` (unique, auto-slugged from title if omitted), `description`, `image`, `sortOrder`,
`featured` (show on storefront home), `active`. Deleting a collection `$pull`s its ref off every product.

## Endpoints
- **Admin** `backend/src/routes/collections.routes.ts` → `/api/collections` (`requireAuth`; mutations
  `requireRole('owner')`). The list attaches a live `productCount` per collection (aggregate over
  `Product.collections`).
- **Storefront** `backend/src/routes/store/collections.routes.ts` → `GET /api/store/collections`
  (`?featured=true`) and `GET /api/store/collections/:handle` (public; active only).
- **Catalog filter:** `GET /api/store/products?collection=<handle|id>` filters by collection
  (`backend/src/routes/store/products.routes.ts`). Unknown handle ⇒ no results.

## Product assignment
The product form (`frontend/src/pages/ProductForm.tsx`) has a collection multi-select (pill toggles)
backed by `collectionsSel` state; it sends `collections: string[]` on create/update. `productInput`
(products.routes.ts) accepts `collections: string[]`.

## Frontend
- Admin page `frontend/src/pages/Collections.tsx` (nav "Collections", route `/collections`), hooks
  `frontend/src/hooks/collections.ts`, type `Collection` in `types.ts`, key `qk.collections`.
- Storefront: featured strip on `Home.tsx`, listing page `store/pages/Collection.tsx` at
  `/shop/collection/:handle`, shared `store/components/ProductCard.tsx`.

## Gaps
Only **manual** collections (no automated rules by tag/category/price yet). No per-collection product
ordering.
