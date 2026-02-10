import { createHash, randomBytes, randomInt } from 'crypto';

export const PASSWORD_RESET_OTP_LENGTH = 6;
export const PASSWORD_RESET_OTP_TTL_MINUTES = 10;

export const generateNumericOtp = (length = PASSWORD_RESET_OTP_LENGTH): string => {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(randomInt(min, max));
};

export const generateOtpSalt = (): string => randomBytes(16).toString('hex');

export const hashOtp = (otp: string, salt: string, pepper: string): string => {
  // Intentionally simple: hash(salt + otp + pepper). OTP is short-lived.
  // Pepper should be a secret value (e.g. JWT secret or dedicated env var).
  return createHash('sha256').update(`${salt}:${otp}:${pepper}`).digest('hex');
};

export const safeTrimLower = (value: string): string => value.trim().toLowerCase();
