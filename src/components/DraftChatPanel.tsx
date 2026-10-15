import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type Group, type GroupMember, type GroupMessage } from '@/lib/supabase';
import { getColorClasses } from '@/lib/supabase';
import { Send, MessageSquare, X, ChevronDown } from 'lucide-react';

type Props = {
  userId: string;
  group: Group;
  members: GroupMember[];
};

const DRAFT_TOPIC_TITLE = 'Draft Chat';

export function DraftChatPanel({ userId, group, members }: Props) {
  const [topicId, setTopicId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const memberName = (uid: string) => members.find((m) => m.user_id === uid)?.display_name ?? 'Unknown';
  const memberColor = (uid: string) => {
    const m = members.find((mem) => mem.user_id === uid);
    return m ? getColorClasses(m.color) : getColorClasses('blue');
  };

  const ensureTopic = useCallback(async () => {
    const { data: existing } = await supabase
      .from('group_topics')
      .select('id')
      .eq('group_id', group.id)
      .eq('title', DRAFT_TOPIC_TITLE)
      .maybeSingle();

    if (existing) {
      setTopicId((existing as { id: string }).id);
      return;
    }

    const { data: created } = await supabase
      .from('group_topics')
      .insert({ group_id: group.id, created_by: userId, title: DRAFT_TOPIC_TITLE })
      .select()
      .single();

    if (created) {
      setTopicId((created as { id: string }).id);
    }
  }, [group.id, userId]);

  const loadMessages = useCallback(async () => {
    if (!topicId) return;
    const { data } = await supabase
      .from('group_messages')
      .select('*')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true });
    setMessages((data as GroupMessage[]) ?? []);
  }, [topicId]);

  useEffect(() => {
    ensureTopic();
  }, [ensureTopic]);

  useEffect(() => {
    if (topicId) loadMessages();
  }, [topicId, loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!topicId) return;
    const channel = supabase
      .channel(`draft_chat_${topicId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `topic_id=eq.${topicId}` }, () => {
        loadMessages();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_messages', filter: `topic_id=eq.${topicId}` }, () => {
        loadMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [topicId, loadMessages]);

  // Track unread messages when collapsed
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.user_id !== userId && !expanded) {
      setUnreadCount((prev) => prev + 1);
    }
    if (expanded) {
      setUnreadCount(0);
    }
  }, [messages, userId, expanded]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, expanded]);

  async function handleSend() {
    if (!newMsg.trim() || !topicId) return;
    setSending(true);
    const { data } = await supabase
      .from('group_messages')
      .insert({ topic_id: topicId, user_id: userId, body: newMsg.trim() })
      .select()
      .single();
    if (data) {
      setNewMsg('');
      await loadMessages();
    }
    setSending(false);
  }

  async function handleDeleteMessage(msgId: string) {
    await supabase.from('group_messages').delete().eq('id', msgId);
    await loadMessages();
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-lg transition-all hover:scale-105"
      >
        <MessageSquare className="w-5 h-5" />
        Draft Chat
        {unreadCount > 0 && (
          <span className="ml-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" style={{ maxHeight: '70vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-white" />
          <span className="text-sm font-bold text-white">Draft Chat</span>
          <span className="text-xs text-emerald-200">{members.length} members</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(false)}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs text-slate-400">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === userId;
            const name = memberName(msg.user_id);
            const color = memberColor(msg.user_id);
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${isMe ? 'order-2' : ''}`}>
                  {!isMe && (
                    <div className="flex items-center gap-1.5 mb-0.5 ml-1">
                      <div className={`w-4 h-4 rounded ${color.bg} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white font-bold text-[8px]">{name.charAt(0).toUpperCase()}</span>
                      </div>
                      <p className={`text-[10px] font-semibold ${color.text}`}>{name}</p>
                    </div>
                  )}
                  <div
                    className={`group relative rounded-xl px-3 py-2 ${
                      isMe
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-800'
                    }`}
                  >
                    <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                    <div className={`flex items-center gap-1.5 mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span className={`text-[9px] ${isMe ? 'text-emerald-200' : 'text-slate-400'}`}>
                        {formatTime(msg.created_at)}
                      </span>
                      {isMe && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="text-emerald-200 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 p-2 bg-white">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900 text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!newMsg.trim() || sending}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
