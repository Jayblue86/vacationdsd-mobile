import { useState, useEffect, useCallback } from 'react';
import { supabase, type Profile, type MultiRoute, type MultiRouteRunner } from '@/lib/supabase';
import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/supabase';
import { CreatorBadge } from '@/components/CreatorBadge';
import { NotificationBell } from '@/components/NotificationBell';
import { CommunityForum } from '@/components/CommunityForum';
import { FeedbackButton } from '@/components/FeedbackButton';
import {
  Building2, CalendarDays, CheckCircle2, Copy, LogOut, MapPin, Package, Phone,
  Plus, Route, Store as StoreIcon, User, Users, X, AlertCircle, MessageCircle, ArrowLeft,
} from 'lucide-react';

type Props = { userId: string; profile: Profile | null; onSignOut: () => Promise<void> };

type MultiRouteStore = {
  id: string;
  route_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  contact_name: string | null;
  delivery_days: string[];
  stop_order: number;
  special_instructions: string | null;
  created_at: string;
};

export function MultiRouteDashboard({ userId, profile, onSignOut }: Props) {
  const [routes, setRoutes] = useState<MultiRoute[]>([]);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [runners, setRunners] = useState<MultiRouteRunner[]>([]);
  const [stores, setStores] = useState<MultiRouteStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [showAddRunner, setShowAddRunner] = useState(false);
  const [showAddStore, setShowAddStore] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [editingStore, setEditingStore] = useState<MultiRouteStore | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');

  // Add route form
  const [routeName, setRouteName] = useState('');
  const [routeCompany, setRouteCompany] = useState('');
  const [routeCity, setRouteCity] = useState('');
  const [routeState, setRouteState] = useState('');

  // Add runner form
  const [runnerName, setRunnerName] = useState('');
  const [runnerPhone, setRunnerPhone] = useState('');
  const [runnerEmail, setRunnerEmail] = useState('');

  // Add store form
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeCity, setStoreCity] = useState('');
  const [storeState, setStoreState] = useState('');
  const [storeZip, setStoreZip] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeContact, setStoreContact] = useState('');
  const [storeInstructions, setStoreInstructions] = useState('');
  const [storeDays, setStoreDays] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    const { data: routeData } = await supabase
      .from('multi_routes')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true });
    const routeList = (routeData as MultiRoute[]) ?? [];
    setRoutes(routeList);
    if (routeList.length > 0 && !activeRouteId) {
      setActiveRouteId(routeList[0].id);
    }
    setLoading(false);
  }, [userId]);

  const loadRouteDetails = useCallback(async (routeId: string) => {
    const [runnersRes, storesRes] = await Promise.all([
      supabase.from('multi_route_runners').select('*').eq('route_id', routeId).order('created_at', { ascending: true }),
      supabase.from('multi_route_stores').select('*').eq('route_id', routeId).order('stop_order', { ascending: true }),
    ]);
    setRunners((runnersRes.data as MultiRouteRunner[]) ?? []);
    setStores((storesRes.data as MultiRouteStore[]) ?? []);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (activeRouteId) loadRouteDetails(activeRouteId); }, [activeRouteId, loadRouteDetails]);

  async function addRoute() {
    if (!routeName.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    const { data, error } = await supabase.from('multi_routes').insert({
      owner_id: userId,
      name: routeName.trim(),
      company: routeCompany.trim() || null,
      city: routeCity.trim() || null,
      state: routeState.toUpperCase().slice(0, 2) || null,
    }).select().single();
    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }
    setRouteName('');
    setRouteCompany('');
    setRouteCity('');
    setRouteState('');
    setShowAddRoute(false);
    await loadData();
    if (data) setActiveRouteId((data as MultiRoute).id);
    setSaving(false);
  }

  async function addRunner() {
    if (!runnerName.trim() || !activeRouteId) return;
    setSaving(true);
    setErrorMsg(null);
    const { error } = await supabase.from('multi_route_runners').insert({
      route_id: activeRouteId,
      name: runnerName.trim(),
      phone: runnerPhone.trim() || null,
      email: runnerEmail.trim().toLowerCase() || null,
    });
    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }
    setRunnerName('');
    setRunnerPhone('');
    setRunnerEmail('');
    setShowAddRunner(false);
    await loadRouteDetails(activeRouteId);
    setSaving(false);
  }

  async function removeRunner(id: string) {
    await supabase.from('multi_route_runners').delete().eq('id', id);
    if (activeRouteId) await loadRouteDetails(activeRouteId);
  }

  async function toggleRunnerActive(runner: MultiRouteRunner) {
    await supabase.from('multi_route_runners').update({ is_active: !runner.is_active }).eq('id', runner.id);
    if (activeRouteId) await loadRouteDetails(activeRouteId);
  }

  async function addStore() {
    if (!storeName.trim() || !activeRouteId) return;
    setSaving(true);
    setErrorMsg(null);
    const { error } = await supabase.from('multi_route_stores').insert({
      route_id: activeRouteId,
      name: storeName.trim(),
      address: storeAddress.trim() || null,
      city: storeCity.trim() || null,
      state: storeState.trim() || null,
      zip: storeZip.trim() || null,
      phone: storePhone.trim() || null,
      contact_name: storeContact.trim() || null,
      delivery_days: storeDays,
      stop_order: stores.length,
      special_instructions: storeInstructions.trim() || null,
    });
    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }
    resetStoreForm();
    setShowAddStore(false);
    await loadRouteDetails(activeRouteId);
    setSaving(false);
  }

  async function updateStore() {
    if (!editingStore || !activeRouteId) return;
    setSaving(true);
    setErrorMsg(null);
    const { error } = await supabase.from('multi_route_stores').update({
      name: storeName.trim(),
      address: storeAddress.trim() || null,
      city: storeCity.trim() || null,
      state: storeState.trim() || null,
      zip: storeZip.trim() || null,
      phone: storePhone.trim() || null,
      contact_name: storeContact.trim() || null,
      delivery_days: storeDays,
      special_instructions: storeInstructions.trim() || null,
    }).eq('id', editingStore.id);
    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }
    resetStoreForm();
    setEditingStore(null);
    setShowAddStore(false);
    await loadRouteDetails(activeRouteId);
    setSaving(false);
  }

  async function deleteStore(id: string) {
    await supabase.from('multi_route_stores').delete().eq('id', id);
    if (activeRouteId) await loadRouteDetails(activeRouteId);
  }

  function resetStoreForm() {
    setStoreName('');
    setStoreAddress('');
    setStoreCity('');
    setStoreState('');
    setStoreZip('');
    setStorePhone('');
    setStoreContact('');
    setStoreInstructions('');
    setStoreDays([]);
  }

  function openEditStore(store: MultiRouteStore) {
    setEditingStore(store);
    setStoreName(store.name);
    setStoreAddress(store.address ?? '');
    setStoreCity(store.city ?? '');
    setStoreState(store.state ?? '');
    setStoreZip(store.zip ?? '');
    setStorePhone(store.phone ?? '');
    setStoreContact(store.contact_name ?? '');
    setStoreInstructions(store.special_instructions ?? '');
    setStoreDays(store.delivery_days ?? []);
    setShowAddStore(true);
  }

  function toggleDay(day: string) {
    setStoreDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }

  async function copyRunnerInvite(token: string) {
    const link = `${window.location.origin}/?runner_invite=${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken(null), 1800);
  }

  const activeRoute = routes.find((r) => r.id === activeRouteId);
  const dayStores = stores.filter((s) => s.delivery_days.includes(selectedDay));
  const activeRunners = runners.filter((r) => r.is_active);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg leading-tight">VacationDSD</h1>
              <p className="text-xs text-slate-500">Multi-route owner</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell userId={userId} onNavigate={() => {}} />
            <button onClick={() => setShowCommunity(true)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Community Forum">
              <MessageCircle className="w-5 h-5" />
            </button>
            <button onClick={onSignOut} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      {showCommunity ? (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-4">
            <button onClick={() => setShowCommunity(false)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to dashboard
            </button>
          </div>
          <CommunityForum userId={userId} profile={profile} />
        </main>
      ) : (
        <>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-sm font-semibold text-teal-600 uppercase tracking-wide">Multi-route management</p>
            <h2 className="text-3xl font-bold text-slate-900 mt-1">Welcome, {profile?.full_name?.split(' ')[0] ?? 'Owner'}</h2>
            <p className="text-slate-500 mt-2">Manage all your routes, stores, and runners in one place.</p>
          </div>
          <button
            onClick={() => setShowAddRoute(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Add route
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Route className="w-5 h-5" />} label="Routes" value={routes.length} tone="teal" />
          <StatCard icon={<Users className="w-5 h-5" />} label="Active runners" value={activeRunners.length} tone="blue" />
          <StatCard icon={<StoreIcon className="w-5 h-5" />} label="Total stores" value={stores.length} tone="emerald" />
          <StatCard icon={<CalendarDays className="w-5 h-5" />} label="Today's stops" value={dayStores.length} tone="amber" />
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
          </div>
        ) : routes.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="font-semibold text-slate-900">No routes yet</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">Add your first route to start managing stores and runners.</p>
            <button onClick={() => setShowAddRoute(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold">
              <Plus className="w-4 h-4" /> Add route
            </button>
          </div>
        ) : (
          <>
            {/* Route selector */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
              {routes.map((route) => (
                <button
                  key={route.id}
                  onClick={() => setActiveRouteId(route.id)}
                  className={`flex-shrink-0 px-4 py-3 rounded-xl text-sm font-semibold transition-all min-w-[120px] ${
                    route.id === activeRouteId
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="truncate">{route.name}</div>
                  <div className={`text-xs mt-0.5 ${route.id === activeRouteId ? 'text-slate-300' : 'text-slate-400'}`}>
                    {runners.filter((r) => r.route_id === route.id).length} runners
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Stores section */}
              <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900">{activeRoute?.name ?? 'Route'} stores</h3>
                    <p className="text-sm text-slate-500">Stores in delivery order</p>
                  </div>
                  <button
                    onClick={() => { resetStoreForm(); setEditingStore(null); setShowAddStore(true); }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add store
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                  {DAYS_OF_WEEK.map((day) => {
                    const count = stores.filter((s) => s.delivery_days.includes(day)).length;
                    const isActive = day === selectedDay;
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all min-w-[60px] ${
                          isActive ? 'bg-teal-600 text-white' : 'bg-slate-50 text-slate-500 border border-slate-100'
                        }`}
                      >
                        <div>{day.slice(0, 3)}</div>
                        <div className={`text-[10px] mt-0.5 ${isActive ? 'text-teal-100' : 'text-slate-400'}`}>{count}</div>
                      </button>
                    );
                  })}
                </div>

                {stores.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3">
                      <Package className="w-7 h-7" />
                    </div>
                    <p className="font-semibold text-slate-800 text-sm">No stores added yet</p>
                    <p className="text-xs text-slate-500 mt-1">Add stores so your runners know where to go.</p>
                  </div>
                ) : dayStores.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-400">No stores scheduled for {selectedDay}.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayStores.map((store, idx) => (
                      <div key={store.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 text-sm truncate">{store.name}</h4>
                          {store.address && (
                            <div className="flex items-start gap-1 mt-1 text-xs text-slate-500">
                              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span className="truncate">
                                {[store.address, store.city, store.state, store.zip].filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                            {store.phone && (
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Phone className="w-3 h-3" /><span>{store.phone}</span>
                              </div>
                            )}
                            {store.contact_name && (
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <User className="w-3 h-3" /><span>{store.contact_name}</span>
                              </div>
                            )}
                          </div>
                          {store.special_instructions && (
                            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-900">
                              {store.special_instructions}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditStore(store)} className="p-2 text-slate-300 hover:text-teal-600 transition-colors">
                            <Package className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteStore(store.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Runners section */}
              <section className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900">Runners</h3>
                    <p className="text-sm text-slate-500">Assigned to this route</p>
                  </div>
                  <button
                    onClick={() => setShowAddRunner(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>

                {runners.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-2">
                      <Users className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-slate-800 text-sm">No runners yet</p>
                    <p className="text-xs text-slate-500 mt-1">Add runners and share their invite link.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {runners.map((runner) => (
                      <div key={runner.id} className={`rounded-xl border p-3 ${runner.is_active ? 'border-slate-100' : 'border-slate-100 opacity-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                            {runner.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">{runner.name}</p>
                            {runner.phone && <p className="text-xs text-slate-500">{runner.phone}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => copyRunnerInvite(runner.invite_token)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedToken === runner.invite_token ? 'Copied' : 'Invite link'}
                          </button>
                          <button
                            onClick={() => toggleRunnerActive(runner)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            {runner.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => removeRunner(runner.id)}
                            className="ml-auto p-2 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Partner services */}
                <div className="mt-6 pt-5 border-t border-slate-100">
                  <h4 className="font-bold text-slate-900 text-sm mb-3">Owner services</h4>
                  <div className="space-y-2">
                    <PartnerCard
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      title="Background checks"
                      body="Run background checks on runners"
                      badge="Coming soon"
                    />
                    <PartnerCard
                      icon={<Package className="w-4 h-4" />}
                      title="Short-term insurance"
                      body="Insure your relievers by the day"
                      badge="Coming soon"
                    />
                    <PartnerCard
                      icon={<DollarSign />}
                      title="Pay runners"
                      body="Send payments through the app"
                      badge="Coming soon"
                    />
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 sm:px-6 pb-6">
        <div className="flex justify-center">
          <CreatorBadge />
        </div>
      </footer>
        </>
      )}

      {/* Add Route Modal */}
      {showAddRoute && (
        <Modal title="Add a route" onClose={() => setShowAddRoute(false)}>
          <p className="text-sm text-slate-500 mb-4">Name your route and add location details.</p>
          <div className="space-y-3">
            <Field label="Route name" value={routeName} onChange={setRouteName} placeholder="e.g. Route 42 — Mission" />
            <Field label="Company (optional)" value={routeCompany} onChange={setRouteCompany} placeholder="e.g. Mission Tortillas" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" value={routeCity} onChange={setRouteCity} placeholder="City" />
              <Field label="State" value={routeState} onChange={(v) => setRouteState(v.toUpperCase().slice(0, 2))} placeholder="ST" />
            </div>
          </div>
          {errorMsg && <ErrorBox msg={errorMsg} />}
          <ModalActions onCancel={() => setShowAddRoute(false)} onSave={addRoute} saving={saving} saveLabel="Add route" disabled={!routeName.trim()} />
        </Modal>
      )}

      {/* Add Runner Modal */}
      {showAddRunner && (
        <Modal title="Add a runner" onClose={() => setShowAddRunner(false)}>
          <p className="text-sm text-slate-500 mb-4">Add a runner to this route. Share their invite link so they can sign up.</p>
          <div className="space-y-3">
            <Field label="Runner name" value={runnerName} onChange={setRunnerName} placeholder="Full name" />
            <Field label="Phone (optional)" value={runnerPhone} onChange={setRunnerPhone} placeholder="Phone number" />
            <Field label="Email (optional)" type="email" value={runnerEmail} onChange={setRunnerEmail} placeholder="Email" />
          </div>
          {errorMsg && <ErrorBox msg={errorMsg} />}
          <ModalActions onCancel={() => setShowAddRunner(false)} onSave={addRunner} saving={saving} saveLabel="Add runner" disabled={!runnerName.trim()} />
        </Modal>
      )}

      {/* Add/Edit Store Modal */}
      {showAddStore && (
        <Modal title={editingStore ? 'Edit store' : 'Add store'} onClose={() => { setShowAddStore(false); setEditingStore(null); resetStoreForm(); }}>
          <div className="space-y-3">
            <Field label="Store name" value={storeName} onChange={setStoreName} placeholder="e.g. Walmart Supercenter #1234" />
            <Field label="Address" value={storeAddress} onChange={setStoreAddress} placeholder="Street address" />
            <div className="grid grid-cols-3 gap-3">
              <Field label="City" value={storeCity} onChange={setStoreCity} placeholder="City" />
              <Field label="State" value={storeState} onChange={setStoreState} placeholder="ST" />
              <Field label="Zip" value={storeZip} onChange={setStoreZip} placeholder="Zip" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" value={storePhone} onChange={setStorePhone} placeholder="Store phone" />
              <Field label="Contact name" value={storeContact} onChange={setStoreContact} placeholder="Manager name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Delivery days</label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      storeDays.includes(day)
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Special instructions (optional)</label>
              <textarea
                value={storeInstructions}
                onChange={(e) => setStoreInstructions(e.target.value)}
                rows={2}
                placeholder="Backstock location, delivery entrance, etc."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm text-slate-900 resize-none"
              />
            </div>
          </div>
          {errorMsg && <ErrorBox msg={errorMsg} />}
          <ModalActions
            onCancel={() => { setShowAddStore(false); setEditingStore(null); resetStoreForm(); }}
            onSave={editingStore ? updateStore : addStore}
            saving={saving}
            saveLabel={editingStore ? 'Save changes' : 'Add store'}
            disabled={!storeName.trim()}
          />
        </Modal>
      )}
      <FeedbackButton pageContext="multi_route" />
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone: 'teal' | 'blue' | 'emerald' | 'amber' }) {
  const tones = {
    teal: 'bg-teal-50 text-teal-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function PartnerCard({ icon, title, body, badge }: { icon: React.ReactNode; title: string; body: string; badge: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 bg-slate-50">
      <div className="w-8 h-8 rounded-lg bg-white text-slate-500 flex items-center justify-center flex-shrink-0 border border-slate-100">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{body}</p>
      </div>
      <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">{badge}</span>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm text-slate-900"
      />
    </label>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mt-3">
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      {msg}
    </div>
  );
}

function ModalActions({ onCancel, onSave, saving, saveLabel, disabled }: { onCancel: () => void; onSave: () => void; saving: boolean; saveLabel: string; disabled: boolean }) {
  return (
    <div className="flex gap-2 mt-5">
      <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={disabled || saving}
        className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold disabled:opacity-50"
      >
        {saving ? 'Saving...' : saveLabel}
      </button>
    </div>
  );
}

function DollarSign({ className }: { className?: string }) {
  return <span className={`font-bold ${className ?? ''}`}>$</span>;
}
