import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const night = '2026-10-28';
const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };
const directories: string[] = [];

function appForRuns() {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  directories.push(runsDir);
  return { app: createApp({ ...config, runsDir }), runsDir };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('digest routes with the real reader', () => {
  it('serves sorted HTML and matching JSON from an unordered log', async () => {
    const { app, runsDir } = appForRuns();
    writeFileSync(join(runsDir, `${night}.jsonl`), [
      JSON.stringify({ at: '2026-10-28T02:00:00-05:00', job: 'zeta', status: 'fail', owner: null, error: '<script>& "bad"' }),
      JSON.stringify({ at: '2026-10-28T01:00:00+05:30', job: 'alpha', status: 'retry', owner: 'rook', error: 'temporary' }),
      JSON.stringify({ at: '2026-10-28T01:01:00+05:30', job: 'alpha', status: 'retry', owner: 'rook' }),
      'malformed {',
      JSON.stringify({ at: '2026-10-28T01:02:00+05:30', job: 'alpha', status: 'retry', owner: 'rook' }),
      JSON.stringify({ at: '2026-10-28T01:03:00+05:30', job: 'alpha', status: 'ok', owner: 'rook' }),
    ].join('\n'));

    const [page, json] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    const result = await json.json();
    expect(result).toEqual({ badLines: 1, rows: [
      { job: 'alpha', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok', lastError: 'temporary', firstAt: '2026-10-28T01:00:00+05:30', lastAt: '2026-10-28T01:03:00+05:30' },
      { job: 'zeta', owner: null, runs: 1, retries: 0, lastStatus: 'fail', lastError: '<script>& "bad"', firstAt: '2026-10-28T02:00:00-05:00', lastAt: '2026-10-28T02:00:00-05:00' },
    ] });
    const html = await page.text();
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zeta'));
    expect(html).toContain('bad lines · 1');
  });

  it('escapes errors, marks failed and repeatedly retried rows, and preserves timestamp offsets', async () => {
    const { app, runsDir } = appForRuns();
    writeFileSync(join(runsDir, `${night}.jsonl`), [
      JSON.stringify({ at: '2026-10-28T02:00:00-05:00', job: 'fail', status: 'fail', owner: null, error: '<script>& "bad"' }),
      ...[1, 2, 3].map((minute) => JSON.stringify({ at: `2026-10-28T01:0${minute}:00+05:30`, job: 'retry', status: 'retry', owner: null })),
    ].join('\n'));
    const page = await app.request(`/digest/${night}`);
    const html = await page.text();
    expect(html).toContain('&lt;script&gt;&amp; &quot;bad&quot;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('2026-10-28T02:00:00-05:00');
    expect(html).toContain('2026-10-28T01:03:00+05:30');
    expect(html.match(/class="warn"/g)).toHaveLength(3);
    expect(html).toContain('—');
  });

  it('returns 404 for missing logs and renders an empty file as nothing ran', async () => {
    const { app, runsDir } = appForRuns();
    expect((await app.request(`/digest/${night}`)).status).toBe(404);
    expect((await app.request(`/api/digest/${night}`)).status).toBe(404);
    writeFileSync(join(runsDir, `${night}.jsonl`), '');
    const page = await app.request(`/digest/${night}`);
    const json = await app.request(`/api/digest/${night}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(await json.json()).toEqual({ rows: [], badLines: 0 });
  });
});
