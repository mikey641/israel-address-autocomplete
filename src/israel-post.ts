// Structured address lookups against Israel Post's registry — the same API that powers
// https://doar.israelpost.co.il/locatezip. Prefix search from the first letters, and it matches
// street synonyms too ("קש" finds "הקשת" via its synonym "קשת").
//
// The API sends no CORS headers, so browsers cannot call it directly: run these functions on a
// server (see createAddressHandler) and point the React component at that route.

export const ISRAEL_POST_BASE_URL = "https://apimftprd.israelpost.co.il/mypost-zip";

/** The public subscription key embedded in the doar.israelpost.co.il single-page app. */
export const ISRAEL_POST_PUBLIC_KEY = "5ccb5b137e7444d885be752eda7f767a";

export interface IsraelPostOptions {
  /** Override the API base URL (for a corporate proxy or a mock). */
  baseUrl?: string;
  /** Override the `Ocp-Apim-Subscription-Key` header. Defaults to the public doar key. */
  subscriptionKey?: string;
  /** Custom fetch, e.g. one that adds caching. Defaults to the global fetch. */
  fetch?: typeof fetch;
  /** Extra `RequestInit` merged into every call (Next.js users can pass `{ next: { revalidate: 86400 } }`). */
  init?: RequestInit & Record<string, unknown>;
  /** Abort signal for the underlying requests. */
  signal?: AbortSignal;
}

export interface City {
  /** Israel Post city id — the id the streets and zip endpoints expect. */
  id: string;
  /** CBS settlement symbol (סמל יישוב). */
  symbol: string | null;
  /** Official Hebrew name. */
  name: string;
  /** Registry synonym, e.g. `ראשל"צ` for ראשון לציון. */
  synonym: string | null;
}

export interface Street {
  /** Israel Post street id. */
  id: string;
  /** CBS street symbol (סמל רחוב). */
  symbol: string | null;
  /** Official Hebrew name. */
  name: string;
  /** Registry synonym the search also matches on. */
  synonym: string | null;
  cityId: string;
}

export interface ZipQuery {
  city: string;
  street: string;
  house?: string;
  entrance?: string;
}

type Raw = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? "" : String(v).trim());
const strOrNull = (v: unknown): string | null => str(v) || null;

async function call(path: string, params: Record<string, string>, opts: IsraelPostOptions): Promise<unknown> {
  const url = new URL(`${opts.baseUrl ?? ISRAEL_POST_BASE_URL}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const doFetch = opts.fetch ?? fetch;
  const r = await doFetch(url, {
    ...opts.init,
    signal: opts.signal ?? opts.init?.signal ?? null,
    headers: {
      Accept: "application/json",
      "Ocp-Apim-Subscription-Key": opts.subscriptionKey ?? ISRAEL_POST_PUBLIC_KEY,
      ...(opts.init?.headers as Record<string, string> | undefined),
    },
  }).catch(() => null);
  if (!r?.ok) return null;
  const data = (await r.json().catch(() => null)) as Raw | null;
  return data?.Result ?? null;
}

const list = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);

/** Cities whose name (or registry synonym) starts with `query`. Needs at least 2 characters. */
export async function searchCities(query: string, opts: IsraelPostOptions = {}): Promise<City[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = list(await call("getcities-lang", { CityStartsWith: q, Lang: "he" }, opts));
  return rows
    .map((r) => ({ id: str(r.id), symbol: strOrNull(r.sym), name: str(r.n), synonym: strOrNull(r.syn) }))
    .filter((c) => c.id && c.name);
}

/** Resolves an exact city name to its registry record, or `null` when the name is not official. */
export async function findCity(name: string, opts: IsraelPostOptions = {}): Promise<City | null> {
  const n = name.trim();
  return (await searchCities(n, opts)).find((c) => c.name === n) ?? null;
}

/**
 * Streets in `city` whose name (or synonym) starts with `query`. `city` is either a registry
 * city id or an exact city name (resolved with an extra lookup).
 */
export async function searchStreets(
  city: string | City,
  query: string,
  opts: IsraelPostOptions & { limit?: number } = {},
): Promise<Street[]> {
  const q = query.trim();
  if (!q) return [];
  const cityId = await resolveCityId(city, opts);
  if (!cityId) return [];
  const rows = list(
    await call(
      "GetStreets-lang",
      { CityID: cityId, CityName: "", SearchMode: "ID-StartsWith", StartsWith: q, Lang: "he" },
      opts,
    ),
  );
  const streets = rows
    .map((r) => ({
      id: str(r.id),
      symbol: strOrNull(r.sym),
      name: str(r.n),
      synonym: strOrNull(r.syn),
      cityId: str(r.cityID) || cityId,
    }))
    .filter((s) => s.id && s.name);
  return opts.limit ? streets.slice(0, opts.limit) : streets;
}

/**
 * The 7-digit zip (מיקוד) for an address. A house number missing from the zip database returns
 * nothing upstream, so this falls back to the street-level zip. Returns `null` when the city or
 * street is not an exact registry name.
 */
export async function lookupZip(query: ZipQuery, opts: IsraelPostOptions = {}): Promise<string | null> {
  const city = query.city.trim();
  const street = query.street.trim();
  if (!city || !street) return null;
  const cityId = await resolveCityId(city, opts);
  if (!cityId) return null;
  const streetId = (await searchStreets(cityId, street, opts)).find((s) => s.name === street)?.id;
  if (!streetId) return null;

  const house = query.house?.trim() ?? "";
  const entrance = query.entrance?.trim() ?? "";
  for (const h of house ? [house, ""] : [""]) {
    // SearchZip-Lang's Result is an object, not an array.
    const result = (await call(
      "SearchZip-Lang",
      { CityID: cityId, StreetID: streetId, House: h, Entry: h ? entrance : "", Lang: "he", ByMaanimID: "true" },
      opts,
    )) as Raw | null;
    const zip = str(result?.zip);
    if (/^\d{7}$/.test(zip) && zip !== "0000000") return zip;
  }
  return null;
}

async function resolveCityId(city: string | City, opts: IsraelPostOptions): Promise<string | null> {
  if (typeof city !== "string") return city.id;
  const c = city.trim();
  if (/^\d+$/.test(c)) return c;
  return (await findCity(c, opts))?.id ?? null;
}
