import { describe, expect, it } from "vitest";
import { createAddressHandler } from "../src/index.js";
import { CITY_RISHON, STREETS_RISHON, mockFetch } from "./helpers.js";

const m = mockFetch({
  "/getcities-lang": () => ({ Result: [CITY_RISHON, CITY_RISHON] }),
  "/GetStreets-lang": () => ({ Result: STREETS_RISHON }),
  "/SearchZip-Lang": () => ({ Result: { zip: "7528705" } }),
});
const handler = createAddressHandler({ israelPost: { fetch: m.fetch }, streetLimit: 1, allowOrigin: "*" });
const get = async (qs: string) => {
  const r = await handler(new Request(`https://example.test/api/address?${qs}`));
  return { status: r.status, headers: r.headers, body: r.status === 204 ? null : await r.json() };
};

describe("createAddressHandler", () => {
  it("serves deduplicated city names", async () => {
    const r = await get(`type=cities&q=${encodeURIComponent("ראשון")}`);
    expect(r.body).toEqual({ results: ["ראשון לציון"] });
    expect(r.headers.get("cache-control")).toContain("max-age");
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("serves streets with the configured limit", async () => {
    const r = await get(`type=streets&city=${encodeURIComponent("ראשון לציון")}&q=${encodeURIComponent("הרצ")}`);
    expect(r.body).toEqual({ results: ["דרך חיים הרצוג"] });
  });

  it("serves a zip", async () => {
    const r = await get(`type=zip&city=${encodeURIComponent("ראשון לציון")}&street=${encodeURIComponent("הרצל")}&house=10`);
    expect(r.body).toEqual({ zip: "7528705" });
  });

  it("rejects unknown types and non-GET methods", async () => {
    expect((await get("type=bogus")).status).toBe(400);
    expect((await handler(new Request("https://example.test/", { method: "POST" }))).status).toBe(405);
    expect((await handler(new Request("https://example.test/", { method: "OPTIONS" }))).status).toBe(204);
  });
});
