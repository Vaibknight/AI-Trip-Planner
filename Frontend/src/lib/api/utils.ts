import type { ApiResponse } from "./types";

/**
 * Helper function to handle API responses
 * Throws error if response is not successful
 */
export function handleApiResponse<T>(response: ApiResponse<T>): T {
  if (!response.success || !response.data) {
    throw new Error(
      response.error?.message || "An error occurred while processing your request"
    );
  }
  return response.data;
}

/**
 * Helper function to extract error message from API response
 */
export function getErrorMessage(response: ApiResponse): string {
  return response.error?.message || "An unexpected error occurred";
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("Failed to fetch"))
  );
}

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("timeout") || error.message.includes("TIMEOUT"))
  );
}



