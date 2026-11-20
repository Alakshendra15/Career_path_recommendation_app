import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createPool } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { createMlClient } from './services/mlClient.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl);

const applied = await runMigrations(pool); // keeps the schema current on every start
if (applied.length) console.log(`Applied migrations: ${applied.join(', ')}`);

const app = createApp({ pool, config, ml: createMlClient(config) });
// 0.0.0.0 so a phone on the same Wi-Fi can reach the dev machine
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`API listening on port ${config.port} (ML service: ${config.mlServiceUrl})`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => pool.end().then(() => process.exit(0))));
}
