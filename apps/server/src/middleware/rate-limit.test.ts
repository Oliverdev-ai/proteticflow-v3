import { describe, expect, it } from 'vitest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildAuthLimiterOptions, buildGlobalLimiterOptions } from './rate-limit.js';

describe('rate-limit middleware', () => {
  it('usa req.ip do Express sem keyGenerator baseado em x-forwarded-for cru', () => {
    const globalOptions = buildGlobalLimiterOptions();
    const authOptions = buildAuthLimiterOptions();

    expect('keyGenerator' in globalOptions).toBe(false);
    expect('keyGenerator' in authOptions).toBe(false);
    expect(globalOptions.windowMs).toBe(60 * 1000);
    expect(authOptions.windowMs).toBe(15 * 60 * 1000);
    expect(authOptions.limit).toBe(10);
  });

  it('bloqueia pelo req.ip mesmo com x-forwarded-for forjado variando', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use((req, _res, next) => {
      Object.defineProperty(req, 'ip', {
        configurable: true,
        value: '198.51.100.10',
      });
      next();
    });
    app.use(rateLimit(buildAuthLimiterOptions()));
    app.get('/login', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const server = await listen(app);
    try {
      const statuses: number[] = [];

      for (let i = 0; i < 11; i += 1) {
        const response = await fetch(`${server.url}/login`, {
          headers: {
            'x-forwarded-for': `203.0.113.${i}`,
          },
        });
        statuses.push(response.status);
      }

      expect(statuses.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => 200));
      expect(statuses[10]).toBe(429);
    } finally {
      await server.close();
    }
  });
});

async function listen(app: express.Express): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }),
  };
}
