import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null); // Store user email
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch user data on app load to validate session
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
          withCredentials: true, // Send the JWT cookie
        });
        const { userId, email, isAdmin } = response.data; // Include email in the response
        setUserId(userId);
        setUserEmail(email); // Set email state
        setIsAdmin(isAdmin);
      } catch (err) {
        console.error("Failed to fetch user", err);
        setUserId(null);
        setUserEmail(null); // Reset email if fetching fails
        setIsAdmin(false);
      }
    };

    fetchUser();
  }, []);

  // Authenticate user and set user data
  const handleLogin = async (email, password) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/login`,
        { email, password },
        { withCredentials: true } // Ensure cookies are sent
      );

      const { u_id, email: userEmail, is_admin } = response.data.User; // Extract email
      setUserId(u_id);
      setUserEmail(userEmail); // Set email state
      setIsAdmin(is_admin);
    } catch (err) {
      console.error("Login failed:", err);
      throw new Error(err.response?.data?.message || "Login failed");
    }
  };

  // Logout user and clear user data
  const logout = async () => {
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/logout`,
        {},
        { withCredentials: true } // Ensure cookies are sent
      );
      setUserId(null);
      setUserEmail(null); // Reset email state
      setIsAdmin(false);
      console.log("Logout successful");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <UserContext.Provider
      value={{
        userId,
        userEmail, // Provide userEmail in the context
        isAdmin,
        login: handleLogin, // Export handleLogin as login
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
