import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

/**
 * Sign a JWT for the user and set it as an httpOnly cookie.
 * The signing secret comes from validated config (env), never a hardcoded value.
 */
export const generateTokenSetCookie = (res, userId, isAdmin) => {
  const token = jwt.sign({ userId, isAdmin }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  res.cookie("token", token, {
    httpOnly: true, // not readable by JS — mitigates XSS token theft
    secure: config.isProduction, // HTTPS-only in production
    sameSite: "lax", // mitigates CSRF
    maxAge: 2 * 60 * 60 * 1000, // 2h, matches token lifetime
  });

  return token;
};
