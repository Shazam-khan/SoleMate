import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ReactLoading from "react-loading";

const API_URL = `${import.meta.env.VITE_API_URL}/api/products`;
const PLACEHOLDER_IMAGE = "https://via.placeholder.com/200";

function Products() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]); // Track categories
  const [selectedCategory, setSelectedCategory] = useState(""); // Track the selected category
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      filterProductsByCategory(selectedCategory);
    } else {
      setFilteredProducts(products);
    }
  }, [selectedCategory, products]);

  const fetchProducts = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await axios.get(API_URL);

      if (response.status === 200) {
        const productsWithDetails = await attachDetailsToProducts(
          response.data.Products
        );

        // Extract unique categories from products
        const uniqueCategories = [
          ...new Set(productsWithDetails.map((product) => product.category)),
        ];

        setProducts(productsWithDetails);
        setCategories(uniqueCategories);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
      setError("Failed to fetch products. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const attachDetailsToProducts = async (products) => {
    const productDetailsPromises = products.map(async (product) => {
      try {
        const [categoryResponse, imageResponse] = await Promise.all([
          axios.get(`${API_URL}/${product.p_id}/category`), // Fetch category
          axios.get(`${API_URL}/${product.p_id}/images`), // Fetch images
        ]);

        const category =
          categoryResponse.status === 200 &&
          categoryResponse.data.Category.length > 0
            ? categoryResponse.data.Category[0].c_name
            : "Unknown";

        const images =
          imageResponse.status === 200 && imageResponse.data.Images.length > 0
            ? imageResponse.data.Images[0].image_url
            : PLACEHOLDER_IMAGE;

        return {
          ...product,
          category,
          imageUrl: images,
        };
      } catch (err) {
        console.error(
          `Error fetching details for product ${product.p_id}:`,
          err
        );
        return {
          ...product,
          category: "Unknown",
          imageUrl: PLACEHOLDER_IMAGE,
        };
      }
    });

    return Promise.all(productDetailsPromises);
  };

  const filterProductsByCategory = (categoryName) => {
    const filtered = products.filter(
      (product) => product.category.toLowerCase() === categoryName.toLowerCase()
    );
    setFilteredProducts(filtered);
  };

  const handleProductClick = (productId) => {
    navigate(`/products/${productId}`);
  };

  return (
    <section className="py-12 bg-white sm:py-16 lg:py-20">
      <div className="px-4 py-16 mx-auto sm:px-6 lg:px-8 max-w-7xl">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {selectedCategory
              ? `${
                  selectedCategory.charAt(0).toUpperCase() +
                  selectedCategory.slice(1)
                }`
              : "All Shoes"}
          </h2>
        </div>

        {/* Category Filter Dropdown */}
        <div className="flex justify-center mt-6">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border rounded-md"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-[50vh]">
            <ReactLoading type="spin" color="brown" height={64} width={64} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 mt-10 lg:mt-16 lg:gap-4 lg:grid-cols-4">
            {error && (
              <p className="text-red-600 text-sm text-center mb-4">{error}</p>
            )}

            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <div
                  key={product.p_id}
                  className="relative group"
                  onClick={() => handleProductClick(product.p_id)}
                >
                  <div className="overflow-hidden relative aspect-w-1 aspect-h-1">
                    <img
                      className="object-cover w-full h-[350px] transition-all duration-300 group-hover:scale-110"
                      src={product.imageUrl}
                      alt={product.p_name}
                    />
                  </div>
                  <div className="flex items-start justify-between mt-4 mx-2 space-x-4">
                    <div>
                      <h3 className="text-xs font-bold text-gray-900 sm:text-sm md:text-base">
                        {product.p_name}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {product.category}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-900 sm:text-sm md:text-base">
                        ${product.price}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-600">No products found.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default Products;
