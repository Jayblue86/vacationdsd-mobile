import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase, type AccountType, MEMBER_COLORS } from '@/lib/supabase';
import { Truck, Mail, Lock, User as UserIcon, Building2, Phone, Route, MapPin, Share2, Check, KeyRound } from 'lucide-react';
import { CreatorBadge } from '@/components/CreatorBadge';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const [mode, setMode] = useState<'signin' | 'signup'>(() => inviteToken ? 'signup' : 'signin');
  const [accountType, setAccountType] = useState<AccountType>(() => inviteToken ? 'vendor' : 'group');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [routeName, setRouteName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shared, setShared] = useState(false);

  async function handleShare() {
    const shareData = {
      title: 'VacationDSD',
      text: 'Join me on VacationDSD — route management for DSD professionals. Coordinate vacation coverage and find relief drivers.',
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (mode === 'signup') {
      const { error: signUpError } = await signUp(email, password, accountType);
      if (signUpError) {
        setError(signUpError);
        setSubmitting(false);
        return;
      }
      const {
        data: { user: newUser },
      } = await supabase.auth.getUser();
      if (newUser) {
        let groupId: string | null = null;

        if (accountType === 'group' && joinCode.trim()) {
          const code = joinCode.trim().toUpperCase();
          const { data: foundGroup, error: findError } = await supabase
            .from('groups')
            .select('*')
            .eq('join_code', code)
            .maybeSingle();

          if (findError || !foundGroup) {
            setError('No group found with that join code. Check the code and try again, or leave it blank to join later.');
            setSubmitting(false);
            return;
          }

          const { data: existingMember } = await supabase
            .from('group_members')
            .select('id')
            .eq('group_id', foundGroup.id)
            .eq('user_id', newUser.id)
            .maybeSingle();

          if (existingMember) {
            groupId = foundGroup.id;
          } else {
            const { data: existingMembers } = await supabase
              .from('group_members')
              .select('color')
              .eq('group_id', foundGroup.id);
            const usedColors = new Set((existingMembers ?? []).map((m: any) => m.color));
            const nextColor = MEMBER_COLORS.find((c) => !usedColors.has(c.name)) ?? MEMBER_COLORS[0];

            const { error: memberError } = await supabase.from('group_members').insert({
              group_id: foundGroup.id,
              user_id: newUser.id,
              display_name: fullName || 'Member',
              color: nextColor.name,
              role: 'owner',
            });

            if (memberError) {
              setError(memberError.message.includes('duplicate')
                ? 'You are already a member of this group.'
                : memberError.message);
              setSubmitting(false);
              return;
            }
            groupId = foundGroup.id;
          }
        }

        await supabase.from('profiles').upsert({
          id: newUser.id,
          full_name: fullName,
          company,
          phone,
          route_name: routeName,
          city,
          state,
          account_type: accountType,
          group_id: groupId,
        });
        if (inviteToken && accountType === 'vendor') {
          const { error: inviteError } = await supabase.rpc('accept_vendor_invite', { p_invite_token: inviteToken });
          if (inviteError) {
            setError('This invitation could not be connected to your account. Please confirm you used the invited email address.');
            setSubmitting(false);
            return;
          }
        }
      }
      navigate('/app');
    } else {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(signInError);
        setSubmitting(false);
        return;
      }
      navigate('/app');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500 mb-4 shadow-lg shadow-emerald-500/30">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">VacationDSD</h1>
          <p className="text-slate-400 mt-1 text-sm">Route management for DSD professionals</p>
        </div>
        {mode === 'signup' && !inviteToken && (
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors mb-6"
          >
            {shared ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {shared ? 'Link copied!' : 'Share this app'}
          </button>
        )}

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && !inviteToken && (
              <>
                <div>
                  <p className="text-sm font-semibold text-slate-800 mb-2">What brings you to VacationDSD?</p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setAccountType('group')}
                      className={`w-full text-left rounded-xl border p-3 transition-all ${
                        accountType === 'group' ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-slate-900">Join a vacation group</span>
                      <span className="block text-xs text-slate-500 mt-1">Coordinate vacation coverage with other route owners.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType('matchmaker')}
                      className={`w-full text-left rounded-xl border p-3 transition-all ${
                        accountType === 'matchmaker' ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-slate-900">Find temporary DSD work</span>
                      <span className="block text-xs text-slate-500 mt-1">Match with vendors or relievers for weekend gigs and last-minute coverage. Rate each other after the job.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType('multi_route')}
                      className={`w-full text-left rounded-xl border p-3 transition-all ${
                        accountType === 'multi_route' ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-slate-900">Manage multiple routes</span>
                      <span className="block text-xs text-slate-500 mt-1">Own several DSD routes? Track stores and runners across all of them in one place.</span>
                    </button>
                  </div>
                </div>
              </>
            )}
            {mode === 'signup' && inviteToken && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">You've been invited as a vendor</p>
                  <p className="text-xs text-blue-700 mt-0.5">Create your account with the email that received the invitation. You'll be connected to your reliever automatically.</p>
                </div>
              </div>
            )}
            {mode === 'signup' && (
              <>
                <InputField
                  icon={<UserIcon className="w-4 h-4" />}
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={setFullName}
                  required
                />
                <InputField
                  icon={<Building2 className="w-4 h-4" />}
                  type="text"
                  placeholder="Company (e.g. Little Debbie, Mission)"
                  value={company}
                  onChange={setCompany}
                  required
                />
                <InputField
                  icon={<Phone className="w-4 h-4" />}
                  type="tel"
                  placeholder="Phone number"
                  value={phone}
                  onChange={setPhone}
                />
                <InputField
                  icon={<Route className="w-4 h-4" />}
                  type="text"
                  placeholder="Route name/number"
                  value={routeName}
                  onChange={setRouteName}
                />
                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    icon={<MapPin className="w-4 h-4" />}
                    type="text"
                    placeholder="City"
                    value={city}
                    onChange={setCity}
                    required
                  />
                  <InputField
                    icon={<MapPin className="w-4 h-4" />}
                    type="text"
                    placeholder="State (2-letter)"
                    value={state}
                    onChange={(v) => setState(v.toUpperCase().slice(0, 2))}
                    required
                  />
                </div>
                {accountType === 'group' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Join Code (optional)</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500"><KeyRound className="w-4 h-4" /></div>
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        placeholder="e.g. AB3X9Z"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900 tracking-wider uppercase placeholder:text-slate-400"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Have a join code from your group leader? Enter it here to join their group right away.</p>
                  </div>
                )}
              </>
            )}
            <InputField
              icon={<Mail className="w-4 h-4" />}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={setEmail}
              required
            />
            <InputField
              icon={<Lock className="w-4 h-4" />}
              type="password"
              placeholder="Password"
              value={password}
              onChange={setPassword}
              required
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? 'Please wait...'
                : mode === 'signin'
                  ? 'Sign In'
                  : 'Create Account'}
            </button>
          </form>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Advertisement</p>
          <p className="text-slate-400 text-xs">Partner ad space — your brand here</p>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          DSD route vacation & handoff management
        </p>
        <p className="text-center text-slate-600 text-xs mt-3 max-w-xs mx-auto leading-relaxed">
          Built by Johnny Walker, a DSD vendor for over 15 years who just wanted to take a vacation without the headache. This is for us.
        </p>
        <div className="flex justify-center mt-5">
          <CreatorBadge variant="light" />
        </div>
      </div>
    </div>
  );
}

function InputField({
  icon,
  type,
  placeholder,
  value,
  onChange,
  required,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900 placeholder:text-slate-400"
      />
    </div>
  );
}
