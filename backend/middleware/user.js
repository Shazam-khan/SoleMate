import { db } from "../DB/connect.js";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Validate that a :userId path param refers to a real user, and stash the row.
export const ValidateUserId = async (req, res, next, id) => {
  try {
    const user = await db.query('SELECT * FROM "Users" WHERE u_id = $1', [id]);

    if (user.rows.length === 0) {
      return res.status(404).json({ message: "User not found", error: true });
    }
    req.targetUser = user.rows[0];
    next();
  } catch (error) {
    logger.error({ err: error }, "ValidateUserId failed");
    res.status(500).json({ message: "Internal Server Error", error: true });
  }
};

// Allow only authenticated admins. Relies on the token carrying a real boolean
// `isAdmin` (see authController) — a string like 'N' must NOT be treated as true.
export const verifyAdmin = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res
      .status(403)
      .json({ message: "Access denied, no token provided.", error: true });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;

    if (decoded.isAdmin !== true) {
      return res
        .status(403)
        .json({ message: "Access denied, you are not an admin.", error: true });
    }

    next();
  } catch (error) {
    logger.warn({ err: error.message }, "Admin token verification failed");
    return res.status(401).json({ message: "Invalid token.", error: true });
  }
};
