/**
 * Backfill `category` (from gender/tags) and `subCategory` (from the title) on imported products so
 * the category-first homepage, category tree and category-scoped filters have data to group on.
 * Only sets fields that are still empty — safe and idempotent.
 *   npm run fill:category -w backend
 */
import { connectDB, disconnectDB } from '../config/db';
import { logger } from '../utils/logger';
import { Product } from '../models/Product';

const noCat = { category: { $in: [null, ''] } };
const noSub = { subCategory: { $in: [null, ''] } };

// CATEGORY — jewellery first (so jewellery items aren't swept into Women by gender), then gender→category.
const CATEGORY_RULES: { category: string; match: Record<string, unknown> }[] = [
  { category: 'Jewellery & Accessories', match: { $or: [{ tags: /jewel/i }, { name: /jewel|necklace|earring|bangle|bracelet|haar|pendant|chain/i }] } },
  { category: 'Girls ( 6 month to 15 year )', match: { gender: 'Girls' } },
  { category: 'Boys ( 6 month to 15 year )', match: { gender: 'Boys' } },
  { category: 'Kids ( Boys & Girls - Common - Unisex )', match: { gender: 'Kids ( boys and girls )' } },
  { category: 'Women', match: { gender: 'Female' } },
  { category: 'Men', match: { gender: 'Male' } },
  { category: 'Men & Women ( Common - Unisex )', match: { gender: 'Unisex ( Male and female )' } },
];

// SUB-CATEGORY — from garment keyword in the title (specific first).
const SUBCATEGORY_RULES: { subCategory: string; match: Record<string, unknown> }[] = [
  { subCategory: 'Chaniya Choli', match: { name: /chaniya/i } },
  { subCategory: 'Kediya', match: { name: /kediya|kedia/i } },
  { subCategory: 'Dhoti', match: { name: /dhoti/i } },
  { subCategory: 'Kurta', match: { name: /kurta\b/i } },
  { subCategory: 'Blouse', match: { name: /blouse/i } },
  { subCategory: 'Dupatta', match: { name: /dupatta/i } },
  { subCategory: 'Skirts', match: { name: /skirt/i } },
  { subCategory: 'Jacket', match: { name: /jacket/i } },
];

async function main() {
  await connectDB();
  try {
    logger.info('— category —');
    for (const { category, match } of CATEGORY_RULES) {
      const res = await Product.updateMany({ ...noCat, ...match }, { $set: { category } });
      logger.info(`✓ ${category}: set ${res.modifiedCount}`);
    }
    const catLeft = await Product.countDocuments(noCat);

    logger.info('— sub-category —');
    for (const { subCategory, match } of SUBCATEGORY_RULES) {
      const res = await Product.updateMany({ ...noSub, ...match }, { $set: { subCategory } });
      logger.info(`✓ ${subCategory}: set ${res.modifiedCount}`);
    }
    const subLeft = await Product.countDocuments(noSub);

    // Second pass: for products STILL without a category, infer it from the sub-category we just set.
    logger.info('— category from sub-category (2nd pass) —');
    const SUB_TO_CAT: { category: string; subs: string[] }[] = [
      { category: 'Girls ( 6 month to 15 year )', subs: ['Chaniya Choli', 'Skirts'] },
      { category: 'Boys ( 6 month to 15 year )', subs: ['Kediya', 'Dhoti'] },
      { category: 'Men', subs: ['Kurta'] },
      { category: 'Women', subs: ['Blouse', 'Dupatta'] },
      { category: 'Kids ( Boys & Girls - Common - Unisex )', subs: ['Jacket'] },
    ];
    for (const { category, subs } of SUB_TO_CAT) {
      const res = await Product.updateMany({ ...noCat, subCategory: { $in: subs } }, { $set: { category } });
      logger.info(`✓ ${category} (from ${subs.join('/')}): set ${res.modifiedCount}`);
    }
    const catLeft2 = await Product.countDocuments(noCat);

    logger.info(`Done. category: ${catLeft} after pass 1, ${catLeft2} after pass 2 remaining. sub-category: ${subLeft} remaining.`);
  } finally {
    await disconnectDB();
  }
}
main().catch((e) => { logger.error((e as Error).message); process.exit(1); });
