"use client";

import { useEffect, useState } from "react";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2/headless";
import { Chat, ChatTurn } from "@/components/ai/chat";
import { AssistantMarkdown } from "@/components/ai/markdown";
import { AssistantMessage, UserMessage } from "@/components/ai/message";
import { PromptInput } from "@/components/ai/prompt-input";
import { Tool } from "@/components/ai/tool";
import { Button } from "@/components/ui/button";
import { theme } from "@/domain/theme";

const UNAVAILABLE = "The assistant is unavailable. Search and manual add still work.";
const RUN_STOPPED_MESSAGE = "Run stopped by user";

const TOOL_TITLES: Record<string, string> = {
  searchSections: "Searched the catalogue",
  readProfile: "Read the profile",
  readTimetable: "Read this timetable",
  plan: "Drafted a proposal",
  validate: "Checked the rules",
};

type ThreadMessage = {
  id: string;
  role: string;
  content?: unknown;
  toolCalls?: { id: string; function: { name: string } }[];
  toolCallId?: string;
  error?: string;
};

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "object" && part !== null && "text" in part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("");
}

function proposalFrom(content: unknown): { proposalId: string; summary: string } | { proposalId: null; reason: string } | null {
  const raw = textOf(content);
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || !("proposalId" in data)) return null;
    const row = data as { proposalId?: unknown; summary?: unknown; reason?: unknown };
    if (typeof row.proposalId === "string" && row.proposalId) {
      const summary = typeof row.summary === "string" && row.summary.trim() ? row.summary : "Open this proposal";
      return { proposalId: row.proposalId, summary };
    }
    if (row.proposalId === null && typeof row.reason === "string") {
      return { proposalId: null, reason: row.reason };
    }
  } catch {
    return null;
  }
  return null;
}

export function CopilotPanel({
  timetableId,
  selectedId,
  onOpenProposal,
  onHideProposal,
}: {
  timetableId: string;
  selectedId: string | null;
  onOpenProposal: (proposalId: string) => void;
  onHideProposal?: () => void;
}) {
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      headers={{ "x-timetable-id": timetableId }}
      agentId="default"
      enableInspector={false}
      showIntelligenceIndicator={false}
    >
      <CopilotThread selectedId={selectedId} onOpenProposal={onOpenProposal} onHideProposal={onHideProposal} />
    </CopilotKitProvider>
  );
}

function CopilotThread({
  selectedId,
  onOpenProposal,
  onHideProposal,
}: {
  selectedId: string | null;
  onOpenProposal: (proposalId: string) => void;
  onHideProposal?: () => void;
}) {
  const { agent } = useAgent();
  const { copilotkit } = useCopilotKit();
  const [draft, setDraft] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [localThread, setLocalThread] = useState<ThreadMessage[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/copilotkit");
        const data: unknown = await res.json().catch(() => null);
        const message =
          typeof data === "object" && data !== null && "message" in data && typeof (data as { message: unknown }).message === "string"
            ? (data as { message: string }).message
            : "";
        if (!cancelled && message === UNAVAILABLE) setUnavailable(true);
      } catch {
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const agentThread = agent.messages as ThreadMessage[];
  const thread = agentThread.length > 0 ? agentThread : localThread;
  const toolResults = new Map(thread.filter((message) => message.role === "tool" && message.toolCallId).map((message) => [message.toolCallId as string, message]));
  const busy = agent.isRunning;

  async function send(value: string) {
    const content = value.trim();
    if (!content || busy) return;
    const user = { id: crypto.randomUUID(), role: "user" as const, content };
    agent.addMessage(user);
    setDraft("");
    if (unavailable) {
      const reply = { id: crypto.randomUUID(), role: "assistant" as const, content: UNAVAILABLE };
      agent.addMessage(reply);
      setLocalThread((current) => [...current, user, reply]);
      return;
    }
    try {
      await copilotkit.runAgent({ agent });
    } catch (err) {
      const text = err instanceof Error ? err.message : "";
      if (!text.includes(UNAVAILABLE)) return;
      const reply = { id: crypto.randomUUID(), role: "assistant" as const, content: UNAVAILABLE };
      agent.addMessage(reply);
      setLocalThread((current) => [...current, user, reply]);
      setUnavailable(true);
    }
  }

  const lead = unavailable && thread.length === 0;

  return (
    <div id="editor-chat-copy" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, marginTop: 16 }}>
      <Chat
        footer={
          <PromptInput
            value={draft}
            onValueChange={setDraft}
            onSubmit={(value) => void send(value)}
            onStop={() => copilotkit.stopAgent({ agent })}
            busy={busy}
          />
        }
      >
        {lead ? (
          <ChatTurn id="unavailable">
            <AssistantMessage>
              <p style={{ margin: 0 }}>{UNAVAILABLE}</p>
            </AssistantMessage>
          </ChatTurn>
        ) : null}
        {!lead && thread.length === 0 ? (
          <ChatTurn id="empty">
            <AssistantMessage>
              <p style={{ margin: 0, maxWidth: "36ch", lineHeight: 1.45 }}>
                Ask for a change to this timetable. A proposal is a preview until you use Apply or Save as a new timetable.
              </p>
            </AssistantMessage>
          </ChatTurn>
        ) : null}
        {thread.map((message) => {
          if (message.role === "user") {
            return (
              <ChatTurn key={message.id} id={message.id} anchor>
                <UserMessage>{textOf(message.content)}</UserMessage>
              </ChatTurn>
            );
          }
          if (message.role !== "assistant") return null;
          const calls = message.toolCalls ?? [];
          const reply = textOf(message.content);
          if (message.error === RUN_STOPPED_MESSAGE || reply === RUN_STOPPED_MESSAGE) return null;
          return (
            <ChatTurn key={message.id} id={message.id}>
              <AssistantMessage>
                {calls.map((call) => {
                  const result = toolResults.get(call.id);
                  const proposal = result ? proposalFrom(result.content) : null;
                  const title = TOOL_TITLES[call.function.name] ?? call.function.name;
                  const failed = Boolean(result?.error) || proposal?.proposalId === null;
                  const detail =
                    proposal && proposal.proposalId === null
                      ? proposal.reason
                      : result
                        ? null
                        : null;
                  return (
                    <div key={call.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <Tool title={failed && call.function.name === "plan" ? "Could not draft a proposal" : title} failed={failed}>
                        {detail ? <p style={{ margin: 0 }}>{detail}</p> : null}
                      </Tool>
                      {proposal && proposal.proposalId ? (
                        <ProposalButton
                          summary={proposal.summary}
                          pressed={proposal.proposalId === selectedId}
                          onClick={() => onOpenProposal(proposal.proposalId)}
                          onHideProposal={onHideProposal}
                        />
                      ) : null}
                    </div>
                  );
                })}
                {reply ? <AssistantMarkdown>{reply}</AssistantMarkdown> : null}
              </AssistantMessage>
            </ChatTurn>
          );
        })}
        {busy ? (
          <ChatTurn id="working">
            <AssistantMessage>
              <p role="status" style={{ margin: 0, color: theme.muted }}>
                Working…
              </p>
            </AssistantMessage>
          </ChatTurn>
        ) : null}
      </Chat>
    </div>
  );
}

function ProposalButton({
  summary,
  pressed,
  onClick,
  onHideProposal,
}: {
  summary: string;
  pressed: boolean;
  onClick: () => void;
  onHideProposal?: () => void;
}) {
  return (
    <div
      style={{
        borderLeft: "3px solid var(--accent)",
        paddingLeft: 12,
        paddingTop: 4,
        paddingBottom: 4,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: "var(--ink)" }}>{summary}</p>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={pressed}
          onClick={pressed ? onHideProposal : onClick}
          style={{
            borderRadius: 8,
            borderColor: "var(--line)",
            background: pressed ? "var(--field)" : "transparent",
            color: "var(--ink)",
            fontSize: 13,
            padding: "4px 10px",
            height: "auto",
          }}
        >
          {pressed ? "Hide from week" : "Show on week"}
        </Button>
      </div>
    </div>
  );
}
