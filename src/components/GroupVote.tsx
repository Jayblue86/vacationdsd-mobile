import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type Group, type GroupMember, type GroupVote, type GroupVoteResponse } from '@/lib/supabase';
import { Vote, Plus, X, ThumbsUp, ThumbsDown, Check, Clock, Trash2, ArrowLeft, UserCheck, UserX, Timer } from 'lucide-react';

type Props = {
  userId: string;
  group: Group;
  members: GroupMember[];
  isLeader: boolean;
  onBack: () => void;
};

type DeadlineOption = 'none' | '1h' | '6h' | '24h' | '48h' | '7d';

const DEADLINE_LABELS: Record<DeadlineOption, string> = {
  none: 'No deadline',
  '1h': '1 hour',
  '6h': '6 hours',
  '24h': '24 hours',
  '48h': '2 days',
  '7d': '7 days',
};

function deadlineFromNow(opt: DeadlineOption): string | null {
  if (opt === 'none') return null;
  const hours: Record<DeadlineOption, number> = { none: 0, '1h': 1, '6h': 6, '24h': 24, '48h': 48, '7d': 168 };
  return new Date(Date.now() + hours[opt] * 3600000).toISOString();
}

function formatDeadlineRemaining(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'Deadline passed';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function GroupVote({ userId, group, members, isLeader, onBack }: Props) {
  const [votes, setVotes] = useState<GroupVote[]>([]);
  const [myResponses, setMyResponses] = useState<Record<string, 'yes' | 'no'>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [includeRelievers, setIncludeRelievers] = useState(true);
  const [deadlineOption, setDeadlineOption] = useState<DeadlineOption>('none');
  const [creating, setCreating] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);
  const voteIdsRef = useRef<string[]>([]);

  const loadVotes = useCallback(async () => {
    const [votesRes, responsesRes] = await Promise.all([
      supabase
        .from('group_votes')
        .select('*')
        .eq('group_id', group.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('group_vote_responses')
        .select('*')
        .in('vote_id', (await supabase.from('group_votes').select('id').eq('group_id', group.id)).data?.map((v) => v.id) ?? []),
    ]);

    const voteList = (votesRes.data as GroupVote[]) ?? [];
    setVotes(voteList);
    voteIdsRef.current = voteList.map((v) => v.id);

    const responseMap: Record<string, 'yes' | 'no'> = {};
    ((responsesRes.data as GroupVoteResponse[]) ?? []).forEach((r) => {
      responseMap[r.vote_id] = r.vote;
    });
    setMyResponses(responseMap);
    setLoading(false);

    // Auto-close any open votes whose deadline has passed
    const expired = voteList.filter((v) => v.status === 'open' && v.deadline && new Date(v.deadline) < new Date());
    for (const v of expired) {
      const { data: res } = await supabase.from('group_vote_responses').select('vote').eq('vote_id', v.id);
      const yesCount = (res ?? []).filter((r: { vote: string }) => r.vote === 'yes').length;
      const noCount = (res ?? []).filter((r: { vote: string }) => r.vote === 'no').length;
      await supabase.from('group_votes').update({ status: 'closed', yes_count: yesCount, no_count: noCount, closed_at: new Date().toISOString() }).eq('id', v.id);
    }
    if (expired.length > 0) {
      const [reVotes, reResponses] = await Promise.all([
        supabase.from('group_votes').select('*').eq('group_id', group.id).order('created_at', { ascending: false }),
        supabase.from('group_vote_responses').select('*').in('vote_id', voteIdsRef.current),
      ]);
      setVotes((reVotes.data as GroupVote[]) ?? []);
      const rm: Record<string, 'yes' | 'no'> = {};
      ((reResponses.data as GroupVoteResponse[]) ?? []).forEach((r) => { rm[r.vote_id] = r.vote; });
      setMyResponses(rm);
    }
  }, [group.id]);

  useEffect(() => {
    setLoading(true);
    loadVotes();
  }, [loadVotes]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('group_votes_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_votes', filter: `group_id=eq.${group.id}` }, () => {
        loadVotes();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_vote_responses' }, () => {
        loadVotes();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [group.id, loadVotes]);

  async function handleCreateVote() {
    if (!newQuestion.trim()) return;
    setCreating(true);
    const deadline = deadlineFromNow(deadlineOption);
    const { data } = await supabase
      .from('group_votes')
      .insert({
        group_id: group.id,
        created_by: userId,
        question: newQuestion.trim(),
        total_members: includeRelievers ? members.length : members.filter((m) => m.role !== 'reliever').length,
        include_relievers: includeRelievers,
        deadline,
      })
      .select()
      .single();
    if (data) {
      setNewQuestion('');
      setIncludeRelievers(true);
      setDeadlineOption('none');
      setShowCreate(false);
      await loadVotes();
    }
    setCreating(false);
  }

  async function handleVote(voteId: string, choice: 'yes' | 'no') {
    setVoting(voteId);
    await supabase
      .from('group_vote_responses')
      .insert({ vote_id: voteId, user_id: userId, vote: choice });

    const { data: allResponses } = await supabase
      .from('group_vote_responses')
      .select('vote')
      .eq('vote_id', voteId);

    const responses = allResponses ?? [];
    const voteRow = votes.find((v) => v.id === voteId);
    const yesCount = responses.filter((r: { vote: string }) => r.vote === 'yes').length;
    const noCount = responses.filter((r: { vote: string }) => r.vote === 'no').length;

    if (voteRow && responses.length >= voteRow.total_members) {
      await supabase
        .from('group_votes')
        .update({ status: 'closed', yes_count: yesCount, no_count: noCount, closed_at: new Date().toISOString() })
        .eq('id', voteId);
    } else {
      await supabase
        .from('group_votes')
        .update({ yes_count: yesCount, no_count: noCount })
        .eq('id', voteId);
    }

    await loadVotes();
    setVoting(null);
  }

  async function handleDeleteVote(voteId: string) {
    await supabase.from('group_votes').delete().eq('id', voteId);
    await loadVotes();
  }

  const currentUser = members.find((m) => m.user_id === userId);
  const isReliever = currentUser?.role === 'reliever';
  const visibleVotes = votes.filter((v) => v.include_relievers || !isReliever);
  const activeVotes = visibleVotes.filter((v) => v.status === 'open');
  const closedVotes = visibleVotes.filter((v) => v.status === 'closed');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Group Vote</h2>
            <p className="text-sm text-slate-500">Leader polls with anonymous yes/no results</p>
          </div>
        </div>
        {isLeader && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Vote
          </button>
        )}
      </div>

      {/* Create vote modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Create a Vote</h3>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-3">
              Write a question or note for the group. Members can only vote yes or no. Results stay hidden until everyone has voted or the deadline passes.
            </p>
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="e.g. Should we change the draft order for next year?"
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900 text-sm resize-none"
              autoFocus
            />
            <div className="mt-3">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Relievers</label>
              <div className="flex gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setIncludeRelievers(true)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    includeRelievers
                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-700'
                      : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  Include
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeRelievers(false)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    !includeRelievers
                      ? 'bg-slate-100 border border-slate-400 text-slate-700'
                      : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <UserX className="w-4 h-4" />
                  Exclude
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {includeRelievers
                  ? 'Relievers can see and vote on this poll.'
                  : 'Relievers will not see this poll at all.'}
              </p>
            </div>
            <div className="mt-3">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Timer className="w-3.5 h-3.5" />
                Deadline
              </label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(['none', '1h', '6h', '24h', '48h', '7d'] as DeadlineOption[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDeadlineOption(opt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      deadlineOption === opt
                        ? 'bg-blue-50 border border-blue-300 text-blue-700'
                        : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {DEADLINE_LABELS[opt]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {deadlineOption === 'none'
                  ? 'Vote stays open until all members respond.'
                  : `Vote auto-closes after ${DEADLINE_LABELS[deadlineOption]} even if not everyone votes.`}
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVote}
                disabled={!newQuestion.trim() || creating}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Send Vote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : visibleVotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Vote className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No votes yet</h3>
          <p className="text-sm text-slate-500">
            {isLeader ? 'Create a vote to get the group\'s opinion on a decision.' : 'No active votes from your group leader.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeVotes.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Active ({activeVotes.length})
              </h3>
              <div className="space-y-4">
                {activeVotes.map((vote) => (
                  <VoteCard
                    key={vote.id}
                    vote={vote}
                    myVote={myResponses[vote.id]}
                    isLeader={isLeader}
                    voting={voting === vote.id}
                    onVote={handleVote}
                    onDelete={handleDeleteVote}
                  />
                ))}
              </div>
            </div>
          )}

          {closedVotes.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Completed ({closedVotes.length})
              </h3>
              <div className="space-y-4">
                {closedVotes.map((vote) => (
                  <VoteCard
                    key={vote.id}
                    vote={vote}
                    myVote={myResponses[vote.id]}
                    isLeader={isLeader}
                    voting={false}
                    onVote={handleVote}
                    onDelete={handleDeleteVote}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VoteCard({
  vote,
  myVote,
  isLeader,
  voting,
  onVote,
  onDelete,
}: {
  vote: GroupVote;
  myVote: 'yes' | 'no' | undefined;
  isLeader: boolean;
  voting: boolean;
  onVote: (voteId: string, choice: 'yes' | 'no') => void;
  onDelete: (voteId: string) => void;
}) {
  const isOpen = vote.status === 'open';
  const totalVotes = vote.yes_count + vote.no_count;
  const hasVoted = myVote !== undefined;
  const hasDeadline = !!vote.deadline;

  return (
    <div className={`bg-white rounded-2xl border p-5 transition-all ${isOpen ? 'border-slate-200 shadow-sm' : 'border-slate-200 opacity-90'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isOpen ? 'bg-blue-50' : 'bg-slate-100'}`}>
            <Vote className={`w-5 h-5 ${isOpen ? 'text-blue-500' : 'text-slate-400'}`} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900 leading-snug">{vote.question}</p>
            <div className="flex items-center flex-wrap gap-2 mt-1">
              <p className="text-xs text-slate-400">
                {new Date(vote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              {isLeader && !vote.include_relievers && (
                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <UserX className="w-2.5 h-2.5" />
                  Relievers excluded
                </span>
              )}
              {isOpen && hasDeadline && (
                <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <Timer className="w-2.5 h-2.5" />
                  {formatDeadlineRemaining(vote.deadline!)}
                </span>
              )}
            </div>
          </div>
        </div>
        {isLeader && (
          <button
            onClick={() => onDelete(vote.id)}
            className="text-slate-300 hover:text-red-500 transition-colors p-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen ? (
        hasVoted ? (
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Check className="w-4 h-4 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-700">
                You voted {myVote === 'yes' ? 'Yes' : 'No'}
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Waiting for all members to vote ({totalVotes}/{vote.total_members} in)
              {hasDeadline && ` or ${formatDeadlineRemaining(vote.deadline!)}`}
            </p>
            <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all"
                style={{ width: `${vote.total_members > 0 ? (totalVotes / vote.total_members) * 100 : 0}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => onVote(vote.id, 'yes')}
              disabled={voting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-bold transition-colors disabled:opacity-50"
            >
              <ThumbsUp className="w-4 h-4" />
              Yes
            </button>
            <button
              onClick={() => onVote(vote.id, 'no')}
              disabled={voting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-sm font-bold transition-colors disabled:opacity-50"
            >
              <ThumbsDown className="w-4 h-4" />
              No
            </button>
          </div>
        )
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Result</span>
            <span className="text-xs text-slate-400">({vote.total_members} members)</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 w-16">
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-sm font-semibold text-slate-700">Yes</span>
              </div>
              <div className="flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden relative">
                <div
                  className="h-full bg-emerald-400 rounded-lg transition-all flex items-center justify-end pr-2"
                  style={{ width: `${vote.total_members > 0 ? (vote.yes_count / vote.total_members) * 100 : 0}%` }}
                >
                  {vote.yes_count > 0 && (
                    <span className="text-xs font-bold text-white">{vote.yes_count}</span>
                  )}
                </div>
                {vote.yes_count === 0 && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">0</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 w-16">
                <ThumbsDown className="w-3.5 h-3.5 text-red-500" />
                <span className="text-sm font-semibold text-slate-700">No</span>
              </div>
              <div className="flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden relative">
                <div
                  className="h-full bg-red-400 rounded-lg transition-all flex items-center justify-end pr-2"
                  style={{ width: `${vote.total_members > 0 ? (vote.no_count / vote.total_members) * 100 : 0}%` }}
                >
                  {vote.no_count > 0 && (
                    <span className="text-xs font-bold text-white">{vote.no_count}</span>
                  )}
                </div>
                {vote.no_count === 0 && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">0</span>
                )}
              </div>
            </div>
          </div>
          {hasVoted && (
            <p className="text-xs text-slate-400 mt-3 text-center">You voted {myVote === 'yes' ? 'Yes' : 'No'}</p>
          )}
        </div>
      )}
    </div>
  );
}
