import { geocode, type GovmapOptions } from "./govmap.js";
import { lookupZip, searchCities, searchStreets, type IsraelPostOptions } from "./israel-post.js";

// A fetch-standard `(Request) => Response` handler that exposes the lookups to browsers. It runs
// unchanged as a Next.js route handler, a Cloudflare Worker, Bun.serve, Deno.serve or Hono route.
//
//   GET ?type=cities&q=ראשון                                → { results: ["ראשון לציון", …] }
//   GET ?type=streets&city=ראשון לציון&q=הרצ               → { results: ["הרצל", …] }
//   GET ?type=zip&city=…&street=…&house=12&entrance=א      → { zip: "7528705" }
//   GET ?type=geocode&q=הרצל 10 ראשון לציון                → { results: [{ label, address, city, lat, lng }] }

export interface AddressHandlerOptions {
  israelPost?: IsraelPostOptions;
  govmap?: GovmapOptions;
  /** Maximum street suggestions returned (default 10). */
  streetLimit?: number;
  /** `Cache-Control` sent on successful responses. Registry data changes rarely. */
  cacheControl?: string;
  /** Value for `Access-Control-Allow-Origin`; omit to send no CORS headers (same-origin use). */
  allowOrigin?: string;
}

export function createAddressHandler(options: AddressHandlerOptions = {}): (req: Request) => Promise<Response> {
  const cacheControl = options.cacheControl ?? "public, max-age=3600, s-maxage=86400";
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(status === 200 ? { "Cache-Control": cacheControl } : {}),
        ...(options.allowOrigin ? { "Access-Control-Allow-Origin": options.allowOrigin } : {}),
      },
    });
  const unique = (names: string[]) => Array.from(new Set(names.filter(Boolean)));

  return async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: options.allowOrigin
          ? { "Access-Control-Allow-Origin": options.allowOrigin, "Access-Control-Allow-Methods": "GET, OPTIONS" }
          : {},
      });
    }
    if (req.method !== "GET") return json({ error: "method not allowed" }, 405);

    const sp = new URL(req.url).searchParams;
    const type = sp.get("type");
    const q = sp.get("q")?.trim() ?? "";
    const signal = req.signal;
    const post = { ...options.israelPost, signal };

    switch (type) {
      case "cities":
        return json({ results: unique((await searchCities(q, post)).map((c) => c.name)) });
      case "streets": {
        const city = sp.get("city")?.trim() ?? "";
        if (!city) return json({ results: [] });
        const streets = await searchStreets(city, q, post);
        return json({ results: unique(streets.map((s) => s.name)).slice(0, options.streetLimit ?? 10) });
      }
      case "zip": {
        const zip = await lookupZip(
          {
            city: sp.get("city") ?? "",
            street: sp.get("street") ?? "",
            house: sp.get("house") ?? "",
            entrance: sp.get("entrance") ?? "",
          },
          post,
        );
        return json({ zip });
      }
      case "geocode":
        return json({ results: await geocode(q, { ...options.govmap, signal }) });
      default:
        return json({ error: "type must be one of: cities, streets, zip, geocode" }, 400);
    }
  };
}
