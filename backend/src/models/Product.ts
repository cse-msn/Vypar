import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';
import { nextSequence } from './Counter';
import { DEFAULT_LOW_STOCK } from '../constants';

/** A sellable stock-keeping unit: a colour + size of a design, with its own quantity. */
export interface IVariant {
  _id: Types.ObjectId;
  color: string;
  size: string;
  /** Stable per-product sequence (1,2,3…) used to build the numeric item code. */
  seq?: number;
  /** Numeric, scannable item code / barcode, e.g. 200007001 (= product.code + seq). */
  sku: string;
  quantity: number;
  /** Optional per-variant overrides; fall back to product-level prices when unset. */
  costPrice?: number;
  sellingPrice?: number;
  lowStockThreshold: number;
}

export interface ICustomField {
  label: string;
  value: string;
}

export interface IProduct {
  /** Numeric design/item base code, e.g. 200007. Auto-assigned on creation. */
  code: number;
  /** Monotonic counter for variant sequences (never reused, so item codes stay stable). */
  variantSeq: number;
  designNumber: string;
  name: string;
  category?: string;
  fabric?: string;
  brand?: string;
  hsnCode?: string;
  unit: string;
  taxRate: number;
  description?: string;
  imageUrl?: string;
  images: string[];
  videos: string[];
  customFields: ICustomField[];
  costPrice: number;
  sellingPrice: number;
  variants: Types.DocumentArray<IVariant>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  // virtuals
  totalStock: number;
}

export type ProductDoc = HydratedDocument<IProduct>;

const variantSchema = new Schema<IVariant>(
  {
    color: { type: String, required: true, trim: true },
    size: { type: String, required: true, trim: true },
    seq: { type: Number },
    sku: { type: String, trim: true, uppercase: true },
    quantity: { type: Number, default: 0, min: [0, 'Stock cannot be negative'] },
    costPrice: { type: Number, min: 0 },
    sellingPrice: { type: Number, min: 0 },
    lowStockThreshold: { type: Number, default: DEFAULT_LOW_STOCK, min: 0 },
  },
  { _id: true },
);

const productSchema = new Schema<IProduct>(
  {
    code: { type: Number, index: { unique: true, sparse: true } },
    variantSeq: { type: Number, default: 0 },
    designNumber: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    fabric: { type: String, trim: true },
    brand: { type: String, trim: true },
    hsnCode: { type: String, trim: true },
    unit: { type: String, trim: true, default: 'Pcs' },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    images: { type: [String], default: [] },
    videos: { type: [String], default: [] },
    customFields: {
      type: [new Schema<ICustomField>({ label: { type: String, trim: true }, value: { type: String, trim: true } }, { _id: false })],
      default: [],
    },
    costPrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    variants: { type: [variantSchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Full-text search across the fields shop staff type into the search box.
productSchema.index({ name: 'text', designNumber: 'text', brand: 'text', category: 'text' });
// Global uniqueness of SKUs / barcodes (multikey over the variants array).
productSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });

productSchema.virtual('totalStock').get(function (this: IProduct) {
  return this.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
});

// Assign the numeric item code + per-variant codes before validation.
// Item code = <product.code><variant.seq padded to 3> e.g. 200007 + 001 → 200007001.
productSchema.pre('validate', async function () {
  if (this.designNumber) this.designNumber = this.designNumber.toUpperCase().trim();

  // Base code is assigned once, from a global counter starting at 200001.
  if (this.code == null) {
    this.code = 200000 + (await nextSequence('productCode'));
  }

  for (const v of this.variants) {
    // Stable, never-reused sequence per variant (so deleting a variant leaves a gap,
    // matching the shop's existing numbering rather than renumbering others).
    if (v.seq == null) {
      this.variantSeq = (this.variantSeq || 0) + 1;
      v.seq = this.variantSeq;
    }
    if (!v.sku) {
      v.sku = `${this.code}${String(v.seq).padStart(3, '0')}`;
    }
  }
});

applyToJSON(productSchema);

export const Product = model<IProduct>('Product', productSchema);
