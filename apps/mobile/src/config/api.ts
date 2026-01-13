// ========================================
// 🔧 Centralized API Configuration
// ========================================
// 
// LifyTP supports TWO backend architectures:
// 1. Monolithic API (port 3000) - For local development
// 2. Microservices (ports 4100-4102) - For Kubernetes/TP demo
//
// Switch between them using EXPO_PUBLIC_BACKEND_MODE env var

// ========================================
// Configuration Constants
// ========================================

// Your machine's LAN IP (update this to match your network)
// For iOS Simulator on Mac, use "localhost"
// For real device testing, use your LAN IP (e.g., "10.1.168.167")
const LAN_IP = "localhost";

// Backend mode: 'monolith' or 'microservices'
// Can be set via .env file: EXPO_PUBLIC_BACKEND_MODE=microservices
const BACKEND_MODE = (process.env.EXPO_PUBLIC_BACKEND_MODE as 'monolith' | 'microservices') || 'monolith';

// ========================================
// URL Definitions
// ========================================

// Monolithic API (single server for all endpoints)
const MONOLITH_URL = `http://${LAN_IP}:3000`;

// Microservices URLs (separate servers per domain)
const MICROSERVICES_URLS = {
  auth: `http://${LAN_IP}:4100`,      // Auth Service
  events: `http://${LAN_IP}:4101`,    // Events Service
  messages: `http://${LAN_IP}:4102`,  // Messages Service
};

// Production URL (for future deployment)
const PROD_URL = "https://api.lify.app";

// ========================================
// Exported Configuration
// ========================================

// Main API Base URL (used for axios baseURL)
// In microservices mode, defaults to auth service
export const API_BASE_URL = BACKEND_MODE === 'microservices'
  ? MICROSERVICES_URLS.auth
  : MONOLITH_URL;

// Service URLs (for routing requests in microservices mode)
export const SERVICES_URLS = BACKEND_MODE === 'microservices'
  ? MICROSERVICES_URLS
  : {
    auth: MONOLITH_URL,
    events: MONOLITH_URL,
    messages: MONOLITH_URL
  };

// Backend mode indicator
export const backendMode = BACKEND_MODE;
export const isMonolithMode = BACKEND_MODE === 'monolith';
export const isMicroservicesMode = BACKEND_MODE === 'microservices';

// Helper to check if we're in development
export const isDevelopment = API_BASE_URL.includes("localhost") || API_BASE_URL.includes("192.168");

// ========================================
// Logging
// ========================================

console.log(`[Config] 🔧 Backend Mode: ${BACKEND_MODE.toUpperCase()}`);
console.log(`[Config] 📡 API Base URL: ${API_BASE_URL}`);
if (isMicroservicesMode) {
  console.log(`[Config] 🎯 Auth Service: ${SERVICES_URLS.auth}`);
  console.log(`[Config] 📅 Events Service: ${SERVICES_URLS.events}`);
  console.log(`[Config] 💬 Messages Service: ${SERVICES_URLS.messages}`);
}

