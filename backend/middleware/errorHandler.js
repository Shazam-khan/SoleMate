import { logger } from "../utils/logger.js";
import { config } from "../config/env.js";

/**
 * Wrap an async route handler so any rejected promise is forwarded to Express's
 * error pipeline instead of becoming an unhandled rejection. Lets controllers
 * drop their repetitive try/catch blocks.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** 404 handler for unmatched routes. */
export const notFound = (req, res) => {
  res.status(404).json({ message: "Route not found", error: true });
};

/**
 * Centralized error handler. Logs the full error server-side but only leaks a
 * generic message to the client in production.
 */
export const errorHandler = (err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  logger.error({ err, path: req.path, method: req.method }, "Request failed");

  res.status(status).json({
    message:
      status >= 500 && config.isProduction
        ? "Internal Server Error"
        : err.message || "Internal Server Error",
    error: true,
  });
};
