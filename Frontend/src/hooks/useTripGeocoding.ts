"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TripData } from "@/lib/api/types";
import { apiClient } from "@/lib/api/client";
import {
  applyCoordsToPlan,
  extractPlacesFromPlan,
  normalizePlaceKey,
  splitPlacesByPriority,
  tripPlaceContext,
  type ExtractedPlace,
} from "@/lib/itineraryPlaces";

export interface MapPin {
  key: string;
  query: string;
  label: string;
  lat: number;
  lng: number;
  day?: number;
  time?: string;
}

export type GeocodeUiStatus = "idle" | "loading" | "ready" | "error";

export interface GeocodeBatchMeta {
  durationMs: number;
  uniqueCount: number;
  concurrency: number;
  mongoPrefetchHits: number;
}

/** Nominatim policy ~1 req/s; parallel workers still serialize HTTP — allow long batches */
export const GEOCODE_BATCH_TIMEOUT_MS = 180_000;

function planFingerprint(plan: TripData | null | undefined): string {
  if (!plan) return "";
  return [
    plan.destination ?? "",
    String(plan.itineraryHtml?.length ?? 0),
    plan.itinerary?.map((d) => d.activities?.length).join("-") ?? "",
  ].join("|");
}

function mergeResultCoords(
  prev: Record<string, { latitude: number; longitude: number }>,
  results: Array<{
    place: string;
    coordinates: { latitude: number; longitude: number } | null;
  }>
): Record<string, { latitude: number; longitude: number }> {
  const next = { ...prev };
  for (const r of results) {
    if (r.coordinates) {
      next[normalizePlaceKey(r.place)] = r.coordinates;
    }
  }
  return next;
}

function buildPins(
  places: ExtractedPlace[],
  byKey: Record<string, { latitude: number; longitude: number }>
): MapPin[] {
  const pins: MapPin[] = [];
  for (const ep of places) {
    const c = byKey[ep.key];
    if (c) {
      pins.push({
        key: ep.key,
        query: ep.query,
        label: ep.label,
        lat: c.latitude,
        lng: c.longitude,
        day: ep.day,
        time: ep.time,
      });
    }
  }
  return pins;
}

type BatchPayload = {
  results: Array<{
    place: string;
    coordinates: { latitude: number; longitude: number } | null;
  }>;
  placeContext?: { city: string | null; country: string | null };
  meta?: GeocodeBatchMeta;
};

/**
 * Two-wave geocoding: priority landmarks/anchors first, then meals and other stops.
 * Geocoding runs only after loadMap() → POST /api/maps/geocode/batch.
 */
export function useTripGeocoding(plan: TripData | null | undefined) {
  const [status, setStatus] = useState<GeocodeUiStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [coordsByKey, setCoordsByKey] = useState<
    Record<string, { latitude: number; longitude: number }>
  >({});
  const [mapPins, setMapPins] = useState<MapPin[]>([]);
  const [extracted, setExtracted] = useState<ExtractedPlace[]>([]);
  const [mapSessionActive, setMapSessionActive] = useState(false);
  const [lazyGeocoding, setLazyGeocoding] = useState(false);
  const [geocodeMeta, setGeocodeMeta] = useState<GeocodeBatchMeta[]>([]);

  const fp = planFingerprint(plan);

  useEffect(() => {
    if (!plan) {
      setExtracted([]);
      setCoordsByKey({});
      setMapPins([]);
      setStatus("idle");
      setErrorMessage(null);
      setMapSessionActive(false);
      setLazyGeocoding(false);
      setGeocodeMeta([]);
      return;
    }
    setExtracted(extractPlacesFromPlan(plan));
    setCoordsByKey({});
    setMapPins([]);
    setStatus("idle");
    setErrorMessage(null);
    setMapSessionActive(false);
    setLazyGeocoding(false);
    setGeocodeMeta([]);
  }, [plan, fp]);

  const planWithCoords = useMemo(
    () => (plan ? applyCoordsToPlan(plan, coordsByKey) : null),
    [plan, coordsByKey]
  );

  const loadMap = useCallback(async () => {
    if (!plan) return;
    const allPlaces = extractPlacesFromPlan(plan);
    if (allPlaces.length === 0) return;

    setMapSessionActive(true);
    setStatus("loading");
    setErrorMessage(null);
    setCoordsByKey({});
    setMapPins([]);
    setGeocodeMeta([]);
    setLazyGeocoding(false);

    const { city, country } = tripPlaceContext(plan);
    const bodyBase = {
      city: city || undefined,
      country: country || undefined,
    };

    const postBatch = (places: string[]) =>
      apiClient.post<BatchPayload>(
        "/maps/geocode/batch",
        {
          places,
          ...bodyBase,
        },
        {
          timeout: GEOCODE_BATCH_TIMEOUT_MS,
        }
      );

    const { priority, deferred } = splitPlacesByPriority(allPlaces);

    let coordsAccumulator: Record<
      string,
      { latitude: number; longitude: number }
    > = {};

    try {
      console.time("tripMap:geocodeBatch:wave1");
      let res1;
      try {
        res1 = await postBatch(priority.map((p) => p.query));
      } finally {
        console.timeEnd("tripMap:geocodeBatch:wave1");
      }

      if (!res1.success || !res1.data?.results) {
        throw new Error(
          (res1.success === false && res1.error?.message) || "Geocoding failed"
        );
      }

      const meta1 = res1.data.meta;
      if (meta1) {
        setGeocodeMeta((m) => [...m, meta1]);
        console.info("tripMap:geocodeBatch wave1 meta", meta1);
      }

      coordsAccumulator = mergeResultCoords({}, res1.data.results);
      setCoordsByKey(coordsAccumulator);
      setMapPins(buildPins(allPlaces, coordsAccumulator));
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setErrorMessage(
        e instanceof Error ? e.message : "Could not load map locations"
      );
      setMapPins([]);
      setCoordsByKey({});
      return;
    }

    if (deferred.length === 0) {
      return;
    }

    setLazyGeocoding(true);
    console.time("tripMap:geocodeBatch:wave2");
    let res2:
      | Awaited<ReturnType<typeof postBatch>>
      | undefined;
    try {
      res2 = await postBatch(deferred.map((p) => p.query));
    } catch (w2) {
      console.warn("tripMap: wave2 request failed", w2);
    } finally {
      console.timeEnd("tripMap:geocodeBatch:wave2");
      setLazyGeocoding(false);
    }

    if (res2?.success && res2.data?.results) {
      const meta2 = res2.data.meta;
      if (meta2) {
        setGeocodeMeta((m) => [...m, meta2]);
        console.info("tripMap:geocodeBatch wave2 meta", meta2);
      }
      coordsAccumulator = mergeResultCoords(
        coordsAccumulator,
        res2.data.results
      );
      setCoordsByKey(coordsAccumulator);
      setMapPins(buildPins(allPlaces, coordsAccumulator));
    } else if (res2) {
      console.warn(
        "tripMap: wave2 geocode incomplete",
        res2.success === false ? res2.error : undefined
      );
    }
  }, [plan, fp]);

  const hasExtractedPlaces = extracted.length > 0;

  return {
    status,
    errorMessage,
    coordsByKey,
    mapPins,
    extractedPlaces: extracted,
    hasExtractedPlaces,
    mapSessionActive,
    lazyGeocoding,
    geocodeMeta,
    planWithCoords,
    loadMap,
  };
}
