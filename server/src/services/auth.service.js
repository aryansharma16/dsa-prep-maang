import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

const BCRYPT_ROUNDS = 12;

export async function registerUser({ email, password, name }) {
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with that email already exists', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return User.create({ email, passwordHash, name });
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email });
  // Same message either way so the endpoint doesn't leak which emails exist.
  if (!user) throw ApiError.unauthorized('Incorrect email or password', 'BAD_CREDENTIALS');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw ApiError.unauthorized('Incorrect email or password', 'BAD_CREDENTIALS');

  return user;
}
