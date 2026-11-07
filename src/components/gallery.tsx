"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AccountMenu } from "@/components/account-menu";
import { EllipsisIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MiniatureColumn } from "@/domain/credits";
import { theme } from "@/domain/theme";

export type GalleryCard = {
  id: string;
  title: string;
  editedLabel: string;
  creditTotal: number;
  columns: MiniatureColumn[];
};

function errorMessage(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string") {
    return (data as { error: string }).error;
  }
  return fallback;
}

export function DeleteTimetableDialog({
  card,
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  card: GalleryCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup>
          <DialogTitle>Delete this timetable?</DialogTitle>
          <DialogDescription>
            {card ? `${card.title} and its selected course sections will be permanently removed. This action cannot be undone.` : null}
          </DialogDescription>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  style={{
                    borderColor: "var(--line)",
                    background: "transparent",
                    color: "var(--ink)",
                    height: 34,
                    borderRadius: 8,
                  }}
                >
                  Cancel
                </Button>
              }
            />
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={busy}
              style={{
                height: 34,
                borderRadius: 8,
              }}
            >
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

export function Gallery({ cards }: { cards: GalleryCard[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [pendingDeleteCard, setPendingDeleteCard] = useState<GalleryCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const skipRename = useRef(false);

  async function createTimetable() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/timetables", { method: "POST" });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errorMessage(data, "Could not create a timetable."));
        return;
      }
      if (
        typeof data === "object" &&
        data !== null &&
        "timetable" in data &&
        typeof (data as { timetable: unknown }).timetable === "object" &&
        (data as { timetable: { id?: unknown } }).timetable !== null &&
        typeof (data as { timetable: { id: unknown } }).timetable.id === "string"
      ) {
        router.push(`/timetables/${(data as { timetable: { id: string } }).timetable.id}`);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  function startRename(card: GalleryCard) {
    setEditingId(card.id);
    setDraftTitle(card.title);
    setPendingDeleteCard(null);
    setError(null);
  }

  async function saveRename(card: GalleryCard) {
    const title = draftTitle.trim();
    if (!title) {
      setError("Enter a title.");
      setDraftTitle(card.title);
      setEditingId(null);
      return;
    }
    if (title === card.title) {
      setEditingId(null);
      return;
    }
    setBusyId(card.id);
    setError(null);
    try {
      const res = await fetch(`/api/timetables/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errorMessage(data, "Could not rename this timetable."));
        return;
      }
      setEditingId(null);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(card: GalleryCard) {
    setBusyId(card.id);
    setError(null);
    try {
      const res = await fetch(`/api/timetables/${card.id}`, { method: "DELETE" });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errorMessage(data, "Could not delete this timetable."));
        setPendingDeleteCard(null);
        return;
      }
      setPendingDeleteCard(null);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setPendingDeleteCard(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="tp-gallery" style={{ minHeight: "100vh", background: "var(--ground)", color: "var(--ink)" }}>
      <header
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 24px",
        }}
      >
        <strong className="tp-wordmark">TermPilot</strong>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          <AccountMenu />
        </div>
      </header>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 24px 64px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            margin: "8px 0 20px",
            flexWrap: "wrap",
          }}
        >
          <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", margin: 0, lineHeight: 1.2 }}>
            My timetables
          </h1>
          <Button
            type="button"
            onClick={() => void createTimetable()}
            disabled={creating}
            style={{
              borderRadius: 8,
              padding: "0 14px",
              height: 34,
              background: "#1B5E6B",
              color: "#FFFFFF",
              fontWeight: 500,
              fontSize: 13.5,
            }}
          >
            {creating ? "Creating…" : "New timetable"}
          </Button>
        </div>
        {error ? (
          <p role="alert" style={{ margin: "0 0 16px", color: "var(--rose)" }}>
            {error}
          </p>
        ) : null}
        {cards.length === 0 ? (
          <p style={{ margin: "0 0 20px", color: "var(--muted)" }}>No timetables yet.</p>
        ) : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 18,
            alignItems: "start",
          }}
        >
          {cards.map((card) => {
            const isRenaming = editingId === card.id;
            const cardOpensOnClick = !isRenaming;
            return (
              <article
                key={card.id}
                style={{
                  position: "relative",
                  background: "var(--sheet)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  boxShadow: "var(--shadow)",
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  cursor: cardOpensOnClick ? "pointer" : undefined,
                }}
              >
                {cardOpensOnClick ? (
                  <Link
                    href={`/timetables/${card.id}`}
                    aria-label={`Open ${card.title}`}
                    className="tp-gallery-card-hit"
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 14,
                      zIndex: 0,
                    }}
                  />
                ) : null}
                <div
                  aria-hidden="true"
                  style={{
                    height: 124,
                    background: "#FAFBFD",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 6,
                    padding: "12px 10px",
                    position: "relative",
                    overflow: "hidden",
                    pointerEvents: "none",
                    minWidth: 0,
                  }}
                >
                  {card.columns.map((column, colIdx) => (
                    <div
                      key={column.day}
                      style={{
                        position: "relative",
                        height: "100%",
                        borderRight: colIdx < 6 ? "1px dashed rgba(220, 226, 230, 0.6)" : undefined,
                      }}
                    >
                      {column.blocks.map((block, index) => {
                        const hue = theme.hues[block.hue];
                        return (
                          <i
                            key={`${column.day}-${index}`}
                            style={{
                              position: "absolute",
                              left: 1,
                              right: 1,
                              top: `${block.top * 100}%`,
                              display: "block",
                              height: 14,
                              borderRadius: 3,
                              background: hue.background,
                              borderLeft: `3px solid ${hue.edge}`,
                              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8,
                    marginTop: 14,
                    position: "relative",
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isRenaming ? (
                      <input
                        aria-label={`Title for ${card.title}`}
                        value={draftTitle}
                        autoFocus
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onBlur={() => {
                          if (skipRename.current) {
                            skipRename.current = false;
                            return;
                          }
                          void saveRename(card);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }
                          if (event.key === "Escape") {
                            skipRename.current = true;
                            setDraftTitle(card.title);
                            setEditingId(null);
                            event.currentTarget.blur();
                          }
                        }}
                        style={{
                          font: "inherit",
                          fontSize: 17,
                          fontWeight: 600,
                          letterSpacing: "-0.015em",
                          margin: 0,
                          padding: "2px 0",
                          border: "none",
                          borderBottom: "1px solid var(--line)",
                          background: "transparent",
                          color: "var(--ink)",
                          width: "100%",
                          pointerEvents: "auto",
                        }}
                      />
                    ) : (
                      <h2
                        style={{
                          fontSize: 17,
                          fontWeight: 600,
                          margin: 0,
                          letterSpacing: "-0.015em",
                          lineHeight: 1.3,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {card.title}
                      </h2>
                    )}
                    <p
                      style={{
                        margin: "4px 0 0",
                        color: "var(--muted)",
                        fontSize: 12.5,
                        fontVariantNumeric: "tabular-nums",
                        lineHeight: 1.4,
                      }}
                    >
                      {card.editedLabel} · {card.creditTotal} credits
                    </p>
                  </div>
                  <div style={{ pointerEvents: "auto", flexShrink: 0 }}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        nativeButton
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label={`Actions for ${card.title}`}
                            disabled={busyId === card.id}
                            style={{
                              borderColor: "var(--line)",
                              background: "var(--sheet)",
                              color: "var(--ink)",
                              width: 34,
                              height: 34,
                              borderRadius: 8,
                              flexShrink: 0,
                              pointerEvents: "auto",
                            }}
                          />
                        }
                      >
                        <EllipsisIcon aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startRename(card)}>Rename</DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            setPendingDeleteCard(card);
                            setError(null);
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
      <DeleteTimetableDialog
        card={pendingDeleteCard}
        open={pendingDeleteCard !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteCard(null);
        }}
        onConfirm={() => {
          if (pendingDeleteCard) {
            void remove(pendingDeleteCard);
          }
        }}
        busy={pendingDeleteCard !== null && busyId === pendingDeleteCard.id}
      />
    </div>
  );
}
