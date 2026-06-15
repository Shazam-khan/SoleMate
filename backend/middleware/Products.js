import { db } from "../DB/connect.js";
import { logger } from "../utils/logger.js";

export const checkProductId = async (req, res, next, id) => {
  try {
    const product = await db.query("SELECT * FROM Product WHERE p_id = $1", [
      id,
    ]);

    if (product.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Product not found", error: true });
    }
    req.product = product.rows[0];
    next();
  } catch (error) {
    logger.error({ err: error });
    res.status(500).json({ message: "Internal Server Error", error: true });
  }
};

export const CheckImageId = async (req, res, next, id) => {
  try {
    const image = await db.query(`SELECT * FROM "P_Images" WHERE id = $1`, [
      id,
    ]);

    if (image.rows.length === 0) {
      return res.status(404).json({ message: "Image not found", error: true });
    }
    req.image = image.rows[0];
    next();
  } catch (error) {
    logger.error({ err: error });
    res.status(500).json({ message: "Internal Server Error", error: true });
  }
};

export const checkSizeId = async (req, res, next, id) => {
  try {
    const size = await db.query(`SELECT * FROM "P_Size" WHERE id = $1`, [id]);
    if (size.rows.length === 0) {
      return res.status(404).json({ message: "Record not found", error: true });
    }
    req.size = size.rows[0];
    next();
  } catch (error) {
    logger.error({ err: error });
    res.status(500).json({ message: "Internal Server Error", error: true });
  }
};
