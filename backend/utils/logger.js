import pino from "pino";
import { config } from "../config/env.js";

/**
 * Structured application logger.
 *
 * - JSON output in production (easy to ship to CloudWatch / any log aggregator).
 * - Pretty, colorized output in development.
 * - `redact` strips secrets so tokens, passwords and auth headers never reach
 *   the logs — this replaces the scattered `console.log(token)` calls.
 */
export const logger = pino({
  level: config.logLevel,
  // Tests mock the global Date object; disabling timestamps keeps the logger
  // from touching Date during those runs.
  timestamp: !config.isTest,
  redact: {
    paths: [
      "password",
      "*.password",
      "req.headers.authorization",
      "req.headers.cookie",
      "token",
      "*.token",
    ],
    censor: "[redacted]",
  },
  // Pretty output only in local dev. JSON in prod (for CloudWatch) and in test
  // (avoids pino-pretty worker threads under Jest).
  transport:
    config.isProduction || config.isTest
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
});
