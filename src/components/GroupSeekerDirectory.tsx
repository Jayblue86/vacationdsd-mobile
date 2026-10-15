import { useState, useEffect, useCallback } from 'react';
import { supabase, type Profile, type GroupSeeker } from '@/lib/supabase';
import { ArrowLeft, MapPin, Phone, Route, Search, ToggleLeft, ToggleRight, Users, MessageCircle, Lightbulb, Building2, Share2, Check } from 'lucide-react';

type Props = {
  profile: Profile;
  onBack: () => void;
  onProfileChanged: () => Promise<void>;
};

export function GroupSeekerDirectory({ profile, onBack, onProfileChanged }: Props) {
  const [seekers, setSeekers] = useState<GroupSeeker[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeking, setSeeking] = useState(profile.seeking_group);
  const [toggling, setToggling] = useState(false);
  const [shared, setShared] = useState(false);

  async function handleShare() {
    const shareData = {
      title: 'VacationDSD',
      text: 'Join me on VacationDSD — DSD route owners in our area can coordinate vacation coverage and find relief drivers.',
      url: window.location.origin,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    }
  }

  const loadSeekers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('find_group_seekers', {
      p_state: profile.state,
      p_city: profile.city,
    });
    if (!error && data) {
      setSeekers(data as GroupSeeker[]);
    }
    setLoading(false);
  }, [profile.state, profile.city]);

  useEffect(() => {
    loadSeekers();
  }, [loadSeekers]);

  async function toggleSeeking() {
    setToggling(true);
    const newValue = !seeking;
    setSeeking(newValue);
    await supabase.from('profiles').update({ seeking_group: newValue }).eq('id', profile.id);
    await onProfileChanged();
    setToggling(false);
  }

  const sameCitySeekers = seekers.filter((s) => s.city && profile.city && s.city.toLowerCase() === profile.city.toLowerCase());
  const sameStateSeekers = seekers.filter((s) => !sameCitySeekers.includes(s));
  const hasSeekers = seekers.length > 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Find a Group</h2>
          <p className="text-sm text-slate-500">Connect with other DSD route owners near you</p>
        </div>
      </div>

      {/* Opt-in toggle */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4">
        <button
          onClick={handleShare}
          className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          {shared ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          {shared ? 'Link copied!' : 'Share this app to recruit'}
        </button>
      </div>

      {/* Opt-in toggle */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 text-sm mb-1">Let others find you</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              When enabled, your name, company, route, and phone number appear in this directory for other DSD professionals in {profile.state ?? 'your state'} who are also looking to form or join a group.
            </p>
          </div>
          <button
            onClick={toggleSeeking}
            disabled={toggling}
            className="flex-shrink-0"
          >
            {seeking ? (
              <ToggleRight className="w-12 h-12 text-emerald-500" />
            ) : (
              <ToggleLeft className="w-12 h-12 text-slate-300" />
            )}
          </button>
        </div>
        {seeking && (
          <div className="mt-3 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs font-semibold text-emerald-700">You're visible to other seekers in {profile.state ?? 'your state'}</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : hasSeekers ? (
        <>
          {sameCitySeekers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                In {profile.city ?? 'your city'} ({sameCitySeekers.length})
              </h3>
              <div className="space-y-3">
                {sameCitySeekers.map((s) => (
                  <SeekerCard key={s.id} seeker={s} highlight />
                ))}
              </div>
            </div>
          )}

          {sameStateSeekers.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Elsewhere in {profile.state ?? 'your state'} ({sameStateSeekers.length})
              </h3>
              <div className="space-y-3">
                {sameStateSeekers.map((s) => (
                  <SeekerCard key={s.id} seeker={s} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <NoSeekersFound profile={profile} />
      )}
    </div>
  );
}

function SeekerCard({ seeker, highlight }: { seeker: GroupSeeker; highlight?: boolean }) {
  const initials = seeker.full_name.split(' ').map((n) => n.charAt(0)).join('').slice(0, 2).toUpperCase();

  return (
    <div className={`bg-white rounded-2xl border p-4 transition-all ${highlight ? 'border-emerald-300 shadow-sm shadow-emerald-100' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-lg ${highlight ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-slate-900 text-sm">{seeker.full_name}</h4>
          <div className="flex items-center flex-wrap gap-2 mt-1">
            {seeker.company && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Building2 className="w-3 h-3" />
                {seeker.company}
              </span>
            )}
            {seeker.route_name && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Route className="w-3 h-3" />
                {seeker.route_name}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="w-3 h-3" />
              {seeker.city ? `${seeker.city}${seeker.state ? `, ${seeker.state}` : ''}` : 'Location not set'}
            </span>
          </div>
          {seeker.phone && (
            <a
              href={`tel:${seeker.phone}`}
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              {seeker.phone}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function NoSeekersFound({ profile }: { profile: Profile }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Search className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">No seekers nearby yet</h3>
        <p className="text-sm text-slate-500 max-w-sm">
          There aren't any other DSD route owners looking for a group in {profile.state ?? 'your state'} right now. Here's how to change that:
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          How to build your group
        </h4>
        <div className="space-y-3">
          <Tip
            number={1}
            title='Turn on "Let others find you"'
            body="Your profile becomes visible here so when other route owners sign up in your area, they can reach out to you directly."
          />
          <Tip
            number={2}
            title="Talk to neighboring route owners"
            body={`Mention VacationDSD to other ${profile.company ?? 'DSD'} route owners you see at shared stores or warehouses. Tell them they can sign up for free and coordinate vacation coverage together.`}
          />
          <Tip
            number={3}
            title="Share your state with coworkers"
            body="If you know other route owners in your state who cover different territories, send them the app link. The more people who join, the easier it is to form a group."
          />
          <Tip
            number={4}
            title="Start small"
            body="You only need 2-3 route owners to start a group. Once the draft and shared calendar are working, others will want in."
          />
        </div>
      </div>

      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white">
        <div className="flex items-start gap-3">
          <MessageCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Be the first in your area</h4>
            <p className="text-emerald-100 text-xs mt-1 leading-relaxed">
              New users in {profile.state ?? 'your state'} who sign up and turn on "Let others find you" will see your profile here and can contact you to form a group. Check back as the community grows.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tip({ number, title, body }: { number: number; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
        {number}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
