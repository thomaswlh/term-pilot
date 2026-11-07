import { demoCredits } from "./credits";
import { evaluateClassRestrictions, meetingsOverlap } from "./rules";
import { timedMeetings } from "./section";
import type { Day, Meeting, Section } from "./types";

export type SearchMeeting = { day: Day; startMinutes: number; endMinutes: number };

export type SearchHitDetail = {
  sectionKey: string;
  courseCode: string;
  section: string;
  title: string;
  teacher: string;
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
  meetings: SearchMeeting[];
};

export type CourseGroup = {
  courseCode: string;
  title: string;
  credits: number;
  department: string;
  sections: SearchHitDetail[];
};

export type FitStatus =
  | { status: "added"; label: string }
  | { status: "fits"; label: string }
  | { status: "overlap"; label: string; conflictingKey: string; conflictingCourseCode: string }
  | { status: "restriction"; label: string; reason: string }
  | { status: "untimed"; label: string };

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
        credits: demoCredits([hit.courseCode]).total,
        department: hit.department ?? "",
        sections: [hit],
      });
    }
  }

  return Array.from(groupsMap.values());
}

function isMajorRestriction(hit: SearchHitDetail, majorCode: string | null): boolean {
  if (!majorCode || !hit.restriction) return false;
  const classCheck = evaluateClassRestrictions(hit.restriction, majorCode);
  return Boolean(classCheck.classNotFor || classCheck.classFor);
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
): FitStatus {
  if (savedKeys.includes(hit.sectionKey)) {
    return { status: "added", label: "Added" };
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

  if (isMajorRestriction(hit, majorCode)) {
    return { status: "restriction", label: `Not for ${majorCode}`, reason: `Not eligible for major ${majorCode}` };
  }

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
): CourseGroup[] {
  if (filter === "all") return groups;

  const result: CourseGroup[] = [];

  for (const group of groups) {
    const matchingSections = group.sections.filter((section) => {
      if (filter === "fits") {
        return overlappingSavedSection(section, savedSections, savedKeys) === null;
      }
      if (filter === "major") {
        return !isMajorRestriction(section, majorCode);
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
