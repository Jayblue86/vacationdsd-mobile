import { useState, useEffect, useRef } from 'react';
import { supabase, type Notification } from '@/lib/supabase';
import { Bell, X, Clock, Users, Calendar, Info, MessageSquare, PartyPopper } from 'lucide-react';

type Props = {
  userId: string;
  onNavigate: (link: string) => void;
};

const ICONS: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  draft_reminder: { icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  group_update: { icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
  weekly_summary: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
  vacation_weekly: { icon: PartyPopper, color: 'text-amber-600', bg: 'bg-amber-100' },
  reliever_feedback: { icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-100' },
  general: { icon: Info, color: 'text-slate-600', bg: 'bg-slate-100' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function NotificationBell({ userId, onNavigate }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    const notifs = (data as Notification[]) ?? [];
    setNotifications(notifs);
    setUnreadCount(notifs.filter((n) => !n.read_at).length);
  }

  async function handleMarkAllRead() {
    const unread = notifications.filter((n) => !n.read_at);
    if (unread.length === 0) return;
    setLoading(true);
    await Promise.all(
      unread.map((n) =>
        supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
      )
    );
    await loadNotifications();
    setLoading(false);
  }

  async function handleMarkRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    await loadNotifications();
  }

  async function handleDelete(id: string) {
    await supabase.from('notifications').delete().eq('id', id);
    await loadNotifications();
  }

  function handleNotifClick(notif: Notification) {
    if (!notif.read_at) handleMarkRead(notif.id);
    if (notif.link) {
      onNavigate(notif.link);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 max-h-[480px] flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="text-center py-10">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((notif) => {
                  const config = ICONS[notif.type] ?? ICONS.general;
                  const Icon = config.icon;
                  const isUnread = !notif.read_at;

                  return (
                    <div
                      key={notif.id}
                      className={`px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer group ${
                        isUnread ? 'bg-emerald-50/40' : ''
                      }`}
                      onClick={() => handleNotifClick(notif)}
                    >
                      <div className="flex gap-3">
                        <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                              {notif.title}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(notif.id);
                              }}
                              className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {notif.body && (
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.body}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-slate-400">{timeAgo(notif.created_at)}</span>
                            {isUnread && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
