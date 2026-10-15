import { useState, useEffect, useCallback } from 'react';
import { supabase, type Profile, type MatchGig, type MatchReview, type ProfileListing } from '@/lib/supabase';
import { CreatorBadge } from '@/components/CreatorBadge';
import { NotificationBell } from '@/components/NotificationBell';
import { CommunityForum } from '@/components/CommunityForum';
import { FeedbackButton } from '@/components/FeedbackButton';
import {
  Briefcase, CalendarDays, CheckCircle2, DollarSign, MapPin, Plus,
  Star, X, AlertCircle, Truck, MessageSquare, LogOut, MessageCircle, ArrowLeft,
  Eye, Pencil, Package, HandCoins, Building2, ClipboardList,
} from 'lucide-react';

type Props = { userId: string; profile: Profile | null; onSignOut: () => Promise<void> };

type GigWithProfiles = MatchGig & {
  poster_name: string;
  claimer_name: string | null;
  my_rating: number | null;
  their_rating: number | null;
  reviews: MatchReview[];
};

export function MatchmakerDashboard({ userId, profile, onSignOut }: Props) {
  const [gigs, setGigs] = useState<GigWithProfiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPostGig, setShowPostGig] = useState(false);
  const [showReview, setShowReview] = useState<GigWithProfiles | null>(null);
  const [showCommunity, setShowCommunity] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'mine' | 'open'>('all');
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [topView, setTopView] = useState<'gigs' | 'listings'>('gigs');
  const [listings, setListings] = useState<ProfileListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [showEditListing, setShowEditListing] = useState(false);

  // Listing form state
  const [lfActive, setLfActive] = useState(false);
  const [lfRouteSize, setLfRouteSize] = useState('');
  const [lfRouteLocation, setLfRouteLocation] = useState('');
  const [lfPricingType, setLfPricingType] = useState<'fixed' | 'negotiable'>('fixed');
  const [lfRateAmount, setLfRateAmount] = useState('');
  const [lfWillingCities, setLfWillingCities] = useState('');
  const [lfDescription, setLfDescription] = useState('');

  // Post gig form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [gigDate, setGigDate] = useState('');
  const [payRate, setPayRate] = useState('');

  // Review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const loadData = useCallback(async () => {
    const [gigsRes, reviewsRes] = await Promise.all([
      supabase.from('match_gigs').select('*').order('gig_date', { ascending: false }),
      supabase.from('match_reviews').select('*').eq('reviewee_id', userId),
    ]);

    const gigList = (gigsRes.data as MatchGig[]) ?? [];
    const myReviews = (reviewsRes.data as MatchReview[]) ?? [];

    if (myReviews.length > 0) {
      setAvgRating(myReviews.reduce((sum, r) => sum + r.rating, 0) / myReviews.length);
      setReviewCount(myReviews.length);
    } else {
      setAvgRating(null);
      setReviewCount(0);
    }

    const profileIds = new Set<string>();
    gigList.forEach((g) => {
      profileIds.add(g.posted_by);
      if (g.claimed_by) profileIds.add(g.claimed_by);
    });

    const profileMap: Record<string, string> = {};
    if (profileIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, company')
        .in('id', Array.from(profileIds));
      (profiles ?? []).forEach((p: any) => {
        profileMap[p.id] = p.full_name || p.company || 'Unknown';
      });
    }

    const gigIds = gigList.map((g) => g.id);
    let reviewMap: Record<string, MatchReview[]> = {};
    if (gigIds.length > 0) {
      const { data: allReviews } = await supabase
        .from('match_reviews')
        .select('*')
        .in('gig_id', gigIds);
      reviewMap = {};
      (allReviews as MatchReview[] ?? []).forEach((r) => {
        if (!reviewMap[r.gig_id]) reviewMap[r.gig_id] = [];
        reviewMap[r.gig_id].push(r);
      });
    }

    setGigs(gigList.map((g) => ({
      ...g,
      poster_name: profileMap[g.posted_by] ?? 'Unknown',
      claimer_name: g.claimed_by ? (profileMap[g.claimed_by] ?? 'Unknown') : null,
      reviews: reviewMap[g.id] ?? [],
      my_rating: (reviewMap[g.id] ?? []).find((r) => r.reviewer_id === userId)?.rating ?? null,
      their_rating: (reviewMap[g.id] ?? []).find((r) => r.reviewee_id === userId)?.rating ?? null,
    })));
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadListings = useCallback(async () => {
    setListingsLoading(true);
    const { data: activeProfiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('listing_active', true)
      .neq('id', userId)
      .order('created_at', { ascending: false });
    const profileList = (activeProfiles as Profile[]) ?? [];
    if (profileList.length === 0) {
      setListings([]);
      setListingsLoading(false);
      return;
    }
    const { data: allReviews } = await supabase
      .from('match_reviews')
      .select('reviewee_id, rating')
      .in('reviewee_id', profileList.map((p) => p.id));
    const ratingMap: Record<string, { sum: number; count: number }> = {};
    (allReviews as MatchReview[] ?? []).forEach((r) => {
      if (!ratingMap[r.reviewee_id]) ratingMap[r.reviewee_id] = { sum: 0, count: 0 };
      ratingMap[r.reviewee_id].sum += r.rating;
      ratingMap[r.reviewee_id].count += 1;
    });
    setListings(profileList.map((p) => ({
      ...p,
      avg_rating: ratingMap[p.id] ? ratingMap[p.id].sum / ratingMap[p.id].count : null,
      review_count: ratingMap[p.id]?.count ?? 0,
    })));
    setListingsLoading(false);
  }, [userId]);

  useEffect(() => { loadListings(); }, [loadListings]);

  function openEditListing() {
    setLfActive(profile?.listing_active ?? false);
    setLfRouteSize(profile?.listing_route_size ?? '');
    setLfRouteLocation(profile?.listing_route_location ?? '');
    setLfPricingType((profile?.listing_pricing_type as 'fixed' | 'negotiable') ?? 'fixed');
    setLfRateAmount(profile?.listing_rate_amount ?? '');
    setLfWillingCities(profile?.listing_willing_cities ?? '');
    setLfDescription(profile?.listing_description ?? '');
    setShowEditListing(true);
  }

  async function saveListing() {
    setSaving(true);
    setErrorMsg(null);
    const isOwner = profile?.account_type !== 'solo';
    const { error } = await supabase.from('profiles').update({
      listing_active: lfActive,
      listing_route_size: isOwner ? (lfRouteSize.trim() || null) : null,
      listing_route_location: isOwner ? (lfRouteLocation.trim() || null) : null,
      listing_pricing_type: isOwner ? (lfActive ? lfPricingType : null) : null,
      listing_rate_amount: lfRateAmount.trim() || null,
      listing_willing_cities: !isOwner ? (lfWillingCities.trim() || null) : null,
      listing_description: lfDescription.trim() || null,
    }).eq('id', userId);
    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }
    setShowEditListing(false);
    setSaving(false);
    await loadListings();
  }

  async function postGig() {
    if (!title.trim() || !gigDate) return;
    setSaving(true);
    setErrorMsg(null);
    const { error } = await supabase.from('match_gigs').insert({
      posted_by: userId,
      poster_type: profile?.account_type === 'vendor' ? 'vendor' : 'reliever',
      title: title.trim(),
      description: description.trim() || null,
      company: profile?.company ?? null,
      city: profile?.city ?? null,
      state: profile?.state ?? null,
      gig_date: gigDate,
      pay_rate: payRate.trim() || null,
    });
    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }
    setTitle('');
    setDescription('');
    setGigDate('');
    setPayRate('');
    setShowPostGig(false);
    await loadData();
    setSaving(false);
  }

  async function claimGig(gig: MatchGig) {
    if (gig.posted_by === userId) return;
    const { error } = await supabase.from('match_gigs').update({
      status: 'claimed',
      claimed_by: userId,
      claimed_at: new Date().toISOString(),
    }).eq('id', gig.id).eq('status', 'open');
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    await supabase.from('notifications').insert({
      user_id: gig.posted_by,
      type: 'gig_claimed',
      title: 'Your gig was claimed!',
      body: `Someone claimed your gig: ${gig.title}`,
      link: null,
      metadata: { gig_id: gig.id },
    });
    await loadData();
  }

  async function completeGig(gig: MatchGig) {
    const { error } = await supabase.from('match_gigs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', gig.id);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    await loadData();
  }

  async function cancelGig(gig: MatchGig) {
    const { error } = await supabase.from('match_gigs').update({
      status: 'cancelled',
    }).eq('id', gig.id);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    await loadData();
  }

  function openReview(gig: GigWithProfiles) {
    setShowReview(gig);
    setReviewRating(5);
    setReviewComment('');
    setErrorMsg(null);
  }

  async function submitReview() {
    if (!showReview) return;
    const gig = showReview;
    const revieweeId = gig.posted_by === userId ? gig.claimed_by : gig.posted_by;
    if (!revieweeId) return;

    const existing = gig.reviews.find((r) => r.reviewer_id === userId);
    if (existing) {
      setErrorMsg('You have already left a review for this gig.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    const { error } = await supabase.from('match_reviews').insert({
      gig_id: gig.id,
      reviewer_id: userId,
      reviewee_id: revieweeId,
      reviewer_type: gig.posted_by === userId ? 'vendor' : 'reliever',
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    });
    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }
    await supabase.from('notifications').insert({
      user_id: revieweeId,
      type: 'new_review',
      title: `New ${reviewRating}-star review`,
      body: reviewComment.trim() || 'You received a new rating.',
      link: null,
      metadata: { gig_id: gig.id, rating: reviewRating },
    });
    setShowReview(null);
    await loadData();
    setSaving(false);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const filteredGigs = gigs.filter((g) => {
    if (filter === 'mine') return g.posted_by === userId || g.claimed_by === userId;
    if (filter === 'open') return g.status === 'open' && g.gig_date >= todayStr;
    return true;
  });

  const myGigs = gigs.filter((g) => g.posted_by === userId || g.claimed_by === userId);
  const activeGigs = myGigs.filter((g) => g.status === 'claimed' || g.status === 'open');
  const completedGigs = myGigs.filter((g) => g.status === 'completed');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg leading-tight">VacationDSD</h1>
              <p className="text-xs text-slate-500">Gig matchmaker</p>
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
            <p className="text-sm font-semibold text-amber-600 uppercase tracking-wide">Matchmaker</p>
            <h2 className="text-3xl font-bold text-slate-900 mt-1">Welcome, {profile?.full_name?.split(' ')[0] ?? 'there'}</h2>
            <p className="text-slate-500 mt-2">Find weekend gigs and last-minute coverage. Rate each other after the job.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openEditListing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-sm font-semibold transition-colors"
            >
              <Pencil className="w-4 h-4" /> My Listing
            </button>
            <button
              onClick={() => setShowPostGig(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> Post a gig
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Briefcase className="w-5 h-5" />} label="Active gigs" value={activeGigs.length} tone="amber" />
          <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Completed" value={completedGigs.length} tone="emerald" />
          <StatCard
            icon={<Star className="w-5 h-5" />}
            label="Avg rating"
            value={avgRating ? `${avgRating.toFixed(1)}★` : '—'}
            tone="blue"
          />
          <StatCard icon={<MessageSquare className="w-5 h-5" />} label="Reviews" value={reviewCount} tone="slate" />
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTopView('gigs')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              topView === 'gigs' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
          >
            <Briefcase className="w-4 h-4" /> Gigs
          </button>
          <button
            onClick={() => setTopView('listings')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              topView === 'listings' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
          >
            <Eye className="w-4 h-4" /> Listings
          </button>
        </div>

        {topView === 'listings' ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Active Listings</h3>
              <button
                onClick={openEditListing}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 hover:text-amber-700 transition-colors"
              >
                <Pencil className="w-4 h-4" /> Edit my listing
              </button>
            </div>
            {profile?.listing_active && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-900 text-sm">Your listing is live</p>
                  <p className="text-xs text-amber-700">Others can see your profile in the listings below.</p>
                </div>
              </div>
            )}
            {listingsLoading ? (
              <div className="py-20 flex justify-center">
                <div className="w-8 h-8 border-3 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
              </div>
            ) : listings.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3">
                  <Eye className="w-8 h-8" />
                </div>
                <p className="font-semibold text-slate-800">No active listings yet</p>
                <p className="text-sm text-slate-500 mt-1">Create your listing to let others find you.</p>
                <button onClick={openEditListing} className="mt-4 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  <Plus className="w-4 h-4" /> Create my listing
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex gap-2 mb-6">
              <FilterTab label="All gigs" active={filter === 'all'} onClick={() => setFilter('all')} />
              <FilterTab label="My gigs" active={filter === 'mine'} onClick={() => setFilter('mine')} />
              <FilterTab label="Open gigs" active={filter === 'open'} onClick={() => setFilter('open')} />
            </div>

            {loading ? (
              <div className="py-20 flex justify-center">
                <div className="w-8 h-8 border-3 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
              </div>
            ) : filteredGigs.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3">
                  <Briefcase className="w-8 h-8" />
                </div>
                <p className="font-semibold text-slate-800">No gigs here yet</p>
                <p className="text-sm text-slate-500 mt-1">Post a gig or check back for new opportunities.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredGigs.map((gig) => (
                  <GigCard
                    key={gig.id}
                    gig={gig}
                    userId={userId}
                    onClaim={() => claimGig(gig)}
                    onComplete={() => completeGig(gig)}
                    onCancel={() => cancelGig(gig)}
                    onReview={() => openReview(gig)}
                  />
                ))}
              </div>
            )}
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

      {showPostGig && (
        <Modal title="Post a gig" onClose={() => setShowPostGig(false)}>
          <p className="text-sm text-slate-500 mb-4">
            Post a weekend gig or last-minute coverage need. Other users can claim it.
          </p>
          <div className="space-y-3">
            <Field label="Gig title" value={title} onChange={setTitle} placeholder="e.g. Saturday route coverage — Mission Tortillas" />
            <Field label="Description (optional)" value={description} onChange={setDescription} placeholder="Pickup location, stores, special instructions..." />
            <Field label="Date" type="date" value={gigDate} onChange={setGigDate} />
            <Field label="Pay rate (optional)" value={payRate} onChange={setPayRate} placeholder="e.g. $200/day or 15% commission" />
          </div>
          {errorMsg && <ErrorBox msg={errorMsg} />}
          <ModalActions
            onCancel={() => setShowPostGig(false)}
            onSave={postGig}
            saving={saving}
            saveLabel="Post gig"
            disabled={!title.trim() || !gigDate}
          />
        </Modal>
      )}

      {showReview && (
        <Modal title={`Review: ${showReview.title}`} onClose={() => setShowReview(null)}>
          <p className="text-sm text-slate-500 mb-4">
            How was your experience? Your rating helps build trust in the community.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReviewRating(n)}
                    className={`p-2 rounded-xl transition-all ${n <= reviewRating ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300'}`}
                  >
                    <Star className="w-7 h-7" fill={n <= reviewRating ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Comment (optional)</label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
                placeholder="Share details about your experience..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none text-sm text-slate-900 resize-none"
              />
            </div>
          </div>
          {errorMsg && <ErrorBox msg={errorMsg} />}
          <ModalActions
            onCancel={() => setShowReview(null)}
            onSave={submitReview}
            saving={saving}
            saveLabel="Submit review"
            disabled={false}
          />
        </Modal>
      )}
      {showEditListing && (
        <Modal title="My Listing" onClose={() => setShowEditListing(false)}>
          <p className="text-sm text-slate-500 mb-4">
            {profile?.account_type === 'solo'
              ? 'Tell route owners about your availability and what you\u2019re looking for.'
              : 'Describe your route so relievers know what to expect.'}
          </p>
          <div className="space-y-4">
            <label className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors">
              <input
                type="checkbox"
                checked={lfActive}
                onChange={(e) => setLfActive(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">Make my listing visible</p>
                <p className="text-xs text-slate-500 mt-0.5">When on, other users can find you in the Listings tab.</p>
              </div>
            </label>

            {profile?.account_type === 'solo' ? (
              <>
                <Field label="Expected rate per day" value={lfRateAmount} onChange={setLfRateAmount} placeholder="e.g. $150/day or Negotiable" />
                <Field label="Cities you\u2019re willing to run" value={lfWillingCities} onChange={setLfWillingCities} placeholder="e.g. Austin, Round Rock, Cedar Park" />
              </>
            ) : (
              <>
                <Field label="Route size / pull-up" value={lfRouteSize} onChange={setLfRouteSize} placeholder="e.g. ~80 cases, 12 stops" />
                <Field label="Route location" value={lfRouteLocation} onChange={setLfRouteLocation} placeholder="e.g. North Austin & Pflugerville" />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Pricing</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLfPricingType('fixed')}
                      className={`flex-1 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        lfPricingType === 'fixed' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-400 bg-white hover:bg-slate-50'
                      }`}
                    >Fixed price</button>
                    <button
                      type="button"
                      onClick={() => setLfPricingType('negotiable')}
                      className={`flex-1 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        lfPricingType === 'negotiable' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-400 bg-white hover:bg-slate-50'
                      }`}
                    >Negotiable</button>
                  </div>
                </div>
                {lfPricingType === 'fixed' && (
                  <Field label="Price amount" value={lfRateAmount} onChange={setLfRateAmount} placeholder="e.g. $150/day" />
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Other pertinent info</label>
              <textarea
                value={lfDescription}
                onChange={(e) => setLfDescription(e.target.value.slice(0, 1000))}
                rows={4}
                placeholder="Anything else a reliever or owner should know?"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none text-sm text-slate-900 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{lfDescription.length}/1000</p>
            </div>
          </div>
          {errorMsg && <ErrorBox msg={errorMsg} />}
          <ModalActions
            onCancel={() => setShowEditListing(false)}
            onSave={saveListing}
            saving={saving}
            saveLabel="Save listing"
            disabled={false}
          />
        </Modal>
      )}

      <FeedbackButton pageContext="matchmaker" />
    </div>
  );
}

function ListingCard({ listing }: { listing: ProfileListing }) {
  const isOwner = listing.account_type !== 'solo';
  const name = listing.full_name ?? listing.company ?? 'Unknown';
  const location = listing.city ? `${listing.city}${listing.state ? `, ${listing.state}` : ''}` : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isOwner ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {isOwner ? <Building2 className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 truncate">{name}</h3>
            <p className="text-xs text-slate-500">
              {isOwner ? 'Route owner' : 'Reliever'}{listing.company ? ` · ${listing.company}` : ''}
            </p>
          </div>
        </div>
        {listing.avg_rating !== null && (
          <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
            <Star className="w-3.5 h-3.5" fill="currentColor" />
            {listing.avg_rating!.toFixed(1)}
            <span className="text-slate-400 font-normal">({listing.review_count})</span>
          </div>
        )}
      </div>

      {location && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="w-3.5 h-3.5" />
          <span>{location}</span>
        </div>
      )}

      {isOwner ? (
        <div className="space-y-2">
          {listing.listing_route_size && (
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <Package className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <span>{listing.listing_route_size}</span>
            </div>
          )}
          {listing.listing_route_location && (
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <span>{listing.listing_route_location}</span>
            </div>
          )}
          {listing.listing_rate_amount && (
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <HandCoins className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <span>
                {listing.listing_pricing_type === 'negotiable' ? 'Negotiable' : 'Fixed'}: {listing.listing_rate_amount}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {listing.listing_rate_amount && (
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <HandCoins className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <span>Rate: {listing.listing_rate_amount}</span>
            </div>
          )}
          {listing.listing_willing_cities && (
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <span>Willing to run: {listing.listing_willing_cities}</span>
            </div>
          )}
        </div>
      )}

      {listing.listing_description && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="flex items-start gap-2">
            <ClipboardList className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{listing.listing_description}</p>
          </div>
        </div>
      )}

      {listing.phone && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1 border-t border-slate-100">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{listing.phone}</span>
        </div>
      )}
    </div>
  );
}

function GigCard({
  gig, userId, onClaim, onComplete, onCancel, onReview,
}: {
  gig: GigWithProfiles;
  userId: string;
  onClaim: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onReview: () => void;
}) {
  const isPoster = gig.posted_by === userId;
  const isClaimer = gig.claimed_by === userId;
  const isParticipant = isPoster || isClaimer;
  const canClaim = !isPoster && gig.status === 'open';
  const canComplete = isParticipant && gig.status === 'claimed';
  const canReview = isParticipant && gig.status === 'completed' && !gig.my_rating;
  const hasReviewed = !!gig.my_rating;
  const todayStr = new Date().toISOString().split('T')[0];
  const isPast = gig.gig_date < todayStr;

  const statusStyles: Record<string, string> = {
    open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    claimed: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-slate-100 text-slate-600 border-slate-200',
    cancelled: 'bg-red-50 text-red-600 border-red-200',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 truncate">{gig.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Posted by {gig.poster_name}
            {gig.claimer_name && ` · Claimed by ${gig.claimer_name}`}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${statusStyles[gig.status]}`}>
          {gig.status.charAt(0).toUpperCase() + gig.status.slice(1)}
        </span>
      </div>

      {gig.description && (
        <p className="text-sm text-slate-600">{gig.description}</p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>{new Date(`${gig.gig_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
        {gig.pay_rate && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            <span>{gig.pay_rate}</span>
          </div>
        )}
        {gig.city && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            <span>{gig.city}{gig.state ? `, ${gig.state}` : ''}</span>
          </div>
        )}
        {gig.company && (
          <div className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" />
            <span>{gig.company}</span>
          </div>
        )}
      </div>

      {(gig.my_rating || gig.their_rating) && (
        <div className="flex items-center gap-3 pt-1">
          {gig.my_rating && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span>Your review:</span>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`w-3.5 h-3.5 ${n <= gig.my_rating! ? 'text-amber-500' : 'text-slate-200'}`} fill={n <= gig.my_rating! ? 'currentColor' : 'none'} />
                ))}
              </div>
            </div>
          )}
          {gig.their_rating && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span>Their review:</span>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`w-3.5 h-3.5 ${n <= gig.their_rating! ? 'text-amber-500' : 'text-slate-200'}`} fill={n <= gig.their_rating! ? 'currentColor' : 'none'} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {canClaim && (
          <button onClick={onClaim} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors">
            <CheckCircle2 className="w-4 h-4" /> Claim gig
          </button>
        )}
        {canComplete && (
          <button onClick={onComplete} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
            <CheckCircle2 className="w-4 h-4" /> Mark completed
          </button>
        )}
        {canReview && (
          <button onClick={onReview} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-700 text-sm font-semibold transition-colors">
            <Star className="w-4 h-4" /> Leave review
          </button>
        )}
        {hasReviewed && gig.status === 'completed' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-emerald-600">
            <CheckCircle2 className="w-4 h-4" /> Reviewed
          </span>
        )}
        {isPoster && gig.status === 'open' && !isPast && (
          <button onClick={onCancel} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:text-red-500 text-sm font-semibold transition-colors">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone: 'amber' | 'emerald' | 'blue' | 'slate' }) {
  const tones = {
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-100 text-slate-600',
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

function FilterTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
        active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
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
        className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none text-sm text-slate-900"
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
        className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold disabled:opacity-50"
      >
        {saving ? 'Saving...' : saveLabel}
      </button>
    </div>
  );
}
