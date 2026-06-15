import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTruck } from '@fortawesome/free-solid-svg-icons';
import ReactLoading from "react-loading";
import { loadStripe } from "@stripe/stripe-js";

// Initialize Stripe with your publishable key (use environment variable in production)
const stripePromise = loadStripe("pk_test_51RGKMVCYewQqgfrHb2cCFwnNLcRmKkE2KQc4Fb22STA79qDRaVpf5Lp64GJS9wubP6Y3XglzIahLEHLwWUuQYZdf00xwGLTGG1");

const PaymentPage = () => {
  const { userId, orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [bankDetails, setBankDetails] = useState({
    accountNumber: "",
    bankName: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Check for Stripe session ID on page load
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const sessionId = query.get('session_id');
    if (sessionId) {
      verifyStripeSession(sessionId);
    }
  }, [location]);

  // Fetch order details
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/users/${userId}/order/${orderId}`,
          { withCredentials: true }
        );
        const { total_amount } = response.data.Orders;
        setPaymentAmount(total_amount);
      } catch (err) {
        console.error("Failed to fetch order details:", err);
        setError("Failed to fetch order details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [userId, orderId]);

  // Verify Stripe session
  const verifyStripeSession = async (sessionId) => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/stripe-session/${sessionId}`,
        { withCredentials: true }
      );
      if (response.data.status === 'paid') {
        navigate(`/users/${userId}/order/${orderId}/confirmation`);
      } else {
        setError("Payment not completed. Please try again.");
      }
    } catch (err) {
      console.error("Failed to verify Stripe session:", err);
      setError("Payment verification failed. Please try again.");
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();

    if (!paymentMethod.trim()) {
      alert("Please select a payment method.");
      return;
    }

    try {
      setLoading(true);

      if (paymentMethod === "Debit Card") {
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/create-checkout-session`,
          {
            orderId,
            userId,
            amount: paymentAmount * 100,
            currency: "usd",
          },
          { withCredentials: true }
        );

        const { sessionId } = response.data;
        if (!sessionId) {
          throw new Error("No session ID returned from server");
        }

        const stripe = await stripePromise;
        const { error } = await stripe.redirectToCheckout({ sessionId });

        if (error) {
          console.error("Stripe redirect error:", error);
          setError("Failed to redirect to Stripe Checkout. Please try again.");
        }
      } else {
        const paymentData = {
          paymentMethod,
          paymentAmount,
        };

        if (paymentMethod === "Bank Transfer") {
          paymentData.bankDetails = bankDetails;
        }

        await axios.post(
          `${import.meta.env.VITE_API_URL}/api/users/${userId}/order/${orderId}/payments`,
          paymentData,
          { withCredentials: true }
        );
        navigate(`/users/${userId}/order/${orderId}/confirmation`);
      }
    } catch (err) {
      console.error("Failed to process payment:", err);
      setError("Failed to process payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
        <div className="flex justify-between items-center mb-8">
          <div className="w-[49%] h-[3px] bg-custom-brown-light"></div>
          <div>
            <FontAwesomeIcon icon={faTruck} className="text-custom-brown text-3xl" />
          </div>
          <div className="w-[49%] h-[3px] bg-custom-brown-light"></div>
        </div>

        <h1 className="text-3xl text-center font-bold mb-8">Payment</h1>
        <form
          className="space-y-4 p-4 border rounded-md shadow-sm"
          onSubmit={handlePayment}
        >
          <label
            className="block text-lg font-semibold"
            htmlFor="paymentMethod"
          >
            Payment Method:
          </label>
          <select
            id="paymentMethod"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full p-3 border rounded-md text-black focus:outline-none focus:ring-2 focus:ring-custom-brown"
          >
            <option value="">Select a payment method</option>
            <option value="Debit Card">Debit Card</option>
            <option value="Cash on Delivery">Cash on Delivery</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </select>

          {paymentMethod === "Bank Transfer" && (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Account Number"
                value={bankDetails.accountNumber}
                onChange={(e) =>
                  setBankDetails({ ...bankDetails, accountNumber: e.target.value })
                }
                className="w-full p-3 border rounded-md"
              />
              <input
                type="text"
                placeholder="Bank Name"
                value={bankDetails.bankName}
                onChange={(e) =>
                  setBankDetails({ ...bankDetails, bankName: e.target.value })
                }
                className="w-full p-3 border rounded-md"
              />
            </div>
          )}

          <p className="text-lg mt-4">
            Payment Amount: <span className="font-bold">${paymentAmount}</span>
          </p>

          <button
            type="submit"
            className="w-full p-3 bg-custom-brown text-white rounded-md hover:border-2 hover:border-custom-brown hover:text-custom-brown hover:bg-transparent"
          >
            Proceed to Pay
          </button>
        </form>
      </div>
    </section>
  );
};

export default PaymentPage;