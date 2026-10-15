import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type Group, type GroupMember, type GroupTopic, type GroupMessage } from '@/lib/supabase';
import { MessageSquare, Plus, X, ArrowLeft, Send, Trash2, MessagesSquare } from 'lucide-react';

type Props = {
  userId: string;
  group: Group;
  members: GroupMember[];
  onBack: () => void;
};

type TopicWithMeta = GroupTopic & {
  messageCount: number;
  lastActivity: string;
  authorName: string;
};

export function GroupChat({ userId, group, members, onBack }: Props) {
  const [topics, setTopics] = useState<TopicWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [openTopic, setOpenTopic] = useState<TopicWithMeta | null>(null);

  const memberName = (uid: string) => members.find((m) => m.user_id === uid)?.display_name ?? 'Unknown';

  const loadTopics = useCallback(async () => {
    const { data: topicData } = await supabase
      .from('group_topics')
      .select('*')
      .eq('group_id', group.id)
      .order('created_at', { ascending: false });

    const topicList = (topicData as GroupTopic[]) ?? [];
    const topicsWithMeta: TopicWithMeta[] = await Promise.all(
      topicList.map(async (t) => {
        const { data: msgs } = await supabase
          .from('group_messages')
          .select('created_at')
          .eq('topic_id', t.id)
          .order('created_at', { ascending: false });
        const msgList = (msgs as { created_at: string }[]) ?? [];
        return {
          ...t,
          messageCount: msgList.length,
          lastActivity: msgList.length > 0 ? msgList[0].created_at : t.created_at,
          authorName: memberName(t.created_by),
        };
      })
    );
    topicsWithMeta.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
    setTopics(topicsWithMeta);
    setLoading(false);
  }, [group.id, members]);

  useEffect(() => {
    setLoading(true);
    loadTopics();
  }, [loadTopics]);

  // Realtime: refresh topic list when topics or messages change
  useEffect(() => {
    if (openTopic) return;
    const channel = supabase
      .channel('group_topics_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_topics', filter: `group_id=eq.${group.id}` }, () => {
        loadTopics();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, () => {
        loadTopics();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [group.id, loadTopics, openTopic]);

  async function handleCreateTopic() {
    if (!newTitle.trim()) return;
    setCreating(true);
    const { data } = await supabase
      .from('group_topics')
      .insert({ group_id: group.id, created_by: userId, title: newTitle.trim() })
      .select()
      .single();
    if (data) {
      setNewTitle('');
      setShowCreate(false);
      await loadTopics();
    }
    setCreating(false);
  }

  async function handleDeleteTopic(topicId: string) {
    await supabase.from('group_topics').delete().eq('id', topicId);
    await loadTopics();
  }

  function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (openTopic) {
    return (
      <TopicThread
        topic={openTopic}
        userId={userId}
        memberName={memberName}
        onBack={() => { setOpenTopic(null); loadTopics(); }}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Group Chat</h2>
            <p className="text-sm text-slate-500">Forum threads for group discussions</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Topic
        </button>
      </div>

      {/* Create topic modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">New Topic</h3>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-3">
              Start a discussion thread. Any group member can read and reply.
            </p>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Reliever schedule for December"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && newTitle.trim()) handleCreateTopic(); }}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTopic}
                disabled={!newTitle.trim() || creating}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Topic'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <MessagesSquare className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No topics yet</h3>
          <p className="text-sm text-slate-500">Start a discussion thread for your group.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => {
            const canDelete = topic.created_by === userId;
            return (
              <div
                key={topic.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-slate-300 transition-all cursor-pointer group"
                onClick={() => setOpenTopic(topic)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate group-hover:text-emerald-700 transition-colors">
                        {topic.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">by {topic.authorName}</span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400">{topic.messageCount} {topic.messageCount === 1 ? 'reply' : 'replies'}</span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400">{relativeTime(topic.lastActivity)}</span>
                      </div>
                    </div>
                  </div>
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteTopic(topic.id); }}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TopicThread({
  topic,
  userId,
  memberName,
  onBack,
}: {
  topic: TopicWithMeta;
  userId: string;
  memberName: (uid: string) => string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('group_messages')
      .select('*')
      .eq('topic_id', topic.id)
      .order('created_at', { ascending: true });
    setMessages((data as GroupMessage[]) ?? []);
    setLoading(false);
  }, [topic.id]);

  useEffect(() => {
    setLoading(true);
    loadMessages();
  }, [loadMessages]);

  // Realtime for messages in this topic
  useEffect(() => {
    const channel = supabase
      .channel(`topic_${topic.id}_messages`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `topic_id=eq.${topic.id}` }, () => {
        loadMessages();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_messages', filter: `topic_id=eq.${topic.id}` }, () => {
        loadMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [topic.id, loadMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    if (!newMsg.trim()) return;
    setSending(true);
    const { data } = await supabase
      .from('group_messages')
      .insert({ topic_id: topic.id, user_id: userId, body: newMsg.trim() })
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
    return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ minHeight: 'calc(100dvh - 200px)' }}>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900 truncate">{topic.title}</h2>
          <p className="text-xs text-slate-400">by {topic.authorName} · {topic.messageCount} {topic.messageCount === 1 ? 'reply' : 'replies'}</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-4" style={{ maxHeight: 'calc(100dvh - 340px)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <MessageSquare className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === userId;
            const name = memberName(msg.user_id);
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${isMe ? 'order-2' : ''}`}>
                  {!isMe && (
                    <p className="text-xs font-semibold text-slate-500 mb-1 ml-1">{name}</p>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 group relative ${
                      isMe
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-800'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                    <div className={`flex items-center gap-2 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span className={`text-[10px] ${isMe ? 'text-emerald-200' : 'text-slate-400'}`}>
                        {formatTime(msg.created_at)}
                      </span>
                      {isMe && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="text-emerald-200 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
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

      {/* Message input */}
      <div className="border-t border-slate-200 pt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900 text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!newMsg.trim() || sending}
            className="px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
