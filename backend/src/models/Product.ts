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
  subCategory?: string;
  /** Target gender/audience, used as a storefront filter. */
  gender?: string;
  /** Named size group the design is sold in (e.g. "20-24-28-32-36") — printed on tags. */
  sizeGroup?: string;
  /** Apparel attributes (only relevant for clothing categories). */
  dupatta?: string; // 'Yes' | 'No'
  dupattaHeight?: number;
  backOpening?: string; // 'Open' | 'Closed' | 'Backless'
  blouseSize?: string; // a size drawn from the configured size groups
  gher?: number;
  cap?: string; // 'Yes' | 'No'
  belt?: string; // 'Yes' | 'No'
  sleeves?: string; // 'Full' | 'Half' | 'Sleeveless'
  backClosure?: string; // 'Knot' | 'Hook'
  bottomType?: string; // 'Pant' | 'Dhoti'
  fabric?: string;
  brand?: string;
  hsnCode?: string;
  unit: string;
  taxRate: number;
  description?: string;
  imageUrl?: string;
  images: string[];
  videos: string[];
  /** Optional colour tag per image URL — lets the storefront show colour-specific photos. */
  imageColorTags: { image: string; color: string }[];
  customFields: ICustomField[];
  costPrice: number;
  sellingPrice: number;
  b2bPrice?: number;
  b2cPrice?: number;
  /** "Compare-at" / MRP — the struck-through original price shown next to the selling price. */
  compareAtPrice?: number;
  variants: Types.DocumentArray<IVariant>;
  // Shopify-style merchandising fields
  status: string; // 'active' | 'draft' | 'archived'
  productType?: string;
  tags: string[];
  collections: Types.ObjectId[];
  /** Keep selling after stock hits zero (backorders). */
  allowBackorder: boolean;
  // Shipping attributes
  requiresShipping: boolean;
  weight?: number;
  weightUnit: string; // 'kg' | 'g'
  length?: number;
  width?: number;
  height?: number;
  dimensionUnit: string; // 'cm' | 'in'
  countryOfOrigin?: string;
  // SEO
  seoTitle?: string;
  seoDescription?: string;
  /** URL handle for the storefront, e.g. "246-anarkali". Unique when set. */
  handle?: string;
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
    subCategory: { type: String, trim: true },
    gender: { type: String, trim: true, index: true },
    sizeGroup: { type: String, trim: true },
    dupatta: { type: String, trim: true },
    dupattaHeight: { type: Number },
    backOpening: { type: String, trim: true },
    blouseSize: { type: String, trim: true },
    gher: { type: Number },
    cap: { type: String, trim: true },
    belt: { type: String, trim: true },
    sleeves: { type: String, trim: true },
    backClosure: { type: String, trim: true },
    bottomType: { type: String, trim: true },
    fabric: { type: String, trim: true },
    brand: { type: String, trim: true },
    hsnCode: { type: String, trim: true },
    unit: { type: String, trim: true, default: 'Pcs' },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    images: { type: [String], default: [] },
    videos: { type: [String], default: [] },
    imageColorTags: {
      type: [new Schema<{ image: string; color: string }>({ image: { type: String }, color: { type: String, trim: true } }, { _id: false })],
      default: [],
    },
    customFields: {
      type: [new Schema<ICustomField>({ label: { type: String, trim: true }, value: { type: String, trim: true } }, { _id: false })],
      default: [],
    },
    costPrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    b2bPrice: { type: Number, min: 0 },
    b2cPrice: { type: Number, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    variants: { type: [variantSchema], default: [] },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'active', index: true },
    productType: { type: String, trim: true },
    tags: { type: [String], default: [] },
    collections: { type: [{ type: Schema.Types.ObjectId, ref: 'Collection' }], default: [], index: true },
    allowBackorder: { type: Boolean, default: false },
    requiresShipping: { type: Boolean, default: true },
    weight: { type: Number, min: 0 },
    weightUnit: { type: String, enum: ['kg', 'g'], default: 'kg' },
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    dimensionUnit: { type: String, enum: ['cm', 'in'], default: 'cm' },
    countryOfOrigin: { type: String, trim: true },
    seoTitle: { type: String, trim: true },
    seoDescription: { type: String, trim: true },
    handle: { type: String, trim: true, lowercase: true, index: { unique: true, sparse: true } },
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

  // Keep the legacy `active` flag in sync with Shopify-style status so storefront
  // queries (which filter active:true) hide draft/archived products.
  this.active = this.status === 'active';

  // Derive a URL handle once, from the code + a slug of the name.
  if (!this.handle) {
    const slug = (this.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    this.handle = slug ? `${this.code}-${slug}` : String(this.code);
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
