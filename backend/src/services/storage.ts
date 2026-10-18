import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { extToMime } from '../utils/mime';

export interface StoredObject {
  stream: Readable;
  contentType: string;
  contentLength?: number;
}

export interface StorageService {
  /** Store an object. `key` is an app-controlled path, e.g. `invoices/<id>.pdf`. */
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Stream an object back (used to proxy private PDFs through the API). */
  getStream(key: string): Promise<StoredObject>;
  getBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Optional time-limited direct URL (S3 only). Used internally, never leaked publicly. */
  signedUrl?(key: string, expiresSeconds: number): Promise<string>;
}

/* ───────────────────────── Local filesystem driver (dev only) ───────────────────────── */
class LocalStorage implements StorageService {
  private root: string;
  constructor(dir: string) {
    this.root = path.resolve(process.cwd(), dir);
  }
  private full(key: string) {
    // Prevent path traversal outside the storage root.
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root)) throw new Error('Invalid storage key');
    return resolved;
  }
  async put(key: string, body: Buffer) {
    const file = this.full(key);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, body);
  }
  async getStream(key: string): Promise<StoredObject> {
    const file = this.full(key);
    const stat = await fsp.stat(file);
    return {
      stream: fs.createReadStream(file),
      contentType: extToMime(key),
      contentLength: stat.size,
    };
  }
  async getBuffer(key: string) {
    return fsp.readFile(this.full(key));
  }
  async delete(key: string) {
    await fsp.rm(this.full(key), { force: true });
  }
  async exists(key: string) {
    try {
      await fsp.access(this.full(key));
      return true;
    } catch {
      return false;
    }
  }
}

/* ───────────────────────────── S3 / S3-compatible driver ───────────────────────────── */
class S3Storage implements StorageService {
  private client: S3Client;
  private bucket: string;
  constructor() {
    this.bucket = env.S3_BUCKET!;
    this.client = new S3Client({
      region: env.S3_REGION!,
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: env.S3_FORCE_PATH_STYLE || undefined,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Objects remain private; access is always proxied/validated by the API.
      }),
    );
  }
  async getStream(key: string): Promise<StoredObject> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return {
      stream: res.Body as Readable,
      contentType: res.ContentType || 'application/pdf',
      contentLength: res.ContentLength,
    };
  }
  async getBuffer(key: string): Promise<Buffer> {
    const { stream } = await this.getStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  async exists(key: string) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
  async signedUrl(key: string, expiresSeconds: number) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresSeconds },
    );
  }
}

let instance: StorageService | null = null;

export function getStorage(): StorageService {
  if (instance) return instance;
  if (env.STORAGE_DRIVER === 's3') {
    logger.info(`Storage: S3 bucket "${env.S3_BUCKET}"${env.S3_ENDPOINT ? ` @ ${env.S3_ENDPOINT}` : ''}`);
    instance = new S3Storage();
  } else {
    logger.info(`Storage: local filesystem "${env.LOCAL_STORAGE_DIR}" (dev fallback)`);
    instance = new LocalStorage(env.LOCAL_STORAGE_DIR);
  }
  return instance;
}

/** Canonical storage key for an invoice PDF. */
export const invoicePdfKey = (invoiceId: string) => `invoices/${invoiceId}.pdf`;
