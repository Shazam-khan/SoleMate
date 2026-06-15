import { db } from "../DB/connect.js";
import { v4 as uuid } from "uuid";
import { generateTokenSetCookie } from "../utils/generateCookie.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { logger } from "../utils/logger.js";
import {
  validateEmail,
  validatePassword,
  validatePhoneNumber,
} from "../utils/validation.js";

/** Remove the password hash before sending a user object to the client. */
const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
};

export const userLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and Password are required" });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  try {
    const result = await db.query('SELECT * FROM "Users" WHERE email = $1', [
      email,
    ]);

    // Same response whether the email or the password is wrong — don't leak
    // which accounts exist.
    const user = result.rows[0];
    const passwordOk = user ? await verifyPassword(password, user.password) : false;

    if (!user || !passwordOk) {
      return res.status(401).json({
        message: "Invalid email or password",
        User: null,
        error: true,
      });
    }

    generateTokenSetCookie(res, user.u_id, user.is_admin === "Y");
    return res.status(200).json({
      message: "User logged in successfully",
      User: sanitizeUser(user),
      error: false,
    });
  } catch (error) {
    logger.error({ err: error }, "userLogin failed");
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: true });
  }
};

export const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and Password are required" });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  try {
    const result = await db.query('SELECT * FROM "Users" WHERE email = $1', [
      email,
    ]);

    const user = result.rows[0];
    const passwordOk = user ? await verifyPassword(password, user.password) : false;

    if (!user || !passwordOk) {
      return res.status(401).json({
        message: "Invalid email or password",
        User: null,
        error: true,
      });
    }

    if (user.is_admin !== "Y") {
      return res.status(403).json({
        message: "Access denied. Admins only.",
        User: null,
        error: true,
      });
    }

    generateTokenSetCookie(res, user.u_id, true);
    return res.status(200).json({
      message: "Admin logged in successfully",
      User: sanitizeUser(user),
      error: false,
    });
  } catch (error) {
    logger.error({ err: error }, "adminLogin failed");
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: true });
  }
};

export const userSignUp = async (req, res) => {
  const { fname, lname, email, password, phoneNumber } = req.body;

  try {
    if (!email || !fname || !lname || !password || !phoneNumber) {
      return res.status(400).json({
        message: "Please fill in all fields",
        User: null,
        error: true,
      });
    }
    if (!validateEmail(email)) {
      return res
        .status(400)
        .json({ message: "Invalid email format", User: null, error: true });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long.",
        User: null,
        error: true,
      });
    }
    if (!validatePhoneNumber(phoneNumber)) {
      return res.status(400).json({
        message: "Phone number must be exactly 11 digits",
        User: null,
        error: true,
      });
    }

    const existingUser = await db.query(
      'SELECT 1 FROM "Users" WHERE email = $1',
      [email]
    );
    if (existingUser.rows.length > 0) {
      return res
        .status(409)
        .json({ message: "Email already in use", User: null, error: true });
    }

    const userId = uuid();
    const hashed = await hashPassword(password);

    const user = await db.query(
      'INSERT INTO "Users" (u_id, is_admin, first_name, last_name, email, password, phone_number) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [userId, "N", fname, lname, email, hashed, phoneNumber]
    );

    generateTokenSetCookie(res, userId, false);

    return res.status(201).json({
      message: "Signup successful, User added to Database",
      User: sanitizeUser(user.rows[0]),
      error: false,
    });
  } catch (error) {
    logger.error({ err: error }, "userSignUp failed");
    return res
      .status(500)
      .json({ message: "Internal Server Error", User: null, error: true });
  }
};

// Returns the currently-authenticated user, derived from the JWT cookie.
// Used by the frontend on app load to restore the session.
export const getMe = async (req, res) => {
  try {
    const { userId } = req.user;
    const result = await db.query(
      'SELECT u_id, email, is_admin FROM "Users" WHERE u_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found", error: true });
    }

    const user = result.rows[0];
    return res.status(200).json({
      userId: user.u_id,
      email: user.email,
      isAdmin: user.is_admin === "Y",
    });
  } catch (error) {
    logger.error({ err: error }, "getMe failed");
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: true });
  }
};

export const userLogout = async (req, res) => {
  res.clearCookie("token", { path: "/" });
  return res
    .status(200)
    .json({ message: "Logged out successfully", User: null, error: false });
};
