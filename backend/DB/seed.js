import { v4 as uuid } from "uuid";
import { db, closeDb } from "./connect.js";
import { hashPassword } from "../utils/password.js";
import { logger } from "../utils/logger.js";

/**
 * Seed the database with an admin user and a couple of sample products so the
 * app is usable immediately after a fresh migrate. Idempotent-ish: it upserts
 * the admin by email and skips products if any already exist.
 *
 * Usage: npm run db:seed
 */
const ADMIN_EMAIL = "admin@solemate.test";
const ADMIN_PASSWORD = "Admin12345"; // change after first login

const run = async () => {
  // --- Admin user ----------------------------------------------------------
  const hashed = await hashPassword(ADMIN_PASSWORD);
  await db.query(
    `INSERT INTO "Users" (u_id, is_admin, first_name, last_name, email, password, phone_number)
     VALUES ($1, 'Y', 'Site', 'Admin', $2, $3, '03000000000')
     ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, is_admin = 'Y'`,
    [uuid(), ADMIN_EMAIL, hashed]
  );
  logger.info({ email: ADMIN_EMAIL }, "Seeded admin user");

  // --- Sample products -----------------------------------------------------
  const existing = await db.query("SELECT COUNT(*)::int AS n FROM product");
  if (existing.rows[0].n === 0) {
    const products = [
      ["Cloud Runner", "SoleMate", 89.99],
      ["Street Classic", "SoleMate", 74.5],
      ["Trail Blazer", "SoleMate", 119.0],
    ];

    for (const [name, brand, price] of products) {
      const pId = uuid();
      await db.query(
        "INSERT INTO product (p_id, p_name, brand, price) VALUES ($1, $2, $3, $4)",
        [pId, name, brand, price]
      );
      for (const size of ["7", "8", "9", "10"]) {
        await db.query(
          `INSERT INTO "P_Size" (id, size, stock, product_id) VALUES ($1, $2, $3, $4)`,
          [uuid(), size, 25, pId]
        );
      }
    }
    logger.info({ count: products.length }, "Seeded sample products");
  } else {
    logger.info("Products already present, skipping product seed");
  }
};

run()
  .catch((err) => {
    logger.error({ err }, "Seed failed");
    process.exitCode = 1;
  })
  .finally(() => closeDb());
