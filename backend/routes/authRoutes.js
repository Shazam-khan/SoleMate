import express from "express";
import rateLimit from "express-rate-limit";
import {
  adminLogin,
  userLogin,
  userLogout,
  userSignUp,
  getMe,
} from "../controller/authController.js";
import { authenticateUser } from "../middleware/authenticateUser.js";

const authRouter = express.Router();

// Throttle credential-guessing: 10 attempts per IP per 15 minutes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later.", error: true },
});

authRouter.post("/signup", authLimiter, userSignUp);
authRouter.post("/login", authLimiter, userLogin);
authRouter.post("/admin/login", authLimiter, adminLogin);
authRouter.post("/logout", userLogout);
authRouter.get("/me", authenticateUser, getMe);

export default authRouter;
