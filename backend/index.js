import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";

import { config } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { db, verifyConnection, closeDb } from "./DB/connect.js";

import productRouter from "./routes/productRoutes.js";
import userRouter from "./routes/userRoutes.js";
import authRouter from "./routes/authRoutes.js";
import { stripeRouter, stripeWebhookRouter } from "./routes/stripeRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

// --- Security & infrastructure middleware ---------------------------------
app.use(helmet());
app.use(
  cors({
    origin: config.clientOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(pinoHttp({ logger }));

// Stripe webhook needs the RAW body for signature verification, so it MUST be
// registered before the JSON body parser below.
app.use("/api", stripeWebhookRouter);

app.use(express.json());
app.use(cookieParser());

// --- Health checks (used by ALB / ECS / Kubernetes probes) ----------------
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
app.get("/ready", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.status(200).json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not-ready" });
  }
});

// --- Application routes ----------------------------------------------------
app.use("/api/products", productRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api", stripeRouter);

// --- Error handling --------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

// --- Server lifecycle ------------------------------------------------------
const server = app.listen(config.port, async () => {
  try {
    await verifyConnection();
  } catch (err) {
    logger.error({ err }, "Database connection failed at startup");
  }
  logger.info(`Server is running on port ${config.port}`);
});

// Graceful shutdown: containers send SIGTERM; close the HTTP server and pool
// so in-flight requests finish and connections aren't leaked.
const shutdown = (signal) => {
  logger.info({ signal }, "Shutting down");
  server.close(async () => {
    try {
      await closeDb();
      logger.info("Database pool closed");
    } catch (err) {
      logger.error({ err }, "Error closing database pool");
    }
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app };
