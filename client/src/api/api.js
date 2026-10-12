const API_BASE = import.meta.env?.VITE_API_URL || '';

/**
 * Lightweight API client for making authenticated HTTP requests to the backend.
 */
export async function apiRequest(endpoint, { method = 'GET', body, headers = {} } = {}) {
  const token = localStorage.getItem('token');

  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      data?.error?.message ||
      (Array.isArray(data?.error?.details) ? data.error.details.map((d) => d.message).join(', ') : null) ||
      data?.message ||
      'An unexpected error occurred';

    const error = new Error(errorMessage);
    error.status = response.status;
    error.details = data?.error?.details;
    throw error;
  }

  return data;
}

export const api = {
  get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),
  post: (endpoint, body) => apiRequest(endpoint, { method: 'POST', body }),
};
