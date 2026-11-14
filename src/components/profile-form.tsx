"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ADMISSION_COHORTS,
  addPresetCourses,
  PORTUGUESE_I_CODE,
  UNIVERSITY_CHINESE_CODE,
  UNIVERSITY_ENGLISH_CODES,
  type AdmissionCohort,
  type CourseRecord,
  type CourseStatus,
} from "@/domain/academic";
import { exampleStudents } from "@/domain/examples";
import type { Major } from "@/domain/types";
import { ChevronDownIcon, XIcon } from "lucide-react";

type YearOfStudy = 1 | 2 | 3 | 4 | 5;

type Props = {
  majors: Major[];
  initialMajorCode: string | null;
  courses: CourseRecord[];
  yearOfStudy: YearOfStudy | null;
  admissionCohort: AdmissionCohort | null;
  interests: string | null;
};

const YEAR_OPTIONS: YearOfStudy[] = [1, 2, 3, 4, 5];

const STATUS_OPTIONS: { value: CourseStatus; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "waived", label: "Waived or tested out" },
  { value: "transfer", label: "Transfer equivalent" },
];

const labelStyle = {
  display: "block",
  marginBottom: "0.5rem",
  fontWeight: 600,
  fontSize: "0.9375rem",
} as const;

const helperStyle = {
  margin: "0 0 0.65rem",
  color: "var(--muted)",
  fontSize: "0.875rem",
  lineHeight: 1.45,
} as const;

const controlStyle = {
  height: 40,
  borderRadius: 8,
  background: "var(--field)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
  padding: "0 0.75rem",
  font: "inherit",
  width: "100%",
} as const;

function formatMajorLabel(m: Major): string {
  return `${m.code} — ${m.name}`;
}

function errorMessageFromJson(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string") {
    return (data as { error: string }).error;
  }
  return fallback;
}

function copyCourse(course: CourseRecord): CourseRecord {
  return { ...course };
}

function courseForSave(course: CourseRecord): CourseRecord {
  if (course.status === "completed") {
    return {
      courseCode: course.courseCode,
      status: "completed",
      recognizesPrerequisite: false,
      reason: null,
    };
  }
  const reason = course.reason?.trim() ?? "";
  return {
    courseCode: course.courseCode,
    status: course.status,
    recognizesPrerequisite: course.recognizesPrerequisite,
    reason: reason.length > 0 ? reason : null,
  };
}

export function ProfileForm({
  majors,
  initialMajorCode,
  courses: initialCourses,
  yearOfStudy: initialYearOfStudy,
  admissionCohort: initialAdmissionCohort,
  interests: initialInterests,
}: Props) {
  const router = useRouter();
  const sorted = useMemo(() => [...majors].sort((a, b) => a.code.localeCompare(b.code)), [majors]);
  const [majorCode, setMajorCode] = useState<string | null>(initialMajorCode);
  const [courses, setCourses] = useState<CourseRecord[]>(() => initialCourses.map(copyCourse));
  const [yearOfStudy, setYearOfStudy] = useState<YearOfStudy | null>(initialYearOfStudy);
  const [admissionCohort, setAdmissionCohort] = useState<AdmissionCohort | null>(initialAdmissionCohort);
  const [interests, setInterests] = useState(initialInterests ?? "");
  const [courseInput, setCourseInput] = useState("");
  const [draftStatus, setDraftStatus] = useState<CourseStatus>("completed");
  const [englishCodes, setEnglishCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exampleBusyId, setExampleBusyId] = useState<string | null>(null);

  const selectedMajor = majorCode ? sorted.find((m) => m.code === majorCode) : undefined;
  const listedCodes = new Set(courses.map((course) => course.courseCode));

  function addCourse() {
    const courseCode = courseInput.trim().toUpperCase();
    if (!courseCode) return;
    setCourses((prev) => {
      if (prev.some((course) => course.courseCode === courseCode)) return prev;
      return [
        ...prev,
        {
          courseCode,
          status: draftStatus,
          recognizesPrerequisite: false,
          reason: null,
        },
      ];
    });
    setCourseInput("");
    setDraftStatus("completed");
    setError(null);
  }

  function removeCourse(courseCode: string) {
    setCourses((prev) => prev.filter((course) => course.courseCode !== courseCode));
  }

  function setCourseStatus(courseCode: string, status: CourseStatus) {
    setCourses((prev) =>
      prev.map((course) => {
        if (course.courseCode !== courseCode) return course;
        if (status === "completed" || course.status === "completed") {
          return { ...course, status, recognizesPrerequisite: false, reason: null };
        }
        return { ...course, status };
      }),
    );
  }

  function setCourseRecognition(courseCode: string, recognizesPrerequisite: boolean) {
    setCourses((prev) =>
      prev.map((course) =>
        course.courseCode === courseCode ? { ...course, recognizesPrerequisite } : course,
      ),
    );
  }

  function setCourseReason(courseCode: string, reason: string) {
    setCourses((prev) =>
      prev.map((course) => (course.courseCode === courseCode ? { ...course, reason } : course)),
    );
  }

  function addEnglish() {
    setCourses((prev) => addPresetCourses(prev, [...englishCodes]));
    setEnglishCodes([]);
  }

  function addSinglePreset(code: string) {
    setCourses((prev) => addPresetCourses(prev, [code]));
  }

  async function saveProfile() {
    if (!majorCode) {
      setError("Choose a major before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    const trimmedInterests = interests.trim();
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          majorCode,
          courses: courses.map(courseForSave),
          yearOfStudy,
          admissionCohort,
          interests: trimmedInterests.length > 0 ? trimmedInterests : null,
        }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      let data: unknown = null;
      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          setError("The server response was not valid JSON.");
          return;
        }
      } else if (!res.ok) {
        setError("Could not save profile.");
        return;
      }
      if (!res.ok) {
        setError(errorMessageFromJson(data, "Could not save profile."));
        return;
      }
      router.push("/timetables");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function runExample(exampleId: (typeof exampleStudents)[number]["id"]) {
    setExampleBusyId(exampleId);
    setError(null);
    try {
      const res = await fetch("/api/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exampleId }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      let data: unknown = null;
      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          setError("The server response was not valid JSON.");
          return;
        }
      } else if (!res.ok) {
        setError("Could not apply example.");
        return;
      }
      if (!res.ok) {
        setError(errorMessageFromJson(data, "Could not apply example."));
        return;
      }
      router.push("/timetables");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setExampleBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section
        style={{
          background: "var(--sheet)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: 24,
          boxShadow: "var(--shadow)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label htmlFor="major-select" style={labelStyle}>
              Major
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger
                nativeButton
                render={
                  <Button
                    type="button"
                    variant="outline"
                    id="major-select"
                    aria-label="Major"
                    style={{
                      width: "100%",
                      justifyContent: "space-between",
                      height: 40,
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      background: "var(--field)",
                      color: "var(--ink)",
                    }}
                  />
                }
              >
                <span style={{ textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", color: selectedMajor ? "var(--ink)" : "var(--muted)" }}>
                  {selectedMajor ? formatMajorLabel(selectedMajor) : "Select major (code and name)"}
                </span>
                <ChevronDownIcon aria-hidden style={{ opacity: 0.7, flexShrink: 0 }} />
              </DropdownMenuTrigger>
              <DropdownMenuContent style={{ maxHeight: "min(60vh, 320px)", overflowY: "auto", minWidth: "var(--radix-dropdown-menu-trigger-width)" }}>
                {sorted.map((m) => (
                  <DropdownMenuItem key={m.code} onClick={() => setMajorCode(m.code)}>
                    {formatMajorLabel(m)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <div>
              <label htmlFor="year-of-study" style={labelStyle}>
                Year
              </label>
              <select
                id="year-of-study"
                value={yearOfStudy ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setYearOfStudy(value === "" ? null : (Number(value) as YearOfStudy));
                }}
                style={controlStyle}
              >
                <option value="">Not specified</option>
                {YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>
                    Year {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="admission-cohort" style={labelStyle}>
                Admission cohort
              </label>
              <select
                id="admission-cohort"
                value={admissionCohort ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setAdmissionCohort(value === "" ? null : (value as AdmissionCohort));
                }}
                style={controlStyle}
              >
                <option value="">Not specified</option>
                {ADMISSION_COHORTS.map((cohort) => (
                  <option key={cohort} value={cohort}>
                    {cohort}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="interests" style={labelStyle}>
                Interests
              </label>
              <Textarea
                id="interests"
                value={interests}
                maxLength={200}
                onChange={(event) => setInterests(event.target.value)}
                style={{
                  width: "100%",
                  minHeight: 88,
                  borderRadius: 8,
                  background: "var(--field)",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                }}
              />
            </div>

            <p style={{ ...helperStyle, margin: 0 }}>
              These fields shape suggestions and policy wording. Leaving them blank does not change scheduling.
            </p>
          </div>

          <div>
            <h2 style={{ ...labelStyle, marginTop: 0 }}>
              Courses
            </h2>
            <p style={helperStyle}>
              This list is what you report to TermPilot. The checkbox does not record earned credits or graduation progress.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "0.9rem" }}>
              {courses.map((course) => (
                <div
                  key={course.courseCode}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.65rem",
                    padding: "0.75rem",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    background: "var(--field)",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "2px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--line)",
                        background: "var(--sheet)",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {course.courseCode}
                    </span>
                    <select
                      aria-label={`Status for ${course.courseCode}`}
                      value={course.status}
                      onChange={(event) => setCourseStatus(course.courseCode, event.target.value as CourseStatus)}
                      style={{ ...controlStyle, width: "auto", minWidth: 180, flex: "1 1 180px" }}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeCourse(course.courseCode)}
                      aria-label={`Remove ${course.courseCode}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                        background: "var(--sheet)",
                        cursor: "pointer",
                        padding: 0,
                        color: "var(--ink)",
                      }}
                    >
                      <XIcon aria-hidden size={14} />
                    </button>
                  </div>
                  {course.status === "completed" ? null : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.6rem",
                          minHeight: 44,
                          cursor: "pointer",
                          lineHeight: 1.4,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={course.recognizesPrerequisite}
                          onChange={(event) => setCourseRecognition(course.courseCode, event.target.checked)}
                          style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
                        />
                        <span>UM has recognized this for prerequisites</span>
                      </label>
                      <label htmlFor={`reason-${course.courseCode}`} style={{ ...labelStyle, marginBottom: 0 }}>
                        Reason
                      </label>
                      <Input
                        id={`reason-${course.courseCode}`}
                        value={course.reason ?? ""}
                        maxLength={160}
                        onChange={(event) => setCourseReason(course.courseCode, event.target.value)}
                        style={controlStyle}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "stretch" }}>
              <Input
                id="course-code"
                value={courseInput}
                onChange={(event) => setCourseInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCourse();
                  }
                }}
                placeholder="e.g. CSCI1001"
                aria-label="Course code"
                style={{ ...controlStyle, flex: "1 1 180px" }}
              />
              <select
                aria-label="Status for the course to add"
                value={draftStatus}
                onChange={(event) => setDraftStatus(event.target.value as CourseStatus)}
                style={{ ...controlStyle, width: "auto", minWidth: 180, flex: "1 1 180px" }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={addCourse}
                style={{ flexShrink: 0, height: 40, borderRadius: 8 }}
              >
                Add
              </Button>
            </div>
          </div>

          <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            <legend style={{ ...labelStyle, padding: 0 }}>University English</legend>
            {UNIVERSITY_ENGLISH_CODES.map((code) => {
              const already = listedCodes.has(code);
              return (
                <label
                  key={code}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.6rem",
                    minHeight: 44,
                    cursor: already ? "default" : "pointer",
                    lineHeight: 1.4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!already && englishCodes.includes(code)}
                    disabled={already}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setEnglishCodes((prev) =>
                        checked ? (prev.includes(code) ? prev : [...prev, code]) : prev.filter((item) => item !== code),
                      );
                    }}
                    style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
                  />
                  <span>
                    {code}
                    {already ? " Already on the list." : ""}
                  </span>
                </label>
              );
            })}
            <div>
              <Button
                type="button"
                variant="secondary"
                onClick={addEnglish}
                style={{ height: 40, borderRadius: 8 }}
              >
                Add selected English
              </Button>
            </div>
          </fieldset>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => addSinglePreset(UNIVERSITY_CHINESE_CODE)}
              style={{ height: 40, borderRadius: 8 }}
            >
              Add {UNIVERSITY_CHINESE_CODE}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => addSinglePreset(PORTUGUESE_I_CODE)}
              style={{ height: 40, borderRadius: 8 }}
            >
              Add {PORTUGUESE_I_CODE}
            </Button>
          </div>
          <p style={{ ...helperStyle, margin: 0 }}>
            Add any other language code yourself. CSCI1000 is not in these presets.
          </p>

          <div>
            <Button
              type="button"
              variant="default"
              onClick={saveProfile}
              disabled={saving}
              style={{
                height: 36,
                borderRadius: 8,
                background: "var(--accent)",
                color: "#FFFFFF",
                paddingLeft: "1.25rem",
                paddingRight: "1.25rem",
              }}
            >
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </div>

          {error ? (
            <p role="alert" style={{ margin: 0, color: "var(--rose)", fontSize: "0.9375rem" }}>
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <section
        style={{
          background: "var(--sheet)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: 24,
          boxShadow: "var(--shadow)",
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Examples</h2>
        <p style={{ margin: "0 0 1rem", color: "var(--muted)", lineHeight: 1.5, maxWidth: "52ch" }}>
          Secondary shortcuts: each applies a synthetic major, completed list, and a starter timetable. Existing timetables stay in your library.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "stretch" }}>
          {exampleStudents.map((ex) => (
            <Button
              key={ex.id}
              type="button"
              variant="secondary"
              onClick={() => runExample(ex.id)}
              disabled={exampleBusyId !== null}
              aria-label={`Apply ${ex.label}`}
              style={{
                justifyContent: "flex-start",
                minHeight: "2.5rem",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--sheet)",
                color: "var(--ink)",
              }}
            >
              {exampleBusyId === ex.id ? "Applying…" : ex.label}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
