import Stripe from "stripe";
import pg from "pg";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

/**
 * Stripe webhook handler (Lambda Function URL).
 *
 * Verifies the Stripe signature against the raw body, then marks the order
 * complete and its payment COMPLETED. Runs inside the VPC so it can reach RDS.
 */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sm = new SecretsManagerClient({});
let pool;

const getPool = async () => {
  if (pool) return pool;
  const secret = await sm.send(
    new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN })
  );
  const { username, password } = JSON.parse(secret.SecretString);
  pool = new pg.Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: username,
    password,
    port: 5432,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
};

export const handler = async (event) => {
  const sig = event.headers["stripe-signature"];
  const body = event.isBase64Encoded
    ? Buffer.from(event.body, "base64")
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const { orderId } = stripeEvent.data.object.metadata || {};
    const db = await getPool();
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE "Order" SET is_complete = TRUE WHERE o_id = $1`, [orderId]);
      await client.query(`UPDATE payment SET status = 'COMPLETED' WHERE order_o_id = $1`, [orderId]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("DB update failed", err);
      return { statusCode: 500, body: "DB error" };
    } finally {
      client.release();
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
