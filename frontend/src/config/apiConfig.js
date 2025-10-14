// API Configuration for different environments
const config = {
  development: {
    API_BASE_URL: 'http://localhost:5000/api'
  },
  production: {
    // Set VITE_API_BASE_URL in Vercel Environment Variables after deploying backend
    // For now, it will use mock data if backend URL is not set
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || null
  }
};

const environment = import.meta.env.MODE || 'development';
export const API_BASE_URL = config[environment].API_BASE_URL;

// Flag to check if we should use mock data (when no backend URL in production)
export const USE_MOCK_DATA = environment === 'production' && !import.meta.env.VITE_API_BASE_URL;

export default config;