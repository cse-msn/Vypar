---
name: add-product-field
description: Add a new field to products on the MNM Fashion product form (e.g. a new attribute, dropdown, or price). Use when asked to add/remove/change a field on the Add/Edit Product form, or any product attribute.
---

# Add a product field (all layers)

A product field must be wired through every layer or it silently won't save. Touch these, in order:

## Backend
1. **Model** `backend/src/models/Product.ts` — add to the `IProduct` interface AND the schema. Product-level vs variant-level: `color`/`size`/`sku`/per-variant price overrides live on the **variant**; everything else (category, prices like `b2bPrice`/`b2cPrice`, apparel attributes, `sizeGroup`) is **product-level**.
2. **Validation** `backend/src/routes/products.routes.ts` → `productInput` zod schema. Use `z.enum([...])` for fixed choices, `z.coerce.number().min(0)` for numbers, `.optional()` unless required. Note: `POST /` uses the full schema (required applies); `PATCH /:id` uses `.partial()` (so required fields aren't forced on edit of legacy products).

## Frontend (`frontend/src/pages/ProductForm.tsx`)
3. **Type** `frontend/src/types.ts` → `Product` interface.
4. **Form schema** (`schema` zod object) — fields are **strings** in the form; numbers are parsed with `toNum` on submit.
5. **defaultValues** and the **edit-mode `reset(...)`** mapping (string-ify numbers: `x != null ? String(x) : ''`).
6. **Submit payload** (`base` object in `onSubmit`) — `toNum(values.x)` for numbers; apparel-only fields are gated by `isApparel` (`APPAREL_CATEGORIES.includes(category)`).
7. **UI** — add the input. Dropdowns use `Controller` + `Select`; numbers use the plain-text numeric inputs with `blockNonNumericKeys`/`sanitizeNumericPaste` (no spinner). Apparel-only fields go inside the `{showSubCategory && (...)}` fragment; always-on fields go in the main grid.

## Patterns already in the form
- **Dropdown from data:** category, sub-category, size group, and blouse-size pull options from constants or `useSizeGroups()`. Keep an existing saved value selectable even if it's no longer in the list.
- **Required field:** add a zod `.min(1, 'X is required')`, include in `defaultValues`, and render `errors.x` under the input (see B2B/B2C price).
- **Non-RHF state fields:** some fields are component state, not RHF — `images`/`videos`, `imageColors` (per-photo colour tags → saved as `imageColorTags: {image,color}[]`), `customFields`, `collectionsSel` (collection pill multi-select), and the `requiresShipping`/`allowBackorder` checkboxes. Init them in the edit-mode effect and include them in the `base` payload.
- **Per-colour photos:** `imageColorTags` maps a photo URL to a colour. The `MediaManager` shows a colour dropdown per photo (options = the product's variant colours). On the storefront product page, picking a colour filters the gallery to that colour's photos (untagged photos show for all). Colours come from `variants[].color`.

## Shopify-style fields already present
The form has cards for **Organisation & pricing** (status [active/draft/archived — drives the storefront-visible `active` flag], productType, compareAtPrice [MRP strikethrough], tags, collections), **Shipping** (requiresShipping, allowBackorder, weight+unit, L/W/H+unit, countryOfOrigin), and **SEO** (seoTitle, seoDescription, handle [auto-slugged in the Product pre-validate hook]). The public serializer (`store/products.routes.ts` `toPublic`) exposes `compareAtPrice`, `tags`, `handle` to the storefront.

## Verify
`npm run typecheck -w backend` and `-w frontend` (both are clean gates now). If it affects tags, also check the label (`label` skill).
