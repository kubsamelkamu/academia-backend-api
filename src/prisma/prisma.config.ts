import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const env = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export default defineConfig({
  schema: 'schema.prisma',

  datasource: {
    url: env('DATABASE_URL'),
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});