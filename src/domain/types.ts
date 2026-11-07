export type Day = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export type Meeting = {
  day: Day | null;
  startMinutes: number | null;
  endMinutes: number | null;
};

export type Section = {
  courseCode: string;
  section: string;
  title: string;
  unit: string;
  department: string;
  teacher: string;
  notes: string;
  restriction: string;
  meetings: Meeting[];
};

export type PrereqRow = {
  courseCode: string;
  preRequisiteFor: string;
  majorList: string;
  requiredCount: number;
  groupNo: string;
  requiredCourseCode: string;
};

export type Major = { code: string; name: string };

export type Catalogue = {
  sections: Section[];
  prerequisites: PrereqRow[];
  majors: Major[];
};
