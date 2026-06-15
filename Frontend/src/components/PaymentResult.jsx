import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const PaymentResult = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handlePaymentResult = async () => {
      const queryParams = new URLSearchParams(window.location.search);
      const orderId = queryParams.get("orderId");
      const status = queryParams.get("status");
      const transactionId = queryParams.get("transactionId");

      if (!orderId || !status) {
        alert("Invalid payment result");
        navigate("/"); // Redirect to home
        return;
      }

      try {
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/payment/callback`,
          {
            orderId,
            status,
            transactionId,
          },
          { withCredentials: true }
        );

        if (response.data.success) {
          alert("Payment successful!");
          navigate(`/users/${response.data.userId}/orders`); // Redirect to orders page
        } else {
          alert("Payment failed. Please try again.");
          navigate("/cart"); // Redirect to cart
        }
      } catch (err) {
        console.error("Error processing payment:", err);
        alert("Something went wrong. Please try again.");
        navigate("/cart"); // Redirect to cart
      }
    };

    handlePaymentResult();
  }, [navigate]);

  return (
    <section className="py-12 bg-white sm:py-16 lg:py-20">
      <div className="w-[80%] py-16 mx-auto sm:px-6 lg:px-8 max-w-7xl">
        <h1 className="text-3xl font-bold mb-8">Processing Payment...</h1>
        <p className="text-lg text-gray-700">
          Please wait while we confirm your payment.
        </p>
      </div>
    </section>
  );
};

export default PaymentResult;
