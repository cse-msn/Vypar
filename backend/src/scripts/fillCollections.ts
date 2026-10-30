/**
 * Auto-assign products to the storefront collections, using Shopify tags + our category + the title
 * (imported products have tags like "Women"/"Girls"/"Kids"/"MenWomen" and a Jewelry tag, but no
 * category). Idempotent — uses $addToSet, so re-running never duplicates. Report shows matches each.
 *   npm run fill:collections -w backend
 */
import { connectDB, disconnectDB } from '../config/db';
import { logger } from '../utils/logger';
import { Collection } from '../models/Collection';
import { Product } from '../models/Product';

// handle → the Mongo filter that selects its products ({} = everything).
const RULES: Record<string, Record<string, unknown>> = {
  'all-items': {},
  'women-ladies-free-size': { $or: [{ tags: /^women$/i }, { tags: /menwomen/i }, { category: /women/i }] },
  kids: { $or: [{ tags: /^(girls|boys|kids)/i }, { category: /girls|boys|kids/i }] },
  men: { $or: [{ tags: /^men$/i }, { tags: /menwomen/i }, { category: /^men/i }] },
  blouses: { $or: [{ tags: /blouse/i }, { subCategory: /blouse/i }, { name: /blouse/i }] },
  jewellery: { $or: [{ tags: /jewel/i }, { category: /jewel/i }, { name: /jewel|necklace|earring|bangle|bracelet/i }] },
};

async function main() {
  await connectDB();
  try {
    for (const [handle, filter] of Object.entries(RULES)) {
      const col = await Collection.findOne({ handle });
      if (!col) {
        logger.warn(`! collection /${handle} not found — skipping`);
        continue;
      }
      const matched = await Product.countDocuments(filter);
      const res = await Product.updateMany(filter, { $addToSet: { collections: col._id } });
      logger.info(`✓ ${col.title}: matched ${matched}, newly added ${res.modifiedCount}`);
    }
    logger.info('Done.');
  } finally {
    await disconnectDB();
  }
}
main().catch((e) => { logger.error((e as Error).message); process.exit(1); });
