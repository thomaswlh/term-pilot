"use client";

import type { ReactNode } from "react";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";

export function Chat({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <MessageScrollerProvider autoScroll>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}>
        <MessageScroller style={{ flex: 1, minHeight: 0 }}>
          <MessageScrollerViewport>
            <MessageScrollerContent aria-label="Chat" className="gap-4 py-1">
              {children}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
        {footer}
      </div>
    </MessageScrollerProvider>
  );
}

export function ChatTurn({
  id,
  anchor = false,
  children,
}: {
  id: string;
  anchor?: boolean;
  children: ReactNode;
}) {
  return (
    <MessageScrollerItem messageId={id} scrollAnchor={anchor} className="[content-visibility:visible]">
      {children}
    </MessageScrollerItem>
  );
}
