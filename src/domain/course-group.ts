import { formatCreditValue } from "./credits";
import { meetingsOverlap } from "./rules";
import { restrictionOutcome, unverifiedWish } from "./restrictions";
import { timedMeetings } from "./section";
import type { Day, Meeting, Section } from "./types";

export type SearchMeeting = { day: Day; startMinutes: number; endMinutes: number };

export type SearchHitDetail = {
  sectionKey: string;
  courseCode: string;
  section: string;
  title: string;
  teacher: string;
  courseType?: string;
  unit?: string;
  department?: string;
  notes?: string;
  restriction?: string;
  prerequisites?: Array<{
    preRequisiteFor: string;
    majorList: string;
    requiredCount: number;
    groupNo: string;
    requiredCourseCode: string;
  }>;
  credits?: number | null;
  meetings: SearchMeeting[];
};

export type CourseGroup = {
  courseCode: string;
  title: string;
  creditsLabel: string;
  department: string;
  sections: SearchHitDetail[];
};

export type SectionFitKnown = {
  majors: readonly string[];
  programmes: readonly string[];
  specializations: readonly { majorCode: string; code: string }[];
};

export type SectionFitContext = {
  yearOfStudy: number | null;
  programme?: string | null;
  known: SectionFitKnown;
};

export type FitStatus =
  | { status: "added"; label: string }
  | { status: "fits"; label: string }
  | { status: "overlap"; label: string; conflictingKey: string; conflictingCourseCode: string }
  | { status: "restriction"; label: string; reason: string }
  | { status: "unverified"; label: string }
  | { status: "untimed"; label: string }
  | { status: "duplicate"; label: string; courseCode: string };

const emptyFitContext: SectionFitContext = {
  yearOfStudy: null,
  known: { majors: [], programmes: [], specializations: [] },
};

export function groupHitsByCourse(hits: SearchHitDetail[]): CourseGroup[] {
  const groupsMap = new Map<string, CourseGroup>();

  for (const hit of hits) {
    const existing = groupsMap.get(hit.courseCode);
    if (existing) {
      existing.sections.push(hit);
    } else {
      groupsMap.set(hit.courseCode, {
        courseCode: hit.courseCode,
        title: hit.title,
        creditsLabel: formatCreditValue(typeof hit.credits === "number" ? hit.credits : null),
        department: hit.department ?? "",
        sections: [hit],
      });
    }
  }

  return Array.from(groupsMap.values());
}

function restrictionFit(
  hit: SearchHitDetail,
  majorCode: string | null,
  context: SectionFitContext,
): Extract<FitStatus, { status: "restriction" | "unverified" }> | null {
  if (!majorCode || !hit.restriction?.trim()) return null;

  const programme = context.programme?.trim() ? context.programme.trim().toUpperCase() : null;
  const outcome = restrictionOutcome(hit.restriction, {
    majorCode,
    programme,
    yearOfStudy: context.yearOfStudy,
  }, context.known);

  if (outcome.status === "ineligible") {
    return { status: "restriction", label: `Not for ${majorCode}`, reason: `Not eligible for major ${majorCode}` };
  }
  if (outcome.status === "unverified") {
    const label = unverifiedWish(hit.sectionKey, outcome.need).replace(" This course was not added.", "");
    return { status: "unverified", label };
  }
  return null;
}

function isMajorIneligible(hit: SearchHitDetail, majorCode: string | null, context: SectionFitContext): boolean {
  const fit = restrictionFit(hit, majorCode, context);
  return fit?.status === "restriction";
}

function overlappingSavedSection(
  hit: SearchHitDetail,
  savedSections: Section[],
  savedKeys: string[],
): Section | null {
  if (savedKeys.includes(hit.sectionKey) || hit.meetings.length === 0) return null;
  for (const meeting of hit.meetings) {
    for (const savedSection of savedSections) {
      const savedKey = `${savedSection.courseCode}:${savedSection.section}`;
      if (savedKey === hit.sectionKey) continue;
      const savedTimed = timedMeetings(savedSection).filter(
        (m): m is Meeting & { day: Day; startMinutes: number; endMinutes: number } =>
          m.day !== null && m.startMinutes !== null && m.endMinutes !== null,
      );
      for (const savedMeeting of savedTimed) {
        if (meetingsOverlap(meeting, savedMeeting)) return savedSection;
      }
    }
  }
  return null;
}

export function evaluateSectionFit(
  hit: SearchHitDetail,
  savedSections: Section[],
  savedKeys: string[],
  majorCode: string | null,
  context: SectionFitContext = emptyFitContext,
): FitStatus {
  if (savedKeys.includes(hit.sectionKey)) {
    return { status: "added", label: "Added" };
  }

  const alreadyTaking = savedKeys.some((key) => {
    const divider = key.lastIndexOf(":");
    const code = divider === -1 ? key : key.slice(0, divider);
    return code === hit.courseCode && key !== hit.sectionKey;
  });
  if (alreadyTaking) {
    return { status: "duplicate", label: `Already taking ${hit.courseCode}`, courseCode: hit.courseCode };
  }

  const overlap = overlappingSavedSection(hit, savedSections, savedKeys);
  if (overlap) {
    return {
      status: "overlap",
      label: `Overlaps ${overlap.courseCode}`,
      conflictingKey: `${overlap.courseCode}:${overlap.section}`,
      conflictingCourseCode: overlap.courseCode,
    };
  }

  const restriction = restrictionFit(hit, majorCode, context);
  if (restriction) return restriction;

  if (hit.meetings.length === 0) {
    return { status: "untimed", label: "Untimed Course" };
  }

  return { status: "fits", label: "Fits schedule" };
}

export function filterCourseGroups(
  groups: CourseGroup[],
  filter: "all" | "fits" | "major",
  savedSections: Section[],
  savedKeys: string[],
  majorCode: string | null,
  context: SectionFitContext = emptyFitContext,
): CourseGroup[] {
  if (filter === "all") return groups;

  const result: CourseGroup[] = [];

  for (const group of groups) {
    const matchingSections = group.sections.filter((section) => {
      if (filter === "fits") {
        const fit = evaluateSectionFit(section, savedSections, savedKeys, majorCode, context);
        return (
          fit.status !== "overlap" &&
          fit.status !== "duplicate" &&
          fit.status !== "restriction" &&
          fit.status !== "unverified"
        );
      }
      if (filter === "major") {
        return !isMajorIneligible(section, majorCode, context);
      }
      return true;
    });

    if (matchingSections.length > 0) {
      result.push({
        ...group,
        sections: matchingSections,
      });
    }
  }

  return result;
}
