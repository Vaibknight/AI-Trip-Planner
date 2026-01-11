import type { ApiResponse, RequestConfig } from "./types";

// API Configuration
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const API_TIMEOUT = 30000; // 30 seconds

// Custom error class
export class ApiException extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "ApiException";
  }
}

// Build query string from params
function buildQueryString(params: Record<string, string | number | boolean>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    query.append(key, String(value));
  });
  return query.toString();
}

// Base API client
class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      "Content-Type": "application/json",
    };
  }

  // Set default headers (e.g., auth token)
  setDefaultHeaders(headers: Record<string, string>) {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  // Get headers with auth token if available
  private getHeaders(customHeaders?: Record<string, string>): HeadersInit {
    const headers = { ...this.defaultHeaders, ...customHeaders };
    
    // Add auth token if available (you can get it from localStorage, cookies, etc.)
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  // Main request method
  async request<T = any>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = "GET",
      headers: customHeaders,
      body,
      params,
      timeout = API_TIMEOUT,
    } = config;

    // Build URL
    let url = `${this.baseURL}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const queryString = buildQueryString(params);
      url += `?${queryString}`;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(customHeaders),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new ApiException(
          response.status,
          data.code || "UNKNOWN_ERROR",
          data.message || data.error || `HTTP ${response.status}`,
          data.details
        );
      }

      return {
        success: true,
        data: data.data !== undefined ? data.data : data,
        message: data.message,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiException) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        };
      }

      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          error: {
            code: "TIMEOUT",
            message: "Request timeout. Please try again.",
          },
        };
      }

      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: error instanceof Error ? error.message : "Network error occurred",
        },
      };
    }
  }

  // Convenience methods
  async get<T = any>(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
    config?: Omit<RequestConfig, "method" | "params">
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "GET", params });
  }

  async post<T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<RequestConfig, "method" | "body">
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "POST", body });
  }

  async put<T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<RequestConfig, "method" | "body">
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "PUT", body });
  }

  async patch<T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<RequestConfig, "method" | "body">
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "PATCH", body });
  }

  async delete<T = any>(
    endpoint: string,
    config?: Omit<RequestConfig, "method">
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "DELETE" });
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Export for custom instances if needed
export { ApiClient };

