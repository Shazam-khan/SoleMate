import express from "express";
import Stripe from "stripe";
import { db } from "../DB/connect.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { asyncHandler } from "../middleware/errorHandler.js";

// Created lazily so the API boots even when Stripe isn't configured.
let stripeClient = null;
const getStripe = () => {
  if (!stripeClient) {
    if (!config.stripe.secretKey) {
      throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
    }
    stripeClient = new Stripe(config.stripe.secretKey);
  }
  return stripeClient;
};

// ---------------------------------------------------------------------------
// Checkout router — JSON body. Mounted under the normal /api pipeline.
// ---------------------------------------------------------------------------
export const stripeRouter = express.Router();

stripeRouter.post(
  "/create-checkout-session",
  asyncHandler(async (req, res) => {
    const { orderId, userId, amount, currency } = req.body;
    const clientUrl = config.clientOrigins[0];

    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency || "usd",
            product_data: {
              name: `Order #${orderId}`,
              description: `Payment for order ${orderId}`,
            },
            unit_amount: amount, // cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${clientUrl}/users/${userId}/order/${orderId}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/users/${userId}/order/${orderId}/payment`,
      metadata: { orderId, userId },
    });

    res.json({ sessionId: session.id });
  })
);

// ---------------------------------------------------------------------------
// Webhook router — RAW body (required for signature verification). Mounted
// BEFORE the global JSON parser in index.js so the raw bytes survive.
// ---------------------------------------------------------------------------
export const stripeWebhookRouter = express.Router();

stripeWebhookRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = getStripe().webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret
      );
    } catch (err) {
      logger.warn({ err: err.message }, "Stripe webhook signature failed");
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { orderId } = session.metadata || {};

      try {
        await db.query("BEGIN");
        await db.query(
          `UPDATE "Order" SET is_complete = TRUE WHERE o_id = $1`,
          [orderId]
        );
        await db.query(
          `UPDATE payment SET status = 'COMPLETED' WHERE order_o_id = $1`,
          [orderId]
        );
        await db.query("COMMIT");
        logger.info({ orderId }, "Order marked complete via Stripe webhook");
      } catch (err) {
        await db.query("ROLLBACK");
        logger.error({ err, orderId }, "Failed to update order from webhook");
      }
    }

    res.json({ received: true });
  }
);
