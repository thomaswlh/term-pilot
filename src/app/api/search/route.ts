import { NextResponse } from "next/server";
import { UnauthorizedError, requireUserId } from "@/auth";
import { loadCatalogue, sectionKey, timedMeetings } from "@/domain/catalogue";
import { searchSections } from "@/domain/search";
import type { Catalogue, Day } from "@/domain/types";

let catalogueCache: Catalogue | null = null;

function catalogue(): Catalogue {
  catalogueCache ??= loadCatalogue();
  return catalogueCache;
}

export async function GET(req: Request) {
  try {
    await requireUserId();
    const query = new URL(req.url).searchParams.get("q") ?? "";
    const source = catalogue();
    const byKey = new Map(source.sections.map((section) => [sectionKey(section), section]));
    const hits = searchSections(source, query, 20).map((hit) => {
      const section = byKey.get(hit.sectionKey);
      const meetings: { day: Day; startMinutes: number; endMinutes: number }[] = [];
      if (section) {
        for (const meeting of timedMeetings(section)) {
          if (meeting.day === null || meeting.startMinutes === null || meeting.endMinutes === null) continue;
          meetings.push({
            day: meeting.day,
            startMinutes: meeting.startMinutes,
            endMinutes: meeting.endMinutes,
          });
        }
      }

      const prerequisites = source.prerequisites
        .filter((prereq) => prereq.courseCode === hit.courseCode)
        .map((prereq) => ({
          preRequisiteFor: prereq.preRequisiteFor,
          majorList: prereq.majorList,
          requiredCount: prereq.requiredCount,
          groupNo: prereq.groupNo,
          requiredCourseCode: prereq.requiredCourseCode,
        }));

      return {
        ...hit,
        unit: section?.unit ?? "",
        department: section?.department ?? "",
        notes: section?.notes ?? "",
        restriction: section?.restriction ?? "",
        prerequisites,
        meetings,
      };
    });
    return NextResponse.json({ hits });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
