import dotenv from "dotenv";

dotenv.config();

/**
 * Centralized, validated configuration.
 *
 * Every environment-dependent value the app needs is read and checked here,
 * exactly once, at startup. If something required is missing we fail fast with
 * a clear message instead of crashing deep inside a request handler later.
 */

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";
const isTest = NODE_ENV === "test";

/** Read a required variable, or throw (skipped in test where everything is mocked). */
const required = (key) => {
  const value = process.env[key];
  if (!value && !isTest) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Copy .env.example to .env and fill it in.`
    );
  }
  return value;
};

const optional = (key, fallback) => process.env[key] ?? fallback;

export const config = {
  env: NODE_ENV,
  isProduction,
  isTest,
  port: parseInt(optional("PORT", "5000"), 10),

  // Comma-separated list of allowed browser origins for CORS.
  clientOrigins: optional("CLIENT_URL", "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  db: {
    // Prefer a single DATABASE_URL (what RDS / most hosts give you); fall back
    // to the discrete DB_* variables the project originally used.
    connectionString: optional("DATABASE_URL"),
    user: optional("DB_USER"),
    host: optional("DB_HOST"),
    database: optional("DB_NAME"),
    password: optional("DB_PASSWORD"),
    port: parseInt(optional("DB_PORT", "5432"), 10),
    // RDS requires TLS; local Postgres does not.
    ssl: optional("DB_SSL", isProduction ? "true" : "false") === "true",
  },

  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: optional("JWT_EXPIRES_IN", "2h"),
  },

  stripe: {
    secretKey: optional("STRIPE_SECRET_KEY"),
    webhookSecret: optional("STRIPE_WEBHOOK_SECRET"),
  },

  // Object storage for product images (Supabase today; S3 in the AWS design).
  storage: {
    supabaseUrl: optional("SUPABASE_URL"),
    supabaseKey: optional("API_KEY"),
    bucket: optional("STORAGE_BUCKET", "solemate"),
    // S3 bucket for product images (AWS deployment).
    imagesBucket: optional("IMAGES_BUCKET"),
    region: optional("AWS_REGION", "us-east-1"),
  },

  logLevel: optional("LOG_LEVEL", isProduction ? "info" : "debug"),
};
