import pg from 'pg';

export function createPool(databaseUrl) {
  if (!databaseUrl) throw new Error('DATABASE_URL is not set (see .env.example)');
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  pool.on('error', (err) => console.error('Unexpected PostgreSQL pool error:', err.message));
  return pool;
}
