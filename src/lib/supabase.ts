import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type AccountType = 'group' | 'solo' | 'vendor' | 'matchmaker' | 'multi_route';

export type Profile = {
  id: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  route_name: string | null;
  city: string | null;
  state: string | null;
  group_id: string | null;
  account_type: AccountType;
  seeking_group: boolean;
  created_at: string;
  notify_draft_reminders: boolean;
  notify_group_updates: boolean;
  notify_weekly_summary: boolean;
  listing_active: boolean;
  listing_route_size: string | null;
  listing_route_location: string | null;
  listing_pricing_type: string | null;
  listing_rate_amount: string | null;
  listing_willing_cities: string | null;
  listing_description: string | null;
};

export type ProfileListing = Profile & {
  avg_rating: number | null;
  review_count: number;
};

export type GroupSeeker = {
  id: string;
  full_name: string;
  company: string;
  route_name: string;
  city: string;
  state: string;
  phone: string;
};

export type Group = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  join_code: string;
  created_by: string;
  created_at: string;
  draft_status: string;
  draft_round: number;
  draft_current_index: number;
  draft_rounds_total: number;
  draft_scheduled_at: string | null;
  pick_time_limit_hours: number;
  auto_skip_enabled: boolean;
  draft_type: 'snake' | 'linear' | 'just_pick';
  allow_reliever_picks: boolean;
  avatar_emoji: string | null;
  accent_color: string | null;
};

export const GROUP_AVATAR_OPTIONS = [
  '👥', '🚚', '📦', '🛻', '🗺️', '⭐', '🔥', '💪',
  '🦾', '🎯', '🏁', '🛣️', '🌆', '🌊', '⚜️', '🐊',
  '🦅', '🌶️', ' bourbon', '🎺', '🏈', '🦂', '🌵', '☀️',
] as const;

export const GROUP_ACCENT_COLORS = [
  { name: 'emerald', label: 'Emerald', bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', gradient: 'from-emerald-500 to-emerald-700' },
  { name: 'blue', label: 'Blue', bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', gradient: 'from-blue-500 to-blue-700' },
  { name: 'amber', label: 'Amber', bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', gradient: 'from-amber-500 to-amber-700' },
  { name: 'rose', label: 'Rose', bg: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', gradient: 'from-rose-500 to-rose-700' },
  { name: 'cyan', label: 'Cyan', bg: 'bg-cyan-500', light: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-300', gradient: 'from-cyan-500 to-cyan-700' },
  { name: 'teal', label: 'Teal', bg: 'bg-teal-500', light: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-300', gradient: 'from-teal-500 to-teal-700' },
  { name: 'orange', label: 'Orange', bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300', gradient: 'from-orange-500 to-orange-700' },
  { name: 'slate', label: 'Slate', bg: 'bg-slate-600', light: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-300', gradient: 'from-slate-500 to-slate-700' },
] as const;

export function getGroupAccent(colorName: string | null | undefined) {
  return GROUP_ACCENT_COLORS.find((c) => c.name === colorName) ?? GROUP_ACCENT_COLORS[0];
}

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  color: string;
  role: string;
  joined_at: string;
  seniority_order: number;
  vacation_weeks_allowed: number;
};

export type GroupCalendarEntry = {
  id: string;
  group_id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  notes: string | null;
  status: string;
  created_at: string;
};

export type GroupVote = {
  id: string;
  group_id: string;
  created_by: string;
  question: string;
  status: string;
  yes_count: number;
  no_count: number;
  total_members: number;
  include_relievers: boolean;
  deadline: string | null;
  created_at: string;
  closed_at: string | null;
};

export type GroupVoteResponse = {
  id: string;
  vote_id: string;
  user_id: string;
  vote: 'yes' | 'no';
  created_at: string;
};

export type GroupTopic = {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  created_at: string;
};

export type GroupMessage = {
  id: string;
  topic_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export type DraftSchedule = {
  id: string;
  group_id: string;
  draft_date: string;
  year: number;
  reminder_1month_sent: boolean;
  reminder_1week_sent: boolean;
  reminder_1day_sent: boolean;
  created_at: string;
};

export const MEMBER_COLORS = [
  { name: 'red', bg: 'bg-red-500',		light: 'bg-red-100',		text: 'text-red-700',		border: 'border-red-300' },
  { name: 'blue', bg: 'bg-blue-500',		light: 'bg-blue-100',		text: 'text-blue-700',		border: 'border-blue-300' },
  { name: 'green', bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  { name: 'amber', bg: 'bg-amber-500',	light: 'bg-amber-100',		text: 'text-amber-700',		border: 'border-amber-300' },
  { name: 'purple', bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  { name: 'cyan', bg: 'bg-cyan-500',		light: 'bg-cyan-100',		text: 'text-cyan-700',		border: 'border-cyan-300' },
  { name: 'pink', bg: 'bg-pink-500',		light: 'bg-pink-100',		text: 'text-pink-700',		border: 'border-pink-300' },
  { name: 'orange', bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  { name: 'teal', bg: 'bg-teal-500',		light: 'bg-teal-100',		text: 'text-teal-700',		border: 'border-teal-300' },
  { name: 'indigo', bg: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  { name: 'rose', bg: 'bg-rose-500',		light: 'bg-rose-100',		text: 'text-rose-700',		border: 'border-rose-300' },
  { name: 'lime', bg: 'bg-lime-500',		light: 'bg-lime-100',		text: 'text-lime-700',		border: 'border-lime-300' },
];

export function getColorClasses(colorName: string) {
  return MEMBER_COLORS.find((c) => c.name === colorName) ?? MEMBER_COLORS[0];
}

export type Store = {
  id: string;
  user_id: string;
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

export type VacationPeriod = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reliever_name: string | null;
  reliever_phone: string | null;
  notes: string | null;
  created_at: string;
};

export type DeliveryConfirmation = {
  id: string;
  user_id: string;
  store_id: string;
  delivery_date: string;
  confirmed: boolean;
  confirmed_at: string | null;
  notes: string | null;
};

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export type VendorInvitation = {
  id: string;
  reliever_id: string;
  vendor_email: string;
  vendor_name: string;
  status: 'pending' | 'accepted' | 'declined';
  invite_token: string;
  message: string | null;
  created_at: string;
  accepted_at: string | null;
  responded_at: string | null;
};

export type VendorRelationship = {
  id: string;
  reliever_id: string;
  vendor_id: string;
  invitation_id: string | null;
  vendor_name: string;
  is_active: boolean;
  created_at: string;
};

export type VendorRoute = {
  id: string;
  vendor_id: string;
  reliever_id: string;
  name: string;
  company: string;
  delivery_days: string[];
  notes: string | null;
  created_at: string;
};

export type SoloGig = {
  id: string;
  reliever_id: string;
  vendor_id: string;
  route_id: string | null;
  gig_date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
};

export type RelieverDeliveryConfirmation = {
  id: string;
  reliever_id: string;
  vendor_id: string;
  store_id: string;
  week_start: string;
  confirmed_at: string;
};

export type RelieverStoreFeedback = {
  id: string;
  reliever_id: string;
  vendor_id: string;
  store_id: string;
  week_start: string;
  message: string;
  created_at: string;
};

export type MatchGig = {
  id: string;
  posted_by: string;
  poster_type: 'vendor' | 'reliever';
  title: string;
  description: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  gig_date: string;
  pay_rate: string | null;
  status: 'open' | 'claimed' | 'completed' | 'cancelled';
  claimed_by: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type MatchReview = {
  id: string;
  gig_id: string;
  reviewer_id: string;
  reviewee_id: string;
  reviewer_type: 'vendor' | 'reliever';
  rating: number;
  comment: string | null;
  created_at: string;
};

export type MultiRoute = {
  id: string;
  owner_id: string;
  name: string;
  company: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
};

export type ForumCategory = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
};

export type ForumTopic = {
  id: string;
  category_id: string;
  user_id: string;
  title: string;
  created_at: string;
  pinned: boolean;
};

export type ForumPost = {
  id: string;
  topic_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export type DeveloperFeedback = {
  id: string;
  user_id: string;
  category: 'bug' | 'feature' | 'general' | 'praise';
  message: string;
  page_context: string | null;
  created_at: string;
  status: string;
};

export type MultiRouteRunner = {
  id: string;
  route_id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  invite_token: string;
  created_at: string;
};
