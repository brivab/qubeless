import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;

export interface TotpOptions {
  digits?: number;
  period?: number;
  window?: number;
}

export function generateBase32Secret(byteLength = 20): string {
  const bytes = randomBytes(byteLength);
  return base32Encode(bytes);
}

export function buildOtpAuthUrl(params: {
  issuer: string;
  accountName: string;
  secret: string;
  digits?: number;
  period?: number;
}) {
  const digits = params.digits ?? DEFAULT_DIGITS;
  const period = params.period ?? DEFAULT_PERIOD;
  const issuer = encodeURIComponent(params.issuer);
  const account = encodeURIComponent(params.accountName);
  const secret = params.secret;

  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${digits}&period=${period}`;
}

export function verifyTotp(secret: string, token: string, options: TotpOptions = {}): boolean {
  const digits = options.digits ?? DEFAULT_DIGITS;
  const period = options.period ?? DEFAULT_PERIOD;
  const window = options.window ?? 1;
  const normalized = normalizeToken(token);
  if (!normalized) return false;

  const now = Date.now();
  for (let offset = -window; offset <= window; offset += 1) {
    const counter = Math.floor(now / 1000 / period) + offset;
    const expected = hotp(secret, counter, digits);
    if (safeEqual(expected, normalized)) {
      return true;
    }
  }
  return false;
}

function normalizeToken(token: string): string | null {
  const cleaned = token.replace(/\s+/g, '').trim();
  if (!cleaned) return null;
  return cleaned;
}

function hotp(secret: string, counter: number, digits: number): string {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = code % 10 ** digits;
  return otp.toString().padStart(digits, '0');
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      const index = (value >> (bits - 5)) & 31;
      output += BASE32_ALPHABET[index];
      bits -= 5;
    }
  }

  if (bits > 0) {
    const index = (value << (5 - bits)) & 31;
    output += BASE32_ALPHABET[index];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      const byte = (value >> (bits - 8)) & 0xff;
      bytes.push(byte);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}
