"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { Send, MessagesSquare, ArrowDown } from "./icons";
import { MUSTER_MESSAGE_LIMIT, type MusterMessage } from "@/muster/contracts";
import { MusterAvatar } from "./MusterAvatar";

export function CrewChat({
  voyageId,
  csrfToken,
  messages,
  connected,
  onSent,
  disabled = false,
}: {
  voyageId: string;
  csrfToken: string;
  messages: MusterMessage[];
  connected: string;
  onSent: () => Promise<void>;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const previous = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const pending = useRef<{ body: string; clientMessageId: string } | null>(null);
  useLayoutEffect(() => {
    const added = messages.filter((m) => !previous.current.has(m.id)).length;
    previous.current = new Set(messages.map((m) => m.id));
    if (scroll.current && (!initialized.current || nearBottom.current)) {
      scroll.current.scrollTop = scroll.current.scrollHeight;
      setUnread(0);
    } else if (added) setUnread((count) => count + added);
    initialized.current = true;
  }, [messages]);
  async function send() {
    const body = draft.trim();
    if (!body || sending || disabled) return;
    if (pending.current?.body !== body) pending.current = { body, clientMessageId: crypto.randomUUID() };
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/voyages/${voyageId}/muster/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(pending.current),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Your message could not be sent.");
      setDraft("");
      pending.current = null;
      nearBottom.current = true;
      setUnread(0);
      await onSent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Message not sent. Try again.");
    } finally {
      setSending(false);
    }
  }
  return (
    <section className="muster-chat" aria-labelledby="crew-chat-heading">
      <header>
        <h2 id="crew-chat-heading">
          <MessagesSquare size={17} aria-hidden="true" /> Crew Chat
        </h2>
        <span className="chat-connection" title={connected}>
          <i data-online={connected === "Live"} />
          {connected === "Live" ? "Live" : connected}
        </span>
      </header>
      <div
        className="muster-chat-history"
        ref={scroll}
        role="log"
        aria-label="Crew messages"
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
        onScroll={() => {
          const node = scroll.current!;
          nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 45;
          if (nearBottom.current) setUnread(0);
        }}
      >
        {!messages.length && (
          <div className="muster-chat-empty">
            <MessagesSquare size={28} aria-hidden="true" />
            <p>A good Voyage starts with hello.</p>
            <span>Gather here with your Crew.</span>
          </div>
        )}
        {messages.map((message) => (
          <article className="muster-message" key={message.id}>
            <MusterAvatar name={message.displayName} url={message.avatarUrl} />
            <div>
              <div className="muster-message-byline">
                <strong>{message.displayName}</strong>
                <time dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString()}>
                  {new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </time>
              </div>
              <p>{message.body}</p>
            </div>
          </article>
        ))}
      </div>
      {unread > 0 && (
        <button
          className="muster-chat-unread"
          onClick={() => {
            nearBottom.current = true;
            if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
            setUnread(0);
          }}
        >
          <ArrowDown size={13} />
          {unread} new {unread === 1 ? "message" : "messages"}
        </button>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="sr-only" htmlFor="muster-chat-input">
          Message the crew
        </label>
        <div className="muster-chat-compose">
          <textarea
            id="muster-chat-input"
            rows={1}
            placeholder="Send a message to the crew…"
            maxLength={MUSTER_MESSAGE_LIMIT}
            value={draft}
            disabled={sending || disabled}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="submit"
            aria-label={sending ? "Sending message" : "Send message"}
            disabled={sending || disabled || !draft.trim()}
          >
            <Send size={18} aria-hidden="true" />
          </button>
        </div>
        {(draft.length > 800 || sending) && (
          <small className="muster-chat-feedback">
            {sending ? "Sending…" : `${draft.length} / ${MUSTER_MESSAGE_LIMIT}`}
          </small>
        )}
        {error && (
          <p className="muster-chat-error" role="alert">
            {error} Your text is kept; press Send to retry.
          </p>
        )}
      </form>
    </section>
  );
}
