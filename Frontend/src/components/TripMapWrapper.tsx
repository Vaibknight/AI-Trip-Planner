"use client";

import { useEffect, useState } from "react";
import type { TripData } from "@/lib/api/types";

interface TripMapWrapperProps {
  plan: TripData;
}

export default function TripMapWrapper({ plan }: TripMapWrapperProps) {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<{ plan: TripData }> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMap = async () => {
      try {
        // Load Leaflet CSS first
        if (typeof window !== "undefined") {
          const existingLink = document.querySelector('link[href*="leaflet.css"]');
          
          if (!existingLink) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
            link.crossOrigin = "";
            document.head.appendChild(link);
          }
        }

        // Dynamically import the TripMap component
        const TripMapModule = await import("./TripMap");
        setMapComponent(() => TripMapModule.default);
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading map component:", error);
        setIsLoading(false);
      }
    };

    loadMap();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          🗺️ Trip Map
        </h3>
        <div className="h-[500px] w-full rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <p className="text-gray-600 dark:text-gray-400">Loading map...</p>
        </div>
      </div>
    );
  }

  if (!MapComponent) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          🗺️ Trip Map
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Failed to load map. Please refresh the page.
        </p>
      </div>
    );
  }

  return <MapComponent plan={plan} />;
}

