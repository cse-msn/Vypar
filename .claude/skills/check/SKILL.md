---
name: check
description: Run the typecheck and test gate for MNM Fashion before finishing a change. Use after editing backend or frontend code to verify it compiles and tests pass (there is no linter in this repo).
---

# Check a change

There is **no linter** in this repo (the `lint` script is a no-op). The gate is TypeScript typecheck + Vitest.

## Typecheck (fast, run this on every change)
```bash
npm run typecheck -w backend      # tsc --noEmit (backend)
npm run typecheck -w frontend     # tsc --noEmit (frontend)
```
Known noise to ignore: the **frontend typecheck surfaces a pre-existing `vitest` type-declaration error** in `*.test.*` files (`Could not find a declaration file for module 'vitest'`). It is unrelated to app code — judge your change by whether *your* edited files appear in the error list, not by the overall exit code. A quick way to filter: run the typecheck and grep the output for the files you touched.

## Tests
```bash
npm run test -w backend           # vitest — spins up mongodb-memory-server, no live DB needed
npm run test -w frontend          # vitest + Testing Library
```
Single backend test: `cd backend && npx vitest run src/path/to/file.test.ts` (or `npx vitest run -t "test name"`).

## When touching the API end-to-end
If the dev servers are running, `npm run test:api -w backend` runs a scripted smoke test against the live API. For stock/balance-affecting changes (sales, purchases, orders), verify the numbers by exercising the endpoints and checking variant quantity + customer/supplier balance before and after.
