import { randomBytes } from 'node:crypto';

const BASE62_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// URL-facing id (e.g. `/{type}/{slug}-{shortId}`) distinct from the primary
// key uuid — short and free of the source uuid's structure/timestamp.
export function generateShortId(length = 8): string {
  const bytes = randomBytes(length);
  let out = '';
  for (const byte of bytes) {
    out += BASE62_ALPHABET[byte % BASE62_ALPHABET.length];
  }
  return out;
}
