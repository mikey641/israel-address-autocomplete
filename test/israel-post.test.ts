import { describe, expect, it } from "vitest";
import { findCity, lookupZip, searchCities, searchStreets } from "../src/index.js";
import { CITY_RISHON, STREETS_RISHON, mockFetch } from "./helpers.js";

const registry = () =>
  mockFetch({
    "/getcities-lang": () => ({ ReturnCode: 0, Result: [CITY_RISHON] }),
    "/GetStreets-lang": (url) => ({
      ReturnCode: 0,
      Result: url.searchParams.get("CityID") === "1252" ? STREETS_RISHON : [],
    }),
    "/SearchZip-Lang": (url) => ({
      ReturnCode: 0,
      // House 999 is missing from the zip DB upstream; the street-level call (House="") answers.
      Result: { zip: url.searchParams.get("House") === "999" ? "" : url.searchParams.get("House") ? "7528705" : "7528700" },
    }),
  });

describe("searchCities", () => {
  it("maps registry rows and sends the public key", async () => {
    const m = registry();
    const cities = await searchCities("ראשון", { fetch: m.fetch });
    expect(cities).toEqual([{ id: "1252", symbol: "8300", name: "ראשון לציון", synonym: 'ראשל"צ' }]);
    expect(m.calls[0]?.searchParams.get("CityStartsWith")).toBe("ראשון");
  });

  it("skips the network for queries shorter than two characters", async () => {
    const m = registry();
    expect(await searchCities("ר", { fetch: m.fetch })).toEqual([]);
    expect(m.calls).toHaveLength(0);
  });

  it("returns [] on upstream failure instead of throwing", async () => {
    const failing = (async () => new Response("boom", { status: 503 })) as typeof fetch;
    expect(await searchCities("ראשון", { fetch: failing })).toEqual([]);
    const throwing = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    expect(await searchCities("ראשון", { fetch: throwing })).toEqual([]);
  });
});

describe("findCity", () => {
  it("matches only the exact official name", async () => {
    const m = registry();
    expect((await findCity("ראשון לציון", { fetch: m.fetch }))?.id).toBe("1252");
    expect(await findCity("ראשון", { fetch: m.fetch })).toBeNull();
  });
});

describe("searchStreets", () => {
  it("resolves a city name to the registry id (not the CBS symbol)", async () => {
    const m = registry();
    const streets = await searchStreets("ראשון לציון", "הרצ", { fetch: m.fetch });
    expect(streets.map((s) => s.name)).toEqual(["דרך חיים הרצוג", "הרצל"]);
    expect(m.calls.at(-1)?.searchParams.get("CityID")).toBe("1252");
  });

  it("accepts a numeric city id without a city lookup, and honours limit", async () => {
    const m = registry();
    const streets = await searchStreets("1252", "הרצ", { fetch: m.fetch, limit: 1 });
    expect(streets).toHaveLength(1);
    expect(m.calls).toHaveLength(1);
  });

  it("returns [] for an unknown city", async () => {
    const m = registry();
    expect(await searchStreets("עיר לא קיימת", "הרצ", { fetch: m.fetch })).toEqual([]);
  });
});

describe("lookupZip", () => {
  it("returns the house-level zip", async () => {
    const m = registry();
    expect(await lookupZip({ city: "ראשון לציון", street: "הרצל", house: "10" }, { fetch: m.fetch })).toBe("7528705");
  });

  it("falls back to the street-level zip when the house number is unknown", async () => {
    const m = registry();
    expect(await lookupZip({ city: "ראשון לציון", street: "הרצל", house: "999" }, { fetch: m.fetch })).toBe("7528700");
  });

  it("requires an exact street name", async () => {
    const m = registry();
    expect(await lookupZip({ city: "ראשון לציון", street: "הרצ" }, { fetch: m.fetch })).toBeNull();
  });
});
