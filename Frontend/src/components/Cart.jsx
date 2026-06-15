import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import ReactLoading from "react-loading";

const Cart = () => {
  const { userId } = useParams(); // Get userId from URL params
  const navigate = useNavigate(); // For navigation
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Track login status
  const [orderId, setOrderId] = useState(null); // Track the current order ID

  // Fetch cart items for the latest order
  useEffect(() => {
    const fetchCartItems = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
          withCredentials: true, // Send cookies for authentication
        });
        setIsLoggedIn(true); // User is logged in

        // Fetch the latest/current order
        const orderResponse = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/users/${userId}/order/current`,
          { withCredentials: true }
        );

        const latestOrder = orderResponse.data.Orders;

        if (!latestOrder || latestOrder.is_complete) {
          setError("No active order found.");
          setCartItems([]);
          return;
        }

        setOrderId(latestOrder.o_id);

        // Fetch order details for the latest order
        const cartResponse = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/users/${userId}/order/${latestOrder.o_id}/order_details`,
          { withCredentials: true }
        );

        const orderDetails = cartResponse.data.OrderDetails;

        // Fetch product names for each item in parallel
        const updatedItems = await Promise.all(
          orderDetails.map(async (item) => {
            const productResponse = await axios.get(
              `${import.meta.env.VITE_API_URL}/api/products/${item.product_p_id}`,
              { withCredentials: true }
            );
            return {
              ...item,
              product_name: productResponse.data.Product.p_name, // Add product name
            };
          })
        );

        setCartItems(updatedItems);
      } catch (err) {
        if (err.response?.status === 401) {
          setIsLoggedIn(false); // User is not logged in
          setError("Please log in to view your cart.");
        } else if (err.response?.status === 404) {
          setCartItems([]); // No cart items found
        } else {
          console.error("Failed to fetch cart items:", err);
          setError("Failed to fetch cart items. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchCartItems();
    } else {
      setError("Invalid user ID.");
      setLoading(false);
    }
  }, [userId]);

  // Calculate total cost of items in the cart
  const calculateTotal = () => {
    return cartItems
      .reduce((total, item) => total + (item.od_price * item.quantity), 0)
      .toFixed(2);
  };

  const updateQuantity = async (od_id, newQuantity) => {
    if (!orderId) {
      alert("No active cart to update.");
      return;
    }

    try {
      // od_price is the UNIT price and must not change with quantity. The
      // backend recomputes the order total as SUM(quantity * od_price).
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/users/${userId}/order/${orderId}/order_details/${od_id}`,
        { quantity: newQuantity },
        { withCredentials: true }
      );

      const updatedItem = response.data.OrderDetails;

      // Preserve the product name when updating the cartItems
      setCartItems((prevItems) =>
        prevItems.map((cartItem) =>
          cartItem.od_id === updatedItem.od_id
            ? {
                ...updatedItem,
                product_name: cartItem.product_name, // Retain product name
              }
            : cartItem
        )
      );
    } catch (err) {
      console.error("Failed to update quantity:", err);
      alert("Failed to update quantity. Please try again.");
    }
  };

  const handleIncrement = (od_id, currentQuantity) => {
    updateQuantity(od_id, currentQuantity + 1);
  };

  const handleDecrement = (od_id, currentQuantity) => {
    if (currentQuantity > 1) {
      updateQuantity(od_id, currentQuantity - 1);
    } else {
      alert("Use the remove button to delete the item from the cart.");
    }
  };

  const handleRemoveAll = async () => {
    if (!orderId) {
      alert("No active cart to clear.");
      return;
    }

    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/users/${userId}/order/${orderId}`,
        { withCredentials: true }
      );
      setCartItems([]); // Clear the cart on the frontend
      alert("Cart emptied successfully!");
    } catch (err) {
      console.error("Failed to empty cart:", err);
      alert("Failed to empty the cart. Please try again.");
    }
  };

  const handleRemoveItem = async (od_id) => {
    if (!orderId) {
      alert("No active cart to update.");
      return;
    }

    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/users/${userId}/order/${orderId}/order_details/${od_id}`,
        { withCredentials: true }
      );
      setCartItems((prevItems) =>
        prevItems.filter((item) => item.od_id !== od_id)
      ); // Remove the item from the frontend state
      alert("Item removed successfully!");
    } catch (err) {
      console.error("Failed to remove item:", err);
      alert("Failed to remove the item. Please try again.");
    }
  };

  const handleConfirmOrder = () => {
    if (!orderId) {
      alert("No active order to confirm.");
      return;
    }
    navigate(`/users/${userId}/order/${orderId}/address`);
  };

  const handleContinueShopping = () => {
    navigate("/products");
  };

  // Render Loading Indicator
  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <ReactLoading type="spin" color="#4A5568" height={50} width={50} />
      </div>
    );
    
  if (error) return <p className="text-red-600">{error}</p>;

  if (!isLoggedIn) {
    return (
      <section className="py-12 bg-white sm:py-16 lg:py-20">
        <div className="px-4 py-16 mx-auto sm:px-6 lg:px-8 max-w-7xl">
          <h1 className="text-3xl font-bold mb-8">Your Cart</h1>
          <p className="text-lg text-gray-700">
            Please log in to view your cart.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 bg-white sm:py-16 lg:py-20">
      <div className="py-16 w-[80%] mx-auto sm:px-6 lg:px-8 max-w-7xl">
        <h1 className="text-3xl text-center font-bold mb-8">Your Cart</h1>
        {cartItems.length === 0 ? (
          <p>Your cart is empty.</p>
        ) : (
          <div>
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div
                  key={item.od_id}
                  className="p-4 border rounded-md shadow-sm flex justify-between items-center"
                >
                  <div>
                    <h2 className="text-xl font-bold">
                      {item.product_name || "Unnamed Product"}
                    </h2>
                    <p>Size: {item.size}</p>
                    <div className="flex items-center space-x-2">
                      <p>Quantity:</p>
                      <button
                        className="px-2 py-1 border rounded-md"
                        onClick={() =>
                          handleDecrement(item.od_id, item.quantity)
                        }
                      >
                        -
                      </button>
                      <span className="px-4">{item.quantity}</span>
                      <button
                        className="px-2 py-1 border rounded-md"
                        onClick={() =>
                          handleIncrement(item.od_id, item.quantity)
                        }
                      >
                        +
                      </button>
                    </div>
                    <p>Price: ${Number(item.od_price || 0).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center">
                    {/* <p className="text-lg font-semibold mr-4">
                      Total: ${(item.od_price * item.quantity).toFixed(2)}
                    </p> */}
                    <button
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                      onClick={() => handleRemoveItem(item.od_id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 text-xl text-right font-semibold">
              <p>Total: ${calculateTotal()}</p>
            </div>
            <div className="flex justify-between mt-8">
              <button
                className="w-60 p-3 bg-custom-brown text-white border-2 border-custom-brown rounded-md hover:border-2 hover:border-custom-brown hover:text-custom-brown hover:bg-transparent"
                onClick={handleContinueShopping}
              >
                Continue Shopping
              </button>
              <button
                className="w-48 p-3 bg-custom-brown text-white border-2 border-custom-brown rounded-md hover:border-2 hover:border-custom-brown hover:text-custom-brown hover:bg-transparent"
                onClick={handleConfirmOrder}
              >
                Confirm Order
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Cart;
