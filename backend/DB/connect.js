import pg from "pg";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * PostgreSQL connection pool.
 *
 * A pool (not a single Client) is required so concurrent requests don't block
 * on one shared connection, and so dropped connections are transparently
 * replaced. Works against local Postgres in dev and Amazon RDS in production.
 */
const poolConfig = config.db.connectionString
  ? { connectionString: config.db.connectionString }
  : {
      user: config.db.user,
      host: config.db.host,
      database: config.db.database,
      password: config.db.password,
      port: config.db.port,
    };

if (config.db.ssl) {
  // RDS uses TLS; rejectUnauthorized:false keeps the managed cert simple.
  poolConfig.ssl = { rejectUnauthorized: false };
}

export const db = new pg.Pool(poolConfig);

db.on("error", (err) => {
  logger.error({ err }, "Unexpected error on idle database client");
});

/** Verify connectivity at startup; throws if the DB is unreachable. */
export const verifyConnection = async () => {
  const client = await db.connect();
  try {
    await client.query("SELECT 1");
    logger.info("Connected to SOLEMATE database");
  } finally {
    client.release();
  }
};

/** Close the pool cleanly on shutdown. */
export const closeDb = () => db.end();
