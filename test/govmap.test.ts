import { describe, expect, it } from "vitest";
import { geocode, parseGovmapResults, webMercatorToWgs84 } from "../src/index.js";

const PAYLOAD = {
  results: [
    {
      type: "address",
      id: "address|ADDR|123|הרצל|10|ראשון לציון",
      text: "הרצל 10, ראשון לציון",
      shape: "POINT(3871520.5 3757320.25)",
    },
    { type: "settlement", id: "settlement|1252", text: "ראשון לציון" },
  ],
};

describe("webMercatorToWgs84", () => {
  it("maps the origin and a known Israeli point", () => {
    expect(webMercatorToWgs84(0, 0)).toEqual({ lat: 0, lng: 0 });
    const p = webMercatorToWgs84(3871520.5, 3757320.25);
    expect(p.lat).toBeCloseTo(31.97, 1);
    expect(p.lng).toBeCloseTo(34.78, 1);
  });
});

describe("parseGovmapResults", () => {
  it("keeps address hits and splits the structured id", () => {
    const [hit, ...rest] = parseGovmapResults(PAYLOAD);
    expect(rest).toHaveLength(0);
    expect(hit).toMatchObject({ address: "הרצל 10", street: "הרצל", houseNumber: "10", city: "ראשון לציון" });
    expect(hit?.lat).toBeCloseTo(31.97, 1);
  });

  it("tolerates junk", () => {
    expect(parseGovmapResults(null)).toEqual([]);
    expect(parseGovmapResults({ results: "nope" })).toEqual([]);
  });
});

describe("geocode", () => {
  it("POSTs the query and returns [] when GovMap blocks the caller", async () => {
    let body = "";
    const ok = (async (_u: unknown, init?: RequestInit) => {
      body = String(init?.body);
      return new Response(JSON.stringify(PAYLOAD));
    }) as typeof fetch;
    expect(await geocode("הרצל 10 ראשון לציון", { fetch: ok })).toHaveLength(1);
    expect(JSON.parse(body).searchText).toBe("הרצל 10 ראשון לציון");

    const blocked = (async () => new Response("<html>403</html>", { status: 403 })) as typeof fetch;
    expect(await geocode("הרצל 10", { fetch: blocked })).toEqual([]);
  });
});
