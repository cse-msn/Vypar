---
name: invoices
description: Work on MNM Fashion invoices — the invoice list/detail, server-side PDF, the tokenised public bill page, and WhatsApp sharing. Use for invoice viewing, PDF layout, public /bill links, or share flows.
---

# Invoices, PDF & sharing

## Where it lives
- **UI:** `frontend/src/pages/Invoices.tsx` (list), `InvoiceDetail.tsx` (one invoice), `PublicBill.tsx` (the public
  `/bill/:token` page — a public route, no login), `components/ShareInvoiceDialog.tsx`.
- **Backend:** `backend/src/routes/invoices.routes.ts`; invoice PDF in `backend/src/services/pdf.ts` (pdfkit, separate
  from the label PDF); public/token + share helpers in `routes/public.routes.ts` and `services/whatsapp.ts`.
- Creating/cancelling invoices lives in `services/sales.ts` (see the `billing` skill) — this skill is about
  viewing/sharing existing invoices.

## Key behaviours
- **Protected PDFs** are authenticated — the frontend fetches them as a **blob with the bearer token** via
  `frontend/src/lib/pdf.ts` (`openInvoicePdf`/`openPdf`); you can't navigate the browser straight to the PDF URL.
- **Public bill:** a tokenised `/bill/:token` link lets a customer view/download their bill without logging in; the
  page is a frontend route, so `PUBLIC_APP_URL` (backend env) must be the public frontend URL for the generated link.
- **WhatsApp share:** opens WhatsApp (app on mobile / web on desktop) with a prefilled message containing the real
  bill link; on mobile it can attach the PDF via the native share sheet. See `ShareInvoiceDialog.tsx`.
- Invoice lines are snapshots (designNumber, sku, color, size, price) so the document stays stable over time.

## Gotchas
- pdfkit needs its font assets — keep that in mind if the backend ever moves to a serverless/bundled runtime
  (one reason the API runs as a normal Node server on Render, not Vercel functions).
- Don't recompute money on the client; the invoice already stores server-computed totals.
