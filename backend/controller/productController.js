import { db } from "../DB/connect.js";
import { v4 as uuid } from "uuid";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Created lazily so the API can boot even when object storage isn't configured.
// Image upload endpoints will surface a clear error if it's missing.
let supabaseClient = null;
const getSupabase = () => {
  if (!supabaseClient) {
    if (!config.storage.supabaseUrl || !config.storage.supabaseKey) {
      throw new Error("Object storage (SUPABASE_URL / API_KEY) is not configured");
    }
    supabaseClient = createClient(
      config.storage.supabaseUrl,
      config.storage.supabaseKey
    );
  }
  return supabaseClient;
};

//get all products
export const getAllProducts = async (req, res) => {
  try {
    const products = await db.query("SELECT * FROM Product");
    if (products.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No products found", Products: null, error: true });
    }
    res
      .status(200)
      .json({ message: null, Products: products.rows, error: false });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", Products: null, error: true });
  }
};

//get Product by ID
export const getProductById = async (req, res) => {
  res
    .status(200)
    .json({ message: "Product Found", Product: req.product, error: false });
};

//create a product
export const createProduct = async (req, res) => {
  try {
    const { pName, brand, price } = req.body;
    if (!pName || !brand || !price) {
      return res
        .status(400)
        .json({ message: "Please fill in all fields", id: null, error: true });
    }

    const pId = uuid(); //generate random ID
    const product = await db.query(
      "INSERT INTO Product (p_id,p_name,brand,price) VALUES ($1,$2,$3,$4) RETURNING *",
      [pId, pName, brand, price]
    );
    res.status(201).json({
      message: "Product created successfully",
      id: product.rows[0],
      error: false,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server error", id: null, error: true });

    logger.error({ err: error });
  }
};

export const UpdateProduct = async (req, res) => {
  try {
    const { pName, brand, price } = req.body; // No parentheses in req.body
    const { id } = req.params;

    // Check if the product exists
    const existingProduct = await db.query(
      "SELECT * FROM Product WHERE p_id = $1",
      [id]
    );

    const updatedName = pName || existingProduct.rows[0].p_name;
    const updatedBrand = brand || existingProduct.rows[0].brand;
    const updatedPrice = price || existingProduct.rows[0].price;

    // Update the product
    const updatedProduct = await db.query(
      "UPDATE Product SET p_name = $1, brand = $2, price = $3 WHERE p_id = $4 RETURNING *",
      [updatedName, updatedBrand, updatedPrice, id]
    );

    res.status(200).json({
      message: "Product updated successfully",
      Product: updatedProduct.rows[0],
      error: false,
    });
  } catch (error) {
    logger.error({ err: error });
    res
      .status(500)
      .json({ message: "Internal Server Error", Product: null, error: true });
  }
};

export const DeleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    // Begin transaction
    await db.query("BEGIN");

    // Delete related entries in dependent tables
    await db.query(`DELETE FROM "P_Size" WHERE product_id = $1`, [id]);
    await db.query(`DELETE FROM "P_Images" WHERE product_id = $1`, [id]);
    await db.query("DELETE FROM category WHERE product_p_id = $1", [id]);
    await db.query(`DELETE FROM "order_details" WHERE product_p_id = $1`, [id]);

    // Delete the product itself
    const result = await db.query(
      "DELETE FROM product WHERE p_id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({ message: "Product not found", error: true });
    }

    // Commit transaction
    await db.query("COMMIT");

    return res.status(200).json({
      message: "Product deleted successfully",
      Product: result.rows[0],
      error: false,
    });
  } catch (error) {
    await db.query("ROLLBACK");
    logger.error({ err: error }, "DeleteProduct failed");
    res.status(500).json({ message: "Error deleting product", error: true });
  }
};

// Category Controller
export const getProductCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const category = await db.query(
      "SELECT * FROM Category WHERE product_p_id = $1",
      [id]
    );

    if (category.rows.length === 0) {
      return res.status(404).json({
        message: "Category not found for this product",
        Category: null,
        error: true,
      });
    }

    res.status(200).json({
      message: null,
      Category: category.rows,
      error: false,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: true });
  }
};

export const createCategory = async (req, res) => {
  const { id } = req.params;
  const { userPreference, cName, description } = req.body;

  if (!userPreference || !cName || !description) {
    res.status(400).json({
      message: "Bad Request, all fields required",
      Category: null,
      error: true,
    });
  }

  try {
    const cId = uuid();
    const newCategory = await db.query(
      "INSERT INTO Category (c_id,user_preference,c_name,description,product_p_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [cId, userPreference, cName, description, id]
    );
    res.status(201).json({
      message: "Category assigned successfully",
      Category: newCategory.rows[0],
      error: false,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: true });
  }
};

export const updateCategory = async (req, res) => {
  const { cId } = req.params;
  const { userPreference, cName, description } = req.body;

  try {
    const existingCategory = await db.query(
      "SELECT * FROM Category WHERE c_id = $1",
      [cId]
    );

    if (existingCategory.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Category not found", error: true });
    }

    const updatedUserPreference =
      userPreference || existingCategory.rows[0].user_preference;
    const updatedCName = cName || existingCategory.rows[0].c_name;
    const updatedDescription =
      description || existingCategory.rows[0].description;

    const updatedCategory = await db.query(
      "UPDATE Category SET user_preference = $1, c_name = $2, description = $3 WHERE c_id = $4 RETURNING *",
      [updatedUserPreference, updatedCName, updatedDescription, cId]
    );

    res.status(200).json({
      message: "Category updated successfully",
      Category: updatedCategory.rows[0],
      error: false,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: true });
  }
};

export const deleteCategory = async (req, res) => {
  const { cId } = req.params;

  try {
    const deleteResult = await db.query(
      "DELETE FROM category WHERE c_id = $1 RETURNING *",
      [cId]
    );

    if (deleteResult.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Category not found", error: true });
    }

    res.status(200).json({
      message: "Category deleted successfully",
      Category: deleteResult.rows[0],
      error: false,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: true });
  }
};

//Images Controller
export const getAllProductImages = async (req, res) => {
  const { id } = req.params;

  try {
    const images = await db.query(
      `SELECT * FROM "P_Images" WHERE product_id = $1`,
      [id]
    );

    if (images.rows.length === 0) {
      return res.status(200).json({
        message: "No images found for the required product",
        Images: [], // Return empty array instead of null
        error: false,
      });
    }

    res
      .status(200)
      .json({ message: "Images found", Images: images.rows, error: false });
  } catch (error) {
    logger.error({ err: error });
    res
      .status(500)
      .json({ message: "Internal Server Error", Images: null, error: true });
  }
};

export const getImageById = async (req, res) => {
  res
    .status(200)
    .json({ message: "Image Found", Images: req.image, error: false });
};

export const postImage = async (req, res) => {
  const { id } = req.params;
  const { filename } = req.body;
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "Image file is required." });
    }

    if (!filename || !file) {
      return res.status(400).json({
        message: "Filename and image file are required.",
        Images: null,
        error: true,
      });
    }

    const supabase = getSupabase();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(config.storage.bucket)
      .upload(`public/${filename}`, file.buffer, {
        cacheControl: "3600",
        upsert: false, // Prevent overwriting
        contentType: file.mimetype, // Set correct MIME type
      });

    if (uploadError) {
      return res.status(500).json({
        message: `Image upload failed: ${uploadError.message}`,
        Images: null,
        error: true,
      });
    }

    logger.debug("File uploaded successfully:", uploadData);

    const { data: publicUrlData } = supabase.storage
      .from(config.storage.bucket)
      .getPublicUrl(`public/${filename}`);
    const publicUrl = publicUrlData.publicUrl;

    logger.debug("Public URL:", publicUrl);

    const iId = uuid();

    const images = await db.query(
      `INSERT INTO "P_Images" (id, image_url, product_id) VALUES ($1, $2, $3) RETURNING *`,
      [iId, publicUrl, id]
    );

    if (images.rows.length === 0) {
      return res
        .status(500)
        .json({ message: "Insert failed", Images: null, error: true });
    }

    res.status(200).json({
      message: "Image uploaded and metadata saved.",
      Images: images.rows,
      error: false,
    });
  } catch (error) {
    logger.error("Error inserting image:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", Images: null, error: true });
  }
};

export const updateImage = async (req, res) => {
  const { iId } = req.params;
  const { image_url } = req.body;

  try {
    const updatedImage = await db.query(
      `UPDATE "P_Images" SET image_url = $1 WHERE id = $2 RETURNING *`,
      [image_url, iId]
    );

    if (updatedImage.rows.length === 0) {
      return res.status(404).json({ message: "Image not found", error: true });
    }

    res.status(200).json({
      message: "Image Updated successfully",
      Images: updatedImage.rows[0],
      error: false,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", ImageS: null, error: true });
  }
};

export const deleteImage = async (req, res) => {
  const { iId } = req.params;

  try {
    await db.query(`DELETE FROM "P_Images" WHERE id = $1`, [iId]);
    res.status(204).json({
      message: "Image removed successfully",
      Images: null,
      error: false,
    });
  } catch (error) {
    logger.error({ err: error });
    res
      .status(500)
      .json({ message: "Internal Server Error", Images: null, error: true });
  }
};

export const getAllSizes = async (req, res) => {
  const { id } = req.params;

  try {
    const sizes = await db.query(
      `SELECT * FROM "P_Size" WHERE product_id = $1`,
      [id]
    );

    if (sizes.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No record found", Sizes: null, error: true });
    }

    res
      .status(200)
      .json({ message: "Records found", Sizes: sizes.rows, error: false });
  } catch (error) {
    logger.error({ err: error });
    return res
      .status(500)
      .json({ message: "Internal Server Error", Sizes: null, error: true });
  }
};

export const getSizebyId = async (req, res) => {
  res
    .status(200)
    .json({ message: "Record Found", Sizes: req.size, error: false });
};

export const postSize = async (req, res) => {
  const { id } = req.params;
  const { size, stock } = req.body;

  if (!stock || !size) {
    return res.status(400).json({
      message: "Bad request, please fill in all fields",
      Sizes: null,
      error: true,
    });
  }
  try {
    const sid = uuid();
    const input_val = await db.query(
      `INSERT INTO "P_Size" (id, size, stock, product_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      [sid, size, stock, id]
    );

    res.status(201).json({
      message: "Record inserted successfully",
      Sizes: input_val.rows[0],
      error: false,
    });
  } catch (error) {
    logger.error({ err: error });
    return res
      .status(500)
      .json({ message: "Internal Server Error", Sizes: null, error: true });
  }
};

export const updateSizeInfo = async (req, res) => {
  const { sId } = req.params;
  const { stock, size } = req.body;

  try {
    const existing = await db.query(`SELECT * FROM "P_Size" WHERE id = $1`, [
      sId,
    ]);

    const updateSize = size || existing.rows[0].size;
    const updateStock = stock || existing.rows[0].stock;

    const updatedValue = await db.query(
      `UPDATE "P_Size" SET size = $1, stock = $2 WHERE id = $3 RETURNING *`,
      [updateSize, updateStock, sId]
    );

    res.status(200).json({
      message: "Record updated successfully",
      Sizes: updatedValue.rows[0],
      error: false,
    });
  } catch (error) {
    logger.error({ err: error });
    res
      .status(500)
      .json({ message: "Internal Server Error", Sizes: null, error: true });
  }
};

export const deleteSieInfo = async (req, res) => {
  const { sId } = req.params;

  try {
    await db.query(`DELETE FROM "P_Size" WHERE id = $1`, [sId]);
    res.status(204).json({
      message: "Record deleted successfully",
      Sizes: null,
      error: false,
    });
  } catch (error) {
    logger.error({ err: error });
    res
      .status(500)
      .json({ message: "Internal Server Error", Sizes: null, error: true });
  }
};
