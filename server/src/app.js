import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { router } from './routes/index.js';

export function createApp() {
  const app = express();

  // Render sits behind a proxy; without this, secure cookies are dropped.
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: env.clientUrl.split(',').map((s) => s.trim()),
      credentials: true,
      // A browser cannot read a response header it was not offered. These are
      // the ones a client would want on a 429 — how much budget is left, and how
      // long to wait — and they are useless behind the documented Vercel rewrite
      // only because that path is same-origin. This is for the VITE_API_URL
      // escape hatch, where it is a genuine cross-origin call.
      exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'Retry-After'],
    }),
  );

  /*
    Above the body parser deliberately. Mounted below it, a caller who is already
    over their limit still gets a megabyte of JSON read off the socket and parsed
    before being turned away — the work is done and then thrown out, which is the
    cheapest thing a flood could ask this process to do for it. Here the 429 is
    written before the body is touched.

    It has to stay below `cors()`, though, or the rejection arrives without the
    headers that let a browser read it, and a rate limit shows up in the console
    as a CORS failure instead.
  */
  app.use('/api', apiLimiter);

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));

  app.use('/api', router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
