import type { ApiResponse, RequestConfig } from "../shared-types";

// ============================================================================
// API Configuration
// ============================================================================
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const DEFAULT_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// Types & Error Classes
// ============================================================================
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

// ============================================================================
// Fetch Implementation (HTTP Calls)
// ============================================================================
function buildQueryString(
  params: Record<string, string | number | boolean>
): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    query.append(key, String(value));
  });
  return query.toString();
}

function getHeaders(customHeaders?: Record<string, string>): HeadersInit {
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "text/event-stream",
  };

  const headers = { ...defaultHeaders, ...customHeaders };

  // Check if Authorization is explicitly set to empty string (for auth endpoints like login/signup)
  const skipAuth = customHeaders?.Authorization === "";

  // Add auth token if available, otherwise use dummy token (unless explicitly skipped)
  if (!skipAuth) {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("auth_token");
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      } else {
        // Dummy token for development
        headers.Authorization = `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTU5NTM4N2NkOGM5NjA1MTBmZjg1MjciLCJpYXQiOjE3Njc4OTIxNzYsImV4cCI6MTc2ODQ5Njk3Nn0.Wg-lyBqOhqith6LUvLbOOcw6fKBJ2NPLDZPsbavEHmo`;
      }
    } else {
      // Server-side: use dummy token
      headers.Authorization = `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTU5NTM4N2NkOGM5NjA1MTBmZjg1MjciLCJpYXQiOjE3Njc4OTIxNzYsImV4cCI6MTc2ODQ5Njk3Nn0.Wg-lyBqOhqith6LUvLbOOcw6fKBJ2NPLDZPsbavEHmo`;
    }
  } else {
    // Remove Authorization header if explicitly set to empty
    delete headers.Authorization;
  }

  return headers;
}

/**
 * Helper function to process SSE content (for wrapped responses)
 */
function processSSEContent(
  content: string,
  onProgress?: (data: any) => void,
  onEvent?: (event: string, data: any) => void
): ApiResponse<any> {
  const events: Array<{ event: string; data: any }> = [];
  const lines = content.split('\n');
  
  let currentEvent: { event?: string; data?: string } = {};
  
  for (const line of lines) {
    if (line.startsWith('event:')) {
      currentEvent.event = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      const dataLine = line.substring(5).trim();
      if (currentEvent.data) {
        currentEvent.data += '\n' + dataLine;
      } else {
        currentEvent.data = dataLine;
      }
    } else if (line.trim() === '' && currentEvent.event && currentEvent.data) {
      try {
        const parsedData = JSON.parse(currentEvent.data);
        events.push({
          event: currentEvent.event,
          data: parsedData
        });
        
        if (onEvent && currentEvent.event) {
          onEvent(currentEvent.event, parsedData);
        }
        
        if (currentEvent.event === 'progress' && onProgress) {
          onProgress(parsedData);
        }
      } catch (e) {
        // Skip invalid JSON
      }
      currentEvent = {};
    }
  }
  
  // Handle last event
  if (currentEvent.event && currentEvent.data) {
    try {
      const parsedData = JSON.parse(currentEvent.data);
      events.push({
        event: currentEvent.event,
        data: parsedData
      });
      
      if (onEvent && currentEvent.event) {
        onEvent(currentEvent.event, parsedData);
      }
      
      if (currentEvent.event === 'progress' && onProgress) {
        onProgress(parsedData);
      }
    } catch (e) {
      // Skip invalid JSON
    }
  }
  
  const completeEvent = events.find(e => e.event === 'complete') || events[events.length - 1];
  let responseData = completeEvent?.data;
  
  if (responseData?.data !== undefined) {
    responseData = responseData.data;
  }
  if (responseData && typeof responseData === 'object' && 'trip' in responseData) {
    responseData = responseData.trip;
  }
  
  return {
    success: true,
    data: responseData || completeEvent?.data,
    message: completeEvent?.data?.message,
  };
}

/**
 * Base fetch function - handles all HTTP requests
 * Reusable for any API endpoint
 */
export async function apiFetch<T = any>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const {
    method = "GET",
    headers: customHeaders,
    body,
    params,
    timeout = DEFAULT_TIMEOUT,
  } = config;

  // Build URL
  let url = `${API_BASE_URL}${endpoint}`;
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
      headers: getHeaders(customHeaders),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle streaming response or regular JSON
    let data: any = {};
    
    // Check if response is streaming (text/event-stream or application/x-ndjson)
    const contentType = response.headers.get("content-type") || "";
    
    if (contentType.includes("text/event-stream") || contentType.includes("application/x-ndjson")) {
      // For SSE streaming, parse the event stream
      let text = await response.text();
      
      // Check if response is wrapped in JSON with 'content' field
      try {
        const jsonResponse = JSON.parse(text);
        if (jsonResponse.content && typeof jsonResponse.content === 'string') {
          text = jsonResponse.content;
        }
      } catch {
        // Not JSON wrapped, use text as is
      }
      
      // Parse SSE format: event: <type>\ndata: <json>\n\n
      const events: Array<{ event: string; data: any }> = [];
      const lines = text.split('\n');
      
      let currentEvent: { event?: string; data?: string } = {};
      
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent.event = line.substring(6).trim();
        } else if (line.startsWith('data:')) {
          // Handle multi-line data (append if data already exists)
          const dataLine = line.substring(5).trim();
          if (currentEvent.data) {
            currentEvent.data += '\n' + dataLine;
          } else {
            currentEvent.data = dataLine;
          }
        } else if (line.trim() === '' && currentEvent.event && currentEvent.data) {
          // Empty line indicates end of event
          try {
            const parsedData = JSON.parse(currentEvent.data);
            events.push({
              event: currentEvent.event,
              data: parsedData
            });
          } catch (e) {
            // If parsing fails, still add the event with raw data
            events.push({
              event: currentEvent.event,
              data: currentEvent.data
            });
          }
          currentEvent = {};
        }
      }
      
      // Handle last event if no trailing newline
      if (currentEvent.event && currentEvent.data) {
        try {
          const parsedData = JSON.parse(currentEvent.data);
          events.push({
            event: currentEvent.event,
            data: parsedData
          });
        } catch (e) {
          events.push({
            event: currentEvent.event,
            data: currentEvent.data
          });
        }
      }
      
      // Find the 'complete' event or use the last event
      const completeEvent = events.find(e => e.event === 'complete') || events[events.length - 1];
      
      if (completeEvent) {
        data = completeEvent.data;
      } else if (events.length > 0) {
        // Fallback: use last event data
        data = events[events.length - 1].data;
      } else {
        // If no events parsed, try to parse as regular JSON
        try {
          data = JSON.parse(text);
        } catch {
          data = { content: text };
        }
      }
    } else {
      // Regular JSON response
      data = await response.json().catch(() => ({}));
    }

    if (!response.ok) {
      // Handle error response structure: { status: "error", message: "..." }
      const errorMessage = data.message || data.error || `HTTP ${response.status}`;
      throw new ApiException(
        response.status,
        data.code || data.status || "UNKNOWN_ERROR",
        errorMessage,
        data.details
      );
    }

    // Handle the new API response structure: { status, message, data: { trip: {...} } }
    // Extract the trip data if it exists in data.data.trip
    let responseData = data.data !== undefined ? data.data : data;
    
    // If the response has data.trip structure, extract it
    if (responseData && typeof responseData === 'object' && 'trip' in responseData) {
      responseData = responseData.trip;
    }

    return {
      success: true,
      data: responseData,
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
        message:
          error instanceof Error ? error.message : "Network error occurred",
      },
    };
  }
}

/**
 * Streaming fetch function for Server-Sent Events (SSE)
 * Processes events in real-time as they arrive
 */
export async function streamFetch(
  endpoint: string,
  config: RequestConfig & {
    onProgress?: (data: any) => void;
    onEvent?: (event: string, data: any) => void;
  } = {}
): Promise<ApiResponse<any>> {
  const {
    method = "POST",
    headers: customHeaders,
    body,
    params,
    timeout = 600000, // 10 minutes for streaming
    onProgress,
    onEvent,
  } = config;

  // Build URL
  let url = `${API_BASE_URL}${endpoint}`;
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
      headers: getHeaders(customHeaders),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiException(
        response.status,
        errorData.code || "UNKNOWN_ERROR",
        errorData.message || errorData.error || `HTTP ${response.status}`,
        errorData.details
      );
    }

    // Check if response is streaming
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream") && !contentType.includes("application/x-ndjson")) {
      // Not a stream, parse as regular JSON
      const data = await response.json().catch(() => ({}));
      
      // Check if response is wrapped in JSON with 'content' field containing SSE
      if (data.content && typeof data.content === 'string') {
        // Process the wrapped SSE content
        return processSSEContent(data.content, onProgress, onEvent);
      }
      
      return {
        success: true,
        data: data.data !== undefined ? data.data : data,
        message: data.message,
      };
    }

    // Process SSE stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalData: any = null;

    if (!reader) {
      throw new Error("Response body is not readable");
    }

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || "";

      let currentEvent: { event?: string; data?: string } = {};

      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent.event = line.substring(6).trim();
        } else if (line.startsWith("data:")) {
          const dataLine = line.substring(5).trim();
          if (currentEvent.data) {
            currentEvent.data += "\n" + dataLine;
          } else {
            currentEvent.data = dataLine;
          }
        } else if (line.trim() === "" && currentEvent.event && currentEvent.data) {
          // Empty line indicates end of event
          try {
            const parsedData = JSON.parse(currentEvent.data);
            
            // Call event callback
            if (onEvent && currentEvent.event) {
              onEvent(currentEvent.event, parsedData);
            }

            // Handle progress events
            if (currentEvent.event === "progress" && onProgress) {
              onProgress(parsedData);
            }

            // Handle complete event
            if (currentEvent.event === "complete") {
              finalData = parsedData;
            }
          } catch (e) {
            // Skip invalid JSON
          }
          currentEvent = {};
        }
      }
    }

    // Handle last event if buffer has content
    if (buffer.trim()) {
      const lines = buffer.split("\n");
      let currentEvent: { event?: string; data?: string } = {};
      
      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent.event = line.substring(6).trim();
        } else if (line.startsWith("data:")) {
          const dataLine = line.substring(5).trim();
          if (currentEvent.data) {
            currentEvent.data += "\n" + dataLine;
          } else {
            currentEvent.data = dataLine;
          }
        }
      }

      if (currentEvent.event && currentEvent.data) {
        try {
          const parsedData = JSON.parse(currentEvent.data);
          
          if (onEvent && currentEvent.event) {
            onEvent(currentEvent.event, parsedData);
          }

          if (currentEvent.event === "progress" && onProgress) {
            onProgress(parsedData);
          }

          if (currentEvent.event === "complete") {
            finalData = parsedData;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }

    // Extract trip data from final response
    let responseData = finalData?.data !== undefined ? finalData.data : finalData;
    if (responseData && typeof responseData === "object" && "trip" in responseData) {
      responseData = responseData.trip;
    }

    return {
      success: true,
      data: responseData || finalData,
      message: finalData?.message,
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

/**
 * Convenience functions for different HTTP methods
 * Reusable for any API endpoint
 */
export const fetchUtils = {
  get: <T = any>(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
    config?: Omit<RequestConfig, "method" | "params">
  ): Promise<ApiResponse<T>> => {
    return apiFetch<T>(endpoint, { ...config, method: "GET", params });
  },

  post: <T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<RequestConfig, "method" | "body">
  ): Promise<ApiResponse<T>> => {
    return apiFetch<T>(endpoint, { ...config, method: "POST", body });
  },

  put: <T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<RequestConfig, "method" | "body">
  ): Promise<ApiResponse<T>> => {
    return apiFetch<T>(endpoint, { ...config, method: "PUT", body });
  },

  patch: <T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<RequestConfig, "method" | "body">
  ): Promise<ApiResponse<T>> => {
    return apiFetch<T>(endpoint, { ...config, method: "PATCH", body });
  },

  delete: <T = any>(
    endpoint: string,
    config?: Omit<RequestConfig, "method">
  ): Promise<ApiResponse<T>> => {
    return apiFetch<T>(endpoint, { ...config, method: "DELETE" });
  },
};

// ============================================================================
// Routes Builder (Route Definitions)
// ============================================================================
export class RouteBuilder {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  path(path: string): string {
    return `${this.basePath}${path}`;
  }

  withId(id: string | number, suffix: string = ""): string {
    return `${this.basePath}/${id}${suffix}`;
  }

  withQuery(params: Record<string, string | number | boolean>): string {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      query.append(key, String(value));
    });
    return `${this.basePath}?${query.toString()}`;
  }
}

/**
 * Base Routes class - Extend this for each API module
 * Example:
 * class TripRoutes extends BaseRoutes {
 *   generate = () => this.path("/generate");
 *   byId = (id: string) => this.withId(id);
 * }
 */
export abstract class BaseRoutes {
  protected routeBuilder: RouteBuilder;

  constructor(basePath: string) {
    this.routeBuilder = new RouteBuilder(basePath);
  }

  protected path(path: string): string {
    return this.routeBuilder.path(path);
  }

  protected withId(id: string | number, suffix: string = ""): string {
    return this.routeBuilder.withId(id, suffix);
  }

  protected withQuery(params: Record<string, string | number | boolean>): string {
    return this.routeBuilder.withQuery(params);
  }
}

// ============================================================================
// Service Base Class (Business Logic)
// ============================================================================
/**
 * Base Service class - Extend this for each API module
 * Example:
 * class TripService extends BaseService<TripRoutes> {
 *   async generatePlan(preferences) {
 *     return this.post(this.routes.generate(), preferences);
 *   }
 * }
 */
export abstract class BaseService<TRoutes extends BaseRoutes> {
  protected routes: TRoutes;

  constructor(routes: TRoutes) {
    this.routes = routes;
  }

  protected async get<T>(
    route: string,
    params?: Record<string, string | number | boolean>
  ): Promise<ApiResponse<T>> {
    return fetchUtils.get<T>(route, params);
  }

  protected async post<T>(
    route: string,
    body?: any,
    config?: Omit<RequestConfig, "method" | "body">
  ): Promise<ApiResponse<T>> {
    return fetchUtils.post<T>(route, body, config);
  }

  protected async put<T>(
    route: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    return fetchUtils.put<T>(route, body);
  }

  protected async patch<T>(
    route: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    return fetchUtils.patch<T>(route, body);
  }

  protected async delete<T>(route: string): Promise<ApiResponse<T>> {
    return fetchUtils.delete<T>(route);
  }
}

