import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Centralised, validated environment configuration.
 * The app refuses to boot if required variables are missing/invalid,
 * so misconfiguration fails fast instead of at request time.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),

  PUBLIC_APP_URL: z.string().url().default('http://localhost:5173'),

  STORAGE_DRIVER: z.enum(['s3', 'local']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('.storage'),

  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),

  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1000),

  SHOP_NAME: z.string().default('MNM Fashion'),
  SHOP_ADDRESS: z.string().default(''),
  SHOP_PHONE: z.string().default(''),
  SHOP_GSTIN: z.string().default(''),
  SHOP_EMAIL: z.string().default(''),
  // GST tax-invoice details
  SHOP_STATE: z.string().default(''),
  SHOP_STATE_CODE: z.string().default(''),
  SHOP_BANK_NAME: z.string().default(''),
  SHOP_BANK_ACCOUNT: z.string().default(''),
  SHOP_BANK_IFSC: z.string().default(''),
  SHOP_DEFAULT_HSN: z.string().default(''),

  // Coded price printed on product tags. Format: <YY><mid><price padded><suffix>
  // where YY = current year's last 2 digits (ONLY this rolls); mid + suffix stay fixed.
  // e.g. 2026 + mid 271008 + price 1200 + suffix 23 → 26271008120023 ; 2027 → 27271008120023
  PRICE_CODE_MID: z.string().default('271008'),
  PRICE_CODE_SUFFIX: z.string().default('23'),
  PRICE_CODE_PAD: z.coerce.number().int().min(0).max(8).default(4),
  // Optional: pin the year (2-or-4 digit) instead of using the current year.
  PRICE_CODE_YEAR: z.coerce.number().int().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    '❌ Invalid environment configuration:\n',
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

const raw = parsed.data;

// Guard: the S3 driver needs credentials.
if (raw.STORAGE_DRIVER === 's3') {
  const missing = (['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const).filter(
    (k) => !raw[k],
  );
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error(`❌ STORAGE_DRIVER=s3 but missing: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  shop: {
    name: raw.SHOP_NAME,
    address: raw.SHOP_ADDRESS,
    phone: raw.SHOP_PHONE,
    gstin: raw.SHOP_GSTIN,
    email: raw.SHOP_EMAIL,
    state: raw.SHOP_STATE,
    stateCode: raw.SHOP_STATE_CODE,
    defaultHsn: raw.SHOP_DEFAULT_HSN,
    bank: {
      name: raw.SHOP_BANK_NAME,
      account: raw.SHOP_BANK_ACCOUNT,
      ifsc: raw.SHOP_BANK_IFSC,
    },
  },
  priceCode: {
    mid: raw.PRICE_CODE_MID,
    suffix: raw.PRICE_CODE_SUFFIX,
    pad: raw.PRICE_CODE_PAD,
    year: raw.PRICE_CODE_YEAR,
  },
};

export type Env = typeof env;
