import * as dotenv from 'dotenv';

dotenv.config();

export function getJwtSecretOrThrow(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}
