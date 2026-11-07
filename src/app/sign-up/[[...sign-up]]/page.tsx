import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--ground)",
        padding: "24px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, width: "min(100%, 420px)" }}>
        <strong className="tp-wordmark">TermPilot</strong>
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      </div>
    </main>
  );
}
