"use client";

import type { ReactNode } from "react";
import { WrenchIcon } from "lucide-react";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

export function Tool({
  title,
  running = false,
  failed = false,
  children,
}: {
  title: string;
  running?: boolean;
  failed?: boolean;
  children?: ReactNode;
}) {
  const status = running ? "running" : failed ? "error" : undefined;
  const line = (
    <TraceLine status={status} style={{ fontFamily: "var(--mono)", fontSize: 13, color: failed ? "var(--rose)" : "var(--muted)" }}>
      <TraceIcon>
        <WrenchIcon />
      </TraceIcon>
      <TraceTitle style={{ fontFamily: "var(--mono)", fontSize: 13, color: failed ? "var(--rose)" : "var(--muted)" }}>{title}</TraceTitle>
    </TraceLine>
  );

  if (!children) {
    return <Trace>{line}</Trace>;
  }

  return (
    <Trace>
      <TraceCollapsible defaultOpen>
        <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
        <TraceCollapsibleContent>{children}</TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}
