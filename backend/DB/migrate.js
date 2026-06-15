import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { db, closeDb } from "./connect.js";
import { logger } from "../utils/logger.js";

/**
 * Apply the schema to the configured database.
 * Usage: npm run db:migrate
 */
const __dirname = dirname(fileURLToPath(import.meta.url));

const run = async () => {
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  await db.query(sql);
  logger.info("Schema applied successfully");
};

run()
  .catch((err) => {
    logger.error({ err }, "Migration failed");
    process.exitCode = 1;
  })
  .finally(() => closeDb());
