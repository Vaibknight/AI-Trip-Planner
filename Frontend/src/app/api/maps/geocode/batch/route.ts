import { NextRequest, NextResponse } from "next/server";
import { getBackendOrigin } from "@/lib/api/backendOrigin";

/**
 * Proxies POST /api/maps/geocode/batch → Express backend (same path under /api).
 * Lets the browser call http://localhost:3000/api/... while the API runs on :8000.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const auth = request.headers.get("authorization");

  const url = `${getBackendOrigin()}/api/maps/geocode/batch`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return NextResponse.json(data, { status: res.status });
}
