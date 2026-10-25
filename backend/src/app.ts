import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import routes from './routes';
import { notFound, errorHandler } from './middleware/error';
import { logger } from './utils/logger';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // correct client IPs behind a reverse proxy (rate limiting, HTTPS)

  app.use(
    helmet({
      // The API serves JSON + PDFs and (optionally) the built SPA; a strict CSP is applied
      // at the hosting/CDN layer in production (see DEPLOYMENT.md). Disabled here to avoid
      // breaking the SPA bundle served from this process.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin / server-to-server (no Origin header) and whitelisted origins.
        // For a disallowed origin, resolve WITHOUT CORS headers (callback(null, false)) rather
        // than throwing — a thrown error 500s the request, which would also break same-origin
        // module/script loads the browser sends in CORS mode (Vite's `crossorigin` assets),
        // blanking the page. Returning false lets same-origin assets serve and simply denies
        // cross-origin JS the ability to read the response.
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        callback(null, false);
      },
      credentials: true,
      // Let the browser read the download filename we set on PDF responses.
      exposedHeaders: ['Content-Disposition'],
    }),
  );

  app.use(compression());
  app.use(
    express.json({
      limit: '2mb',
      // Keep the raw bytes so webhook handlers can verify provider signatures (e.g. Razorpay).
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // General API rate limit.
  const apiLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', apiLimiter, routes);

  // Optional: serve the built frontend from this process (single-service deployment).
  // Resolve against __dirname (compiled to backend/dist) so it works no matter the CWD
  // the host launches us from; fall back to CWD-relative candidates.
  const distCandidates = [
    path.resolve(__dirname, '..', '..', 'frontend', 'dist'),
    path.resolve(process.cwd(), '..', 'frontend', 'dist'),
    path.resolve(process.cwd(), 'frontend', 'dist'),
  ];
  const distDir = distCandidates.find((d) => fs.existsSync(d)) ?? distCandidates[0];
  if (fs.existsSync(distDir)) {
    logger.info(`Serving frontend from ${distDir}`);
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
