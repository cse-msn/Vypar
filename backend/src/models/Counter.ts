import { Schema, model } from 'mongoose';
import type { ClientSession } from 'mongoose';

interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = model<CounterDoc>('Counter', counterSchema);

/** Atomically increment and return the next value for a named sequence. */
export async function nextSequence(name: string, session?: ClientSession): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );
  return doc!.seq;
}

/** Format a sequence into a padded, prefixed document number, e.g. INV-000123. */
export function formatNumber(prefix: string, seq: number, pad = 6): string {
  return `${prefix}-${String(seq).padStart(pad, '0')}`;
}
