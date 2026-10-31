export type DigestStatus = 'ok' | 'retry' | 'fail';

/** One job aggregated from valid log records, in file order. */
export type DigestRow = {
  job: string;
  /** Owner from the last record, including null. Views render null as —. */
  owner: string | null;
  /** Total valid records for this job, including retries and failures. */
  runs: number;
  /** Number of records whose status is retry. */
  retries: number;
  /** Status from the last record. Board counts group rows by this field. */
  lastStatus: DigestStatus;
  /** Most recent supplied error across the job's records, or null. */
  lastError: string | null;
  /** Original at strings from the first and last records; preserve offsets. */
  firstAt: string;
  lastAt: string;
};

export type DigestResult = {
  /** One row per job, sorted by job using ascending string comparison. */
  rows: DigestRow[];
  /** Nonblank lines that fail JSON parsing or record validation. */
  badLines: number;
};

/**
 * Contract for the future implementation in src/digest/readNight.ts.
 * Read runsDir/<night>.jsonl synchronously. night must match YYYY-MM-DD;
 * invalid night names and missing files return null, allowing routes to send 404.
 * Other filesystem errors propagate. An empty file returns { rows: [], badLines: 0 }.
 *
 * A valid record has string at and job, status ok/retry/fail, owner string/null,
 * and optional string error. Ignore extra fields. Skip and count invalid records;
 * ignore blank lines. Aggregate in file order, without converting timestamps.
 * Both HTML and JSON consume the same result and preserve its row order.
 *
 * This type declares the signature only; it does not provide a runtime reader.
 */
export type ReadNight = (runsDir: string, night: string) => DigestResult | null;
