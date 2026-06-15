import { db } from "../DB/connect.js";
import { logger } from "../utils/logger.js";

export const verifyOrderDetail = async (req, res, next, id) => {
  try {
    const orderDetail = await db.query(
      "SELECT * FROM order_details WHERE od_id = $1",
      [id]
    );
    if (orderDetail.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No details found", error: true, OrderDetails: null });
    }
    req.orderdetails = orderDetail.rows[0];
    next();
  } catch (error) {
    logger.error({ err: error }, "verifyOrderDetail failed");
    return res
      .status(500)
      .json({ message: "Internal server Error", error: true, Orders: null });
  }
};
