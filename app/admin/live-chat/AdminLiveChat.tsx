"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ChatSender = "visitor" | "operator" | "system";

type ChatMessage = {
  id: string;
  threadId: string;
  sender: ChatSender;
  text: string;
  createdAt: string;
};

type ChatThread = {
  id: string;
  status: "open" | "closed";
  topic: string;
  name: string;
  phone: string;
  email: string;
  pageUrl: string;
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = "open" | "closed";

const PASSCODE_KEY = "carviondealer.liveChat.adminPasscode";
const PASSCODE_COOKIE = "carviondealer_live_chat_admin";
const THREAD_SEEN_KEY = "carviondealer.liveChat.adminSeenThreads";
const ADMIN_API_ORIGIN = process.env.NEXT_PUBLIC_ADMIN_ORIGIN || "";
const POLL_INTERVAL_MS = 2500;
const THREADS_POLL_INTERVAL_MS = 5000;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AdminLiveChat() {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [passInput, setPassInput] = useState("");
  const [authError, setAuthError] = useState<string>("");
  const [checkingPasscode, setCheckingPasscode] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cursor, setCursor] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [unreadThreadIds, setUnreadThreadIds] = useState<Set<string>>(() => new Set());

  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const seenThreadsRef = useRef<Record<string, string>>({});
  const seenHydratedRef = useRef(false);
  const firstThreadsLoadRef = useRef(false);
  const lastNotifiedRef = useRef<Record<string, string>>({});

  // Keep the manager surface off the Cloudflare-fronted custom domain.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isCustomDomain(window.location.hostname)) {
      window.location.replace(
        `${ADMIN_API_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`
      );
    }
  }, []);

  // Hydrate passcode from sessionStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(PASSCODE_KEY);
    if (stored) {
      setPasscode(stored);
      setPasscodeCookie(stored);
    }

    try {
      const rawSeen = window.localStorage.getItem(THREAD_SEEN_KEY);
      const parsed = rawSeen ? JSON.parse(rawSeen) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        seenThreadsRef.current = parsed as Record<string, string>;
      }
    } catch {
      seenThreadsRef.current = {};
    }
    seenHydratedRef.current = true;
  }, []);

  const authHeaders = useMemo<Record<string, string>>(
    () => buildAuthHeaders(passcode),
    [passcode]
  );

  const onPasscodeSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = passInput.trim();
      if (!trimmed) {
        setAuthError("Please enter the manager passcode.");
        return;
      }

      setCheckingPasscode(true);
      setAuthError("");

      try {
        const res = await fetch(adminApiUrl("/api/live-chat/admin/threads?status=open&limit=1"), {
          cache: "no-store",
          headers: buildAuthHeaders(trimmed)
        });

        if (res.status === 401) {
          setAuthError("That passcode didn't work. Try again.");
          return;
        }

        if (!res.ok) {
          setAuthError("The live chat backend is not reachable right now. Try again.");
          return;
        }
      } catch {
        setAuthError("Network error. Try again.");
        return;
      } finally {
        setCheckingPasscode(false);
      }

      try {
        window.sessionStorage.setItem(PASSCODE_KEY, trimmed);
      } catch {
        // ignore quota / private-mode failures
      }
      setPasscodeCookie(trimmed);
      setPasscode(trimmed);
      setPassInput("");
      setAuthError("");
    },
    [passInput]
  );

  const signOut = useCallback(() => {
    try {
      window.sessionStorage.removeItem(PASSCODE_KEY);
    } catch {
      // ignore
    }
    clearPasscodeCookie();
    setPasscode(null);
    setThreads([]);
    setActiveId(null);
    setMessages([]);
    setCursor("");
    setAuthError("");
    setUnreadThreadIds(new Set());
  }, []);

  const persistSeenThreads = useCallback((seen: Record<string, string>) => {
    seenThreadsRef.current = seen;
    try {
      window.localStorage.setItem(THREAD_SEEN_KEY, JSON.stringify(seen));
    } catch {
      // ignore quota / private-mode failures
    }
  }, []);

  const markThreadSeen = useCallback(
    (thread: ChatThread | null) => {
      if (!thread) return;
      const updatedAt = thread.updatedAt || new Date().toISOString();
      const seen = seenThreadsRef.current;
      if (!seen[thread.id] || isNewer(updatedAt, seen[thread.id])) {
        persistSeenThreads({ ...seen, [thread.id]: updatedAt });
      }
      setUnreadThreadIds((prev) => {
        if (!prev.has(thread.id)) return prev;
        const next = new Set(prev);
        next.delete(thread.id);
        return next;
      });
    },
    [persistSeenThreads]
  );

  const reconcileUnreadThreads = useCallback(
    (nextThreads: ChatThread[]) => {
      if (!seenHydratedRef.current) return;

      const seen = { ...seenThreadsRef.current };

      if (!firstThreadsLoadRef.current) {
        firstThreadsLoadRef.current = true;
        if (Object.keys(seen).length === 0) {
          for (const thread of nextThreads) {
            seen[thread.id] = thread.updatedAt || thread.createdAt || new Date().toISOString();
          }
          persistSeenThreads(seen);
          setUnreadThreadIds(new Set());
          return;
        }
      }

      let shouldNotify = false;
      let seenChanged = false;
      const nextUnread = new Set<string>();

      for (const thread of nextThreads) {
        const updatedAt = thread.updatedAt || thread.createdAt || "";
        if (!updatedAt) continue;

        if (activeId === thread.id) {
          if (!seen[thread.id] || isNewer(updatedAt, seen[thread.id])) {
            seen[thread.id] = updatedAt;
            seenChanged = true;
          }
          continue;
        }

        if (!seen[thread.id] || isNewer(updatedAt, seen[thread.id])) {
          nextUnread.add(thread.id);
          if (lastNotifiedRef.current[thread.id] !== updatedAt) {
            lastNotifiedRef.current[thread.id] = updatedAt;
            shouldNotify = true;
          }
        }
      }

      if (seenChanged) persistSeenThreads(seen);
      setUnreadThreadIds(nextUnread);
      if (shouldNotify) playAdminNotification();
    },
    [activeId, persistSeenThreads]
  );

  // ─── Load thread list ─────────────────────────────────────────────────────
  const loadThreads = useCallback(async () => {
    if (!passcode) return;
    setThreadsLoading(true);
    try {
      const url = adminApiUrl(`/api/live-chat/admin/threads?status=${statusFilter}&limit=50`);
      const res = await fetch(url, { cache: "no-store", headers: authHeaders });
      if (res.status === 401) {
        setAuthError("The saved manager passcode was rejected. Sign out and enter it again.");
        return;
      }
      if (!res.ok) return;
      const json = (await res.json()) as { ok?: boolean; threads?: ChatThread[] };
      if (json.ok) {
        const nextThreads = json.threads ?? [];
        setThreads(nextThreads);
        reconcileUnreadThreads(nextThreads);
      }
    } catch {
      // network blip; next poll will retry
    } finally {
      setThreadsLoading(false);
    }
  }, [authHeaders, passcode, reconcileUnreadThreads, signOut, statusFilter]);

  // Initial + polling thread list.
  useEffect(() => {
    if (!passcode) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (!alive) return;
      await loadThreads();
      if (!alive) return;
      timer = setTimeout(tick, THREADS_POLL_INTERVAL_MS);
    };
    void tick();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [loadThreads, passcode]);

  // ─── Load + poll messages for active thread ───────────────────────────────
  const fetchMessages = useCallback(
    async (threadId: string, sinceCursor: string) => {
      if (!passcode) return;
      try {
        const url = sinceCursor
          ? adminApiUrl(
              `/api/live-chat/admin/threads/${encodeURIComponent(threadId)}/messages?since=${encodeURIComponent(sinceCursor)}`
            )
          : adminApiUrl(`/api/live-chat/admin/threads/${encodeURIComponent(threadId)}/messages`);
        const res = await fetch(url, { cache: "no-store", headers: authHeaders });
        if (res.status === 401) {
          setAuthError("The saved manager passcode was rejected. Sign out and enter it again.");
          return;
        }
        if (!res.ok) return;
        const json = (await res.json()) as {
          ok?: boolean;
          status?: "open" | "closed";
          messages?: ChatMessage[];
          nextCursor?: string;
        };
        if (!json.ok) return;

        const incoming = json.messages ?? [];
        if (incoming.length > 0) {
          setMessages((prev) => {
            const known = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            for (const msg of incoming) {
              if (!known.has(msg.id)) merged.push(msg);
            }
            return merged;
          });
        }

        const nextCursor = json.nextCursor || incoming.at(-1)?.createdAt || sinceCursor;
        if (nextCursor && nextCursor !== sinceCursor) setCursor(nextCursor);

        if (json.status) {
          setThreads((prev) =>
            prev.map((t) => (t.id === threadId && json.status ? { ...t, status: json.status } : t))
          );
        }
      } catch {
        // ignore
      }
    },
    [authHeaders, passcode, signOut]
  );

  // When active thread changes, reset and fetch.
  useEffect(() => {
    if (!activeId) return;
    setMessages([]);
    setCursor("");
    setMessagesLoading(true);
    void fetchMessages(activeId, "").finally(() => setMessagesLoading(false));
  }, [activeId, fetchMessages]);

  // Polling for the active thread.
  useEffect(() => {
    if (!activeId || !passcode) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (!alive) return;
      await fetchMessages(activeId, cursor);
      if (!alive) return;
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [activeId, cursor, fetchMessages, passcode]);

  // Auto-scroll messages.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
  }, [messages, activeId]);

  // ─── Reply / close ────────────────────────────────────────────────────────
  const sendReply = useCallback(async () => {
    if (!activeId || !passcode) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setSendError("");
    setDraft("");

    const optimistic: ChatMessage = {
      id: `local_${Date.now()}`,
      threadId: activeId,
      sender: "operator",
      text,
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(
        adminApiUrl(`/api/live-chat/admin/threads/${encodeURIComponent(activeId)}/messages`),
        {
          method: "POST",
          headers: { ...authHeaders, "content-type": "application/json" },
          body: JSON.stringify({ text })
        }
      );
      if (res.status === 401) {
        setAuthError("The saved manager passcode was rejected. Sign out and enter it again.");
        return;
      }
      if (!res.ok) {
        setSendError("Couldn't send. Try again.");
        return;
      }
      const json = (await res.json()) as { message?: ChatMessage };
      if (json.message?.id) {
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? json.message! : m)));
      }
    } catch {
      setSendError("Network error.");
    } finally {
      setSending(false);
    }
  }, [activeId, authHeaders, draft, passcode, signOut]);

  const closeThread = useCallback(async () => {
    if (!activeId || !passcode) return;
    if (!window.confirm("Close this conversation? The visitor will see it as closed.")) return;
    try {
      const res = await fetch(
        adminApiUrl(`/api/live-chat/admin/threads/${encodeURIComponent(activeId)}`),
        {
          method: "PATCH",
          headers: { ...authHeaders, "content-type": "application/json" },
          body: JSON.stringify({ status: "closed" })
        }
      );
      if (res.status === 401) {
        setAuthError("The saved manager passcode was rejected. Sign out and enter it again.");
        return;
      }
      if (!res.ok) return;
      setThreads((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, status: "closed" } : t))
      );
    } catch {
      // ignore
    }
  }, [activeId, authHeaders, passcode, signOut]);

  const onInputKey = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void sendReply();
      }
    },
    [sendReply]
  );

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [activeId, threads]
  );

  useEffect(() => {
    markThreadSeen(activeThread);
  }, [activeThread, markThreadSeen]);

  // ─── Render: passcode gate ────────────────────────────────────────────────
  if (!passcode) {
    return (
      <main className="admin-shell">
        <section className="admin-gate">
          <h1>Manager sign-in</h1>
          <p>Enter the manager passcode to view live chats.</p>
          <form onSubmit={onPasscodeSubmit} className="admin-gate-form">
            <label htmlFor="admin-passcode" className="admin-gate-label">
              Passcode
            </label>
            <input
              id="admin-passcode"
              type="password"
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
            {authError ? <p className="admin-gate-error">{authError}</p> : null}
            <button type="submit" className="btn btn-primary btn-block" disabled={checkingPasscode}>
              {checkingPasscode ? "Checking..." : "Sign in"}
            </button>
          </form>
          <p className="admin-gate-note">
            The passcode is stored only in this browser tab and cleared when you sign out or close the
            tab.
          </p>
        </section>
      </main>
    );
  }

  // ─── Render: inbox ────────────────────────────────────────────────────────
  return (
    <main className="admin-shell">
      <header className="admin-head">
        <div>
          <p className="admin-eyebrow">Carviondealer · Live chat</p>
          <h1>Manager inbox</h1>
          {authError ? <p className="admin-auth-warning">{authError}</p> : null}
        </div>
        <div className="admin-head-actions">
          <a className="admin-link" href="/admin/inventory">
            Inventory
          </a>
          <div className="admin-tabs" role="tablist" aria-label="Thread filter">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "open"}
              className={statusFilter === "open" ? "is-active" : ""}
              onClick={() => setStatusFilter("open")}
            >
              Open
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "closed"}
              className={statusFilter === "closed" ? "is-active" : ""}
              onClick={() => setStatusFilter("closed")}
            >
              Closed
            </button>
          </div>
          <button type="button" className="admin-link" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="admin-body">
        <aside className="admin-threads" aria-label="Threads">
          {threadsLoading && threads.length === 0 ? (
            <p className="admin-empty">Loading threads…</p>
          ) : threads.length === 0 ? (
            <p className="admin-empty">No {statusFilter} threads.</p>
          ) : (
            <ul>
              {threads.map((t) => {
                const isUnread = unreadThreadIds.has(t.id);
                return (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`admin-thread${activeId === t.id ? " is-active" : ""}${isUnread ? " is-unread" : ""}`}
                    onClick={() => setActiveId(t.id)}
                  >
                    <span className="admin-thread-name">
                      {isUnread ? (
                        <span className="admin-thread-unread" aria-label="Unread conversation" />
                      ) : null}
                      {t.name || "Anonymous visitor"}
                      {t.status === "closed" ? <span className="admin-thread-tag">CLOSED</span> : null}
                    </span>
                    <span className="admin-thread-meta">
                      {t.topic ? `${formatTopic(t.topic)} · ` : ""}
                      {t.phone || t.email || ""}
                    </span>
                    <span className="admin-thread-time">{formatDate(t.updatedAt)}</span>
                  </button>
                </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="admin-conversation">
          {activeThread ? (
            <>
              <div className="admin-conv-head">
                <div>
                  <h2>{activeThread.name || "Visitor"}</h2>
                  <p>
                    {activeThread.topic ? formatTopic(activeThread.topic) : "Inquiry"}
                    {activeThread.phone ? (
                      <>
                        {" · "}
                        <a href={`tel:${activeThread.phone.replace(/[^+\d]/g, "")}`}>
                          {activeThread.phone}
                        </a>
                      </>
                    ) : null}
                    {activeThread.email ? (
                      <>
                        {" · "}
                        <a href={`mailto:${activeThread.email}`}>{activeThread.email}</a>
                      </>
                    ) : null}
                  </p>
                  {activeThread.pageUrl ? (
                    <p className="admin-conv-page">
                      <a href={activeThread.pageUrl} target="_blank" rel="noopener noreferrer">
                        {activeThread.pageUrl}
                      </a>
                    </p>
                  ) : null}
                </div>
                <div className="admin-conv-actions">
                  {activeThread.status !== "closed" ? (
                    <button type="button" className="btn ghost" onClick={closeThread}>
                      Close conversation
                    </button>
                  ) : (
                    <span className="admin-thread-tag">CLOSED</span>
                  )}
                </div>
              </div>

              <div className="admin-conv-body" ref={bodyRef}>
                {messagesLoading && messages.length === 0 ? (
                  <p className="admin-empty">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className="admin-empty">No messages yet.</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`admin-msg admin-msg-${msg.sender === "operator" ? "operator" : msg.sender === "system" ? "system" : "visitor"}`}
                    >
                      <span className="admin-msg-meta">
                        {msg.sender === "operator"
                          ? "You"
                          : msg.sender === "system"
                            ? "System"
                            : activeThread.name || "Visitor"}{" "}
                        · {formatTime(msg.createdAt)}
                      </span>
                      <div className="admin-msg-bubble">{msg.text}</div>
                    </div>
                  ))
                )}
              </div>

              {activeThread.status !== "closed" ? (
                <div className="admin-composer">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onInputKey}
                    placeholder="Reply to the visitor…  (⌘+Enter to send)"
                    rows={2}
                    maxLength={2000}
                  />
                  {sendError ? <p className="admin-conv-error">{sendError}</p> : null}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void sendReply()}
                    disabled={sending || !draft.trim()}
                  >
                    {sending ? "Sending…" : "Send reply"}
                  </button>
                </div>
              ) : (
                <div className="admin-composer admin-composer-closed">
                  This conversation is closed.
                </div>
              )}
            </>
          ) : (
            <div className="admin-empty admin-empty-large">
              Pick a conversation on the left to start replying.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTopic(topic: string) {
  if (topic === "vehicle") return "Vehicle inquiry";
  if (topic === "sell") return "Sell / trade-in";
  if (topic === "about") return "About Carviondealer";
  return topic.charAt(0).toUpperCase() + topic.slice(1);
}

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function isNewer(candidate: string, baseline: string) {
  const candidateTime = Date.parse(candidate);
  const baselineTime = Date.parse(baseline);
  if (!Number.isNaN(candidateTime) && !Number.isNaN(baselineTime)) {
    return candidateTime > baselineTime;
  }
  return candidate > baseline;
}

function setPasscodeCookie(passcode: string) {
  document.cookie = `${PASSCODE_COOKIE}=${encodeURIComponent(passcode)}; Path=/api/live-chat/admin; Secure; SameSite=Strict`;
}

function clearPasscodeCookie() {
  document.cookie = `${PASSCODE_COOKIE}=; Path=/api/live-chat/admin; Max-Age=0; Secure; SameSite=Strict`;
}

function adminApiUrl(path: string) {
  if (typeof window === "undefined") return path;
  return isCustomDomain(window.location.hostname) ? `${ADMIN_API_ORIGIN}${path}` : path;
}

function isCustomDomain(hostname: string) {
  return hostname === "carviondealer.com" || hostname === "www.carviondealer.com";
}

function buildAuthHeaders(passcode: string | null) {
  const headers: Record<string, string> = {};
  if (passcode) {
    headers["x-live-chat-admin-passcode"] = passcode;
    headers.Authorization = `Bearer ${passcode}`;
  }
  return headers;
}

function playAdminNotification() {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(960, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.26);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.28);
    window.setTimeout(() => void ctx.close(), 360);
  } catch {
    // Browsers can block audio until the manager has interacted with the page.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

function formatTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
