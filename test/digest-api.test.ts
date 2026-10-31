import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestResult, ReadNight } from '../src/digest/types.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: '/fixture/runs' };

describe('digest JSON route', () => {
  it('returns the same injected result and ordering as the HTML page', async () => {
    const result: DigestResult = {
      rows: [
        { job: 'alpha', owner: 'rook', runs: 2, retries: 1, lastStatus: 'ok', lastError: null, firstAt: '2026-10-28T01:00:00+01:00', lastAt: '2026-10-28T01:02:00+01:00' },
        { job: 'zeta', owner: null, runs: 1, retries: 0, lastStatus: 'fail', lastError: 'oops', firstAt: '2026-10-28T02:00:00+01:00', lastAt: '2026-10-28T02:00:00+01:00' },
      ],
      badLines: 1,
    };
    const calls: string[] = [];
    const reader: ReadNight = (runsDir, night) => {
      calls.push(`${runsDir}/${night}`);
      return result;
    };
    const app = createApp(config, reader);
    const page = await app.request('/digest/2026-10-28');
    const response = await app.request('/api/digest/2026-10-28');

    expect(page.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(calls).toEqual(['/fixture/runs/2026-10-28', '/fixture/runs/2026-10-28']);
    const html = await page.text();
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zeta'));
    expect(html).toContain('bad lines · 1');
  });

  it('returns 404 for missing or invalid nights and 200 for an empty night', async () => {
    const reader: ReadNight = (_runsDir, night) => night === '2026-10-28' ? { rows: [], badLines: 0 } : null;
    const app = createApp(config, reader);

    expect((await app.request('/api/digest/not-a-date')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-29')).status).toBe(404);
    const empty = await app.request('/api/digest/2026-10-28');
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ rows: [], badLines: 0 });
  });
});
