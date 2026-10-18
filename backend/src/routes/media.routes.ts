import crypto from 'crypto';
import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { getStorage } from '../services/storage';
import { ALLOWED_UPLOAD_MIME, mimeToExt, isVideoMime } from '../utils/mime';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024, files: 12 }, // 60 MB/file, 12 files
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_UPLOAD_MIME.has(file.mimetype)) cb(null, true);
    else cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`, { code: 'BAD_FILE_TYPE' }));
  },
});

/**
 * Upload product media (images/videos). Stored privately-named in object storage
 * and served back via the public /media route. Auth required.
 */
router.post(
  '/uploads',
  requireAuth,
  upload.array('files', 12),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) throw ApiError.badRequest('No files uploaded');
    const storage = getStorage();

    const out = await Promise.all(
      files.map(async (f) => {
        const ext = mimeToExt(f.mimetype) ?? 'bin';
        const name = `${crypto.randomUUID()}.${ext}`;
        await storage.put(`media/${name}`, f.buffer, f.mimetype);
        return { url: `/api/media/${name}`, type: isVideoMime(f.mimetype) ? 'video' : 'image' };
      }),
    );
    res.status(201).json({ data: out });
  }),
);

/**
 * Serve a media file. Public + cacheable — product photos/videos are not sensitive.
 * Filenames are random UUIDs, so content is effectively immutable.
 */
router.get(
  '/media/:file',
  asyncHandler(async (req, res) => {
    // Guard the filename (no path traversal; must look like <uuid>.<ext>).
    const file = req.params.file;
    if (!/^[\w.-]+$/.test(file)) throw ApiError.badRequest('Invalid file name');
    try {
      const obj = await getStorage().getStream(`media/${file}`);
      res.setHeader('Content-Type', obj.contentType);
      if (obj.contentLength) res.setHeader('Content-Length', obj.contentLength);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      obj.stream.pipe(res);
      obj.stream.on('error', () => res.destroy());
    } catch {
      throw ApiError.notFound('Media not found');
    }
  }),
);

export default router;
