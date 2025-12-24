// API Configuration for different environments
const config = {
  development: {
    API_BASE_URL: 'http://localhost:5000/api'
  },
  production: {
    // Set VITE_API_BASE_URL in Vercel Environment Variables after deploying backend
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
  }
};

const environment = import.meta.env.MODE || 'development';
export const API_BASE_URL = config[environment].API_BASE_URL;

export default config;