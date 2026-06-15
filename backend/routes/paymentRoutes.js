import express from "express";
import {
  createPayment,
  updatePaymentStatus,
  getAllPayments,
  getPaymentById,
} from "../controller/paymentController.js";
import { authenticateUser } from "../middleware/authenticateUser.js";

const paymentRouter = express.Router();

// Create a new payment for an order
paymentRouter.post("/order/:orderId/payments", authenticateUser, createPayment);

// Update payment status
paymentRouter.put(
  "/order/:orderId/payments/:paymentId",
  authenticateUser,
  updatePaymentStatus
);

// Get all payments for all orders
paymentRouter.get("/order/:orderId/payments", authenticateUser, getAllPayments);

// Get a specific payment
paymentRouter.get(
  "/order/:orderId/payments/:paymentId",
  authenticateUser,
  getPaymentById
);

export default paymentRouter;
