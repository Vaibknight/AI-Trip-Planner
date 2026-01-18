"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { TripData } from "@/lib/api/types";

// Fix for default marker icons in Next.js
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

interface MapBoundsProps {
  coordinates: Array<{ lat: number; lng: number }>;
}

function MapBounds({ coordinates }: MapBoundsProps) {
  const map = useMap();

  useEffect(() => {
    if (coordinates.length > 0 && L && map) {
      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coordinates, map]);

  return null;
}

interface TripMapProps {
  plan: TripData;
}

export default function TripMap({ plan }: TripMapProps) {
  // Load Leaflet CSS on mount
  useEffect(() => {
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
  }, []);

  // Extract coordinates from itinerary activities
  const locations = useMemo(() => {
    const coords: Array<{
      lat: number;
      lng: number;
      name: string;
      day: number;
      time?: string;
      type?: string;
    }> = [];

    if (plan.itinerary && Array.isArray(plan.itinerary)) {
      plan.itinerary.forEach((day) => {
        if (day.activities && Array.isArray(day.activities)) {
          day.activities.forEach((activity) => {
            if (
              activity.coordinates &&
              activity.coordinates.latitude &&
              activity.coordinates.longitude
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

    return coords;
  }, [plan.itinerary]);

  // Calculate center point for the map
  const center = useMemo(() => {
    if (locations.length === 0) {
      // Default to a common location if no coordinates
      return [22.5726, 88.3639]; // Kolkata coordinates
    }

    const avgLat =
      locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length;
    const avgLng =
      locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length;

    return [avgLat, avgLng];
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
      <div className="h-[500px] w-full rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
        <MapContainer
          center={center as [number, number]}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBounds coordinates={locations.map((loc) => ({ lat: loc.lat, lng: loc.lng }))} />
          {locations.map((location, index) => (
            <Marker
              key={index}
              position={[location.lat, location.lng]}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold text-gray-900">{location.name}</p>
                  {location.day && (
                    <p className="text-gray-600">Day {location.day}</p>
                  )}
                  {location.time && (
                    <p className="text-gray-600">Time: {location.time}</p>
                  )}
                  {location.type && (
                    <p className="text-gray-500 capitalize">{location.type}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

