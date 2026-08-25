"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  Box,
  Check,
  MessageCircle,
  Send,
  Smile,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { SUPPORT_CHAT_EVENT } from "@/lib/support-chat";

type MessageRole = "user" | "support";

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  at: Date;
  link?: { href: string; label: string };
}

const QUICK_PROMPTS = [
  "How do I add a new cashier to my till?",
  "How do I open a shift?",
  "How do I adjust stock?",
  "We're moving to kiosk.ke — what should I do?",
] as const;

const EMOJIS = ["👍", "🙏", "😊", "✅", "👋"] as const;

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function replyFor(input: string): Omit<ChatMessage, "id" | "at"> {
  const q = input.toLowerCase();

  if (/cashier|user|staff|till|team|login|pin/.test(q)) {
    return {
      role: "support",
      text: "To add a cashier: go to Users → Add User, set their name, email, PIN, and role to Cashier. They can then sign in on the till with that PIN.",
      link: { href: "/admin/users", label: "Open Users" },
    };
  }

  if (/shift|open.?drawer|close.?drawer|cash.?up|float/.test(q)) {
    return {
      role: "support",
      text: "Open a shift from the dashboard (Open Shift) before taking cash sales. When you're done for the day, use Close Shift and count the drawer so totals match.",
    };
  }

  if (/stock|inventory|restock|adjust|batch|expiry/.test(q)) {
    return {
      role: "support",
      text: "Use Stock → Adjust Stock to add or correct quantities, or Stock Take for a full count. Batch and expiry tools live under Batches if you track dated stock.",
      link: { href: "/admin/stock", label: "Open Stock" },
    };
  }

  if (/kiosk\.ke|migrat|new.?site|moving|shutdown|sign.?up/.test(q)) {
    return {
      role: "support",
      text: "We're migrating to kiosk.ke. Please create your business on the new site soon — this version of kiosk.co.ke will be closing.",
      link: { href: "https://kiosk.ke", label: "Go to kiosk.ke" },
    };
  }

  if (/guide|help|how.?to|tutorial/.test(q)) {
    return {
      role: "support",
      text: "I can walk you through users, shifts, stock, and the move to kiosk.ke. Ask about any of those — or tap a suggestion below.",
    };
  }

  return {
    role: "support",
    text: "Thanks — I've got your note. For hands-on help, email support@kiosk.co.ke, or ask about cashiers, shifts, stock, or the move to kiosk.ke.",
    link: {
      href: "mailto:support@kiosk.co.ke",
      label: "Email support",
    },
  };
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [draft, setDraft] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome",
      role: "support",
      text: "Hi — you're chatting with Kiosk Support. Ask anything about the till, stock, shifts, or your account.",
      at: new Date(),
    },
  ]);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(SUPPORT_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(SUPPORT_CHAT_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 280);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing, open]);

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  const sendText = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || typing) return;

      const userMsg: ChatMessage = {
        id: createId(),
        role: "user",
        text,
        at: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setDraft("");
      setShowEmoji(false);
      setTyping(true);

      if (replyTimer.current) clearTimeout(replyTimer.current);
      replyTimer.current = setTimeout(() => {
        const reply = replyFor(text);
        setMessages((prev) => [
          ...prev,
          { ...reply, id: createId(), at: new Date() },
        ]);
        setTyping(false);
      }, 700 + Math.min(900, text.length * 12));
    },
    [typing],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendText(draft);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText(draft);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-4 md:left-[calc(220px+1rem)] lg:left-[calc(232px+1rem)] z-40 flex items-center gap-2 rounded-full bg-[#1c6a1e] pl-3.5 pr-4 py-3 text-white shadow-lg shadow-[#1c6a1e]/30 hover:bg-[#165a18] active:scale-[0.98] transition-all print:hidden"
        aria-label="Open Kiosk Support chat"
      >
        <MessageCircle className="w-5 h-5" strokeWidth={2.25} />
        <span className="text-sm font-semibold tracking-tight">Support</span>
      </button>

      <Drawer open={open} onOpenChange={setOpen} direction="left">
        <DrawerContent
          aria-labelledby={titleId}
          aria-describedby={descId}
          className={cn(
            "!w-full sm:!w-[400px] md:!w-[420px] !max-w-[100vw] h-full max-h-[100dvh]",
            "flex flex-col overflow-hidden border-0 sm:border-r border-slate-200/80",
            "rounded-none sm:rounded-r-2xl bg-white dark:bg-slate-950",
            "shadow-[8px_0_40px_-12px_rgba(15,23,42,0.25)]",
          )}
        >
          {/* Header */}
          <div className="shrink-0 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-full bg-[#1c6a1e] flex items-center justify-center shadow-sm shadow-[#1c6a1e]/25">
                  <Box className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <span
                  className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#2a8a30] border-2 border-white dark:border-slate-950"
                  aria-hidden
                />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <DrawerTitle
                  id={titleId}
                  className="text-[15px] font-semibold text-slate-900 dark:text-white leading-tight"
                >
                  Kiosk Support
                </DrawerTitle>
                <DrawerDescription
                  id={descId}
                  className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug"
                >
                  Platform team · usually replies within a few minutes
                </DrawerDescription>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1c6a1e]/10 dark:bg-[#2a8a30]/20 px-2.5 py-1 text-[11px] font-semibold text-[#1c6a1e] dark:text-[#6bc46f]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2a8a30] animate-pulse" />
                  Live
                </span>
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                  aria-label={muted ? "Unmute sounds" : "Mute sounds"}
                  title={muted ? "Unmute" : "Mute"}
                >
                  {muted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <DrawerClose asChild>
                  <button
                    type="button"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors sm:hidden"
                    aria-label="Close support chat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </DrawerClose>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            className="flex-1 min-h-0 overflow-y-auto bg-slate-50/80 dark:bg-slate-900/40 px-4 py-5"
          >
            <div className="flex justify-center mb-5">
              <span className="rounded-full bg-slate-200/80 dark:bg-slate-800 px-3 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Today
              </span>
            </div>

            <div className="space-y-3.5">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[88%]",
                    msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start",
                  )}
                >
                  <div
                    className={cn(
                      "px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-sm",
                      msg.role === "user"
                        ? "bg-[#1c6a1e] text-white rounded-2xl rounded-br-md"
                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-md",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    {msg.link && (
                      <Link
                        href={msg.link.href}
                        {...(msg.link.href.startsWith("http") ||
                        msg.link.href.startsWith("mailto:")
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className={cn(
                          "mt-2 inline-flex text-[12px] font-semibold underline-offset-2 hover:underline",
                          msg.role === "user"
                            ? "text-white/90"
                            : "text-[#1c6a1e] dark:text-[#6bc46f]",
                        )}
                        onClick={() => {
                          if (msg.link?.href.startsWith("/")) setOpen(false);
                        }}
                      >
                        {msg.link.label} →
                      </Link>
                    )}
                    <div
                      className={cn(
                        "mt-1.5 flex items-center justify-end gap-1 text-[10px]",
                        msg.role === "user"
                          ? "text-white/75"
                          : "text-slate-400 dark:text-slate-500",
                      )}
                    >
                      <span>{formatTime(msg.at)}</span>
                      {msg.role === "user" && (
                        <Check className="w-3 h-3" strokeWidth={2.5} />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {typing && (
                <div className="flex mr-auto max-w-[88%]">
                  <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                    <div className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {messages.length <= 2 && !typing && (
              <div className="mt-5 flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendText(prompt)}
                    className="text-left text-[12px] leading-snug px-3 py-2 rounded-full border border-[#1c6a1e]/25 bg-white dark:bg-slate-900 text-[#1c6a1e] dark:text-[#6bc46f] hover:bg-[#1c6a1e]/5 dark:hover:bg-[#1c6a1e]/10 transition-colors max-w-full"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {showEmoji && (
              <div className="mb-2 flex gap-1 px-1">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="w-9 h-9 rounded-lg text-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => {
                      setDraft((d) => d + emoji);
                      inputRef.current?.focus();
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={onSubmit} className="relative">
              <div className="flex items-end gap-0 rounded-[1.35rem] border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 focus-within:border-[#1c6a1e]/50 focus-within:ring-2 focus-within:ring-[#1c6a1e]/15 transition-shadow">
                <button
                  type="button"
                  onClick={() => setShowEmoji((s) => !s)}
                  className="shrink-0 w-10 h-10 mb-0.5 ml-0.5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label="Insert emoji"
                  aria-expanded={showEmoji}
                >
                  <Smile className="w-5 h-5" />
                </button>
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder="Type a message..."
                  className="flex-1 min-h-[42px] max-h-28 resize-none bg-transparent py-2.5 pr-1 text-[14px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none leading-snug"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || typing}
                  className="shrink-0 w-9 h-9 m-1.5 rounded-full bg-[#1c6a1e] text-white flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none hover:bg-[#165a18] active:scale-95 transition-all shadow-sm shadow-[#1c6a1e]/25"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" strokeWidth={2.25} />
                </button>
              </div>
            </form>
            <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
              Enter to send · Shift+Enter for a new line
            </p>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
