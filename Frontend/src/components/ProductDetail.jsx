import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useUser } from "./UserContext.jsx";
import ReactLoading from "react-loading"; // Import ReactLoading

const ProductDetail = () => {
  const { userId } = useUser(); // Access userId from UserContext
  const { productId } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [category, setCategory] = useState(null);
  const [images, setImages] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [orderId, setOrderId] = useState(null); // Track current order ID
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch product details
  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      const [productRes, imagesRes, categoryRes, sizesRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/api/products/${productId}`),
        axios.get(`${import.meta.env.VITE_API_URL}/api/products/${productId}/images`),
        axios.get(`${import.meta.env.VITE_API_URL}/api/products/${productId}/category`),
        axios.get(`${import.meta.env.VITE_API_URL}/api/products/${productId}/size`),
      ]);

      setProduct(productRes.data.Product);
      setImages(
        imagesRes.data.Images.map((img) => img.image_url || "/placeholder.svg")
      );
      setCategory(categoryRes.data.Category[0]);
      setSizes(sizesRes.data.Sizes.map((size) => size.size));
    } catch (err) {
      console.error(err);
      setError("Failed to fetch product details. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch existing order ID for the user
  const fetchOrderId = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/users/${userId}/order/current`,
        { withCredentials: true }
      );
      setOrderId(response.data.Orders.o_id); // Save the current order ID
    } catch (err) {
      if (err.response?.status === 404) {
        console.log("No current order found. A new order will be created.");
        setOrderId(null); // No current order
      } else {
        console.error("Failed to fetch current order ID:", err);
        setError("Error fetching current order. Please try again.");
      }
    }
  };

  useEffect(() => {
    if (!productId) {
      setError("Invalid product ID. Please check the URL.");
      setLoading(false);
      return;
    }
    fetchProductDetails();
    if (userId) fetchOrderId(); // Fetch current order ID if user is logged in
  }, [productId, userId]);

  const handleAddToCart = async () => {
    if (!userId) {
      alert("Please log in to add items to the cart.");
      return;
    }

    if (!selectedSize) {
      alert("Please select a size before adding to the cart.");
      return;
    }

    try {
      if (orderId) {
        // Add to existing order
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/users/${userId}/order/${orderId}/order_details`,
          {
            quantity,
            p_id: productId,
            size: selectedSize,
            userId,
          },
          { withCredentials: true }
        );
        alert("Item added to your cart!");
      } else {
        // Create a new order and add item
        const orderDate = new Date().toISOString();
        const promisedDate = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString();
        const address = "Default Address, Update Later";

        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/users/${userId}/order`,
          {
            orderDate,
            promisedDate,
            address,
            quantity,
            p_id: productId,
            size: selectedSize,
          },
          { withCredentials: true }
        );

        const newOrderId = response.data.Orders.o_id;
        setOrderId(newOrderId); // Save new order ID
        alert("Order created and item added to your cart!");
      }

      //navigate(`/users/${userId}/cart`); // Redirect to cart page
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to add item to cart.");
    }
  };

  // Render Loading Indicator
  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <ReactLoading type="spin" color="custom-brown-light" height={50} width={50} />
      </div>
    );

  // Render Error 
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <section className="py-12 bg-white sm:py-16 lg:py-20">
      <div className="px-4 py-16 mx-auto sm:px-6 lg:px-8 max-w-7xl">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Image Carousel */}
          <div className="relative flex">
            <div className="flex flex-col space-y-2 mr-4">
              {images.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`Thumbnail ${index + 1}`}
                  className={`w-20 h-20 object-cover cursor-pointer border rounded-md ${
                    currentIndex === index
                      ? "border-blue-500"
                      : "border-gray-300"
                  }`}
                  onClick={() => setCurrentIndex(index)}
                />
              ))}
            </div>
            <div className="relative w-full h-[400px] group">
              <div
                style={{
                  backgroundImage: `url(${
                    images[currentIndex] || "/placeholder.svg"
                  })`,
                }}
                className="w-full h-full bg-center bg-cover duration-500 rounded-md shadow-lg"
              ></div>
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-4 border-l-2 border-gray-300 pl-12 ml-8">
            <h1 className="text-3xl font-bold">
              {product?.p_name || "Product Name"}
            </h1>
            <p className="text-xl">Type: {category?.c_name || "Unknown"}</p>
            <p className="text-lg">
              Description:{" "}
              {category?.description || "No description available."}
            </p>
            <p className="text-xl">Brand: {product?.brand || "Unknown"}</p>
            <p className="text-xl">
              Price:{" "}
              <span className="text-2xl font-semibold">
                ${product?.price?.toFixed(2) || "0.00"}
              </span>
            </p>

            {/* Size Selector */}
            <div>
              <label className="mr-4">Size:</label>
              <select
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                className="p-2 border rounded-md"
              >
                <option value="" disabled>
                  Select size
                </option>
                {sizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center space-x-2">
              <label className="mr-4">Quantity:</label>
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="p-2 border rounded-md border-gray-500"
              >
                -
              </button>
              <input
                type="number"
                value={quantity}
                readOnly
                className="w-16 h-10 text-center border rounded-md border-gray-500"
              />
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="p-2 border rounded-md border-gray-500"
              >
                +
              </button>
            </div>

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              className="w-96 p-3 bg-custom-brown text-white rounded-md hover:border-2 hover:border-custom-brown hover:text-custom-brown hover:bg-transparent"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductDetail;
