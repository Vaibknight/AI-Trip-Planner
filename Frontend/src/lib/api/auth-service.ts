import { BaseService } from "./core/api";
import { authRoutes } from "./routes";
import type { ApiResponse } from "./shared-types";

// ============================================================================
// Auth Types
// ============================================================================
export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

// Backend API Response Structure
interface BackendAuthResponse {
  status: "success" | "error";
  message: string;
  data: {
    user: {
      _id: string;
      name: string;
      email: string;
      role: string;
      preferences?: {
        budget?: string;
        travelStyle?: string;
      };
      createdAt: string;
      updatedAt: string;
      __v: number;
    };
    token: string;
  };
}

// Frontend Auth Response (transformed from backend)
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role?: string;
    preferences?: {
      budget?: string;
      travelStyle?: string;
    };
    avatar?: string;
  };
}

// ============================================================================
// Auth Service - Backend Integration
// ============================================================================
class AuthService extends BaseService<typeof authRoutes> {
  constructor() {
    super(authRoutes);
  }

  // Transform backend user structure to frontend structure
  private transformUser(backendUser: BackendAuthResponse["data"]["user"]): AuthResponse["user"] {
    return {
      id: backendUser._id,
      name: backendUser.name,
      email: backendUser.email,
      role: backendUser.role,
      preferences: backendUser.preferences,
    };
  }

  async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    try {
      // Make API call to backend
      // apiFetch already extracts data.data, so response.data will be { user, token }
      // Remove Authorization header for login (no token needed)
      const response = await this.post<BackendAuthResponse["data"]>(
        this.routes.login(),
        credentials,
        {
          headers: {
            Authorization: "", // Remove Authorization header for login
          },
        }
      );

      if (response.success && response.data) {
        const backendData = response.data;
        
        // Transform backend response to frontend format
        const authResponse: AuthResponse = {
          token: backendData.token,
          user: this.transformUser(backendData.user),
        };

        // Store token and user in localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem("auth_token", authResponse.token);
          localStorage.setItem("user", JSON.stringify(authResponse.user));
        }

        return {
          success: true,
          data: authResponse,
          message: response.message || "Login successful",
        };
      } else {
        return {
          success: false,
          error: response.error || {
            code: "LOGIN_FAILED",
            message: "Login failed. Please check your credentials.",
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: error instanceof Error ? error.message : "Network error occurred",
        },
      };
    }
  }

  async signup(userData: SignupRequest): Promise<ApiResponse<AuthResponse>> {
    try {
      // Make API call to backend
      // apiFetch already extracts data.data, so response.data will be { user, token }
      // Remove Authorization header for signup (no token needed)
      const response = await this.post<BackendAuthResponse["data"]>(
        this.routes.signup(),
        userData,
        {
          headers: {
            Authorization: "", // Remove Authorization header for signup
          },
        }
      );

      if (response.success && response.data) {
        const backendData = response.data;
        
        // Transform backend response to frontend format
        const authResponse: AuthResponse = {
          token: backendData.token,
          user: this.transformUser(backendData.user),
        };

        // Store token and user in localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem("auth_token", authResponse.token);
          localStorage.setItem("user", JSON.stringify(authResponse.user));
        }

        return {
          success: true,
          data: authResponse,
          message: response.message || "Signup successful",
        };
      } else {
        return {
          success: false,
          error: response.error || {
            code: "SIGNUP_FAILED",
            message: "Signup failed. Please try again.",
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: error instanceof Error ? error.message : "Network error occurred",
        },
      };
    }
  }

  async logout(): Promise<ApiResponse<void>> {
    try {
      // Make API call to backend (if endpoint exists)
      // Note: If logout endpoint doesn't exist, we can skip the API call
      try {
        await this.post<void>(this.routes.logout());
      } catch (error) {
        // If logout endpoint doesn't exist, continue with local cleanup
        console.log("Logout endpoint not available, clearing local storage only");
      }
    } catch (error) {
      // Continue with local cleanup even if API call fails
      console.error("Logout error:", error);
    } finally {
      // Always clear token from localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
      }
    }

    return {
      success: true,
      message: "Logout successful",
    };
  }

  async getCurrentUser(): Promise<ApiResponse<AuthResponse["user"]>> {
    try {
      // Make API call to backend to get current user
      // Handle both cases: user object directly or wrapped in { user: {...} }
      const response = await this.get<BackendAuthResponse["data"]["user"] | { user: BackendAuthResponse["data"]["user"] }>(
        this.routes.me()
      );

      if (response.success && response.data) {
        // Handle both response structures
        let userData: BackendAuthResponse["data"]["user"];
        if ("user" in response.data && response.data.user) {
          // Response is wrapped: { user: {...} }
          userData = response.data.user;
        } else if ("_id" in response.data) {
          // Response is user object directly
          userData = response.data as BackendAuthResponse["data"]["user"];
        } else {
          throw new Error("Invalid user data structure");
        }

        const transformedUser = this.transformUser(userData);
        
        // Update stored user
        if (typeof window !== "undefined") {
          localStorage.setItem("user", JSON.stringify(transformedUser));
        }

        return {
          success: true,
          data: transformedUser,
        };
      } else {
        // Token might be invalid, clear auth
        if (typeof window !== "undefined") {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("user");
        }

        return {
          success: false,
          error: response.error || {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        };
      }
    } catch (error) {
      // Network error or invalid token
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
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

  getStoredUser(): AuthResponse["user"] | null {
    if (typeof window === "undefined") return null;
    
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  getStoredToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("auth_token");
  }

  isAuthenticated(): boolean {
    return !!this.getStoredToken();
  }
}

export const authService = new AuthService();

