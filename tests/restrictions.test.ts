import { describe, expect, it } from "vitest";
import { restrictionOutcome, unverifiedWish } from "../src/domain/restrictions";

const known = {
  majors: ["CPS19", "CLL19", "WA17", "WA25", "GBM", "GBM22", "ACC21", "IIR20"],
  programmes: ["FIC", "FAH", "FLL", "FBA", "FEG", "FSC"],
  specializations: [{ majorCode: "IIR20", code: "CHM20" }],
};

describe("restriction outcomes", () => {
  it("matches WA17 and does not treat GBM as GBM22", () => {
    expect(
      restrictionOutcome("Class for : - FLL - WA17 / WA25", { majorCode: "WA17", programme: "FLL", yearOfStudy: 1 }, known).status,
    ).toBe("eligible");
    expect(
      restrictionOutcome("Class for : - FBA - GBM22", { majorCode: "GBM", programme: "FBA", yearOfStudy: 1 }, known),
    ).toEqual({ status: "ineligible", rule: "class-for" });
  });

  it("matches a faculty list and a year-scoped faculty", () => {
    expect(
      restrictionOutcome("Class for : - FEG - FIC - FSC", { majorCode: "CPS19", programme: "FIC", yearOfStudy: 2 }, known).status,
    ).toBe("eligible");
    expect(
      restrictionOutcome("Class for : - FEG - FIC - FSC", { majorCode: "CLL19", programme: "FAH", yearOfStudy: 2 }, known),
    ).toEqual({ status: "ineligible", rule: "class-for" });
    expect(
      restrictionOutcome(
        "Class for : - FBA - THIRD YEAR / FOURTH YEAR",
        { majorCode: "ACC21", programme: "FBA", yearOfStudy: 3 },
        known,
      ).status,
    ).toBe("eligible");
  });

  it("leaves a blank year unverified and does not call it ineligible", () => {
    const outcome = restrictionOutcome(
      "Class for : - FBA - THIRD YEAR / FOURTH YEAR",
      { majorCode: "ACC21", programme: "FBA", yearOfStudy: null },
      known,
    );
    expect(outcome).toEqual({ status: "unverified", need: "year" });
    expect(unverifiedWish("BECO4007:001", "year")).toBe(
      "Eligibility for BECO4007:001 is unverified. Save your year of study to check this section. This course was not added.",
    );
  });

  it("lets a confirmed exclusion win over an unknown alternative", () => {
    expect(
      restrictionOutcome(
        "Class not for : - FAH - CLL19 / NOTACODE",
        { majorCode: "CLL19", programme: "FAH", yearOfStudy: 1 },
        known,
      ),
    ).toEqual({ status: "ineligible", rule: "class-not-for" });
  });

  it("does not let an unknown alternative create eligibility", () => {
    expect(
      restrictionOutcome("Class for : - FIC - NOTACODE", { majorCode: "CPS19", programme: "FIC", yearOfStudy: 1 }, known),
    ).toEqual({ status: "unverified", need: "uninterpreted" });
    expect(restrictionOutcome("Class for :", { majorCode: "CPS19", programme: "FIC", yearOfStudy: 1 }, known)).toEqual({
      status: "unverified",
      need: "uninterpreted",
    });
  });

  it("leaves a matching specialization unverified", () => {
    expect(
      restrictionOutcome(
        "Class for : - FBA - IIR20-CHM20",
        { majorCode: "IIR20", programme: "FBA", yearOfStudy: 2 },
        known,
      ),
    ).toEqual({ status: "unverified", need: "specialization" });
  });

  it("does not treat prose after a major as a confirmed major", () => {
    expect(
      restrictionOutcome(
        "Class for : - FBA - ACC21 STUDENTS ONLY",
        { majorCode: "ACC21", programme: "FBA", yearOfStudy: 1 },
        known,
      ),
    ).toEqual({ status: "unverified", need: "uninterpreted" });
    expect(
      restrictionOutcome(
        "Class for : - FBA - IIR20-CHM20 ONLY",
        { majorCode: "IIR20", programme: "FBA", yearOfStudy: 2 },
        known,
      ),
    ).toEqual({ status: "unverified", need: "uninterpreted" });
  });

  it("matches a major scoped to an exact year", () => {
    expect(
      restrictionOutcome(
        "Class for : - FBA - ACC21-THIRD YEAR",
        { majorCode: "ACC21", programme: "FBA", yearOfStudy: 3 },
        known,
      ).status,
    ).toBe("eligible");
    expect(
      restrictionOutcome(
        "Class for : - FBA - ACC21-THIRD YEAR",
        { majorCode: "ACC21", programme: "FBA", yearOfStudy: 2 },
        known,
      ),
    ).toEqual({ status: "ineligible", rule: "class-for" });
  });
});
