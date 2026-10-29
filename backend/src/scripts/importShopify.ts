/**
 * Shopify → MNM Fashion catalog importer ("migration agent").
 *
 * Pulls every product from a Shopify store (text, variants, prices, photos AND videos) via the
 * Shopify Admin GraphQL API, downloads each media file, re-uploads it to this app's object storage
 * (Cloudflare R2 / local), and creates matching Product documents. Idempotent: a product already
 * imported (matched by its `SH-<shopifyId>` design number) is skipped, so you can re-run safely.
 *
 * You only provide credentials via env — nothing else:
 *   SHOPIFY_STORE=your-store.myshopify.com
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxx         # custom-app Admin API token (read_products)
 *   SHOPIFY_API_VERSION=2024-10                # optional, defaults below
 *   # plus the usual app env so it writes to the right place:
 *   MONGODB_URI=...            (Atlas for the live store)
 *   STORAGE_DRIVER=s3 + S3_*   (R2, so media lands in your bucket)
 *   JWT_SECRET=...             (required by env validation; any value for a script run)
 *
 * Run:  npm run import:shopify -w backend
 *       npm run import:shopify -w backend -- --dry-run      # fetch + map, write nothing
 *       npm run import:shopify -w backend -- --limit 5      # first 5 products (a safe trial)
 */
import crypto from 'crypto';
import { connectDB, disconnectDB } from '../config/db';
import { logger } from '../utils/logger';
import { Product } from '../models/Product';
import { getStorage } from '../services/storage';
import { mimeToExt, isVideoMime } from '../utils/mime';

const STORE = process.env.SHOPIFY_STORE?.replace(/^https?:\/\//, '').replace(/\/$/, '');
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  return i >= 0 ? Number(args[i + 1]) : Infinity;
})();

interface ShopifyMediaImage { image?: { url?: string }; }
interface ShopifyVideoSource { url: string; mimeType: string; height?: number; }
interface ShopifyVideo { sources?: ShopifyVideoSource[]; }
interface ShopifyVariant {
  sku?: string;
  price?: string;
  compareAtPrice?: string | null;
  inventoryQuantity?: number | null;
  selectedOptions?: { name: string; value: string }[];
}
interface ShopifyProduct {
  id: string;
  legacyResourceId: string;
  title: string;
  handle: string;
  descriptionHtml?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  status?: string; // ACTIVE | DRAFT | ARCHIVED
  options?: { name: string; values: string[] }[];
  media?: { nodes: (ShopifyMediaImage & ShopifyVideo)[] };
  variants?: { nodes: ShopifyVariant[] };
}

const PRODUCTS_QUERY = `
query Products($cursor: String) {
  products(first: 25, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      legacyResourceId
      title
      handle
      descriptionHtml
      productType
      vendor
      tags
      status
      options { name values }
      media(first: 50) {
        nodes {
          __typename
          ... on MediaImage { image { url } }
          ... on Video { sources { url mimeType height } }
        }
      }
      variants(first: 100) {
        nodes {
          sku
          price
          compareAtPrice
          inventoryQuantity
          selectedOptions { name value }
        }
      }
    }
  }
}`;

async function shopifyGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${STORE}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN! },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify API ${res.status}: ${await res.text().catch(() => '')}`);
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

/** Download a remote media URL and store it under media/<uuid>.<ext>; returns the app media path. */
async function importMedia(url: string): Promise<{ path: string; isVideo: boolean } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const headerMime = (res.headers.get('content-type') || '').split(';')[0].trim();
    const buf = Buffer.from(await res.arrayBuffer());
    // Prefer the server's content-type; fall back to the URL extension.
    const urlExt = new URL(url).pathname.replace(/^.*\./, '').toLowerCase();
    const mime = mimeToExt(headerMime) ? headerMime : extFallbackMime(urlExt);
    const ext = mimeToExt(mime) ?? (urlExt || 'bin');
    const name = `${crypto.randomUUID()}.${ext}`;
    if (!DRY_RUN) await getStorage().put(`media/${name}`, buf, mime);
    return { path: `/api/media/${name}`, isVideo: isVideoMime(mime) };
  } catch (err) {
    logger.warn(`  ! media skipped (${url.slice(0, 80)}…): ${(err as Error).message}`);
    return null;
  }
}

function extFallbackMime(ext: string): string {
  const map: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
  return map[ext] ?? 'image/jpeg';
}

function stripHtml(html?: string): string {
  if (!html) return '';
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Map a Shopify variant's options onto our required colour + size. */
function colourAndSize(v: ShopifyVariant, options?: { name: string }[]): { color: string; size: string } {
  const opts = v.selectedOptions ?? [];
  const byName = (re: RegExp) => opts.find((o) => re.test(o.name))?.value;
  let color = byName(/colou?r|shade/i);
  let size = byName(/size/i);
  if (!size) {
    // The first option that isn't the colour becomes the size.
    const nonColor = opts.find((o) => o.value !== color);
    size = nonColor?.value ?? 'Free';
  }
  if (!color) color = 'Default';
  void options;
  return { color: color.trim() || 'Default', size: size.trim() || 'Free' };
}

async function importProduct(p: ShopifyProduct): Promise<'created' | 'skipped'> {
  const designNumber = `SH-${p.legacyResourceId}`;
  const existing = await Product.findOne({ designNumber });
  if (existing) {
    logger.info(`• ${designNumber} "${p.title}" — already imported, skipping`);
    return 'skipped';
  }

  // Media: images and videos, in Shopify's display order.
  const images: string[] = [];
  const videos: string[] = [];
  for (const m of p.media?.nodes ?? []) {
    if (m.image?.url) {
      const r = await importMedia(m.image.url);
      if (r) (r.isVideo ? videos : images).push(r.path);
    } else if (m.sources?.length) {
      const best = [...m.sources].sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0];
      const r = await importMedia(best.url);
      if (r) (r.isVideo ? videos : images).push(r.path);
    }
  }

  // Variants + prices.
  const vnodes = p.variants?.nodes ?? [];
  const prices = vnodes.map((v) => Number(v.price) || 0).filter((n) => n > 0);
  const b2cPrice = prices.length ? Math.min(...prices) : 0;
  const compareAts = vnodes.map((v) => Number(v.compareAtPrice) || 0);
  const compareAtPrice = Math.max(0, ...compareAts) > b2cPrice ? Math.max(...compareAts) : undefined;

  const variants = vnodes.length
    ? vnodes.map((v) => {
        const { color, size } = colourAndSize(v, p.options);
        return {
          color,
          size,
          quantity: Math.max(0, v.inventoryQuantity ?? 0),
          sellingPrice: Number(v.price) || undefined,
        };
      })
    : [{ color: 'Default', size: 'Free', quantity: 0 }];

  const shopifySkus = vnodes.map((v) => v.sku).filter(Boolean) as string[];

  if (DRY_RUN) {
    logger.info(`• [dry-run] ${designNumber} "${p.title}" — ${variants.length} variants, ${images.length} imgs, ${videos.length} vids, ₹${b2cPrice}`);
    return 'created';
  }

  await Product.create({
    designNumber,
    name: p.title,
    handle: (p.handle || '').toLowerCase() || undefined,
    description: stripHtml(p.descriptionHtml),
    brand: p.vendor || undefined,
    productType: p.productType || undefined,
    tags: p.tags ?? [],
    status: (p.status || 'ACTIVE').toLowerCase(),
    images,
    videos,
    imageUrl: images[0] || '',
    b2cPrice,
    b2bPrice: b2cPrice ? Math.round(b2cPrice) : undefined,
    sellingPrice: b2cPrice,
    compareAtPrice,
    customFields: shopifySkus.length ? [{ label: 'Shopify SKUs', value: shopifySkus.join(', ') }] : [],
    variants,
  });
  logger.info(`✓ ${designNumber} "${p.title}" — ${variants.length} variants, ${images.length} imgs, ${videos.length} vids`);
  return 'created';
}

async function main() {
  if (!STORE || !TOKEN) {
    logger.error('Missing SHOPIFY_STORE and/or SHOPIFY_ADMIN_TOKEN env vars. See the header of this file.');
    process.exit(1);
  }
  logger.info(`Importing from https://${STORE} (API ${API_VERSION})${DRY_RUN ? ' [DRY RUN]' : ''}${LIMIT !== Infinity ? ` [limit ${LIMIT}]` : ''}`);
  await connectDB();

  let cursor: string | null = null;
  let created = 0;
  let skipped = 0;
  let processed = 0;

  try {
    for (;;) {
      type ProductsPage = { products: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: ShopifyProduct[] } };
      const data: ProductsPage = await shopifyGraphQL<ProductsPage>(PRODUCTS_QUERY, { cursor });
      for (const node of data.products.nodes) {
        if (processed >= LIMIT) break;
        processed++;
        const outcome = await importProduct(node);
        outcome === 'created' ? created++ : skipped++;
      }
      if (processed >= LIMIT || !data.products.pageInfo.hasNextPage) break;
      cursor = data.products.pageInfo.endCursor;
      await new Promise((r) => setTimeout(r, 400)); // be gentle with Shopify's rate limit
    }
    logger.info(`Done. Created ${created}, skipped ${skipped}, processed ${processed}.`);
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  logger.error(`Import failed: ${(err as Error).message}`);
  process.exit(1);
});
