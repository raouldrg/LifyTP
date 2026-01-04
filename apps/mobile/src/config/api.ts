// Centralized API configuration
// Uses EXPO_PUBLIC_API_URL env var if set, otherwise defaults to development LAN IP

// Get the Metro host's LAN IP - this should match where Metro is running
// For development: use your machine's LAN IP (e.g., 192.168.1.152)
// In production: use your actual backend URL

const DEFAULT_DEV_URL = "http://192.168.1.119:3000";
const PROD_URL = "https://api.lify.app"; // Replace with actual production URL when ready

// Expo automatically injects EXPO_PUBLIC_* env vars
const envApiUrl = process.env.EXPO_PUBLIC_API_URL;

// Priority: ENV > Dev default
export const API_BASE_URL = envApiUrl || DEFAULT_DEV_URL;

// Helper to check if we're in development
export const isDevelopment = !envApiUrl || envApiUrl.includes("localhost") || envApiUrl.includes("192.168");

console.log(`[Config] API_BASE_URL: ${API_BASE_URL}`);
