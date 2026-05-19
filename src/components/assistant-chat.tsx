"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  SendHorizontal,
  ClipboardPaste,
  Loader2,
  History,
  MessageSquarePlus,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormel } from "@/contexts/formel-context";
import { FormulaDiff } from "@/components/formula-diff";
import { formatFormula } from "@/lib/formula-formatter";
import {
  ASSISTANT_STATUS_DATA_KEY,
  getAssistantStatusLabel,
  type AssistantStatusPhase,
} from "@/lib/ai/assistant-status";
import { AgentModes, type AgentMode } from "@/lib/ai/llm-config";

const AGENT_MODE_LABELS: Record<AgentMode, string> = {
  [AgentModes.DIRECT]: "Direct",
  [AgentModes.GRAPH]: "Graph agent",
  [AgentModes.FREE]: "Free agent",
};
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** All fenced code block contents in the message (in order). */
function getCodeBlocksFromMessage(content: string): string[] {
  if (typeof content !== "string" || !content.trim()) return [];
  const codeBlockRe = /```[\s\S]*?\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let m;
  while ((m = codeBlockRe.exec(content)) !== null) blocks.push(m[1].trim());
  return blocks;
}

const VALID_STATUS_PHASES = new Set<AssistantStatusPhase>([
  "thinking",
  "coordinating",
  "planning",
  "retrieving",
  "evaluating",
  "answering",
  "validating",
  "clarifying",
  "resolving_fields",
  "digesting",
]);

function parseStatusFromDataPart(line: string): AssistantStatusPhase | null {
  if (!line.startsWith("2:")) return null;
  try {
    const payload = JSON.parse(line.slice(2)) as unknown;
    const items = Array.isArray(payload) ? payload : [payload];
    for (const item of items) {
      if (item && typeof item === "object" && ASSISTANT_STATUS_DATA_KEY in item) {
        const s = (item as Record<string, string>)[ASSISTANT_STATUS_DATA_KEY];
        if (typeof s === "string" && VALID_STATUS_PHASES.has(s as AssistantStatusPhase)) {
          return s as AssistantStatusPhase;
        }
      }
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

/** Live stream steps (expanded) or persisted steps (collapsed in `<details>`). */
function MessageStatusSteps({
  phases,
  isLive,
}: {
  phases: AssistantStatusPhase[];
  isLive: boolean;
}) {
  if (isLive && phases.length === 0) {
    return (
      <div className="mb-2 border-b border-border/50 pb-2 text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          Denke nach
          <span className="status-typing-dots inline-flex" aria-hidden>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </span>
      </div>
    );
  }
  if (phases.length === 0) return null;

  if (isLive) {
    return (
      <div className="mb-2 flex flex-col gap-1 border-b border-border/50 pb-2 text-muted-foreground">
        {phases.slice(0, -1).map((phase, i) => (
          <span key={`${phase}-${i}`}>{getAssistantStatusLabel(phase)}</span>
        ))}
        <span className="inline-flex items-center gap-1">
          {getAssistantStatusLabel(phases[phases.length - 1])}
          <span className="status-typing-dots inline-flex" aria-hidden>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </span>
      </div>
    );
  }

  return (
    <details className="group mb-2 border-b border-border/50 pb-2 text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3 shrink-0 transition-transform group-open:rotate-90" />
        Agent-Schritte ({phases.length})
      </summary>
      <div className="mt-2 flex flex-col gap-1 pl-4">
        {phases.map((phase, i) => (
          <span key={`${phase}-${i}`}>{getAssistantStatusLabel(phase)}</span>
        ))}
      </div>
    </details>
  );
}

export function AssistantChat() {
  const { formula, setFormula } = useFormel();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevIsLoadingRef = useRef(false);
  const streamStatusRef = useRef<AssistantStatusPhase[]>([]);
  const [streamStatusHistory, setStreamStatusHistory] = useState<AssistantStatusPhase[]>([]);
  const [messageStatusHistory, setMessageStatusHistory] = useState<
    Record<string, AssistantStatusPhase[]>
  >({});
  const [agentMode, setAgentMode] = useState<typeof AgentModes[keyof typeof AgentModes]>(
    AgentModes.DIRECT
  );
  const [chatId, setChatId] = useState(() => crypto.randomUUID());

  const handleFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await fetch(input, init);
      if (!res.body || !res.ok) return res;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const status = parseStatusFromDataPart(line);
            if (status) {
              setStreamStatusHistory((prev) => {
                if (prev[prev.length - 1] === status) return prev;
                const next = [...prev, status];
                streamStatusRef.current = next;
                return next;
              });
            }
          }
          controller.enqueue(value);
        },
      });
      return new Response(stream, {
        headers: res.headers,
        status: res.status,
        statusText: res.statusText,
      });
    },
    []
  );

  const { messages, input, setInput, handleSubmit, isLoading, stop, setMessages } = useChat({
    id: chatId,
    api: "/api/chat",
    body: { formula, formulaSource: agentMode, conversationId: chatId },
    fetch: handleFetch,
  });

  const chatStarted = messages.length > 0;

  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<
    { id: string; title: string; createdAt: string }[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (historyOpen) {
      setHistoryLoading(true);
      fetch("/api/conversations")
        .then((r) => r.json())
        .then((data) => setConversations(Array.isArray(data) ? data : []))
        .catch(() => setConversations([]))
        .finally(() => setHistoryLoading(false));
    }
  }, [historyOpen]);

  function handleNewChat() {
    if (isLoading) stop();
    setMessageStatusHistory({});
    streamStatusRef.current = [];
    setStreamStatusHistory([]);
    setChatId(crypto.randomUUID());
  }

  async function handleSelectConversation(convId: string) {
    if (isLoading) stop();
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      const data = (await res.json()) as { messages?: { id: string; role: string; content: string }[] };
      const msgs = data.messages ?? [];
      setChatId(convId);
      setMessageStatusHistory({});
      streamStatusRef.current = [];
      setStreamStatusHistory([]);
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }))
      );
      setHistoryOpen(false);
    } catch {
      setHistoryOpen(false);
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist live steps on the assistant message when the stream finishes; reset buffer on new request.
  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading) {
      const last = messages[messages.length - 1];
      const phases = streamStatusRef.current;
      if (last?.role === "assistant" && phases.length > 0) {
        setMessageStatusHistory((prev) => ({
          ...prev,
          [last.id]: phases,
        }));
      }
      streamStatusRef.current = [];
      setStreamStatusHistory([]);
    } else if (!prevIsLoadingRef.current && isLoading) {
      streamStatusRef.current = [];
      setStreamStatusHistory([]);
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, messages]);

  function getStatusPhasesForMessage(
    msg: (typeof messages)[0],
    index: number
  ): { phases: AssistantStatusPhase[]; isLive: boolean } {
    const isLast = index === messages.length - 1;
    const isLive = isLast && msg.role === "assistant" && isLoading;
    if (isLive) {
      return { phases: streamStatusHistory, isLive: true };
    }
    const persisted = messageStatusHistory[msg.id];
    return { phases: persisted ?? [], isLive: false };
  }

  function renderMessage(
    msg: (typeof messages)[0],
    status?: { phases: AssistantStatusPhase[]; isLive: boolean }
  ) {
    const content = typeof msg.content === "string" ? msg.content : "";
    const codeBlocks = msg.role === "assistant" ? getCodeBlocksFromMessage(content) : [];
    const blocksWithDiff = codeBlocks.filter((block) => block !== formula && block.trim() !== "");
    return (
      <div
        key={msg.id}
        className={cn(
          "rounded-lg px-3 py-2 text-sm",
          msg.role === "user"
            ? "ml-4 bg-primary text-primary-foreground"
            : "mr-4 bg-muted text-muted-foreground"
        )}
      >
        {msg.role === "assistant" ? (
          <>
            {status && (status.isLive || status.phases.length > 0) && (
              <MessageStatusSteps phases={status.phases} isLive={status.isLive} />
            )}
            <div className="assistant-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
            {blocksWithDiff.length > 0 && (
              <div className="mt-3 space-y-4 border-t border-border/50 pt-3">
                {blocksWithDiff.map((suggestedFormula, i) => (
                  <div key={`${msg.id}-block-${i}`} className="space-y-2">
                    <FormulaDiff prior={formula} after={suggestedFormula} className="text-xs" />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onClick={() => setFormula(formatFormula(suggestedFormula))}
                    >
                      <ClipboardPaste className="mr-2 size-4 shrink-0" />
                      Formel übernehmen
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          content
        )}
      </div>
    );
  }

  return (
    <Card className="flex min-h-0 w-full flex-1 flex-col font-sans">
      <CardHeader className="shrink-0 border-b pb-3">
        <CardTitle className="text-center text-lg">Assistent</CardTitle>
        <div className="mt-2 flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={handleNewChat}
            aria-label="Neuer Chat"
            title="Neuer Chat"
          >
            <MessageSquarePlus className="size-4" />
          </Button>
          <Select
            value={agentMode}
            onValueChange={(v) => v && setAgentMode(v as typeof agentMode)}
          >
            <SelectTrigger size="sm" className="w-36" disabled={chatStarted}>
              <SelectValue placeholder="Modus">
                {(value: string | null) =>
                  value ? AGENT_MODE_LABELS[value as AgentMode] ?? value : null
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AgentModes.DIRECT}>Direct</SelectItem>
              <SelectItem value={AgentModes.GRAPH}>Graph agent</SelectItem>
              <SelectItem value={AgentModes.FREE}>Free agent</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Verlauf"
                  title="Verlauf"
                >
                  <History className="size-4" />
                </Button>
              }
            />
            <DialogContent showCloseButton className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Chat-Verlauf</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-64">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Keine früheren Chats.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {conversations.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={cn(
                          "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                          c.id === chatId && "bg-muted"
                        )}
                        onClick={() => handleSelectConversation(c.id)}
                      >
                        <span className="line-clamp-1 font-medium">{c.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(c.createdAt).toLocaleDateString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pt-4">
        <ScrollArea className="min-h-0 flex-1 pr-3">
          <div className="space-y-3 pb-2">
            {messages.length === 0 && (
              <p className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                Stellen Sie Fragen zu Formeln, bitten Sie um Erklärungen oder
                Korrekturvorschläge. Die aktuelle Formel wird dem Assistenten
                mitgeteilt.
              </p>
            )}
            {messages.map((msg, index) =>
              renderMessage(
                msg,
                msg.role === "assistant" ? getStatusPhasesForMessage(msg, index) : undefined
              )
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
        <form onSubmit={handleSubmit} className="flex shrink-0 gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nachricht eingeben..."
            className="min-h-10 resize-none py-2"
            rows={1}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).form?.requestSubmit();
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0"
            disabled={!input.trim() || isLoading}
          >
            <SendHorizontal className="size-4" />
            <span className="sr-only">Senden</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
