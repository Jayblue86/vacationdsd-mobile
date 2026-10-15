import { useState, useEffect, useCallback } from 'react';
import { supabase, type GroupMember, type GroupCalendarEntry, getColorClasses } from '@/lib/supabase';
import {
  ChevronLeft, ChevronRight, Calendar, X, AlertTriangle, ArrowLeft,
  LayoutGrid, Grid, Lock,
} from 'lucide-react';
import { RoleBadge } from '@/components/RoleBadge';
import { LeaderBadge } from '@/components/LeaderBadge';

type Props = {
  userId: string;
  groupId: string;
  members: GroupMember[];
  createdBy: string;
  onBack: () => void;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_HEADERS = ['Wk', 'M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function GroupCalendar({ userId, groupId, members, createdBy, onBack }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<GroupCalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<{ start: Date; end: Date } | null>(null);
  const [weekEntries, setWeekEntries] = useState<GroupCalendarEntry[]>([]);
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('group_calendar')
      .select('*')
      .eq('group_id', groupId)
      .order('week_start', { ascending: true });
    setEntries((data as GroupCalendarEntry[]) ?? []);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Realtime: refresh when calendar entries change
  useEffect(() => {
    const channel = supabase
      .channel('group_calendar_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_calendar', filter: `group_id=eq.${groupId}` }, () => {
        loadEntries();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, loadEntries]);

  function getWeekStart(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function getWeekEnd(weekStart: Date): Date {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }

  function dateToStr(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  function getEntriesForWeek(weekStart: Date): GroupCalendarEntry[] {
    const weekStr = dateToStr(weekStart);
    return entries.filter((e) => e.week_start === weekStr);
  }

  function getMemberByUserId(uid: string): GroupMember | undefined {
    return members.find((m) => m.user_id === uid);
  }

  function hasConflict(weekStart: Date, excludeUserId?: string): boolean {
    const weekEntries = getEntriesForWeek(weekStart);
    const ownersBooked = weekEntries.filter((e) => {
      if (e.user_id === excludeUserId) return false;
      const member = getMemberByUserId(e.user_id);
      return member && member.role !== 'reliever';
    });
    return ownersBooked.length > 0;
  }

  function prevMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  }
  function prevYear() {
    setCurrentDate(new Date(currentDate.getFullYear() - 1, 0, 1));
  }
  function nextYear() {
    setCurrentDate(new Date(currentDate.getFullYear() + 1, 0, 1));
  }
  function goToToday() {
    setCurrentDate(new Date());
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayStr = dateToStr(new Date());

  function handleWeekClick(weekStart: Date) {
    const weekEnd = getWeekEnd(weekStart);
    setSelectedWeek({ start: weekStart, end: weekEnd });
    setWeekEntries(getEntriesForWeek(weekStart));
  }

  function handleCloseWeekDetail() {
    setSelectedWeek(null);
    setWeekEntries([]);
  }

  // Month grid weeks
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekStart = getWeekStart(firstOfMonth);
  const lastOfMonth = new Date(year, month + 1, 0);
  const lastWeekStart = getWeekStart(lastOfMonth);

  const weeks: Date[] = [];
  let weekCursor = new Date(firstWeekStart);
  while (weekCursor <= lastWeekStart) {
    weeks.push(new Date(weekCursor));
    weekCursor.setDate(weekCursor.getDate() + 7);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-slate-900">Group Calendar</h2>
          <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            <Lock className="w-3 h-3" />
            <span className="font-medium">Draft-finalized</span>
          </div>
        </div>

        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setViewMode('month')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              viewMode === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Month
          </button>
          <button
            onClick={() => setViewMode('year')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              viewMode === 'year' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Grid className="w-4 h-4" />
            Year
          </button>
        </div>
      </div>

      {/* Color legend */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          {members.map((member) => {
            const color = getColorClasses(member.color);
            return (
              <div key={member.id} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${color.bg}`} />
                <span className="text-sm text-slate-600">{member.display_name}</span>
                <RoleBadge role={member.role} />
                {createdBy === member.user_id && <LeaderBadge />}
              </div>
            );
          })}
        </div>
      </div>

      {viewMode === 'month' ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold text-slate-900 min-w-[160px] text-center">
                {MONTHS[month]} {year}
              </h3>
              <button onClick={nextMonth} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={goToToday}
              className="text-sm text-slate-500 hover:text-slate-700 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Today
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-8 border-b border-slate-100">
                {DAY_HEADERS.map((h, i) => (
                  <div key={i} className={`py-2 text-center text-xs font-semibold ${i === 0 ? 'text-slate-400' : 'text-slate-500'}`}>
                    {h}
                  </div>
                ))}
              </div>

              {weeks.map((weekStart, weekIdx) => {
                const weekEntriesForThisWeek = getEntriesForWeek(weekStart);
                const isCurrentWeek = todayStr >= dateToStr(weekStart) && todayStr <= dateToStr(getWeekEnd(weekStart));
                const conflict = hasConflict(weekStart);

                return (
                  <div
                    key={weekIdx}
                    className={`grid grid-cols-8 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors ${
                      isCurrentWeek ? 'bg-emerald-50/50' : ''
                    }`}
                    onClick={() => handleWeekClick(weekStart)}
                  >
                    <div className="py-3 px-1 text-center border-r border-slate-50">
                      <span className="text-xs text-slate-400 font-medium">W{getWeekNumber(weekStart)}</span>
                      {conflict && (
                        <div className="flex justify-center mt-0.5">
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                        </div>
                      )}
                    </div>

                    {Array.from({ length: 7 }).map((_, dayIdx) => {
                      const date = new Date(weekStart);
                      date.setDate(date.getDate() + dayIdx);
                      const isThisMonth = date.getMonth() === month;
                      const isToday = dateToStr(date) === todayStr;

                      return (
                        <div
                          key={dayIdx}
                          className={`py-2 px-1 min-h-[48px] border-r border-slate-50 last:border-0 relative ${
                            isThisMonth ? 'bg-white' : 'bg-slate-50/50'
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isToday
                                ? 'bg-emerald-500 text-white rounded-full w-5 h-5 inline-flex items-center justify-center font-bold'
                                : isThisMonth
                                  ? 'text-slate-700'
                                  : 'text-slate-300'
                            }`}
                          >
                            {date.getDate()}
                          </span>
                          {dayIdx === 0 && weekEntriesForThisWeek.length > 0 && (
                            <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-0.5">
                              {weekEntriesForThisWeek.slice(0, 6).map((entry) => {
                                const member = getMemberByUserId(entry.user_id);
                                if (!member) return null;
                                const color = getColorClasses(member.color);
                                return (
                                  <div
                                    key={entry.id}
                                    className={`w-2 h-2 rounded-full ${color.bg}`}
                                    title={member.display_name}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Year-at-a-glance */
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={prevYear} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold text-slate-900 min-w-[80px] text-center">{year}</h3>
              <button onClick={nextYear} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={goToToday}
              className="text-sm text-slate-500 hover:text-slate-700 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Today
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {MONTHS.map((monthName, monthIdx) => {
                const monthFirst = new Date(year, monthIdx, 1);
                const monthFirstWeek = getWeekStart(monthFirst);
                const monthLast = new Date(year, monthIdx + 1, 0);
                const monthLastWeek = getWeekStart(monthLast);

                const monthWeeks: Date[] = [];
                let mCursor = new Date(monthFirstWeek);
                while (mCursor <= monthLastWeek) {
                  monthWeeks.push(new Date(mCursor));
                  mCursor.setDate(mCursor.getDate() + 7);
                }

                return (
                  <div key={monthIdx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <h4 className="text-sm font-bold text-slate-900">{monthName}</h4>
                    </div>
                    <div className="p-2">
                      {monthWeeks.map((weekStart, wIdx) => {
                        const weekEntriesForThisWeek = getEntriesForWeek(weekStart);
                        const isCurrentWeek = todayStr >= dateToStr(weekStart) && todayStr <= dateToStr(getWeekEnd(weekStart));
                        const conflict = hasConflict(weekStart);
                        const weekNum = getWeekNumber(weekStart);

                        return (
                          <div
                            key={wIdx}
                            className={`flex items-center gap-1.5 py-1 px-1.5 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${
                              isCurrentWeek ? 'bg-emerald-50' : ''
                            }`}
                            onClick={() => handleWeekClick(weekStart)}
                          >
                            <span className="text-[10px] text-slate-400 font-medium w-6 flex-shrink-0">
                              W{weekNum}
                            </span>
                            <span className="text-[10px] text-slate-500 w-12 flex-shrink-0">
                              {weekStart.getDate()}{MONTH_SHORT[weekStart.getMonth()]}
                            </span>
                            <div className="flex flex-wrap gap-0.5 flex-1 min-h-[12px]">
                              {weekEntriesForThisWeek.map((entry) => {
                                const member = getMemberByUserId(entry.user_id);
                                if (!member) return null;
                                const color = getColorClasses(member.color);
                                return (
                                  <div
                                    key={entry.id}
                                    className={`w-2.5 h-2.5 rounded-sm ${color.bg}`}
                                    title={member.display_name}
                                  />
                                );
                              })}
                            </div>
                            {conflict && (
                              <AlertTriangle className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Week detail modal (read-only) */}
      {selectedWeek && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={handleCloseWeekDetail} />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Week of {selectedWeek.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </h3>
                <p className="text-sm text-slate-500">
                  {selectedWeek.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {selectedWeek.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button onClick={handleCloseWeekDetail} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {weekEntries.length === 0 ? (
                <div className="text-center py-6">
                  <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No one is scheduled for this week.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {weekEntries.map((entry) => {
                    const member = getMemberByUserId(entry.user_id);
                    if (!member) return null;
                    const color = getColorClasses(member.color);
                    const conflict = hasConflict(selectedWeek.start, entry.user_id);

                    return (
                      <div key={entry.id} className={`rounded-xl border p-3 ${color.border} ${color.light}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${color.bg} flex items-center justify-center`}>
                            <span className="text-white font-bold text-xs">
                              {member.display_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className={`font-semibold text-sm ${color.text}`}>{member.display_name}</p>
                              <RoleBadge role={member.role} />
                              {createdBy === member.user_id && <LeaderBadge />}
                            </div>
                            {entry.notes && (
                              <p className="text-xs text-slate-500 mt-1">{entry.notes}</p>
                            )}
                          </div>
                        </div>
                        {conflict && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Conflict: multiple owners scheduled the same week</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getWeekNumber(d: Date): number {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
