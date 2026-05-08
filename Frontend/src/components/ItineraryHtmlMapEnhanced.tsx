"use client";

import { useLayoutEffect, useRef } from "react";
import {
  cleanActivityQuery,
  normalizePlaceKey,
} from "@/lib/itineraryPlaces";

interface ItineraryHtmlMapEnhancedProps {
  html: string;
  coordsByKey: Record<string, { latitude: number; longitude: number }>;
  className?: string;
}

/**
 * Renders itinerary HTML and appends "View on map" when coordinates exist (after async geocode).
 */
export default function ItineraryHtmlMapEnhanced({
  html,
  coordsByKey,
  className,
}: ItineraryHtmlMapEnhancedProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !html) return;

    root.innerHTML = html;
    const items = root.querySelectorAll("li");
    items.forEach((li) => {
      const text = li.textContent?.trim() || "";
      const m = text.match(/^\d{2}:\d{2}\s*[—\-]\s*(.+)$/);
      if (!m) return;
      const cleaned = cleanActivityQuery(m[1]);
      const key = normalizePlaceKey(cleaned);
      if (!coordsByKey[key]) return;
      if (li.querySelector("[data-trip-map-link]")) return;

      const wrap = document.createElement("span");
      wrap.setAttribute("data-trip-map-link", "1");
      wrap.className = "ml-2 inline-flex items-center gap-1";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "View on map";
      btn.className =
        "text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline-offset-2 hover:underline";
      btn.addEventListener("click", () => {
        window.dispatchEvent(
          new CustomEvent("trip-map-focus", { detail: { key } })
        );
        document
          .getElementById("trip-map-anchor")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      wrap.appendChild(btn);
      li.appendChild(wrap);
    });
  }, [html, coordsByKey]);

  return (
    <div
      ref={ref}
      className={className}
      suppressHydrationWarning
    />
  );
}
