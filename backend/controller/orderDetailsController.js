import { db } from "../DB/connect.js";
import { v4 as uuid } from "uuid";
import { logger } from "../utils/logger.js";
export const getAllOrderDetails = async (req, res) => {
  try {
    const { userId } = req.params; // Extract authenticated user's ID from the token
    const orderDetails = await db.query(
      `SELECT * FROM order_details WHERE user_id = $1`,
      [userId]
    );

    if (orderDetails.rows.length === 0) {
      return res.status(404).json({
        message: "No records found for the current user",
        error: false,
        OrderDetails: null,
      });
    }

    return res.status(200).json({
      message: "Order details retrieved successfully",
      error: false,
      OrderDetails: orderDetails.rows,
    });
  } catch (error) {
    logger.error("Error retrieving order details:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: true,
      OrderDetails: null,
    });
  }
};

export const getAllOrderDetailsByoId = async (req, res) => {
  try {
    const { orderId } = req.params; // Extract authenticated user's ID from the token
    const orderDetails = await db.query(
      `SELECT * FROM order_details WHERE order_o_id = $1`,
      [orderId]
    );

    if (orderDetails.rows.length === 0) {
      return res.status(404).json({
        message: "No records found for the current order",
        error: false,
        OrderDetails: null,
      });
    }

    return res.status(200).json({
      message: "Order details retrieved successfully",
      error: false,
      OrderDetails: orderDetails.rows,
    });
  } catch (error) {
    logger.error("Error retrieving order details:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: true,
      OrderDetails: null,
    });
  }
};

export const getOrderDetailById = async (req, res) => {
  const { userId } = req.params; // Extract authenticated user's ID from the token
  const { id } = req.params; // Extract order detail ID from the route

  try {
    const result = await db.query(
      `SELECT * FROM order_details WHERE od_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Order detail not found or access denied",
        error: true,
        OrderDetails: null,
      });
    }

    return res.status(200).json({
      message: "Order detail retrieved successfully",
      error: false,
      OrderDetails: result.rows[0],
    });
  } catch (error) {
    logger.error("Error retrieving order detail:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: true,
      OrderDetails: null,
    });
  }
};

export const createOrderDetail = async (req, res) => {
  const { orderId } = req.params; // Extract order ID from route params
  const { quantity, p_id, size, userId } = req.body;

  try {
    // Validate product existence and stock
    await db.query("BEGIN");
    const productResult = await db.query(
      `SELECT price FROM Product WHERE p_id = $1`,
      [p_id]
    );
    if (productResult.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Product not found", error: true });
    }

    const sizeStockResult = await db.query(
      `SELECT stock FROM "P_Size" WHERE product_id = $1 AND size = $2`,
      [p_id, size]
    );
    if (sizeStockResult.rows.length === 0) {
      return res.status(400).json({
        message: "Invalid size or stock not available",
        error: true,
      });
    }

    const odPrice = productResult.rows[0].price;
    const stock = sizeStockResult.rows[0].stock;

    if (quantity > stock) {
      return res.status(400).json({ message: "Not enough stock", error: true });
    }

    // Create order detail
    const odId = uuid();
    const orderDetailResult = await db.query(
      `INSERT INTO order_details (od_id, quantity, od_price, product_p_id, order_o_id, size,user_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [odId, quantity, odPrice, p_id, orderId, size, userId]
    );

    // Update order total
    await db.query(
      `UPDATE "Order" 
       SET total_amount = (SELECT SUM(quantity * od_price) 
                           FROM order_details 
                           WHERE order_o_id = $1) 
       WHERE o_id = $1`,
      [orderId]
    );

    // Update stock
    await db.query(
      `UPDATE "P_Size" SET stock = stock - $1 WHERE product_id = $2 AND size = $3`,
      [quantity, p_id, size]
    );

    await db.query("COMMIT");

    return res.status(201).json({
      message: "Order detail added successfully",
      error: false,
      OrderDetail: orderDetailResult.rows[0],
    });
  } catch (error) {
    await db.query("ROLLBACK");
    logger.error(error);
    return res.status(500).json({
      message: "Error adding order detail",
      error: true,
    });
  }
};

export const patchDetail = async (req, res) => {
  const { od_id } = req.params;
  const { quantity, odPrice } = req.body;

  try {
    // Build dynamic query based on provided fields
    const fields = [];
    const values = [];
    let index = 1;

    if (quantity !== undefined) {
      fields.push(`quantity = $${index++}`);
      values.push(quantity);
    }
    if (odPrice !== undefined) {
      fields.push(`od_price = $${index++}`);
      values.push(odPrice);
    }

    if (fields.length === 0) {
      return res
        .status(400)
        .json({ message: "No fields to update", error: true });
    }

    values.push(od_id); // Add the id as the last parameter for the WHERE clause
    const query = `UPDATE order_details SET ${fields.join(
      ", "
    )} WHERE od_id = $${index} RETURNING *`;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Order detail not found",
        error: true,
        OrderDetails: null,
      });
    }

    const updatedOrderDetail = result.rows[0];

    // Update the total amount in the corresponding order
    await db.query(
      `UPDATE "Order" 
       SET total_amount = (SELECT SUM(quantity * od_price) 
                           FROM order_details 
                           WHERE order_o_id = $1) 
       WHERE o_id = $1`,
      [updatedOrderDetail.order_o_id]
    );

    return res.status(200).json({
      message: "Order detail updated and order total recalculated",
      error: false,
      OrderDetails: updatedOrderDetail,
    });
  } catch (error) {
    logger.debug(error);
    return res.status(500).json({
      message: "Error updating order detail",
      error: true,
      OrderDetails: null,
    });
  }
};

export const deleteDetail = async (req, res) => {
  const { od_id } = req.params;

  try {
    // Retrieve the order ID before deleting the detail
    const orderDetailResult = await db.query(
      "SELECT order_o_id FROM order_details WHERE od_id = $1",
      [od_id]
    );

    if (orderDetailResult.rows.length === 0) {
      return res.status(404).json({
        message: "Order detail not found",
        error: true,
        OrderDetails: null,
      });
    }

    const orderId = orderDetailResult.rows[0].order_o_id;

    // Delete the order detail
    const result = await db.query(
      "DELETE FROM order_details WHERE od_id = $1 RETURNING *",
      [od_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Order detail not found",
        error: true,
        OrderDetails: null,
      });
    }

    // Update the total amount in the corresponding order
    await db.query(
      `UPDATE "Order" 
       SET total_amount = COALESCE(
         (SELECT SUM(quantity * od_price) 
          FROM order_details 
          WHERE order_o_id = $1), 0) 
       WHERE o_id = $1`,
      [orderId]
    );

    return res.status(200).json({
      message: "Order detail deleted and order total recalculated",
      error: false,
      OrderDetails: null,
    });
  } catch (error) {
    logger.debug(error);
    return res.status(500).json({
      message: "Error deleting order detail",
      error: true,
      OrderDetails: null,
    });
  }
};
