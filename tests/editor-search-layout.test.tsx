import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Editor dual-sidebar and search integration", () => {
  it("incorporates CourseSearchPanel, 1600px mutual auto-collapse, and search rail (no header button)", () => {
    const editor = readFileSync("src/components/editor.tsx", "utf8");

    // CourseSearchPanel integrated
    expect(editor).toContain("<CourseSearchPanel");
    expect(editor).toContain("searchOpen");
    expect(editor).toContain("setSearchOpen");

    expect(editor).not.toContain("onClick={expandSearch}");
    expect(editor).not.toContain("⌘K");

    // Mutual auto-collapse threshold
    expect(editor).toContain("1600");

    // Two-tier preview
    expect(editor).toContain("pinnedKey");
    expect(editor).toContain("hoveredKey");

    // No floating search dropdown inside Week
    expect(editor).not.toContain("zIndex: 20");
    expect(editor).not.toContain("Search course code, title, or instructor (e.g. MATH1001)...");

    // Preserved search and the corrected preview/dismissal contract
    expect(editor).toContain("/api/search?q=");
    expect(editor).toContain("AbortController");
    expect(editor).toContain("}, 200)");
    expect(editor).toContain("sectionFromHit");
    expect(editor).toContain("/api/timetables/${timetable.id}/sections");
    expect(editor).toContain("!searchOpen || selected !== null ? null : (hoveredKey ?? pinnedKey)");
    expect(editor).toContain("setPinnedKey(null)");
    expect(editor).toContain("setRecentQueries");
    expect(editor).toContain("setFocusNonce");
    expect(editor).toContain("notice={notice}");
    expect(editor).toContain("noticeTone={noticeTone}");
    expect(editor).toContain("recentQueries={recentQueries}");
    expect(editor).toContain("focusNonce={focusNonce}");

    // Header notice when searchOpen is false
    expect(editor).toContain("!searchOpen && notice");
    expect(editor).toContain('role="alert"');

    // Keydown editable handling: inputs are editable for slash, Escape special-cased for course-search-query
    expect(editor).toContain('target.id === "course-search-query"');
    expect(editor).toContain('event.key === "Escape" && (!editable || isSearchInput)');
  });
});
