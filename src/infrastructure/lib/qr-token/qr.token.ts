import { randomBytes } from 'crypto';

export function generateCustomToken(length: number = 16): string {
  return randomBytes(length).toString('hex');
}
