// Local development PostgreSQL with no installer: `npm run dev:db`
// Runs a real PostgreSQL server from the embedded-postgres package, storing data in backend/.pgdata.
// Leave it running in its own terminal. Stop it with Ctrl+C. Delete .pgdata to start from an empty database.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databaseDir = path.join(root, '.pgdata');
const PORT = Number(process.env.DEV_DB_PORT ?? 5433); // 5433 so it never clashes with a normal PostgreSQL on 5432
const DB_NAME = 'career_path';

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres', // local development only
  port: PORT,
  persistent: true,
  autoRehydrateSymlinks: true,
  onLog: () => {},
  onError: (e) => console.error(String(e)),
});

if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) {
  console.log('Creating a new local database cluster...');
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase(DB_NAME);
  console.log(`Created database "${DB_NAME}"`);
} catch {
  /* already exists */
}
console.log(`PostgreSQL ready: postgres://postgres:postgres@localhost:${PORT}/${DB_NAME}`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  console.log('Stopping PostgreSQL...');
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30); // keep the process alive
