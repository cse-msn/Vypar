---
name: add-endpoint
description: Add a new backend entity or REST endpoint to MNM Fashion following the repo's conventions (model, routes, validation, pagination, frontend hooks). Use when creating a new CRUD resource or API route.
---

# Add a backend entity / endpoint

Mirror the existing entities (Supplier/SizeGroup are the cleanest templates). Keep every convention.

## Backend
1. **Model** `backend/src/models/<Name>.ts`: `I<Name>` interface + schema, `{ timestamps: true }`, and **`applyToJSON(schema)`** (adds `id`, strips `__v`; pass `['passwordHash', ...]` to drop secrets). Export `export const <Name> = model(...)` and `export type <Name>Doc = HydratedDocument<...>`.
2. **Routes** `backend/src/routes/<name>.routes.ts`:
   - `const router = Router(); router.use(requireAuth);` (owner-only mutations get `requireRole('owner')`).
   - Validate with `validateBody` / `validateQuery` against zod schemas; throw `ApiError.*` on failure.
   - Wrap handlers in `asyncHandler`.
   - **List** endpoints: `validateQuery(paginationSchema.extend({...}))`, then `paginate(q.page, q.limit)` + `buildMeta(...)`, and respond `{ data: items, meta }`. Search uses `escapeRegex`. **`limit` is capped at 200.**
   - Single/create/update respond `{ data }`. Deletes are usually **soft** (`active: false`) unless the entity is a pure template.
3. **Register** in `backend/src/routes/index.ts` (`router.use('/<name>', <name>Routes)`). If a literal path (e.g. `/labels`) could be captured by `/:id`, declare it **before** `/:id`.
4. Anything touching stock goes through `backend/src/services/stock.ts` — never ad-hoc `$inc`.

## Frontend
5. **Type** in `frontend/src/types.ts`.
6. **Query keys** in `frontend/src/lib/queryKeys.ts` (entity-prefixed: `root`, `list(params)`, `detail(id)`).
7. **Hooks** in `frontend/src/hooks/<name>.ts`: list hook reads the response's **`.data`** (the `{data,meta}` → `Paginated<T>`); single/create/update read **`.data.data`**. Mutations `invalidateQueries` the entity root key (plus related keys like products/suppliers/reports when stock or balances change).
8. **Page/UI** following Suppliers.tsx (list + dialog form via `useState`) or ProductForm.tsx (react-hook-form) depending on complexity. Add the route in `App.tsx` and a nav item in `components/Layout.tsx` if user-facing.

## Verify
`npm run typecheck -w backend` / `-w frontend`. For stock/balance logic, exercise the endpoints and assert quantities/balances before vs after.
