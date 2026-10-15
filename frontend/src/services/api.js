// services/api.js - Axios HTTP Client & Token Interceptor Config

// Import the axios library, which is a promise-based HTTP client for the browser and node.js.
import axios from 'axios';

// Helper to reliably compute API base URL
const getBaseUrl = () => {
  let url = (import.meta.env.VITE_API_URL || 'https://codec-p2-1.onrender.com/api').trim();
  // Strip trailing slashes
  url = url.replace(/\/+$/, '');
  // Ensure the URL ends with /api
  if (!url.endsWith('/api')) {
    url = `${url}/api`;
  }
  return url;
};

// Create an instance of Axios with a customized configuration.
// 'baseURL' sets the default prefix for all API request paths made using this client.
const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// A REQUEST INTERCEPTOR is a function that intercept and modifies requests before they are sent to the server.
// We use it to inject the JWT token automatically without having to pass headers manually in every Axios call.
api.interceptors.request.use(
  (config) => {
    // 1. LOOK UP TOKEN: Read the token string saved in the browser's localStorage cache.
    const token = localStorage.getItem('token');

    // 2. ATTACH HEADER: If the token exists, add it to the Authorization headers.
    // The server expects the "Bearer <Token>" format to recognize authorization details.
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config; // Return the modified request config so the request proceeds
  },
  (error) => {
    // If the request setup fails before being sent, pass the error forward.
    return Promise.reject(error);
  }
);

export default api;
