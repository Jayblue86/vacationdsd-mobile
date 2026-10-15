import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Group, type DraftSchedule } from '@/lib/supabase';
import { X, Bell, Calendar, Users, Clock, Save, Trash2, Plus, AlertTriangle, Check } from 'lucide-react';

type Props = {
  onClose: () => void;
  onSaved: () => void;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function SettingsModal({ onClose, onSaved }: Props) {
  const { profile, user, refreshProfile } = useAuth();
  const [draftReminders, setDraftReminders] = useState(true);
  const [groupUpdates, setGroupUpdates] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [schedules, setSchedules] = useState<DraftSchedule[]>([]);
  const [newDraftDate, setNewDraftDate] = useState('');
  const [newDraftYear, setNewDraftYear] = useState(new Date().getFullYear() + 1);

  const isLeader = group?.created_by === user?.id;

  useEffect(() => {
    if (profile) {
      setDraftReminders(profile.notify_draft_reminders);
      setGroupUpdates(profile.notify_group_updates);
      setWeeklySummary(profile.notify_weekly_summary);
    }
    loadGroupAndSchedules();
  }, [profile]);

  async function loadGroupAndSchedules() {
    if (!user) return;
    const { data: prof } = await supabase
      .from('profiles')
      .select('group_id')
      .eq('id', user.id)
      .maybeSingle();
    const groupId = (prof as any)?.group_id;
    if (!groupId) return;

    const [groupRes, schedRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).maybeSingle(),
      supabase.from('draft_schedule').select('*').eq('group_id', groupId).order('draft_date', { ascending: true }),
    ]);
    setGroup(groupRes.data as Group | null);
    setSchedules((schedRes.data as DraftSchedule[]) ?? []);
  }

  async function handleSavePreferences() {
    setSaving(true);
    await supabase
      .from('profiles')
      .update({
        notify_draft_reminders: draftReminders,
        notify_group_updates: groupUpdates,
        notify_weekly_summary: weeklySummary,
      })
      .eq('id', user!.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved();
  }

  async function handleAddSchedule() {
    if (!group || !newDraftDate) return;
    await supabase.from('draft_schedule').insert({
      group_id: group.id,
      draft_date: newDraftDate,
      year: newDraftYear,
    });
    setNewDraftDate('');
    await loadGroupAndSchedules();
  }

  async function handleDeleteSchedule(id: string) {
    await supabase.from('draft_schedule').delete().eq('id', id);
    await loadGroupAndSchedules();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-slate-900">Settings</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Notification Preferences */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-5 h-5 text-slate-400" />
              <h3 className="font-bold text-slate-900 text-sm">Notification Preferences</h3>
            </div>
            <div className="space-y-2">
              <ToggleRow
                icon={<Calendar className="w-4 h-4 text-emerald-600" />}
                title="Draft Reminders"
                description="Get reminded 1 month, 1 week, and 1 day before your group's draft starts"
                checked={draftReminders}
                onChange={setDraftReminders}
              />
              <ToggleRow
                icon={<Users className="w-4 h-4 text-blue-600" />}
                title="Group Updates"
                description="Notifications when your group info or members change"
                checked={groupUpdates}
                onChange={setGroupUpdates}
              />
              <ToggleRow
                icon={<Clock className="w-4 h-4 text-amber-600" />}
                title="Weekly Summary"
                description="A weekly recap of who's on vacation and upcoming draft dates"
                checked={weeklySummary}
                onChange={setWeeklySummary}
              />
            </div>

            <button
              onClick={handleSavePreferences}
              disabled={saving}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Preferences'}
                </>
              )}
            </button>
          </div>

          {/* Draft Schedule (leader only) */}
          {group && isLeader && (
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <h3 className="font-bold text-slate-900 text-sm">Draft Schedule</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Set the date when your group's draft will start. Members will get automatic reminders at 1 month, 1 week, and 1 day before.
              </p>

              {schedules.length > 0 && (
                <div className="space-y-2 mb-3">
                  {schedules.map((sched) => {
                    const d = new Date(sched.draft_date);
                    const isPast = sched.draft_date < new Date().toISOString().split('T')[0];
                    const daysUntil = Math.ceil((d.getTime() - Date.now()) / 86400000);

                    return (
                      <div
                        key={sched.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${
                          isPast ? 'bg-slate-50 border-slate-200' : 'bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isPast ? 'bg-slate-200' : 'bg-emerald-100'
                        }`}>
                          <Calendar className={`w-5 h-5 ${isPast ? 'text-slate-400' : 'text-emerald-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {MONTHS[d.getMonth()]} {d.getDate()}, {d.getFullYear()}
                          </p>
                          <p className="text-xs text-slate-500">
                            {isPast
                              ? 'Past draft'
                              : daysUntil === 0
                                ? 'Today!'
                                : daysUntil > 0
                                  ? `In ${daysUntil} days`
                                  : `${Math.abs(daysUntil)} days ago`}
                            {' · '}Year {sched.year}
                          </p>
                          <div className="flex gap-1 mt-1">
                            {sched.reminder_1month_sent && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">1mo sent</span>
                            )}
                            {sched.reminder_1week_sent && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">1wk sent</span>
                            )}
                            {sched.reminder_1day_sent && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">1day sent</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteSchedule(sched.id)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="date"
                  value={newDraftDate}
                  onChange={(e) => setNewDraftDate(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-sm text-slate-900"
                />
                <input
                  type="number"
                  value={newDraftYear}
                  onChange={(e) => setNewDraftYear(parseInt(e.target.value) || new Date().getFullYear() + 1)}
                  className="w-24 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-sm text-slate-900"
                  placeholder="Year"
                />
                <button
                  onClick={handleAddSchedule}
                  disabled={!newDraftDate}
                  className="inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>
          )}

          {/* No group message */}
          {!group && (
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-700">No group yet</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Join or create a group to schedule drafts and receive reminders.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-1 ${
          checked ? 'bg-emerald-500' : 'bg-slate-200'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}
