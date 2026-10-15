import { useState, useEffect, useCallback } from 'react';
import { supabase, type Group, type GroupMember, MEMBER_COLORS, getColorClasses, GROUP_AVATAR_OPTIONS, GROUP_ACCENT_COLORS, getGroupAccent } from '@/lib/supabase';
import { Users, Plus, UserPlus, X, Copy, Check, Trash2, ArrowLeft, Search, Palette, Check as CheckIcon } from 'lucide-react';
import { RoleBadge } from '@/components/RoleBadge';
import { LeaderBadge } from '@/components/LeaderBadge';

type Props = {
  userId: string;
  profile: any;
  onGroupChanged: () => void;
  onBack: () => void;
  onFindGroup?: () => void;
};

export function GroupManager({ userId, profile, onGroupChanged, onBack, onFindGroup }: Props) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadGroup = useCallback(async () => {
    setLoading(true);
    const { data: prof } = await supabase
      .from('profiles')
      .select('group_id')
      .eq('id', userId)
      .maybeSingle();

    const groupId = (prof as any)?.group_id;
    if (!groupId) {
      setGroup(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    const [groupRes, membersRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).maybeSingle(),
      supabase.from('group_members').select('*').eq('group_id', groupId).order('joined_at', { ascending: true }),
    ]);

    setGroup(groupRes.data as Group | null);
    setMembers((membersRes.data as GroupMember[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  function handleCopied() {
    navigator.clipboard.writeText(group?.join_code ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLeaveGroup() {
    if (!group) return;
    await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', userId);
    await supabase.from('profiles').update({ group_id: null }).eq('id', userId);
    setGroup(null);
    setMembers([]);
    onGroupChanged();
  }

  async function handleRemoveMember(memberId: string, memberUserId: string) {
    await supabase.from('group_members').delete().eq('id', memberId);
    await supabase.from('profiles').update({ group_id: null }).eq('id', memberUserId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-slate-900">My Group</h2>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 mx-auto">
            <Users className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">You're not in a group yet</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
            Create a new group for your area, join an existing group with a join code from your group leader, or find other DSD route owners near you who are also looking to form a group.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create a Group
            </button>
            <button
              onClick={() => setShowJoin(true)}
              className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Join with Code
            </button>
            <button
              onClick={() => onFindGroup?.()}
              className="inline-flex items-center justify-center gap-1.5 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              <Search className="w-4 h-4" />
              Find a Group
            </button>
          </div>
        </div>

        {showCreate && (
          <CreateGroupModal
            userId={userId}
            profile={profile}
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              loadGroup();
              onGroupChanged();
            }}
          />
        )}
        {showJoin && (
          <JoinGroupModal
            userId={userId}
            profile={profile}
            onClose={() => setShowJoin(false)}
            onJoined={() => {
              setShowJoin(false);
              loadGroup();
              onGroupChanged();
            }}
          />
        )}
      </div>
    );
  }

  const isLeader = group.created_by === userId;
  const accent = getGroupAccent(group.accent_color);
  const avatar = group.avatar_emoji || '👥';

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{avatar}</span>
            <h2 className="text-xl font-bold text-slate-900">Group {group.name}</h2>
          </div>
          <p className="text-sm text-slate-500">
            {group.city ? `${group.city}${group.state ? `, ${group.state}` : ''}` : 'Location not set'} · {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Join code card with accent gradient */}
      <div className={`bg-gradient-to-br ${accent.gradient} rounded-2xl p-5 mb-6`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1">Join Code</p>
            <p className="text-2xl font-bold text-white tracking-wider">{group.join_code}</p>
          </div>
          <button
            onClick={handleCopied}
            className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-white/70 mt-3">
          Share this code with vendors in your area so they can join your group.
        </p>
      </div>

      {/* Group Appearance — leader only */}
      {isLeader && (
        <GroupAppearanceCard group={group} onUpdated={loadGroup} />
      )}

      {/* Member list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Members</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {members.map((member) => {
            const color = getColorClasses(member.color);
            const isMe = member.user_id === userId;
            return (
              <div key={member.id} className="flex items-center gap-3 p-4">
                <div className={`w-10 h-10 rounded-xl ${color.bg} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white font-bold text-sm">
                    {member.display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 text-sm truncate">{member.display_name}</p>
                    <RoleBadge role={member.role} />
                    {group.created_by === member.user_id && <LeaderBadge />}
                  </div>
                  <p className="text-xs text-slate-400 capitalize">{member.color}</p>
                </div>
                {isMe && (
                  <button
                    onClick={handleLeaveGroup}
                    className="text-xs text-slate-400 hover:text-red-500 font-medium transition-colors"
                  >
                    Leave
                  </button>
                )}
                {isLeader && !isMe && (
                  <button
                    onClick={() => handleRemoveMember(member.id, member.user_id)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Color legend */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-900 mb-3">Color Legend</h3>
        <div className="flex flex-wrap gap-3">
          {members.map((member) => {
            const color = getColorClasses(member.color);
            return (
              <div key={member.id} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${color.bg}`} />
                <span className="text-sm text-slate-600">{member.display_name}</span>
                <RoleBadge role={member.role} />
                {group.created_by === member.user_id && <LeaderBadge />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GroupAppearanceCard({ group, onUpdated }: { group: Group; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [emoji, setEmoji] = useState(group.avatar_emoji || '👥');
  const [accentColor, setAccentColor] = useState(group.accent_color || 'emerald');
  const [saving, setSaving] = useState(false);

  const accent = getGroupAccent(accentColor);

  async function handleSave() {
    setSaving(true);
    await supabase
      .from('groups')
      .update({ avatar_emoji: emoji, accent_color: accentColor })
      .eq('id', group.id);
    setSaving(false);
    setEditing(false);
    onUpdated();
  }

  if (!editing) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-slate-400" />
            <h3 className="font-bold text-slate-900">Group Appearance</h3>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            Customize
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${accent.gradient} flex items-center justify-center text-2xl shadow-sm`}>
            {emoji}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">Avatar: {emoji}</p>
            <p className="text-sm text-slate-500">Accent: {accent.label}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-slate-400" />
          <h3 className="font-bold text-slate-900">Customize Group Appearance</h3>
        </div>
        <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preview */}
      <div className="flex items-center gap-4 mb-5">
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${accent.gradient} flex items-center justify-center text-3xl shadow-md transition-all`}>
          {emoji}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">Live Preview</p>
          <p className="text-xs text-slate-400">This is how your group avatar looks to members</p>
        </div>
      </div>

      {/* Avatar picker */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">Choose an Avatar</label>
        <div className="grid grid-cols-8 gap-2">
          {GROUP_AVATAR_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setEmoji(opt)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                emoji === opt
                  ? 'bg-slate-900 ring-2 ring-slate-900 scale-105'
                  : 'bg-slate-50 hover:bg-slate-100'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Accent color picker */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">Choose an Accent Color</label>
        <div className="flex flex-wrap gap-2">
          {GROUP_ACCENT_COLORS.map((c) => (
            <button
              key={c.name}
              onClick={() => setAccentColor(c.name)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                accentColor === c.name
                  ? 'border-slate-900 ring-2 ring-slate-900/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-lg ${c.bg}`} />
              <span className="text-sm font-medium text-slate-700">{c.label}</span>
              {accentColor === c.name && <CheckIcon className="w-4 h-4 text-slate-900" />}
            </button>
          ))}
        </div>
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-3">
        <button
          onClick={() => setEditing(false)}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-50 text-sm"
        >
          {saving ? 'Saving...' : 'Save Appearance'}
        </button>
      </div>
    </div>
  );
}

function CreateGroupModal({
  userId,
  profile,
  onClose,
  onCreated,
}: {
  userId: string;
  profile: any;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [city, setCity] = useState(profile?.city ?? '');
  const [state, setState] = useState(profile?.state ?? '');
  const [isReliever, setIsReliever] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    if (!state || state.length !== 2) {
      setError('Please enter a valid 2-letter state code.');
      setCreating(false);
      return;
    }

    const stateUpper = state.toUpperCase();

    // Find the next group number for this state
    const { data: existingGroups } = await supabase
      .from('groups')
      .select('name')
      .like('name', `${stateUpper}%`)
      .order('name', { ascending: true });

    const prefix = stateUpper;
    let nextNum = 1;
    if (existingGroups && existingGroups.length > 0) {
      const numbers = existingGroups
        .map((g: any) => {
          const match = g.name.match(new RegExp(`^${prefix}(\\d+)$`));
          return match ? parseInt(match[1]) : 0;
        })
        .filter((n: number) => n > 0);
      if (numbers.length > 0) {
        nextNum = Math.max(...numbers) + 1;
      }
    }
    const groupName = `${prefix}${String(nextNum).padStart(2, '0')}`;

    // Generate a random join code
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: newGroup, error: groupError } = await supabase
      .from('groups')
      .insert({
        name: groupName,
        city,
        state: stateUpper,
        join_code: joinCode,
        created_by: userId,
      })
      .select()
      .single();

    if (groupError) {
      setError(groupError.message);
      setCreating(false);
      return;
    }

    // Add creator as first member
    const displayName = profile?.full_name || 'Group Leader';
    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: newGroup.id,
      user_id: userId,
      display_name: displayName,
      color: MEMBER_COLORS[0].name,
      role: isReliever ? 'reliever' : 'owner',
    });

    if (memberError) {
      setError(memberError.message);
      setCreating(false);
      return;
    }

    // Update profile with group_id
    await supabase.from('profiles').update({ group_id: newGroup.id }).eq('id', userId);

    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Plus className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Create a Group</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <p className="text-sm text-emerald-700">
              Your group will be auto-named based on your state (e.g. LA01 for the first group in Louisiana, CA01 for California). You can customize your group's avatar and accent color after creating it.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Hammond"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">State (2-letter) *</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
              required
              maxLength={2}
              placeholder="e.g. LA"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900"
            />
            <p className="text-xs text-slate-400 mt-1">This determines your group name (e.g. LA01).</p>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={isReliever}
              onChange={(e) => setIsReliever(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-600"
            />
            <div>
              <p className="text-sm font-medium text-slate-700">I am the reliever for this group</p>
              <p className="text-xs text-slate-400">Check this if you'll be the full-time reliever covering routes.</p>
            </div>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={creating} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-50">
              {creating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function JoinGroupModal({
  userId,
  profile,
  onClose,
  onJoined,
}: {
  userId: string;
  profile: any;
  onClose: () => void;
  onJoined: () => void;
}) {
  const [code, setCode] = useState('');
  const [isReliever, setIsReliever] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    setError(null);

    const { data: foundGroup, error: findError } = await supabase
      .from('groups')
      .select('*')
      .eq('join_code', code.toUpperCase())
      .maybeSingle();

    if (findError || !foundGroup) {
      setError('No group found with that code. Please check and try again.');
      setJoining(false);
      return;
    }

    // Check how many members already exist to assign next color
    const { data: existingMembers } = await supabase
      .from('group_members')
      .select('color')
      .eq('group_id', foundGroup.id);

    const usedColors = new Set((existingMembers ?? []).map((m: any) => m.color));
    const nextColor = MEMBER_COLORS.find((c) => !usedColors.has(c.name)) ?? MEMBER_COLORS[0];

    const displayName = profile?.full_name || 'Member';
    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: foundGroup.id,
      user_id: userId,
      display_name: displayName,
      color: nextColor.name,
      role: isReliever ? 'reliever' : 'owner',
    });

    if (memberError) {
      if (memberError.message.includes('duplicate')) {
        setError('You are already a member of this group.');
      } else {
        setError(memberError.message);
      }
      setJoining(false);
      return;
    }

    await supabase.from('profiles').update({ group_id: foundGroup.id }).eq('id', userId);
    onJoined();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Join a Group</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleJoin} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Join Code *</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              maxLength={6}
              placeholder="e.g. AB3X9Z"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900 tracking-wider uppercase"
            />
            <p className="text-xs text-slate-400 mt-1">Get this code from your group leader.</p>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={isReliever}
              onChange={(e) => setIsReliever(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-600"
            />
            <div>
              <p className="text-sm font-medium text-slate-700">I am the reliever for this group</p>
              <p className="text-xs text-slate-400">Check this if you'll be the full-time reliever covering routes.</p>
            </div>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={joining} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-50">
              {joining ? 'Joining...' : 'Join Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
