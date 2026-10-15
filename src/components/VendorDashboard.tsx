import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Profile, type Store, type VendorRoute, type RelieverDeliveryConfirmation, type RelieverStoreFeedback } from '@/lib/supabase';
import { StoreCard } from '@/components/StoreCard';
import { StoreFormModal } from '@/components/StoreFormModal';
import { NotificationBell } from '@/components/NotificationBell';
import { CreatorBadge } from '@/components/CreatorBadge';
import { CommunityForum } from '@/components/CommunityForum';
import { FeedbackButton } from '@/components/FeedbackButton';
import { AccountModal } from '@/components/AccountModal';
import { SettingsModal } from '@/components/SettingsModal';
import { CalendarDays, CheckCircle2, Circle, Edit3, LogOut, MapPin, MessageSquare, Plus, Route, Store as StoreIcon, Truck, User, Settings, X, MessageCircle, ArrowLeft } from 'lucide-react';

type Props = { userId: string; profile: Profile | null; onSignOut: () => Promise<void> };

export function VendorDashboard({ userId, profile, onSignOut }: Props) {
  const { refreshProfile } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [routes, setRoutes] = useState<VendorRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [weeklyConfirmations, setWeeklyConfirmations] = useState<RelieverDeliveryConfirmation[]>([]);
  const [weeklyFeedback, setWeeklyFeedback] = useState<RelieverStoreFeedback[]>([]);

  function getCurrentWeekStart(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return monday.toISOString().split('T')[0];
  }

  const loadData = useCallback(async () => {
    const weekStart = getCurrentWeekStart();
    const [storesRes, routesRes, confirmationsRes, feedbackRes] = await Promise.all([
      supabase.from('stores').select('*').eq('user_id', userId).order('stop_order', { ascending: true }),
      supabase.from('vendor_routes').select('*').eq('vendor_id', userId).order('name', { ascending: true }),
      supabase.from('reliever_delivery_confirmations').select('*').eq('vendor_id', userId).eq('week_start', weekStart),
      supabase.from('reliever_store_feedback').select('*').eq('vendor_id', userId).eq('week_start', weekStart),
    ]);
    setStores((storesRes.data as Store[]) ?? []);
    setRoutes((routesRes.data as VendorRoute[]) ?? []);
    setWeeklyConfirmations((confirmationsRes.data as RelieverDeliveryConfirmation[]) ?? []);
    setWeeklyFeedback((feedbackRes.data as RelieverStoreFeedback[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function deleteStore(id: string) {
    await supabase.from('stores').delete().eq('id', id);
    await loadData();
  }

  const activeRoute = profile?.route_name || routes[0]?.name || 'Your route';
  const profileComplete = !!(profile?.company && profile?.full_name);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm"><Truck className="w-5 h-5 text-white" /></div>
            <div><h1 className="font-bold text-slate-900 text-lg leading-tight">VacationDSD</h1><p className="text-xs text-slate-500">Vendor route workspace</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowProfileEdit(true)} className="p-2.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Edit profile">
              <Edit3 className="w-5 h-5" />
            </button>
            <NotificationBell userId={userId} onNavigate={() => {}} />
            <button onClick={() => setShowSettings(true)} className="p-2.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Settings">
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={() => setShowAccount(true)} className="w-9 h-9 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm transition-colors" title="My Account">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? <User className="w-4 h-4" />}
            </button>
            <div className="w-px h-8 bg-slate-200 mx-1" />
            <button onClick={() => setShowCommunity(true)} className="p-2.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Community Forum">
              <MessageCircle className="w-5 h-5" />
            </button>
            <button onClick={onSignOut} className="p-2.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Sign out">
              <LogOut className="w-5 h-5" />
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
        {!profileComplete && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Edit3 className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-amber-900 text-sm">Your profile is incomplete</p>
              <p className="text-xs text-amber-700 mt-0.5">Add your company name and contact info so your reliever can reach you.</p>
            </div>
            <button onClick={() => setShowProfileEdit(true)} className="text-sm font-semibold text-amber-700 hover:text-amber-800 whitespace-nowrap">Complete now</button>
          </div>
        )}

        <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-6 text-white mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-blue-200 text-sm font-semibold uppercase tracking-wide">Vendor portal</p>
              <h2 className="text-2xl font-bold mt-1">Welcome, {profile?.company || profile?.full_name || 'Vendor'}</h2>
              <p className="text-blue-100 text-sm mt-2">Keep your stores and route instructions current for your reliever.</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center"><StoreIcon className="w-7 h-7 text-white" /></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Metric icon={<StoreIcon className="w-5 h-5" />} label="Stores" value={stores.length} />
          <Metric icon={<Route className="w-5 h-5" />} label="Routes" value={Math.max(routes.length, profile?.route_name ? 1 : 0)} />
          <Metric icon={<CheckCircle2 className="w-5 h-5" />} label="Profile status" value={profileComplete ? 'Ready' : 'Incomplete'} />
        </div>

        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div><h3 className="font-bold text-slate-900">{activeRoute}</h3><p className="text-sm text-slate-500">Your stores in delivery order</p></div>
            <button onClick={() => { setEditingStore(null); setShowStoreForm(true); }} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"><Plus className="w-4 h-4" /> Add store</button>
          </div>
          {loading ? (
            <div className="py-16 flex justify-center"><div className="w-8 h-8 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin" /></div>
          ) : stores.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-300 flex items-center justify-center mx-auto mb-3"><MapPin className="w-8 h-8" /></div>
              <h4 className="font-semibold text-slate-900">Add your first store</h4>
              <p className="text-sm text-slate-500 mt-1 mb-4">Your reliever will use this list to cover your route.</p>
              <button onClick={() => { setEditingStore(null); setShowStoreForm(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold"><Plus className="w-4 h-4" /> Add store</button>
            </div>
          ) : (
            <div className="space-y-3">
              {stores.map((store, index) => {
                const confirmedIds = new Set(weeklyConfirmations.map((c) => c.store_id));
                return <StoreCard key={store.id} store={store} stopNumber={index + 1} confirmed={confirmedIds.has(store.id)} onToggleConfirm={() => {}} onEdit={() => { setEditingStore(store); setShowStoreForm(true); }} onDelete={() => deleteStore(store.id)} vendorView />;
              })}
            </div>
          )}
        </section>

        <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InfoCard icon={<CalendarDays className="w-5 h-5" />} title="Delivery schedule" body="Add delivery days and special instructions to each store so your reliever always has the latest plan." />
          <InfoCard icon={<Edit3 className="w-5 h-5" />} title="Payment setup coming next" body="Payment details will be added here before the first coverage payment is sent through VacationDSD." />
        </section>

        {stores.length > 0 && (
          <section className="mt-6 bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900">Reliever Progress This Week</h3>
                <p className="text-sm text-slate-500">Stores your reliever has marked as delivered</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-slate-400" />
            </div>
            {(() => {
              const confirmedIds = new Set(weeklyConfirmations.map((c) => c.store_id));
              const confirmedCount = stores.filter((s) => confirmedIds.has(s.id)).length;
              return (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">{confirmedCount} of {stores.length} stores delivered</span>
                    <span className="text-sm font-bold text-emerald-600">{stores.length ? Math.round((confirmedCount / stores.length) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${stores.length ? (confirmedCount / stores.length) * 100 : 0}%` }} />
                  </div>
                  <div className="space-y-2">
                    {stores.map((store, index) => {
                      const isConfirmed = confirmedIds.has(store.id);
                      const confirmation = weeklyConfirmations.find((c) => c.store_id === store.id);
                      const feedback = weeklyFeedback.find((f) => f.store_id === store.id);
                      return (
                        <div key={store.id} className={`flex flex-col rounded-xl border p-3 ${isConfirmed ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${isConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                              {isConfirmed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-slate-900 truncate">{index + 1}. {store.name}</p>
                              {isConfirmed && confirmation ? (
                                <p className="text-xs text-emerald-600">Delivered ({new Date(confirmation.confirmed_at).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })})</p>
                              ) : (
                                <p className="text-xs text-slate-400">Not yet delivered</p>
                              )}
                            </div>
                          </div>
                          {feedback && (
                            <div className="mt-2 ml-11 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                              <div className="flex items-start gap-2">
                                <MessageSquare className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Reliever feedback</p>
                                  <p className="text-xs text-amber-900 whitespace-pre-wrap">{feedback.message}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </section>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 sm:px-6 pb-6">
        <div className="flex justify-center">
          <CreatorBadge />
        </div>
      </footer>
        </>
      )}

      {showStoreForm && <StoreFormModal store={editingStore} onClose={() => { setShowStoreForm(false); setEditingStore(null); }} onSaved={async () => { setShowStoreForm(false); setEditingStore(null); await loadData(); }} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onSaved={() => {}} />}
      {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
      {showProfileEdit && <ProfileEditModal profile={profile} onClose={() => setShowProfileEdit(false)} onSaved={async () => { setShowProfileEdit(false); await refreshProfile(); }} />}
      <FeedbackButton pageContext="vendor" />
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">{icon}</div><div><p className="text-xl font-bold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div></div>;
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <div className="bg-white rounded-2xl border border-slate-200 p-5 flex gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">{icon}</div><div><h4 className="font-semibold text-slate-900 text-sm">{title}</h4><p className="text-sm text-slate-500 mt-1 leading-relaxed">{body}</p></div></div>;
}

function ProfileEditModal({ profile, onClose, onSaved }: { profile: Profile | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [company, setCompany] = useState(profile?.company ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [routeName, setRouteName] = useState(profile?.route_name ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [state, setState] = useState(profile?.state ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from('profiles').update({
      full_name: fullName,
      company,
      phone,
      route_name: routeName,
      city,
      state: state.toUpperCase().slice(0, 2),
    }).eq('id', profile?.id);
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    await onSaved();
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-slate-900">Edit Profile</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Company</label>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} required placeholder="e.g. Little Debbie, Mission Tortillas" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Route Name/Number</label>
            <input type="text" value={routeName} onChange={(e) => setRouteName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">State</label>
              <input type="text" value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} required maxLength={2} placeholder="2-letter" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-900" />
            </div>
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
