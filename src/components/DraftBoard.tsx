import { useState, useEffect, useCallback } from 'react';
import { supabase, type Group, type GroupMember, type GroupCalendarEntry, getColorClasses } from '@/lib/supabase';
import {
  ArrowLeft, Trophy, Play, Square, CheckCircle2, Clock, ChevronUp, ChevronDown,
  Calendar, AlertTriangle, SkipForward, Lock, RotateCcw, ListOrdered, Settings, DollarSign,
  Zap, AlertOctagon,
} from 'lucide-react';
import { RoleBadge } from '@/components/RoleBadge';
import { LeaderBadge } from '@/components/LeaderBadge';
import { DraftChatPanel } from '@/components/DraftChatPanel';

type Props = {
  userId: string;
  group: Group;
  members: GroupMember[];
  onGroupChanged: () => void;
  onBack: () => void;
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function DraftBoard({ userId, group, members, onGroupChanged, onBack }: Props) {
  const [entries, setEntries] = useState<GroupCalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSeniority, setEditingSeniority] = useState(false);
  const [editingWeeks, setEditingWeeks] = useState(false);
  const [localMembers, setLocalMembers] = useState<GroupMember[]>(members);
  const [showLeaderSettings, setShowLeaderSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('group_calendar')
      .select('*')
      .eq('group_id', group.id)
      .order('week_start', { ascending: true });
    setEntries((data as GroupCalendarEntry[]) ?? []);
    setLoading(false);
  }, [group.id]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Realtime: refresh when calendar entries or group settings change
  useEffect(() => {
    const channel = supabase
      .channel('draft_board_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_calendar', filter: `group_id=eq.${group.id}` }, () => {
        loadEntries();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${group.id}` }, () => {
        onGroupChanged();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${group.id}` }, () => {
        onGroupChanged();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [group.id, loadEntries, onGroupChanged]);

  useEffect(() => {
    setLocalMembers(members);
  }, [members]);

  const isLeader = group.created_by === userId;
  const draftStatus = group.draft_status;
  const draftActive = draftStatus === 'active';

  // Sort members by seniority order
  const sortedMembers = [...localMembers].sort((a, b) => a.seniority_order - b.seniority_order);
  const owners = sortedMembers.filter((m) => m.role !== 'reliever');
  const relievers = sortedMembers.filter((m) => m.role === 'reliever');
  const draftOrder = group.allow_reliever_picks ? [...owners, ...relievers] : owners;

  const currentRound = group.draft_round;
  const currentIndex = group.draft_current_index;

  // Calculate total picks from per-member allowances
  const totalPicks = draftOrder.reduce((sum, m) => sum + (m.vacation_weeks_allowed ?? 3), 0);

  // Snake draft: even rounds go forward, odd rounds go forward too (standard snake)
  const isJustPick = group.draft_type === 'just_pick';
  const isReverseRound = group.draft_type === 'snake' && currentRound % 2 === 0;
  const effectiveIndex = isReverseRound ? draftOrder.length - 1 - currentIndex : currentIndex;
  const currentMember = draftActive && !isJustPick ? draftOrder[effectiveIndex] : null;
  const isMyTurn = draftActive && (isJustPick ? (group.allow_reliever_picks || owners.some((o) => o.user_id === userId)) : currentMember?.user_id === userId);
  const canPickNow = draftActive && (isJustPick ? (group.allow_reliever_picks || owners.some((o) => o.user_id === userId)) : isMyTurn);

  const picksMade = entries.length;
  const draftProgress = totalPicks > 0 ? (picksMade / totalPicks) * 100 : 0;

  function getWeekStart(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function dateToStr(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  function getMemberByUserId(uid: string): GroupMember | undefined {
    return localMembers.find((m) => m.user_id === uid);
  }

  function getMemberPicks(uid: string): GroupCalendarEntry[] {
    return entries.filter((e) => e.user_id === uid).sort((a, b) => a.week_start.localeCompare(b.week_start));
  }

  function getMemberWeeksAllowed(uid: string): number {
    const member = getMemberByUserId(uid);
    return member?.vacation_weeks_allowed ?? 3;
  }

  function isWeekTaken(weekStartStr: string, excludeUserId?: string): boolean {
    return entries.some((e) => {
      if (e.week_start !== weekStartStr) return false;
      if (e.user_id === excludeUserId) return false;
      const member = getMemberByUserId(e.user_id);
      return member && member.role !== 'reliever';
    });
  }

  function getOverlappingEntries(): { weekStart: string; owners: GroupMember[] }[] {
    const weekOwners: Record<string, GroupMember[]> = {};
    entries.forEach((e) => {
      const member = getMemberByUserId(e.user_id);
      if (!member || member.role === 'reliever') return;
      if (!weekOwners[e.week_start]) weekOwners[e.week_start] = [];
      weekOwners[e.week_start].push(member);
    });
    return Object.entries(weekOwners)
      .filter(([, owners]) => owners.length > 1)
      .map(([weekStart, owners]) => ({ weekStart, owners }));
  }

  const overlaps = getOverlappingEntries();
  const hasOverlaps = overlaps.length > 0;

  async function handleStartDraft() {
    await supabase
      .from('groups')
      .update({ draft_status: 'active', draft_round: 1, draft_current_index: 0 })
      .eq('id', group.id);
    onGroupChanged();
  }

  async function handleEndJustPick() {
    if (hasOverlaps) return;
    await supabase
      .from('groups')
      .update({ draft_status: 'finalized' })
      .eq('id', group.id);
    onGroupChanged();
  }

  async function handleEndDraft() {
    await supabase
      .from('groups')
      .update({ draft_status: 'finalized' })
      .eq('id', group.id);
    onGroupChanged();
  }

  async function handleResetDraft() {
    await supabase.from('group_calendar').delete().eq('group_id', group.id);
    await supabase
      .from('groups')
      .update({ draft_status: 'idle', draft_round: 1, draft_current_index: 0 })
      .eq('id', group.id);
    await loadEntries();
    onGroupChanged();
  }

  async function handleRemovePick(weekStartStr: string) {
    if (!draftActive || !isJustPick) return;
    const entry = entries.find((e) => e.user_id === userId && e.week_start === weekStartStr);
    if (!entry) return;
    await supabase.from('group_calendar').delete().eq('id', entry.id);
    await loadEntries();
  }

  async function handlePickWeek(weekStart: Date) {
    if (!draftActive || !canPickNow) return;

    const weekStartStr = dateToStr(weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = dateToStr(weekEnd);

    // Check if this member already has this week
    const existing = entries.find((e) => e.user_id === userId && e.week_start === weekStartStr);
    if (existing) return;

    // Check if member has reached their allowance
    const myAllowed = getMemberWeeksAllowed(userId);
    const myPicks = getMemberPicks(userId);
    if (myPicks.length >= myAllowed) return;

    const { error } = await supabase.from('group_calendar').insert({
      group_id: group.id,
      user_id: userId,
      week_start: weekStartStr,
      week_end: weekEndStr,
      notes: null,
      status: 'confirmed',
    });

    if (error) return;

    if (isJustPick) {
      await loadEntries();
    } else {
      await loadEntries();
      await advanceDraft();
    }
  }

  async function handleSkipTurn() {
    if (!draftActive || !isMyTurn || isJustPick) return;
    await advanceDraft();
  }

  async function advanceDraft() {
    // Find the next member who still has picks remaining
    // We iterate through rounds, checking each member's remaining allowance
    let newRound = currentRound;
    let newIndex = currentIndex + 1;
    let foundNext = false;
    let attempts = 0;
    const maxAttempts = draftOrder.length * 20; // safety valve

    while (!foundNext && attempts < maxAttempts) {
      attempts++;

      if (newIndex >= draftOrder.length) {
        newIndex = 0;
        newRound++;
      }

      // Check if this member still has picks remaining
      const member = draftOrder[
        group.draft_type === 'snake' && newRound % 2 === 0
          ? draftOrder.length - 1 - newIndex
          : newIndex
      ];

      if (!member) break;

      const memberPicks = entries.filter((e) => e.user_id === member.user_id);
      const allowed = member.vacation_weeks_allowed ?? 3;

      if (memberPicks.length < allowed) {
        foundNext = true;
        break;
      }

      // This member is done, move to next
      newIndex++;
    }

    if (!foundNext) {
      // All members have finished their picks
      await supabase
        .from('groups')
        .update({ draft_status: 'finalized' })
        .eq('id', group.id);
    } else {
      await supabase
        .from('groups')
        .update({ draft_round: newRound, draft_current_index: newIndex })
        .eq('id', group.id);
    }
    onGroupChanged();
  }

  async function handleMoveSeniority(memberId: string, direction: 'up' | 'down') {
    const sorted = [...sortedMembers];
    const idx = sorted.findIndex((m) => m.id === memberId);
    if (idx === -1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const member = sorted[idx];
    const swapMember = sorted[swapIdx];

    await Promise.all([
      supabase.from('group_members').update({ seniority_order: swapMember.seniority_order }).eq('id', member.id),
      supabase.from('group_members').update({ seniority_order: member.seniority_order }).eq('id', swapMember.id),
    ]);

    setLocalMembers((prev) => {
      const updated = prev.map((m) => {
        if (m.id === member.id) return { ...m, seniority_order: swapMember.seniority_order };
        if (m.id === swapMember.id) return { ...m, seniority_order: member.seniority_order };
        return m;
      });
      return updated;
    });
  }

  async function handleSetMemberWeeks(memberId: string, weeks: number) {
    await supabase.from('group_members').update({ vacation_weeks_allowed: weeks }).eq('id', memberId);
    setLocalMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, vacation_weeks_allowed: weeks } : m));
  }

  async function handleUpdateSettings(updates: Partial<Group>) {
    setSavingSettings(true);
    await supabase.from('groups').update(updates).eq('id', group.id);
    await onGroupChanged();
    setSavingSettings(false);
  }

  function toLocalDateTimeInput(dt: string | null): string {
    if (!dt) return '';
    const d = new Date(dt);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  }

  // Generate upcoming weeks for picking (next 52 weeks from Jan of current year)
  const currentYear = new Date().getFullYear();
  const pickYear = currentYear;
  const yearWeeks: { date: Date; label: string }[] = [];
  const jan1 = new Date(pickYear, 0, 1);
  let wCursor = getWeekStart(jan1);
  for (let i = 0; i < 52; i++) {
    yearWeeks.push({
      date: new Date(wCursor),
      label: `${MONTH_SHORT[wCursor.getMonth()]} ${wCursor.getDate()}`,
    });
    wCursor.setDate(wCursor.getDate() + 7);
  }

  const myPicks = getMemberPicks(userId);
  const myWeeksAllowed = getMemberWeeksAllowed(userId);
  const myPicksRemaining = myWeeksAllowed - myPicks.length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-slate-900">Vacation Draft</h2>
      </div>

      {/* Draft status banner */}
      <div className={`rounded-2xl p-5 mb-6 ${
        draftStatus === 'active'
          ? 'bg-gradient-to-br from-emerald-600 to-emerald-700'
          : draftStatus === 'finalized'
            ? 'bg-gradient-to-br from-slate-700 to-slate-800'
            : 'bg-gradient-to-br from-slate-100 to-slate-200'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {draftStatus === 'active' ? (
                <Clock className="w-5 h-5 text-white" />
              ) : draftStatus === 'finalized' ? (
                <Lock className="w-5 h-5 text-white" />
              ) : (
                <Trophy className="w-5 h-5 text-slate-500" />
              )}
              <h3 className={`text-lg font-bold ${
                draftStatus === 'idle' ? 'text-slate-700' : 'text-white'
              }`}>
                {draftStatus === 'active' ? 'Draft in Progress' : draftStatus === 'finalized' ? 'Draft Finalized' : 'Draft Not Started'}
              </h3>
            </div>
            {draftStatus === 'active' && isJustPick && (
              <p className="text-sm text-emerald-100">
                Pick your {myPicksRemaining > 0 ? `${myPicksRemaining} remaining` : ''} weeks now — everyone picks at the same time!
                {hasOverlaps && <span className="block text-amber-200 mt-1">⚠ {overlaps.length} overlap{overlaps.length !== 1 ? 's' : ''} detected — someone needs to change their week.</span>}
              </p>
            )}
            {draftStatus === 'active' && currentMember && (
              <p className="text-sm text-emerald-100">
                Round {currentRound} ·{' '}
                {isMyTurn ? (
                  <span className="font-bold text-white">Your turn to pick!</span>
                ) : (
                  <span>Waiting for {currentMember.display_name}</span>
                )}
              </p>
            )}
            {draftStatus === 'idle' && (
              <p className="text-sm text-slate-500">
                {isLeader
                  ? group.draft_scheduled_at
                    ? `Draft scheduled for ${new Date(group.draft_scheduled_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${new Date(group.draft_scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. Or start it now.`
                    : 'Set the seniority order and vacation weeks per member, then start the draft.'
                  : group.draft_scheduled_at
                    ? `Draft scheduled for ${new Date(group.draft_scheduled_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${new Date(group.draft_scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`
                    : 'The group leader will start the draft when it\'s time to pick vacation weeks.'}
              </p>
            )}
            {draftStatus === 'finalized' && (
              <p className="text-sm text-slate-300">
                All {totalPicks} picks have been made. The schedule is locked.
              </p>
            )}
          </div>
          {isLeader && (
            <div className="flex gap-2">
              {draftStatus === 'idle' && (
                <button
                  onClick={handleStartDraft}
                  className="inline-flex items-center gap-1.5 bg-white text-slate-900 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start Draft
                </button>
              )}
              {draftActive && isJustPick && (
                <button
                  onClick={handleEndJustPick}
                  disabled={hasOverlaps}
                  className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors ${
                    hasOverlaps
                      ? 'bg-white/10 text-white/40 cursor-not-allowed'
                      : 'bg-white text-emerald-700 hover:bg-emerald-50'
                  }`}
                  title={hasOverlaps ? 'Resolve all overlaps first' : 'Finalize the picks'}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {hasOverlaps ? 'Resolve overlaps' : 'Finalize Picks'}
                </button>
              )}
              {draftActive && !isJustPick && (
                <button
                  onClick={handleEndDraft}
                  className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  <Square className="w-4 h-4" />
                  End Draft
                </button>
              )}
              {draftStatus === 'finalized' && (
                <button
                  onClick={handleResetDraft}
                  className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              )}
            </div>
          )}
        </div>

        {/* Progress bar */}
        {draftActive && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-emerald-100 font-medium">Draft Progress</span>
              <span className="text-xs text-white font-bold">{picksMade}/{totalPicks} picks</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${draftProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Leader Settings (leader only, when idle) */}
      {isLeader && draftStatus === 'idle' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
          <button
            onClick={() => setShowLeaderSettings(!showLeaderSettings)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-400" />
              <h3 className="font-bold text-slate-900">Draft Settings</h3>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showLeaderSettings ? 'rotate-180' : ''}`} />
          </button>
          {showLeaderSettings && (
            <div className="px-5 pb-5 space-y-5 border-t border-slate-100">
              {/* Draft Date & Time */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Scheduled Draft Start</label>
                <p className="text-xs text-slate-400 mb-2">Set a date and time for the draft to automatically go live. Leave blank to start manually.</p>
                <input
                  type="datetime-local"
                  value={toLocalDateTimeInput(group.draft_scheduled_at)}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleUpdateSettings({ draft_scheduled_at: val ? new Date(val).toISOString() : null });
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900"
                />
              </div>

              {/* Draft Type */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Draft Format</label>
                <div className="space-y-2">
                  <button
                    onClick={() => handleUpdateSettings({ draft_type: 'snake' })}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      group.draft_type === 'snake'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-bold text-slate-900">Seniority Snake Pick</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 pl-6">Highest seniority picks first. Order reverses each round (1→N, then N→1). Takes turns one at a time.</p>
                  </button>
                  <button
                    onClick={() => handleUpdateSettings({ draft_type: 'linear' })}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      group.draft_type === 'linear'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`
                  }>
                    <div className="flex items-center gap-2">
                      <ListOrdered className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-bold text-slate-900">Linear Pick</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 pl-6">Same seniority order every round (1→N each time). Takes turns one at a time.</p>
                  </button>
                  <button
                    onClick={() => handleUpdateSettings({ draft_type: 'just_pick' })}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      group.draft_type === 'just_pick'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-bold text-slate-900">Just Pick 'em</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 pl-6">Everyone picks at the same time — no waiting in line. If two routes overlap the same week, the group is notified until someone changes. Leader ends it when all weeks are covered without overlaps.</p>
                  </button>
                </div>
              </div>

              {/* Pick Time Limit — only for turn-based modes */}
              {group.draft_type !== 'just_pick' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pick Time Limit (hours)</label>
                  <p className="text-xs text-slate-400 mb-2">How long each member has to make their pick before being skipped.</p>
                  <div className="flex gap-2">
                    {[6, 12, 24, 48, 72].map((h) => (
                      <button
                        key={h}
                        onClick={() => handleUpdateSettings({ pick_time_limit_hours: h })}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          group.pick_time_limit_hours === h
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`
                      }>
                        {h < 24 ? `${h}h` : `${h / 24}d`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Auto-skip toggle — only for turn-based modes */}
              {group.draft_type !== 'just_pick' && (
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Auto-skip stalled members</p>
                    <p className="text-xs text-slate-400">Automatically skip members who exceed the pick time limit.</p>
                  </div>
                  <button
                    onClick={() => handleUpdateSettings({ auto_skip_enabled: !group.auto_skip_enabled })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      group.auto_skip_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      group.auto_skip_enabled ? 'translate-x-5' : ''
                    }`} />
                  </button>
                </label>
              )}

              {/* Reliever picks toggle */}
              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Relievers participate in draft</p>
                  <p className="text-xs text-slate-400">If off, only vendors pick vacation weeks. Relievers are still shown but don't get turns.</p>
                </div>
                <button
                  onClick={() => handleUpdateSettings({ allow_reliever_picks: !group.allow_reliever_picks })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    group.allow_reliever_picks ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    group.allow_reliever_picks ? 'translate-x-5' : ''
                  }`} />
                </button>
              </label>

              {savingSettings && (
                <p className="text-xs text-slate-400 text-center">Saving...</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scheduled draft info for non-leaders */}
      {!isLeader && draftStatus === 'idle' && group.draft_scheduled_at && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            Draft scheduled for{' '}
            <span className="font-semibold">
              {new Date(group.draft_scheduled_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {' at '}
              {new Date(group.draft_scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </p>
        </div>
      )}

      {/* Seniority / Draft order */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-slate-400" />
            <h3 className="font-bold text-slate-900">Draft Order (Seniority)</h3>
          </div>
          <div className="flex gap-3">
            {isLeader && draftStatus === 'idle' && (
              <button
                onClick={() => setEditingWeeks(!editingWeeks)}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                {editingWeeks ? 'Done' : 'Set Weeks'}
              </button>
            )}
            {isLeader && draftStatus === 'idle' && (
              <button
                onClick={() => setEditingSeniority(!editingSeniority)}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                {editingSeniority ? 'Done' : 'Reorder'}
              </button>
            )}
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {sortedMembers.map((member, idx) => {
            const color = getColorClasses(member.color);
            const memberPicks = getMemberPicks(member.user_id);
            const weeksAllowed = member.vacation_weeks_allowed ?? 3;
            const isCurrent = draftActive && !isJustPick && currentMember?.user_id === member.user_id;
            const isPicking = draftActive && isJustPick && memberPicks.length < weeksAllowed;
            const isDone = draftActive && isJustPick && memberPicks.length >= weeksAllowed;

            return (
              <div
                key={member.id}
                className={`flex items-center gap-3 p-4 transition-colors ${
                  isCurrent || isPicking ? 'bg-emerald-50' : ''
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-slate-500">{idx + 1}</span>
                </div>
                <div className={`w-10 h-10 rounded-xl ${color.bg} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white font-bold text-sm">
                    {member.display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 text-sm truncate">{member.display_name}</p>
                    <RoleBadge role={member.role} />
                    {group.created_by === member.user_id && <LeaderBadge />}
                    {isCurrent && (
                      <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                        Picking now
                      </span>
                    )}
                    {isPicking && (
                      <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">
                        {memberPicks.length}/{weeksAllowed} picked
                      </span>
                    )}
                    {isDone && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                        Done
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {memberPicks.length}/{weeksAllowed} weeks picked
                  </p>
                </div>
                {/* Show picked weeks */}
                <div className="hidden sm:flex gap-1">
                  {memberPicks.slice(0, 3).map((pick) => {
                    const d = new Date(pick.week_start);
                    return (
                      <div key={pick.id} className={`text-xs ${color.light} ${color.text} px-2 py-1 rounded-lg font-medium`}>
                        {MONTH_SHORT[d.getMonth()]} {d.getDate()}
                      </div>
                    );
                  })}
                  {memberPicks.length > 3 && (
                    <span className="text-xs text-slate-400 self-center">+{memberPicks.length - 3}</span>
                  )}
                </div>
                {/* Weeks editor (leader only, when editing) */}
                {editingWeeks && (
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <button
                        key={n}
                        onClick={() => handleSetMemberWeeks(member.id, n)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          weeksAllowed === n
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
                {/* Reorder controls */}
                {editingSeniority && !editingWeeks && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMoveSeniority(member.id, 'up')}
                      disabled={idx === 0}
                      className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveSeniority(member.id, 'down')}
                      disabled={idx === sortedMembers.length - 1}
                      className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Vacation weeks explanation (leader only, when idle) */}
      {isLeader && draftStatus === 'idle' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-slate-900">Vacation Weeks Per Member</h3>
          </div>
          <p className="text-sm text-slate-500 mb-3">
            Set how many vacation weeks each member gets based on their weekly reliever payment. Click "Set Weeks" above to adjust each person individually.
          </p>
          <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
            <p className="font-medium text-slate-600 mb-1">Example guide:</p>
            <div className="grid grid-cols-2 gap-1">
              <span>$50/week = 3 weeks</span>
              <span>$100/week = 5 weeks</span>
              <span>$150/week = 6 weeks</span>
              <span>$200/week = 8 weeks</span>
            </div>
            <p className="text-slate-400 mt-2">Adjust as needed — the leader has full control over each member's allowance.</p>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">Total picks across all members:</span>
            <span className="font-bold text-slate-900">{totalPicks}</span>
          </div>
        </div>
      )}

      {/* Overlap alert (just_pick mode) */}
      {draftActive && isJustPick && hasOverlaps && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900 text-sm">Route coverage overlap detected</p>
            <p className="text-xs text-red-700 mt-1">Two route owners picked the same week. Someone needs to change their dates before the leader can finalize.</p>
            <div className="mt-2 space-y-1">
              {overlaps.map((overlap) => {
                const d = new Date(overlap.weekStart);
                return (
                  <div key={overlap.weekStart} className="text-xs text-red-800 bg-red-100 rounded-lg px-2.5 py-1.5">
                    <span className="font-semibold">{MONTH_SHORT[d.getMonth()]} {d.getDate()}, {d.getFullYear()}:</span>{' '}
                    {overlap.owners.map((o, i) => (
                      <span key={o.id}>{i > 0 ? ' vs ' : ''}{o.display_name}</span>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Week picker (when it's your turn, or always in just_pick) */}
      {draftActive && canPickNow && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">{isJustPick ? 'Pick Your Vacation Weeks' : 'Pick Your Vacation Week'}</h3>
            {!isJustPick && (
              <button
                onClick={handleSkipTurn}
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                <SkipForward className="w-4 h-4" />
                Skip Turn
              </button>
            )}
          </div>
          {myPicksRemaining <= 0 && !isJustPick ? (
            <p className="text-sm text-slate-500 text-center py-4">
              You've picked all {myWeeksAllowed} of your weeks. Skipping your turn...
            </p>
          ) : myPicksRemaining <= 0 && isJustPick ? (
            <p className="text-sm text-slate-500 text-center py-4">
              You've picked all {myWeeksAllowed} of your weeks. Tap any highlighted week to remove it and pick a different one.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-3">
                You have <span className="font-bold text-slate-700">{myPicksRemaining}</span> week{myPicksRemaining !== 1 ? 's' : ''} left to pick. Tap a week to select it.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {yearWeeks.map(({ date, label }) => {
                  const weekStr = dateToStr(date);
                  const taken = isWeekTaken(weekStr, userId);
                  const alreadyMine = entries.some((e) => e.user_id === userId && e.week_start === weekStr);
                  const isPast = weekStr < dateToStr(new Date());
                  const isOverlap = isJustPick && taken && !alreadyMine;

                  return (
                    <button
                      key={weekStr}
                      disabled={(taken && !isJustPick) || (alreadyMine && !isJustPick) || isPast}
                      onClick={() => alreadyMine && isJustPick ? handleRemovePick(weekStr) : handlePickWeek(date)}
                      className={`p-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                        alreadyMine
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                          : isOverlap
                            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                            : taken
                              ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                              : isPast
                                ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                : 'bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 border border-transparent'
                      }`}
                    >
                      <div className="font-semibold">{label}</div>
                      {isOverlap && (
                        <div className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Overlap
                        </div>
                      )}
                      {taken && !alreadyMine && !isOverlap && (
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Taken
                        </div>
                      )}
                      {alreadyMine && (
                        <div className="text-xs text-emerald-500 mt-0.5">{isJustPick ? 'Tap to remove' : 'Your pick'}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Draft board - all picks */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Draft Board</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No picks have been made yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Pick #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Member</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Week</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...entries]
                  .sort((a, b) => a.created_at.localeCompare(b.created_at))
                  .map((entry, idx) => {
                    const member = getMemberByUserId(entry.user_id);
                    if (!member) return null;
                    const color = getColorClasses(member.color);
                    const d = new Date(entry.week_start);

                    return (
                      <tr key={entry.id}>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg ${color.bg} flex items-center justify-center`}>
                              <span className="text-white font-bold text-xs">
                                {member.display_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-slate-700">{member.display_name}</span>
                            <RoleBadge role={member.role} />
                            {group.created_by === member.user_id && <LeaderBadge />}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${color.text} ${color.light} px-2.5 py-1 rounded-lg`}>
                            {MONTH_SHORT[d.getMonth()]} {d.getDate()}, {d.getFullYear()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Waiting message when not your turn (turn-based modes only) */}
      {draftActive && !isMyTurn && currentMember && !isJustPick && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            Waiting for <span className="font-semibold">{currentMember.display_name}</span> to pick their week. You'll be notified when it's your turn.
          </p>
        </div>
      )}

      {/* Live chat during the draft */}
      {draftActive && (
        <DraftChatPanel userId={userId} group={group} members={localMembers} />
      )}
    </div>
  );
}
