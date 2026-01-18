"use client";

import { useState, useRef, useEffect } from "react";

interface DropdownOption {
  value: string | number;
  label: string;
}

interface DropdownProps {
  label: string;
  options: DropdownOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string | undefined;
  showError?: boolean;
}

export default function Dropdown({
  label,
  options,
  value,
  onChange,
  placeholder = "Select an option",
  required = false,
  disabled = false,
  error,
  showError = false,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3 text-left bg-white dark:bg-gray-800 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors flex items-center justify-between ${
          disabled
            ? "opacity-50 cursor-not-allowed border-gray-300 dark:border-gray-600"
            : showError && error
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 focus:ring-blue-500"
        }`}
      >
        <span
          className={
            selectedOption
              ? "text-gray-900 dark:text-gray-100"
              : "text-gray-500 dark:text-gray-400"
          }
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 text-left hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${
                value === option.value
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100"
                  : "text-gray-900 dark:text-gray-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {showError && error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}

