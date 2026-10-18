import type { Schema } from 'mongoose';

/** Shared toJSON/toObject config: expose `id`, drop `__v`, and strip sensitive fields. */
// `Schema<any, any, any>` keeps this usable across schemas with custom model/method generics.
export function applyToJSON(schema: Schema<any, any, any>, strip: string[] = []) {
  const transform = (_doc: unknown, ret: Record<string, unknown>) => {
    delete ret.__v;
    for (const field of strip) delete ret[field];
    return ret;
  };
  schema.set('toJSON', { virtuals: true, versionKey: false, transform });
  schema.set('toObject', { virtuals: true, versionKey: false, transform });
}
