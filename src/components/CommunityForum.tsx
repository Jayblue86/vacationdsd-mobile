import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type ForumCategory, type ForumTopic, type ForumPost, type Profile } from '@/lib/supabase';
import { MessageSquare, Plus, X, ArrowLeft, Trash2, Send, Users, Pin, MapPin } from 'lucide-react';

type Props = {
  userId: string;
  profile: Profile | null;
};

type TopicWithMeta = ForumTopic & {
  authorName: string;
  authorLocation: string;
  postCount: number;
  lastActivity: string;
};

export function CommunityForum({ userId, profile }: Props) {
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ForumCategory | null>(null);
  const [topics, setTopics] = useState<TopicWithMeta[]>([]);
  const [openTopic, setOpenTopic] = useState<TopicWithMeta | null>(null);
  const [posts, setPosts] = useState<(ForumPost & { authorName: string; authorLocation: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newPostBody, setNewPostBody] = useState('');
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [authorCache, setAuthorCache] = useState<Record<string, { name: string; location: string }>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadCategories = useCallback(async () => {
    const { data } = await supabase
      .from('forum_categories')
      .select('*')
      .order('display_order', { ascending: true });
    setCategories((data as ForumCategory[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const fetchAuthorInfo = useCallback(async (userIds: string[]) => {
    const uniqueIds = [...new Set(userIds)].filter((id) => !authorCache[id]);
    if (uniqueIds.length === 0) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, city, state')
      .in('id', uniqueIds);
    const cacheUpdate: Record<string, { name: string; location: string }> = {};
    (data ?? []).forEach((p: any) => {
      const loc = [p.city, p.state].filter(Boolean).join(', ');
      cacheUpdate[p.id] = {
        name: p.full_name ?? 'Unknown',
        location: loc || 'Location not set',
      };
    });
    setAuthorCache((prev) => ({ ...prev, ...cacheUpdate }));
  }, [authorCache]);

  const loadTopics = useCallback(async (categoryId: string) => {
    const { data: topicRows } = await supabase
      .from('forum_topics')
      .select('*')
      .eq('category_id', categoryId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    const topicList = (topicRows as ForumTopic[]) ?? [];
    if (topicList.length === 0) {
      setTopics([]);
      return;
    }

    const [postsRes] = await Promise.all([
      supabase
        .from('forum_posts')
        .select('topic_id, created_at')
        .in('topic_id', topicList.map((t) => t.id)),
    ]);

    const allPosts = (postsRes.data ?? []) as { topic_id: string; created_at: string }[];
    await fetchAuthorInfo(topicList.map((t) => t.user_id));

    const topicsWithMeta: TopicWithMeta[] = topicList.map((t) => {
      const topicPosts = allPosts.filter((p) => p.topic_id === t.id);
      const lastActivity = topicPosts.length > 0
        ? topicPosts.map((p) => p.created_at).sort().reverse()[0]
        : t.created_at;
      return {
        ...t,
        authorName: authorCache[t.user_id]?.name ?? 'Unknown',
        authorLocation: authorCache[t.user_id]?.location ?? '',
        postCount: topicPosts.length,
        lastActivity,
      };
    });

    setTopics(topicsWithMeta);
  }, [fetchAuthorInfo, authorCache]);

  useEffect(() => {
    if (selectedCategory) {
      setLoading(true);
      loadTopics(selectedCategory.id).then(() => setLoading(false));
    }
  }, [selectedCategory, loadTopics]);

  // Realtime for topics
  useEffect(() => {
    if (!selectedCategory) return;
    const channel = supabase
      .channel(`forum_topics_${selectedCategory.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_topics', filter: `category_id=eq.${selectedCategory.id}` }, () => {
        loadTopics(selectedCategory.id);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_posts' }, () => {
        loadTopics(selectedCategory.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedCategory, loadTopics]);

  const loadPosts = useCallback(async (topicId: string) => {
    const { data: postRows } = await supabase
      .from('forum_posts')
      .select('*')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true });

    const postList = (postRows as ForumPost[]) ?? [];
    await fetchAuthorInfo(postList.map((p) => p.user_id));

    const postsWithMeta = postList.map((p) => ({
      ...p,
      authorName: authorCache[p.user_id]?.name ?? 'Unknown',
      authorLocation: authorCache[p.user_id]?.location ?? '',
    }));

    setPosts(postsWithMeta);
  }, [fetchAuthorInfo, authorCache]);

  useEffect(() => {
    if (openTopic) {
      loadPosts(openTopic.id);
    }
  }, [openTopic, loadPosts]);

  // Realtime for posts in open topic
  useEffect(() => {
    if (!openTopic) return;
    const channel = supabase
      .channel(`forum_posts_${openTopic.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_posts', filter: `topic_id=eq.${openTopic.id}` }, () => {
        loadPosts(openTopic.id);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'forum_posts', filter: `topic_id=eq.${openTopic.id}` }, () => {
        loadPosts(openTopic.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [openTopic, loadPosts]);

  // Auto-scroll to bottom on new posts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [posts]);

  async function handleCreateTopic() {
    if (!newTopicTitle.trim() || !selectedCategory) return;
    setCreating(true);
    const { data } = await supabase
      .from('forum_topics')
      .insert({ category_id: selectedCategory.id, title: newTopicTitle.trim() })
      .select()
      .single();
    if (data) {
      const topic = data as ForumTopic;
      const loc = [profile?.city, profile?.state].filter(Boolean).join(', ');
      const newTopicMeta: TopicWithMeta = {
        ...topic,
        authorName: profile?.full_name ?? 'Unknown',
        authorLocation: loc || '',
        postCount: 0,
        lastActivity: topic.created_at,
      };
      setNewTopicTitle('');
      setShowCreateTopic(false);
      await loadTopics(selectedCategory.id);
      setOpenTopic(newTopicMeta);
    }
    setCreating(false);
  }

  async function handleSendPost() {
    if (!newPostBody.trim() || !openTopic) return;
    setSending(true);
    const { data } = await supabase
      .from('forum_posts')
      .insert({ topic_id: openTopic.id, body: newPostBody.trim() })
      .select()
      .single();
    if (data) {
      setNewPostBody('');
      await loadPosts(openTopic.id);
      await loadTopics(openTopic.category_id);
    }
    setSending(false);
  }

  async function handleDeleteTopic(topicId: string) {
    await supabase.from('forum_topics').delete().eq('id', topicId);
    if (openTopic?.id === topicId) {
      setOpenTopic(null);
    }
    if (selectedCategory) {
      await loadTopics(selectedCategory.id);
    }
  }

  async function handleDeletePost(postId: string) {
    await supabase.from('forum_posts').delete().eq('id', postId);
    if (openTopic) {
      await loadPosts(openTopic.id);
      await loadTopics(openTopic.category_id);
    }
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Thread view (inside a topic)
  if (openTopic) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col" style={{ minHeight: 'calc(100dvh - 200px)' }}>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setOpenTopic(null)}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {openTopic.pinned && <Pin className="w-4 h-4 text-amber-500 flex-shrink-0" />}
              <h2 className="text-lg font-bold text-slate-900 truncate">{openTopic.title}</h2>
            </div>
            <p className="text-xs text-slate-400">
              by {openTopic.authorName}
              {openTopic.authorLocation && ` · ${openTopic.authorLocation}`}
              {' · '}{posts.length} {posts.length === 1 ? 'reply' : 'replies'}
            </p>
          </div>
          {openTopic.user_id === userId && (
            <button
              onClick={() => handleDeleteTopic(openTopic.id)}
              className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete topic"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4" style={{ maxHeight: 'calc(100dvh - 340px)' }}>
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No replies yet. Be the first to respond!</p>
            </div>
          ) : (
            posts.map((post) => {
              const isMe = post.user_id === userId;
              return (
                <div key={post.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${isMe ? 'order-2' : ''}`}>
                    {!isMe && (
                      <div className="flex items-center gap-2 mb-1 ml-1">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-emerald-700 font-bold text-xs">
                            {post.authorName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{post.authorName}</p>
                          {post.authorLocation && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" />
                              {post.authorLocation}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    <div
                      className={`group relative rounded-2xl px-4 py-3 ${
                        isMe
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-800'
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{post.body}</p>
                      <div className={`flex items-center gap-2 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-[10px] ${isMe ? 'text-emerald-200' : 'text-slate-400'}`}>
                          {formatTime(post.created_at)}
                        </span>
                        {isMe && (
                          <button
                            onClick={() => handleDeletePost(post.id)}
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

        {/* Post input */}
        <div className="border-t border-slate-200 pt-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newPostBody}
              onChange={(e) => setNewPostBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendPost(); } }}
              placeholder="Write a reply..."
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900 text-sm"
            />
            <button
              onClick={handleSendPost}
              disabled={!newPostBody.trim() || sending}
              className="px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Topic list view (inside a category)
  if (selectedCategory) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedCategory(null)}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{selectedCategory.name}</h2>
              <p className="text-sm text-slate-500">{selectedCategory.description}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateTopic(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Topic
          </button>
        </div>

        {showCreateTopic && (
          <div className="mb-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900">New Topic</h3>
              <button onClick={() => { setShowCreateTopic(false); setNewTopicTitle(''); }} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={newTopicTitle}
              onChange={(e) => setNewTopicTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newTopicTitle.trim()) handleCreateTopic(); }}
              placeholder="Topic title..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900 text-sm"
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setShowCreateTopic(false); setNewTopicTitle(''); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTopic}
                disabled={!newTopicTitle.trim() || creating}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Topic'}
              </button>
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
              <MessageSquare className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No topics yet</h3>
            <p className="text-sm text-slate-500 mb-4">Start the conversation in {selectedCategory.name}.</p>
            <button
              onClick={() => setShowCreateTopic(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Topic
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {topics.map((topic) => {
              const canDelete = topic.user_id === userId;
              return (
                <div
                  key={topic.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-slate-300 transition-all cursor-pointer group"
                  onClick={() => setOpenTopic(topic)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${topic.pinned ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                        {topic.pinned ? <Pin className="w-5 h-5 text-amber-500" /> : <MessageSquare className="w-5 h-5 text-emerald-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate group-hover:text-emerald-700 transition-colors">
                          {topic.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-slate-400">by {topic.authorName}</span>
                          {topic.authorLocation && (
                            <>
                              <span className="text-xs text-slate-300">·</span>
                              <span className="text-xs text-slate-400 flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5" />
                                {topic.authorLocation}
                              </span>
                            </>
                          )}
                          <span className="text-xs text-slate-300">·</span>
                          <span className="text-xs text-slate-400">{topic.postCount} {topic.postCount === 1 ? 'reply' : 'replies'}</span>
                          <span className="text-xs text-slate-300">·</span>
                          <span className="text-xs text-slate-400">{formatTime(topic.lastActivity)}</span>
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

  // Category list view (landing)
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Community Forum</h2>
            <p className="text-sm text-slate-500">Connect with DSD route owners and relievers across the country</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {categories.map((cat) => {
            const topicCount = topics.length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat)}
                className="text-left bg-white rounded-2xl border border-slate-200 p-5 hover:border-emerald-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center flex-shrink-0 transition-colors">
                    <MessageSquare className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm leading-snug group-hover:text-emerald-700 transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{cat.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Info banner */}
      <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Users className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-emerald-900 text-sm">Welcome to the nationwide community</p>
          <p className="text-xs text-emerald-700 mt-0.5">
            This forum is open to all VacationDSD members. Share tips, ask questions, and connect with route owners and relievers from coast to coast. Be respectful — everyone's here to help each other out.
          </p>
        </div>
      </div>
    </div>
  );
}
