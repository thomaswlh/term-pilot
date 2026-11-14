import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type StudyPlanKind =
  | "compulsory"
  | "required-elective"
  | "compulsory-general-education"
  | "general-education";
export type StudyVerification = "verified" | "sources-disagree";

export type StudyPlanCourse = {
  sourceCode: string;
  catalogueCode: string | null;
  kind: StudyPlanKind;
  suggestedYear: 1 | 2 | 3 | 4 | 5 | null;
  suggestedSemester: 1 | 2 | null;
  stream: string | null;
  verification: StudyVerification;
  mapping: {
    sourceCode: string;
    catalogueCode: string;
    title: string;
    url: string;
    retrievedAt: string;
  } | null;
};

export type StudyPlan = {
  majorCode: string;
  curriculumYear: number | null;
  source: { title: string; url: string; retrievedAt: string };
  courses: StudyPlanCourse[];
};

const STUDY_PLAN_KINDS = new Set<StudyPlanKind>([
  "compulsory",
  "required-elective",
  "compulsory-general-education",
  "general-education",
]);

const STUDY_VERIFICATIONS = new Set<StudyVerification>(["verified", "sources-disagree"]);

const SUGGESTED_YEARS = new Set([1, 2, 3, 4, 5]);
const SUGGESTED_SEMESTERS = new Set([1, 2]);

const SAFE_MAJOR_CODE = /^[A-Za-z0-9]+$/;

function studyPlansDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "data", "study-plans");
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value as Record<string, unknown>;
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function parseSource(value: unknown): StudyPlan["source"] {
  const record = assertRecord(value, "source");
  return {
    title: assertString(record.title, "source.title"),
    url: assertString(record.url, "source.url"),
    retrievedAt: assertString(record.retrievedAt, "source.retrievedAt"),
  };
}

function parseMapping(value: unknown): StudyPlanCourse["mapping"] {
  if (value === null) {
    return null;
  }
  const record = assertRecord(value, "mapping");
  return {
    sourceCode: assertString(record.sourceCode, "mapping.sourceCode"),
    catalogueCode: assertString(record.catalogueCode, "mapping.catalogueCode"),
    title: assertString(record.title, "mapping.title"),
    url: assertString(record.url, "mapping.url"),
    retrievedAt: assertString(record.retrievedAt, "mapping.retrievedAt"),
  };
}

function parseSuggestedYear(value: unknown): StudyPlanCourse["suggestedYear"] {
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !SUGGESTED_YEARS.has(value)) {
    throw new Error("Invalid suggestedYear");
  }
  return value as StudyPlanCourse["suggestedYear"];
}

function parseSuggestedSemester(value: unknown): StudyPlanCourse["suggestedSemester"] {
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !SUGGESTED_SEMESTERS.has(value)) {
    throw new Error("Invalid suggestedSemester");
  }
  return value as StudyPlanCourse["suggestedSemester"];
}

function parseCourse(value: unknown): StudyPlanCourse {
  const record = assertRecord(value, "course");
  const sourceCode = assertString(record.sourceCode, "course.sourceCode");
  const catalogueCode =
    record.catalogueCode === null
      ? null
      : assertString(record.catalogueCode, "course.catalogueCode");
  const kind = record.kind;
  if (typeof kind !== "string" || !STUDY_PLAN_KINDS.has(kind as StudyPlanKind)) {
    throw new Error("Invalid course kind");
  }
  const verification = record.verification;
  if (
    typeof verification !== "string" ||
    !STUDY_VERIFICATIONS.has(verification as StudyVerification)
  ) {
    throw new Error("Invalid verification");
  }
  const stream = record.stream === null ? null : assertString(record.stream, "course.stream");
  const mapping = parseMapping(record.mapping);

  if (sourceCode !== catalogueCode && mapping === null) {
    throw new Error("A differing source and catalogue code requires a reviewed mapping");
  }

  return {
    sourceCode,
    catalogueCode,
    kind: kind as StudyPlanKind,
    suggestedYear: parseSuggestedYear(record.suggestedYear),
    suggestedSemester: parseSuggestedSemester(record.suggestedSemester),
    stream,
    verification: verification as StudyVerification,
    mapping,
  };
}

export function parseStudyPlan(value: unknown): StudyPlan {
  const record = assertRecord(value, "study plan");
  const majorCode = assertString(record.majorCode, "majorCode");
  const curriculumYear = record.curriculumYear;
  if (curriculumYear !== null && (typeof curriculumYear !== "number" || !Number.isInteger(curriculumYear))) {
    throw new Error("Invalid curriculumYear");
  }
  if (!Array.isArray(record.courses)) {
    throw new Error("Invalid courses");
  }

  return {
    majorCode,
    curriculumYear: curriculumYear as number | null,
    source: parseSource(record.source),
    courses: record.courses.map((course) => parseCourse(course)),
  };
}

export function loadStudyPlan(majorCode: string): StudyPlan | null {
  if (!SAFE_MAJOR_CODE.test(majorCode)) {
    throw new Error("Invalid major code");
  }
  const filePath = path.join(studyPlansDir(), `${majorCode}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return parseStudyPlan(JSON.parse(raw));
}

export function automaticCourses(plan: StudyPlan, stream: string | null): StudyPlanCourse[] {
  const compulsory: StudyPlanCourse[] = [];
  const streamElectives: StudyPlanCourse[] = [];

  for (const course of plan.courses) {
    if (course.verification !== "verified" || course.catalogueCode === null) {
      continue;
    }
    if (course.kind === "compulsory" || course.kind === "compulsory-general-education") {
      compulsory.push(course);
      continue;
    }
    if (
      course.kind === "required-elective" &&
      stream !== null &&
      stream.length > 0 &&
      course.stream === stream
    ) {
      streamElectives.push(course);
    }
  }

  return [...compulsory, ...streamElectives];
}
