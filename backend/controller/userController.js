import { db } from "../DB/connect.js";
import { hashPassword } from "../utils/password.js";
import { logger } from "../utils/logger.js";

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await db.query('SELECT * FROM "Users"');
    if (users.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No users found", Users: null, error: true });
    }

    return res.json({
      message: "Users Found",
      Users: users.rows.map(sanitizeUser),
      error: false,
    });
  } catch (error) {
    logger.error({ err: error }, "getAllUsers failed");
    return res
      .status(500)
      .json({ message: "Error fetching users", Users: null, error: true });
  }
};

export const getUserById = async (req, res) => {
  res.status(200).json({
    message: "User found",
    User: sanitizeUser(req.targetUser),
    error: false,
  });
};

export const updateInfo = async (req, res) => {
  const { fname, lname, email, password, phoneNumber } = req.body;
  const { userId } = req.params;

  // req.targetUser is populated by the ValidateUserId param middleware.
  const existing = req.targetUser;
  if (!existing) {
    return res.status(404).json({ message: "User not found", error: true });
  }

  try {
    const updatedFname = fname || existing.first_name;
    const updatedLname = lname || existing.last_name;
    const updatedEmail = email || existing.email;
    // Only hash + change the password if a new one was supplied.
    const updatedPassword = password
      ? await hashPassword(password)
      : existing.password;
    const updatedPhoneNumber = phoneNumber || existing.phone_number;

    const updateQuery = `
      UPDATE "Users"
      SET
        first_name = $1,
        last_name = $2,
        email = $3,
        password = $4,
        phone_number = $5
      WHERE u_id = $6
      RETURNING *;
    `;

    const updatedUser = await db.query(updateQuery, [
      updatedFname,
      updatedLname,
      updatedEmail,
      updatedPassword,
      updatedPhoneNumber,
      userId,
    ]);

    return res.status(200).json({
      message: "User information updated successfully",
      User: sanitizeUser(updatedUser.rows[0]),
      error: false,
    });
  } catch (error) {
    logger.error({ err: error }, "updateInfo failed");
    return res
      .status(500)
      .json({ message: "Error updating user", error: true });
  }
};

export const deleteUser = async (req, res) => {
  const { userId } = req.params;
  try {
    await db.query('DELETE FROM "Users" WHERE u_id = $1', [userId]);
    return res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, "deleteUser failed");
    return res
      .status(500)
      .json({ message: "Error deleting user", error: true });
  }
};
