import type { TripData } from "@/lib/api/types";
import {
  normalizePlaceForGeocode,
  shouldSkipGeocodeQuery,
} from "@/lib/placeNormalization";

/** Normalize place key for matching batch geocode results */
export function normalizePlaceKey(query: string): string {
  return query.trim().toLowerCase();
}

/** Align with backend — send POI / landmark names to batch geocode, not raw AI sentences */
export function cleanActivityQuery(raw: string): string {
  return normalizePlaceForGeocode(raw);
}

export interface ExtractedPlace {
  key: string;
  query: string;
  label: string;
  day?: number;
  time?: string;
}

const MAX_PLACES = 40;

/** First geocode wave: at most this many priority stops (then lazy-load the rest). */
export const PRIORITY_GEOCODE_WAVE_MAX = 8;

/**
 * Unique place queries from structured itinerary + HTML list items for geocoding.
 */
export function extractPlacesFromPlan(plan: TripData): ExtractedPlace[] {
  const seen = new Set<string>();
  const out: ExtractedPlace[] = [];

  const push = (rawQuery: string, label: string, day?: number, time?: string) => {
    const cleaned = cleanActivityQuery(rawQuery);
    if (cleaned.length < 2) return;
    if (shouldSkipGeocodeQuery(cleaned)) return;
    if (/^(check-in|check-out|explore|visit|stroll|nightlife)$/i.test(cleaned)) return;
    const key = normalizePlaceKey(cleaned);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, query: cleaned, label: label || cleaned, day, time });
  };

  for (const day of plan.itinerary || []) {
    for (const act of day.activities || []) {
      const raw = (act.name || "").trim();
      if (!raw) continue;
      push(raw, raw, day.day, act.startTime || act.time);
    }
  }

  if (plan.itineraryHtml) {
    const re = /<li[^>]*>(\d{2}:\d{2})\s*[—\-]\s*([^<]+)<\/li>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(plan.itineraryHtml)) !== null) {
      const time = m[1];
      const text = m[2].trim();
      push(text, text, undefined, time);
      if (out.length >= MAX_PLACES) break;
    }
  }

  return out.slice(0, MAX_PLACES);
}

export function tripPlaceContext(plan: TripData): { city: string; country: string } {
  const dest = plan.destinations?.[0];
  const city =
    dest?.city ||
    (plan.destination ? plan.destination.split(",")[0]?.trim() : "") ||
    "";
  const country = dest?.country || "";
  return { city, country };
}

/** Meals, hotel logistics, generic exploration — geocode in a second wave */
function isDeferredPlace(ep: ExtractedPlace): boolean {
  const q = ep.query.toLowerCase();
  if (
    /^(breakfast|brunch|lunch|dinner|supper|coffee|tea|snack)\b/i.test(q) ||
    /\b(at|@)\s+(breakfast|brunch|lunch|dinner)\b/i.test(q)
  ) {
    return true;
  }
  if (
    /check-in|check-out|arrival|departure|^hotel\b|\baccommodation\b|\bfree (time|day)\b|\brest day\b/i.test(
      q
    )
  ) {
    return true;
  }
  if (/^explore\s+(the\s+)?(city|area|neighborhood|locally)\s*$/i.test(q.trim())) {
    return true;
  }
  return false;
}

/** Attractions, landmarks, transport hubs — first geocode wave */
function isPriorityLandmark(ep: ExtractedPlace): boolean {
  const q = ep.query.toLowerCase();
  if (isDeferredPlace(ep)) return false;
  if (
    /museum|temple|monument|palace|fort|national park|\bpark\b|beach|cathedral|mosque|shrine|synagogue|tower|bridge|\blake\b|\bgarden\b|castle|zoo|aquarium|gallery|heritage|viewpoint|waterfall|canyon|volcano|battlefield|memorial|historic|landmark|square|bazaar|\bmarket\b|shopping district/i.test(
      q
    )
  ) {
    return true;
  }
  if (/(airport|terminal|railway station|\bstation\b)/i.test(q)) return true;
  return false;
}

/**
 * First wave: landmarks / anchors; second wave: meals and other stops (lazy).
 * Also pins the first structured activity per day as an anchor when not deferred.
 */
export function splitPlacesByPriority(places: ExtractedPlace[]): {
  priority: ExtractedPlace[];
  deferred: ExtractedPlace[];
} {
  if (places.length === 0) return { priority: [], deferred: [] };

  const firstOfDay = new Set<string>();
  const seenDay = new Set<number>();
  for (const p of places) {
    if (p.day != null && !seenDay.has(p.day)) {
      seenDay.add(p.day);
      firstOfDay.add(p.key);
    }
  }

  const priorityKeys = new Set<string>();
  const deferredList: ExtractedPlace[] = [];

  for (const ep of places) {
    if (isDeferredPlace(ep)) {
      deferredList.push(ep);
      continue;
    }
    if (isPriorityLandmark(ep) || firstOfDay.has(ep.key)) {
      priorityKeys.add(ep.key);
    } else {
      deferredList.push(ep);
    }
  }

  const priority: ExtractedPlace[] = [];
  for (const ep of places) {
    if (priorityKeys.has(ep.key)) priority.push(ep);
  }

  let deferred = deferredList;
  if (priority.length > PRIORITY_GEOCODE_WAVE_MAX) {
    const overflow = priority.slice(PRIORITY_GEOCODE_WAVE_MAX);
    deferred = [...overflow, ...deferredList];
    priority.splice(PRIORITY_GEOCODE_WAVE_MAX);
  }

  if (priority.length === 0 && deferred.length > 0) {
    const n = Math.min(
      PRIORITY_GEOCODE_WAVE_MAX,
      Math.max(1, Math.ceil(deferred.length / 2))
    );
    return {
      priority: deferred.slice(0, n),
      deferred: deferred.slice(n),
    };
  }

  return { priority, deferred };
}

/**
 * Deep-merge geocoded coordinates into itinerary activities (same keys as extractPlacesFromPlan).
 */
export function applyCoordsToPlan(
  plan: TripData,
  coordsByKey: Record<string, { latitude: number; longitude: number }>
): TripData {
  const itinerary = (plan.itinerary || []).map((day) => ({
    ...day,
    activities: (day.activities || []).map((act) => {
      const raw = (act.name || "").trim();
      if (!raw) return act;
      const cleaned = cleanActivityQuery(raw);
      const key = normalizePlaceKey(cleaned);
      const c = coordsByKey[key];
      if (!c) return act;
      return {
        ...act,
        coordinates: { latitude: c.latitude, longitude: c.longitude },
      };
    }),
  }));
  return { ...plan, itinerary };
}
