"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";

interface SignupFormProps {
  onSwitchToLogin: () => void;
}

export default function SignupForm({ onSwitchToLogin }: SignupFormProps) {
  const { signup, isLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  // Name validation
  const validateName = (nameValue: string): string | undefined => {
    if (!nameValue.trim()) {
      return "Name is required";
    }
    if (nameValue.trim().length < 2) {
      return "Name must be at least 2 characters";
    }
    if (nameValue.trim().length > 50) {
      return "Name must be less than 50 characters";
    }
    return undefined;
  };

  // Email validation
  const validateEmail = (emailValue: string): string | undefined => {
    if (!emailValue.trim()) {
      return "Email is required";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      return "Please enter a valid email address";
    }
    return undefined;
  };

  // Password validation
  const validatePassword = (passwordValue: string): string | undefined => {
    if (!passwordValue) {
      return "Password is required";
    }
    if (passwordValue.length < 6) {
      return "Password must be at least 6 characters";
    }
    if (passwordValue.length > 100) {
      return "Password must be less than 100 characters";
    }
    return undefined;
  };

  // Confirm password validation
  const validateConfirmPassword = (
    confirmPasswordValue: string,
    passwordValue: string
  ): string | undefined => {
    if (!confirmPasswordValue) {
      return "Please confirm your password";
    }
    if (confirmPasswordValue !== passwordValue) {
      return "Passwords do not match";
    }
    return undefined;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    // Clear error only if field was previously invalid and now valid
    if (fieldErrors.name) {
      const error = validateName(value);
      setFieldErrors((prev) => ({
        ...prev,
        name: error || undefined,
      }));
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    // Clear error only if field was previously invalid and now valid
    if (fieldErrors.email) {
      const error = validateEmail(value);
      setFieldErrors((prev) => ({
        ...prev,
        email: error || undefined,
      }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    // Clear error only if field was previously invalid and now valid
    if (fieldErrors.password) {
      const error = validatePassword(value);
      setFieldErrors((prev) => ({
        ...prev,
        password: error || undefined,
      }));
    }
    // Also clear confirm password error if passwords now match
    if (fieldErrors.confirmPassword && confirmPassword === value) {
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: undefined,
      }));
    }
  };

  const handleConfirmPasswordChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setConfirmPassword(value);
    // Clear error only if field was previously invalid and now valid
    if (fieldErrors.confirmPassword) {
      const error = validateConfirmPassword(value, password);
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: error || undefined,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate all fields
    const nameError = validateName(name);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(confirmPassword, password);

    setFieldErrors({
      name: nameError,
      email: emailError,
      password: passwordError,
      confirmPassword: confirmPasswordError,
    });

    if (nameError || emailError || passwordError || confirmPasswordError) {
      // Show toast with validation errors
      const errorMessages = [
        nameError,
        emailError,
        passwordError,
        confirmPasswordError,
      ].filter(Boolean);
      if (errorMessages.length > 0) {
        toast.error(errorMessages.join(". "));
      } else {
        toast.error("Please fill in all required fields correctly");
      }
      return;
    }

    const result = await signup(name, email, password);
    if (!result.success) {
      const errorMessage = typeof result.error === "string" 
        ? result.error 
        : result.error || "Signup failed";
      setError(errorMessage);
      toast.error(errorMessage);
    } else {
      toast.success("Account created successfully! Redirecting...");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Create Account
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Start planning your perfect trips today
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="name"
              className={`block text-sm font-medium mb-2 transition-colors ${
                fieldErrors.name
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="John Doe"
              minLength={2}
              maxLength={50}
              className="peer w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                invalid:border-red-500 invalid:dark:border-red-500 invalid:focus:ring-red-500 invalid:focus:border-red-500
                valid:border-green-500 valid:dark:border-green-500 valid:focus:ring-green-500
                hover:border-blue-500 dark:hover:border-blue-400 
                focus:ring-blue-500 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            />
            <p className={`mt-1 text-sm flex items-center gap-1 min-h-[20px] ${
              fieldErrors.name ? "text-red-600 dark:text-red-400 visible" : "invisible"
            }`}>
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{fieldErrors.name || "Name must be between 2 and 50 characters"}</span>
            </p>
          </div>

          <div>
            <label
              htmlFor="signup-email"
              className={`block text-sm font-medium mb-2 transition-colors ${
                fieldErrors.email
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              Email Address
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="you@example.com"
              pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
              className="peer w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                invalid:border-red-500 invalid:dark:border-red-500 invalid:focus:ring-red-500 invalid:focus:border-red-500
                valid:border-green-500 valid:dark:border-green-500 valid:focus:ring-green-500
                hover:border-blue-500 dark:hover:border-blue-400 
                focus:ring-blue-500 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            />
            <p className={`mt-1 text-sm flex items-center gap-1 min-h-[20px] ${
              fieldErrors.email ? "text-red-600 dark:text-red-400 visible" : "invisible"
            }`}>
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{fieldErrors.email || "Please enter a valid email address"}</span>
            </p>
          </div>

          <div>
            <label
              htmlFor="signup-password"
              className={`block text-sm font-medium mb-2 transition-colors ${
                fieldErrors.password
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              Password
            </label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={handlePasswordChange}
                placeholder="At least 6 characters"
                minLength={6}
                maxLength={100}
                className="peer w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-12
                  invalid:border-red-500 invalid:dark:border-red-500 invalid:focus:ring-red-500 invalid:focus:border-red-500
                  valid:border-green-500 valid:dark:border-green-500 valid:focus:ring-green-500
                  hover:border-blue-500 dark:hover:border-blue-400 
                  focus:ring-blue-500 focus:border-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                disabled={isLoading}
              >
                {showPassword ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
            <p className={`mt-1 text-sm flex items-center gap-1 min-h-[20px] ${
              fieldErrors.password ? "text-red-600 dark:text-red-400 visible" : "invisible"
            }`}>
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{fieldErrors.password || "Password must be at least 6 characters"}</span>
            </p>
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className={`block text-sm font-medium mb-2 transition-colors ${
                fieldErrors.confirmPassword
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                placeholder="Re-enter your password"
                minLength={6}
                className={`peer w-full px-4 py-3 bg-white dark:bg-gray-700 border rounded-lg shadow-sm focus:outline-none focus:ring-2 transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-12 ${
                  fieldErrors.confirmPassword
                    ? "border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500 invalid:border-red-500 invalid:dark:border-red-500"
                    : "border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 focus:ring-blue-500 focus:border-transparent"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
            <p className={`mt-1 text-sm flex items-center gap-1 min-h-[20px] ${
              fieldErrors.confirmPassword
                ? "text-red-600 dark:text-red-400 visible"
                : "invisible"
            }`}>
              {fieldErrors.confirmPassword && (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{fieldErrors.confirmPassword}</span>
                </>
              )}
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                <span>Creating account...</span>
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{" "}
            <button
              onClick={onSwitchToLogin}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              disabled={isLoading}
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

