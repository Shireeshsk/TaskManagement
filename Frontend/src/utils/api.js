export const apiFetch = async (url, options = {}) => {
  // Always include credentials so cookies (access_token, refresh_token) are sent
  const opts = { ...options, credentials: "include" };

  let response = await fetch(url, opts);

  // If unauthorized, silently attempt a token refresh then retry
  if (response.status === 401) {
    try {
      const refreshRes = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include"
      });

      if (refreshRes.ok) {
        // Retry original request with fresh cookies
        response = await fetch(url, opts);
      }
    } catch (e) {
      console.error("Token refresh failed", e);
    }
  }

  return response;
};
