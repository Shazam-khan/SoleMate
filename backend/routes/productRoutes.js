import express from "express";
import {
  getAllProducts,
  createProduct,
  getProductById,
  UpdateProduct,
  DeleteProduct,
  getProductCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllProductImages,
  getImageById,
  postImage,
  updateImage,
  deleteImage,
  getAllSizes,
  postSize,
  getSizebyId,
  updateSizeInfo,
  deleteSieInfo,
} from "../controller/productController.js";
import {
  CheckImageId,
  checkProductId,
  checkSizeId,
} from "../middleware/Products.js";
import { verifyAdmin } from "../middleware/user.js";
import multer from "multer";

// Configure Multer
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const productRouter = express.Router({ mergeParams: true });

// Public reads; admin-only writes.
productRouter.get("/", getAllProducts);
productRouter.post("/", verifyAdmin, createProduct);

productRouter.param("id", checkProductId); //All routes below this wont need to validate the product id

productRouter.get("/:id", getProductById);
productRouter.put("/:id", verifyAdmin, UpdateProduct);
productRouter.delete("/:id", verifyAdmin, DeleteProduct);

//Product Category routes
productRouter.get("/:id/category", getProductCategory);
productRouter.post("/:id/category", verifyAdmin, createCategory);
productRouter.put("/:id/category/:cId", verifyAdmin, updateCategory);
productRouter.delete("/:id/category/:cId", verifyAdmin, deleteCategory);

//Product Image Routes
productRouter.param("iId", CheckImageId); // no need to validate image id

productRouter.get("/:id/images", getAllProductImages);
productRouter.get("/:id/images/:iId", getImageById);
productRouter.post("/:id/images", verifyAdmin, upload.single("image"), postImage);
productRouter.put("/:id/images/:iId", verifyAdmin, updateImage);
productRouter.delete("/:id/images/:iId", verifyAdmin, deleteImage);

//Product Size Routes
productRouter.get("/:id/size", getAllSizes);
productRouter.post("/:id/size", verifyAdmin, postSize);

productRouter.param("sId", checkSizeId);

productRouter.get("/:id/size/:sId", getSizebyId);
productRouter.put("/:id/size/:sId", verifyAdmin, updateSizeInfo);
productRouter.delete("/:id/size/:sId", verifyAdmin, deleteSieInfo);
export default productRouter;
