import mongoose from 'mongoose';

/**
 * Runs `fn(session)` in a Mongo transaction and returns what it returned.
 *
 * The design module is the first thing in this codebase to use transactions,
 * so the rules are worth writing down where every caller will see them:
 *
 * - **Every read and write inside must pass `session`.** One that forgets runs
 *   outside the transaction, silently, and reads or writes around it.
 * - **The callback can run more than once.** The driver retries the whole thing
 *   on a transient error — two commits to the same board colliding on its `rev`
 *   is exactly that, and is how commits are serialised. So nothing in here may
 *   have an effect outside the database (an S3 call, an emitted event, a
 *   response), and every value must be computed afresh inside rather than
 *   accumulated across attempts.
 *
 * The result is captured in a closure rather than taken from `withTransaction`,
 * whose return value has changed meaning across driver versions.
 */
export async function inTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
