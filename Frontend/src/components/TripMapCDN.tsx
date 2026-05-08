"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPin, GeocodeUiStatus } from "@/hooks/useTripGeocoding";

interface TripMapCDNProps {
  pins: MapPin[];
  status: GeocodeUiStatus;
  errorMessage?: string | null;
  /** Second batch (meals, etc.) still resolving */
  lazyGeocoding?: boolean;
  /** Hide outer card + title (parent shows header) */
  embedded?: boolean;
  onRetry?: () => void;
}

export default function TripMapCDN({
  pins,
  status,
  errorMessage,
  lazyGeocoding = false,
  embedded = false,
  onRetry,
}: TripMapCDNProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    const onFocus = (ev: Event) => {
      const detail = (ev as CustomEvent<{ key: string }>).detail;
      if (!detail?.key) return;
      const marker = markersRef.current.get(detail.key);
      const map = mapInstanceRef.current;
      if (marker && map) {
        marker.openPopup();
        map.setView(marker.getLatLng(), Math.max(map.getZoom(), 13), {
          animate: true,
        });
      }
    };
    window.addEventListener("trip-map-focus", onFocus as EventListener);
    return () =>
      window.removeEventListener("trip-map-focus", onFocus as EventListener);
  }, []);

  useEffect(() => {
    if (pins.length === 0 || status !== "ready") {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markersRef.current.clear();
      setLeafletReady(false);
      return;
    }

    if (!mapRef.current) return;

    console.time("tripMap:leafletUpdate");

    const syncMarkers = async () => {
      try {
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          link.integrity =
            "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
          link.crossOrigin = "";
          document.head.appendChild(link);
        }

        if (!(window as any).L) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            script.integrity =
              "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
            script.crossOrigin = "";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Leaflet"));
            document.head.appendChild(script);
          });
        }

        const L = (window as any).L;
        if (!L || !mapRef.current) {
          throw new Error("Leaflet not available");
        }

        const pinKeys = new Set(pins.map((p) => p.key));

        for (const [key, marker] of markersRef.current) {
          if (!pinKeys.has(key)) {
            marker.remove();
            markersRef.current.delete(key);
          }
        }

        let map = mapInstanceRef.current;

        if (!map) {
          const avgLat =
            pins.reduce((s, p) => s + p.lat, 0) / Math.max(pins.length, 1);
          const avgLng =
            pins.reduce((s, p) => s + p.lng, 0) / Math.max(pins.length, 1);

          map = L.map(mapRef.current, {
            center: [avgLat, avgLng],
            zoom: 11,
          });

          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          }).addTo(map);

          mapInstanceRef.current = map;
        }

        for (const loc of pins) {
          if (markersRef.current.has(loc.key)) continue;

          const marker = L.marker([loc.lat, loc.lng]).addTo(map);
          let popup = `<div style="font-size:14px"><strong>${escapeHtml(
            loc.label
          )}</strong><br/>`;
          if (loc.day) popup += `Day ${loc.day}<br/>`;
          if (loc.time) popup += `${loc.time}<br/>`;
          popup += `</div>`;
          marker.bindPopup(popup);
          markersRef.current.set(loc.key, marker);
        }

        const bounds = L.latLngBounds([]);
        pins.forEach((loc) => bounds.extend([loc.lat, loc.lng]));
        if (pins.length > 0 && map) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }

        setLeafletReady(true);
        console.timeEnd("tripMap:leafletUpdate");
      } catch (e) {
        console.timeEnd("tripMap:leafletUpdate");
        console.error("Trip map error:", e);
      }
    };

    void syncMarkers();
  }, [pins, status]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markersRef.current.clear();
    };
  }, []);

  const showLoading =
    status === "loading" ||
    (status === "ready" && pins.length > 0 && !leafletReady);

  const shellClass = embedded
    ? "mt-4"
    : "bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 scroll-mt-4";

  return (
    <div className={shellClass} id={embedded ? undefined : "trip-map-anchor"}>
      {!embedded && (
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          🗺️ Trip Map
        </h3>
      )}

      {status === "loading" && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Loading priority stops on the map…
        </p>
      )}

      {lazyGeocoding && status === "ready" && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Adding more itinerary stops in the background…
        </p>
      )}

      {status === "error" && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Map could not be loaded: {errorMessage || "Unknown error"}. Your
            itinerary is still available below.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/40"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {status === "ready" && pins.length === 0 && !lazyGeocoding && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          No mappable places were resolved for this trip. Try opening a place
          from a major city or landmark name.
        </p>
      )}

      {status === "ready" && pins.length > 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Showing {pins.length} location{pins.length !== 1 ? "s" : ""} from your
          itinerary
        </p>
      )}

      {(pins.length > 0 || status === "loading") && (
        <div
          ref={mapRef}
          className="h-[500px] w-full rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
          style={{ minHeight: "500px" }}
        >
          {showLoading && (
            <div className="h-full w-full flex items-center justify-center">
              <p className="text-gray-600 dark:text-gray-400">
                {status === "loading"
                  ? "Loading map data…"
                  : "Initializing map…"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
