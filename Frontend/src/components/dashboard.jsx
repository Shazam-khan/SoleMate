import React, { useState, useEffect } from "react";
import axios from "axios";

const AdminDashboard = () => {
  const [products, setProducts] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    p_name: "",
    brand: "",
    price: "",
    category: "Sneakers",
    sizes: [{ size: "", quantity: "" }],
    images: [],
  });

  const BASE_URL = `${import.meta.env.VITE_API_URL}/api/products`;

  useEffect(() => {
    // Fetch all products
    const fetchProducts = async () => {
      try {
        const response = await axios.get(BASE_URL);
        setProducts(response.data.Products || []);
      } catch (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
      }
    };
    fetchProducts();
  }, []);

  // Save (Add or Update) product
  const handleSaveProduct = async () => {
    try {
      if (editingProduct) {
        // Update existing product
        const updatedData = {
          pName: newProduct.p_name,
          brand: newProduct.brand,
          price: newProduct.price,
          category: newProduct.category,
        };

        await axios.put(`${BASE_URL}/${editingProduct.p_id}`, updatedData);

        // Update sizes
        for (const size of newProduct.sizes) {
          if (size.id) {
            // Existing size, update
            await axios.put(
              `${BASE_URL}/${editingProduct.p_id}/size/${size.id}`,
              {
                size: size.size,
                stock: size.quantity,
              }
            );
          } else {
            // New size, add
            await axios.post(`${BASE_URL}/${editingProduct.p_id}/size`, {
              size: size.size,
              stock: size.quantity,
            });
          }
        }

        // Refresh the products list
        const response = await axios.get(BASE_URL);
        setProducts(response.data.Products || []);
      } else {
        // Add new product
        const productResponse = await axios.post(BASE_URL, {
          pName: newProduct.p_name,
          brand: newProduct.brand,
          price: newProduct.price,
        });

        const productId = productResponse.data.id.p_id;

        // Add category
        await axios.post(`${BASE_URL}/${productId}/category`, {
          userPreference: "U",
          cName: newProduct.category,
          description: `${newProduct.category} category`,
        });

        // Add sizes
        for (const size of newProduct.sizes) {
          await axios.post(`${BASE_URL}/${productId}/size`, {
            size: size.size,
            stock: size.quantity,
          });
        }

        // Add images
        for (const image of newProduct.images) {
          const formData = new FormData();
          formData.append("filename", image.name);
          formData.append("image", image.file);
          await axios.post(`${BASE_URL}/${productId}/images`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }

        // Refresh product list
        const updatedProducts = [...products, productResponse.data.id];
        setProducts(updatedProducts);
      }
    } catch (error) {
      console.error("Error saving product:", error);
    }
    setIsDialogOpen(false);
    setEditingProduct(null);
    resetNewProduct();
  };

  // Delete product
  const handleDeleteProduct = async (id) => {
    try {
      await axios.delete(`${BASE_URL}/${id}`);
      // Update the product list in state
      setProducts((prevProducts) =>
        prevProducts.filter((product) => product.p_id !== id)
      );
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const resetNewProduct = () => {
    setNewProduct({
      p_name: "",
      brand: "",
      price: "",
      category: "Sneakers",
      sizes: [{ size: "", quantity: "" }],
      images: [],
    });
  };

  // Handle Adding and Updating Sizes
  const handleAddSize = () => {
    setNewProduct((prev) => ({
      ...prev,
      sizes: [...prev.sizes, { size: "", quantity: "" }],
    }));
  };

  const handleRemoveSize = (index) => {
    setNewProduct((prev) => ({
      ...prev,
      sizes: prev.sizes.filter((_, i) => i !== index),
    }));
  };

  const handleFileChange = (e) => {
    if (!editingProduct) {
      // Allow adding images only when creating a new product
      const files = Array.from(e.target.files);
      const newImages = files.map((file) => ({
        name: file.name,
        file,
      }));
      setNewProduct((prev) => ({
        ...prev,
        images: [...prev.images, ...newImages],
      }));
    }
  };

  return (
    <div className="py-12 mt-12 bg-white sm:py-16 lg:py-20">
      <h1 className="text-2xl text-center font-bold">Admin Dashboard</h1>
      <div className="w-[80%] py-12 text-center mx-auto sm:px-6 lg:px-8 max-w-7xl">
        <h1 className="text-xl text-center font-bold mb-6">All Products</h1>
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border py-2 px-4">Name</th>
              <th className="border py-2 px-4">Brand</th>
              <th className="border py-2 px-4">Price</th>
              <th className="border py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length > 0 ? (
              products.map((product) => (
                <tr key={product.p_id} className="border-b">
                  <td className="py-2 px-4 text-center">{product.p_name}</td>
                  <td className="py-2 px-4 text-center">{product.brand}</td>
                  <td className="py-2 px-4 text-center">${product.price}</td>
                  <td className="py-2 px-4 text-center">
                    <button
                      onClick={() => {
                        setEditingProduct(product);
                        setNewProduct({
                          p_name: product.p_name,
                          brand: product.brand,
                          price: product.price,
                          category: product.category,
                          sizes: product.sizes || [{ size: "", quantity: "" }],
                          images: [], // Prevent editing images
                        });
                        setIsDialogOpen(true);
                      }}
                      className="text-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.p_id)}
                      className="text-red-600 ml-4"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center py-4">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <button
          onClick={() => {
            setEditingProduct(null);
            setIsDialogOpen(true);
          }}
          className="w-48 p-3 mt-8 bg-custom-brown text-white rounded-md hover:border-2 hover:border-custom-brown hover:text-custom-brown hover:bg-transparent"
        >
          Add New Product
        </button>
      </div>
      {isDialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 overflow-y-auto">
          <div className="bg-white h-[70%] p-6 rounded shadow-lg w-96 overflow-y-auto">
            <h2 className="text-xl text-center font-bold mb-4">
              {editingProduct ? "Edit Product" : "Add New Product"}
            </h2>
            <form>
              <div className="mb-4">
                <label className="text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={newProduct.p_name}
                  onChange={(e) =>
                    setNewProduct((prev) => ({
                      ...prev,
                      p_name: e.target.value,
                    }))
                  }
                  className="w-full border px-3 py-2 rounded"
                />
              </div>
              <div className="mb-4">
                <label className="text-sm font-medium mb-1">Brand</label>
                <input
                  type="text"
                  value={newProduct.brand}
                  onChange={(e) =>
                    setNewProduct((prev) => ({
                      ...prev,
                      brand: e.target.value,
                    }))
                  }
                  className="w-full border px-3 py-2 rounded"
                />
              </div>
              <div className="mb-4">
                <label className="text-sm font-medium mb-1">Price</label>
                <input
                  type="number"
                  value={newProduct.price}
                  onChange={(e) =>
                    setNewProduct((prev) => ({
                      ...prev,
                      price: e.target.value,
                    }))
                  }
                  className="w-full border px-3 py-2 rounded"
                />
              </div>
              <div className="mb-4">
                <label className="text-sm font-medium mb-1">Category</label>
                <select
                  value={newProduct.category}
                  onChange={(e) =>
                    setNewProduct((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  className="w-full border px-3 py-2 rounded"
                >
                  <option value="Sneakers">Sneakers</option>
                  <option value="Formal shoes">Formal Shoes</option>
                  <option value="Heels">Heels</option>
                  <option value="Slippers">Slippers</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="text-sm font-medium mb-1">Sizes</label>
                {newProduct.sizes.map((size, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Size"
                      value={size.size}
                      onChange={(e) => {
                        const updatedSizes = [...newProduct.sizes];
                        updatedSizes[index].size = e.target.value;
                        setNewProduct((prev) => ({
                          ...prev,
                          sizes: updatedSizes,
                        }));
                      }}
                      className="w-1/2 border px-3 py-2 rounded"
                    />
                    <input
                      type="number"
                      placeholder="Quantity"
                      value={size.quantity}
                      onChange={(e) => {
                        const updatedSizes = [...newProduct.sizes];
                        updatedSizes[index].quantity = e.target.value;
                        setNewProduct((prev) => ({
                          ...prev,
                          sizes: updatedSizes,
                        }));
                      }}
                      className="w-1/2 border px-3 py-2 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSize(index)}
                      className="text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddSize}
                  className="mt-2 text-blue-600"
                >
                  Add Size
                </button>
              </div>
              {!editingProduct && (
                <div className="mb-4">
                  <label className="text-sm font-medium mb-1">Images</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    multiple
                    className="w-full border px-3 py-2 rounded"
                  />
                </div>
              )}
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="bg-gray-300 px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProduct}
                  className="bg-custom-brown text-white px-4 py-2 rounded"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
