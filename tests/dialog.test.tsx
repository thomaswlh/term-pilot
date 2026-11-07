import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as dialog from "../src/components/ui/dialog";

describe("Dialog primitive", () => {
  it("exports the Base UI dialog parts and the approved backdrop", () => {
    for (const name of ["Dialog", "DialogTrigger", "DialogPortal", "DialogClose", "DialogBackdrop", "DialogPopup", "DialogTitle", "DialogDescription"] as const) {
      expect(typeof dialog[name]).toBe("function");
    }
    const source = readFileSync("src/components/ui/dialog.tsx", "utf8");
    expect(source).toContain('from "@base-ui/react/dialog"');
    expect(source).toContain("rgba(17,21,26,0.4)");
    expect(source).toContain('data-slot="dialog-popup"');
    expect(source).toContain("rounded-[14px]");
    expect(source).toContain("max-w-[440px]");
  });
});
