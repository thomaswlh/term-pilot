"use client";

import { useRef } from "react";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";

export function PromptInput({
  value,
  onValueChange,
  onSubmit,
  onStop,
  busy,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop: () => void;
  busy: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const canSend = value.trim().length > 0 && !busy;

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSend) return;
        onSubmit(value);
      }}
    >
      <InputGroup className="border-[color:var(--line)] bg-[color:var(--sheet)]">
        <InputGroupTextarea
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder="Ask for a change to this timetable"
          aria-label="Message"
          disabled={busy}
          className="min-h-14 p-3 text-base"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />
        <InputGroupAddon align="block-end">
          {busy ? (
            <InputGroupButton
              type="button"
              size="icon-sm"
              variant="default"
              className="ml-auto rounded-lg bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-hover)]"
              style={{ width: 32, height: 32, minWidth: 32, minHeight: 32, borderRadius: 8 }}
              aria-label="Stop"
              onClick={onStop}
            >
              <SquareIcon fill="currentColor" />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type="submit"
              size="icon-sm"
              variant="default"
              className="ml-auto rounded-lg bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-hover)]"
              style={{ width: 32, height: 32, minWidth: 32, minHeight: 32, borderRadius: 8 }}
              disabled={!canSend}
              aria-label="Send"
            >
              <ArrowUpIcon />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
