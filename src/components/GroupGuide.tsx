import { useState } from 'react';
import type { Profile } from '@/lib/supabase';
import {
  Users,
  MapPin,
  UserCheck,
  ClipboardCheck,
  GraduationCap,
  DollarSign,
  Shield,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Phone,
  Mail,
  Clock,
} from 'lucide-react';

type Props = {
  profile: Profile | null;
};

const STEPS = [
  {
    icon: Users,
    title: 'Step 1: Recruit Your Route Owners',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    checkText: 'text-emerald-500',
    description:
      'Start by finding 8–10 independent DSD route owners in your area who share the same need for vacation coverage. These are vendors delivering for companies like Little Debbie, Mission Tortillas, Flowers Bread, Pepperidge Farm, and similar brands.',
    tips: [
      'Talk to vendors you already know at distribution centers and swap meets',
      'Post in local DSD Facebook groups and Reddit communities',
      'Reach out at grocery warehouses during early morning loading times',
      'Word of mouth is powerful — ask interested vendors to refer others',
      'Aim for geographic proximity so the reliever is not driving across town daily',
    ],
  },
  {
    icon: UserCheck,
    title: 'Step 2: Designate a Group Leader',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    checkText: 'text-blue-500',
    description:
      'One person from the group steps up as the leader. This person coordinates schedules, manages the reliever, handles background checks, and serves as the point of contact between all route owners and the reliever.',
    tips: [
      'The group leader should be organized, trusted by all members, and familiar with DSD operations',
      'The leader does not have to be a route owner themselves — but they must understand the demands of the job',
      'Consider rotating leadership annually to share the responsibility',
      'The leader is responsible for collecting availability calendars from all route owners',
    ],
  },
  {
    icon: Shield,
    title: 'Step 3: Hire & Vet Your Reliever',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    checkText: 'text-amber-500',
    description:
      'The group collectively hires one full-time reliever who will cover routes when owners are on vacation. This is the reliever\'s job — they work year-round covering for the 8–10 route owners in the group.',
    tips: [
      'The group leader conducts a thorough background check (criminal, driving record, employment verification)',
      'Verify a clean motor vehicle record — the reliever will be driving commercial routes daily',
      'Check references from previous DSD or delivery work',
      'Require a valid driver\'s license appropriate for the vehicle class used on routes',
      'Consider a trial period (2–4 weeks) before committing long-term',
      'The reliever must be available during all standard DSD delivery days',
    ],
  },
  {
    icon: GraduationCap,
    title: 'Step 4: First-Year Training Requirement',
    iconBg: 'bg-indigo-100',
    iconText: 'text-indigo-600',
    checkText: 'text-indigo-500',
    description:
      'During the first year, each route owner must spend one of their vacation weeks training the reliever on their specific route. This means the owner rides along with the reliever for that week instead of taking time off, ensuring the reliever learns every store, contact, backroom layout, and special instruction.',
    tips: [
      'Each owner sacrifices one vacation week in year one — this is the investment that makes the group sustainable',
      'During training week, the owner should walk the reliever through every store on every delivery day',
      'Document everything in the VacationDSD app — store info, special instructions, contacts, and delivery days',
      'The reliever should practice the route solo by the end of the training week while the owner is nearby',
      'After training, the reliever should be able to run the route independently using the app as their guide',
    ],
  },
  {
    icon: DollarSign,
    title: 'Step 5: Set Up Payments',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    checkText: 'text-emerald-500',
    description:
      'Each route owner pays into the group fund via direct deposit through the VacationDSD app. The app then pays the reliever weekly. This ensures the reliever has steady, reliable income and the owners have a predictable cost.',
    tips: [
      'Agree on a weekly rate for the reliever (divide by the number of route owners)',
      'Each owner contributes equal share — typically covering 3–6 weeks of vacation per year',
      'The reliever earns a full-time salary from the pooled contributions',
      'The reliever gets 4 weeks off per year — plan coverage during those weeks too',
      'Use the app to track payments and ensure transparency for all members',
    ],
  },
  {
    icon: ClipboardCheck,
    title: 'Step 6: Set Reliever Expectations',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    checkText: 'text-blue-500',
    description:
      'The group leader must clearly define what the reliever is expected to do on every route. This is not just driving and dropping off product — the reliever must run the route the same way the owner would.',
    tips: [
      'Arrive at the warehouse/distribution center at the scheduled time',
      'Load the truck correctly — check the invoice and verify product counts',
      'Follow the stop order for each delivery day as listed in the VacationDSD app',
      'At each store: check in with the contact person, stock shelves, rotate product, remove expired/damaged goods',
      'Follow all special instructions listed per store in the app — these are critical',
      'Use the delivery confirmation button in the app for each store as it is completed',
      'Handle credits, returns, and damaged product per the company\'s policies',
      'Communicate any issues to the route owner and group leader immediately',
    ],
  },
  {
    icon: Clock,
    title: 'Step 7: Coordinate Schedules',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    checkText: 'text-amber-500',
    description:
      'The group leader maintains a master calendar of all vacation periods. With 8–10 owners each taking 3–6 weeks off, the reliever\'s schedule must be planned well in advance to avoid conflicts.',
    tips: [
      'Collect all planned vacation dates at the start of each year',
      'No more than one owner should be on vacation at the same time (the reliever covers one route per day)',
      'The reliever\'s own 4 weeks of vacation should be scheduled during slower periods',
      'Use the VacationDSD app to log all vacation periods so the reliever can see what is coming',
      'Plan a buffer — if an owner gets sick or has an emergency, the reliever needs to be available',
    ],
  },
];

const FAQS = [
  {
    q: 'What if a route owner wants to join mid-year?',
    a: 'New members can join at any time, but they must still complete the first-year training week requirement. Their payment share should be prorated based on when they join. The group leader should schedule their training week during the new member\'s first planned vacation.',
  },
  {
    q: 'What happens if the reliever quits or is terminated?',
    a: 'The group leader should immediately begin the hiring process for a replacement. In the interim, route owners may need to cover their own routes or arrange temporary coverage. This is why the background check and trial period in Step 3 are so important — getting it right the first time saves the group from disruption.',
  },
  {
    q: 'Can a route owner have more than one route in the group?',
    a: 'By default, each owner has one route in the pool. If an owner wants to include additional routes, they should pay an additional share into the group fund, since the reliever will be covering more work during their vacation weeks.',
  },
  {
    q: 'What if two owners deliver for the same company?',
    a: 'That is actually ideal — the reliever may already be familiar with the product line, invoicing system, and store contacts. Groups work best when owners deliver for different companies but operate in the same geographic area.',
  },
  {
    q: 'How are disputes handled within the group?',
    a: 'The group leader serves as the mediator. For payment disputes, the app provides a transparent record of all transactions. For performance issues with the reliever, the leader should document concerns and address them with the reliever directly. If the issue cannot be resolved, the group can vote on whether to replace the reliever.',
  },
];

export function GroupGuide({ profile }: Props) {
  const [openStep, setOpenStep] = useState<number | null>(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 mb-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">How to Form Your VacationDSD Group</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              A complete guide for group leaders building a local DSD vacation pool
            </p>
          </div>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed">
          VacationDSD groups are made up of 8–10 independent route owners who pool their resources
          to hire one full-time reliever. Each owner gets 3–6 weeks of vacation per year while the
          reliever earns a steady salary and gets 4 weeks off. This guide walks you through every
          step of forming and running a successful group.
        </p>
        {profile?.city && profile?.state && (
          <div className="mt-4 inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-sm">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Building groups in {profile.city}, {profile.state}</span>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Route Owners" value="8–10" subtitle="per group" />
        <StatCard label="Reliever" value="1" subtitle="full-time" />
        <StatCard label="Owner Vacation" value="3–6" subtitle="weeks/year" />
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-8">
        {STEPS.map((step, idx) => {
          const isOpen = openStep === idx;
          const Icon = step.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpenStep(isOpen ? null : idx)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50 transition-colors"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${step.iconBg}`}
                >
                  <Icon className={`w-6 h-6 ${step.iconText}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900">{step.title}</h3>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-5 pb-5">
                  <p className="text-slate-600 text-sm leading-relaxed mb-4">
                    {step.description}
                  </p>
                  <div className="space-y-2">
                    {step.tips.map((tip, tipIdx) => (
                      <div key={tipIdx} className="flex items-start gap-2.5">
                        <CheckCircle2 className={`w-4 h-4 ${step.checkText} mt-0.5 flex-shrink-0`} />
                        <span className="text-sm text-slate-600">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Background Check Section */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-amber-900">Background Check Checklist</h3>
            <p className="text-sm text-amber-700 mt-0.5">
              The group leader is responsible for completing all checks before hiring a reliever.
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 mt-4">
          {[
            'Criminal background check (county, state, federal)',
            'Motor vehicle record (MVR) — clean driving history',
            'Employment verification — previous DSD or delivery jobs',
            'Reference checks — at least 2 professional references',
            'Drug screening',
            'Valid driver\'s license (correct class for route vehicle)',
            'Social Security number verification',
            'Proof of insurance (auto and/or commercial)',
          ].map((item, idx) => (
            <div key={idx} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-md border-2 border-amber-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-3 h-3 text-amber-500" />
              </div>
              <span className="text-sm text-amber-800">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reliever Expectations */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-blue-900">Reliever Expectations Summary</h3>
            <p className="text-sm text-blue-700 mt-0.5">
              Print this and review with the reliever before they start.
            </p>
          </div>
        </div>
        <div className="space-y-2.5">
          {[
            'Arrive on time at the distribution center — loading starts early',
            'Verify product counts against the invoice before leaving the warehouse',
            'Follow the stop order for each delivery day as shown in the VacationDSD app',
            'At each store: check in with the contact, stock shelves, rotate product, pull expired goods',
            'Read and follow all special instructions per store — these are the most important details',
            'Use the delivery confirmation button in the app after each store is complete',
            'Handle credits, returns, and damaged product per company policy',
            'Keep the truck clean and organized throughout the route',
            'Report any issues to the route owner and group leader the same day',
            'Treat every store as if it is your own route — because it is, while the owner is away',
          ].map((item, idx) => (
            <div key={idx} className="flex items-start gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              <span className="text-sm text-blue-800">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* First Year Training */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-900">First-Year Training Week</h3>
            <p className="text-sm text-emerald-700 mt-0.5">
              Each route owner invests one vacation week in year one to train the reliever.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <TrainingDay day="Day 1–2" task="Owner drives and works the route. Reliever rides along, observes, takes notes, and meets store contacts." />
          <TrainingDay day="Day 3–4" task="Reliever drives and works the route with owner alongside. Owner corrects and guides in real time at each stop." />
          <TrainingDay day="Day 5" task="Reliever runs the route solo. Owner is nearby but does not intervene unless necessary. Review at end of day." />
        </div>
        <div className="mt-4 flex items-start gap-2.5 bg-emerald-100 rounded-xl p-3">
          <Lightbulb className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-emerald-800">
            After training, the reliever should be able to run the route independently using the
            VacationDSD app as their guide. Make sure all store info and special instructions are
            fully documented in the app before the training week ends.
          </p>
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Frequently Asked Questions</h3>
        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-slate-900 text-sm">{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Contact */}
      <div className="bg-slate-900 rounded-2xl p-6 text-center">
        <h3 className="font-bold text-white mb-2">Need Help Forming Your Group?</h3>
        <p className="text-slate-400 text-sm mb-4">
          Reach out to the VacationDSD team for guidance on building a group in your area.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5 text-sm text-white">
            <Mail className="w-4 h-4 text-emerald-400" />
            support@vacationdsd.com
          </div>
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5 text-sm text-white">
            <Phone className="w-4 h-4 text-emerald-400" />
            1-800-VAC-DSD-1
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1">{label}</p>
      <p className="text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}

function TrainingDay({ day, task }: { day: string; task: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
        {day}
      </div>
      <p className="text-sm text-emerald-800">{task}</p>
    </div>
  );
}
