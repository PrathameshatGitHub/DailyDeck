'use client';

import { useState, useEffect, useRef } from 'react';
import {
  useJobCallbacks,
  type JobCallback,
  type ContactType,
  type CallbackStatus,
} from '@/lib/hooks/useJobCallbacks';
import {
  Plus, Trash2, Search, Check, X, Bell,
  Mail, Phone, Globe, MessageCircle, Link2, Calendar,
  ChevronDown, Building2, AlertCircle, Sparkles, AlarmClock,
} from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

// ─── Contact type config ──────────────────────────────────────────────────────
const CONTACT_TYPES: { value: ContactType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'email',    label: 'Email',     icon: Mail,          color: 'text-blue-400' },
  { value: 'phone',    label: 'Phone',     icon: Phone,         color: 'text-green-400' },
  { value: 'linkedin', label: 'LinkedIn',  icon: Globe,         color: 'text-sky-400' },
  { value: 'whatsapp', label: 'WhatsApp',  icon: MessageCircle, color: 'text-emerald-400' },
  { value: 'custom',   label: 'Custom',    icon: Link2,         color: 'text-zinc-400' },
];

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<CallbackStatus, { label: string; color: string; bg: string; dot: string }> = {
  applied:           { label: 'Applied',          color: 'text-[#E8B54D]',   bg: 'bg-[#E8B54D]/10 border-[#E8B54D]/30',   dot: 'bg-[#E8B54D]' },
  follow_up_pending: { label: 'Follow-up Due',    color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',        dot: 'bg-red-400 animate-pulse' },
  completed:         { label: 'Completed',         color: 'text-[#7FE7C4]',  bg: 'bg-[#7FE7C4]/10 border-[#7FE7C4]/30',  dot: 'bg-[#7FE7C4]' },
  archived:          { label: 'Archived',          color: 'text-zinc-500',   bg: 'bg-zinc-800/40 border-zinc-700/30',     dot: 'bg-zinc-500' },
};

const SNOOZE_OPTIONS = [
  { label: 'Tomorrow',   days: 1 },
  { label: 'In 3 Days',  days: 3 },
  { label: 'In 1 Week',  days: 7 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function isOverdue(dateStr: string | null) {
  if (!dateStr) return false;
  return dateStr < new Date().toISOString().split('T')[0];
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SchedulesPage() {
  const {
    callbacks, loading, stats, dueToday,
    addCallback, completeCallback, snoozeCallback, deleteCallback, updateCallback,
  } = useJobCallbacks();

  // Form state
  const [isFormOpen, setIsFormOpen]   = useState(false);
  const [formTitle,       setFormTitle]       = useState('');
  const [formCompany,     setFormCompany]     = useState('');
  const [formDesc,        setFormDesc]        = useState('');
  const [formContactType, setFormContactType] = useState<ContactType>('email');
  const [formContactVal,  setFormContactVal]  = useState('');
  const [formAppliedDate, setFormAppliedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formFollowUp,    setFormFollowUp]    = useState('');
  const [formSubmitting,  setFormSubmitting]  = useState(false);
  const [contactDropdown, setContactDropdown] = useState(false);

  // Filter/search
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<CallbackStatus | 'all'>('all');

  // Notification banner (per session) — hidden on this page since layout shows it
  const [snoozeDropdownId, setSnoozeDropdownId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [callbackToDelete, setCallbackToDelete] = useState<{ id: string; title: string } | null>(null);

  const formRef = useRef<HTMLDivElement>(null);
  const contactDropRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Dismiss on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        if (!formTitle.trim()) setIsFormOpen(false);
      }
      if (contactDropRef.current && !contactDropRef.current.contains(e.target as Node)) {
        setContactDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [formTitle]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setFormSubmitting(true);
    await addCallback({
      title:         formTitle.trim(),
      company:       formCompany.trim() || undefined,
      description:   formDesc.trim()    || undefined,
      contact_type:  formContactType,
      contact_value: formContactVal.trim() || undefined,
      applied_date:  formAppliedDate,
      follow_up_date: formFollowUp || undefined,
    });
    setFormTitle('');
    setFormCompany('');
    setFormDesc('');
    setFormContactVal('');
    setFormFollowUp('');
    setIsFormOpen(false);
    setFormSubmitting(false);
    showToast('Callback added');
  };

  const handleComplete = async (id: string, title: string) => {
    await completeCallback(id);
    setSnoozeDropdownId(null);
    showToast(`✓ "${title}" marked complete`);
  };

  const handleSnooze = async (id: string, days: number, label: string) => {
    await snoozeCallback(id, days);
    setSnoozeDropdownId(null);
    showToast(`Reminder snoozed — ${label}`);
  };

  const handleDelete = async (id: string) => {
    await deleteCallback(id);
    setCallbackToDelete(null);
    showToast('Entry deleted');
  };

  // Filtered list
  const filtered = callbacks.filter((c) => {
    const matchSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.company || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' ? true : c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const contactType = CONTACT_TYPES.find((t) => t.value === formContactType)!;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] font-mono text-xs text-zinc-500">
        <span className="animate-pulse">&gt; loading_callbacks...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans pb-12 relative">

      {/* Toast */}
      {toast && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-[#7FE7C4] text-black px-4 py-2 rounded-lg shadow-xl font-mono text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <Check className="w-3.5 h-3.5" />
          {toast}
        </div>
      )}

      {/* ── Stats Strip ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#242930] gap-2 font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[#89295E] font-bold">&gt;</span>
            <span className="text-zinc-200 font-bold">job_callbacks</span>
          </div>
          <span className="text-zinc-600">|</span>
          <span>{stats.total} total</span>
          <span className="text-[#E8B54D]">· {stats.applied} waiting</span>
          {stats.followUpDue > 0 && (
            <span className="text-red-400 font-bold animate-pulse">· {stats.followUpDue} follow-up due</span>
          )}
          <span className="text-[#7FE7C4]">· {stats.completed} done</span>
        </div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest">callback_tracker</div>
      </div>

      {/* ── Add New Entry Form ────────────────────────────────────────────── */}
      <div ref={formRef}>
        <div className={`bg-[#15181D] border rounded-xl shadow-lg transition-all duration-200 overflow-hidden ${
          isFormOpen ? 'border-[#89295E]/60 ring-1 ring-[#89295E]/30' : 'border-[#242930] hover:border-zinc-700'
        }`}>
          {!isFormOpen ? (
            <button
              onClick={() => setIsFormOpen(true)}
              className="w-full p-3.5 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3 font-mono text-xs text-zinc-500">
                <span className="text-[#89295E] font-bold">&gt;</span>
                <span>Add job callback / application...</span>
              </div>
              <Plus className="w-4 h-4 text-zinc-400" />
            </button>
          ) : (
            <form onSubmit={handleAdd} className="p-4 space-y-4">
              {/* Row 1: Title + Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Job Title / Role *
                  </label>
                  <input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Frontend Developer"
                    className="w-full bg-[#1F2329] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E]/60 font-sans"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Company / Org
                  </label>
                  <input
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    placeholder="e.g. Acme Inc."
                    className="w-full bg-[#1F2329] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E]/60 font-sans"
                  />
                </div>
              </div>

              {/* Row 2: Description */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Notes / Description
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Interview notes, recruiter name, job link..."
                  rows={2}
                  className="w-full bg-[#1F2329] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E]/60 font-sans resize-none leading-relaxed"
                />
              </div>

              {/* Row 3: Contact type + value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Contact Via
                  </label>
                  <div className="relative" ref={contactDropRef}>
                    <button
                      type="button"
                      onClick={() => setContactDropdown(!contactDropdown)}
                      className="w-full bg-[#1F2329] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-[#89295E]/60 flex items-center justify-between hover:border-zinc-600 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <contactType.icon className={`w-3.5 h-3.5 ${contactType.color}`} />
                        <span>{contactType.label}</span>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                    {contactDropdown && (
                      <div className="absolute left-0 top-full mt-1 z-20 w-full bg-[#1F2329] border border-[#242930] rounded-lg shadow-xl overflow-hidden">
                        {CONTACT_TYPES.map(({ value, label, icon: Icon, color }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => { setFormContactType(value); setContactDropdown(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-[#282D35] ${
                              formContactType === value ? 'bg-[#282D35] text-zinc-100' : 'text-zinc-300'
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 ${color}`} />
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Contact Value
                  </label>
                  <input
                    value={formContactVal}
                    onChange={(e) => setFormContactVal(e.target.value)}
                    placeholder={
                      formContactType === 'email' ? 'recruiter@company.com' :
                      formContactType === 'phone' ? '+1 234 567 8900' :
                      formContactType === 'linkedin' ? 'linkedin.com/in/...' :
                      formContactType === 'whatsapp' ? '+1 234 567 8900' :
                      'Custom contact info'
                    }
                    className="w-full bg-[#1F2329] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E]/60 font-sans"
                  />
                </div>
              </div>

              {/* Row 4: Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Applied Date
                  </label>
                  <div className="relative flex items-center bg-[#1F2329] border border-[#242930] hover:border-zinc-600 focus-within:border-[#89295E]/60 rounded-lg px-3 py-2 gap-2 transition-colors">
                    <Calendar className="w-3.5 h-3.5 text-[#89295E] shrink-0 pointer-events-none" />
                    <span className="text-xs text-zinc-200 font-sans flex-1 pointer-events-none select-none">
                      {formAppliedDate
                        ? new Date(formAppliedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Pick date'}
                    </span>
                    <input
                      type="date"
                      value={formAppliedDate}
                      onChange={(e) => setFormAppliedDate(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Follow-up Reminder
                  </label>
                  <div className="relative flex items-center bg-[#1F2329] border border-[#242930] hover:border-zinc-600 focus-within:border-[#E8B54D]/50 rounded-lg px-3 py-2 gap-2 transition-colors">
                    <Bell className="w-3.5 h-3.5 text-[#E8B54D] shrink-0 pointer-events-none" />
                    <span className={`text-xs flex-1 pointer-events-none select-none ${formFollowUp ? 'text-zinc-200 font-sans' : 'text-zinc-600 font-sans'}`}>
                      {formFollowUp
                        ? new Date(formFollowUp + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Set reminder date'}
                    </span>
                    <input
                      type="date"
                      value={formFollowUp}
                      onChange={(e) => setFormFollowUp(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <p className="text-[9px] text-zinc-600 font-mono mt-1">When this date hits → auto-moves to Follow-up Due</p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#242930]/60 font-mono">
                <button
                  type="button"
                  onClick={() => { setIsFormOpen(false); setFormTitle(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1F2329] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formTitle.trim() || formSubmitting}
                  className="px-5 py-1.5 rounded-lg bg-[#89295E] hover:bg-[#a03672] disabled:opacity-40 text-white text-xs font-bold tracking-wide transition-all shadow active:scale-[0.98]"
                >
                  {formSubmitting ? 'Adding...' : 'Add Callback'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1 bg-[#15181D] border border-[#242930] rounded-xl flex items-center px-3.5 py-2 focus-within:border-[#89295E]/60 transition-colors">
          <Search className="w-4 h-4 text-zinc-500 mr-2.5 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, company, notes..."
            className="w-full bg-transparent text-xs text-zinc-200 outline-none border-none placeholder:text-zinc-600 font-sans"
          />
          {search && (
            <button onClick={() => setSearch('')} className="p-0.5 text-zinc-500 hover:text-zinc-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5 font-mono flex-wrap">
          {(['all', 'applied', 'follow_up_pending', 'completed', 'archived'] as const).map((s) => {
            const cfg = s === 'all' ? null : STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                  statusFilter === s
                    ? s === 'all'
                      ? 'bg-[#89295E] text-white border-[#89295E]'
                      : `${cfg!.bg} ${cfg!.color} border-current`
                    : 'bg-[#15181D] text-zinc-500 border-[#242930] hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {s === 'all' ? 'All' : cfg!.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Callback Cards ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#242930] rounded-2xl bg-[#15181D]/30 space-y-2">
            <Sparkles className="w-6 h-6 text-zinc-600 mb-1" />
            <p className="text-xs text-zinc-400 font-bold font-mono">
              {search || statusFilter !== 'all' ? 'No matching callbacks' : 'No callbacks yet'}
            </p>
            <p className="text-[11px] text-zinc-600 max-w-xs">
              {search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Click the box above to add your first job callback.'}
            </p>
          </div>
        ) : (
          filtered.map((cb) => {
            const cfg = STATUS_CONFIG[cb.status];
            const ctCfg = CONTACT_TYPES.find((t) => t.value === cb.contact_type)!;
            const ContactIcon = ctCfg.icon;
            const isPending = cb.status === 'follow_up_pending';

            return (
              <div
                key={cb.id}
                className={`group bg-[#15181D] border rounded-xl p-4 transition-all duration-150 ${
                  isPending
                    ? 'border-red-500/40 hover:border-red-400/60 bg-red-950/10'
                    : cb.status === 'completed'
                    ? 'border-[#242930] opacity-70 hover:opacity-90'
                    : 'border-[#242930] hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Title + Status Badge */}
                    <div className="flex items-start gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-sm font-bold truncate ${
                          cb.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-100'
                        }`}>
                          {cb.title}
                        </h3>
                        {cb.company && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3 text-zinc-500 shrink-0" />
                            <span className="text-[11px] text-zinc-400 font-mono">{cb.company}</span>
                          </div>
                        )}
                      </div>
                      {/* Status */}
                      <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold border shrink-0 ${cfg.bg} ${cfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Description */}
                    {cb.description && (
                      <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">{cb.description}</p>
                    )}

                    {/* Meta row: Contact + Dates */}
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-zinc-500">
                      {cb.contact_value && (
                        <div className="flex items-center gap-1">
                          <ContactIcon className={`w-3 h-3 ${ctCfg.color}`} />
                          <span className="text-zinc-400">{cb.contact_value}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Applied: {formatDate(cb.applied_date)}</span>
                      </div>
                      {cb.follow_up_date && (
                        <div className={`flex items-center gap-1 ${isOverdue(cb.follow_up_date) && cb.status !== 'completed' ? 'text-red-400 font-bold' : ''}`}>
                          <Bell className="w-3 h-3" />
                          <span>Follow-up: {formatDate(cb.follow_up_date)}</span>
                          {isOverdue(cb.follow_up_date) && cb.status !== 'completed' && (
                            <AlertCircle className="w-3 h-3 text-red-400" />
                          )}
                        </div>
                      )}
                      {cb.snoozed_until && cb.status === 'applied' && (
                        <div className="flex items-center gap-1 text-[#E8B54D]">
                          <AlarmClock className="w-3 h-3" />
                          <span>Snoozed until {formatDate(cb.snoozed_until)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {/* Complete button */}
                    {cb.status !== 'completed' && (
                      <button
                        onClick={() => handleComplete(cb.id, cb.title)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7FE7C4]/10 border border-[#7FE7C4]/30 text-[#7FE7C4] text-[10px] font-mono font-bold hover:bg-[#7FE7C4]/20 transition-colors opacity-0 group-hover:opacity-100"
                        title="Mark as complete"
                      >
                        <Check className="w-3 h-3" />
                        Done
                      </button>
                    )}

                    {/* Snooze button — only for follow_up_pending */}
                    {isPending && (
                      <div className="relative">
                        <button
                          onClick={() => setSnoozeDropdownId(snoozeDropdownId === cb.id ? null : cb.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1F2329] border border-[#242930] text-zinc-300 text-[10px] font-mono font-bold hover:border-zinc-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <AlarmClock className="w-3 h-3" />
                          Snooze
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {snoozeDropdownId === cb.id && (
                          <div className="absolute right-0 top-full mt-1 z-20 bg-[#1F2329] border border-[#242930] rounded-lg shadow-xl overflow-hidden min-w-[130px]">
                            {SNOOZE_OPTIONS.map(({ label, days }) => (
                              <button
                                key={days}
                                onClick={() => handleSnooze(cb.id, days, label)}
                                className="w-full text-left px-3 py-2 text-[11px] font-mono text-zinc-300 hover:bg-[#282D35] hover:text-zinc-100 transition-colors"
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => setCallbackToDelete({ id: cb.id, title: cb.title })}
                      className="p-1.5 rounded-lg hover:bg-red-950/40 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!callbackToDelete}
        title="Delete Callback"
        message={`Delete "${callbackToDelete?.title}"? This action cannot be undone.`}
        onConfirm={() => callbackToDelete && handleDelete(callbackToDelete.id)}
        onCancel={() => setCallbackToDelete(null)}
      />
    </div>
  );
}
