import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Verify the JWT from the request cookie and attach the decoded payload
 * ({ userId, isAdmin }) to req.user.
 */
export const authenticateUser = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch (error) {
    logger.warn({ err: error.message }, "Token verification failed");
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
