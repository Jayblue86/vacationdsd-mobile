import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type VacationPeriod, type Group, type GroupMember, type Store, type DraftSchedule } from '@/lib/supabase';
import { X, Mail, Phone, Building2, Route, MapPin, Calendar, Plane, Users, Package, Bell, Clock, AlertTriangle, CheckCircle2, User, Crown } from 'lucide-react';
import { RoleBadge } from '@/components/RoleBadge';
import { LeaderBadge } from '@/components/LeaderBadge';

type Props = {
  onClose: () => void;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function AccountModal({ onClose }: Props) {
  const { user, profile } = useAuth();
  const [vacations, setVacations] = useState<VacationPeriod[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [memberInfo, setMemberInfo] = useState<GroupMember | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [storeCount, setStoreCount] = useState(0);
  const [draftSchedules, setDraftSchedules] = useState<DraftSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    if (!user) return;
    setLoading(true);

    const [vacRes, storesRes] = await Promise.all([
      supabase.from('vacation_periods').select('*').order('start_date', { ascending: true }),
      supabase.from('stores').select('id'),
    ]);

    setVacations((vacRes.data as VacationPeriod[]) ?? []);
    setStoreCount(storesRes.data?.length ?? 0);

    if (profile?.group_id) {
      const [groupRes, membersRes, draftRes] = await Promise.all([
        supabase.from('groups').select('*').eq('id', profile.group_id).maybeSingle(),
        supabase.from('group_members').select('*').eq('group_id', profile.group_id).order('seniority_order', { ascending: true }),
        supabase.from('draft_schedule').select('*').eq('group_id', profile.group_id).order('draft_date', { ascending: true }),
      ]);
      setGroup(groupRes.data as Group | null);
      const allMembers = (membersRes.data as GroupMember[]) ?? [];
      setMembers(allMembers);
      setMemberCount(allMembers.length);
      setMemberInfo(allMembers.find((m) => m.user_id === user.id) ?? null);
      setDraftSchedules((draftRes.data as DraftSchedule[]) ?? []);
    }

    setLoading(false);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();

  const currentYearVacations = vacations.filter((v) => {
    const startYear = new Date(v.start_date).getFullYear();
    const endYear = new Date(v.end_date).getFullYear();
    return startYear === currentYear || endYear === currentYear;
  });

  const upcomingVacations = vacations.filter((v) => v.start_date > todayStr);
  const activeVacation = vacations.find((v) => todayStr >= v.start_date && todayStr <= v.end_date);
  const pastVacations = vacations.filter((v) => v.end_date < todayStr);

  const totalVacationDays = vacations
    .filter((v) => new Date(v.start_date).getFullYear() === currentYear)
    .reduce((sum, v) => {
      const start = new Date(v.start_date);
      const end = new Date(v.end_date);
      return sum + Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
    }, 0);

  const nextDraft = draftSchedules.find((s) => s.draft_date >= todayStr);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-6 pt-6 pb-8 rounded-t-3xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-emerald-500/30">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{profile?.full_name ?? 'Unknown'}</h2>
              <p className="text-sm text-slate-400">{user?.email}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Profile Info */}
            <Section title="Profile Information" icon={<Users className="w-4 h-4" />}>
              <div className="grid grid-cols-2 gap-3">
                <InfoTile icon={<Building2 className="w-4 h-4" />} label="Company" value={profile?.company} />
                <InfoTile icon={<Route className="w-4 h-4" />} label="Route" value={profile?.route_name} />
                <InfoTile icon={<Phone className="w-4 h-4" />} label="Phone" value={profile?.phone} />
                <InfoTile icon={<MapPin className="w-4 h-4" />} label="Location" value={[profile?.city, profile?.state].filter(Boolean).join(', ')} />
                <InfoTile icon={<Mail className="w-4 h-4" />} label="Email" value={user?.email} />
                <InfoTile icon={<Package className="w-4 h-4" />} label="Stores" value={String(storeCount)} />
              </div>
            </Section>

            {/* Current Year Vacations */}
            <Section title={`My ${currentYear} Vacation Weeks`} icon={<Calendar className="w-4 h-4" />}>
              {currentYearVacations.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 rounded-xl">
                  <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No vacations scheduled for {currentYear}</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <StatTile label="Weeks booked" value={String(currentYearVacations.length)} accent="emerald" />
                    <StatTile label="Total days" value={String(totalVacationDays)} accent="blue" />
                    <StatTile label="Upcoming" value={String(upcomingVacations.length)} accent="amber" />
                  </div>
                  <div className="space-y-2">
                    {currentYearVacations.map((v) => {
                      const isActive = todayStr >= v.start_date && todayStr <= v.end_date;
                      const isUpcoming = v.start_date > todayStr;
                      const isPast = v.end_date < todayStr;
                      const start = new Date(v.start_date);
                      const end = new Date(v.end_date);
                      const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;

                      return (
                        <div
                          key={v.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            isActive
                              ? 'border-amber-300 bg-amber-50'
                              : isUpcoming
                                ? 'border-emerald-200 bg-emerald-50'
                                : 'border-slate-200 bg-slate-50 opacity-70'
                          }`}
                        >
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isActive ? 'bg-amber-100' : isUpcoming ? 'bg-emerald-100' : 'bg-slate-200'
                          }`}>
                            <Plane className={`w-5 h-5 ${
                              isActive ? 'text-amber-600' : isUpcoming ? 'text-emerald-600' : 'text-slate-400'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900">
                              {MONTHS[start.getMonth()]} {start.getDate()} - {MONTHS[end.getMonth()]} {end.getDate()}, {end.getFullYear()}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500">{days} {days === 1 ? 'day' : 'days'}</span>
                              {isActive && (
                                <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">ACTIVE NOW</span>
                              )}
                              {isUpcoming && (
                                <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-full">UPCOMING</span>
                              )}
                              {isPast && (
                                <span className="text-[10px] font-bold bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">PAST</span>
                              )}
                            </div>
                            {v.reliever_name && (
                              <p className="text-xs text-slate-500 mt-0.5">Reliever: {v.reliever_name}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </Section>

            {/* Group Membership */}
            <Section title="Group Membership" icon={<Users className="w-4 h-4" />}>
              {group ? (
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{group.name}</p>
                        <p className="text-xs text-slate-500">{memberCount} member{memberCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-slate-400"><User className="w-4 h-4" /></span>
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Your role</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 capitalize">{memberInfo?.role ?? 'Member'}</p>
                          {memberInfo && <RoleBadge role={memberInfo.role} />}
                          {group?.created_by === user?.id && <LeaderBadge />}
                        </div>
                      </div>
                      <InfoTile icon={<User className="w-4 h-4" />} label="Seniority #" value={memberInfo ? String(memberInfo.seniority_order) : '-'} />
                      <InfoTile icon={<Users className="w-4 h-4" />} label="Join code" value={group.join_code} />
                      <InfoTile icon={<MapPin className="w-4 h-4" />} label="Location" value={[group.city, group.state].filter(Boolean).join(', ') || '-'} />
                    </div>
                  </div>

                  {/* Transfer leadership (leader only) */}
                  {group?.created_by === user?.id && members.length > 1 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Crown className="w-4 h-4 text-amber-600" />
                        <p className="text-sm font-semibold text-amber-900">Group Leadership</p>
                      </div>
                      {!showTransfer ? (
                        <>
                          <p className="text-xs text-amber-700 mb-3">
                            You are the group leader. You can transfer leadership to another member if your group chooses someone else to lead.
                          </p>
                          <button
                            onClick={() => setShowTransfer(true)}
                            className="text-sm font-semibold text-amber-700 hover:text-amber-800 transition-colors"
                          >
                            Transfer leadership
                          </button>
                        </>
                      ) : !confirmStep ? (
                        <div className="space-y-3">
                          <p className="text-xs text-amber-700">Select a member to become the new leader:</p>
                          <div className="space-y-1.5">
                            {members.filter((m) => m.user_id !== user?.id).map((m) => (
                              <button
                                key={m.id}
                                onClick={() => setTransferTarget(m.user_id)}
                                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                                  transferTarget === m.user_id
                                    ? 'border-amber-400 bg-amber-100'
                                    : 'border-amber-200 bg-white hover:bg-amber-50'
                                }`}
                              >
                                <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-bold text-slate-600">{m.display_name.charAt(0).toUpperCase()}</span>
                                </div>
                                <span className="text-sm font-medium text-slate-700 flex-1">{m.display_name}</span>
                                <RoleBadge role={m.role} />
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => { setShowTransfer(false); setTransferTarget(null); }}
                              className="flex-1 py-2 rounded-xl border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-50 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => setConfirmStep(true)}
                              disabled={!transferTarget}
                              className="flex-1 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50"
                            >
                              Continue
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <p className="text-sm font-semibold text-amber-900">Are you sure?</p>
                          </div>
                          <p className="text-xs text-amber-700">
                            You are about to transfer group leadership to <span className="font-semibold">{members.find((m) => m.user_id === transferTarget)?.display_name ?? 'another member'}</span>. You will lose leader privileges and cannot undo this action.
                          </p>
                          <p className="text-xs text-amber-700">Enter your password to confirm:</p>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError(null); }}
                            placeholder="Your password"
                            className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                            autoFocus
                          />
                          {confirmError && (
                            <p className="text-xs text-red-600">{confirmError}</p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => { setConfirmStep(false); setConfirmPassword(''); setConfirmError(null); }}
                              className="flex-1 py-2 rounded-xl border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-50 transition-colors"
                            >
                              Back
                            </button>
                            <button
                              onClick={async () => {
                                if (!transferTarget || !group || !user?.email) return;
                                setTransferring(true);
                                setConfirmError(null);
                                const { error: pwError } = await supabase.auth.signInWithPassword({
                                  email: user.email,
                                  password: confirmPassword,
                                });
                                if (pwError) {
                                  setConfirmError('Incorrect password. Please try again.');
                                  setTransferring(false);
                                  return;
                                }
                                await supabase.from('groups').update({ created_by: transferTarget }).eq('id', group.id);
                                await loadAll();
                                setTransferring(false);
                                setShowTransfer(false);
                                setConfirmStep(false);
                                setTransferTarget(null);
                                setConfirmPassword('');
                              }}
                              disabled={!confirmPassword || transferring}
                              className="flex-1 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50"
                            >
                              {transferring ? 'Transferring...' : 'Confirm Transfer'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Next draft */}
                  {nextDraft && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        <p className="text-sm font-semibold text-emerald-900">Next Draft</p>
                      </div>
                      <p className="text-sm text-emerald-700">
                        {new Date(nextDraft.draft_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        {' '}for {nextDraft.year}
                      </p>
                      {(() => {
                        const days = Math.ceil((new Date(nextDraft.draft_date).getTime() - Date.now()) / 86400000);
                        if (days <= 0) return <p className="text-xs text-emerald-600 mt-1">Starts today!</p>;
                        if (days <= 7) return <p className="text-xs text-emerald-600 mt-1">In {days} day{days !== 1 ? 's' : ''}</p>;
                        return <p className="text-xs text-emerald-600 mt-1">In {days} days</p>;
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 rounded-xl">
                  <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Not in a group yet</p>
                </div>
              )}
            </Section>

            {/* Notification Preferences */}
            <Section title="Notification Preferences" icon={<Bell className="w-4 h-4" />}>
              <div className="space-y-2">
                <PrefRow
                  icon={<Calendar className="w-4 h-4 text-emerald-600" />}
                  label="Draft Reminders"
                  enabled={profile?.notify_draft_reminders ?? false}
                />
                <PrefRow
                  icon={<Users className="w-4 h-4 text-blue-600" />}
                  label="Group Updates"
                  enabled={profile?.notify_group_updates ?? false}
                />
                <PrefRow
                  icon={<Clock className="w-4 h-4 text-amber-600" />}
                  label="Weekly Summary"
                  enabled={profile?.notify_weekly_summary ?? false}
                />
              </div>
            </Section>

            {/* Account Summary */}
            <Section title="Account Summary" icon={<CheckCircle2 className="w-4 h-4" />}>
              <div className="grid grid-cols-3 gap-3">
                <StatTile label="Total vacations" value={String(vacations.length)} accent="emerald" />
                <StatTile label="Past vacations" value={String(pastVacations.length)} accent="slate" />
                <StatTile label="Active now" value={activeVacation ? '1' : '0'} accent="amber" />
              </div>
              <div className="mt-3 text-xs text-slate-400 text-center">
                Member since {new Date(profile?.created_at ?? Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-slate-400">{icon}</div>
        <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-slate-400">{icon}</span>
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-semibold text-slate-900 truncate">{value || '—'}</p>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'blue' | 'amber' | 'slate' }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className={`${colors[accent]} rounded-xl p-3 text-center`}>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide mt-1 opacity-80">{label}</p>
    </div>
  );
}

function PrefRow({ icon, label, enabled }: { icon: React.ReactNode; label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
      <span>{icon}</span>
      <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
      <span className={`text-xs font-bold px-2 py-1 rounded-full ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
        {enabled ? 'ON' : 'OFF'}
      </span>
    </div>
  );
}
