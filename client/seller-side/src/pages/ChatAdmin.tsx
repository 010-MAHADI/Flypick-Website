import { useState, useEffect, useRef, useCallback, KeyboardEvent, useMemo } from 'react';
import { MessageCircle, Send, Loader2, User, RefreshCw, CheckCheck, PhoneOff, Search, UserPlus, Circle } from 'lucide-react';
import api from '@/lib/api';
import CustomerProfileModal from '@/components/CustomerProfileModal';

interface ChatMessage {
  id: number;
  session: string;
  sender_type: 'customer' | 'admin';
  content: string;
  is_read: boolean;
  created_at: string;
}

interface ChatSession {
  id: string;
  user: number | null;
  session_id: string | null;
  assigned_admin: number | null;
  assigned_admin_name: string | null;
  status: 'active' | 'closed';
  last_message_at: string;
  created_at: string;
  unread_count: number;
  last_message_preview: string | null;
  customer_name: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatFull(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatAdmin() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [profileCustomerId, setProfileCustomerId] = useState<number | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [sessionQuery, setSessionQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const lastIdRef = useRef<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/chat/admin/sessions/');
      // Handle both paginated {results:[]} and plain array responses
      const data = res.data;
      setSessions(Array.isArray(data) ? data : (data.results ?? []));
    } catch (e) {
      console.error('Failed to fetch sessions', e);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const fetchMessages = useCallback(async (sessionId: string, sinceId?: number | null) => {
    try {
      const params: Record<string, string> = { session_id: sessionId };
      if (sinceId) params.since_id = String(sinceId);
      const res = await api.get('/chat/messages/', { params });
      const newMsgs: ChatMessage[] = res.data;
      if (newMsgs.length > 0) {
        lastActivityRef.current = Date.now();
        lastIdRef.current = newMsgs[newMsgs.length - 1].id;
        if (sinceId) {
          setMessages(prev => [...prev, ...newMsgs]);
        } else {
          setMessages(newMsgs);
          lastIdRef.current = newMsgs[newMsgs.length - 1]?.id ?? null;
        }
      }
    } catch (e) {
      console.error('Failed to fetch messages', e);
    }
  }, []);

  const scheduleNextPoll = useCallback((sessionId: string) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    const idle = Date.now() - lastActivityRef.current > 30000;
    const delay = idle ? 9000 : 2500;
    pollTimerRef.current = setTimeout(async () => {
      await fetchMessages(sessionId, lastIdRef.current);
      await fetchSessions();
      scheduleNextPoll(sessionId);
    }, delay);
  }, [fetchMessages, fetchSessions]);

  const openSession = useCallback(async (session: ChatSession) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setActiveSession(session);
    setMessages([]);
    setConfirmEnd(false);
    lastIdRef.current = null;
    await fetchMessages(session.id, null);
    scheduleNextPoll(session.id);
    // mark as read
    api.post('/chat/read/', { session_id: session.id, sender_type: 'admin' }).catch(() => {});
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, unread_count: 0 } : s));
  }, [fetchMessages, scheduleNextPoll]);

  const sendMessage = useCallback(async () => {
    if (!activeSession || !input.trim() || isSending) return;
    const content = input.trim();
    const optimistic: ChatMessage = {
      id: Date.now(),
      session: activeSession.id,
      sender_type: 'admin',
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    lastActivityRef.current = Date.now();
    setIsSending(true);
    try {
      const res = await api.post('/chat/message/', {
        session: activeSession.id,
        sender_type: 'admin',
        content,
      });
      const real: ChatMessage = res.data;
      setMessages(prev => prev.map(m => m.id === optimistic.id ? real : m));
      lastIdRef.current = real.id;
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setIsSending(false);
    }
  }, [activeSession, input, isSending]);

  const assignSelf = useCallback(async () => {
    if (!activeSession) return;
    try {
      await api.post('/chat/admin/assign/', { session_id: activeSession.id });
      setActiveSession(prev => prev ? { ...prev, assigned_admin_name: 'You' } : prev);
    } catch (e) {
      console.error('Assign failed', e);
    }
  }, [activeSession]);

  const endChat = useCallback(async () => {
    if (!activeSession) return;
    try {
      const res = await api.post('/chat/close/', { session_id: activeSession.id });
      setActiveSession(res.data);
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, status: 'closed' } : s));
    } catch (e) {
      console.error('End chat failed', e);
    }
    setConfirmEnd(false);
  }, [activeSession]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, []);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const filteredSessions = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.customer_name?.toLowerCase().includes(q) ||
        (s.last_message_preview || '').toLowerCase().includes(q)
      );
    });
  }, [sessions, sessionQuery, statusFilter]);

  const totalUnread = useMemo(() => sessions.reduce((sum, s) => sum + (s.unread_count || 0), 0), [sessions]);

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-sm animate-fade-in">
      {/* Session list */}
      <div className="flex w-72 flex-shrink-0 flex-col border-r border-border bg-muted/20">
        <div className="border-b border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="section-title flex items-center gap-2">
                Inbox
                {totalUnread > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{totalUnread}</span>
                )}
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{sessions.length} conversations</p>
            </div>
            <button onClick={fetchSessions} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={sessionQuery}
              onChange={(e) => setSessionQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full rounded-lg border border-transparent bg-background/80 py-1.5 pl-8 pr-2 text-xs outline-none transition-all focus:border-primary/40 focus:bg-background"
            />
          </div>
          <div className="mt-2 flex gap-1">
            {(['all', 'active', 'closed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors ${statusFilter === f ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-background/60 text-muted-foreground hover:bg-background'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loadingSessions && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loadingSessions && filteredSessions.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <MessageCircle className="h-5 w-5 opacity-40" />
              </div>
              <p className="font-medium">No conversations</p>
            </div>
          )}
          {filteredSessions.map((s) => (
            <button
              key={s.id}
              onClick={() => openSession(s)}
              className={`mb-1 flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-all ${activeSession?.id === s.id ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-background'}`}
            >
              <div className="relative flex-shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-xs font-bold text-primary-foreground shadow-sm">
                  {(s.customer_name || 'U').slice(0, 2).toUpperCase()}
                </div>
                {s.status === 'active' && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-background bg-success">
                    <Circle className="h-1 w-1 fill-success text-success" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={`truncate text-sm ${s.unread_count > 0 ? 'font-bold' : 'font-semibold'}`}>{s.customer_name}</span>
                  <span className="flex-shrink-0 text-[10px] text-muted-foreground">{formatTime(s.last_message_at)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className={`flex-1 truncate text-xs ${s.unread_count > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                    {s.last_message_preview || 'No messages yet'}
                  </p>
                  {s.unread_count > 0 && (
                    <span className="flex-shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {s.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat window */}
      <div className="flex min-w-0 flex-1 flex-col bg-gradient-to-b from-background to-muted/10">
        {!activeSession ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                <MessageCircle className="h-7 w-7 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground">Select a conversation</p>
              <p className="mt-1 text-sm">Pick a chat from the inbox to start replying</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-background/70 px-5 py-3 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-sm font-bold text-primary-foreground shadow-sm">
                    {(activeSession.customer_name || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  {activeSession.status === 'active' && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-success" />
                  )}
                </div>
                <div>
                  <button
                    className="text-left text-sm font-semibold tracking-tight transition-colors hover:text-primary"
                    onClick={() => activeSession.user && setProfileCustomerId(activeSession.user)}
                    title={activeSession.user ? "View customer profile" : undefined}
                  >
                    {activeSession.customer_name}
                  </button>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${activeSession.status === 'active' ? 'bg-success' : 'bg-muted-foreground/40'}`} />
                    {activeSession.assigned_admin_name ? `Assigned to ${activeSession.assigned_admin_name}` : 'Unassigned'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${activeSession.status === 'active' ? 'bg-success/10 text-success ring-1 ring-success/20' : 'bg-muted text-muted-foreground'}`}>
                  {activeSession.status}
                </span>
                {!activeSession.assigned_admin_name && (
                  <button onClick={assignSelf} className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:shadow-md">
                    <UserPlus className="h-3 w-3" /> Assign to me
                  </button>
                )}
                {activeSession.status === 'active' && (
                  confirmEnd ? (
                    <div className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5">
                      <span className="text-xs text-muted-foreground">End chat?</span>
                      <button
                        onClick={endChat}
                        className="rounded-full bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground transition-colors hover:opacity-90"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmEnd(false)}
                        className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmEnd(true)}
                      className="flex items-center gap-1.5 rounded-full border border-destructive/30 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                      title="End chat"
                    >
                      <PhoneOff className="w-3.5 h-3.5" /> End Chat
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto p-6">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[68%] rounded-2xl px-4 py-2.5 shadow-sm ${
                    msg.sender_type === 'admin'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'border border-border bg-card text-foreground rounded-bl-md'
                  }`}>
                    <p className="break-words text-sm leading-relaxed">{msg.content}</p>
                    <div className={`mt-1 flex items-center gap-1 ${msg.sender_type === 'admin' ? 'justify-end' : ''}`}>
                      <span className={`text-[10px] ${msg.sender_type === 'admin' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {formatFull(msg.created_at)}
                      </span>
                      {msg.sender_type === 'admin' && msg.is_read && (
                        <CheckCheck className="w-3 h-3 text-primary-foreground/70" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {activeSession.status === 'closed' && (
                <div className="flex justify-center pt-2">
                  <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs text-muted-foreground shadow-sm">
                    <PhoneOff className="w-3 h-3 shrink-0" />
                    This conversation has ended. No further messages can be sent.
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 border-t border-border bg-background/70 p-4 backdrop-blur">
              {activeSession.status === 'closed' ? (
                <div className="flex select-none items-center justify-center gap-2 py-1.5 text-sm text-muted-foreground">
                  <PhoneOff className="w-4 h-4" />
                  Chat ended — messaging is disabled.
                </div>
              ) : (
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Type your reply... (Shift+Enter for new line)"
                    rows={1}
                    className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isSending}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:shadow-md disabled:opacity-40 disabled:shadow-none"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <CustomerProfileModal
        customerId={profileCustomerId}
        onClose={() => setProfileCustomerId(null)}
      />
    </div>
  );
}
