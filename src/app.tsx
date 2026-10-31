import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { readNight } from './digest/readNight.js';
import type { ReadNight } from './digest/types.js';
import { Layout } from './views/layout.js';
import { DigestPage } from './views/digest.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig(), reader: ReadNight = readNight) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const result = reader(config.runsDir, c.req.param('night'));
    if (result === null) return c.notFound();
    return c.html(
      <Layout title={`digest ${c.req.param('night')}`} lane={lane()}>
        <DigestPage night={c.req.param('night')} result={result} />
      </Layout>,
    );
  });

  return app;
}
