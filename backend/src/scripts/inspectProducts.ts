import { connectDB, disconnectDB } from '../config/db';
import { logger } from '../utils/logger';
import { Product } from '../models/Product';

async function main() {
  await connectDB();
  try {
    const total = await Product.countDocuments();
    const withCategory = await Product.countDocuments({ category: { $nin: [null, ''] } });
    const types = await Product.distinct('productType');
    const tagsAgg = await Product.aggregate<{ _id: string; n: number }>([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 40 },
    ]);
    logger.info(`total=${total} withCategory=${withCategory}`);
    logger.info(`productTypes (${types.length}): ${JSON.stringify(types)}`);
    logger.info(`top tags: ${JSON.stringify(tagsAgg.map((t) => `${t._id}:${t.n}`))}`);
    const sample = await Product.find().limit(8).select('name category subCategory productType tags');
    for (const p of sample) logger.info(`• ${p.name} | cat=${p.category ?? '-'} sub=${p.subCategory ?? '-'} type=${p.productType ?? '-'} tags=${(p.tags ?? []).join(',')}`);
  } finally {
    await disconnectDB();
  }
}
main().catch((e) => { logger.error((e as Error).message); process.exit(1); });
