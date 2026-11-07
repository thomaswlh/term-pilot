import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";

export default function TimetableNotFound() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--ground)", color: "var(--ink)" }}>
      <header style={{ height: 64, display: "flex", alignItems: "center", gap: 16, padding: "0 24px" }}>
        <strong className="tp-wordmark">TermPilot</strong>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          <AccountMenu />
        </div>
      </header>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "28px 24px 64px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", margin: "8px 0 12px", lineHeight: 1.15 }}>
          Timetables
        </h1>
        <p style={{ margin: "0 0 16px", fontSize: 18 }}>The timetable is not available.</p>
        <Link href="/timetables" style={{ color: "var(--ink)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>
          Back to your timetables
        </Link>
      </main>
    </div>
  );
}
