import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
  });

  it('links both fixture nights with counts from their digest rows', async () => {
    const app = createApp(config);
    const res = await app.request('/');
    const html = await res.text();
    expect(res.status).toBe(200);

    for (const night of ['2026-10-28', '2026-10-27']) {
      const digestResponse = await app.request(`/api/digest/${night}`);
      expect(digestResponse.status).toBe(200);
      const digest = await digestResponse.json() as { rows: { lastStatus: 'ok' | 'retry' | 'fail' }[] };
      const counts = { ok: 0, retry: 0, fail: 0 };
      for (const row of digest.rows) counts[row.lastStatus] += 1;
      expect(html).toContain(`<a href="/digest/${night}">${night}</a>`);
      expect(html).toContain(`ok ${counts.ok} · retry ${counts.retry} · fail ${counts.fail}`);

      const pageResponse = await app.request(`/digest/${night}`);
      expect(pageResponse.status).toBe(200);
    }
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
