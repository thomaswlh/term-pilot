import { describe, expect, it } from "vitest";
import { POLICY_CARDS, policyBinding } from "../src/domain/policy";

const HANDBOOK = "https://reg.um.edu.mo/download/course-enrol-info/gen-info/Course%20Enrolment%20HandBook.pdf";
const REGISTRY = "https://reg.um.edu.mo/current-students/enrolment-and-examinations/course-enrolment/general-information/";

describe("policy cards", () => {
  it("gives every card a traceable source", () => {
    expect(POLICY_CARDS).toHaveLength(7);
    for (const card of POLICY_CARDS) {
      expect(card.sources.length).toBeGreaterThan(0);
      for (const source of card.sources) {
        expect(source.title.length).toBeGreaterThan(0);
        expect(source.url).toMatch(/^https:\/\/reg\.um\.edu\.mo\//);
        expect(source.section.length).toBeGreaterThan(0);
        expect(source.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        if (source.url === HANDBOOK) expect(source.page).toBeTruthy();
      }
    }
    const society = POLICY_CARDS.find((card) => card.id === "society-area");
    expect(society?.status).toBe("sources-disagree");
    expect(society?.cohortScope).toBe("unscoped");
    expect(society?.sources.map((source) => source.url)).toEqual([
      HANDBOOK,
      HANDBOOK,
      REGISTRY,
    ]);
  });

  it("confirms the GE size card only for a 2017/2018-onward cohort", () => {
    const ge = POLICY_CARDS.find((card) => card.id === "ge-size");
    expect(ge?.cohortScope).toBe("confirmed-for-cohort");
    expect(policyBinding(ge!, "2024/2025")).toContain("saved cohort falls in that range");
    expect(policyBinding(ge!, null)).toContain("not confirmed for this profile");
    expect(policyBinding(ge!, "Before 2017/2018")).toContain("not confirmed for this profile");
    const language = POLICY_CARDS.find((card) => card.id === "language-test-out");
    expect(policyBinding(language!, "2024/2025")).toContain("not confirmed for the student's admission cohort");
  });
});
