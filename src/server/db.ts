import pg from "pg";

// Return DATE columns as 'YYYY-MM-DD' strings and NUMERIC as JS numbers.
pg.types.setTypeParser(1082, (v: string) => v);
pg.types.setTypeParser(1700, (v: string) => Number(v));
pg.types.setTypeParser(20, (v: string) => Number(v));

const globalForPool = globalThis as unknown as { __waypointPool?: pg.Pool };

export function pool(): pg.Pool {
  if (!globalForPool.__waypointPool) {
    globalForPool.__waypointPool = new pg.Pool({
      connectionString:
        process.env.DATABASE_URL ??
        "postgres://waypoint:waypoint@localhost:5432/waypoint",
      max: Number(process.env.DB_POOL_MAX ?? 10),
    });
  }
  return globalForPool.__waypointPool;
}

export type Db = pg.Pool | pg.PoolClient;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Db = pool(),
): Promise<T[]> {
  const res = await db.query<T>(text, params);
  return res.rows;
}

export async function one<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Db = pool(),
): Promise<T | undefined> {
  const rows = await query<T>(text, params, db);
  return rows[0];
}

export async function tx<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
