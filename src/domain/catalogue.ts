import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

import type { Catalogue, Day, Major, Meeting, PrereqRow, Section } from "./types";

export type {
  Catalogue,
  Day,
  Major,
  Meeting,
  PrereqRow,
  Section,
} from "./types";

export const CATALOGUE_FILES = {
  schedule: {
    file: "docs/ref/add-drop/Class Schedules for 1st Semester of Academic Year 2026-2027  (2026-09-23) (1).xlsx",
    sheet: "Class Information",
  },
  prerequisites: {
    file: "docs/ref/add-drop/Pre-requisite Requirements (2026-09-18) (3).xlsx",
    sheet: "Pre-requisite Requirements",
  },
  majors: {
    file: "docs/ref/add-drop/Major and Specialization Codes (2026-08-04) (1).xlsx",
    sheet: "Major & Spec List",
  },
} as const;

export type CatalogueFileSet = typeof CATALOGUE_FILES;

export { parseSectionKey, sectionKey, timedMeetings } from "./section";

export function loadCatalogue(paths: Partial<CatalogueFileSet> = {}): Catalogue {
  const files = { ...CATALOGUE_FILES, ...paths };
  return {
    sections: loadSections(files.schedule.file, files.schedule.sheet),
    prerequisites: loadPrerequisites(files.prerequisites.file, files.prerequisites.sheet),
    majors: loadMajors(files.majors.file, files.majors.sheet),
  };
}

function normalizeHeader(value: string): string {
  return value
    .replace(/"/g, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function readSheetRows(file: string, sheetName: string): string[][] {
  const resolved = path.resolve(process.cwd(), file);
  const workbook = XLSX.read(fs.readFileSync(resolved), { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Missing sheet: ${sheetName}`);
  }
  return XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as string[][];
}

function findHeaderRow(rows: string[][], predicate: (normalized: string) => boolean): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    for (const cell of row) {
      const normalized = normalizeHeader(String(cell));
      if (normalized && predicate(normalized)) {
        return i;
      }
    }
  }
  throw new Error("Header row not found");
}

function cell(row: string[], index: number | undefined): string {
  if (index === undefined) {
    return "";
  }
  return String(row[index] ?? "").trim();
}

function parseTimeToMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

const DAY_MAP: Record<string, Day> = {
  MON: "MON",
  TUE: "TUE",
  WED: "WED",
  THU: "THU",
  FRI: "FRI",
  SAT: "SAT",
  SUN: "SUN",
};

function parseDay(value: string): Day | null {
  const key = value.trim().toUpperCase();
  return DAY_MAP[key] ?? null;
}

type ScheduleColumns = {
  unit: number;
  department: number;
  courseCode: number;
  courseTitle: number;
  section: number;
  teacher: number;
  notes: number;
  day: number;
  timeFrom: number;
  timeTo: number;
  restriction: number;
};

function resolveScheduleColumns(headerRow: string[]): ScheduleColumns {
  const indices: Partial<Record<keyof ScheduleColumns, number>> = {};
  let restrictionIndex: number | undefined;

  headerRow.forEach((cell, index) => {
    const norm = normalizeHeader(String(cell));
    if (!norm) {
      return;
    }
    if (norm === "course code") {
      indices.courseCode = index;
    } else if (norm === "section") {
      indices.section = index;
    } else if (norm === "course title") {
      indices.courseTitle = index;
    } else if (norm === "offering unit") {
      indices.unit = index;
    } else if (norm === "offering department") {
      indices.department = index;
    } else if (norm === "teacher information") {
      indices.teacher = index;
    } else if (norm === "notes for course enrolment") {
      indices.notes = index;
    } else if (norm === "day") {
      indices.day = index;
    } else if (norm === "time from") {
      indices.timeFrom = index;
    } else if (norm === "time to") {
      indices.timeTo = index;
    } else if (norm.includes("class for") && norm.includes("class not for")) {
      restrictionIndex = index;
    }
  });

  if (
    indices.unit === undefined ||
    indices.department === undefined ||
    indices.courseCode === undefined ||
    indices.courseTitle === undefined ||
    indices.section === undefined ||
    indices.teacher === undefined ||
    indices.notes === undefined ||
    indices.day === undefined ||
    indices.timeFrom === undefined ||
    indices.timeTo === undefined ||
    restrictionIndex === undefined
  ) {
    throw new Error("Incomplete schedule header mapping");
  }

  return {
    unit: indices.unit,
    department: indices.department,
    courseCode: indices.courseCode,
    courseTitle: indices.courseTitle,
    section: indices.section,
    teacher: indices.teacher,
    notes: indices.notes,
    day: indices.day,
    timeFrom: indices.timeFrom,
    timeTo: indices.timeTo,
    restriction: restrictionIndex,
  };
}

function loadSections(file: string, sheet: string): Section[] {
  const rows = readSheetRows(file, sheet);
  const headerIndex = findHeaderRow(rows, (norm) => norm === "course code");
  const columns = resolveScheduleColumns(rows[headerIndex] as string[]);
  const grouped = new Map<string, Section>();

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] as string[];
    const courseCode = cell(row, columns.courseCode);
    const sectionCode = cell(row, columns.section);
    if (!courseCode || !sectionCode) {
      continue;
    }

    const key = `${courseCode}:${sectionCode}`;
    const meeting = buildMeeting(
      cell(row, columns.day),
      cell(row, columns.timeFrom),
      cell(row, columns.timeTo),
    );

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        courseCode,
        section: sectionCode,
        title: cell(row, columns.courseTitle),
        unit: cell(row, columns.unit),
        department: cell(row, columns.department),
        teacher: cell(row, columns.teacher),
        notes: cell(row, columns.notes),
        restriction: cell(row, columns.restriction),
        meetings: [meeting],
      });
    } else {
      existing.meetings.push(meeting);
    }
  }

  return Array.from(grouped.values());
}

function buildMeeting(dayValue: string, fromValue: string, toValue: string): Meeting {
  const day = parseDay(dayValue);
  const startMinutes = parseTimeToMinutes(fromValue);
  const endMinutes = parseTimeToMinutes(toValue);
  if (!day || startMinutes === null || endMinutes === null) {
    return { day: null, startMinutes: null, endMinutes: null };
  }
  return { day, startMinutes, endMinutes };
}

type PrereqColumns = {
  courseCode: number;
  preRequisiteFor: number;
  majorList: number;
  requiredCount: number;
  groupNo: number;
  requiredCourseCode: number;
};

function resolvePrereqColumns(headerRow: string[]): PrereqColumns {
  const indices: Partial<Record<keyof PrereqColumns, number>> = {};

  headerRow.forEach((cell, index) => {
    const norm = normalizeHeader(String(cell));
    if (!norm) {
      return;
    }
    if (norm === "course code") {
      indices.courseCode = index;
    } else if (norm.includes("pre-requisite for")) {
      indices.preRequisiteFor = index;
    } else if (norm === "major list") {
      indices.majorList = index;
    } else if (norm.includes("no.") && norm.includes("course") && norm.includes("required")) {
      indices.requiredCount = index;
    } else if (norm === "group no") {
      indices.groupNo = index;
    } else if (norm === "pre-requisite course code") {
      indices.requiredCourseCode = index;
    }
  });

  if (
    indices.courseCode === undefined ||
    indices.preRequisiteFor === undefined ||
    indices.majorList === undefined ||
    indices.requiredCount === undefined ||
    indices.groupNo === undefined ||
    indices.requiredCourseCode === undefined
  ) {
    throw new Error("Incomplete prerequisite header mapping");
  }

  return indices as PrereqColumns;
}

function loadPrerequisites(file: string, sheet: string): PrereqRow[] {
  const rows = readSheetRows(file, sheet);
  const headerIndex = findHeaderRow(rows, (norm) => norm === "course code");
  const columns = resolvePrereqColumns(rows[headerIndex] as string[]);
  const results: PrereqRow[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] as string[];
    const courseCode = cell(row, columns.courseCode);
    if (!courseCode) {
      continue;
    }

    results.push({
      courseCode,
      preRequisiteFor: cell(row, columns.preRequisiteFor),
      majorList: cell(row, columns.majorList),
      requiredCount: Number(cell(row, columns.requiredCount)) || 0,
      groupNo: cell(row, columns.groupNo),
      requiredCourseCode: cell(row, columns.requiredCourseCode),
    });
  }

  return results;
}

type MajorColumns = {
  major: number;
  description: number;
};

function resolveMajorColumns(headerRow: string[]): MajorColumns {
  const indices: Partial<Record<keyof MajorColumns, number>> = {};

  headerRow.forEach((cell, index) => {
    const norm = normalizeHeader(String(cell));
    if (norm === "major") {
      indices.major = index;
    } else if (norm === "major description") {
      indices.description = index;
    }
  });

  if (indices.major === undefined || indices.description === undefined) {
    throw new Error("Incomplete majors header mapping");
  }

  return indices as MajorColumns;
}

function loadMajors(file: string, sheet: string): Major[] {
  const rows = readSheetRows(file, sheet);
  const headerIndex = findHeaderRow(rows, (norm) => norm === "major");
  const columns = resolveMajorColumns(rows[headerIndex] as string[]);
  const seen = new Set<string>();
  const majors: Major[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] as string[];
    const code = cell(row, columns.major);
    if (!code) {
      continue;
    }
    if (seen.has(code)) {
      continue;
    }
    seen.add(code);
    majors.push({
      code,
      name: cell(row, columns.description),
    });
  }

  return majors;
}
