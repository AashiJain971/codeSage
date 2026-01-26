/**
 * API helper functions with authentication support
 */

export const getApiBase = () => {
  if (typeof window === 'undefined') return '';
  
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) return apiUrl;
  
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  
  return 'https://codesage-backend.onrender.com';
};

export const getWsBase = () => {
  if (typeof window === 'undefined') return '';
  
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (wsUrl) return wsUrl;
  
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'ws://localhost:8000';
  }
  
  return 'wss://codesage-backend.onrender.com';
};

/**
 * Get authenticated WebSocket URL with token
 */
export const getAuthenticatedWsUrl = (token: string, path: string = '/ws') => {
  const base = getWsBase();
  return `${base}${path}?token=${encodeURIComponent(token)}`;
};

/**
 * Make authenticated API request
 */
export const authenticatedFetch = async (
  url: string,
  token: string,
  options: RequestInit = {}
) => {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
};
