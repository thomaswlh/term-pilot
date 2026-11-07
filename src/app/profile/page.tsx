import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import { auth } from "@clerk/nextjs/server";
import { loadCatalogue } from "@/domain/catalogue";
import { ProfileForm } from "@/components/profile-form";
import { appStore } from "@/db/server-store";

export default async function ProfilePage() {
  const catalogue = loadCatalogue();
  const { userId } = await auth();
  let initialMajorCode: string | null = null;
  let initialCompleted: string[] = [];
  let saved = false;
  if (userId) {
    const profile = await appStore.getProfile(userId);
    initialMajorCode = profile.majorCode;
    initialCompleted = [...profile.completed];
    saved = profile.saved;
  }
  return (
    <div style={{ minHeight: "100vh", background: "var(--ground)", color: "var(--ink)" }}>
      <header
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 24px",
        }}
      >
        {saved ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to timetables"
            nativeButton={false}
            render={<Link href="/timetables" />}
          >
            <ArrowLeftIcon aria-hidden />
          </Button>
        ) : null}
        <strong className="tp-wordmark">TermPilot</strong>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          <AccountMenu />
        </div>
      </header>
      <main style={{ width: "min(720px, 100%)", margin: "0 auto", padding: "28px 24px 64px" }}>
        <h1
          style={{
            margin: "8px 0 12px",
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
          }}
        >
          Profile
        </h1>
        <p style={{ margin: "0 0 28px", color: "var(--muted)", lineHeight: 1.5, maxWidth: "52ch" }}>
          Saving unlocks manual add and planning on your timetable. Search already works before you save.
        </p>
        <ProfileForm majors={catalogue.majors} initialMajorCode={initialMajorCode} initialCompleted={initialCompleted} />
      </main>
    </div>
  );
}
