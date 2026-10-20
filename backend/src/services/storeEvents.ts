import { Types } from 'mongoose';
import { StoreEvent } from '../models/StoreEvent';

/**
 * Link a visitor's earlier anonymous journey to their customer record once they
 * sign up / log in. Only events not already tied to a customer are backfilled.
 */
export async function stitchAnonymousEvents(anonymousId: string | undefined, customerId: string): Promise<void> {
  if (!anonymousId) return;
  await StoreEvent.updateMany(
    { anonymousId, customer: { $exists: false } },
    { $set: { customer: new Types.ObjectId(customerId) } },
  );
}
