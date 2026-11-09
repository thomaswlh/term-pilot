import type { Section } from "../types";

export function courseFields(sections: Section[]): {
  title: string;
  department: string;
  instructor: string;
  notes: string;
} {
  return {
    title: joinedDistinct(sections.map((section) => section.title)),
    department: joinedDistinct(sections.map((section) => section.department)),
    instructor: joinedDistinct(sections.map((section) => section.teacher)),
    notes: joinedDistinct(sections.map((section) => section.notes)),
  };
}

export function courseEmbeddingText(courseCode: string, sections: Section[]): string {
  const fields = courseFields(sections);
  const parts = [courseCode];
  for (const value of [fields.title, fields.department, fields.instructor, fields.notes]) {
    if (value.length > 0) parts.push(value);
  }
  return parts.join(" ");
}

function joinedDistinct(values: string[]): string {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort().join(" | ");
}
