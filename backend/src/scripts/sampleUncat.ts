import { connectDB, disconnectDB } from '../config/db';
import { logger } from '../utils/logger';
import { Product } from '../models/Product';

async function main() {
  await connectDB();
  try {
    const noCat = { category: { $in: [null, ''] } };
    const total = await Product.countDocuments(noCat);
    const sample = await Product.find(noCat).limit(20).select('name tags');
    logger.info(`${total} products without a category. Sample:`);
    for (const p of sample) logger.info(`  • ${p.name}  [tags: ${(p.tags ?? []).join(', ') || '-'}]`);
  } finally {
    await disconnectDB();
  }
}
main().catch((e) => { logger.error((e as Error).message); process.exit(1); });
