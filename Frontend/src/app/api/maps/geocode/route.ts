import { NextRequest, NextResponse } from "next/server";
import { getBackendOrigin } from "@/lib/api/backendOrigin";

/**
 * Proxies GET /api/maps/geocode?place=... → Express backend.
 */
export async function GET(request: NextRequest) {
  const incoming = new URL(request.url);
  const target = new URL(`${getBackendOrigin()}/api/maps/geocode`);
  incoming.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  const auth = request.headers.get("authorization");
  const res = await fetch(target.toString(), {
    method: "GET",
    headers: {
      ...(auth ? { Authorization: auth } : {}),
    },
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
