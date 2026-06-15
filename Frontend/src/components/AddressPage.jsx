import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTruck } from '@fortawesome/free-solid-svg-icons';
import ReactLoading from "react-loading";

const AddressPage = () => {
  const { userId, orderId } = useParams(); // Get userId and orderId from URL params
  const navigate = useNavigate();
  const [orderDetails, setOrderDetails] = useState(null); // Track order details
  const [address, setAddress] = useState(""); // Track the address input
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch order details
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/users/${userId}/order/${orderId}`,
          { withCredentials: true }
        );
        setOrderDetails(response.data.Orders);
        setAddress(response.data.Orders.address || ""); // Pre-fill if address exists
      } catch (err) {
        console.error("Failed to fetch order details:", err);
        setError("Failed to fetch order details. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [userId, orderId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!address.trim()) {
      alert("Address cannot be empty.");
      return;
    }

    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/users/${userId}/order/${orderId}`,
        { address },
        { withCredentials: true }
      );
      navigate(`/users/${userId}/order/${orderId}/payment`); // Navigate to payment page
    } catch (err) {
      console.error("Failed to update address:", err);
      alert("Failed to update address. Please try again.");
    }
  };

  // Render Loading Indicator
  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <ReactLoading type="spin" color="#4A5568" height={50} width={50} />
      </div>
    );
    
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <section className="py-12 bg-white sm:py-16 lg:py-20">
      <div className="w-[80%] py-16 mx-auto sm:px-6 lg:px-8 max-w-7xl">
        {/* Timeline Section */}
        <div className="flex justify-between items-center mb-8">
          <div className="w-[10%] h-[3px] bg-custom-brown-light"></div>
          <div><FontAwesomeIcon icon={faTruck} className="text-custom-brown text-3xl"/></div>
          <div className="w-[88%] h-[3px] bg-custom-brown-light"></div>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold mb-8">Confirm Your Address</h1>

        <div className="space-y-8">
          {/* Order Summary */}
          <div className="p-4 border space-y-4 rounded-md shadow-sm">
            <h2 className="text-xl font-bold">Order Summary: </h2>
            <p>Order ID: {orderDetails?.o_id}</p>
            <p>Total Amount: ${Number(orderDetails?.total_amount || 0).toFixed(2)}</p>
          </div>

          {/* Address Form */}
          <form
            className="space-y-4 p-4 border rounded-md shadow-sm"
            onSubmit={handleSubmit}
          >
            <label className="text-xl font-semibold" htmlFor="address">
              Address:
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter your shipping address"
              className="w-full p-2 border rounded-md"
              rows="4"
            />
            <button
              type="submit"
              className="w-full p-3 bg-custom-brown text-white rounded-md hover:border-2 hover:border-custom-brown hover:text-custom-brown hover:bg-transparent"
            >
              Confirm Address
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default AddressPage;
