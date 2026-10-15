import { useState } from 'react';
import { MessageSquareText, X, Send, CheckCircle2, Bug, Lightbulb, Heart, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Category = 'bug' | 'feature' | 'general' | 'praise';

const CATEGORIES: { value: Category; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'bug', label: 'Bug report', icon: <Bug className="w-4 h-4" />, color: 'text-red-600 bg-red-50 border-red-200' },
  { value: 'feature', label: 'Feature idea', icon: <Lightbulb className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'general', label: 'General', icon: <MessageCircle className="w-4 h-4" />, color: 'text-slate-600 bg-slate-50 border-slate-200' },
  { value: 'praise', label: 'Love it!', icon: <Heart className="w-4 h-4" />, color: 'text-pink-600 bg-pink-50 border-pink-200' },
];

export function FeedbackButton({ pageContext }: { pageContext?: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase.from('developer_feedback').insert({
      category,
      message: message.trim(),
      page_context: pageContext ?? null,
    });
    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    setSubmitting(false);
    setMessage('');
    setCategory('general');
    window.setTimeout(() => {
      setSubmitted(false);
      setOpen(false);
    }, 2000);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-lg shadow-slate-900/20 transition-all hover:scale-105 active:scale-95"
        title="Send feedback to the developer"
      >
        <MessageSquareText className="w-5 h-5" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
            {submitted ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Thank you!</h3>
                <p className="text-sm text-slate-500 mt-1">Your feedback has been sent to the developer.</p>
              </div>
            ) : (
              <>
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Send Feedback</h2>
                    <p className="text-xs text-slate-500">Help us make VacationDSD better</p>
                  </div>
                  <button onClick={() => setOpen(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">What kind of feedback?</label>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setCategory(cat.value)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                            category === cat.value
                              ? cat.color
                              : 'border-slate-200 text-slate-400 bg-white hover:bg-slate-50'
                          }`}
                        >
                          {cat.icon}
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Your message</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                      rows={5}
                      required
                      placeholder="Tell us what's on your mind — what's working, what's broken, or what you'd love to see next..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm text-slate-900 resize-none"
                    />
                    <p className="text-xs text-slate-400 mt-1 text-right">{message.length}/2000</p>
                  </div>
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
                  )}
                  <button
                    type="submit"
                    disabled={!message.trim() || submitting}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? 'Sending...' : 'Send feedback'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
