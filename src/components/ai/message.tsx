"use client";

import type { ReactNode } from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";

export function UserMessage({ children }: { children: ReactNode }) {
  return (
    <Message align="end">
      <MessageContent>
        <Bubble align="end" variant="secondary" className="tp-user-bubble">
          <BubbleContent className="text-base leading-normal">{children}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

export function AssistantMessage({ children }: { children: ReactNode }) {
  return (
    <Message>
      <MessageContent className="gap-2 text-base leading-normal text-[color:var(--ink)]">{children}</MessageContent>
    </Message>
  );
}
