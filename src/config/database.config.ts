import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  shadowUrl: process.env.SHADOW_DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true',
}));
