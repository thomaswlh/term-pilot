import { theme } from "@/domain/theme";

export default function SharedTimetableNotFound() {
  return (
    <div style={{ minHeight: "100vh", background: theme.ground, color: theme.ink }}>
      <header style={{ height: 64, display: "flex", alignItems: "center", padding: "0 24px" }}>
        <strong className="tp-wordmark">TermPilot</strong>
      </header>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "28px 24px 64px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", margin: "8px 0 12px", lineHeight: 1.15 }}>
          Shared timetable
        </h1>
        <p style={{ margin: 0, fontSize: 18 }}>The shared timetable is not available.</p>
      </main>
    </div>
  );
}
