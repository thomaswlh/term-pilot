import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
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
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      </div>
    </main>
  );
}
