import { describe, expect, it } from "vitest";
import { loadCatalogue } from "../src/domain/catalogue";
import { loadCreditBook } from "../src/domain/credit-snapshot";
import { readOfficialCredits } from "../scripts/credits-refresh";

describe("official credit page", () => {
  it("reads the Credits value and the title span", () => {
    const html = `
      <span style="width:130pt">GELH1012</span>
      <span style="width:520pt">Art Appreciation</span>
      <span>Credits</span><span>3</span>
    `;
    expect(readOfficialCredits(html)).toEqual({ credits: 3, title: "Art Appreciation" });
  });

  it("covers every offered course code in the committed snapshot", () => {
    const book = loadCreditBook();
    const missing = [...new Set(loadCatalogue().sections.map((section) => section.courseCode))]
      .filter((courseCode) => book.creditsFor(courseCode) === null);
    expect(missing).toEqual([]);
    expect(book.creditsFor("GELH1012")).toBe(3);
    expect(book.creditsFor("GESB1001")).toBe(1);
  });
});
