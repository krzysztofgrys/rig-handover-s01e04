import type { DigestResult } from '../digest/types.js';

export function DigestPage({ night, result }: { night: string; result: DigestResult }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {result.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead><tr>
            <th>job</th><th>owner</th><th>runs</th><th>retries</th><th>last status</th>
            <th>last error</th><th>first time</th><th>last time</th>
          </tr></thead>
          <tbody>{result.rows.map((row) => {
            const marked = row.lastStatus === 'fail' || row.retries >= 3;
            return (
              <tr>
                <td>{row.job}</td>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td class={row.retries >= 3 ? 'warn' : undefined}>{row.retries}</td>
                <td class={marked ? 'warn' : undefined}>{row.lastStatus}</td>
                <td>{row.lastError ?? '—'}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
      <p class="mute">bad lines · {result.badLines}</p>
    </>
  );
}
