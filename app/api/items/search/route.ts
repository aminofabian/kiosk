import { NextRequest } from "next/server";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Unified POS search: suggestions + grid items in one round trip.
 * Runs suggest and grid queries in parallel server-side.
 */
export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 1) {
      return jsonResponse({
        success: true,
        data: { suggestions: [], items: [] },
      });
    }

    const suggestLimit = Math.min(
      parseInt(request.nextUrl.searchParams.get("suggestLimit") || "10", 10),
      20,
    );
    const gridLimit = Math.min(
      parseInt(request.nextUrl.searchParams.get("gridLimit") || "50", 10),
      100,
    );
    const itemTypes = request.nextUrl.searchParams.get("itemTypes");

    const cookie = request.headers.get("cookie") ?? "";
    const headers = { cookie, "x-pos-internal-search": "1" };

    const suggestUrl = new URL("/api/items/suggest", request.url);
    suggestUrl.searchParams.set("q", q);
    suggestUrl.searchParams.set("limit", String(suggestLimit));

    const gridUrl = new URL("/api/items", request.url);
    gridUrl.searchParams.set("search", q);
    gridUrl.searchParams.set("sellableOnly", "true");
    gridUrl.searchParams.set("limit", String(gridLimit));
    if (itemTypes) gridUrl.searchParams.set("itemTypes", itemTypes);

    const [suggestRes, gridRes] = await Promise.all([
      fetch(suggestUrl, { headers, cache: "no-store" }),
      fetch(gridUrl, { headers, cache: "no-store" }),
    ]);

    const [suggestJson, gridJson] = await Promise.all([
      suggestRes.json(),
      gridRes.json(),
    ]);

    return jsonResponse({
      success: true,
      data: {
        suggestions: suggestJson.success ? (suggestJson.data ?? []) : [],
        items: gridJson.success ? (gridJson.data ?? []) : [],
      },
    });
  } catch (error) {
    console.error("Unified search error:", error);
    return jsonResponse(
      { success: false, message: "Search failed" },
      500,
    );
  }
}
