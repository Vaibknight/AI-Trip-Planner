"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import type { TripData } from "@/lib/api/types";

interface TripMapCDNProps {
  plan: TripData;
}

export default function TripMapCDN({ plan }: TripMapCDNProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const mapInstanceRef = useRef<any>(null);

  // Extract coordinates from itinerary activities and HTML fallback
  const locations = useMemo(() => {
    const coords: Array<{
      lat: number;
      lng: number;
      name: string;
      day: number;
      time?: string;
      type?: string;
    }> = [];

    // First, try to extract from itinerary array
    if (plan?.itinerary && Array.isArray(plan.itinerary)) {
      plan.itinerary.forEach((day) => {
        if (day.activities && Array.isArray(day.activities)) {
          day.activities.forEach((activity) => {
            if (
              activity.coordinates &&
              typeof activity.coordinates.latitude === 'number' &&
              typeof activity.coordinates.longitude === 'number'
            ) {
              coords.push({
                lat: activity.coordinates.latitude,
                lng: activity.coordinates.longitude,
                name: activity.name || "Activity",
                day: day.day || 0,
                time: activity.startTime || "",
                type: activity.type || "activity",
              });
            }
          });
        }
      });
    }

    // If no coordinates found in itinerary array, extract from itineraryHtml
    if (coords.length === 0 && plan?.itineraryHtml) {
      console.log("No coordinates in itinerary array, extracting from HTML...");
      
      // Parse HTML to extract coordinates
      const parser = new DOMParser();
      const doc = parser.parseFromString(plan.itineraryHtml, 'text/html');
      const listItems = doc.querySelectorAll('li[data-lat][data-lon]');
      
      listItems.forEach((li, index) => {
        const lat = parseFloat(li.getAttribute('data-lat') || '');
        const lon = parseFloat(li.getAttribute('data-lon') || '');
        const text = li.textContent?.trim() || '';
        
        if (!isNaN(lat) && !isNaN(lon)) {
          // Extract time and activity name from text (format: "08:00 — Activity Name")
          const timeMatch = text.match(/^(\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : '';
          const name = text.replace(/^\d{2}:\d{2}\s*—\s*/, '') || 'Activity';
          
          // Try to determine day from the HTML structure
          let day = 1;
          const dayHeader = li.closest('ul')?.previousElementSibling;
          if (dayHeader && dayHeader.tagName === 'H2') {
            const dayMatch = dayHeader.textContent?.match(/Day\s+(\d+)/i);
            if (dayMatch) {
              day = parseInt(dayMatch[1], 10);
            }
          }
          
          coords.push({
            lat,
            lng: lon,
            name,
            day,
            time,
            type: 'activity',
          });
        }
      });
      
      console.log(`Extracted ${coords.length} locations from HTML`);
    }

    console.log(`=== Total locations extracted: ${coords.length} ===`, coords);
    return coords;
  }, [plan]);

  useEffect(() => {
    if (locations.length === 0) {
      console.log("No locations found, skipping map initialization");
      return;
    }

    if (!mapRef.current) {
      console.log("Map ref not available yet");
      return;
    }

    console.log("Initializing map with", locations.length, "locations");

    const loadMap = async () => {
      try {
        // Load Leaflet CSS
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
          link.crossOrigin = "";
          document.head.appendChild(link);
          console.log("Leaflet CSS loaded");
        }

        // Load Leaflet JS from CDN
        if (!(window as any).L) {
          console.log("Loading Leaflet JS from CDN...");
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
            script.crossOrigin = "";
            script.onload = () => {
              console.log("Leaflet JS loaded successfully");
              resolve();
            };
            script.onerror = () => {
              console.error("Failed to load Leaflet JS");
              reject(new Error("Failed to load Leaflet"));
            };
            document.head.appendChild(script);
          });
        }

        const L = (window as any).L;
        if (!L) {
          throw new Error("Leaflet not loaded");
        }

        console.log("Leaflet library available, creating map...");

        // Calculate center and bounds
        const avgLat = locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length;
        const avgLng = locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length;

        console.log("Map center:", avgLat, avgLng);

        // Initialize map
        const map = L.map(mapRef.current!, {
          center: [avgLat, avgLng],
          zoom: 12,
        });

        // Add tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        console.log("Tile layer added");

        // Add markers
        const bounds = L.latLngBounds([]);
        locations.forEach((location, index) => {
          console.log(`Adding marker ${index + 1}:`, location.name, location.lat, location.lng);
          const marker = L.marker([location.lat, location.lng]).addTo(map);
          
          let popupContent = `<div style="font-size: 14px;">
            <strong>${location.name}</strong><br/>`;
          if (location.day) {
            popupContent += `Day ${location.day}<br/>`;
          }
          if (location.time) {
            popupContent += `Time: ${location.time}<br/>`;
          }
          if (location.type) {
            popupContent += `<span style="text-transform: capitalize;">${location.type}</span>`;
          }
          popupContent += `</div>`;
          
          marker.bindPopup(popupContent);
          bounds.extend([location.lat, location.lng]);
        });

        console.log("All markers added, fitting bounds...");

        // Fit map to bounds
        if (locations.length > 0) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }

        mapInstanceRef.current = map;
        setIsLoaded(true);
        console.log("Map initialized successfully");
      } catch (error) {
        console.error("Error loading map:", error);
        setIsLoaded(true); // Set loaded even on error to show the container
      }
    };

    loadMap();

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [locations]);

  if (locations.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          🗺️ Trip Map
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          No location coordinates available for this trip.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        🗺️ Trip Map
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Showing {locations.length} location{locations.length !== 1 ? "s" : ""} from your itinerary
      </p>
      <div 
        ref={mapRef}
        className="h-[500px] w-full rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600"
        style={{ minHeight: "500px" }}
      >
        {!isLoaded && (
          <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
            <p className="text-gray-600 dark:text-gray-400">Loading map...</p>
          </div>
        )}
      </div>
    </div>
  );
}

