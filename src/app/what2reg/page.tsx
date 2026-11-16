import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { AccountMenu } from "@/components/account-menu";
import { what2RegConfigured } from "@/domain/what2reg/config";
import { WHAT2REG_DISCLAIMER } from "@/domain/what2reg/types";
import { resolveRuntimeDeps } from "@/domain/what2reg/runtime";

export const dynamic = "force-dynamic";

export default async function What2RegPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string; disconnected?: string }>;
}) {
  const params = await searchParams;
  const { userId } = await auth();
  const configured = what2RegConfigured();
  const deps = userId ? await resolveRuntimeDeps() : null;
  const connected = userId && deps ? (await deps.store.get(userId)) !== null : false;
  const notice =
    params.connected === "1"
      ? "選咩課 is connected for this account."
      : params.disconnected === "1"
        ? "選咩課 access was removed from this account."
        : params.error === "not-configured"
          ? "What2Reg OAuth is not configured on this server yet. Timetable planning still works."
          : params.error === "denied"
            ? "Authorization was cancelled. Timetable planning still works."
            : params.error === "state"
              ? "The authorization session expired. Try connecting again."
              : params.error === "exchange"
                ? "What2Reg did not finish authorization. Timetable planning still works."
                : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--ground)", color: "var(--ink)" }}>
      <header style={{ height: 64, display: "flex", alignItems: "center", gap: 16, padding: "0 24px" }}>
        <Link href="/timetables" aria-label="Back to timetables" style={{ color: "var(--ink)", display: "flex" }}>
          <ArrowLeftIcon aria-hidden size={18} />
        </Link>
        <strong style={{ fontSize: 16 }}>Community reviews</strong>
        <div style={{ marginLeft: "auto" }}>
          <AccountMenu />
        </div>
      </header>
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "12px 24px 48px", display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ margin: 0, lineHeight: 1.5 }}>{WHAT2REG_DISCLAIMER}</p>
        <p style={{ margin: 0, lineHeight: 1.5, color: "var(--muted)" }}>
          TermPilot still uses the official University of Macau add-drop catalogue and hard registration rules to decide
          what you can take. Connecting your own 選咩課 account only adds public opinions about what a course is like.
          TermPilot does not copy What2Reg branding, and it does not read official teaching evaluations.
        </p>
        {notice ? <p style={{ margin: 0, lineHeight: 1.5 }}>{notice}</p> : null}
        {connected ? (
          <form method="post" action="/api/what2reg/disconnect">
            <button
              type="submit"
              style={{
                height: 40,
                padding: "0 16px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--sheet)",
                color: "var(--ink)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Disconnect 選咩課
            </button>
          </form>
        ) : (
          <a
            href="/api/what2reg/connect"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 40,
              padding: "0 16px",
              borderRadius: 8,
              background: configured ? "var(--accent)" : "var(--field)",
              color: configured ? "#FFFFFF" : "var(--muted)",
              fontWeight: 600,
              textDecoration: "none",
              width: "fit-content",
            }}
          >
            Connect 選咩課
          </a>
        )}
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>
          Authorization asks What2Reg for the read-only <code>umhelper:read</code> scope. You can revoke it here or from
          your What2Reg account. Original pages stay on{" "}
          <a href="https://umeh.top/" style={{ color: "var(--accent)" }}>
            umeh.top
          </a>{" "}
          and{" "}
          <a href="https://www.umeh.top/" style={{ color: "var(--accent)" }}>
            www.umeh.top
          </a>
          .
        </p>
      </main>
    </div>
  );
}
