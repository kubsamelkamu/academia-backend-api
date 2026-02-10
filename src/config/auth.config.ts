import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
  passwordResetOtpPepper: process.env.PASSWORD_RESET_OTP_PEPPER,
}));
