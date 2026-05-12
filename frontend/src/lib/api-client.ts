import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Cookie key storing the access token.
 * TODO: Integrate @supabase/ssr later — replace manual cookie read with
 *       Supabase's built-in session management.
 */
const ACCESS_TOKEN_KEY = "access_token";

/* -------------------------------------------------------------------------- */
/*  Axios Instance                                                             */
/* -------------------------------------------------------------------------- */

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/* -------------------------------------------------------------------------- */
/*  Request Interceptor — Bearer Token                                         */
/* -------------------------------------------------------------------------- */

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    /**
     * Read token from cookie (SSR-compatible via js-cookie).
     * TODO: Integrate @supabase/ssr later — token will be read from
     *       Supabase session cookie instead of a manually-managed cookie.
     */
    const token = Cookies.get(ACCESS_TOKEN_KEY);

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/* -------------------------------------------------------------------------- */
/*  Response Interceptor — Error Handling                                       */
/* -------------------------------------------------------------------------- */

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      // Unauthorized — clear stale token and redirect to login
      if (status === 401) {
        Cookies.remove(ACCESS_TOKEN_KEY);

        // Only redirect on client side
        if (typeof window !== "undefined") {
          // TODO: Integrate @supabase/ssr later — use Supabase signOut()
          window.location.href = "/login";
        }
      }

      // Forbidden
      if (status === 403) {
        console.error("[API] Forbidden — insufficient permissions.");
      }
    }

    return Promise.reject(error);
  },
);

/* -------------------------------------------------------------------------- */
/*  Typed Helper Functions                                                     */
/* -------------------------------------------------------------------------- */

export async function get<T>(url: string, params?: Record<string, unknown>) {
  const response = await apiClient.get<T>(url, { params });
  return response.data;
}

export async function post<T>(url: string, data?: unknown) {
  const response = await apiClient.post<T>(url, data);
  return response.data;
}

export async function put<T>(url: string, data?: unknown) {
  const response = await apiClient.put<T>(url, data);
  return response.data;
}

export async function del<T>(url: string) {
  const response = await apiClient.delete<T>(url);
  return response.data;
}

export default apiClient;
