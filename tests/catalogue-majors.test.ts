import { describe, expect, it } from "vitest";
import { loadCatalogue } from "../src/domain/catalogue";

describe("major faculty and specializations", () => {
  const catalogue = loadCatalogue();

  it("keeps CPS19 in FIC and treats GBM, GBM20, and GBM22 as different majors", () => {
    const cps = catalogue.majors.find((major) => major.code === "CPS19");
    expect(cps).toMatchObject({ name: "COMPUTER SCIENCE", programme: "FIC" });
    expect(catalogue.majors.filter((major) => major.code.startsWith("GBM")).map((major) => major.code).sort()).toEqual([
      "GBM",
      "GBM20",
      "GBM22",
    ]);
  });

  it("loads a specialization under its major code", () => {
    expect(catalogue.specializations.some((row) => row.majorCode === "IIR20" && row.code === "CHM20")).toBe(true);
  });
});
