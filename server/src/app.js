import compression from 'compression';
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

  /*
    Every JSON response this API had ever sent went out uncompressed.

    Nothing was obviously wrong, which is why it survived: the payloads that
    made the app feel fast were already small, and the ones that were not — the
    roadmap aggregation, a two-thousand-word guide, and now Learn's catalogue at
    60KB — are exactly the ones nobody measures because they only load once.
    That catalogue is 19KB compressed. The same three-to-one holds across the
    whole surface; JSON is mostly punctuation and repeated key names.

    Below the rate limiter, so a 429 is still written before any of this is
    reached, and above the body parser because it wraps the *response* — the
    order relative to `express.json` is free, and this is where it reads.

    The SSE stream needs no exception: `chat.controller.js` already sets
    `no-transform` on it, which this honours by design. Without that header a
    compressor buffers, and a token stream that arrives in one lump at the end
    is not a stream.
  */
  app.use(compression());

  /*
    Every body is parsed here at one megabyte — except the system design
    module's, which parses its own inside routes/design.routes.js.

    Two reasons it cannot simply share this one. A board save can legitimately
    be larger than a megabyte (a pasted diagram, a long stretch offline), and the
    fix is not to raise the ceiling for every route in the app. And this parser
    runs before authentication, so raising it here would let an anonymous caller
    make the process read two megabytes to be told 401. Inside the router, the
    body is read only after auth, the module gate, the rate limiter and the access
    check have all said yes — the same "refuse before reading" argument the rate
    limiter above makes about its own position.

    If the pattern and the mount ever disagree, it fails safe: a design route
    that skipped parsing has no body and fails validation with a 400, and a
    route parsed twice is a no-op because body-parser marks what it has read.
    Case-insensitive because Express routing is.
  */
  const json = express.json({ limit: '1mb' });
  const parsesOwnBody = /^\/api\/design(\/|$)/i;
  app.use((req, res, next) => (parsesOwnBody.test(req.path) ? next() : json(req, res, next)));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));

  app.use('/api', router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
