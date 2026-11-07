"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exampleStudents } from "@/domain/examples";
import type { Major } from "@/domain/types";
import { ChevronDownIcon, XIcon } from "lucide-react";

type Props = {
  majors: Major[];
  initialMajorCode: string | null;
  initialCompleted: string[];
};

function formatMajorLabel(m: Major): string {
  return `${m.code} — ${m.name}`;
}

function errorMessageFromJson(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string") {
    return (data as { error: string }).error;
  }
  return fallback;
}

export function ProfileForm({ majors, initialMajorCode, initialCompleted }: Props) {
  const router = useRouter();
  const sorted = useMemo(() => [...majors].sort((a, b) => a.code.localeCompare(b.code)), [majors]);
  const [majorCode, setMajorCode] = useState<string | null>(initialMajorCode);
  const [chips, setChips] = useState<string[]>(() => [...initialCompleted]);
  const [courseInput, setCourseInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exampleBusyId, setExampleBusyId] = useState<string | null>(null);

  const selectedMajor = majorCode ? sorted.find((m) => m.code === majorCode) : undefined;

  function addChip() {
    const code = courseInput.trim().toUpperCase();
    if (!code) return;
    setChips((prev) => (prev.includes(code) ? prev : [...prev, code]));
    setCourseInput("");
    setError(null);
  }

  function removeChip(code: string) {
    setChips((prev) => prev.filter((c) => c !== code));
  }

  async function saveProfile() {
    if (!majorCode) {
      setError("Choose a major before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ majorCode, completed: chips }),
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
            <label htmlFor="major-select" style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.9375rem" }}>
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

          <div>
            <label htmlFor="completed-courses" style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.9375rem" }}>
              Completed courses
            </label>
            <p style={{ margin: "0 0 0.65rem", color: "var(--muted)", fontSize: "0.875rem", lineHeight: 1.45 }}>
              Enter codes you have already taken. Codes can be outside this semester&apos;s offering.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem", minHeight: chips.length ? undefined : "0.5rem" }}>
              {chips.map((code) => (
                <span
                  key={code}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "2px 4px 2px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--line)",
                    background: "var(--field)",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {code}
                  <button
                    type="button"
                    onClick={() => removeChip(code)}
                    aria-label={`Remove ${code}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 24,
                      height: 24,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      padding: 0,
                      color: "var(--ink)",
                    }}
                  >
                    <XIcon aria-hidden size={14} />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch" }}>
              <Input
                id="completed-courses"
                value={courseInput}
                onChange={(e) => setCourseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChip();
                  }
                }}
                placeholder="e.g. CSCI1001"
                aria-label="Add completed course code"
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 8,
                  background: "var(--field)",
                  border: "1px solid var(--line)",
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addChip}
                style={{ flexShrink: 0, height: 40, borderRadius: 8 }}
              >
                Add
              </Button>
            </div>
          </div>

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
