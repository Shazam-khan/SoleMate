import React, { useState } from "react";
import "./Signup.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGooglePlusG, faFacebookF, faGithub, faLinkedinIn } from "@fortawesome/free-brands-svg-icons";
import { useUser } from "./UserContext.jsx"; // Import UserContext
import { useNavigate } from "react-router-dom"; // For navigation

const Signup = () => {
  const [isModalOpen, setIsModalOpen] = useState(true); // Modal visibility state
  const [isSignUpActive, setIsSignUpActive] = useState(true); // Toggle between Sign-Up and Sign-In
  const [formData, setFormData] = useState({
    fname: "",
    lname: "",
    email: "",
    password: "",
    phoneNumber: "",
  });
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const { login } = useUser(); // Access login method from UserContext
  const navigate = useNavigate(); // Initialize navigation

  // Validation functions
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePassword = (password) => password.length >= 8;
  const validatePhoneNumber = (phoneNumber) => /^\d{11}$/.test(phoneNumber);

  // Handle input changes
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLoginInputChange = (e) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  // Sign-Up API Call
  const handleSignUp = async (e) => {
    e.preventDefault();

    const { fname, lname, email, password, phoneNumber } = formData;

    // Validate fields
    if (!fname || !lname || !email || !password || !phoneNumber) {
      setError("All fields are required.");
      return;
    }

    if (!validateEmail(email)) {
      setError("Invalid email format.");
      return;
    }

    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setError("Phone number must be exactly 11 digits.");
      return;
    }

    setError(""); // Clear any previous errors

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fname, lname, email, password, phoneNumber }),
      });

      const result = await response.json();

      if (result.error) {
        setError(result.message);
      } else {
        await login(email, password); // Automatically log in the user
        alert("Signup successful!");
        setIsModalOpen(false); // Close the modal
        navigate("/products"); // Redirect to products page
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    }
  };

  // Sign-In API Call
  const handleSignIn = async (e) => {
    e.preventDefault();

    const { email, password } = loginData;

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    if (!validateEmail(email)) {
      setError("Invalid email format.");
      return;
    }

    try {
      await login(email, password); // Call login from UserContext
      alert("Login successful!");
      setIsModalOpen(false); // Close the modal
      //navigate("/products"); // Redirect to products page
    } catch (err) {
      setError(err.message || "An error occurred. Please try again.");
    }
  };

  // Close the modal manually
  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Render the modal only if it's open
  if (!isModalOpen) {
    return null;
  }

  return (
    <div className="modal-overlay active">
      <div className="modal-content">
        <button className="close-btn" onClick={closeModal}>
          &times;
        </button>

        <div className={`container ${isSignUpActive ? "active" : ""}`}>
          {/* Sign Up Form */}
            <div className="form-container sign-up">
              <form onSubmit={handleSignUp}>
              <div className="form-header">
                <h1>Create Account</h1>
              </div>
              <div className="social-icons">
                <a href="#" className="icon">
                  <FontAwesomeIcon icon={faGooglePlusG} />
                </a>
                <a href="#" className="icon">
                  <FontAwesomeIcon icon={faFacebookF} />
                </a>
                <a href="#" className="icon">
                  <FontAwesomeIcon icon={faGithub} />
                </a>
                <a href="#" className="icon">
                  <FontAwesomeIcon icon={faLinkedinIn} />
                </a>
              </div>
              <span>or use your email for registration</span>
              <div className="name-container">
                <input
                  type="text"
                  name="fname"
                  placeholder="First Name"
                  value={formData.fname}
                  onChange={handleInputChange}
                />
                <input
                  type="text"
                  name="lname"
                  placeholder="Last Name"
                  value={formData.lname}
                  onChange={handleInputChange}
                />
              </div>  
              <input
                type="tel"
                name="phoneNumber"
                placeholder="Phone Number"
                value={formData.phoneNumber}
                onChange={handleInputChange}
              />
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleInputChange}
              />
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
              />
              {error && <p className="error-message">{error}</p>}
              <button type="submit">Sign Up</button>
            </form>
          </div>

          {/* Sign In Form */}
          <div className="form-container sign-in">
            <form onSubmit={handleSignIn}>
              <div className="form-header">
                <h1>Sign In</h1>
              </div>
              <div className="social-icons">
                <a href="#" className="icon">
                  <FontAwesomeIcon icon={faGooglePlusG} />
                </a>
                <a href="#" className="icon">
                  <FontAwesomeIcon icon={faFacebookF} />
                </a>
                <a href="#" className="icon">
                  <FontAwesomeIcon icon={faGithub} />
                </a>
                <a href="#" className="icon">
                  <FontAwesomeIcon icon={faLinkedinIn} />
                </a>
              </div>
              <span>or use your email password</span>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={loginData.email}
                onChange={handleLoginInputChange}
              />
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={loginData.password}
                onChange={handleLoginInputChange}
              />
              {error && <p className="error-message">{error}</p>}
              <button type="submit">Sign In</button>
            </form>
          </div>

          {/* Toggle Between Forms */}
          <div className="toggle-container">
            <div className="toggle">
              <div className="toggle-panel toggle-left">
                <h1>Welcome Back!</h1>
                <p>Enter your personal details to use all site features</p>
                <button
                  className="toggle-button"
                  id="login"
                  onClick={() => setIsSignUpActive(false)} // Set to Sign In
                >
                  Sign In
                </button>
              </div>
              <div className="toggle-panel toggle-right">
                <h1>Hello, Friend!</h1>
                <p>Register with your personal details to use all site features</p>
                <button
                  className="toggle-button"
                  id="register"
                  onClick={() => setIsSignUpActive(true)} // Set to Sign Up
                >
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
