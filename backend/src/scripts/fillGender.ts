/**
 * Backfill the `gender` field on products from Shopify tags + our category (imported products carry
 * tags like "Women"/"Girls"/"Boys"/"Kids"/"MenWomen"). Only sets products that don't already have a
 * gender, applying the most specific rule first, so it's safe and idempotent.
 *   npm run fill:gender -w backend
 */
import { connectDB, disconnectDB } from '../config/db';
import { logger } from '../utils/logger';
import { Product } from '../models/Product';

const unset = { gender: { $in: [null, ''] } };

// Most specific first; each only touches products still without a gender.
const RULES: { gender: string; match: Record<string, unknown> }[] = [
  { gender: 'Girls', match: { $or: [{ tags: /^girls/i }, { category: /girls/i }] } },
  { gender: 'Boys', match: { $or: [{ tags: /^boys/i }, { category: /boys/i }] } },
  { gender: 'Kids ( boys and girls )', match: { $or: [{ tags: /^kids/i }, { category: /kids/i }] } },
  { gender: 'Unisex ( Male and female )', match: { $or: [{ tags: /menwomen/i }, { category: /men\s*&\s*women/i }] } },
  { gender: 'Female', match: { $or: [{ tags: /^women$/i }, { category: /^women/i }] } },
  { gender: 'Male', match: { $or: [{ tags: /^men$/i }, { category: /^men(\s|$)/i }] } },
];

async function main() {
  await connectDB();
  try {
    for (const { gender, match } of RULES) {
      const res = await Product.updateMany({ ...unset, ...match }, { $set: { gender } });
      logger.info(`✓ ${gender}: set ${res.modifiedCount}`);
    }
    const remaining = await Product.countDocuments(unset);
    logger.info(`Done. ${remaining} products still have no gender (no matching tag/category).`);
  } finally {
    await disconnectDB();
  }
}
main().catch((e) => { logger.error((e as Error).message); process.exit(1); });
