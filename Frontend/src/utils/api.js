const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

export const getApiUrl = (url = "") => {
  if (/^https?:\/\//i.test(url)) return url;
  if (!API_BASE_URL) return url;
  const normalizedPath = url.startsWith("/") ? url : `/${url}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const apiFetch = async (url, options = {}) => {
  // Always include credentials so cookies (access_token, refresh_token) are sent
  const opts = { ...options, credentials: "include" };
  const requestUrl = getApiUrl(url);

  let response = await fetch(requestUrl, opts);

  // If unauthorized, silently attempt a token refresh then retry
  if (response.status === 401) {
    try {
      const refreshRes = await fetch(getApiUrl("/api/auth/refresh"), {
        method: "POST",
        credentials: "include"
      });

      if (refreshRes.ok) {
        // Retry original request with fresh cookies
        response = await fetch(requestUrl, opts);
      }
    } catch (e) {
      console.error("Token refresh failed", e);
    }
  }

  return response;
};
