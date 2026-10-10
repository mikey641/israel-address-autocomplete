// Free-text address search + geocoding through GovMap's ungated search service. Results carry
// registry-standard street and city names, and the shape is a Web-Mercator point converted here to
// WGS84 latitude/longitude.
//
// GovMap sits behind CloudFront and blocks many datacenter IP ranges; when it does, this returns
// an empty list rather than throwing, so callers can treat coordinates as best-effort.

export const GOVMAP_AUTOCOMPLETE_URL = "https://www.govmap.gov.il/api/search-service/autocomplete";

export interface GovmapOptions {
  url?: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  /** Maximum results requested upstream (default 8). */
  maxResults?: number;
}

export interface GeocodeResult {
  /** GovMap's display text, e.g. "הרצל 10, ראשון לציון". */
  label: string;
  /** Street + house number, e.g. "הרצל 10". */
  address: string;
  street: string | null;
  houseNumber: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

const R = 20037508.34; // Web-Mercator half-circumference (EPSG:3857)

/** Converts an EPSG:3857 point to WGS84. */
export function webMercatorToWgs84(x: number, y: number): { lat: number; lng: number } {
  const lng = (x / R) * 180;
  const lat = (Math.atan(Math.exp((((y / R) * 180) * Math.PI) / 180)) * 2 - Math.PI / 2) * (180 / Math.PI);
  return { lat, lng };
}

/** Parses one GovMap autocomplete payload into address results. Exported for testing. */
export function parseGovmapResults(data: unknown): GeocodeResult[] {
  const results = (data as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((it) => it?.type === "address" && typeof it.id === "string")
    .map((it): GeocodeResult => {
      // id = "address|ADDR|<id>|<street>|<houseNum>|<city>"
      const parts = String(it.id).split("|");
      const street = parts[3] || null;
      const houseNumber = parts[4] || null;
      const city = parts[5] || null;
      const m = typeof it.shape === "string" ? it.shape.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/) : null;
      const pt = m ? webMercatorToWgs84(Number(m[1]), Number(m[2])) : null;
      const label = String(it.text ?? "");
      return {
        label,
        address: street ? `${street}${houseNumber ? ` ${houseNumber}` : ""}` : label,
        street,
        houseNumber,
        city,
        lat: pt?.lat ?? null,
        lng: pt?.lng ?? null,
      };
    })
    .filter((r) => r.city && r.label);
}

/** Free-text address search with coordinates, e.g. `geocode("הרצל 10 ראשון לציון")`. */
export async function geocode(query: string, opts: GovmapOptions = {}): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const doFetch = opts.fetch ?? fetch;
  const r = await doFetch(opts.url ?? GOVMAP_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ searchText: q, language: "he", isAccurate: false, maxResults: opts.maxResults ?? 8 }),
    signal: opts.signal ?? null,
  }).catch(() => null);
  if (!r?.ok) return [];
  return parseGovmapResults(await r.json().catch(() => null));
}
