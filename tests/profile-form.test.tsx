import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProfileForm } from "../src/components/profile-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

const sampleMajors = [
  { code: "CPS19", name: "Computer Science", programme: "" },
  { code: "CLL19", name: "Chinese Language", programme: "" },
];

describe("ProfileForm component", () => {
  it("renders Slate Atelier sheets and keeps the example students", () => {
    const html = renderToStaticMarkup(
      <ProfileForm
        majors={sampleMajors}
        initialMajorCode="CPS19"
        courses={[
          {
            courseCode: "MATH1001",
            status: "completed",
            recognizesPrerequisite: false,
            reason: null,
          },
          {
            courseCode: "EELC1011",
            status: "waived",
            recognizesPrerequisite: false,
            reason: null,
          },
        ]}
        yearOfStudy={null}
        admissionCohort={null}
        interests={null}
      />,
    );

    expect(html).toContain("CPS19 — Computer Science");
    expect(html).toContain("MATH1001");
    expect(html).toContain("Save profile");
    expect(html).toContain("border-radius:14px");
    expect(html).toContain("border-radius:8px");
    expect(html).toContain("border-radius:999px");
    expect(html).toContain("Computer Science example");
    expect(html).toContain("Chinese Language example");
    expect(html).toContain("Japanese Studies example");
    expect(html).toContain(
      "These fields shape suggestions and policy wording. Leaving them blank does not change scheduling.",
    );
    expect(html).toContain(
      "This list is what you report to TermPilot. The checkbox does not record earned credits or graduation progress.",
    );
    expect(html).toContain("UM has recognized this for prerequisites");
    expect(html).toContain("EELC1011");
    expect(html).toContain("EELC1012");
    expect(html).toContain("EELC1013");
    expect(html).toContain("Already on the list.");
    expect(html).toContain("CHLL1000");
    expect(html).toContain("PORT1000");
    expect(html).toContain("Add any other language code yourself. CSCI1000 is not in these presets.");
    expect(html).toContain("Not specified");
    expect(html).toContain("Year 1");
    expect(html).toContain("Before 2017/2018");
  });
});
