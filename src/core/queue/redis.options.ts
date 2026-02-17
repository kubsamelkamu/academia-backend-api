import type { RedisOptions } from 'ioredis';

export function buildBullRedisOptions(redisUrl?: string): RedisOptions | string {
  if (!redisUrl) {
    return 'redis://localhost:6379';
  }

  try {
    const url = new URL(redisUrl);

    const options: RedisOptions = {
      host: url.hostname,
      port: url.port ? Number(url.port) : 6379,
      username: url.username || undefined,
      password: url.password || undefined,
    };

    // Heroku Redis commonly uses rediss:// and requires TLS.
    if (url.protocol === 'rediss:') {
      options.tls = {};
    }

    return options;
  } catch {
    // Fallback to passing through the raw string.
    return redisUrl;
  }
}
