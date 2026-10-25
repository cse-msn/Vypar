import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';
import {
  ORDER_PAYMENT_METHODS,
  ORDER_PAYMENT_STATUS,
  ORDER_STATUS,
  type OrderPaymentMethod,
  type OrderPaymentStatus,
  type OrderStatus,
} from '../constants';

export interface IOrderItem {
  product: Types.ObjectId;
  variantId: Types.ObjectId;
  designNumber: string;
  productName: string;
  color: string;
  size: string;
  sku?: string;
  quantity: number;
  price: number; // unit B2C price snapshot
  amount: number; // price * quantity
}

export interface IShippingAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  pincode: string;
}

export interface IOrder {
  orderNumber: string;
  customer: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  shippingFee: number;
  /** Shipping method label snapshot, e.g. "Standard". */
  shippingMethod?: string;
  discount: number;
  /** Upper-cased coupon code applied to this order, if any. */
  discountCode?: string;
  total: number;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  status: OrderStatus;
  shippingAddress: IShippingAddress;
  notes?: string;
  // Razorpay linkage (online payments).
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  placedAt: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderDoc = HydratedDocument<IOrder>;

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    designNumber: { type: String, required: true },
    productName: { type: String, required: true },
    color: { type: String, required: true },
    size: { type: String, required: true },
    sku: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const addressSchema = new Schema<IShippingAddress>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, default: 0 },
    shippingFee: { type: Number, default: 0 },
    shippingMethod: { type: String, trim: true },
    discount: { type: Number, default: 0 },
    discountCode: { type: String, trim: true, uppercase: true, index: true },
    total: { type: Number, required: true, default: 0 },
    paymentMethod: { type: String, enum: ORDER_PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: ORDER_PAYMENT_STATUS, default: 'pending', index: true },
    status: { type: String, enum: ORDER_STATUS, default: 'placed', index: true },
    shippingAddress: { type: addressSchema, required: true },
    notes: { type: String, trim: true },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    placedAt: { type: Date, default: Date.now, index: true },
    cancelledAt: { type: Date },
  },
  { timestamps: true },
);

applyToJSON(orderSchema);

export const Order = model<IOrder>('Order', orderSchema);
