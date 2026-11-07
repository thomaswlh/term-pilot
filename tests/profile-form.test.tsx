import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProfileForm } from "../src/components/profile-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

const sampleMajors = [
  { code: "CPS19", name: "Computer Science" },
  { code: "CLL19", name: "Chinese Language" },
];

describe("ProfileForm component", () => {
  it("renders Slate Atelier sheets and keeps the example students", () => {
    const html = renderToStaticMarkup(
      <ProfileForm
        majors={sampleMajors}
        initialMajorCode="CPS19"
        initialCompleted={["MATH1001"]}
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
  });
});
