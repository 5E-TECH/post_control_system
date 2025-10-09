import { randomBytes } from 'crypto';

export function generateCustomToken(length: number = 12): string {
  return randomBytes(length).toString('hex');
}
