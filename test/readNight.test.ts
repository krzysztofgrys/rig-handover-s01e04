import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/readNight.js';

const night = '2026-10-28';
const record = { at: '2026-10-29T01:30:00+01:00', job: 'sync', status: 'ok', owner: 'rook' };

describe('readNight', () => {
  let runsDir: string;
  beforeEach(() => { runsDir = mkdtempSync(join(tmpdir(), 'rig-reader-')); });
  afterEach(() => { rmSync(runsDir, { recursive: true, force: true }); });

  function writeRecords(records: unknown[]) {
    writeFileSync(join(runsDir, `${night}.jsonl`), records.map((value) => JSON.stringify(value)).join('\n'));
  }

  it('reads the real night as five sorted jobs and one bad line', () => {
    const fixtures = fileURLToPath(new URL('../runs/', import.meta.url));
    expect(readNight(fixtures, night)).toEqual({
      badLines: 1,
      rows: [
        { job: 'digest/render', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00' },
        { job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503',
          firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00' },
        { job: 'lane/sync', owner: 'rook', runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held',
          firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00' },
        { job: 'notes/backup', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded',
          firstAt: '2026-10-29T04:00:01+01:00', lastAt: '2026-10-29T04:00:01+01:00' },
        { job: 'rig/rotate-logs', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-28T23:00:02+01:00', lastAt: '2026-10-28T23:00:02+01:00' },
      ],
    });
  });

  it('aggregates in file order, retaining offsets, latest owner and latest supplied error', () => {
    writeRecords([
      { ...record, status: 'retry', error: 'first', at: '2026-10-29T08:00:00+05:30' },
      { ...record, status: 'fail', error: 'second', owner: 'other' },
      { ...record, owner: null, at: '2026-10-28T01:00:00-07:00' },
    ]);
    expect(readNight(runsDir, night)).toEqual({ badLines: 0, rows: [{
      job: 'sync', owner: null, runs: 3, retries: 1, lastStatus: 'ok', lastError: 'second',
      firstAt: '2026-10-29T08:00:00+05:30', lastAt: '2026-10-28T01:00:00-07:00',
    }] });
  });

  it('treats an empty error as supplied and accepts an owner after null', () => {
    writeRecords([
      { ...record, owner: null, error: 'previous' },
      { ...record, error: '' },
      record,
    ]);
    expect(readNight(runsDir, night)?.rows[0]).toMatchObject({ owner: 'rook', lastError: '', runs: 3 });
  });

  it('counts malformed JSON and invalid records without losing subsequent valid records', () => {
    const invalid: unknown[] = [
      null, [], 1, 'text', true, {},
      { ...record, at: null }, { job: 'sync', status: 'ok', owner: null },
      { ...record, job: 1 }, { at: '', status: 'ok', owner: null },
      { ...record, status: 'unknown' }, { at: '', job: 'sync', owner: null },
      { ...record, owner: 1 }, { at: '', job: 'sync', status: 'ok' },
      { ...record, error: null }, { ...record, error: 1 },
    ];
    writeFileSync(join(runsDir, `${night}.jsonl`), [
      JSON.stringify(record), 'broken JSON', ...invalid.map((value) => JSON.stringify(value)),
      '', ' \t\r', JSON.stringify({ ...record, extra: { ignored: true } }), '',
    ].join('\r\n'));
    expect(readNight(runsDir, night)).toEqual({ badLines: invalid.length + 1, rows: [{
      job: 'sync', owner: 'rook', runs: 2, retries: 0, lastStatus: 'ok', lastError: null,
      firstAt: record.at, lastAt: record.at,
    }] });
  });

  it('uses string comparison for job order and accepts arbitrary string timestamps and jobs', () => {
    writeRecords(['a', 'ä', '__proto__', 'Z', ''].map((job) => ({ ...record, job, at: '' })));
    expect(readNight(runsDir, night)?.rows.map((row) => row.job)).toEqual(['', 'Z', '__proto__', 'a', 'ä']);
  });

  it.each(['', '2026-10-2', '26-10-28', '../2026-10-28', '/2026-10-28', '2026-10-28.jsonl', '2026-10-28\n', '2026-10-28/extra'])('returns null for invalid night %j before reading', (invalidNight) => {
    // A file in place of the directory would throw ENOTDIR if the reader accessed it.
    const file = join(runsDir, 'file');
    writeFileSync(file, '');
    expect(readNight(file, invalidNight)).toBeNull();
  });

  it('returns null for missing files and directories', () => {
    expect(readNight(runsDir, night)).toBeNull();
    expect(readNight(join(runsDir, 'absent'), night)).toBeNull();
  });

  it.each(['', ' \n\t\r\n'])('returns an empty result for empty or blank content %j', (contents) => {
    writeFileSync(join(runsDir, `${night}.jsonl`), contents);
    expect(readNight(runsDir, night)).toEqual({ rows: [], badLines: 0 });
  });

  it('returns bad-line counts even when no records are valid', () => {
    writeRecords([null, {}]);
    expect(readNight(runsDir, night)).toEqual({ rows: [], badLines: 2 });
  });

  it('propagates filesystem errors other than missing files', () => {
    const file = join(runsDir, 'file');
    writeFileSync(file, '');
    expect(() => readNight(file, night)).toThrow(expect.objectContaining({ code: 'ENOTDIR' }));
  });
});
