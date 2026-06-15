import { db } from "../DB/connect.js";
import { v4 as uuid } from "uuid";
import { logger } from "../utils/logger.js";

// Get all orders (with optional user filter)
export const getAllOrders = async (req, res) => {
  const { userId } = req.params;

  try {
    const query = userId
      ? `SELECT * FROM "Order" WHERE user_u_id = $1`
      : `SELECT * FROM "Order"`;
    const values = userId ? [userId] : [];

    const orders = await db.query(query, values);

    if (orders.rows.length === 0) {
      return res.status(404).json({
        message: "No orders found",
        error: false,
        Orders: [],
      });
    }

    return res.status(200).json({
      message: "Orders found",
      error: false,
      Orders: orders.rows,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      message: "Error fetching orders",
      error: true,
      Orders: [],
    });
  }
};

// Get a single order by ID
export const getOrderById = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await db.query(`SELECT * FROM "Order" WHERE o_id = $1`, [
      orderId,
    ]);

    if (order.rows.length === 0) {
      return res.status(404).json({
        message: "Order not found",
        error: false,
        Orders: null,
      });
    }

    return res.status(200).json({
      message: "Order found",
      error: false,
      Orders: order.rows[0],
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      message: "Error fetching order",
      error: true,
      Orders: null,
    });
  }
};

// Get current incomplete order for a user
export const getCurrentOrder = async (req, res) => {
  const { userId } = req.params;
  logger.debug("Fetching current order for user:", userId);

  try {
    const currentOrder = await db.query(
      `SELECT * FROM "Order" WHERE user_u_id = $1 AND is_complete = FALSE ORDER BY order_date DESC
      LIMIT 1`,
      [userId]
    );

    if (currentOrder.rows.length === 0) {
      return res.status(404).json({
        message: "No current incomplete order found",
        error: false,
        Orders: null,
      });
    }

    logger.debug("Current order retrieved:", currentOrder.rows[0]);

    return res.status(200).json({
      message: "Current order retrieved successfully",
      error: false,
      Orders: currentOrder.rows[0],
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      message: "Error retrieving current order",
      error: true,
      Orders: null,
    });
  }
};

// Create a new order
export const createOrder = async (req, res) => {
  const { userId } = req.user; // User ID
  const { orderDate, promisedDate, address, quantity, p_id, size } = req.body;

  if (!orderDate || !promisedDate || !address || !p_id || !size || !quantity) {
    return res.status(400).json({
      message: "Please fill in all required fields",
      error: true,
      Orders: null,
    });
  }

  try {
    const oId = uuid(); // Generate random ID for the order
    await db.query("BEGIN"); // Start transaction

    // Step 1: Create an order
    const orderResult = await db.query(
      `INSERT INTO "Order" (o_id, order_date, promised_date, address, total_amount, user_u_id, is_complete) 
       VALUES ($1, $2, $3, $4, 0, $5, false) RETURNING *`,
      [oId, orderDate, promisedDate, address, userId]
    );

    // Step 2: Validate product availability and size stock
    const productResult = await db.query(
      `SELECT price FROM Product WHERE p_id = $1`,
      [p_id]
    );

    if (productResult.rows.length === 0) {
      throw new Error("Invalid product ID");
    }

    const sizeStockResult = await db.query(
      `SELECT stock FROM "P_Size" WHERE product_id = $1 AND size = $2`,
      [p_id, size]
    );

    if (sizeStockResult.rows.length === 0) {
      throw new Error("Invalid size or no stock information available");
    }

    const odPrice = productResult.rows[0].price;
    const stock = sizeStockResult.rows[0].stock;

    if (quantity > stock) {
      return res.status(400).json({
        message: "Not enough stock available",
        error: true,
        Orders: null,
        OrderDetails: null,
      });
    }

    // Step 3: Create order details
    const odId = uuid();
    await db.query(
      `INSERT INTO order_details (od_id, quantity, od_price, product_p_id, order_o_id, size, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [odId, quantity, odPrice, p_id, oId, size, userId]
    );

    // Step 4: Update the total amount in the order
    await db.query(
      `UPDATE "Order" 
       SET total_amount = (SELECT SUM(quantity * od_price) FROM order_details WHERE order_o_id = $1) 
       WHERE o_id = $1`,
      [oId]
    );

    // Step 5: Update stock for the product size
    await db.query(
      `UPDATE "P_Size" SET stock = stock - $1 WHERE product_id = $2 AND size = $3`,
      [quantity, p_id, size]
    );

    await db.query("COMMIT");

    return res.status(201).json({
      message: "Order created successfully",
      error: false,
      Orders: orderResult.rows[0],
    });
  } catch (error) {
    await db.query("ROLLBACK");
    logger.error(error);
    return res.status(500).json({
      message: "Error creating order",
      error: true,
      Orders: null,
    });
  }
};

// Update an existing order
export const patchOrder = async (req, res) => {
  const { orderId } = req.params;
  const { address } = req.body; // Only destructuring `address`

  try {
    if (!address) {
      return res.status(400).json({
        message: "Address is required",
        error: true,
      });
    }

    const query = `UPDATE "Order" 
                   SET address = $1 
                   WHERE o_id = $2 
                   RETURNING *`;

    const values = [address, orderId];
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Order not found",
        error: true,
        Orders: null,
      });
    }

    return res.status(200).json({
      message: "Address updated successfully",
      error: false,
      Orders: result.rows[0],
    });
  } catch (error) {
    logger.error("Error updating order:", error);
    return res.status(500).json({
      message: "Error updating order",
      error: true,
      Orders: null,
    });
  }
};

// Delete an order
export const deleteOrder = async (req, res) => {
  const { orderId } = req.params;

  try {
    await db.query("BEGIN");
    const delOd = await db.query(
      `DELETE FROM "order_details" WHERE order_o_id = $1 RETURNING *`,
      [orderId]
    );

    if (delOd.rows === 0) {
      return res.status(404).json({
        message: "Order details not found",
        error: true,
      });
    }
    const result = await db.query(
      `DELETE FROM "Order" WHERE o_id = $1 RETURNING *`,
      [orderId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Order not found",
        error: true,
      });
    }

    await db.query("COMMIT");

    return res.status(200).json({
      message: "Order deleted successfully",
      error: false,
    });
  } catch (error) {
    await db.query("ROLLBACK");
    logger.error(error);
    return res.status(500).json({
      message: "Error deleting order",
      error: true,
    });
  }
};
