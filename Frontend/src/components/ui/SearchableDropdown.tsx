"use client";

import { useState, useRef, useEffect } from "react";

interface DropdownOption {
  value: string | number;
  label: string;
}

interface SearchableDropdownProps {
  label: string;
  options: DropdownOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  searchPlaceholder?: string;
  error?: string | undefined;
  showError?: boolean;
}

export default function SearchableDropdown({
  label,
  options,
  value,
  onChange,
  placeholder = "Select an option",
  required = false,
  disabled = false,
  searchPlaceholder = "Search...",
  error,
  showError = false,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Filter options based on search query
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset search and highlighted index when dropdown opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setHighlightedIndex(-1);
      // Focus search input when dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        onChange(filteredOptions[highlightedIndex].value);
        setIsOpen(false);
        setSearchQuery("");
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredOptions, highlightedIndex, onChange]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionsRef.current) {
      const optionElement = optionsRef.current.children[highlightedIndex] as HTMLElement;
      if (optionElement) {
        optionElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (optionValue: string | number) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  // Highlight matching text in option label
  const highlightText = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark
          key={index}
          className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

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
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(-1);
              }}
              placeholder={searchPlaceholder}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Options List */}
          <div
            ref={optionsRef}
            className="max-h-60 overflow-auto"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full px-4 py-2 text-left hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${
                    value === option.value
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100"
                      : index === highlightedIndex
                      ? "bg-blue-50 dark:bg-gray-700"
                      : "text-gray-900 dark:text-gray-100"
                  }`}
                >
                  {highlightText(option.label, searchQuery)}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 text-sm">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
      {showError && error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}

