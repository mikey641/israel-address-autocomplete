// A tiny routing fetch mock: maps an upstream path suffix to a JSON body and records calls.
export function mockFetch(routes: Record<string, (url: URL, init?: RequestInit) => unknown>) {
  const calls: URL[] = [];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.pathname.endsWith(k));
    if (!key) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(routes[key]!(url, init)), { headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { fetch: fn, calls };
}

export const CITY_RISHON = { id: "1252", sym: "8300", n: "ראשון לציון", syn: 'ראשל"צ', divided: true, zip: "0000000" };
export const STREETS_RISHON = [
  { id: "95456", sym: "0550", n: "דרך חיים הרצוג", syn: "הרצוג חיים", cityID: "1252" },
  { id: "89149", sym: "0307", n: "הרצל", syn: "הרצל אז תעש", cityID: "1252" },
];
