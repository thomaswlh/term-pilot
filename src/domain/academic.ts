export type CourseStatus = "completed" | "waived" | "transfer";

export type CourseRecord = {
  courseCode: string;
  status: CourseStatus;
  recognizesPrerequisite: boolean;
  reason: string | null;
};

export type PrerequisiteClaim = {
  courseCode: string;
  basis: "completed" | "waived" | "transfer";
};

export const ADMISSION_COHORTS = [
  "Before 2017/2018",
  "2017/2018",
  "2018/2019",
  "2019/2020",
  "2020/2021",
  "2021/2022",
  "2022/2023",
  "2023/2024",
  "2024/2025",
  "2025/2026",
  "2026/2027",
] as const;

export type AdmissionCohort = (typeof ADMISSION_COHORTS)[number];

export const UNIVERSITY_ENGLISH_CODES = ["EELC1011", "EELC1012", "EELC1013"] as const;
export const UNIVERSITY_CHINESE_CODE = "CHLL1000";
export const PORTUGUESE_I_CODE = "PORT1000";

const STATUS_LABEL: Record<CourseStatus, string> = {
  completed: "completed",
  waived: "waived or tested out",
  transfer: "a transfer equivalent",
};

export function coursesFromCompleted(codes: string[]): CourseRecord[] {
  return codes.map((courseCode) => ({
    courseCode,
    status: "completed",
    recognizesPrerequisite: false,
    reason: null,
  }));
}

export function completedClaims(courseCodes: string[]): PrerequisiteClaim[] {
  return courseCodes.map((courseCode) => ({ courseCode, basis: "completed" as const }));
}

export function prerequisiteClaims(records: CourseRecord[]): PrerequisiteClaim[] {
  const claims: PrerequisiteClaim[] = [];
  for (const record of records) {
    if (record.status === "completed") {
      claims.push({ courseCode: record.courseCode, basis: "completed" });
    } else if (record.recognizesPrerequisite) {
      claims.push({ courseCode: record.courseCode, basis: record.status });
    }
  }
  return claims;
}

export function heldCourseCodes(records: CourseRecord[]): string[] {
  return records.map((record) => record.courseCode);
}

export function resolveCourseRecords({
  courseRecords,
  completed,
}: {
  courseRecords: CourseRecord[] | null;
  completed: string[];
}): CourseRecord[] {
  if (courseRecords === null) {
    return coursesFromCompleted(completed);
  }
  return [...courseRecords];
}

export function addPresetCourses(existing: CourseRecord[], codes: string[]): CourseRecord[] {
  const present = new Set(existing.map((record) => record.courseCode));
  const next = [...existing];
  for (const courseCode of codes) {
    if (present.has(courseCode)) {
      continue;
    }
    present.add(courseCode);
    next.push({
      courseCode,
      status: "waived",
      recognizesPrerequisite: false,
      reason: null,
    });
  }
  return next;
}

export function declaredStatusSentence(courseCode: string, status: CourseStatus): string {
  return `You reported ${courseCode} as ${STATUS_LABEL[status]}. Placed because you asked for it.`;
}

export function automaticSkipSentence(courseCode: string, status: CourseStatus): string {
  return `You reported ${courseCode} as ${STATUS_LABEL[status]}, so it was not added automatically.`;
}

export function prerequisiteReportedSentence(
  targetCourseCode: string,
  prerequisiteCode: string,
  basis: "completed" | "waived" | "transfer",
): string {
  return `Prerequisite for ${targetCourseCode} uses your report that UM recognized ${prerequisiteCode} (${STATUS_LABEL[basis]}). This is student-reported.`;
}

export function statusLine(status: CourseStatus, recognizesPrerequisite: boolean): string {
  const recognition =
    " You reported that UM recognized this for prerequisites.";
  if (status === "completed") {
    return recognizesPrerequisite
      ? "You reported this as completed." + recognition
      : "You reported this as completed.";
  }
  if (status === "waived") {
    return recognizesPrerequisite
      ? "You reported this as waived or tested out." + recognition
      : "You reported this as waived or tested out.";
  }
  return recognizesPrerequisite
    ? `You reported this as ${STATUS_LABEL.transfer}.` + recognition
    : `You reported this as ${STATUS_LABEL.transfer}.`;
}
