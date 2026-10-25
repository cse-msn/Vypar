import { Schema, model, type HydratedDocument } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';

export interface ICollection {
  title: string;
  /** URL handle for the storefront, e.g. "festive-collection". Unique. */
  handle: string;
  description?: string;
  /** Hero/thumbnail image URL (storage key or absolute URL). */
  image?: string;
  /** Display order on the storefront (lower first). */
  sortOrder: number;
  /** Show on the storefront home/nav. */
  featured: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CollectionDoc = HydratedDocument<ICollection>;

const collectionSchema = new Schema<ICollection>(
  {
    title: { type: String, required: true, trim: true },
    handle: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    description: { type: String, trim: true },
    image: { type: String, trim: true },
    sortOrder: { type: Number, default: 0, index: true },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Derive a handle from the title when one isn't supplied.
collectionSchema.pre('validate', function () {
  if (!this.handle && this.title) {
    this.handle = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
  }
});

applyToJSON(collectionSchema);

export const Collection = model<ICollection>('Collection', collectionSchema);
