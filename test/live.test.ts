import { describe, expect, it } from "vitest";
import { lookupZip, searchCities, searchStreets } from "../src/index.js";

// Hits the real Israel Post API. Opt-in only (`npm run test:live`); never runs in CI.
describe.skipIf(!process.env.ADDRESS_LIVE)("live Israel Post registry", () => {
  it("finds a city, a street and a zip", async () => {
    const cities = await searchCities("ראשון");
    expect(cities.map((c) => c.name)).toContain("ראשון לציון");
    const streets = await searchStreets("ראשון לציון", "הרצ");
    expect(streets.map((s) => s.name)).toContain("הרצל");
    expect(await lookupZip({ city: "ראשון לציון", street: "הרצל", house: "10" })).toMatch(/^\d{7}$/);
  });
});
