import { useState, useEffect, useCallback } from 'react';
import { supabase, type Profile, type VendorInvitation, type VendorRelationship, type SoloGig, type VendorRoute, type Store, type RelieverDeliveryConfirmation, type RelieverStoreFeedback } from '@/lib/supabase';
import { CalendarDays, CheckCircle2, Circle, Copy, ExternalLink, Eye, Link2, Mail, MapPin, Phone, User, FileText, MessageSquare, Plus, Route, Store as StoreIcon, Trash2, Users, X, AlertCircle, ArrowLeft } from 'lucide-react';
import { CreatorBadge } from '@/components/CreatorBadge';
import { NotificationBell } from '@/components/NotificationBell';
import { CommunityForum } from '@/components/CommunityForum';
import { FeedbackButton } from '@/components/FeedbackButton';
import { MessageCircle } from 'lucide-react';

type Props = { userId: string; profile: Profile | null; onSignOut: () => Promise<void> };

type GigWithNames = SoloGig & { vendorName: string; routeName: string };

export function SoloDashboard({ userId, profile, onSignOut }: Props) {
  const [relationships, setRelationships] = useState<VendorRelationship[]>([]);
  const [invitations, setInvitations] = useState<VendorInvitation[]>([]);
  const [gigs, setGigs] = useState<GigWithNames[]>([]);
  const [routes, setRoutes] = useState<VendorRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showGig, setShowGig] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [gigVendor, setGigVendor] = useState('');
  const [gigRoute, setGigRoute] = useState('');
  const [gigDate, setGigDate] = useState('');
  const [gigNotes, setGigNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewingVendor, setViewingVendor] = useState<{ vendorId: string; vendorName: string } | null>(null);
  const [vendorStores, setVendorStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [vendorConfirmations, setVendorConfirmations] = useState<Record<string, string>>({});
  const [vendorFeedback, setVendorFeedback] = useState<Record<string, RelieverStoreFeedback>>({});
  const [feedbackStore, setFeedbackStore] = useState<Store | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  function getCurrentWeekStart(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return monday.toISOString().split('T')[0];
  }

  const loadData = useCallback(async () => {
    const [relationshipRes, invitationRes, gigRes, routeRes] = await Promise.all([
      supabase.from('vendor_relationships').select('*').eq('reliever_id', userId).eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('vendor_invitations').select('*').eq('reliever_id', userId).order('created_at', { ascending: false }),
      supabase.from('solo_gigs').select('*').eq('reliever_id', userId).order('gig_date', { ascending: true }),
      supabase.from('vendor_routes').select('*').eq('reliever_id', userId).order('name', { ascending: true }),
    ]);
    const relationshipList = (relationshipRes.data as VendorRelationship[]) ?? [];
    const routeList = (routeRes.data as VendorRoute[]) ?? [];
    setRelationships(relationshipList);
    setInvitations((invitationRes.data as VendorInvitation[]) ?? []);
    setRoutes(routeList);
    setGigs(((gigRes.data as SoloGig[]) ?? []).map((gig) => ({
      ...gig,
      vendorName: relationshipList.find((r) => r.vendor_id === gig.vendor_id)?.vendor_name ?? 'Vendor',
      routeName: routeList.find((r) => r.id === gig.route_id)?.name ?? 'Route',
    })));
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function createInvitation() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    const { data, error } = await supabase.from('vendor_invitations').insert({
      reliever_id: userId,
      vendor_name: inviteName.trim(),
      vendor_email: inviteEmail.trim().toLowerCase(),
      message: inviteMessage.trim() || null,
    }).select().maybeSingle();
    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }
    if (data) {
      setInviteName('');
      setInviteEmail('');
      setInviteMessage('');
      setShowInvite(false);
      await loadData();
    }
    setSaving(false);
  }

  async function createGig() {
    if (!gigVendor || !gigDate) return;
    setSaving(true);
    setErrorMsg(null);
    const { data, error } = await supabase.from('solo_gigs').insert({
      reliever_id: userId,
      vendor_id: gigVendor,
      route_id: gigRoute || null,
      gig_date: gigDate,
      notes: gigNotes.trim() || null,
    }).select().maybeSingle();
    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }
    if (data) {
      setGigVendor('');
      setGigRoute('');
      setGigDate('');
      setGigNotes('');
      setShowGig(false);
      await loadData();
    }
    setSaving(false);
  }

  async function deleteGig(id: string) {
    await supabase.from('solo_gigs').delete().eq('id', id);
    await loadData();
  }

  async function openVendorRoute(vendorId: string, vendorName: string) {
    setViewingVendor({ vendorId, vendorName });
    setStoresLoading(true);
    const weekStart = getCurrentWeekStart();
    const [storesRes, confirmationsRes, feedbackRes] = await Promise.all([
      supabase.from('stores').select('*').eq('user_id', vendorId).order('stop_order', { ascending: true }),
      supabase.from('reliever_delivery_confirmations').select('*').eq('reliever_id', userId).eq('vendor_id', vendorId).eq('week_start', weekStart),
      supabase.from('reliever_store_feedback').select('*').eq('reliever_id', userId).eq('vendor_id', vendorId).eq('week_start', weekStart),
    ]);
    setVendorStores((storesRes.data as Store[]) ?? []);
    const confirmations = (confirmationsRes.data as RelieverDeliveryConfirmation[]) ?? [];
    const confirmMap: Record<string, string> = {};
    for (const c of confirmations) confirmMap[c.store_id] = c.confirmed_at;
    setVendorConfirmations(confirmMap);
    const feedbacks = (feedbackRes.data as RelieverStoreFeedback[]) ?? [];
    const feedbackMap: Record<string, RelieverStoreFeedback> = {};
    for (const f of feedbacks) feedbackMap[f.store_id] = f;
    setVendorFeedback(feedbackMap);
    setStoresLoading(false);
  }

  function closeVendorRoute() {
    setViewingVendor(null);
    setVendorStores([]);
    setVendorConfirmations({});
    setVendorFeedback({});
  }

  function openFeedbackModal(store: Store) {
    setFeedbackStore(store);
    setFeedbackText(vendorFeedback[store.id]?.message ?? '');
    setFeedbackError(null);
  }

  function closeFeedbackModal() {
    setFeedbackStore(null);
    setFeedbackText('');
    setFeedbackError(null);
  }

  async function submitFeedback() {
    if (!viewingVendor || !feedbackStore || !feedbackText.trim()) return;
    setFeedbackSaving(true);
    setFeedbackError(null);
    const weekStart = getCurrentWeekStart();
    const existing = vendorFeedback[feedbackStore.id];
    if (existing) {
      setFeedbackError('Feedback already submitted for this store this week.');
      setFeedbackSaving(false);
      return;
    }
    const { data, error } = await supabase.from('reliever_store_feedback').insert({
      reliever_id: userId,
      vendor_id: viewingVendor.vendorId,
      store_id: feedbackStore.id,
      week_start: weekStart,
      message: feedbackText.trim(),
    }).select().single();
    if (error) {
      setFeedbackError(error.message);
      setFeedbackSaving(false);
      return;
    }
    const feedback = data as RelieverStoreFeedback;
    setVendorFeedback((prev) => ({ ...prev, [feedbackStore.id]: feedback }));
    await supabase.from('notifications').insert({
      user_id: viewingVendor.vendorId,
      type: 'reliever_feedback',
      title: `Feedback from reliever: ${feedbackStore.name}`,
      body: feedbackText.trim(),
      link: null,
      metadata: { store_id: feedbackStore.id, week_start: weekStart, reliever_id: userId },
    });
    setFeedbackText('');
    setFeedbackStore(null);
    setFeedbackSaving(false);
  }

  async function markDelivered(storeId: string) {
    if (!viewingVendor || vendorConfirmations[storeId]) return;
    const weekStart = getCurrentWeekStart();
    const { data, error } = await supabase.from('reliever_delivery_confirmations').insert({
      reliever_id: userId,
      vendor_id: viewingVendor.vendorId,
      store_id: storeId,
      week_start: weekStart,
    }).select().single();
    if (!error && data) {
      const confirmation = data as RelieverDeliveryConfirmation;
      setVendorConfirmations((prev) => ({ ...prev, [storeId]: confirmation.confirmed_at }));
    }
  }

  function inviteLink(token: string) {
    return `${window.location.origin}/?invite=${token}`;
  }

  async function copyInvite(token: string) {
    await navigator.clipboard.writeText(inviteLink(token));
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken(null), 1800);
  }

  const upcomingGigs = gigs.filter((gig) => gig.status !== 'cancelled' && gig.gig_date >= new Date().toISOString().split('T')[0]);
  function isGigActiveThisWeek(vendorId: string): boolean {
    const weekStart = getCurrentWeekStart();
    const nextMonday = new Date(weekStart);
    nextMonday.setDate(nextMonday.getDate() + 7);
    const nextMondayStr = nextMonday.toISOString().split('T')[0];
    return gigs.some((gig) => gig.vendor_id === vendorId && gig.status !== 'cancelled' && gig.gig_date >= weekStart && gig.gig_date < nextMondayStr);
  }
  const pendingInvites = invitations.filter((invite) => invite.status === 'pending');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm"><Route className="w-5 h-5 text-white" /></div>
            <div><h1 className="font-bold text-slate-900 text-lg leading-tight">VacationDSD</h1><p className="text-xs text-slate-500">Solo reliever workspace</p></div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell userId={userId} onNavigate={() => {}} />
            <button onClick={() => setShowCommunity(true)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Community Forum">
              <MessageCircle className="w-5 h-5" />
            </button>
            <button onClick={onSignOut} className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">Sign out</button>
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
          <div><p className="text-sm font-semibold text-emerald-600 uppercase tracking-wide">Lone-wolf route management</p><h2 className="text-3xl font-bold text-slate-900 mt-1">Welcome, {profile?.full_name?.split(' ')[0] ?? 'Reliever'}</h2><p className="text-slate-500 mt-2">Keep every vendor, route, and coverage day organized in one place.</p></div>
          <div className="flex gap-2"><button onClick={() => setShowInvite(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"><Plus className="w-4 h-4" /> Invite vendor</button><button onClick={() => relationships.length > 0 ? setShowGig(true) : null} disabled={relationships.length === 0} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title={relationships.length === 0 ? 'Invite a vendor first' : ''}><Plus className="w-4 h-4" /> Schedule coverage</button></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard icon={<StoreIcon className="w-5 h-5" />} label="Active vendors" value={relationships.length} tone="emerald" />
          <StatCard icon={<CalendarDays className="w-5 h-5" />} label="Upcoming coverage" value={upcomingGigs.length} tone="blue" />
          <StatCard icon={<Mail className="w-5 h-5" />} label="Pending invites" value={pendingInvites.length} tone="amber" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4"><div><h3 className="font-bold text-slate-900">Coverage calendar</h3><p className="text-sm text-slate-500">Your next vendor assignments</p></div><CalendarDays className="w-5 h-5 text-slate-400" /></div>
            {loading ? <Loading /> : upcomingGigs.length === 0 ? <Empty icon={<CalendarDays className="w-8 h-8" />} title="No coverage scheduled" body="Add a coverage day when a vendor calls." /> : <div className="space-y-3">{upcomingGigs.slice(0, 8).map((gig) => <div key={gig.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex flex-col items-center justify-center"><span className="text-[10px] font-bold uppercase">{new Date(`${gig.gig_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })}</span><span className="text-lg font-bold leading-none">{new Date(`${gig.gig_date}T12:00:00`).getDate()}</span></div><div className="flex-1"><p className="font-semibold text-slate-900 text-sm">{gig.vendorName}</p><p className="text-xs text-slate-500">{gig.routeName}{gig.notes ? ` · ${gig.notes}` : ''}</p></div><button onClick={() => openVendorRoute(gig.vendor_id, gig.vendorName)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition-colors" title="View this vendor's route"><Eye className="w-3.5 h-3.5" /> View Route</button><button onClick={() => deleteGig(gig.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button></div>)}</div>}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5"><div className="flex items-center justify-between mb-4"><div><h3 className="font-bold text-slate-900">Your vendors</h3><p className="text-sm text-slate-500">Connected route partners</p></div><Users className="w-5 h-5 text-slate-400" /></div>{loading ? <Loading /> : relationships.length === 0 ? <Empty icon={<Users className="w-8 h-8" />} title="No vendors yet" body="Invite a vendor to get started." /> : <div className="space-y-2">{relationships.map((relationship) => <div key={relationship.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50"><div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">{relationship.vendor_name.charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="font-semibold text-sm text-slate-900 truncate">{relationship.vendor_name}</p><p className="text-xs text-slate-500">{routes.filter((route) => route.vendor_id === relationship.vendor_id).length} routes connected</p></div></div>)}</div>}</section>
        </div>

        <section className="mt-6 bg-slate-900 rounded-2xl p-6 text-white"><div className="flex flex-col md:flex-row md:items-center justify-between gap-5"><div><div className="flex items-center gap-2 mb-2"><Link2 className="w-5 h-5 text-emerald-300" /><p className="text-sm font-bold text-emerald-300 uppercase tracking-wide">Grow your coverage network</p></div><h3 className="text-xl font-bold">Need a planned vacation group later?</h3><p className="text-slate-300 text-sm mt-1 max-w-xl">VacationDSD also helps route owners coordinate shared calendars, drafts, votes, and group chat. You can switch to group mode whenever the right one comes together.</p></div><a href="mailto:support@vacationdsd.com?subject=Switch to group mode" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap"><ExternalLink className="w-4 h-4" /> Explore group mode</a></div></section>

        {invitations.length > 0 && <section className="mt-6 bg-white rounded-2xl border border-slate-200 p-5"><div className="flex items-center justify-between mb-4"><div><h3 className="font-bold text-slate-900">Vendor invitations</h3><p className="text-sm text-slate-500">Share a signup link with each vendor.</p></div><Mail className="w-5 h-5 text-slate-400" /></div><div className="space-y-3">{invitations.slice(0, 5).map((invite) => <div key={invite.id} className="flex flex-col sm:flex-row sm:items-center gap-3 border border-slate-100 rounded-xl p-3"><div className="flex-1"><p className="font-semibold text-sm text-slate-900">{invite.vendor_name}</p><p className="text-xs text-slate-500">{invite.vendor_email} · <span className={invite.status === 'accepted' ? 'text-emerald-600' : 'text-amber-600'}>{invite.status}</span></p></div>{invite.status === 'pending' && <button onClick={() => copyInvite(invite.invite_token)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors"><Copy className="w-3.5 h-3.5" /> {copiedToken === invite.invite_token ? 'Copied' : 'Copy signup link'}</button>}</div>)}</div></section>}
      </main>

      <footer className="max-w-6xl mx-auto px-4 sm:px-6 pb-6">
        <div className="flex justify-center">
          <CreatorBadge />
        </div>
      </footer>
        </>
      )}

      {showInvite && <Modal title="Invite a vendor" onClose={() => setShowInvite(false)}><p className="text-sm text-slate-500 mb-4">Create a secure signup link you can text or email to the vendor. They will add their stores and route information.</p><div className="space-y-3"><Field label="Vendor or company name" value={inviteName} onChange={setInviteName} placeholder="Northeast Foods" /><Field label="Vendor email" type="email" value={inviteEmail} onChange={setInviteEmail} placeholder="dispatcher@company.com" /><Field label="Personal message (optional)" value={inviteMessage} onChange={setInviteMessage} placeholder="Add your stores here so I can cover them..." /></div>{errorMsg && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mt-3"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{errorMsg}</div>}<ModalActions onCancel={() => setShowInvite(false)} onSave={createInvitation} saving={saving} saveLabel="Create signup link" disabled={!inviteName.trim() || !inviteEmail.trim()} /></Modal>}
      {viewingVendor && <VendorRouteModal vendorName={viewingVendor.vendorName} stores={vendorStores} loading={storesLoading} confirmedStoreIds={vendorConfirmations} feedbackByStore={vendorFeedback} canMarkDelivered={isGigActiveThisWeek(viewingVendor.vendorId)} onMarkDelivered={markDelivered} onOpenFeedback={openFeedbackModal} onClose={closeVendorRoute} />}
      {feedbackStore && (
        <Modal title={`Feedback for ${feedbackStore.name}`} onClose={closeFeedbackModal}>
          <p className="text-sm text-slate-500 mb-4">Leave a note for the vendor about something unexpected at this store. They'll see it in their notifications even after the week ends.</p>
          <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} rows={4} placeholder="e.g. Still have 3 cases of backstock in store" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm text-slate-900 resize-none" />
          {feedbackError && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mt-3"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{feedbackError}</div>}
          <ModalActions onCancel={closeFeedbackModal} onSave={submitFeedback} saving={feedbackSaving} saveLabel="Submit feedback" disabled={!feedbackText.trim()} />
        </Modal>
      )}
      <FeedbackButton pageContext="solo" />
      {showGig && <Modal title="Schedule coverage" onClose={() => setShowGig(false)}><div className="space-y-3"><label className="block text-sm font-medium text-slate-700">Vendor<select value={gigVendor} onChange={(e) => setGigVendor(e.target.value)} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm"><option value="">Choose a vendor</option>{relationships.map((r) => <option key={r.vendor_id} value={r.vendor_id}>{r.vendor_name}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Route<select value={gigRoute} onChange={(e) => setGigRoute(e.target.value)} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm"><option value="">Any route</option>{routes.filter((r) => !gigVendor || r.vendor_id === gigVendor).map((r) => <option key={r.id} value={r.id}>{r.name} · {r.company}</option>)}</select></label><Field label="Coverage date" type="date" value={gigDate} onChange={setGigDate} /><Field label="Notes (optional)" value={gigNotes} onChange={setGigNotes} placeholder="Pickup time, special instructions..." /></div>{errorMsg && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mt-3"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{errorMsg}</div>}<ModalActions onCancel={() => setShowGig(false)} onSave={createGig} saving={saving} saveLabel="Schedule coverage" disabled={!gigVendor || !gigDate} /></Modal>}
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'emerald' | 'blue' | 'amber' }) { const tones = { emerald: 'bg-emerald-50 text-emerald-600', blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600' }; return <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>{icon}</div><div><p className="text-2xl font-bold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div></div>; }
function Loading() { return <div className="py-8 flex justify-center"><div className="w-7 h-7 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" /></div>; }
function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) { return <div className="py-8 text-center"><div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3">{icon}</div><p className="font-semibold text-slate-800 text-sm">{title}</p><p className="text-xs text-slate-500 mt-1">{body}</p></div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} /><div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"><div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-900">{title}</h3><button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button></div>{children}</div></div>; }
function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) { return <label className="block text-sm font-medium text-slate-700">{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm text-slate-900" /></label>; }
function ModalActions({ onCancel, onSave, saving, saveLabel, disabled }: { onCancel: () => void; onSave: () => void; saving: boolean; saveLabel: string; disabled: boolean }) { return <div className="flex gap-2 mt-5"><button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button onClick={onSave} disabled={disabled || saving} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Saving...' : saveLabel}</button></div>; }

function VendorRouteModal({ vendorName, stores, loading, confirmedStoreIds, feedbackByStore, canMarkDelivered, onMarkDelivered, onOpenFeedback, onClose }: { vendorName: string; stores: Store[]; loading: boolean; confirmedStoreIds: Record<string, string>; feedbackByStore: Record<string, RelieverStoreFeedback>; canMarkDelivered: boolean; onMarkDelivered: (storeId: string) => void; onOpenFeedback: (store: Store) => void; onClose: () => void; }) {
  const confirmedCount = stores.filter((s) => confirmedStoreIds[s.id]).length;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{vendorName}'s Route</h2>
            <p className="text-xs text-slate-500">Mark each store as delivered — resets Monday</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        {stores.length > 0 && !loading && (
          <div className="px-6 pt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-slate-700">This Week's Progress</span>
              <span className="text-sm font-bold text-slate-900">{confirmedCount}/{stores.length} delivered</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${stores.length ? (confirmedCount / stores.length) * 100 : 0}%` }} />
            </div>
          </div>
        )}
        <div className="p-5">
          {loading ? (
            <div className="py-12 flex justify-center"><div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" /></div>
          ) : stores.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3"><MapPin className="w-7 h-7" /></div>
              <p className="font-semibold text-slate-800 text-sm">No stores added yet</p>
              <p className="text-xs text-slate-500 mt-1">This vendor hasn't added any stores to their route.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stores.map((store, index) => {
                const fullAddress = [store.address, store.city, store.state, store.zip].filter(Boolean).join(', ');
                const isConfirmed = !!confirmedStoreIds[store.id];
                return (
                  <div key={store.id} className={`bg-white rounded-2xl border transition-all ${isConfirmed ? 'border-emerald-300 shadow-sm' : 'border-slate-200'}`}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${isConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 truncate text-sm">{store.name}</h3>
                          {fullAddress && (
                            <div className="flex items-start gap-1.5 mt-1 text-xs text-slate-500"><MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /><span className="truncate">{fullAddress}</span></div>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            {store.phone && <div className="flex items-center gap-1.5 text-xs text-slate-500"><Phone className="w-3 h-3" /><span>{store.phone}</span></div>}
                            {store.contact_name && <div className="flex items-center gap-1.5 text-xs text-slate-500"><User className="w-3 h-3" /><span>{store.contact_name}</span></div>}
                          </div>
                          {store.special_instructions && (
                            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                              <div className="flex items-start gap-2">
                                <FileText className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Special Instructions</p>
                                  <p className="text-xs text-amber-900 whitespace-pre-wrap">{store.special_instructions}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                              const active = store.delivery_days.includes(day);
                              return <span key={day} className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}>{day.slice(0, 3)}</span>;
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                    {canMarkDelivered && (
                      <div className="flex gap-0">
                        <button
                          onClick={() => onMarkDelivered(store.id)}
                          disabled={isConfirmed}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${isConfirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'} ${feedbackByStore[store.id] ? 'rounded-bl-2xl' : 'rounded-b-2xl'}`}
                        >
                          {isConfirmed ? <><CheckCircle2 className="w-5 h-5" /> Delivered ({new Date(confirmedStoreIds[store.id]).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })})</> : <><Circle className="w-5 h-5" /> Mark as Delivered</>}
                        </button>
                        <button
                          onClick={() => onOpenFeedback(store)}
                          disabled={!!feedbackByStore[store.id]}
                          className={`flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors ${feedbackByStore[store.id] ? 'bg-amber-50 text-amber-700' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'} rounded-br-2xl`}
                          title={feedbackByStore[store.id] ? 'Feedback submitted' : 'Leave feedback for the vendor'}
                        >
                          <MessageSquare className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    {!canMarkDelivered && isConfirmed && (
                      <div className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold bg-emerald-50 text-emerald-700 rounded-b-2xl">
                        <CheckCircle2 className="w-5 h-5" /> Delivered ({new Date(confirmedStoreIds[store.id]).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })})
                      </div>
                    )}
                    {feedbackByStore[store.id] && (
                      <div className="mx-4 mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Feedback sent to vendor</p>
                            <p className="text-xs text-amber-900 whitespace-pre-wrap">{feedbackByStore[store.id].message}</p>
                          </div>
                        </div>
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
  );
}
