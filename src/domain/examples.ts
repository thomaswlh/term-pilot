import type { Store } from "../db/store";
import { coursesFromCompleted } from "./academic";

export type ExampleStudent = {
  id: "computer-science" | "chinese" | "japanese";
  label: string;
  majorCode: string;
  completed: string[];
  timetableTitle: string;
  sectionKeys: string[];
};

export const exampleStudents: ExampleStudent[] = [
  {
    id: "computer-science",
    label: "Computer Science example",
    majorCode: "CPS19",
    completed: ["CSCI1001"],
    timetableTitle: "Computer science starter",
    sectionKeys: ["CSCI1004:001", "GELH1012:001"],
  },
  {
    id: "chinese",
    label: "Chinese Language example",
    majorCode: "CLL19",
    completed: ["CHLL1003"],
    timetableTitle: "Chinese literature starter",
    sectionKeys: ["CHLL1000:002", "CHLL2004:001"],
  },
  {
    id: "japanese",
    label: "Japanese Studies example",
    majorCode: "JAP25",
    completed: [],
    timetableTitle: "Japanese starter",
    sectionKeys: ["JAPN1000:001"],
  },
];

export async function applyExample(
  store: Store,
  userId: string,
  exampleId: ExampleStudent["id"],
): Promise<void> {
  const ex = exampleStudents.find((row) => row.id === exampleId);
  if (!ex) {
    throw new Error(`Unknown example: ${exampleId}`);
  }
  await store.saveProfile(userId, {
    majorCode: ex.majorCode,
    courses: coursesFromCompleted([...ex.completed]),
    yearOfStudy: null,
    admissionCohort: null,
    interests: null,
  });
  const timetable = await store.createTimetable(userId, ex.timetableTitle);
  await store.writeSections(userId, timetable.id, [...ex.sectionKeys], 1);
}
