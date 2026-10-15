import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, DAYS_OF_WEEK, type Store, type DeliveryConfirmation, type VacationPeriod, type DayOfWeek, type Group, type GroupMember, getGroupAccent, MEMBER_COLORS } from '@/lib/supabase';
import { StoreCard } from '@/components/StoreCard';
import { StoreFormModal } from '@/components/StoreFormModal';
import { VacationModal } from '@/components/VacationModal';
import { GroupGuide } from '@/components/GroupGuide';
import { GroupManager } from '@/components/GroupManager';
import { GroupCalendar } from '@/components/GroupCalendar';
import { GroupVote } from '@/components/GroupVote';
import { GroupChat } from '@/components/GroupChat';
import { DraftBoard } from '@/components/DraftBoard';
import { Truck, Plus, Calendar, Plane, LogOut, MapPin, Package, CheckCircle2, Users, CalendarDays, Settings, User, Search, MessageCircle } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { SettingsModal } from '@/components/SettingsModal';
import { AccountModal } from '@/components/AccountModal';
import { SoloDashboard } from '@/components/SoloDashboard';
import { VendorDashboard } from '@/components/VendorDashboard';
import { MatchmakerDashboard } from '@/components/MatchmakerDashboard';
import { MultiRouteDashboard } from '@/components/MultiRouteDashboard';
import { GroupSeekerDirectory } from '@/components/GroupSeekerDirectory';
import { CommunityForum } from '@/components/CommunityForum';
import { CreatorBadge } from '@/components/CreatorBadge';
import { FeedbackButton } from '@/components/FeedbackButton';

export default function Dashboard() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [confirmations, setConfirmations] = useState<DeliveryConfirmation[]>([]);
  const [vacations, setVacations] = useState<VacationPeriod[]>([]);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => {
    const day = today.getDay();
    const mapped = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return mapped[day] as DayOfWeek;
  });
  const [loading, setLoading] = useState(true);
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [view, setView] = useState<'route' | 'vacation' | 'guide' | 'group' | 'find' | 'community'>('route');
  const [group, setGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupView, setGroupView] = useState<'manage' | 'calendar' | 'draft' | 'vote' | 'chat'>('manage');
  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [storesRes, confirmationsRes, vacationsRes] = await Promise.all([
      supabase.from('stores').select('*').order('stop_order', { ascending: true }),
      supabase.from('delivery_confirmations').select('*').eq('delivery_date', todayStr),
      supabase.from('vacation_periods').select('*').order('start_date', { ascending: true }),
    ]);

    if (storesRes.data) setStores(storesRes.data as Store[]);
    if (confirmationsRes.data) setConfirmations(confirmationsRes.data as DeliveryConfirmation[]);
    if (vacationsRes.data) setVacations(vacationsRes.data as VacationPeriod[]);
    setLoading(false);
  }, [user, todayStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check if profile is incomplete
  const needsOnboarding = user && profile && !profile.full_name;

  if (needsOnboarding) {
    return <Onboarding profile={profile} onDone={refreshProfile} />;
  }

  if (profile?.account_type === 'solo') {
    return <SoloDashboard userId={user!.id} profile={profile} onSignOut={signOut} />;
  }

  if (profile?.account_type === 'vendor') {
    return <VendorDashboard userId={user!.id} profile={profile} onSignOut={signOut} />;
  }

  if (profile?.account_type === 'matchmaker') {
    return <MatchmakerDashboard userId={user!.id} profile={profile} onSignOut={signOut} />;
  }

  if (profile?.account_type === 'multi_route') {
    return <MultiRouteDashboard userId={user!.id} profile={profile} onSignOut={signOut} />;
  }

  const dayStores = stores.filter((s) => s.delivery_days.includes(selectedDay));
  const confirmedStoreIds = new Set(confirmations.filter((c) => c.confirmed).map((c) => c.store_id));
  const activeVacation = vacations.find(
    (v) => todayStr >= v.start_date && todayStr <= v.end_date
  );

  async function handleToggleConfirmation(storeId: string) {
    const existing = confirmations.find((c) => c.store_id === storeId);
    if (existing) {
      const newConfirmed = !existing.confirmed;
      const { data } = await supabase
        .from('delivery_confirmations')
        .update({ confirmed: newConfirmed, confirmed_at: newConfirmed ? new Date().toISOString() : null })
        .eq('id', existing.id)
        .select()
        .single();
      if (data) {
        setConfirmations((prev) => prev.map((c) => (c.id === data.id ? data as DeliveryConfirmation : c)));
      }
    } else {
      const { data } = await supabase
        .from('delivery_confirmations')
        .insert({
          store_id: storeId,
          delivery_date: todayStr,
          confirmed: true,
          confirmed_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (data) {
        setConfirmations((prev) => [...prev, data as DeliveryConfirmation]);
      }
    }
  }

  async function handleDeleteStore(storeId: string) {
    const { error } = await supabase.from('stores').delete().eq('id', storeId);
    if (error) return;
    setStores((prev) => prev.filter((s) => s.id !== storeId));
  }

  function handleEditStore(store: Store) {
    setEditingStore(store);
    setShowStoreForm(true);
  }

  function handleCloseStoreForm() {
    setShowStoreForm(false);
    setEditingStore(null);
  }

  async function handleStoreSaved() {
    handleCloseStoreForm();
    await loadData();
  }

  async function handleVacationSaved() {
    setShowVacationModal(false);
    await loadData();
  }

  async function handleGroupChanged() {
    await refreshProfile();
    await loadGroup();
  }

  async function loadGroup() {
    if (!user) return;
    const { data: prof } = await supabase
      .from('profiles')
      .select('group_id')
      .eq('id', user.id)
      .maybeSingle();
    const groupId = (prof as any)?.group_id;
    if (!groupId) {
      setGroup(null);
      setGroupMembers([]);
      return;
    }
    const [groupRes, membersRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).maybeSingle(),
      supabase.from('group_members').select('*').eq('group_id', groupId).order('seniority_order', { ascending: true }),
    ]);
    setGroup(groupRes.data as Group | null);
    setGroupMembers((membersRes.data as GroupMember[]) ?? []);
  }

  useEffect(() => {
    if (user) loadGroup();
  }, [user]);

  async function handleDeleteVacation(id: string) {
    const { error } = await supabase.from('vacation_periods').delete().eq('id', id);
    if (error) return;
    setVacations((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-lg leading-tight">VacationDSD</h1>
                <p className="text-xs text-slate-500 leading-tight">
                  {profile?.company ?? 'DSD Route'} {profile?.route_name ? `· ${profile.route_name}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell userId={user!.id} onNavigate={(link) => { if (link === '/app') setView('group'); }} />
              <button
                onClick={() => setShowSettings(true)}
                className="p-2.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowAccount(true)}
                className="w-9 h-9 rounded-full bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-sm transition-colors"
                title="My Account"
              >
                {profile?.full_name?.charAt(0)?.toUpperCase() ?? <User className="w-4 h-4" />}
              </button>
              <div className="w-px h-8 bg-slate-200 mx-1" />
              <button
                onClick={signOut}
                className="p-2.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* Navigation tabs */}
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            <NavTab icon={<MapPin className="w-4 h-4" />} label="My Route" active={view === 'route'} onClick={() => setView('route')} />
            <NavTab icon={<Plane className="w-4 h-4" />} label="Vacation" active={view === 'vacation'} onClick={() => setView('vacation')} />
            <NavTab icon={<CalendarDays className="w-4 h-4" />} label="My Group" active={view === 'group'} onClick={() => setView('group')} />
            <NavTab icon={<Search className="w-4 h-4" />} label="Find a Group" active={view === 'find'} onClick={() => setView('find')} />
            <NavTab icon={<Users className="w-4 h-4" />} label="Group Guide" active={view === 'guide'} onClick={() => setView('guide')} />
            <NavTab icon={<MessageCircle className="w-4 h-4" />} label="Community" active={view === 'community'} onClick={() => setView('community')} />
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {view === 'route' ? (
          <>
            {/* Vacation Banner */}
            {activeVacation && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Plane className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-900">You're on vacation</p>
                  <p className="text-sm text-amber-700">
                    {activeVacation.start_date} to {activeVacation.end_date}
                    {activeVacation.reliever_name ? ` — Reliever: ${activeVacation.reliever_name}` : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Day Selector */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-slate-900">Your Route</h2>
                <button
                  onClick={() => setShowStoreForm(true)}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Store
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {DAYS_OF_WEEK.map((day) => {
                  const count = stores.filter((s) => s.delivery_days.includes(day)).length;
                  const isActive = day === selectedDay;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`flex-shrink-0 px-4 py-3 rounded-xl text-sm font-semibold transition-all min-w-[80px] ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-md'
                          : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>{day.slice(0, 3)}</div>
                      <div className={`text-xs mt-0.5 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                        {count} {count === 1 ? 'stop' : 'stops'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Store List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : dayStores.length === 0 ? (
              <EmptyState onAdd={() => setShowStoreForm(true)} />
            ) : (
              <>
                {/* Progress bar */}
                <div className="mb-4 bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="text-sm font-semibold text-slate-700">Today's Progress</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">
                      {confirmedStoreIds.size}/{dayStores.length} confirmed
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${dayStores.length ? (confirmedStoreIds.size / dayStores.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {dayStores.map((store, idx) => (
                    <StoreCard
                      key={store.id}
                      store={store}
                      stopNumber={idx + 1}
                      confirmed={confirmedStoreIds.has(store.id)}
                      onToggleConfirm={() => handleToggleConfirmation(store.id)}
                      onEdit={() => handleEditStore(store)}
                      onDelete={() => handleDeleteStore(store.id)}
                      vendorView
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : view === 'group' ? (
          group ? (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getGroupAccent(group.accent_color).gradient} flex items-center justify-center text-2xl shadow-sm`}>
                  {group.avatar_emoji || '👥'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Group {group.name}</h2>
                  <p className="text-sm text-slate-500">
                    {group.city ? `${group.city}${group.state ? `, ${group.state}` : ''}` : 'Location not set'} · {groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <button
                  onClick={() => setGroupView('manage')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    groupView === 'manage' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Group Info
                </button>
                <button
                  onClick={() => setGroupView('draft')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    groupView === 'draft' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Draft
                </button>
                <button
                  onClick={() => setGroupView('calendar')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    groupView === 'calendar' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Calendar
                </button>
                <button
                  onClick={() => setGroupView('vote')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    groupView === 'vote' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Vote
                </button>
                <button
                  onClick={() => setGroupView('chat')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    groupView === 'chat' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Chat
                </button>
              </div>
              {groupView === 'manage' ? (
                <GroupManager
                  userId={user!.id}
                  profile={profile}
                  onGroupChanged={handleGroupChanged}
                  onBack={() => setView('route')}
                  onFindGroup={() => setView('find')}
                />
              ) : groupView === 'draft' ? (
                <DraftBoard
                  userId={user!.id}
                  group={group}
                  members={groupMembers}
                  onGroupChanged={handleGroupChanged}
                  onBack={() => setGroupView('manage')}
                />
              ) : groupView === 'calendar' ? (
                <GroupCalendar
                  userId={user!.id}
                  groupId={group.id}
                  members={groupMembers}
                  createdBy={group.created_by}
                  onBack={() => setGroupView('manage')}
                />
              ) : groupView === 'vote' ? (
                <GroupVote
                  userId={user!.id}
                  group={group}
                  members={groupMembers}
                  isLeader={group.created_by === user!.id}
                  onBack={() => setGroupView('manage')}
                />
              ) : (
                <GroupChat
                  userId={user!.id}
                  group={group}
                  members={groupMembers}
                  onBack={() => setGroupView('manage')}
                />
              )}
            </div>
          ) : (
            <GroupManager
              userId={user!.id}
              profile={profile}
              onGroupChanged={handleGroupChanged}
              onBack={() => setView('route')}
              onFindGroup={() => setView('find')}
            />
          )
        ) : view === 'community' ? (
          <CommunityForum userId={user!.id} profile={profile} />
        ) : view === 'find' ? (
          <GroupSeekerDirectory
            profile={profile!}
            onBack={() => setView('route')}
            onProfileChanged={refreshProfile}
          />
        ) : view === 'guide' ? (
          <GroupGuide profile={profile} />
        ) : (
          /* Vacation View */
          <VacationView
            vacations={vacations}
            onAdd={() => setShowVacationModal(true)}
            onDelete={handleDeleteVacation}
          />
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 sm:px-6 pb-6">
        <div className="flex justify-center">
          <CreatorBadge />
        </div>
      </footer>

      {/* Modals */}
      {showStoreForm && (
        <StoreFormModal
          store={editingStore}
          onClose={handleCloseStoreForm}
          onSaved={handleStoreSaved}
        />
      )}
      {showVacationModal && (
        <VacationModal onClose={() => setShowVacationModal(false)} onSaved={handleVacationSaved} />
      )}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} onSaved={() => {}} />
      )}
      {showAccount && (
        <AccountModal onClose={() => setShowAccount(false)} />
      )}
      <FeedbackButton pageContext={view} />
    </div>
  );
}

function NavTab({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-emerald-500 text-emerald-700'
          : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Package className="w-10 h-10 text-slate-300" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-1">No stores scheduled for this day</h3>
      <p className="text-sm text-slate-500 mb-4">Add your first store to start building your route.</p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Store
      </button>
    </div>
  );
}

function VacationView({
  vacations,
  onAdd,
  onDelete,
}: {
  vacations: VacationPeriod[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Vacation Periods</h2>
          <p className="text-sm text-slate-500 mt-0.5">Plan your time off and brief your reliever</p>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Schedule Vacation
        </button>
      </div>

      {vacations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Calendar className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No vacations scheduled</h3>
          <p className="text-sm text-slate-500 mb-4">Schedule your time off and assign a reliever.</p>
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Schedule Vacation
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {vacations.map((v) => {
            const isActive = todayStr >= v.start_date && todayStr <= v.end_date;
            const isPast = todayStr > v.end_date;
            return (
              <div
                key={v.id}
                className={`bg-white rounded-2xl border p-5 transition-all ${
                  isActive
                    ? 'border-amber-300 shadow-md shadow-amber-100'
                    : isPast
                      ? 'border-slate-200 opacity-60'
                      : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isActive
                          ? 'bg-amber-100'
                          : isPast
                            ? 'bg-slate-100'
                            : 'bg-emerald-50'
                      }`}
                    >
                      <Plane
                        className={`w-6 h-6 ${
                          isActive ? 'text-amber-600' : isPast ? 'text-slate-400' : 'text-emerald-600'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900">
                          {v.start_date} → {v.end_date}
                        </h3>
                        {isActive && (
                          <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                        {isPast && (
                          <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                            Past
                          </span>
                        )}
                      </div>
                      {v.reliever_name && (
                        <p className="text-sm text-slate-600">
                          Reliever: <span className="font-medium">{v.reliever_name}</span>
                          {v.reliever_phone ? ` · ${v.reliever_phone}` : ''}
                        </p>
                      )}
                      {v.notes && (
                        <p className="text-sm text-slate-500 mt-2 bg-slate-50 rounded-lg p-3">
                          {v.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onDelete(v.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors p-1"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Onboarding({ profile, onDone }: { profile: any; onDone: () => Promise<void> }) {
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [routeName, setRouteName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [seekingGroup, setSeekingGroup] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setJoinError(null);

    let groupId: string | null = null;

    // If the user entered a join code, try to join the group
    if (joinCode.trim()) {
      const code = joinCode.trim().toUpperCase();
      const { data: foundGroup, error: findError } = await supabase
        .from('groups')
        .select('*')
        .eq('join_code', code)
        .maybeSingle();

      if (findError || !foundGroup) {
        setJoinError('No group found with that code. Check the code and try again, or leave it blank to join later.');
        setSaving(false);
        return;
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', foundGroup.id)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existingMember) {
        groupId = foundGroup.id;
      } else {
        // Assign next available color
        const { data: existingMembers } = await supabase
          .from('group_members')
          .select('color')
          .eq('group_id', foundGroup.id);
        const usedColors = new Set((existingMembers ?? []).map((m: any) => m.color));
        const nextColor = MEMBER_COLORS.find((c) => !usedColors.has(c.name)) ?? MEMBER_COLORS[0];

        const { error: memberError } = await supabase.from('group_members').insert({
          group_id: foundGroup.id,
          user_id: profile.id,
          display_name: fullName || 'Member',
          color: nextColor.name,
          role: 'member',
        });

        if (memberError) {
          setJoinError(memberError.message.includes('duplicate')
            ? 'You are already a member of this group.'
            : memberError.message);
          setSaving(false);
          return;
        }
        groupId = foundGroup.id;
      }
    }

    await supabase.from('profiles').upsert({
      id: profile.id,
      full_name: fullName,
      company,
      phone,
      route_name: routeName,
      city,
      state,
      seeking_group: seekingGroup,
      group_id: groupId,
    });
    await onDone();
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500 mb-3">
            <Truck className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Welcome to VacationDSD</h2>
          <p className="text-slate-500 mt-1 text-sm">Tell us about your route to get started.</p>
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
                placeholder="e.g. Little Debbie, Mission Tortillas"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Route Name/Number</label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                  required
                  maxLength={2}
                  placeholder="2-letter"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900"
                />
              </div>
            </div>
            {profile.account_type === 'group' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Join Code (optional)</label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    placeholder="e.g. AB3X9Z"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900 tracking-wider uppercase"
                  />
                  <p className="text-xs text-slate-400 mt-1">Have a join code from your group leader? Enter it here to join their group right away.</p>
                </div>
                {joinError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{joinError}</div>
                )}
                <label className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={seekingGroup}
                    onChange={(e) => setSeekingGroup(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Let others find me</p>
                    <p className="text-xs text-slate-500 mt-0.5">Show your name and contact info to other DSD route owners in {state || 'your state'} who are also looking to form or join a group.</p>
                  </div>
                </label>
              </>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Get Started'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
