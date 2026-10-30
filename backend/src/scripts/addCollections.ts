/**
 * Upsert a fixed set of storefront collections (idempotent — matched by handle).
 *   npm run add:collections -w backend
 * Reuses the app env (MONGODB_URI). Safe to re-run; existing collections are left as-is.
 */
import { connectDB, disconnectDB } from '../config/db';
import { logger } from '../utils/logger';
import { Collection } from '../models/Collection';

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);

const COLLECTIONS = [
  'All items',
  'Women / Ladies Free Size',
  'Kids',
  'Men',
  'Blouses',
  'Jewellery',
];

async function main() {
  await connectDB();
  try {
    let i = 0;
    for (const title of COLLECTIONS) {
      const handle = slug(title);
      const res = await Collection.updateOne(
        { handle },
        { $setOnInsert: { title, handle, featured: true, active: true, sortOrder: i } },
        { upsert: true },
      );
      logger.info(`${res.upsertedCount ? '✓ created' : '• exists '} "${title}" (/${handle})`);
      i++;
    }
    logger.info('Done.');
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  logger.error(`Failed: ${(err as Error).message}`);
  process.exit(1);
});
