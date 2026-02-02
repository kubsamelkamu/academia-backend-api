import { randomBytes, timingSafeEqual } from 'crypto';

export type BackupCodePair = {
  plain: string;
  hash: string;
};

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const normalizeCode = (code: string): string => code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const constantTimeEquals = (a: string, b: string): boolean => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
};

const randomCodeChars = (length: number): string => {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
};

export const formatBackupCode = (code: string): string => {
  const n = normalizeCode(code);
  return `${n.slice(0, 5)}-${n.slice(5)}`;
};

export const generateBackupCodes = (count = 10): string[] => {
  const codes: string[] = [];
  while (codes.length < count) {
    const raw = randomCodeChars(10);
    const formatted = formatBackupCode(raw);
    if (!codes.includes(formatted)) {
      codes.push(formatted);
    }
  }
  return codes;
};

export const hashBackupCode = (userId: string, code: string): string => {
  // Deliberately bind to userId to mitigate hash reuse across accounts.
  // Hashing is done with bcrypt later; this is a deterministic pre-hash input.
  return `${userId}:${normalizeCode(code)}`;
};

export const isBackupCodeMatch = (a: string, b: string): boolean => {
  return constantTimeEquals(normalizeCode(a), normalizeCode(b));
};
