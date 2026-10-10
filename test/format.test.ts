import { describe, expect, it } from "vitest";
import { formatAddress, splitAddress } from "../src/index.js";

describe("formatAddress", () => {
  it("joins street, number and entrance the Israeli way", () => {
    expect(formatAddress({ street: "הרצל", houseNumber: "10", entrance: "א" })).toBe("הרצל 10 כניסה א");
    expect(formatAddress({ street: " הרצל " })).toBe("הרצל");
  });
});

describe("splitAddress", () => {
  it("splits a trailing house number, including letters and ranges", () => {
    expect(splitAddress("הרצל 12א")).toEqual({ street: "הרצל", houseNumber: "12א" });
    expect(splitAddress("דרך חיים הרצוג 4-6")).toEqual({ street: "דרך חיים הרצוג", houseNumber: "4-6" });
    expect(splitAddress("שדרות רוטשילד")).toEqual({ street: "שדרות רוטשילד", houseNumber: "" });
  });
});
