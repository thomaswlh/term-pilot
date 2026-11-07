"use client";

import Link from "next/link";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountMenu } from "@/components/account-menu";
import { CopilotPanel } from "@/components/copilot-panel";
import { ProposalList, resolvedProposalSentence, type ProposalListItem } from "@/components/proposal-list";
import type { ProposalStatus } from "@/db/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Week } from "@/components/week";
import { CourseSearchPanel } from "@/components/course-search-panel";
import type { SearchHitDetail } from "@/domain/course-group";
import { demoCredits } from "@/domain/credits";
import type { RuleFailure } from "@/domain/rules";
import { theme } from "@/domain/theme";
import type { Day, Section } from "@/domain/types";
import { buildWeek } from "@/domain/week";
import {
  CHAT_WIDTH_DEFAULT,
  CHAT_WIDTH_MAX,
  CHAT_WIDTH_MIN,
  CHAT_WIDTH_STORAGE_KEY,
  clampChatWidth,
  maxChatWidthForRow,
  parseStoredChatWidth,
} from "@/lib/chat-width";

export type EditorTimetable = {
  id: string;
  title: string;
  revision: number;
  sectionKeys: string[];
};

export type EditorProposal = {
  id: string;
  sectionKeys: string[];
  droppedWishes: string[];
  summary: string;
  sections: Section[];
  failures: RuleFailure[];
  status: ProposalStatus;
  baseRevision: number;
  createdAt: string;
};

type ConfirmAction = "apply" | "save-as-new" | "discard";

const controlButton = {
  borderRadius: 8,
  height: "auto",
  padding: "8px 14px",
} as const;

function courseCodeOf(key: string): string {
  const index = key.indexOf(":");
  return index === -1 ? key : key.slice(0, index);
}

function sectionKeyOf(section: Section): string {
  return `${section.courseCode}:${section.section}`;
}

function changeSentence(currentKeys: string[], finalKeys: string[], droppedWishes: string[]): string {
  const current = new Set(currentKeys);
  const final = new Set(finalKeys);
  const added = [...final].filter((key) => !current.has(key)).sort();
  const removed = [...current].filter((key) => !final.has(key)).sort();
  const parts: string[] = [];
  if (added.length > 0) parts.push(`added ${added.join(", ")}`);
  if (removed.length > 0) parts.push(`removed ${removed.join(", ")}`);
  if (droppedWishes.length > 0) parts.push(`dropped wishes: ${droppedWishes.join(", ")}`);
  if (parts.length === 0) return "No section changes.";
  return `${parts.join("; ")}.`;
}

function mergeSections(current: Section[], proposed: Section[], keys: string[]): Section[] {
  const byKey = new Map<string, Section>();
  for (const section of [...current, ...proposed]) {
    byKey.set(sectionKeyOf(section), section);
  }
  return keys.flatMap((key) => {
    const section = byKey.get(key);
    return section ? [section] : [];
  });
}

function readStringField(data: unknown, field: string): string | null {
  if (typeof data !== "object" || data === null || !(field in data)) return null;
  const value = (data as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

function confirmNotice(status: number, data: unknown): string {
  const reason = readStringField(data, "reason");
  const detail = readStringField(data, "detail");
  if (reason === "stale") return "This timetable changed after that proposal. Ask for a new plan.";
  if (reason === "illegal") return detail ?? "That proposal breaks a scheduling rule. It was not saved.";
  if (reason === "discarded") return "That proposal was already discarded.";
  if (status === 403 || reason === "forbidden") return "You cannot change this proposal.";
  if (status === 404 || reason === "missing") return "That proposal is not available.";
  return "That proposal could not be saved. Try again.";
}

function readError(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string") {
    return (data as { error: string }).error;
  }
  return fallback;
}

function readTimetable(data: unknown): { revision: number; sectionKeys: string[] } | null {
  if (typeof data !== "object" || data === null || !("timetable" in data)) return null;
  const row = (data as { timetable: unknown }).timetable;
  if (typeof row !== "object" || row === null) return null;
  const revision = (row as { revision?: unknown }).revision;
  const sectionKeys = (row as { sectionKeys?: unknown }).sectionKeys;
  if (typeof revision !== "number" || !Array.isArray(sectionKeys)) return null;
  if (!sectionKeys.every((key) => typeof key === "string")) return null;
  return { revision, sectionKeys };
}

function isRuleFailure(value: unknown): value is RuleFailure {
  if (typeof value !== "object" || value === null || !("rule" in value)) return false;
  const rule = (value as { rule: unknown }).rule;
  if (rule === "overlap") {
    const keys = (value as { sectionKeys?: unknown }).sectionKeys;
    return Array.isArray(keys) && keys.length === 2 && keys.every((key) => typeof key === "string");
  }
  if (rule === "unknown-section" || rule === "untimed" || rule === "class-for" || rule === "class-not-for") {
    return typeof (value as { sectionKey?: unknown }).sectionKey === "string";
  }
  if (rule === "prerequisite") {
    const failure = value as { sectionKey?: unknown; groupNo?: unknown; courses?: unknown };
    return typeof failure.sectionKey === "string" && typeof failure.groupNo === "string" && Array.isArray(failure.courses);
  }
  return false;
}

function readFailures(data: unknown): RuleFailure[] {
  if (typeof data !== "object" || data === null || !("failures" in data)) return [];
  const value = (data as { failures: unknown }).failures;
  if (!Array.isArray(value)) return [];
  return value.filter(isRuleFailure);
}

function readHits(data: unknown): SearchHitDetail[] {
  if (typeof data !== "object" || data === null || !("hits" in data)) return [];
  const value = (data as { hits: unknown }).hits;
  if (!Array.isArray(value)) return [];
  return value.filter(isSearchHit);
}

function isSearchHit(value: unknown): value is SearchHitDetail {
  if (typeof value !== "object" || value === null) return false;
  const hit = value as Partial<SearchHitDetail>;
  return (
    typeof hit.sectionKey === "string" &&
    typeof hit.courseCode === "string" &&
    typeof hit.section === "string" &&
    typeof hit.title === "string" &&
    typeof hit.teacher === "string" &&
    Array.isArray(hit.meetings) &&
    (hit.unit === undefined || typeof hit.unit === "string") &&
    (hit.department === undefined || typeof hit.department === "string") &&
    (hit.notes === undefined || typeof hit.notes === "string") &&
    (hit.restriction === undefined || typeof hit.restriction === "string") &&
    (hit.prerequisites === undefined || Array.isArray(hit.prerequisites))
  );
}

function sectionFromHit(hit: SearchHitDetail): Section {
  return {
    courseCode: hit.courseCode,
    section: hit.section,
    title: hit.title,
    unit: hit.unit ?? "",
    department: hit.department ?? "",
    teacher: hit.teacher,
    notes: hit.notes ?? "",
    restriction: hit.restriction ?? "",
    meetings: hit.meetings.map((meeting) => ({ ...meeting })),
  };
}

export function Editor({
  timetable,
  sections,
  credits,
  proposals,
  shareToken: initialShareToken,
  majorCode = null,
}: {
  timetable: EditorTimetable;
  sections: Section[];
  credits: { total: number };
  proposals: EditorProposal[];
  shareToken: string | null;
  majorCode?: string | null;
}) {
  const router = useRouter();
  const skipRename = useRef(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"chat" | "proposals">("chat");
  const [chatWidth, setChatWidth] = useState(CHAT_WIDTH_DEFAULT);
  const [chatLayoutMax, setChatLayoutMax] = useState(CHAT_WIDTH_MAX);
  const [chatResizing, setChatResizing] = useState(false);
  const [chatHandleActive, setChatHandleActive] = useState(false);
  const workspaceRowRef = useRef<HTMLDivElement>(null);
  const chatWidthRef = useRef(chatWidth);
  const chatDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    chatWidthRef.current = chatWidth;
  }, [chatWidth]);

  useEffect(() => {
    try {
      const stored = parseStoredChatWidth(localStorage.getItem(CHAT_WIDTH_STORAGE_KEY));
      requestAnimationFrame(() => {
        setChatWidth(stored);
      });
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    const row = workspaceRowRef.current;
    if (!row) return;
    const syncLayoutMax = () => {
      const max = maxChatWidthForRow(row.clientWidth);
      setChatLayoutMax(max);
      setChatWidth((width) => clampChatWidth(width, max));
    };
    syncLayoutMax();
    const observer = new ResizeObserver(syncLayoutMax);
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  function persistChatWidth(width: number) {
    try {
      localStorage.setItem(CHAT_WIDTH_STORAGE_KEY, String(width));
    } catch {
      /* storage unavailable */
    }
  }

  function setChatWidthClamped(next: number) {
    const row = workspaceRowRef.current;
    const ceiling = row ? maxChatWidthForRow(row.clientWidth) : chatLayoutMax;
    const width = clampChatWidth(next, ceiling);
    chatWidthRef.current = width;
    setChatWidth(width);
    return width;
  }

  function onChatResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const row = workspaceRowRef.current;
    const ceiling = row ? maxChatWidthForRow(row.clientWidth) : chatLayoutMax;
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = chatWidthRef.current - 16;
    if (event.key === "ArrowRight") next = chatWidthRef.current + 16;
    if (event.key === "Home") next = CHAT_WIDTH_MIN;
    if (event.key === "End") next = ceiling;
    if (next == null) return;
    event.preventDefault();
    const width = setChatWidthClamped(next);
    persistChatWidth(width);
  }

  function onChatResizePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    chatDragRef.current = { startX: event.clientX, startWidth: chatWidthRef.current };
    setChatResizing(true);
  }

  function onChatResizePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!chatDragRef.current) return;
    const delta = event.clientX - chatDragRef.current.startX;
    setChatWidthClamped(chatDragRef.current.startWidth + delta);
  }

  function finishChatResize() {
    if (!chatDragRef.current) return;
    chatDragRef.current = null;
    setChatResizing(false);
    persistChatWidth(chatWidthRef.current);
  }

  function onChatResizeDoubleClick() {
    const width = setChatWidthClamped(CHAT_WIDTH_DEFAULT);
    persistChatWidth(width);
  }
  const [title, setTitle] = useState(timetable.title);
  const [syncedTitle, setSyncedTitle] = useState(timetable.title);
  const [titleFocused, setTitleFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHitDetail[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [focusNonce, setFocusNonce] = useState(0);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"error" | "info">("error");
  const report = useCallback((text: string | null, tone: "error" | "info" = "error") => {
    setNoticeTone(tone);
    setNotice(text);
  }, []);
  const [failures, setFailures] = useState<RuleFailure[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [prevInitialShareToken, setPrevInitialShareToken] = useState(initialShareToken);
  if (initialShareToken !== prevInitialShareToken) {
    setPrevInitialShareToken(initialShareToken);
    setShareToken(initialShareToken);
  }
  const [shareBusy, setShareBusy] = useState(false);

  function clearCopiedResetTimer() {
    if (copiedResetTimer.current !== null) {
      clearTimeout(copiedResetTimer.current);
      copiedResetTimer.current = null;
    }
  }

  function showCopiedConfirmation() {
    clearCopiedResetTimer();
    setCopied(true);
    copiedResetTimer.current = setTimeout(() => {
      copiedResetTimer.current = null;
      setCopied(false);
    }, 2000);
  }

  useEffect(() => () => clearCopiedResetTimer(), []);
  const [confirming, setConfirming] = useState<ConfirmAction | null>(null);
  const [proposalRecords, setProposalRecords] = useState(proposals);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const proposalSignature = proposals
    .map(
      (item) =>
        `${item.id}\0${item.status}\0${item.createdAt}\0${item.baseRevision}\0${item.sectionKeys.join(",")}\0${item.droppedWishes.join(",")}\0${item.summary}`,
    )
    .join("\n");
  const [syncedProposals, setSyncedProposals] = useState(proposalSignature);
  const [live, setLive] = useState({
    revision: timetable.revision,
    sectionKeys: timetable.sectionKeys,
    sections,
  });

  const serverKeySignature = timetable.sectionKeys.join("\0");
  const serverSignature = `${timetable.revision}\0${serverKeySignature}`;
  const [syncedSignature, setSyncedSignature] = useState(serverSignature);
  if (timetable.title !== syncedTitle) {
    setSyncedTitle(timetable.title);
    setTitle(timetable.title);
  }
  if (serverSignature !== syncedSignature) {
    setSyncedSignature(serverSignature);
    setLive((current) => {
      if (timetable.revision < current.revision) return current;
      return {
        revision: timetable.revision,
        sectionKeys: timetable.sectionKeys,
        sections,
      };
    });
  }
  if (proposalSignature !== syncedProposals) {
    setSyncedProposals(proposalSignature);
    setProposalRecords(proposals);
    setSelectedId((current) => (current !== null && proposals.some((item) => item.id === current) ? current : null));
  }
  const selected = proposalRecords.find((item) => item.id === selectedId) ?? null;
  const openSelected = selected !== null && selected.status === "open";

  function chooseProposal(proposalId: string) {
    setSelectedId(proposalId);
    router.refresh();
  }

  const scheduleSearch = useCallback(
    (value: string) => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchAbort.current?.abort();
      const q = value.trim();
      if (!q) {
        setHits([]);
        setHoveredKey(null);
        setPinnedKey(null);
        setSearching(false);
        return;
      }
      searchTimer.current = setTimeout(() => {
        const controller = new AbortController();
        searchAbort.current = controller;
        setSearching(true);
        setRecentQueries((prev) => [q, ...prev.filter((item) => item !== q)].slice(0, 5));
        void (async () => {
          try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
            const data: unknown = await res.json().catch(() => null);
            if (!res.ok) {
              setHits([]);
              setHoveredKey(null);
              setPinnedKey(null);
              report(readError(data, "Search is unavailable right now."));
              return;
            }
            const nextHits = readHits(data);
            setHits(nextHits);
            setHoveredKey(null);
            setPinnedKey((current) => (current && nextHits.some((h) => h.sectionKey === current) ? current : null));
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;
            setHits([]);
            setHoveredKey(null);
            setPinnedKey(null);
            report("Could not reach the server. Check your connection and try again.");
          } finally {
            if (!controller.signal.aborted) setSearching(false);
          }
        })();
      }, 200);
    },
    [report],
  );

  function expandChat() {
    setChatOpen(true);
    if (window.innerWidth < 1600) setSearchOpen(false);
  }

  function collapseChat() {
    setChatOpen(false);
  }

  function expandSearch() {
    setSearchOpen(true);
    setFocusNonce((nonce) => nonce + 1);
    if (window.innerWidth < 1600) setChatOpen(false);
  }

  function collapseSearch() {
    setSearchOpen(false);
    setPinnedKey(null);
    setHoveredKey(null);
  }

  useEffect(() => {
    function enforceColumns() {
      if (window.innerWidth < 1600 && chatOpen && searchOpen) {
        setSearchOpen(false);
        setPinnedKey(null);
        setHoveredKey(null);
      }
    }
    enforceColumns();
    window.addEventListener("resize", enforceColumns);
    return () => window.removeEventListener("resize", enforceColumns);
  }, [chatOpen, searchOpen]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      const isSearchInput =
        target instanceof HTMLElement && target.tagName === "INPUT" && target.id === "course-search-query";
      const editable =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.tagName === "INPUT");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        expandSearch();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        if (chatOpen) collapseChat();
        else expandChat();
        return;
      }
      if (event.key === "/" && !editable && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        expandSearch();
        return;
      }
      if (event.key === "Escape" && (!editable || isSearchInput)) {
        if (query.trim()) {
          setQuery("");
          setPinnedKey(null);
          setHoveredKey(null);
          scheduleSearch("");
          return;
        }
        collapseSearch();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, query, scheduleSearch]);

  const activePreviewKey = !searchOpen || selected !== null ? null : (hoveredKey ?? pinnedKey);
  const activePreviewHit = activePreviewKey ? hits.find((hit) => hit.sectionKey === activePreviewKey) : null;

  const week = buildWeek({
    saved: live.sections,
    proposal: selected ? selected.sections : null,
    savedKeys: live.sectionKeys,
    failures: selected ? selected.failures : failures,
    preview: activePreviewHit ? sectionFromHit(activePreviewHit) : null,
  });
  const proposalCredits = selected ? demoCredits(selected.sectionKeys.map(courseCodeOf)) : null;
  const proposalSentence = selected
    ? changeSentence(live.sectionKeys, selected.sectionKeys, selected.droppedWishes)
    : null;
  const liveKeySignature = live.sectionKeys.join("\0");
  const creditTotal =
    liveKeySignature === serverKeySignature ? credits.total : new Set(live.sectionKeys.map(courseCodeOf)).size * 3;

  async function saveTitle() {
    const next = title.trim();
    if (!next) {
      report("Enter a title.");
      setTitle(timetable.title);
      return;
    }
    if (next === timetable.title) return;
    try {
      const res = await fetch(`/api/timetables/${timetable.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        report(readError(data, "Could not rename this timetable."));
        setTitle(timetable.title);
        return;
      }
      report(null);
      router.refresh();
    } catch {
      report("Could not reach the server. Check your connection and try again.");
    }
  }

  async function copyShareUrl(token: string) {
    const url = `${window.location.origin}/s/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      showCopiedConfirmation();
    } catch {
      clearCopiedResetTimer();
      setCopied(false);
      report("Could not copy the link. Select the address after you open the timetable.");
    }
  }

  async function share() {
    if (shareBusy) return;
    setShareBusy(true);
    report(null);
    try {
      let token = shareToken;
      if (!token) {
        const res = await fetch(`/api/timetables/${timetable.id}/share`, { method: "POST" });
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          report(readError(data, "Could not create a share link."));
          return;
        }
        const next =
          typeof data === "object" && data !== null && "token" in data && typeof (data as { token: unknown }).token === "string"
            ? (data as { token: string }).token
            : null;
        if (!next) {
          report("Could not create a share link.");
          return;
        }
        token = next;
        setShareToken(token);
      }
      await copyShareUrl(token);
    } catch {
      report("Could not reach the server. Check your connection and try again.");
    } finally {
      setShareBusy(false);
    }
  }

  async function stopSharing() {
    if (shareBusy || !shareToken) return;
    setShareBusy(true);
    report(null);
    clearCopiedResetTimer();
    setCopied(false);
    try {
      const res = await fetch(`/api/timetables/${timetable.id}/share`, { method: "DELETE" });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        report(readError(data, "Could not stop sharing."));
        return;
      }
      setShareToken(null);
    } catch {
      report("Could not reach the server. Check your connection and try again.");
    } finally {
      setShareBusy(false);
    }
  }

  async function add(hit: SearchHitDetail) {
    if (openSelected) return;
    setBusyKey(hit.sectionKey);
    report(null);
    setFailures([]);
    try {
      const res = await fetch(`/api/timetables/${timetable.id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionKey: hit.sectionKey }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (res.status === 400 || res.status === 403) {
        report(readError(data, "That section could not be added."));
        setFailures(readFailures(data));
        return;
      }
      if (!res.ok) {
        report(readError(data, "That section could not be added."));
        return;
      }
      const next = readTimetable(data);
      if (!next) {
        report("That section could not be added.");
        return;
      }
      setLive((current) => {
        const kept = current.sections.filter((section) => next.sectionKeys.includes(`${section.courseCode}:${section.section}`));
        const present = kept.some((section) => `${section.courseCode}:${section.section}` === hit.sectionKey);
        return {
          revision: next.revision,
          sectionKeys: next.sectionKeys,
          sections: present ? kept : [...kept, sectionFromHit(hit)],
        };
      });
      setCopied(false);
      setHoveredKey(null);
      setPinnedKey(null);
      router.refresh();
    } catch {
      report("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusyKey(null);
    }
  }

  async function remove(sectionKey: string) {
    if (openSelected) return;
    setRemovingKey(sectionKey);
    report(null);
    try {
      const res = await fetch(`/api/timetables/${timetable.id}/sections`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionKey }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        report(readError(data, "That section could not be removed."));
        return;
      }
      const next = readTimetable(data);
      if (!next) {
        report("That section could not be removed.");
        return;
      }
      setFailures([]);
      setLive((current) => ({
        revision: next.revision,
        sectionKeys: next.sectionKeys,
        sections: current.sections.filter((section) => next.sectionKeys.includes(`${section.courseCode}:${section.section}`)),
      }));
      router.refresh();
    } catch {
      report("Could not reach the server. Check your connection and try again.");
    } finally {
      setRemovingKey(null);
    }
  }

  async function confirmProposal(action: ConfirmAction) {
    if (!openSelected || !selected || confirming) return;
    const proposalId = selected.id;
    const proposedSections = selected.sections;
    const savedSections = live.sections;
    setConfirming(action);
    report(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        report(confirmNotice(res.status, data));
        return;
      }
      const effect = readStringField(data, "effect");
      if (action === "apply" && effect === "apply") {
        const next = readTimetable(data);
        if (next) {
          setLive({
            revision: next.revision,
            sectionKeys: next.sectionKeys,
            sections: mergeSections(savedSections, proposedSections, next.sectionKeys),
          });
          setFailures([]);
        }
      }
      if (effect === "apply" || effect === "save-as-new" || effect === "already-applied" || effect === "discard") {
        const nextStatus: ProposalStatus =
          action === "discard" ? "discarded" : action === "save-as-new" ? "saved-as-new" : "applied";
        setProposalRecords((current) =>
          current.map((item) => (item.id === proposalId ? { ...item, status: nextStatus } : item)),
        );
        setSelectedId((current) => (current === proposalId ? null : current));
      }
      if (action === "save-as-new" && effect === "save-as-new") {
        report("Saved as a new timetable. This timetable is unchanged.", "info");
      }
      router.refresh();
    } catch {
      report("Could not reach the server. Check your connection and try again.");
    } finally {
      setConfirming(null);
    }
  }

  const proposalListItems: ProposalListItem[] = proposalRecords.map((item) => ({
    id: item.id,
    summary: item.summary || item.sectionKeys.join(", "),
    status: item.status,
    stale: item.status === "open" && item.baseRevision !== live.revision,
  }));

  return (
    <div
      className="tp-editor"
      data-revision={live.revision}
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: theme.ground,
        color: theme.ink,
      }}
    >
      <header
        style={{
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 24px",
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to gallery"
          nativeButton={false}
          render={<Link href="/timetables" />}
          style={{ borderRadius: 8 }}
        >
          <ArrowLeftIcon aria-hidden />
        </Button>
        <h1 style={{ flex: 1, minWidth: 0, margin: 0, font: "inherit", display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "grid",
              width: "max-content",
              maxWidth: "100%",
              minWidth: "4ch",
            }}
          >
            <span
              aria-hidden
              style={{
                gridArea: "1 / 1",
                visibility: "hidden",
                whiteSpace: "pre",
                font: "inherit",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                padding: "2px 6px",
              }}
            >
              {title || " "}
            </span>
            <input
              aria-label="Timetable title"
              size={1}
              value={title}
              onFocus={() => setTitleFocused(true)}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                setTitleFocused(false);
                if (skipRename.current) {
                  skipRename.current = false;
                  return;
                }
                void saveTitle();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  skipRename.current = true;
                  setTitle(timetable.title);
                  event.currentTarget.blur();
                }
              }}
              style={{
                gridArea: "1 / 1",
                width: 0,
                minWidth: "100%",
                font: "inherit",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                padding: "2px 6px",
                borderRadius: 8,
                border: "none",
                borderBottom: titleFocused ? "none" : `1px solid ${theme.line}`,
                background: titleFocused ? "var(--field)" : "transparent",
                color: theme.ink,
              }}
            />
          </div>
        </h1>
        {!searchOpen && notice ? (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 13,
              color: noticeTone === "error" ? theme.rose : theme.muted,
            }}
          >
            {notice}
          </p>
        ) : null}
        <span style={{ color: theme.muted, fontSize: 14, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {creditTotal} credits
        </span>
        {shareToken ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              nativeButton
              disabled={shareBusy}
              render={
                <Button
                  type="button"
                  variant="outline"
                  aria-label={copied ? "Link copied" : `Share ${title}`}
                  style={{
                    ...controlButton,
                    borderColor: theme.line,
                    background: "transparent",
                    color: theme.ink,
                  }}
                />
              }
            >
              {copied ? "Link copied" : "Share"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void copyShareUrl(shareToken)}>Copy link</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => void stopSharing()}>
                Stop sharing
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => void share()}
            disabled={shareBusy}
            aria-label={copied ? "Link copied" : `Share ${title}`}
            style={{
              ...controlButton,
              borderColor: theme.line,
              background: "transparent",
              color: theme.ink,
            }}
          >
            {copied ? "Link copied" : "Share"}
          </Button>
        )}
        <AccountMenu />
      </header>
      <p role="status" style={srOnly}>
        {copied ? "Link copied" : ""}
      </p>
      <div
        ref={workspaceRowRef}
        style={{
          display: "flex",
          alignItems: "stretch",
          flex: 1,
          minHeight: 0,
          gap: 12,
          padding: "0 16px 16px",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            minHeight: 0,
            width: chatOpen ? chatWidth : 46,
            flex: chatOpen ? `0 0 ${chatWidth}px` : "0 0 46px",
          }}
        >
          <aside
            id="editor-chat"
            style={{
              flex: 1,
              minWidth: 0,
              width: "100%",
              background: theme.sheet,
            border: `1px solid ${theme.line}`,
            borderRadius: 14,
            boxShadow: "var(--shadow)",
            padding: chatOpen ? "16px 16px 12px" : "12px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: chatOpen ? undefined : "center",
            minHeight: 0,
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          {chatOpen ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 12,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>AI Planner</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Collapse AI chat"
                onClick={collapseChat}
                style={{ borderRadius: 8, width: 28, height: 28 }}
              >
                <ChevronLeftIcon aria-hidden style={{ width: 16, height: 16 }} />
              </Button>
            </div>
          ) : null}
          {chatOpen ? (
            <div
              role="tablist"
              aria-label="AI Planner views"
              style={{ display: "flex", gap: 6, marginBottom: 12, flexShrink: 0 }}
            >
              <Button
                type="button"
                role="tab"
                aria-selected={sidebarTab === "chat"}
                variant={sidebarTab === "chat" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSidebarTab("chat")}
                style={{ borderRadius: 8, fontSize: 13, height: 28, padding: "0 10px" }}
              >
                Chat
              </Button>
              <Button
                type="button"
                role="tab"
                aria-selected={sidebarTab === "proposals"}
                variant={sidebarTab === "proposals" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setSidebarTab("proposals");
                  router.refresh();
                }}
                style={{ borderRadius: 8, fontSize: 13, height: 28, padding: "0 10px" }}
              >
                Proposals
              </Button>
            </div>
          ) : null}
          {chatOpen ? null : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                width: "100%",
                paddingTop: 4,
                flexShrink: 0,
              }}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Expand AI chat"
                onClick={expandChat}
                style={{ borderRadius: 8, width: 28, height: 28 }}
              >
                <ChevronRightIcon aria-hidden style={{ width: 16, height: 16 }} />
              </Button>
              <span
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  color: theme.muted,
                  userSelect: "none",
                }}
              >
                AI PLANNER
              </span>
            </div>
          )}
          <div
            hidden={!chatOpen}
            style={chatOpen ? { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } : undefined}
          >
            <div
              hidden={sidebarTab !== "chat"}
              style={
                sidebarTab === "chat"
                  ? { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }
                  : undefined
              }
            >
              <CopilotPanel
                timetableId={timetable.id}
                selectedId={selectedId}
                onOpenProposal={chooseProposal}
                onHideProposal={() => setSelectedId(null)}
              />
            </div>
            <div
              hidden={sidebarTab !== "proposals"}
              style={
                sidebarTab === "proposals"
                  ? { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }
                  : undefined
              }
            >
              <ProposalList
                items={proposalListItems}
                selectedId={selectedId}
                onOpenProposal={chooseProposal}
                onHideProposal={() => setSelectedId(null)}
              />
            </div>
          </div>
          </aside>
          {chatOpen ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize AI chat"
              aria-controls="editor-chat"
              aria-valuemin={CHAT_WIDTH_MIN}
              aria-valuemax={chatLayoutMax}
              aria-valuenow={chatWidth}
              tabIndex={0}
              onKeyDown={onChatResizeKeyDown}
              onPointerDown={onChatResizePointerDown}
              onPointerMove={onChatResizePointerMove}
              onPointerUp={finishChatResize}
              onPointerCancel={finishChatResize}
              onDoubleClick={onChatResizeDoubleClick}
              onMouseEnter={() => setChatHandleActive(true)}
              onMouseLeave={() => setChatHandleActive(false)}
              onFocus={() => setChatHandleActive(true)}
              onBlur={() => setChatHandleActive(false)}
              style={{
                position: "absolute",
                top: 0,
                right: -6,
                width: 12,
                height: "100%",
                cursor: "col-resize",
                touchAction: "none",
                zIndex: 2,
                display: "flex",
                justifyContent: "center",
                outline: "none",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 2,
                  height: "100%",
                  borderRadius: 1,
                  background:
                    chatResizing || chatHandleActive ? theme.accent : "transparent",
                  transition: chatResizing ? undefined : "background 150ms",
                }}
              />
            </div>
          ) : null}
        </div>
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex" }}>
          <Week
            days={week.days}
            blocks={week.blocks}
            removingKey={removingKey}
            removable={!openSelected}
            onRemove={(sectionKey) => void remove(sectionKey)}
            footer={
              openSelected && proposalCredits && proposalSentence ? (
                <div aria-label="Proposal review" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ margin: 0, lineHeight: 1.45, maxWidth: "65ch" }}>{proposalSentence}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span style={{ marginRight: "auto", color: theme.muted, fontVariantNumeric: "tabular-nums" }}>
                      {proposalCredits.total} credits
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void confirmProposal("discard")}
                      disabled={confirming !== null}
                      className="hover:!bg-[var(--field)]"
                      style={{
                        ...controlButton,
                        background: "transparent",
                        color: theme.ink,
                        height: 34,
                      }}
                    >
                      {confirming === "discard" ? "Discarding…" : "Discard"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void confirmProposal("save-as-new")}
                      disabled={confirming !== null}
                      className="hover:!bg-[var(--field)]"
                      style={{
                        ...controlButton,
                        background: "var(--sheet)",
                        border: `1px solid ${theme.line}`,
                        color: theme.ink,
                        height: 34,
                      }}
                    >
                      {confirming === "save-as-new" ? "Saving…" : "Save as a new timetable"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void confirmProposal("apply")}
                      disabled={confirming !== null}
                      style={{
                        ...controlButton,
                        background: "var(--accent)",
                        color: "#FFFFFF",
                        borderRadius: 8,
                        height: 34,
                      }}
                    >
                      {confirming === "apply" ? "Applying…" : "Apply to the current timetable"}
                    </Button>
                  </div>
                </div>
              ) : selected && !openSelected ? (
                <p style={{ margin: 0, lineHeight: 1.45, maxWidth: "65ch", color: theme.muted }}>
                  {resolvedProposalSentence(selected.status)}
                </p>
              ) : null
            }
          />
        </main>
        <CourseSearchPanel
          open={searchOpen}
          onToggleOpen={searchOpen ? collapseSearch : expandSearch}
          query={query}
          onQueryChange={(val) => {
            setQuery(val);
            scheduleSearch(val);
          }}
          hits={hits}
          searching={searching}
          savedSections={live.sections}
          savedKeys={live.sectionKeys}
          majorCode={majorCode}
          openProposal={openSelected}
          hoveredKey={hoveredKey}
          onHoverKey={setHoveredKey}
          pinnedKey={pinnedKey}
          onPinKey={setPinnedKey}
          onAddSection={(hit) => void add(hit)}
          busyKey={busyKey}
          recentQueries={recentQueries}
          notice={notice}
          noticeTone={noticeTone}
          focusNonce={focusNonce}
        />
      </div>
    </div>
  );
}

const srOnly = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
} as const;
