import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import "./globals.css";

const clerkAppearance = {
  variables: {
    colorPrimary: "#1B5E6B",
    colorPrimaryForeground: "#FFFFFF",
    colorForeground: "#161B20",
    colorMutedForeground: "#596573",
    colorBackground: "#FFFFFF",
    colorInput: "#E8EEF2",
    colorInputForeground: "#161B20",
    colorNeutral: "#596573",
    colorDanger: "#B3261E",
    colorRing: "#1B5E6B",
    borderRadius: "8px",
    fontFamily: "inherit",
    fontFamilyButtons: "inherit",
  },
};

export const metadata: Metadata = {
  title: "TermPilot",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();
  const app = userId ? (
    <CopilotKitProvider runtimeUrl="/api/copilotkit" enableInspector={false} showIntelligenceIndicator={false}>
      {children}
    </CopilotKitProvider>
  ) : (
    children
  );
  return (
    <html lang="en">
      <body>
        <ClerkProvider appearance={clerkAppearance}>{app}</ClerkProvider>
      </body>
    </html>
  );
}
