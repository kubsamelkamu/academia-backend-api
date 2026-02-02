import { authenticator } from 'otplib';

export const normalizeTotpSecret = (secret: string): string => secret.replace(/\s+/g, '').trim();

export const verifyTotpCode = (secret: string, code: string): boolean => {
  const normalizedSecret = normalizeTotpSecret(secret);
  const normalizedCode = code.replace(/\s+/g, '').trim();

  authenticator.options = { window: 1 };
  return authenticator.check(normalizedCode, normalizedSecret);
};
