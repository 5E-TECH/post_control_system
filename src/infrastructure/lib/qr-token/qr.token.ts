import { randomBytes } from 'crypto';

export function generateQrToken(length: number = 16): string {
  return randomBytes(length).toString('hex');
}
