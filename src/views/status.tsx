import type { DigestResult } from '../digest/types.js';
import type { Status } from '../status.js';

export function StatusBoard({ status, digests }: { status: Status; digests: Record<string, DigestResult | null> }) {
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} · pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {status.nights.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <ul>
          {status.nights.map((n) => {
            const result = digests[n];
            const counts = { ok: 0, retry: 0, fail: 0 };
            for (const row of result?.rows ?? []) counts[row.lastStatus] += 1;
            return (
              <li>
                <a href={`/digest/${n}`}>{n}</a>{' '}
                (ok {counts.ok} · retry {counts.retry} · fail {counts.fail})
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
